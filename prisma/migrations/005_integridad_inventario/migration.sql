-- Migration 005_integridad_inventario — GYR Backend (Etapa 3 Correcciones)
-- Objetivo:
--   1. Normalizar la columna de idempotencia (TEXT, NOT NULL, sin índice duplicado).
--   2. Reforzar a nivel de base de datos la invariante:
--        quantityOnHand >= quantityReserved >= 0
--      para que ninguna operación (ni un bug futuro) pueda dejar disponibilidad negativa.
--   3. Validar los valores permitidos de estado/tipo de movimiento.
--   4. Crear el rol funcional INVENTARIO como rol independiente.
--
-- La migración es aditiva/restrictiva: no elimina tablas ni columnas con datos.
-- Si existieran reservas antiguas con idempotencyKey NULL, el ALTER ... SET NOT NULL
-- fallará de forma segura y deberá hacerse un backfill autorizado antes de reintentar.
--
-- Requiere que 004_normalizacion_identificadores haya dejado los nombres en
-- camelCase (passwordHash, quantityOnHand, etc.).

-- 1. Idempotencia: TEXT (coincide con String de Prisma), obligatoria y sin índice redundante.
--    El índice único lo crea la restricción UNIQUE de la migración 003.
ALTER TABLE "InventoryReservation"
  ALTER COLUMN "idempotencyKey" TYPE TEXT;

ALTER TABLE "InventoryReservation"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

DROP INDEX IF EXISTS idx_inventoryReservation_idempotencyKey;

COMMENT ON COLUMN "InventoryReservation"."idempotencyKey"
  IS 'Clave de idempotencia obligatoria y única por operación de reserva';

-- 2. Invariantes de inventario a nivel de PostgreSQL.
ALTER TABLE "Inventory"
  ADD CONSTRAINT chk_inventory_quantityOnHand_non_negative
  CHECK ("quantityOnHand" >= 0);

ALTER TABLE "Inventory"
  ADD CONSTRAINT chk_inventory_quantityReserved_non_negative
  CHECK ("quantityReserved" >= 0);

ALTER TABLE "Inventory"
  ADD CONSTRAINT chk_inventory_available_non_negative
  CHECK ("quantityOnHand" >= "quantityReserved");

ALTER TABLE "Inventory"
  ADD CONSTRAINT chk_inventory_minStockAlert_non_negative
  CHECK ("minStockAlert" >= 0);

-- 3. Valores permitidos para estado de reserva, tipo de movimiento y clave de idempotencia.
ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT chk_inventoryReservation_status_valid
  CHECK ("status" IN ('ACTIVE', 'RELEASED', 'EXPIRED', 'CONSUMED'));

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT chk_inventoryReservation_idempotencyKey_not_empty
  CHECK (length(btrim("idempotencyKey")) > 0);

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT chk_inventoryMovement_type_valid
  CHECK ("movementType" IN ('ENTRY', 'EXIT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE'));

-- 4. Rol INVENTARIO independiente. No se asigna automáticamente a VENDEDOR.
INSERT INTO "Role" ("id", "name", "description", "createdAt", "updatedAt")
VALUES (
  uuid_generate_v4(),
  'INVENTARIO',
  'Gestión de inventario (rol funcional independiente de VENDEDOR)',
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO NOTHING;

COMMENT ON TABLE "Role" IS 'Roles de acceso (ADMIN, VENDEDOR, INVENTARIO, CLIENTE)';
