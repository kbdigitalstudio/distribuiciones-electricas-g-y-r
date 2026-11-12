import { describe, expect, it } from "vitest";

import {
  CommercialError,
  MAX_MONEY_CENTS,
  MAX_TOTAL_CENTS,
  ORDER_TRANSITIONS,
  QUOTE_TRANSITIONS,
  assertOrderTransition,
  assertQuoteTransition,
  buildPagination,
  calculateLineSubtotal,
  calculateTotals,
  generateCommercialNumber,
  isPrismaError,
  isPrismaUniqueError,
  isQuoteExpired,
  isQuoteTerminal,
  isUuid,
  jsonSafe,
  normalizeDocumentNumber,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  resolveIdempotencyKey,
  serializeMoney,
  serializeRequiredMoney,
} from "@/lib/commercial";

function expectCommercialError(
  fn: () => unknown,
  code: string,
  status?: number
): void {
  try {
    fn();
    throw new Error(`Se esperaba CommercialError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(CommercialError);
    const commercialError = error as CommercialError;
    expect(commercialError.code).toBe(code);
    if (status !== undefined) {
      expect(commercialError.status).toBe(status);
    }
  }
}

describe("transiciones de cotización", () => {
  it("permite únicamente las transiciones aprobadas", () => {
    expect(() => assertQuoteTransition("DRAFT", "SENT")).not.toThrow();
    expect(() => assertQuoteTransition("DRAFT", "CANCELLED")).not.toThrow();
    expect(() => assertQuoteTransition("SENT", "ACCEPTED")).not.toThrow();
    expect(() => assertQuoteTransition("SENT", "EXPIRED")).not.toThrow();
    expect(() => assertQuoteTransition("SENT", "CANCELLED")).not.toThrow();

    expectCommercialError(
      () => assertQuoteTransition("DRAFT", "ACCEPTED"),
      "TRANSICION_INVALIDA",
      409
    );
    expectCommercialError(
      () => assertQuoteTransition("ACCEPTED", "SENT"),
      "TRANSICION_INVALIDA",
      409
    );
    expectCommercialError(
      () => assertQuoteTransition("CANCELLED", "SENT"),
      "TRANSICION_INVALIDA",
      409
    );
    expectCommercialError(
      () => assertQuoteTransition("DRAFT", "DRAFT"),
      "SIN_CAMBIO_DE_ESTADO",
      409
    );
  });

  it("declara terminales los estados aprobados", () => {
    expect(isQuoteTerminal("ACCEPTED")).toBe(true);
    expect(isQuoteTerminal("EXPIRED")).toBe(true);
    expect(isQuoteTerminal("CANCELLED")).toBe(true);
    expect(isQuoteTerminal("DRAFT")).toBe(false);
    expect(isQuoteTerminal("SENT")).toBe(false);

    expect(QUOTE_TRANSITIONS.ACCEPTED).toEqual([]);
    expect(QUOTE_TRANSITIONS.EXPIRED).toEqual([]);
    expect(QUOTE_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("detecta vencimiento por fecha", () => {
    const now = new Date("2026-11-11T12:00:00.000Z");
    expect(isQuoteExpired(new Date("2026-11-11T11:59:59.000Z"), now)).toBe(true);
    expect(isQuoteExpired(new Date("2026-11-11T12:00:00.000Z"), now)).toBe(false);
    expect(isQuoteExpired(new Date("2026-11-11T12:00:01.000Z"), now)).toBe(false);
  });
});

describe("transiciones de pedido", () => {
  it("solo permite cancelar desde pendiente de pago", () => {
    expect(() => assertOrderTransition("PENDING_PAYMENT", "CANCELLED")).not.toThrow();
    expectCommercialError(
      () => assertOrderTransition("PENDING_PAYMENT", "FULFILLED"),
      "TRANSICION_INVALIDA",
      409
    );
    expectCommercialError(
      () => assertOrderTransition("CANCELLED", "PENDING_PAYMENT"),
      "TRANSICION_INVALIDA",
      409
    );
    expectCommercialError(
      () => assertOrderTransition("CANCELLED", "CANCELLED"),
      "SIN_CAMBIO_DE_ESTADO",
      409
    );
  });

  it("bloquea PAID y REFUNDED sin integración de pagos autorizada", () => {
    expectCommercialError(
      () => assertOrderTransition("PENDING_PAYMENT", "PAID"),
      "PAGO_NO_AUTORIZADO",
      409
    );
    expectCommercialError(
      () => assertOrderTransition("PAID", "REFUNDED"),
      "PAGO_NO_AUTORIZADO",
      409
    );
    expectCommercialError(
      () => assertOrderTransition("PENDING_PAYMENT", "REFUNDED"),
      "PAGO_NO_AUTORIZADO",
      409
    );

    expect(ORDER_TRANSITIONS.PAID).toEqual(["FULFILLED", "REFUNDED"]);
    expect(ORDER_TRANSITIONS.FULFILLED).toEqual(["REFUNDED"]);
    expect(ORDER_TRANSITIONS.REFUNDED).toEqual([]);
  });
});

describe("normalización", () => {
  it("normaliza email, teléfono, documento y texto", () => {
    expect(normalizeEmail("  VENTAS@GYR.COM.CO ")).toBe("ventas@gyr.com.co");
    expect(normalizePhone("+57 300 123 4567")).toBe("+573001234567");
    expect(normalizePhone("300-123-4567")).toBe("3001234567");
    expect(normalizeDocumentNumber(" 12.345.678 ")).toBe("12345678");
    expect(normalizeDocumentNumber(" ab-123 ")).toBe("AB-123");
    expect(normalizeText("  Calle   1   # 2-3 ")).toBe("Calle 1 # 2-3");
  });
});

describe("cálculo monetario en centavos", () => {
  it("calcula subtotal de línea sin punto flotante", () => {
    expect(calculateLineSubtotal(BigInt(12345), 2)).toBe(BigInt(24690));
    expect(calculateLineSubtotal(BigInt(0), 1)).toBe(BigInt(0));
  });

  it("rechaza cantidades y precios inválidos", () => {
    expectCommercialError(
      () => calculateLineSubtotal(BigInt(100), 0),
      "CANTIDAD_INVALIDA"
    );
    expectCommercialError(
      () => calculateLineSubtotal(BigInt(100), -1),
      "CANTIDAD_INVALIDA"
    );
    expectCommercialError(
      () => calculateLineSubtotal(BigInt(100), 1.5),
      "CANTIDAD_INVALIDA"
    );
    expectCommercialError(
      () => calculateLineSubtotal(BigInt(-1), 1),
      "PRECIO_INVALIDO"
    );
    expectCommercialError(
      () => calculateLineSubtotal(MAX_MONEY_CENTS + BigInt(1), 1),
      "IMPORTE_FUERA_DE_RANGO"
    );
  });

  it("suma totales con impuesto cero por política no definida", () => {
    const totals = calculateTotals([
      { unitPriceCents: BigInt(12345), quantity: 2 },
      { unitPriceCents: BigInt(5000), quantity: 3 },
    ]);

    expect(totals.subtotalCents).toBe(BigInt(39690));
    expect(totals.taxCents).toBe(BigInt(0));
    expect(totals.totalCents).toBe(BigInt(39690));
  });

  it("rechaza totales fuera del rango permitido", () => {
    expectCommercialError(
      () =>
        calculateTotals([
          { unitPriceCents: MAX_MONEY_CENTS, quantity: 1_000_000 },
          { unitPriceCents: MAX_MONEY_CENTS, quantity: 1_000_000 },
        ]),
      "IMPORTE_FUERA_DE_RANGO"
    );

    expect(MAX_TOTAL_CENTS).toBeGreaterThan(MAX_MONEY_CENTS);
  });

  it("serializa dinero como cadena decimal", () => {
    expect(serializeMoney(BigInt("9007199254740993"))).toBe(
      "9007199254740993"
    );
    expect(serializeMoney(null)).toBeNull();
    expect(serializeMoney(undefined)).toBeNull();
    expect(serializeRequiredMoney(BigInt(0))).toBe("0");
  });

  it("convierte BigInt anidado a JSON seguro", () => {
    expect(
      jsonSafe({
        total: BigInt(123),
        lines: [{ unit: BigInt(45) }, null],
        text: "ok",
      })
    ).toEqual({
      total: "123",
      lines: [{ unit: "45" }, null],
      text: "ok",
    });
  });
});

describe("números comerciales", () => {
  it("genera números no secuenciales con formato verificable", () => {
    const now = new Date("2026-11-11T00:00:00.000Z");
    const quoteNumber = generateCommercialNumber("COT", now);
    const orderNumber = generateCommercialNumber("PED", now);

    expect(quoteNumber).toMatch(/^COT-20261111-[0-9A-F]{12}$/);
    expect(orderNumber).toMatch(/^PED-20261111-[0-9A-F]{12}$/);

    const generated = new Set(
      Array.from({ length: 20 }, () => generateCommercialNumber("COT", now))
    );
    expect(generated.size).toBe(20);
  });

  it("valida UUID sin aceptar valores arbitrarios", () => {
    expect(isUuid("493b3486-28cb-454f-81cd-ae4b2619e7a4")).toBe(true);
    expect(isUuid("no-es-uuid")).toBe(false);
    expect(isUuid("493b3486-28cb-454f-81cd-ae4b2619e7a")).toBe(false);
  });
});

describe("paginación", () => {
  it("calcula total de páginas", () => {
    expect(buildPagination(1, 20, 0)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
    expect(buildPagination(2, 20, 41)).toEqual({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });
});

describe("idempotencia", () => {
  function requestWithKey(key?: string): Request {
    return new Request("http://localhost/api/orders", {
      method: "POST",
      headers: key ? { "idempotency-key": key } : {},
    });
  }

  it("exige clave y acepta header o cuerpo", () => {
    expectCommercialError(
      () => resolveIdempotencyKey(requestWithKey()),
      "IDEMPOTENCY_KEY_REQUIRED"
    );
    expect(resolveIdempotencyKey(requestWithKey("abc"))).toBe("abc");
    expect(resolveIdempotencyKey(requestWithKey(), "body-key")).toBe("body-key");
  });

  it("rechaza header y cuerpo distintos", () => {
    expectCommercialError(
      () => resolveIdempotencyKey(requestWithKey("header-key"), "body-key"),
      "IDEMPOTENCY_KEY_MISMATCH"
    );
  });

  it("rechaza claves demasiado largas", () => {
    expectCommercialError(
      () => resolveIdempotencyKey(requestWithKey("x".repeat(256))),
      "IDEMPOTENCY_KEY_INVALIDA"
    );
  });
});

describe("errores Prisma", () => {
  it("reconoce unicidad y códigos", () => {
    expect(isPrismaUniqueError({ code: "P2002" })).toBe(true);
    expect(isPrismaUniqueError({ code: "P2025" })).toBe(false);
    expect(isPrismaError({ code: "P2025" }, "P2025")).toBe(true);
    expect(isPrismaError(null, "P2025")).toBe(false);
  });
});
