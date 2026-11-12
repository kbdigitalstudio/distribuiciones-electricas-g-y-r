import { describe, expect, it } from "vitest";
import {
  CreateInventoryReservationSchema,
  RecordInventoryMovementSchema,
} from "@/lib/validations";

const productId = "11111111-1111-4111-8111-111111111111";

describe("CreateInventoryReservationSchema", () => {
  it("acepta una reserva válida con clave de idempotencia", () => {
    const parsed = CreateInventoryReservationSchema.safeParse({
      productId,
      quantity: 2,
      reference: "cotizacion-1",
      idempotencyKey: "reservation-key-0001",
    });

    expect(parsed.success).toBe(true);
  });

  it("rechaza productId que no es UUID", () => {
    const parsed = CreateInventoryReservationSchema.safeParse({
      productId: "no-es-uuid",
      quantity: 1,
      idempotencyKey: "reservation-key-0001",
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza cantidades cero, negativas o fraccionarias", () => {
    for (const quantity of [0, -1, 1.5]) {
      const parsed = CreateInventoryReservationSchema.safeParse({
        productId,
        quantity,
        idempotencyKey: "reservation-key-0001",
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("rechaza una clave de idempotencia vacía", () => {
    const parsed = CreateInventoryReservationSchema.safeParse({
      productId,
      quantity: 1,
      idempotencyKey: "   ",
    });

    expect(parsed.success).toBe(false);
  });

  it("rechaza una clave de idempotencia mayor a 255 caracteres", () => {
    const parsed = CreateInventoryReservationSchema.safeParse({
      productId,
      quantity: 1,
      idempotencyKey: "x".repeat(256),
    });

    expect(parsed.success).toBe(false);
  });
});

describe("RecordInventoryMovementSchema", () => {
  it("acepta los cinco tipos de movimiento", () => {
    for (const movementType of [
      "ENTRY",
      "EXIT",
      "ADJUSTMENT",
      "RESERVATION",
      "RELEASE",
    ]) {
      const parsed = RecordInventoryMovementSchema.safeParse({
        productId,
        movementType,
        quantity: 1,
        reason: "prueba",
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rechaza un tipo de movimiento desconocido", () => {
    const parsed = RecordInventoryMovementSchema.safeParse({
      productId,
      movementType: "UNKNOWN",
      quantity: 1,
      reason: "prueba",
    });

    expect(parsed.success).toBe(false);
  });
});
