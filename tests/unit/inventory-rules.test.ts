import { describe, expect, it } from "vitest";
import {
  applyInventoryMovement,
  availableQuantity,
  InventoryRuleError,
  releaseInventory,
  reserveInventory,
  type InventoryRuleErrorCode,
} from "@/lib/inventory-rules";

function expectRuleError(
  action: () => unknown,
  expectedCode: InventoryRuleErrorCode
): void {
  let caught: unknown;

  try {
    action();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(InventoryRuleError);
  expect((caught as InventoryRuleError).code).toBe(expectedCode);
}

describe("availableQuantity", () => {
  it("calcula onHand - reserved", () => {
    expect(availableQuantity({ quantityOnHand: 10, quantityReserved: 3 })).toBe(7);
  });
});

describe("reserveInventory", () => {
  it("reserva exactamente toda la disponibilidad", () => {
    expect(reserveInventory({ quantityOnHand: 10, quantityReserved: 3 }, 7)).toEqual({
      quantityOnHand: 10,
      quantityReserved: 10,
    });
  });

  it("rechaza reservar más que la disponibilidad", () => {
    expectRuleError(
      () => reserveInventory({ quantityOnHand: 10, quantityReserved: 3 }, 8),
      "STOCK_INSUFICIENTE"
    );
  });

  it("rechaza cantidades no positivas", () => {
    expectRuleError(
      () => reserveInventory({ quantityOnHand: 10, quantityReserved: 0 }, 0),
      "CANTIDAD_INVALIDA"
    );
    expectRuleError(
      () => reserveInventory({ quantityOnHand: 10, quantityReserved: 0 }, -1),
      "CANTIDAD_INVALIDA"
    );
  });

  it("rechaza un estado inicial inconsistente", () => {
    expectRuleError(
      () => reserveInventory({ quantityOnHand: 2, quantityReserved: 3 }, 1),
      "INVENTARIO_INCONSISTENTE"
    );
  });
});

describe("releaseInventory", () => {
  it("libera una parte de lo reservado", () => {
    expect(releaseInventory({ quantityOnHand: 10, quantityReserved: 3 }, 2)).toEqual({
      quantityOnHand: 10,
      quantityReserved: 1,
    });
  });

  it("rechaza liberar más de lo reservado", () => {
    expectRuleError(
      () => releaseInventory({ quantityOnHand: 10, quantityReserved: 3 }, 4),
      "CANTIDAD_RESERVADA_INSUFICIENTE"
    );
  });
});

describe("applyInventoryMovement", () => {
  const base = { quantityOnHand: 10, quantityReserved: 3 };

  it("ENTRY incrementa el stock físico sin tocar lo reservado", () => {
    expect(applyInventoryMovement(base, "ENTRY", 5)).toEqual({
      quantityOnHand: 15,
      quantityReserved: 3,
    });
  });

  it("EXIT solo puede consumir disponibilidad libre", () => {
    expect(applyInventoryMovement(base, "EXIT", 7)).toEqual({
      quantityOnHand: 3,
      quantityReserved: 3,
    });
  });

  it("EXIT rechaza consumir stock reservado", () => {
    expectRuleError(
      () => applyInventoryMovement(base, "EXIT", 8),
      "STOCK_INSUFICIENTE"
    );
  });

  it("ADJUSTMENT no puede dejar el stock físico por debajo de lo reservado", () => {
    expect(applyInventoryMovement(base, "ADJUSTMENT", 3)).toEqual({
      quantityOnHand: 3,
      quantityReserved: 3,
    });

    expectRuleError(
      () => applyInventoryMovement(base, "ADJUSTMENT", 2),
      "STOCK_INSUFICIENTE"
    );
  });

  it("RESERVATION usa las mismas reglas que reserveInventory", () => {
    expect(applyInventoryMovement(base, "RESERVATION", 7)).toEqual({
      quantityOnHand: 10,
      quantityReserved: 10,
    });

    expectRuleError(
      () => applyInventoryMovement(base, "RESERVATION", 8),
      "STOCK_INSUFICIENTE"
    );
  });

  it("RELEASE usa las mismas reglas que releaseInventory", () => {
    expect(applyInventoryMovement(base, "RELEASE", 3)).toEqual({
      quantityOnHand: 10,
      quantityReserved: 0,
    });

    expectRuleError(
      () => applyInventoryMovement(base, "RELEASE", 4),
      "CANTIDAD_RESERVADA_INSUFICIENTE"
    );
  });

  it("rechaza cantidades negativas o cero", () => {
    expectRuleError(
      () => applyInventoryMovement(base, "ENTRY", 0),
      "CANTIDAD_INVALIDA"
    );
    expectRuleError(
      () => applyInventoryMovement(base, "ENTRY", -5),
      "CANTIDAD_INVALIDA"
    );
  });

  it("rechaza un tipo de movimiento desconocido", () => {
    expectRuleError(
      () =>
        applyInventoryMovement(
          base,
          "UNKNOWN" as "ENTRY",
          1
        ),
      "TIPO_MOVIMIENTO_INVALIDO"
    );
  });
});
