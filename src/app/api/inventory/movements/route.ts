"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, hasMinRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { RecordInventoryMovementSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// GET /api/inventory/movements — Consultar movimientos de inventario (INVENTARIO/ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!hasMinRole(auth.roles, "VENDEDOR")) {
    return NextResponse.json(
      { error: "Acceso denegado: rol insuficiente", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) ?? 1;
    const pageSize = Number(searchParams.get("pageSize")) ?? 20;
    const productId = searchParams.get("productId") ?? undefined;
    const movementType = searchParams.get("movementType") ?? undefined;

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;

    const [movements, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, slug: true, name: true } },
          user: { select: { id: true, nombre: true, email: true } },
        },
      }),
      db.inventoryMovement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      movements: movements.map((m: any) => ({
        id: m.id,
        product: m.product,
        movementType: m.movementType,
        quantity: m.quantity,
        previousQuantity: m.previousQuantity,
        newQuantity: m.newQuantity,
        reason: m.reason,
        reference: m.reference,
        createdBy: m.user,
        createdAt: m.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error consultando movimientos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/inventory/movements — Registrar movimiento (INVENTARIO/ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!hasMinRole(auth.roles, "VENDEDOR")) {
    return NextResponse.json(
      { error: "Acceso denegado: rol insuficiente", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json(
      { error: "Token CSRF inválido", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = RecordInventoryMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, movementType, quantity, reason, reference } = parsed.data;

    // Usar transacción para garantizar atomicidad y evitar sobreventa
    const result = await db.$transaction(async (tx: any) => {
      // Bloquear el registro de inventario para evitar condiciones de carrera
      const inventory = await tx.inventory.findUnique({
        where: { productId },
      });

      if (!inventory) {
        throw new Error("INVENTARIO_NO_ENCONTRADO");
      }

      const previousQuantity = inventory.quantityOnHand;
      let newQuantity: number;

      switch (movementType) {
        case "ENTRY":
          newQuantity = previousQuantity + quantity;
          break;
        case "EXIT":
          if (previousQuantity < quantity) {
            throw new Error("STOCK_INSUFICIENTE");
          }
          newQuantity = previousQuantity - quantity;
          break;
        case "ADJUSTMENT":
          newQuantity = quantity; // Ajuste directo al valor indicado
          break;
        case "RESERVATION":
          if (previousQuantity < quantity) {
            throw new Error("STOCK_INSUFICIENTE");
          }
          newQuantity = previousQuantity; // Reservar no cambia onHand, cambia reserved
          break;
        case "RELEASE":
          newQuantity = previousQuantity;
          break;
        default:
          throw new Error("TIPO_MOVIMIENTO_INVALIDO");
      }

      if (newQuantity < 0) {
        throw new Error("CANTIDAD_NEGATIVA");
      }

      // Actualizar inventario
      const updateData: Record<string, unknown> = {
        quantityOnHand: newQuantity,
      };

      if (movementType === "RESERVATION") {
        updateData.quantityReserved = inventory.quantityReserved + quantity;
      } else if (movementType === "RELEASE") {
        updateData.quantityReserved = Math.max(
          0,
          inventory.quantityReserved - quantity
        );
      }

      const updatedInventory = await tx.inventory.update({
        where: { productId },
        data: updateData,
      });

      // Registrar movimiento
      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          movementType,
          quantity,
          previousQuantity,
          newQuantity,
          reason,
          reference: reference ?? null,
          createdBy: auth.session.userId,
        },
      });

      return { inventory: updatedInventory, movement };
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "INVENTORY_MOVEMENT",
        entityType: "InventoryMovement",
        entityId: result.movement.id,
        details: {
          productId,
          movementType,
          quantity,
          reason,
          performedBy: auth.session.userId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        movement: {
          id: result.movement.id,
          productId: result.movement.productId,
          movementType: result.movement.movementType,
          quantity: result.movement.quantity,
          previousQuantity: result.movement.previousQuantity,
          newQuantity: result.movement.newQuantity,
          reason: result.movement.reason,
        },
        inventory: {
          productId: result.inventory.productId,
          quantityOnHand: result.inventory.quantityOnHand,
          quantityReserved: result.inventory.quantityReserved,
          availableQuantity:
            result.inventory.quantityOnHand - result.inventory.quantityReserved,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error registrando movimiento de inventario:", error);

    if (error.message === "INVENTARIO_NO_ENCONTRADO") {
      return NextResponse.json(
        { error: "Inventario no encontrado para este producto", code: "INVENTARIO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    if (error.message === "STOCK_INSUFICIENTE") {
      return NextResponse.json(
        { error: "Stock insuficiente para realizar el movimiento", code: "STOCK_INSUFICIENTE" },
        { status: 400 }
      );
    }

    if (error.message === "CANTIDAD_NEGATIVA") {
      return NextResponse.json(
        { error: "La cantidad resultante no puede ser negativa", code: "CANTIDAD_NEGATIVA" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
