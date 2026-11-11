# 07. Seguridad y Permisos

## Matriz de permisos implementada

| Función | Público | CLIENTE | VENDEDOR (INVENTARIO) | ADMIN |
|---------|---------|---------|----------------------|-------|
| Ver productos activos | ✅ | ✅ | ✅ | ✅ |
| Crear productos | ❌ | ❌ | ❌ | ✅ |
| Editar productos | ❌ | ❌ | ❌ | ✅ |
| Ver categorías activas | ✅ | ✅ | ✅ | ✅ |
| Administrar categorías | ❌ | ❌ | ❌ | ✅ |
| Consultar precios | ✅ | ✅ | ✅ | ✅ |
| Registrar precios | ❌ | ❌ | ❌ | ✅ |
| Consultar inventario interno | ❌ | ❌ | ✅ | ✅ |
| Registrar movimientos | ❌ | ❌ | ✅ | ✅ |
| Administrar reservas | ❌ | ❌ | ✅ | ✅ |

## Niveles de rol (Etapa 2)

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| CLIENTE | 1 | Cliente estándar |
| VENDEDOR | 2 | Vendedor / personal de inventario |
| ADMIN | 3 | Administrador completo |

## Implementación de autorización

### Middleware (`middleware.ts`)

- Rutas de autenticación (`/api/auth/*`): acceso sin sesión
- Rutas de catálogo con lectura pública (`/api/products`, `/api/categories`): GET sin sesión, otros métodos requieren sesión
- Rutas protegidas (`/api/users`, `/api/roles`, `/api/admin`, `/api/inventory`): requieren sesión para cualquier método
- Rutas de administrador (`/api/roles`, `/api/admin`): requieren rol ADMIN
- CSRF: token requerido en POST/PUT/PATCH/DELETE para rutas protegidas

### Route Handlers

Cada endpoint verifica autorización granularmente usando:
- `getAuthenticatedUser(request)`: obtiene sesión y roles del usuario
- `requireRole(roles, "ADMIN")`: verifica rol mínimo ADMIN
- `hasMinRole(roles, "VENDEDOR")`: verifica rol mínimo VENDEDOR para inventario

### Medidas de seguridad

| Medida | Implementación |
|--------|---------------|
| JWT en cookies HttpOnly | Sesiones servidor, no en localStorage |
| Cookies Secure y SameSite=Strict | Solo HTTPS, protección CSRF |
| Double submit CSRF | Cookie + header `X-CSRF-Token` en escrituras |
| Validación Zod | Todos los endpoints validan entrada con esquemas Zod |
| UUID como PK | No IDs secuenciales predecibles |
| Soft delete | Productos y categorías no se eliminan físicamente |
| OperaciónLog | Todas las acciones administrativas quedan registradas |
| Anti-enumeración | Heredado de autenticación Etapa 2 (respuestas genéricas) |

## Archivos relacionados

- `middleware.ts` — Protección de rutas a nivel de red
- `src/lib/authz.ts` — Autorización por roles
- `src/lib/session.ts` — Gestión de cookies de sesión
- `src/lib/validations.ts` — Esquemas de validación Zod
