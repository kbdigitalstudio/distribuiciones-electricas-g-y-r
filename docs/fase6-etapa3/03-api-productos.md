# 03. API de Productos

## Endpoints implementados

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/products` | Listar productos con paginación, búsqueda y filtros | Público (solo activos) |
| POST | `/api/products` | Crear producto | ADMIN |
| GET | `/api/products/[id]` | Consultar producto por ID | Público (si activo) / ADMIN (si inactivo) |
| PATCH | `/api/products/[id]` | Actualizar producto | ADMIN |
| DELETE | `/api/products/[id]` | Desactivación lógica (soft delete) | ADMIN |

## GET /api/products — Parámetros de consulta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | number | Página (default: 1) |
| `pageSize` | number | Tamaño de página (default: 20, max: 100) |
| `search` | string | Búsqueda por nombre (insensible a mayúsculas) |
| `categoryId` | UUID | Filtrar por categoría |
| `isActive` | boolean | Filtrar por estado (solo ADMIN puede ver inactivos) |

## Validaciones (Zod)

| Campo | Reglas |
|-------|--------|
| `name` | Mínimo 2 caracteres, máximo 255 |
| `slug` | Mínimo 2, máximo 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, único |
| `categoryId` | UUID válido, categoría debe existir |
| `subcategoryId` | UUID válido, debe pertenecer a la categoría especificada |
| `sku` | Máximo 100 caracteres, único (opcional) |
| `imageUrl` | URL válida, máximo 500 caracteres (opcional) |
| `isActive` | Booleano (default: true) |

## Reglas de negocio

| Regla | Implementación |
|-------|---------------|
| Soft delete | `DELETE` establece `deletedAt` y `isActive = false`; productos eliminados no aparecen en consultas públicas |
| Slug único | Verificado antes de crear/actualizar |
| SKU único | Verificado si se proporciona |
| Subcategoría válida | Debe pertenecer a la categoría especificada (validado por `parentId`) |
| Precio vigente | Incluido en la respuesta si existe precio activo (de lo contrario `null` = "A cotizar") |
| Inventario incluido | Cantidad disponible, reservada y mínima de alerta incluida en la respuesta |

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/products/route.ts` | GET listar, POST crear |
| `src/app/api/products/[id]/route.ts` | GET consultar, PATCH actualizar, DELETE desactivar |
