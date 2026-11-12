import { randomBytes } from "node:crypto";
import type { OrderStatus, QuoteStatus } from "@prisma/client";

/**
 * Reglas comerciales compartidas de la Etapa 4.
 *
 * Este módulo no accede a la base de datos: contiene transiciones, cálculo
 * monetario, normalización y utilidades de serialización para que las rutas y
 * las pruebas usen exactamente las mismas reglas.
 */

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "FULFILLED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: [],
  EXPIRED: [],
  CANCELLED: [],
};

/**
 * Transiciones permitidas del pedido.
 *
 * PAID y REFUNDED no se alcanzan por API: requieren una integración de pagos
 * real y autorizada que no forma parte de esta etapa. La ruta de estado los
 * rechaza explícitamente con PAGO_NO_AUTORIZADO.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["FULFILLED", "REFUNDED"],
  FULFILLED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export const MAX_ITEM_QUANTITY = 1_000_000;
export const MAX_MONEY_CENTS = BigInt("1000000000000000");
export const MAX_TOTAL_CENTS = BigInt("1000000000000000000");

export class CommercialError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "CommercialError";
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isQuoteExpired(
  validUntil: Date,
  now: Date = new Date()
): boolean {
  return validUntil.getTime() < now.getTime();
}

export function isQuoteTerminal(status: QuoteStatus): boolean {
  return status === "ACCEPTED" || status === "EXPIRED" || status === "CANCELLED";
}

export function assertQuoteTransition(
  from: QuoteStatus,
  to: QuoteStatus
): void {
  if (from === to) {
    throw new CommercialError(
      "SIN_CAMBIO_DE_ESTADO",
      "La cotización ya se encuentra en el estado solicitado",
      409
    );
  }

  if (!QUOTE_TRANSITIONS[from].includes(to)) {
    throw new CommercialError(
      "TRANSICION_INVALIDA",
      `Transición de cotización no permitida: ${from} → ${to}`,
      409
    );
  }
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus
): void {
  if (to === "PAID" || to === "REFUNDED") {
    throw new CommercialError(
      "PAGO_NO_AUTORIZADO",
      "No existe una integración de pagos autorizada para declarar este estado",
      409
    );
  }

  if (from === to) {
    throw new CommercialError(
      "SIN_CAMBIO_DE_ESTADO",
      "El pedido ya se encuentra en el estado solicitado",
      409
    );
  }

  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new CommercialError(
      "TRANSICION_INVALIDA",
      `Transición de pedido no permitida: ${from} → ${to}`,
      409
    );
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Normaliza formato telefónico sin inventar código de país. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normaliza la identificación para comparar duplicados:
 * mayúsculas, sin espacios ni puntos. Conserva guiones y letras.
 */
export function normalizeDocumentNumber(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.]/g, "");
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Número comercial no secuencial:
 *   COT-AAAAMMDD-<12 hex aleatorios>
 *   PED-AAAAMMDD-<12 hex aleatorios>
 *
 * La aleatoriedad criptográfica evita predecir el siguiente número. La
 * restricción UNIQUE de la base de datos protege ante una colisión improbable.
 */
export function generateCommercialNumber(
  prefix: "COT" | "PED",
  now: Date = new Date()
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const random = randomBytes(6).toString("hex").toUpperCase();
  return `${prefix}-${year}${month}${day}-${random}`;
}

export function calculateLineSubtotal(
  unitPriceCents: bigint,
  quantity: number
): bigint {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new CommercialError(
      "CANTIDAD_INVALIDA",
      "La cantidad debe ser un entero positivo"
    );
  }

  if (unitPriceCents < BigInt(0)) {
    throw new CommercialError(
      "PRECIO_INVALIDO",
      "El precio unitario no puede ser negativo"
    );
  }

  if (unitPriceCents > MAX_MONEY_CENTS) {
    throw new CommercialError(
      "IMPORTE_FUERA_DE_RANGO",
      "El precio unitario excede el rango permitido"
    );
  }

  return unitPriceCents * BigInt(quantity);
}

export interface CommercialTotals {
  subtotalCents: bigint;
  taxCents: bigint;
  totalCents: bigint;
}

/**
 * Suma líneas y aplica la política vigente: sin impuestos configurados,
 * taxCents = 0 y total = subtotal. No se aceptan impuestos del cliente.
 */
export function calculateTotals(
  lines: Array<{ unitPriceCents: bigint; quantity: number }>
): CommercialTotals {
  let subtotalCents = BigInt(0);

  for (const line of lines) {
    subtotalCents += calculateLineSubtotal(
      line.unitPriceCents,
      line.quantity
    );
  }

  if (subtotalCents > MAX_TOTAL_CENTS) {
    throw new CommercialError(
      "IMPORTE_FUERA_DE_RANGO",
      "El total de la operación excede el rango permitido"
    );
  }

  return {
    subtotalCents,
    taxCents: BigInt(0),
    totalCents: subtotalCents,
  };
}

export function serializeMoney(
  value: bigint | null | undefined
): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

export function serializeRequiredMoney(value: bigint): string {
  return value.toString();
}

/**
 * Convierte recursivamente BigInt a string para poder guardarlo en JSON
 * (OperationLog.details) sin perder precisión.
 */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        jsonSafe(item),
      ])
    );
  }
  return value;
}

export function buildPagination(
  page: number,
  pageSize: number,
  total: number
) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function resolveIdempotencyKey(
  request: Request,
  bodyKey?: string | null
): string {
  const headerKey = request.headers.get("idempotency-key")?.trim() || null;
  const normalizedBodyKey = bodyKey?.trim() || null;

  if (headerKey && normalizedBodyKey && headerKey !== normalizedBodyKey) {
    throw new CommercialError(
      "IDEMPOTENCY_KEY_MISMATCH",
      "El header Idempotency-Key y el campo idempotencyKey no coinciden"
    );
  }

  const key = headerKey ?? normalizedBodyKey;

  if (!key) {
    throw new CommercialError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Se requiere una clave de idempotencia por operación (header Idempotency-Key o campo idempotencyKey)"
    );
  }

  if (key.length > 255) {
    throw new CommercialError(
      "IDEMPOTENCY_KEY_INVALIDA",
      "La clave de idempotencia no puede superar 255 caracteres"
    );
  }

  return key;
}

export function isPrismaUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
