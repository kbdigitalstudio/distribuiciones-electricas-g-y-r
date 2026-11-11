-- Migration 002_catalogo — GYR Backend (Etapa 3)
-- Tablas adicionales para inventario: movimientos y reservas
-- No se cargan datos comerciales inventados.
-- No elimina ni altera tablas existentes de la migración 001_init.

-- Tabla: InventoryMovement
-- Registra cada movimiento de inventario (entrada, salida, ajuste, reserva, liberación)
CREATE TABLE "InventoryMovement" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID NOT NULL,
  movementType VARCHAR(20) NOT NULL, -- ENTRY, EXIT, ADJUSTMENT, RESERVATION, RELEASE
  quantity INTEGER NOT NULL,
  previousQuantity INTEGER NOT NULL,
  newQuantity INTEGER NOT NULL,
  reason VARCHAR(255) NOT NULL,
  reference VARCHAR(255) NULL,
  createdBy UUID NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (productId) REFERENCES "Product"(id),
  FOREIGN KEY (createdBy) REFERENCES "User"(id) ON DELETE SET NULL
);

-- Tabla: InventoryReservation
-- Registra reservas transaccionales de inventario
CREATE TABLE "InventoryReservation" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID NOT NULL,
  quantity INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, EXPIRED, CONSUMED
  reservedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  releasedAt TIMESTAMP NULL,
  reference VARCHAR(255) NULL,
  createdBy UUID NOT NULL,
  expiresAt TIMESTAMP NULL,
  FOREIGN KEY (productId) REFERENCES "Product"(id),
  FOREIGN KEY (createdBy) REFERENCES "User"(id) ON DELETE SET NULL
);

-- Índices de rendimiento
CREATE INDEX idx_inventoryMovement_productId ON "InventoryMovement"(productId);
CREATE INDEX idx_inventoryMovement_createdBy ON "InventoryMovement"(createdBy);
CREATE INDEX idx_inventoryMovement_createdAt ON "InventoryMovement"(createdAt);
CREATE INDEX idx_inventoryMovement_movementType ON "InventoryMovement"(movementType);
CREATE INDEX idx_inventoryReservation_productId ON "InventoryReservation"(productId);
CREATE INDEX idx_inventoryReservation_createdBy ON "InventoryReservation"(createdBy);
CREATE INDEX idx_inventoryReservation_status ON "InventoryReservation"(status);
CREATE INDEX idx_inventoryReservation_expiresAt ON "InventoryReservation"(expiresAt);

-- Comentarios
COMMENT ON TABLE "InventoryMovement" IS 'Historial de movimientos de inventario (entrada, salida, ajuste, reserva, liberación)';
COMMENT ON TABLE "InventoryReservation" IS 'Reservas transaccionales de inventario';

-- Restricciones de integridad (cantidades no negativas)
-- Nota: PostgreSQL CHECK constraints se agregan aquí para integridad a nivel de base de datos
ALTER TABLE "InventoryMovement" ADD CONSTRAINT chk_inventoryMovement_quantity_non_negative CHECK (quantity >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT chk_inventoryMovement_previousQuantity_non_negative CHECK (previousQuantity >= 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT chk_inventoryMovement_newQuantity_non_negative CHECK (newQuantity >= 0);

ALTER TABLE "InventoryReservation" ADD CONSTRAINT chk_inventoryReservation_quantity_positive CHECK (quantity > 0);
