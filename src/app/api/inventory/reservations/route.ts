"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, hasMinRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { CreateInventoryReservationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// Roles autorizados para operaciones de inventario (INVENTARIO como rol independiente,
// VENDEDOR mantiene compatibilidad con usuarios existentes)
function isInventoryAuthorized(roles: string[]): boolean {
  return hasMinRole(roles, "INVENTARIO");
}

// POST /api/inventory/reservations — Crear reserva (INVENTARIO/ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!isInventoryAuthorized(auth.roles)) {
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
    const parsed = CreateInventoryReservationSchema.safeParse(body);

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

    const { productId, quantity, reference, expiresAt, idempotencyKey } = parsed.data;

    // Idempotencia: si se proporciona una clave, verificar si ya existe una reserva
    // con esa clave para evitar duplicados en solicitudes concurrentes
    if (idempotencyKey) {
      const existingReservation = await db.inventoryReservation.findUnique({
        where: { idempotencyKey },
      });

      if (existingReservation) {
        // Devolver la reserva existente en lugar de crear una nueva
        return NextResponse.json(
          {
            success: true,
            reservation: {
              id: existingReservation.id,
              productId: existingReservation.productId,
              quantity: existingReservation.quantity,
              status: existingReservation.status,
              reservedAt: existingReservation.reservedAt,
              expiresAt: existingReservation.expiresAt,
            },
            message: "Reserva ya existe para esta clave de idempotencia",
          },
          { status: 200 }
        );
      }
    }

    const result = await db.$transaction(async (tx: any) => {
      // BLOQUEO DE FILA: SELECT FOR UPDATE para evitar condiciones de carrera.
      // Esto bloquea la fila de inventario hasta que termine la transacción,
      // impidiendo que otra transacción lea o modifique las existencias simultáneamente.
      await tx.$queryRaw<any>`
        SELECT * FROM "Inventory" WHERE "productId" = ${productId} FOR UPDATE
      `;

      const inventory = await tx.inventory.findUnique({
        where: { productId },
      });

      if (!inventory) {
        throw new Error("INVENTARIO_NO_ENCONTRADO");
      }

      const available = inventory.quantityOnHand - inventory.quantityReserved;

      if (available < quantity) {
        throw new Error("STOCK_INSUFICIENTE");
      }

      // Crear reserva
      const reservation = await tx.inventoryReservation.create({
        data: {
          productId,
          quantity,
          status: "ACTIVE",
          reference: reference ?? null,
          idempotencyKey: idempotencyKey ?? null,
          createdBy: auth.session.userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      // Actualizar cantidad reservada dentro del mismo bloqueo
      await tx.inventory.update({
        where: { productId },
        data: {
          quantityReserved: inventory.quantityReserved + quantity,
        },
      });

      return reservation;
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "INVENTORY_RESERVATION_CREATE",
        entityType: "InventoryReservation",
        entityId: result.id,
        details: {
          productId,
          quantity,
          reference,
          idempotencyKey,
          reservedBy: auth.session.userId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        reservation: {
          id: result.id,
          productId: result.productId,
          quantity: result.quantity,
          status: result.status,
          reservedAt: result.reservedAt,
          expiresAt: result.expiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creando reserva de inventario:", error);

    if (error.message === "INVENTARIO_NO_ENCONTRADO") {
      return NextResponse.json(
        { error: "Inventario no encontrado para este producto", code: "INVENTARIO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    if (error.message === "STOCK_INSUFICIENTE") {
      return NextResponse.json(
        { error: "Stock disponible insuficiente para la reserva", code: "STOCK_INSUFICIENTE" },
        { status: 400 }
      );
    }

    // Error de restricción UNIQUE en idempotencyKey (condición de carrera en idempotencia)
    if (error.code === "P2002" && error.meta?.target?.includes("idempotencyKey")) {
      return NextResponse.json(
        {
          error: "Ya existe una reserva con esta clave de idempotencia",
          code: "IDEMPOTENCY_KEY_DUPLICATE",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/reservations/[id] — Liberar reserva (INVENTARIO/ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ [key: string]: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!isInventoryAuthorized(auth.roles)) {
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
    const { id } = await params;

    const result = await db.$transaction(async (tx: any) => {
      // BLOQUEO DE FILA: bloquear la reserva y el inventario relacionado
      await tx.$queryRaw<any>`
        SELECT * FROM "InventoryReservation" WHERE "id" = ${id} FOR UPDATE
      `;

      const reservation = await tx.inventoryReservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        throw new Error("RESERVA_NO_ENCONTRADA");
      }

      if (reservation.status !== "ACTIVE") {
        throw new Error("RESERVA_NO_ACTIVA");
      }

      // BLOQUEO DE FILA: bloquear el inventario del producto para actualizar cantidad reservada
      await tx.$queryRaw<any>`
        SELECT * FROM "Inventory" WHERE "productId" = ${reservation.productId} FOR UPDATE
      `;

      // Liberar reserva: disminuir cantidad reservada
      await tx.inventory.update({
        where: { productId: reservation.productId },
        data: {
          quantityReserved: Math.max(
            0,
            reservation.quantityReserved ?? 0 - reservation.quantity
          ),
        },
      });

      // Marcar reserva como liberada
      const updated = await tx.inventoryReservation.update({
        where: { id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      return updated;
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "INVENTORY_RESERVATION_RELEASE",
        entityType: "InventoryReservation",
        entityId: id,
        details: { releasedBy: auth.session.userId },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Reserva liberada correctamente",
    });
  } catch (error: any) {
    console.error("Error liberando reserva:", error);

    if (error.message === "RESERVA_NO_ENCONTRADA") {
      return NextResponse.json(
        { error: "Reserva no encontrada", code: "RESERVA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    if (error.message === "RESERVA_NO_ACTIVA") {
      return NextResponse.json(
        { error: "La reserva no está activa", code: "RESERVA_NO_ACTIVA" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
