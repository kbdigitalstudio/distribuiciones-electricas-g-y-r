# 04. API de Categorías

## Endpoints implementados

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/categories` | Listar categorías con paginación y jerarquía | Público (solo activas) |
| POST | `/api/categories` | Crear categoría | ADMIN |
| GET | `/api/categories/[id]` | Consultar categoría por ID | Público (si activa) / ADMIN (si inactiva) |
| PATCH | `/api/categories/[id]` | Actualizar categoría | ADMIN |
| DELETE | `/api/categories/[id]` | Desactivación lógica (soft delete) | ADMIN |

## GET /api/categories — Parámetros de consulta

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | number | Página (default: 1) |
| `pageSize` | number | Tamaño de página (default: 20, max: 100) |
| `search` | string | Búsqueda por nombre (insensible a mayúsculas) |
| `parentId` | UUID | Filtrar por categoría padre (vacío = categorías raíz) |
| `isActive` | boolean | Filtrar por estado (solo ADMIN puede ver inactivas) |

## Validaciones (Zod)

| Campo | Reglas |
|-------|--------|
| `name` | Mínimo 2 caracteres, máximo 255 |
| `slug` | Mínimo 2, máximo 255, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, único |
| `parentId` | UUID válido, categoría padre debe existir |
| `level` | Calculado automáticamente (padre.level + 1, máximo 10) |
| `isActive` | Booleano (default: true) |

## Reglas de negocio

| Regla | Implementación |
|-------|---------------|
| Jerarquía padre-hijo | `parentId` referencia a otra `Category`; `level` calculado automáticamente |
| No ciclos | Una categoría no puede ser padre de sí misma; profundidad máxima 10 niveles |
| Slug único | Verificado antes de crear/actualizar |
| Soft delete | No se puede desactivar una categoría con productos activos o subcategorías activas |
| Soft delete | `DELETE` establece `deletedAt` y `isActive = false` |

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/categories/route.ts` | GET listar, POST crear |
| `src/app/api/categories/[id]/route.ts` | GET consultar, PATCH actualizar, DELETE desactivar |
