import { describe, expect, it } from "vitest";

import {
  customerDisplayName,
  serializeCustomer,
  serializeOrder,
  serializeOrderItem,
  serializeOrderStatusHistory,
  serializeQuote,
  serializeQuoteItem,
  serializeQuoteStatusHistory,
} from "@/lib/commercial-serializers";

const baseDate = new Date("2026-11-11T12:00:00.000Z");

function customerFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    personType: "NATURAL" as const,
    documentType: "CC" as const,
    documentNumber: "12345678",
    razonSocial: null,
    primerNombre: "Ana",
    primerApellido: "Pérez",
    pais: "Colombia",
    ciudad: "Bogotá",
    departamento: "Cundinamarca",
    direccion: "Calle 1 # 2-3",
    telefono: "3001234567",
    email: "ana@gyr.test",
    isActive: true,
    deletedAt: null,
    userId: "22222222-2222-4222-8222-222222222222",
    createdById: "33333333-3333-4333-8333-333333333333",
    updatedById: "33333333-3333-4333-8333-333333333333",
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function quoteItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    productId: "55555555-5555-4555-8555-555555555555",
    priceId: "66666666-6666-4666-8666-666666666666",
    productName: "Cable THHN 12",
    productSku: "CAB-12",
    productSlug: "cable-thhn-12",
    currency: "COP",
    pricingSource: "CATALOG" as const,
    quantity: 2,
    unitPriceCents: BigInt(12345),
    subtotalCents: BigInt(24690),
    deletedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function quoteFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    quoteNumber: "COT-20261111-ABCDEF123456",
    status: "SENT" as const,
    subtotalCents: BigInt(24690),
    taxCents: BigInt(0),
    totalCents: BigInt(24690),
    validUntil: new Date("2026-11-20T12:00:00.000Z"),
    notes: "Entrega en obra",
    createdAt: baseDate,
    updatedAt: baseDate,
    customerId: "11111111-1111-4111-8111-111111111111",
    userId: "33333333-3333-4333-8333-333333333333",
    customer: customerFixture(),
    user: { id: "33333333-3333-4333-8333-333333333333", nombre: "Vendedor" },
    items: [quoteItemFixture()],
    ...overrides,
  };
}

function orderItemFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "88888888-8888-4888-8888-888888888888",
    productId: "55555555-5555-4555-8555-555555555555",
    priceId: "66666666-6666-4666-8666-666666666666",
    productName: "Cable THHN 12",
    productSku: "CAB-12",
    productSlug: "cable-thhn-12",
    currency: "COP",
    pricingSource: "CATALOG" as const,
    quantity: 2,
    unitPriceCents: BigInt(12345),
    subtotalCents: BigInt(24690),
    ...overrides,
  };
}

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    orderNumber: "PED-20261111-ABCDEF123456",
    status: "PENDING_PAYMENT" as const,
    subtotalCents: BigInt(24690),
    taxCents: BigInt(0),
    totalCents: BigInt(24690),
    notes: null,
    paymentMethod: null,
    paymentReference: null,
    paidAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    customerId: "11111111-1111-4111-8111-111111111111",
    userId: "33333333-3333-4333-8333-333333333333",
    quoteId: null,
    customer: customerFixture(),
    user: { id: "33333333-3333-4333-8333-333333333333", nombre: "Vendedor" },
    quote: null,
    items: [orderItemFixture()],
    ...overrides,
  };
}

describe("serialización de clientes", () => {
  it("muestra razón social o nombre completo", () => {
    expect(customerDisplayName(customerFixture())).toBe("Ana Pérez");
    expect(
      customerDisplayName(
        customerFixture({
          personType: "JURIDICA",
          razonSocial: "GYR Suministros S.A.S.",
        })
      )
    ).toBe("GYR Suministros S.A.S.");
    expect(
      customerDisplayName(
        customerFixture({
          primerNombre: null,
          primerApellido: null,
        })
      )
    ).toBe("Cliente sin nombre");
  });

  it("no expone campos de autenticación", () => {
    const serialized = serializeCustomer(customerFixture());
    expect(serialized).not.toHaveProperty("passwordHash");
    expect(serialized.displayName).toBe("Ana Pérez");
    expect(serialized.documentNumber).toBe("12345678");
  });
});

describe("serialización de cotizaciones", () => {
  it("devuelve importes como cadenas y calcula vencimiento", () => {
    const serialized = serializeQuote(quoteFixture());
    expect(serialized.subtotalCents).toBe("24690");
    expect(serialized.taxCents).toBe("0");
    expect(serialized.totalCents).toBe("24690");
    expect(serialized.status).toBe("SENT");
    expect(serialized.items).toHaveLength(1);
    expect(serialized.items?.[0].unitPriceCents).toBe("12345");
  });

  it("marca como vencida una cotización con fecha pasada", () => {
    const serialized = serializeQuote(
      quoteFixture({ validUntil: new Date("2020-01-01T00:00:00.000Z") })
    );
    expect(serialized.isExpired).toBe(true);
  });

  it("serializa líneas con snapshot y origen de precio", () => {
    const serialized = serializeQuoteItem(
      quoteItemFixture({
        priceId: null,
        pricingSource: "MANUAL",
        currency: "COP",
        unitPriceCents: BigInt(9999),
        subtotalCents: BigInt(19998),
      })
    );
    expect(serialized.priceId).toBeNull();
    expect(serialized.pricingSource).toBe("MANUAL");
    expect(serialized.unitPriceCents).toBe("9999");
  });

  it("serializa historial de estados", () => {
    const serialized = serializeQuoteStatusHistory({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fromStatus: "DRAFT",
      toStatus: "SENT",
      changedBy: "33333333-3333-4333-8333-333333333333",
      reason: "Envío",
      createdAt: baseDate,
    });
    expect(serialized.fromStatus).toBe("DRAFT");
    expect(serialized.toStatus).toBe("SENT");
  });
});

describe("serialización de pedidos", () => {
  it("devuelve importes y snapshots sin clave de idempotencia", () => {
    const serialized = serializeOrder(orderFixture());
    expect(serialized.subtotalCents).toBe("24690");
    expect(serialized.totalCents).toBe("24690");
    expect(serialized.status).toBe("PENDING_PAYMENT");
    expect(serialized).not.toHaveProperty("idempotencyKey");
    expect(serialized.items?.[0].productName).toBe("Cable THHN 12");
  });

  it("incluye la cotización de origen cuando existe", () => {
    const serialized = serializeOrder(
      orderFixture({
        quoteId: "77777777-7777-4777-8777-777777777777",
        quote: {
          id: "77777777-7777-4777-8777-777777777777",
          quoteNumber: "COT-20261111-ABCDEF123456",
        },
      })
    );
    expect(serialized.quoteId).toBe("77777777-7777-4777-8777-777777777777");
    expect(serialized.quote?.quoteNumber).toBe("COT-20261111-ABCDEF123456");
  });

  it("serializa líneas e historial de pedido", () => {
    const item = serializeOrderItem(orderItemFixture());
    expect(item.unitPriceCents).toBe("12345");
    expect(item.pricingSource).toBe("CATALOG");

    const history = serializeOrderStatusHistory({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fromStatus: null,
      toStatus: "PENDING_PAYMENT",
      changedBy: "33333333-3333-4333-8333-333333333333",
      reason: null,
      createdAt: baseDate,
    });
    expect(history.fromStatus).toBeNull();
    expect(history.toStatus).toBe("PENDING_PAYMENT");
  });
});
