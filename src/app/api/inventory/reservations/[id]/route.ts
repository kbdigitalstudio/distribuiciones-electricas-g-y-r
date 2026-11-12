"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { canAccessInventory } from "@/lib/roles";
import { InventoryRuleError, releaseInventory } from "@/lib/inventory-rules";
import {
  lockInventoryRow,
  lockReservationRow,
} from "@/lib/inventory-locks";
import { serializeReservation } from "@/lib/inventory-serializers";

const ReservationIdSchema = z.string().uuid("ID de reserva inválido");

class ReservationNotFoundError extends Error {
  constructor() {
    super("RESERVA_NO_ENCONTRADA");
    this.name = "ReservationNotFoundError";
  }
}

class ReservationNotActiveError extends Error {
  constructor() {
    super("RESERVA_NO_ACTIVA");
    this.name = "ReservationNotActiveError";
  }
}

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

// DELETE /api/inventory/reservations/[id] — Liberar reserva (INVENTARIO/ADMIN)
//
// Concurrencia:
// - Lee la reserva sin bloqueo solo para conocer su productId.
// - Bloquea Inventory primero y luego InventoryReservation, respetando el orden
//   global de bloqueo (Inventory -> InventoryReservation).
// - Relee y revalida el estado después del bloqueo: dos liberaciones simultáneas
//   de la misma reserva producen exactamente una liberación efectiva.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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
    const rawId = (await params).id;
    const parsedId = ReservationIdSchema.safeParse(rawId);

    if (!parsedId.success) {
      return NextResponse.json(
        {
          error: "ID de reserva inválido",
          code: "VALIDATION_ERROR",
          details: parsedId.error.flatten().formErrors,
        },
        { status: 400 }
      );
    }

    const id = parsedId.data;

    const updated = await db.$transaction(
      async (tx) => {
        // Lectura sin bloqueo: el productId de una reserva es inmutable.
        const preview = await tx.inventoryReservation.findUnique({
          where: { id },
          select: { productId: true },
        });

        if (!preview) {
          throw new ReservationNotFoundError();
        }

        // ORDEN DE BLOQUEO: Inventory primero, luego InventoryReservation.
        await lockInventoryRow(tx, preview.productId);
        await lockReservationRow(tx, id);

        const reservation = await tx.inventoryReservation.findUnique({
          where: { id },
        });

        if (!reservation) {
          throw new ReservationNotFoundError();
        }

        if (reservation.status !== "ACTIVE") {
          throw new ReservationNotActiveError();
        }

        const inventory = await tx.inventory.findUnique({
          where: { productId: reservation.productId },
        });

        if (!inventory) {
          throw new InventoryNotFoundError();
        }

        // Puede lanzar CANTIDAD_RESERVADA_INSUFICIENTE si el inventario no
        // coincide con la reserva; no se oculta el problema con un clamp.
        const next = releaseInventory(inventory, reservation.quantity);

        await tx.inventory.update({
          where: { productId: reservation.productId },
          data: { quantityReserved: next.quantityReserved },
        });

        const released = await tx.inventoryReservation.update({
          where: { id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "INVENTORY_RESERVATION_RELEASE",
            entityType: "InventoryReservation",
            entityId: id,
            details: {
              productId: reservation.productId,
              quantity: reservation.quantity,
              releasedBy: auth.session.userId,
            },
          },
        });

        return released;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
        maxWait: 10000,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Reserva liberada correctamente",
      reservation: serializeReservation(updated),
    });
  } catch (error: unknown) {
    console.error("Error liberando reserva:", error);

    if (error instanceof ReservationNotFoundError) {
      return NextResponse.json(
        { error: "Reserva no encontrada", code: "RESERVA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    if (error instanceof ReservationNotActiveError) {
      return NextResponse.json(
        { error: "La reserva no está activa", code: "RESERVA_NO_ACTIVA" },
        { status: 400 }
      );
    }

    if (error instanceof InventoryNotFoundError) {
      return NextResponse.json(
        {
          error: "Inventario no encontrado para el producto de la reserva",
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

      if (error.code === "CANTIDAD_RESERVADA_INSUFICIENTE") {
        return NextResponse.json(
          {
            error:
              "La cantidad reservada en inventario no coincide con la reserva; se requiere revisión manual",
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
