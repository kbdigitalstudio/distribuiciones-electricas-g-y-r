# 03. Modelo de Datos — Revisión y Ajustes Necesarios

Este documento revisa el modelo de 14 tablas propuesto en el informe de la Fase 6 y documenta los ajustes necesarios antes de la implementación.

## Modelo original (14 tablas)

| Tabla | Propósito |
|-------|-----------|
| `users` | Usuarios del sistema |
| `roles` | Roles de acceso |
| `role_assignments` | Usuario → Rol (N:M) |
| `permissions` | Permisos granulares |
| `role_permissions` | Rol → Permiso (N:M) |
| `customers` | Perfil comercial del cliente |
| `categories` | Categorías y subcategorías |
| `products` | Catálogo de productos |
| `prices` | Historial de precios |
| `inventory` | Stock y disponibilidad |
| `quotes` | Solicitudes de cotización |
| `quote_items` | Líneas de cotización |
| `orders` | Pedidos comerciales |
| `order_items` | Líneas de pedido |
| `operation_log` | Historial de operaciones |

**Total: 15 tablas** (incluyendo `operation_log` — el informe original mencionaba 14, pero el modelo detallado tiene 15).

---

## Ajustes necesarios identificados

### Ajuste 1: Normalización de categorías duplicadas

En `products.ts` actual, hay nombres de categoría que se repiten con significados diferentes:

| Producto | Categoría actual | Problema |
|----------|-----------------|----------|
| Transformador de Distribución | Media Tensión | También existe en "Transformadores" |
| Tableros Alumbrado NQ | Baja Tensión | También existe en "Cajas y Tableros" |
| Crucetas Metálicas | Media Tensión | También existe en "Herrajería" |

**Ajuste:** La tabla `categories` debe permitir subcategorías mediante `parent_id` (autoreferencia), y cada producto debe referenciar una categoría específica y opcionalmente una subcategoría. Esto evita ambigüedad y permite jerarquía real.

**Cambio en `categories`:**
- Agregar columna `parent_id` (UUID, FK nullable a `categories.id`)
- Agregar columna `level` (integer, para profundidad de jerarquía)
- Índice en `parent_id` para consultas de subcategorías

### Ajuste 2: Precios con moneda y rango de validez

La tabla `prices` original ya contempla `currency` y `valid_from`/`valid_to`. Se agrega:

- `price_cents` como BIGINT (no DECIMAL, para evitar errores de punto flotante)
- `is_active` como booleano derivado de las fechas (puede ser computed o mantenido por trigger)
- Índice compuesto en `(product_id, is_active)` para consultas rápidas del precio vigente

### Ajuste 3: Inventario con reservas

La tabla `inventory` debe distinguir entre:

- `quantity_available`: stock realmente disponible para venta
- `quantity_reserved`: stock reservado en pedidos pendientes de pago
- `quantity_on_hand`: total físico (`available + reserved`)

**Ajuste:** Agregar columna `quantity_reserved` y calcular `available = on_hand - reserved` en la capa de servicio.

### Ajuste 4: Clientes con identificación fiscal colombiana

La tabla `customers` debe incluir:

- `document_type`: CC (cédula ciudadanía), CE (cédula extranjería), NIT (persona jurídica), Pasaporte
- `document_number`: número de identificación (único por tipo)
- `person_type`: natural / jurídica
- Para jurídica: `razon_social`; para natural: `primer_nombre`, `primer_apellido`

**Ajuste:** Refinar columnas de `customers` para cumplir con requisitos fiscales de Colombia (DIAN).

### Ajuste 5: Estados de pedido y cotización

Definir enums estrictos:

**Cotización (`quotes.status`):**
- `draft` — borrador, no enviada
- `sent` — enviada al cliente
- `accepted` — aceptada por el cliente
- `expired` — vencida sin aceptar
- `cancelled` — cancelada

**Pedido (`orders.status`):**
- `pending_payment` — creado, esperando pago
- `paid` — pago confirmado por pasarela
- `fulfilled` — entregado / completado
- `cancelled` — cancelado
- `refunded` — reembolsado

**Ajuste:** Agregar columnas `status` con restricción CHECK o enum en PostgreSQL.

### Ajuste 6: Log de operaciones con IP y user agent

La tabla `operation_log` debe capturar:

- `ip_address`: dirección IP del solicitante
- `user_agent`: navegador/dispositivo
- `details`: JSON con antes/después del cambio

### Ajuste 7: Soft delete en lugar de hard delete

Para mantener trazabilidad, se recomienda soft delete en tablas maestras:

- `products`: `deleted_at` timestamp nullable
- `categories`: `deleted_at` timestamp nullable
- `users`: `is_active` booleano en lugar de eliminar

---

## Modelo ajustado (resumen de columnas por tabla)

### `users`
- id (UUID PK), email (UK), password_hash, nombre, telefono, direccion, ciudad, departamento, is_active, email_verified_at, created_at, updated_at

### `roles`
- id (UUID PK), name (UK), description, created_at

### `role_assignments`
- user_id (FK), role_id (FK), PK compuesto (user_id, role_id)

### `permissions`
- id (UUID PK), name (UK), resource, action, created_at

### `role_permissions`
- role_id (FK), permission_id (FK), PK compuesto

### `customers`
- id (UUID PK), user_id (FK nullable), person_type, document_type, document_number (UK parcial), razon_social, nombre, apellido, ciudad, departamento, direccion, telefono, email, created_at, updated_at

### `categories`
- id (UUID PK), name, slug (UK), description, image_url, parent_id (FK nullable), level, is_active, deleted_at, created_at, updated_at

### `products`
- id (UUID PK), category_id (FK), subcategory_id (FK nullable), slug (UK), name, description, short_description, sku (UK), image_url, is_active, deleted_at, created_at, updated_at

### `prices`
- id (UUID PK), product_id (FK), price_cents (BIGINT), currency (default COP), valid_from, valid_to, is_active, created_at

### `inventory`
- id (UUID PK), product_id (FK UK), quantity_on_hand, quantity_reserved, min_stock_alert, updated_at

### `quotes`
- id (UUID PK), customer_id (FK), user_id (FK), quote_number (UK), status, subtotal_cents, tax_cents, total_cents, valid_until, notes, created_at, updated_at

### `quote_items`
- id (UUID PK), quote_id (FK), product_id (FK), price_id (FK), quantity, unit_price_cents, subtotal_cents

### `orders`
- id (UUID PK), customer_id (FK), user_id (FK), order_number (UK), quote_id (FK nullable), status, subtotal_cents, tax_cents, total_cents, payment_method, payment_reference, paid_at, created_at, updated_at

### `order_items`
- id (UUID PK), order_id (FK), product_id (FK), price_id (FK), quantity, unit_price_cents, subtotal_cents

### `operation_log`
- id (UUID PK), user_id (FK nullable), action, entity_type, entity_id, details (JSON), ip_address, user_agent, created_at

---

## Ajustes pendientes de decisión (Etapa 2)

1. **ORM:** Prisma vs Drizzle vs SQL puro. Afecta cómo se definen las migraciones.
2. **Enum vs CHECK:** Usar tipos enum de PostgreSQL o columnas de texto con restricción CHECK.
3. **Soft delete vs hard delete:** Decidir política de eliminación para productos y categorías.
4. **Multi-tenant:** Si GYR podría tener múltiples sucursales o bodegas, agregar `branch_id` o `warehouse_id`.

## Archivos relacionados

- `02-contratos-api.md`: endpoints que consumen este modelo
- `04-plan-migracion-localstorage.md`: cómo pasar de localStorage a este modelo
- `05-plan-pruebas-tecnicas-seguridad.md`: pruebas de integridad del modelo
