import type { Prisma } from "@prisma/client";

/**
 * Bloqueos de fila PostgreSQL.
 *
 * ORDEN GLOBAL DE BLOQUEO (obligatorio para evitar interbloqueos):
 *   1. Inventory (por productId)
 *   2. InventoryReservation (por id)
 *
 * Ninguna operación debe bloquear una reserva antes que el inventario del que
 * depende. Si en el futuro se agrega una operación que toque ambas tablas,
 * debe respetar este mismo orden.
 */

export async function lockInventoryRow(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<void> {
  // El cast explícito ::uuid evita ambigüedad de tipos en el parámetro.
  await tx.$queryRaw`
    SELECT "id"
    FROM "Inventory"
    WHERE "productId" = ${productId}::uuid
    FOR UPDATE
  `;
}

export async function lockReservationRow(
  tx: Prisma.TransactionClient,
  reservationId: string
): Promise<void> {
  await tx.$queryRaw`
    SELECT "id"
    FROM "InventoryReservation"
    WHERE "id" = ${reservationId}::uuid
    FOR UPDATE
  `;
}
