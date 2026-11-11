# 05. Matriz de Roles y Permisos

## Roles definidos

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `CLIENTE` | 1 | Cliente estándar (puede ver catálogo, solicitar cotizaciones, ver propios pedidos) |
| `VENDEDOR` | 2 | Vendedor (puede gestionar cotizaciones, pedidos, clientes propios) |
| `ADMIN` | 3 | Administrador (acceso total: usuarios, roles, productos, precios, inventario, auditoría) |

## Jerarquía de roles

`CLIENTE` < `VENDEDOR` < `ADMIN`

Un rol de nivel superior puede realizar todas las acciones de los niveles inferiores.

## Matriz de permisos por endpoint

| Endpoint | Método | CLIENTE | VENDEDOR | ADMIN |
|----------|--------|---------|----------|-------|
| `/api/auth/register` | POST | ✅ | ✅ | ✅ |
| `/api/auth/login` | POST | ✅ | ✅ | ✅ |
| `/api/auth/logout` | POST | ✅ | ✅ | ✅ |
| `/api/auth/me` | GET | ✅ | ✅ | ✅ |
| `/api/users` | GET | ❌ | ❌ | ✅ |
| `/api/users` | POST | ❌ | ❌ | ✅ |
| `/api/users/[id]` | GET | ✅ (propio) | ✅ (propio) | ✅ |
| `/api/users/[id]` | PUT | ✅ (propio) | ✅ (propio) | ✅ |
| `/api/users/[id]` | DELETE | ❌ | ❌ | ✅ |
| `/api/roles` | GET | ❌ | ❌ | ✅ |
| `/api/roles` | POST | ❌ | ❌ | ✅ |

## Reglas de autorización

| Regla | Descripción |
|-------|-------------|
| Auto-perfil | Un usuario puede ver/editar su propio perfil (`users/[id]` donde `id === session.userId`) |
| Modificar otros usuarios | Solo ADMIN puede modificar/desactivar usuarios que no sean él mismo |
| Asignación de roles | Solo ADMIN puede asignar roles; un usuario no puede auto-asignarse privilegios |
| Cambio de estado (isActive) | Solo ADMIN puede activar/desactivar usuarios |
| Creación de usuarios | Solo ADMIN puede crear usuarios con roles específicos; el rol por defecto es CLIENTE |

## Implementación técnica

El archivo `src/lib/authz.ts` contiene:

- `getRoleLevel(role)`: retorna el nivel numérico del rol
- `hasRole(roles, required)`: verifica si el usuario tiene un rol específico
- `hasMinRole(roles, minRole)`: verifica si el usuario tiene al menos el rol requerido
- `getAuthenticatedUser(request)`: obtiene el usuario autenticado y sus roles
- `requireRole(roles, required)`: retorna error 403 si el rol es insuficiente
- `canModifyUser(targetUserId, sessionUserId, roles)`: verifica si se puede modificar un usuario

El middleware `middleware.ts` protege las rutas a nivel de red (requiere sesión y rol ADMIN para rutas admin), y cada route handler valida autorización granular a nivel de aplicación.
