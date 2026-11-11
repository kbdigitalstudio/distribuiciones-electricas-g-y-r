# 03. Endpoints Implementados

## Autenticación (`/api/auth`)

| Endpoint | Método | Descripción | Acceso | Estado |
|----------|--------|-------------|--------|--------|
| `/api/auth/register` | POST | Registro de nuevo usuario con rol CLIENTE | Público | ✅ Implementado |
| `/api/auth/login` | POST | Inicio de sesión con protección fuerza bruta | Público | ✅ Implementado |
| `/api/auth/logout` | POST | Cierre de sesión, limpia cookies | Autenticado | ✅ Implementado |
| `/api/auth/me` | GET | Datos del usuario autenticado | Autenticado | ✅ Implementado |

## Usuarios (`/api/users`)

| Endpoint | Método | Descripción | Acceso | Estado |
|----------|--------|-------------|--------|--------|
| `/api/users` | GET | Listar usuarios con paginación | ADMIN | ✅ Implementado |
| `/api/users` | POST | Crear usuario (rol asignado por ADMIN) | ADMIN | ✅ Implementado |
| `/api/users/[id]` | GET | Obtener usuario por ID | Propio / ADMIN | ✅ Implementado |
| `/api/users/[id]` | PUT | Actualizar usuario | Propio / ADMIN | ✅ Implementado |
| `/api/users/[id]` | DELETE | Desactivar usuario (soft delete) | ADMIN | ✅ Implementado |

## Roles (`/api/roles`)

| Endpoint | Método | Descripción | Acceso | Estado |
|----------|--------|-------------|--------|--------|
| `/api/roles` | GET | Listar roles con permisos | ADMIN | ✅ Implementado |
| `/api/roles` | POST | Crear rol con permisos | ADMIN | ✅ Implementado |

## Middleware (`middleware.ts`)

| Función | Descripción |
|---------|-------------|
| Protección de rutas | Requiere sesión válida en `/api/users`, `/api/roles`, `/api/admin` |
| Rol ADMIN | Requiere rol ADMIN en `/api/roles`, `/api/admin` |
| CSRF | Valida presencia de `X-CSRF-Token` en métodos POST/PUT/PATCH/DELETE |
| Runtime | `nodejs` (permite módulos Node.js como `crypto`) |

## Endpoints NO implementados en esta etapa

Los siguientes endpoints están documentados en el contrato API (Etapa 1) pero no implementados en la Etapa 2:

- `/api/products/*` (catálogo — Etapa 3)
- `/api/categories/*` (categorías — Etapa 3)
- `/api/prices/*` (precios — Etapa 3)
- `/api/inventory/*` (inventario — Etapa 3)
- `/api/customers/*` (clientes — Etapa 4)
- `/api/quotes/*` (cotizaciones — Etapa 4)
- `/api/orders/*` (pedidos — Etapa 5)
- `/api/admin/dashboard` (panel admin — Etapa 3+)
- `/api/admin/operation-log` (log auditoría — parte implementada en OperationLog)

## Formato de respuestas

Todas las respuestas siguen el formato:

```json
// Éxito
{ "success": true, "data": {...}, "message": "..." }

// Error
{ "error": "Descripción del error", "code": "CODIGO_ERROR", "details": {...} }
```
