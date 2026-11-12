# 07. Seguridad y Permisos

- **Estado:** vigente para la Etapa 3 corregida (11 de noviembre de 2026).
- **Cambio clave:** `INVENTARIO` es un rol funcional independiente. `VENDEDOR` ya no obtiene acceso implícito al inventario.

---

## 1. Jerarquía de roles

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `CLIENTE` | 1 | Cliente estándar |
| `VENDEDOR` | 2 | Vendedor / personal comercial |
| `ADMIN` | 3 | Administrador completo |
| `INVENTARIO` | — | Rol funcional ortogonal, fuera de la jerarquía numérica |

```ts
ROLE_LEVELS = { CLIENTE: 1, VENDEDOR: 2, ADMIN: 3 }
INVENTORY_ROLES = ["INVENTARIO", "ADMIN"]
```

`INVENTARIO` no se deriva de `VENDEDOR` ni comparte su nivel. El acceso se concede con la comprobación explícita:

```ts
canAccessInventory(userRoles)
```

Un usuario puede tener `VENDEDOR` y `INVENTARIO` a la vez; son permisos distintos.

---

## 2. Matriz de permisos

| Función | Público | CLIENTE | VENDEDOR | INVENTARIO | ADMIN |
|---------|---------|---------|----------|------------|-------|
| Ver productos activos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear productos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Editar productos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver categorías activas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Administrar categorías | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar precios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar precios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar inventario interno | ❌ | ❌ | ❌ | ✅ | ✅ |
| Registrar movimientos | ❌ | ❌ | ❌ | ✅ | ✅ |
| Crear reservas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Liberar reservas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Administrar usuarios y roles | ❌ | ❌ | ❌ | ❌ | ✅ |

**Nota operativa:** los usuarios que antes operaban inventario con solo `VENDEDOR` deben recibir el rol `INVENTARIO` de forma explícita. No se debe reintroducir el acceso implícito para “evitar el cambio”.

---

## 3. Implementación de autorización

### 3.1 Middleware (`middleware.ts`)

Se aplica a `/api/:path*`:

- `/api/auth/*`: acceso sin sesión.
- `/api/products` y `/api/categories`: `GET`, `HEAD` y `OPTIONS` son públicos; los métodos de escritura requieren sesión.
- `/api/users`, `/api/roles`, `/api/admin` y `/api/inventory`: requieren sesión para cualquier método.
- `/api/roles` y `/api/admin`: adicionalmente exigen `session.role === "ADMIN"`.
- Métodos `POST`, `PUT`, `PATCH` y `DELETE`: exigen presencia del header `X-CSRF-Token` en rutas protegidas.

El middleware es una primera barrera. **La autorización definitiva se valida en cada route handler**, porque el middleware no conoce todos los roles de la base de datos ni reemplaza la comprobación granular.

### 3.2 Route Handlers

Cada handler de inventario ejecuta, en este orden:

1. `getAuthenticatedUser(request)`: valida la sesión y carga el usuario y sus roles desde PostgreSQL.
2. `canAccessInventory(auth.roles)`: exige `INVENTARIO` o `ADMIN`.
3. `validateCsrfToken(header)`: valida el token CSRF en métodos de escritura.
4. Validación Zod del cuerpo, parámetros y UUID.
5. Transacción con bloqueo de fila y auditoría.

Ningún handler confía en roles enviados por el cliente, en el estado del frontend ni en la sola presencia de una cookie.

### 3.3 Reglas puras

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/roles.ts` | Jerarquía, roles explícitos y `canAccessInventory()` |
| `src/lib/inventory-rules.ts` | Invariantes de cantidades y tipos de movimiento |
| `src/lib/inventory-locks.ts` | Bloqueos `FOR UPDATE` y orden global |
| `src/lib/validations.ts` | Esquemas Zod de entrada |

Mantener estas reglas como funciones puras permite probarlas sin base de datos y reutilizarlas en todos los endpoints.

---

## 4. Medidas de seguridad implementadas

| Medida | Implementación |
|--------|----------------|
| JWT en cookies HttpOnly | La sesión no se guarda en `localStorage` |
| Cookies `Secure` y `SameSite` | Configurables por entorno; `SameSite=Strict` por defecto |
| CSRF double submit | Cookie + header `X-CSRF-Token` en escrituras |
| Validación Zod | Cuerpos, parámetros y UUID en todos los endpoints de inventario |
| UUID como PK | No hay IDs secuenciales predecibles |
| Soft delete | Productos y categorías no se eliminan físicamente |
| `OperationLog` | Movimientos, reservas y liberaciones quedan auditados |
| Idempotencia | Evita reservas duplicadas por reintentos o carreras |
| Invariantes en PostgreSQL | CHECK constraints impiden disponibilidad negativa |
| Anti-enumeración | Respuestas genéricas heredadas de la autenticación de Etapa 2 |
| Errores controlados | No se exponen mensajes internos de Prisma al cliente |

---

## 5. Idempotencia como control de seguridad operativa

La creación de reservas exige `Idempotency-Key` (header) o `idempotencyKey` (body):

- Sin clave: `400 IDEMPOTENCY_KEY_REQUIRED`.
- Header y body distintos: `400 IDEMPOTENCY_KEY_MISMATCH`.
- Reintento idéntico: `200` con la misma reserva y `replayed: true`.
- Clave reutilizada con otro payload: `409 IDEMPOTENCY_KEY_REUSED`.
- La columna es `TEXT NOT NULL UNIQUE` y tiene un `CHECK` de contenido no vacío.

Esto evita que un reintento de red o un cliente mal implementado duplique reservas y consuma disponibilidad.

---

## 6. Integridad en base de datos

La migración `005_integridad_inventario` agrega 11 CHECK constraints, entre ellas:

- `quantityOnHand >= 0`
- `quantityReserved >= 0`
- `quantityOnHand >= quantityReserved`
- `minStockAlert >= 0`
- Estados de reserva válidos: `ACTIVE`, `RELEASED`, `EXPIRED`, `CONSUMED`
- Tipos de movimiento válidos: `ENTRY`, `EXIT`, `ADJUSTMENT`, `RESERVATION`, `RELEASE`
- `idempotencyKey` no vacía

La aplicación valida primero con reglas puras; PostgreSQL actúa como última defensa. Un error de constraint no se oculta ni se convierte en éxito.

---

## 7. Prácticas obligatorias para nuevas rutas

1. Validar sesión y rol **en el servidor**, nunca solo en el cliente.
2. Para inventario, usar `canAccessInventory()`; no `hasMinRole(..., "VENDEDOR")`.
3. Validar todo UUID con Zod antes de consultar.
4. Validar CSRF en `POST`, `PUT`, `PATCH` y `DELETE`.
5. Usar transacciones y respetar el orden de bloqueo `Inventory → InventoryReservation`.
6. Registrar la operación en `OperationLog` dentro de la misma transacción.
7. No devolver mensajes internos de Prisma ni trazas al cliente.
8. No usar `npm audit fix --force` ni desactivar reglas de lint para ocultar problemas.

---

## 8. Archivos relacionados

| Archivo | Responsabilidad |
|---------|-----------------|
| `middleware.ts` | Protección de rutas API y presencia de CSRF |
| `src/lib/roles.ts` | Reglas puras de roles e inventario |
| `src/lib/authz.ts` | `getAuthenticatedUser()` y re-exportación de reglas |
| `src/lib/session.ts` | Gestión de cookies y validación CSRF |
| `src/lib/validations.ts` | Esquemas Zod |
| `src/lib/inventory-rules.ts` | Invariantes de inventario |
| `src/lib/inventory-locks.ts` | Bloqueos de fila |
| `prisma/migrations/005_integridad_inventario/migration.sql` | Constraints y rol `INVENTARIO` |
| `tests/unit/roles.test.ts` | Pruebas de jerarquía y rol independiente |
| `tests/integration/inventory-api.test.ts` | Pruebas reales de autorización, concurrencia e idempotencia |
