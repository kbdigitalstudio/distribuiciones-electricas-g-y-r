"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { RecordInventoryMovementSchema } from "@/lib/validations";
import { canAccessInventory } from "@/lib/roles";
import {
  applyInventoryMovement,
  InventoryRuleError,
} from "@/lib/inventory-rules";
import { lockInventoryRow } from "@/lib/inventory-locks";

class InventoryNotFoundError extends Error {
  constructor() {
    super("INVENTARIO_NO_ENCONTRADO");
    this.name = "InventoryNotFoundError";
  }
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

// GET /api/inventory/movements — Consultar movimientos de inventario (INVENTARIO/ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!canAccessInventory(auth.roles)) {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol INVENTARIO o ADMIN", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 20;
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
      movements: movements.map((m) => ({
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
//
// Concurrencia:
// - SELECT ... FOR UPDATE sobre Inventory antes de leer/escribir.
// - Todas las reglas de cantidades pasan por applyInventoryMovement(), que
//   garantiza quantityOnHand >= quantityReserved >= 0.
// - El movimiento y su OperationLog se escriben en la misma transacción.
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!canAccessInventory(auth.roles)) {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol INVENTARIO o ADMIN", code: "FORBIDDEN" },
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

    const result = await db.$transaction(
      async (tx) => {
        // ORDEN DE BLOQUEO: Inventory primero.
        await lockInventoryRow(tx, productId);

        const inventory = await tx.inventory.findUnique({
          where: { productId },
        });

        if (!inventory) {
          throw new InventoryNotFoundError();
        }

        const previousQuantity = inventory.quantityOnHand;

        // Reglas puras: valida disponibilidad, reservas y cantidades negativas.
        const next = applyInventoryMovement(
          inventory,
          movementType,
          quantity
        );

        const updatedInventory = await tx.inventory.update({
          where: { productId },
          data: {
            quantityOnHand: next.quantityOnHand,
            quantityReserved: next.quantityReserved,
          },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            productId,
            movementType,
            quantity,
            previousQuantity,
            newQuantity: next.quantityOnHand,
            reason,
            reference: reference ?? null,
            createdBy: auth.session.userId,
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "INVENTORY_MOVEMENT",
            entityType: "InventoryMovement",
            entityId: movement.id,
            details: {
              productId,
              movementType,
              quantity,
              reason,
              reference: reference ?? null,
              performedBy: auth.session.userId,
            },
          },
        });

        return { inventory: updatedInventory, movement };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
        maxWait: 10000,
      }
    );

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
  } catch (error: unknown) {
    console.error("Error registrando movimiento de inventario:", error);

    if (error instanceof InventoryNotFoundError) {
      return NextResponse.json(
        {
          error: "Inventario no encontrado para este producto",
          code: "INVENTARIO_NO_ENCONTRADO",
        },
        { status: 404 }
      );
    }

    if (error instanceof InventoryRuleError) {
      if (error.code === "INVENTARIO_INCONSISTENTE") {
        return NextResponse.json(
          {
            error: "El inventario se encuentra en un estado inconsistente",
            code: "INVENTARIO_INCONSISTENTE",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    if (isPrismaError(error, "P2028")) {
      return NextResponse.json(
        {
          error:
            "La operación de inventario excedió el tiempo de espera por concurrencia; reintente",
          code: "TRANSACTION_TIMEOUT",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
