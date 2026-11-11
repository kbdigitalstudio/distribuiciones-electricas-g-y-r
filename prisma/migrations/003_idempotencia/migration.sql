-- Migration 003_idempotencia — GYR Backend (Etapa 3 Correcciones)
-- Agrega campo de idempotencia a InventoryReservation para evitar reservas duplicadas
-- No elimina ni altera tablas existentes de migraciones previas.

-- Agregar columna idempotencyKey a InventoryReservation
ALTER TABLE "InventoryReservation" ADD COLUMN "idempotencyKey" VARCHAR(255) NULL;

-- Agregar restricción UNIQUE para evitar reservas duplicadas con la misma clave de idempotencia
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_idempotencyKey_key" UNIQUE ("idempotencyKey");

-- Agregar índice para búsquedas por clave de idempotencia
CREATE INDEX idx_inventoryReservation_idempotencyKey ON "InventoryReservation"("idempotencyKey");

-- Comentario
COMMENT ON COLUMN "InventoryReservation"."idempotencyKey" IS 'Clave de idempotencia para evitar reservas duplicadas en solicitudes concurrentes';
