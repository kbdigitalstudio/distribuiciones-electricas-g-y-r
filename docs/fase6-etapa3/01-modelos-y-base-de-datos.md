# 01. Modelos y Base de Datos

## Modelos implementados (Etapa 3)

El esquema de Prisma (`prisma/schema.prisma`) ya contenía los modelos base de la Etapa 2. En la Etapa 3 se agregaron dos modelos faltantes para el módulo de inventario.

### Modelos reutilizados (Etapa 2, sin modificaciones)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| `Product` | id, name, slug, description, categoryId, subcategoryId, sku, imageUrl, isActive, deletedAt | Catálogo de productos |
| `Category` | id, name, slug, description, parentId, level, isActive, deletedAt | Categorías y subcategorías jerárquicas |
| `Price` | id, productId, priceCents (BIGINT), currency, validFrom, validTo, isActive | Historial de precios |
| `Inventory` | id, productId, quantityOnHand, quantityReserved, minStockAlert | Stock y disponibilidad |

### Modelos nuevos (Etapa 3)

| Modelo | Campos clave | Propósito |
|--------|-------------|-----------|
| `InventoryMovement` | id, productId, movementType, quantity, previousQuantity, newQuantity, reason, reference, createdBy, createdAt | Historial de movimientos de inventario |
| `InventoryReservation` | id, productId, quantity, status, reservedAt, releasedAt, reference, createdBy, expiresAt | Reservas transaccionales de inventario |

### Reglas de integridad aplicadas

| Regla | Implementación |
|-------|---------------|
| Slug único | `@unique` en `Product.slug` y `Category.slug` |
| Soft delete | `deletedAt` en `Product` y `Category`; consultas públicas filtran `deletedAt: null` |
| Precios en centavos | `priceCents` tipo `BigInt` en `Price`; moneda `COP` por defecto |
| Cantidades no negativas | `CHECK` constraints en `InventoryMovement` y `InventoryReservation` (migración 002) |
| Integridad referencial | Claves foráneas en todos los modelos relacionados |
| Índices | `productId`, `slug`, `isActive`, `categoryId`, `status`, `movementType`, `createdAt` |

### Archivos de esquema y migración

| Archivo | Contenido |
|---------|-----------|
| `prisma/schema.prisma` | Esquema completo con 17 modelos (15 de Etapa 2 + 2 nuevos de Etapa 3) |
| `prisma/migrations/001_init/migration.sql` | Migración inicial (15 tablas, sin cambios) |
| `prisma/migrations/002_catalogo/migration.sql` | Migración para `InventoryMovement` e `InventoryReservation` |

### Nota sobre disponibilidad de PostgreSQL

PostgreSQL 18 está instalado y corriendo en el puerto 5432, pero no se pudo autenticar sin contraseña. Por lo tanto:
- `npx prisma generate` no se ejecutó (requiere scripts autorizados)
- `npx prisma db push` no se ejecutó (no hay conexión a BD)
- Las migraciones están preparadas pero no aplicadas ni verificadas contra BD real
