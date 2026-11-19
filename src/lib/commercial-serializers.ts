import type {
  Customer,
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  PricingSource,
  Quote,
  QuoteItem,
  QuoteStatus,
  QuoteStatusHistory,
} from "@prisma/client";

import { isQuoteExpired, serializeMoney } from "@/lib/commercial";

/**
 * Serializadores de la API comercial.
 *
 * Los importes se devuelven como cadenas decimales de centavos para conservar
 * exactitud y evitar el error de serialización de BigInt en JSON.
 */

type CustomerLike = Pick<
  Customer,
  | "id"
  | "personType"
  | "documentType"
  | "documentNumber"
  | "razonSocial"
  | "primerNombre"
  | "primerApellido"
  | "pais"
  | "ciudad"
  | "departamento"
  | "direccion"
  | "telefono"
  | "email"
  | "isActive"
  | "deletedAt"
  | "createdAt"
  | "updatedAt"
  | "userId"
  | "createdById"
  | "updatedById"
>;

export function customerDisplayName(
  customer: Pick<
    Customer,
    "personType" | "razonSocial" | "primerNombre" | "primerApellido"
  >
): string {
  if (customer.personType === "JURIDICA") {
    return customer.razonSocial?.trim() || "Cliente sin razón social";
  }

  const name = [customer.primerNombre, customer.primerApellido]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Cliente sin nombre";
}

export function serializeCustomer(customer: CustomerLike) {
  return {
    id: customer.id,
    personType: customer.personType,
    documentType: customer.documentType,
    documentNumber: customer.documentNumber,
    razonSocial: customer.razonSocial,
    primerNombre: customer.primerNombre,
    primerApellido: customer.primerApellido,
    displayName: customerDisplayName(customer),
    pais: customer.pais,
    ciudad: customer.ciudad,
    departamento: customer.departamento,
    direccion: customer.direccion,
    telefono: customer.telefono,
    email: customer.email,
    isActive: customer.isActive,
    deletedAt: customer.deletedAt,
    userId: customer.userId,
    createdById: customer.createdById,
    updatedById: customer.updatedById,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function serializeCustomerSummary(
  customer: Pick<
    Customer,
    "id" | "personType" | "razonSocial" | "primerNombre" | "primerApellido"
  >
) {
  return {
    id: customer.id,
    displayName: customerDisplayName(customer),
  };
}

type QuoteItemLike = Pick<
  QuoteItem,
  | "id"
  | "productId"
  | "priceId"
  | "productName"
  | "productSku"
  | "productSlug"
  | "currency"
  | "pricingSource"
  | "quantity"
  | "unitPriceCents"
  | "subtotalCents"
  | "deletedAt"
  | "createdAt"
  | "updatedAt"
>;

export function serializeQuoteItem(item: QuoteItemLike) {
  return {
    id: item.id,
    productId: item.productId,
    priceId: item.priceId,
    productName: item.productName,
    productSku: item.productSku,
    productSlug: item.productSlug,
    currency: item.currency,
    pricingSource: item.pricingSource as PricingSource,
    quantity: item.quantity,
    unitPriceCents: serializeMoney(item.unitPriceCents),
    subtotalCents: serializeMoney(item.subtotalCents),
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

interface QuoteLike
  extends Pick<
    Quote,
    | "id"
    | "quoteNumber"
    | "status"
    | "subtotalCents"
    | "taxCents"
    | "totalCents"
    | "validUntil"
    | "notes"
    | "createdAt"
    | "updatedAt"
    | "customerId"
    | "userId"
  > {
  customer: Pick<
    Customer,
    "id" | "personType" | "razonSocial" | "primerNombre" | "primerApellido"
  >;
  user: { id: string; nombre: string };
  items?: QuoteItemLike[];
}

export function serializeQuote(quote: QuoteLike) {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status as QuoteStatus,
    customerId: quote.customerId,
    customer: serializeCustomerSummary(quote.customer),
    userId: quote.userId,
    responsable: { id: quote.user.id, nombre: quote.user.nombre },
    subtotalCents: serializeMoney(quote.subtotalCents),
    taxCents: serializeMoney(quote.taxCents),
    totalCents: serializeMoney(quote.totalCents),
    validUntil: quote.validUntil,
    isExpired: isQuoteExpired(quote.validUntil),
    notes: quote.notes,
    items: quote.items?.map(serializeQuoteItem),
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

type OrderItemLike = Pick<
  OrderItem,
  | "id"
  | "productId"
  | "priceId"
  | "productName"
  | "productSku"
  | "productSlug"
  | "currency"
  | "pricingSource"
  | "quantity"
  | "unitPriceCents"
  | "subtotalCents"
>;

export function serializeOrderItem(item: OrderItemLike) {
  return {
    id: item.id,
    productId: item.productId,
    priceId: item.priceId,
    productName: item.productName,
    productSku: item.productSku,
    productSlug: item.productSlug,
    currency: item.currency,
    pricingSource: item.pricingSource as PricingSource,
    quantity: item.quantity,
    unitPriceCents: serializeMoney(item.unitPriceCents),
    subtotalCents: serializeMoney(item.subtotalCents),
  };
}

interface OrderLike
  extends Pick<
    Order,
    | "id"
    | "orderNumber"
    | "status"
    | "subtotalCents"
    | "taxCents"
    | "totalCents"
    | "notes"
    | "paymentMethod"
    | "paymentReference"
    | "paidAt"
    | "createdAt"
    | "updatedAt"
    | "customerId"
    | "userId"
    | "quoteId"
  > {
  customer: Pick<
    Customer,
    "id" | "personType" | "razonSocial" | "primerNombre" | "primerApellido"
  >;
  user: { id: string; nombre: string };
  quote?: { id: string; quoteNumber: string } | null;
  items?: OrderItemLike[];
}

export function serializeOrder(order: OrderLike) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as OrderStatus,
    customerId: order.customerId,
    customer: serializeCustomerSummary(order.customer),
    userId: order.userId,
    responsable: { id: order.user.id, nombre: order.user.nombre },
    quoteId: order.quoteId,
    quote: order.quote ?? null,
    subtotalCents: serializeMoney(order.subtotalCents),
    taxCents: serializeMoney(order.taxCents),
    totalCents: serializeMoney(order.totalCents),
    notes: order.notes,
    // Los campos de pago solo se exponen como referencia histórica. La API no
    // permite establecerlos ni declarar PAID sin integración autorizada.
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paidAt: order.paidAt,
    items: order.items?.map(serializeOrderItem),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializeQuoteStatusHistory(
  history: Pick<
    QuoteStatusHistory,
    "id" | "fromStatus" | "toStatus" | "changedBy" | "reason" | "createdAt"
  >
) {
  return {
    id: history.id,
    fromStatus: history.fromStatus as QuoteStatus | null,
    toStatus: history.toStatus as QuoteStatus,
    changedBy: history.changedBy,
    reason: history.reason,
    createdAt: history.createdAt,
  };
}

export function serializeOrderStatusHistory(
  history: Pick<
    OrderStatusHistory,
    "id" | "fromStatus" | "toStatus" | "changedBy" | "reason" | "createdAt"
  >
) {
  return {
    id: history.id,
    fromStatus: history.fromStatus as OrderStatus | null,
    toStatus: history.toStatus as OrderStatus,
    changedBy: history.changedBy,
    reason: history.reason,
    createdAt: history.createdAt,
  };
}
