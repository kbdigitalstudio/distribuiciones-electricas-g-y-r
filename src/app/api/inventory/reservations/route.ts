"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { CreateInventoryReservationSchema } from "@/lib/validations";
import { canAccessInventory } from "@/lib/roles";
import { InventoryRuleError, reserveInventory } from "@/lib/inventory-rules";
import { lockInventoryRow } from "@/lib/inventory-locks";
import {
  serializeReservation,
  type ReservationRecord,
} from "@/lib/inventory-serializers";

interface ReservationRequestData {
  productId: string;
  quantity: number;
  reference?: string | null;
  expiresAt?: string | null;
}

class InventoryNotFoundError extends Error {
  constructor() {
    super("INVENTARIO_NO_ENCONTRADO");
    this.name = "InventoryNotFoundError";
  }
}

class IdempotencyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_REUSED");
    this.name = "IdempotencyConflictError";
  }
}

function expiresAtMs(value: string | null | undefined): number | null {
  return value ? new Date(value).getTime() : null;
}

/**
 * Un reintento con la misma clave solo es válido si el payload es equivalente.
 * Si la clave se reutiliza con otros datos, se responde 409 para no devolver
 * silenciosamente una reserva que no corresponde a la solicitud.
 */
function payloadMatches(
  existing: ReservationRecord,
  input: ReservationRequestData
): boolean {
  return (
    existing.productId === input.productId &&
    existing.quantity === input.quantity &&
    (existing.reference ?? null) === (input.reference ?? null) &&
    (existing.expiresAt ? existing.expiresAt.getTime() : null) ===
      expiresAtMs(input.expiresAt)
  );
}

function replayResponse(
  existing: ReservationRecord,
  input: ReservationRequestData
): NextResponse {
  if (!payloadMatches(existing, input)) {
    return NextResponse.json(
      {
        error:
          "La clave de idempotencia ya fue utilizada con datos distintos a los de esta solicitud",
        code: "IDEMPOTENCY_KEY_REUSED",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      reservation: serializeReservation(existing),
      replayed: true,
    },
    { status: 200 }
  );
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

// POST /api/inventory/reservations — Crear reserva (INVENTARIO/ADMIN)
//
// Idempotencia:
// - Requiere `Idempotency-Key` (header) o `idempotencyKey` (body).
// - La clave tiene restricción UNIQUE en PostgreSQL.
// - Reintentos con el mismo payload devuelven la misma reserva (200).
// - La misma clave con otro payload devuelve 409.
//
// Concurrencia:
// - SELECT ... FOR UPDATE sobre Inventory antes de leer/escribir existencias.
// - La verificación de idempotencia se repite dentro de la transacción, después
//   del bloqueo, para cubrir solicitudes simultáneas.
// - Si dos transacciones compiten por la misma clave en productos distintos, la
//   restricción UNIQUE decide y la perdedora devuelve la reserva ganadora.
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

  let input: ReservationRequestData | null = null;
  let idempotencyKey: string | null = null;

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

    const { productId, quantity, reference, expiresAt } = parsed.data;
    input = { productId, quantity, reference, expiresAt };

    const headerKey =
      request.headers.get("idempotency-key")?.trim() || null;
    const bodyKey = parsed.data.idempotencyKey?.trim() || null;

    if (headerKey && bodyKey && headerKey !== bodyKey) {
      return NextResponse.json(
        {
          error:
            "El header Idempotency-Key y el campo idempotencyKey no coinciden",
          code: "IDEMPOTENCY_KEY_MISMATCH",
        },
        { status: 400 }
      );
    }

    idempotencyKey = headerKey ?? bodyKey;

    if (!idempotencyKey) {
      return NextResponse.json(
        {
          error:
            "Se requiere una clave de idempotencia por operación (header Idempotency-Key o campo idempotencyKey)",
          code: "IDEMPOTENCY_KEY_REQUIRED",
        },
        { status: 400 }
      );
    }

    // Constantes locales: el estrechamiento de tipos no se conserva dentro del
    // callback de la transacción si se usan variables `let` mutables.
    const key: string = idempotencyKey;
    const reservationInput: ReservationRequestData = input;

    // Camino rápido: si la operación ya se completó, devolver la misma reserva.
    const existing = await db.inventoryReservation.findUnique({
      where: { idempotencyKey: key },
    });

    if (existing) {
      return replayResponse(existing, reservationInput);
    }

    const result = await db.$transaction(
      async (tx) => {
        // ORDEN DE BLOQUEO: Inventory primero.
        await lockInventoryRow(tx, productId);

        // Revalidar idempotencia después del bloqueo: cubre dos solicitudes
        // simultáneas con la misma clave y el mismo producto.
        const existingInTx = await tx.inventoryReservation.findUnique({
          where: { idempotencyKey: key },
        });

        if (existingInTx) {
          if (!payloadMatches(existingInTx, reservationInput)) {
            throw new IdempotencyConflictError();
          }
          return { reservation: existingInTx, replayed: true };
        }

        const inventory = await tx.inventory.findUnique({
          where: { productId },
        });

        if (!inventory) {
          throw new InventoryNotFoundError();
        }

        const next = reserveInventory(inventory, quantity);

        const reservation = await tx.inventoryReservation.create({
          data: {
            productId,
            quantity,
            status: "ACTIVE",
            reference: reference ?? null,
            idempotencyKey: key,
            createdBy: auth.session.userId,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
          },
        });

        await tx.inventory.update({
          where: { productId },
          data: { quantityReserved: next.quantityReserved },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "INVENTORY_RESERVATION_CREATE",
            entityType: "InventoryReservation",
            entityId: reservation.id,
            details: {
              productId,
              quantity,
              reference: reference ?? null,
              idempotencyKey: key,
              reservedBy: auth.session.userId,
            },
          },
        });

        return { reservation, replayed: false };
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
        reservation: serializeReservation(result.reservation),
        replayed: result.replayed,
      },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error: unknown) {
    console.error("Error creando reserva de inventario:", error);

    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        {
          error:
            "La clave de idempotencia ya fue utilizada con datos distintos a los de esta solicitud",
          code: "IDEMPOTENCY_KEY_REUSED",
        },
        { status: 409 }
      );
    }

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
      if (error.code === "STOCK_INSUFICIENTE") {
        return NextResponse.json(
          {
            error: "Stock disponible insuficiente para la reserva",
            code: "STOCK_INSUFICIENTE",
          },
          { status: 400 }
        );
      }

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

    // Violación UNIQUE de idempotencyKey: otra transacción ganó la carrera.
    // Se devuelve la reserva ganadora si el payload coincide.
    if (isPrismaError(error, "P2002") && idempotencyKey && input) {
      const existing = await db.inventoryReservation.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        return replayResponse(existing, input);
      }

      return NextResponse.json(
        {
          error:
            "Ya existe una reserva con esta clave de idempotencia; reintente para obtenerla",
          code: "IDEMPOTENCY_KEY_DUPLICATE",
        },
        { status: 409 }
      );
    }

    if (isPrismaError(error, "P2028")) {
      return NextResponse.json(
        {
          error:
            "La operación de inventario excedió el tiempo de espera por concurrencia; reintente con la misma clave de idempotencia",
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
