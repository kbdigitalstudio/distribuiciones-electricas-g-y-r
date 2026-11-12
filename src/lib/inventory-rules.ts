/**
 * Reglas puras de inventario.
 *
 * Todas las operaciones que modifican existencias pasan por estas funciones.
 * Su objetivo es garantizar, antes de escribir en PostgreSQL, que:
 *   - quantityOnHand >= 0
 *   - quantityReserved >= 0
 *   - quantityOnHand >= quantityReserved  (disponibilidad nunca negativa)
 *
 * El bloqueo de fila (SELECT ... FOR UPDATE) se realiza en la capa de acceso a
 * datos; estas funciones no asumen nada sobre concurrencia.
 */

export type InventoryMovementType =
  | "ENTRY"
  | "EXIT"
  | "ADJUSTMENT"
  | "RESERVATION"
  | "RELEASE";

export type InventoryRuleErrorCode =
  | "STOCK_INSUFICIENTE"
  | "CANTIDAD_RESERVADA_INSUFICIENTE"
  | "CANTIDAD_INVALIDA"
  | "INVENTARIO_INCONSISTENTE"
  | "TIPO_MOVIMIENTO_INVALIDO";

export class InventoryRuleError extends Error {
  public readonly code: InventoryRuleErrorCode;

  constructor(code: InventoryRuleErrorCode, message?: string) {
    super(message ?? code);
    this.name = "InventoryRuleError";
    this.code = code;
  }
}

export interface InventorySnapshot {
  quantityOnHand: number;
  quantityReserved: number;
}

export interface InventoryState {
  quantityOnHand: number;
  quantityReserved: number;
}

function assertValidSnapshot(inventory: InventorySnapshot): void {
  if (
    !Number.isInteger(inventory.quantityOnHand) ||
    !Number.isInteger(inventory.quantityReserved)
  ) {
    throw new InventoryRuleError(
      "CANTIDAD_INVALIDA",
      "Las cantidades de inventario deben ser enteros"
    );
  }

  if (inventory.quantityOnHand < 0 || inventory.quantityReserved < 0) {
    throw new InventoryRuleError(
      "CANTIDAD_INVALIDA",
      "Las cantidades de inventario no pueden ser negativas"
    );
  }

  if (inventory.quantityReserved > inventory.quantityOnHand) {
    throw new InventoryRuleError(
      "INVENTARIO_INCONSISTENTE",
      "El inventario reservado no puede superar el inventario físico"
    );
  }
}

function assertPositiveQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InventoryRuleError(
      "CANTIDAD_INVALIDA",
      "La cantidad debe ser un entero mayor a cero"
    );
  }
}

export function availableQuantity(inventory: InventorySnapshot): number {
  return inventory.quantityOnHand - inventory.quantityReserved;
}

export function reserveInventory(
  inventory: InventorySnapshot,
  quantity: number
): InventoryState {
  assertValidSnapshot(inventory);
  assertPositiveQuantity(quantity);

  if (availableQuantity(inventory) < quantity) {
    throw new InventoryRuleError(
      "STOCK_INSUFICIENTE",
      "No hay disponibilidad suficiente para reservar"
    );
  }

  return {
    quantityOnHand: inventory.quantityOnHand,
    quantityReserved: inventory.quantityReserved + quantity,
  };
}

export function releaseInventory(
  inventory: InventorySnapshot,
  quantity: number
): InventoryState {
  assertValidSnapshot(inventory);
  assertPositiveQuantity(quantity);

  if (inventory.quantityReserved < quantity) {
    throw new InventoryRuleError(
      "CANTIDAD_RESERVADA_INSUFICIENTE",
      "La cantidad reservada es menor que la cantidad a liberar"
    );
  }

  return {
    quantityOnHand: inventory.quantityOnHand,
    quantityReserved: inventory.quantityReserved - quantity,
  };
}

export function applyInventoryMovement(
  inventory: InventorySnapshot,
  movementType: InventoryMovementType,
  quantity: number
): InventoryState {
  assertValidSnapshot(inventory);
  assertPositiveQuantity(quantity);

  let result: InventoryState;

  switch (movementType) {
    case "ENTRY":
      result = {
        quantityOnHand: inventory.quantityOnHand + quantity,
        quantityReserved: inventory.quantityReserved,
      };
      break;

    case "EXIT":
      // No se puede sacar stock que ya está comprometido en reservas.
      if (availableQuantity(inventory) < quantity) {
        throw new InventoryRuleError(
          "STOCK_INSUFICIENTE",
          "No hay disponibilidad suficiente para retirar stock"
        );
      }
      result = {
        quantityOnHand: inventory.quantityOnHand - quantity,
        quantityReserved: inventory.quantityReserved,
      };
      break;

    case "ADJUSTMENT":
      // El nuevo valor de quantityOnHand debe cubrir lo ya reservado.
      if (quantity < inventory.quantityReserved) {
        throw new InventoryRuleError(
          "STOCK_INSUFICIENTE",
          "El ajuste dejaría stock reservado por encima del stock físico"
        );
      }
      result = {
        quantityOnHand: quantity,
        quantityReserved: inventory.quantityReserved,
      };
      break;

    case "RESERVATION":
      result = reserveInventory(inventory, quantity);
      break;

    case "RELEASE":
      result = releaseInventory(inventory, quantity);
      break;

    default:
      throw new InventoryRuleError(
        "TIPO_MOVIMIENTO_INVALIDO",
        "Tipo de movimiento de inventario inválido"
      );
  }

  // Defensa final: ninguna ruta debe devolver un estado inconsistente.
  assertValidSnapshot(result);
  return result;
}
