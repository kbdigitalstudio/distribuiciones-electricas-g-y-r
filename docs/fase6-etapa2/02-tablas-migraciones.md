# 02. Tablas y Migraciones Creadas

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `prisma/schema.prisma` | Esquema de Prisma con 15 tablas |
| `prisma/migrations/001_init/migration.sql` | Migración SQL inicial |
| `src/lib/db.ts` | Configuración de Prisma Client (singleton) |

## Tablas del modelo de datos (15 tablas)

| Tabla | Propósito | Columnas clave |
|-------|-----------|----------------|
| `User` | Usuarios del sistema | id, email, passwordHash, nombre, isActive, roles |
| `Role` | Roles de acceso | id, name (ADMIN, VENDEDOR, CLIENTE), description |
| `Permission` | Permisos granulares | id, name, resource, action |
| `UserRole` | Usuario → Rol (N:M) | userId, roleId, assignedAt |
| `RolePermission` | Rol → Permiso (N:M) | roleId, permissionId |
| `Customer` | Perfil comercial del cliente | id, userId, personType, documentType, documentNumber, razonSocial |
| `Category` | Categorías y subcategorías | id, name, slug, parentId, level, isActive |
| `Product` | Catálogo de productos | id, categoryId, subcategoryId, slug, name, sku, isActive |
| `Price` | Historial de precios | id, productId, priceCents (BIGINT), currency, validFrom, validTo |
| `Inventory` | Stock y disponibilidad | id, productId, quantityOnHand, quantityReserved, minStockAlert |
| `Quote` | Solicitudes de cotización | id, customerId, userId, quoteNumber, status, totalCents, validUntil |
| `QuoteItem` | Líneas de cotización | id, quoteId, productId, priceId, quantity, unitPriceCents |
| `Order` | Pedidos comerciales | id, customerId, userId, orderNumber, quoteId, status, totalCents, paidAt |
| `OrderItem` | Líneas de pedido | id, orderId, productId, priceId, quantity, unitPriceCents |
| `OperationLog` | Log de auditoría | id, userId, action, entityType, entityId, details, ipAddress, createdAt |
| `LoginAttempt` | Protección fuerza bruta | id, userId, email, ipAddress, success, attemptedAt |

## Ajustes aplicados al modelo

1. **UUID como clave primaria** en todas las tablas (evita IDs predecibles)
2. **Precios en centavos (BIGINT)** para evitar errores de punto flotante
3. **Moneda COP por defecto** en la tabla `Price`
4. **Jerarquía de categorías** mediante `parentId` autoreferencial en `Category`
5. **Soft delete** en `Product` y `Category` (`deletedAt`, `isActive`)
6. **Estados de cotización**: DRAFT, SENT, ACCEPTED, EXPIRED, CANCELLED
7. **Estados de pedido**: PENDING_PAYMENT, PAID, FULFILLED, CANCELLED, REFUNDED
8. **Tipos de documento colombiano**: CC, CE, NIT, PASSAPORTE
9. **Tipos de persona**: NATURAL, JURIDICA

## Índices creados

Índices en: email, isActive, parentId, slug, categoryId, productId, status, validUntil, paidAt, documentNumber, attemptedAt, ipAddress, createdAt.

## Nota sobre aplicación

La migración SQL está lista en `prisma/migrations/001_init/migration.sql`. Para aplicarla:

```bash
# 1. Instalar PostgreSQL y crear base de datos
# 2. Copiar .env.example a .env y configurar DATABASE_URL
# 3. Generar cliente Prisma
npx prisma generate
# 4. Aplicar migración
npx prisma db push
# o
npx prisma migrate deploy
```

**No se ejecutó `prisma db push` en esta etapa** porque no hay PostgreSQL operativo conectado (restricción de la Etapa 2).
