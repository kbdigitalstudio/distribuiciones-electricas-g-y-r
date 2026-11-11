# 02. Migraciones

## Migraciones preparadas

| Migración | Archivo | Estado | Descripción |
|-----------|---------|--------|-------------|
| 001_init | `prisma/migrations/001_init/migration.sql` | Preparada (no aplicada) | 15 tablas base de la Etapa 2 |
| 002_catalogo | `prisma/migrations/002_catalogo/migration.sql` | Preparada (no aplicada) | `InventoryMovement` e `InventoryReservation` |

## Contenido de la migración 002_catalogo

La migración crea dos tablas:

1. **`InventoryMovement`**: historial de movimientos (entrada, salida, ajuste, reserva, liberación)
2. **`InventoryReservation`**: reservas transaccionales de inventario

### Índices creados en 002_catalogo

- `idx_inventoryMovement_productId`
- `idx_inventoryMovement_createdBy`
- `idx_inventoryMovement_createdAt`
- `idx_inventoryMovement_movementType`
- `idx_inventoryReservation_productId`
- `idx_inventoryReservation_createdBy`
- `idx_inventoryReservation_status`
- `idx_inventoryReservation_expiresAt`

### Restricciones CHECK

- `chk_inventoryMovement_quantity_non_negative`: `quantity >= 0`
- `chk_inventoryMovement_previousQuantity_non_negative`: `previousQuantity >= 0`
- `chk_inventoryMovement_newQuantity_non_negative`: `newQuantity >= 0`
- `chk_inventoryReservation_quantity_positive`: `quantity > 0`

## Requisitos verificados

| Requisito | Estado |
|-----------|--------|
| Migraciones versionadas | ✅ 001_init, 002_catalogo |
| Compatibilidad con PostgreSQL | ✅ Sintaxis SQL estándar |
| Integridad referencial | ✅ Claves foráneas definidas |
| Índices apropiados | ✅ En columnas de consulta frecuente |
| Restricciones de unicidad | ✅ Slug único en Product y Category |
| Restricciones cantidades no negativas | ✅ CHECK constraints en movimiento y reserva |
| Relaciones correctamente definidas | ✅ En schema.prisma |
| Soft delete | ✅ `deletedAt` en Product y Category |
| Integridad transaccional | ✅ Movimientos y reservas usan `$transaction` de Prisma |

## Estado de aplicación

| Acción | Estado | Motivo |
|--------|--------|--------|
| `npx prisma validate` | ✅ Ejecutado | Esquema válido (solo warnings preexistentes de SetNull) |
| `npx prisma generate` | ❌ No ejecutado | Requiere scripts de instalación autorizados |
| `npx prisma db push` | ❌ No ejecutado | No hay credenciales de PostgreSQL disponibles |
| `npx prisma migrate deploy` | ❌ No ejecutado | No hay conexión a BD operativa |
