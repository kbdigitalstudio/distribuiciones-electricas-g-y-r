import type { Prisma } from "@prisma/client";

/**
 * Bloqueos de fila para operaciones comerciales concurrentes.
 *
 * Deben usarse únicamente dentro de una transacción interactiva de Prisma.
 * El bloqueo se libera automáticamente al confirmar o revertir la transacción.
 *
 * - Customer: FOR SHARE impide que una desactivación concurrente se confirme
 *   mientras se crea una cotización o un pedido para ese cliente.
 * - Quote/Order: FOR UPDATE serializa cambios de estado, edición de líneas y
 *   conversión para evitar dobles transiciones o conversiones duplicadas.
 */

export async function lockCustomerRow(
  tx: Prisma.TransactionClient,
  customerId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = CAST(${customerId} AS uuid) FOR SHARE`;
}

export async function lockQuoteRow(
  tx: Prisma.TransactionClient,
  quoteId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = CAST(${quoteId} AS uuid) FOR UPDATE`;
}

export async function lockOrderRow(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = CAST(${orderId} AS uuid) FOR UPDATE`;
}
