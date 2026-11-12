/**
 * Serialización compartida de reservas de inventario.
 * Mantiene una respuesta consistente entre la creación y la liberación.
 */

export interface ReservationRecord {
  id: string;
  productId: string;
  quantity: number;
  status: string;
  reservedAt: Date;
  releasedAt: Date | null;
  reference: string | null;
  idempotencyKey: string;
  createdBy: string;
  expiresAt: Date | null;
}

export function serializeReservation(reservation: ReservationRecord) {
  return {
    id: reservation.id,
    productId: reservation.productId,
    quantity: reservation.quantity,
    status: reservation.status,
    reservedAt: reservation.reservedAt,
    releasedAt: reservation.releasedAt,
    reference: reservation.reference,
    idempotencyKey: reservation.idempotencyKey,
    expiresAt: reservation.expiresAt,
  };
}
