# 06. API de Inventario

- **Estado:** vigente para la Etapa 3 corregida (11 de noviembre de 2026).
- **Autorización:** todas las operaciones requieren rol `INVENTARIO` o `ADMIN`; `VENDEDOR` no tiene acceso implícito.

---

## 1. Endpoints implementados

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/inventory` | Consultar inventario general, paginado | `INVENTARIO` / `ADMIN` |
| GET | `/api/inventory/[productId]` | Consultar inventario de un producto | `INVENTARIO` / `ADMIN` |
| GET | `/api/inventory/movements` | Consultar historial de movimientos | `INVENTARIO` / `ADMIN` |
| POST | `/api/inventory/movements` | Registrar movimiento de inventario | `INVENTARIO` / `ADMIN` |
| POST | `/api/inventory/reservations` | Crear reserva idempotente | `INVENTARIO` / `ADMIN` |
| DELETE | `/api/inventory/reservations/[id]` | Liberar una reserva activa | `INVENTARIO` / `ADMIN` |

Todos los handlers verifican la sesión y el rol en el servidor con `getAuthenticatedUser()` y `canAccessInventory()`. Los métodos de escritura validan además el token CSRF (`X-CSRF-Token`, double submit cookie).

---

## 2. Rol `INVENTARIO`

`INVENTARIO` es un rol funcional independiente, no un nivel de la jerarquía `CLIENTE < VENDEDOR < ADMIN`.

```ts
INVENTORY_ROLES = ["INVENTARIO", "ADMIN"]
canAccessInventory(roles) = roles incluye "INVENTARIO" o "ADMIN"
```

- `ADMIN` conserva acceso completo.
- `VENDEDOR` conserva su nivel jerárquico, pero **no** accede al inventario salvo que además tenga el rol `INVENTARIO`.
- El rol se crea en la migración `005_integridad_inventario` y se asigna explícitamente a los usuarios que lo necesiten.

No se debe volver a mapear `INVENTARIO` a `VENDEDOR`: fue una corrección de permisos deliberada.

---

## 3. Consulta de inventario

### `GET /api/inventory`

Parámetros de consulta:

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | entero positivo | Página, por defecto 1 |
| `pageSize` | entero positivo, máximo 100 | Tamaño de página, por defecto 20 |
| `lowStock` | `"true"` | Filtra `quantityOnHand <= minStockAlert` |

La paginación se valida con `PaginationSchema`. El filtro `lowStock` se resuelve en SQL y afecta tanto a los elementos devueltos como a `pagination.total`.

Respuesta:

```json
{
  "success": true,
  "inventory": [
    {
      "id": "uuid",
      "product": {
        "id": "uuid",
        "slug": "slug",
        "name": "Nombre",
        "category": { "name": "Categoría" }
      },
      "quantityOnHand": 10,
      "quantityReserved": 2,
      "availableQuantity": 8,
      "minStockAlert": 3,
      "isLowStock": false,
      "updatedAt": "2026-11-11T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /api/inventory/[productId]`

Devuelve el inventario del producto o `404 INVENTARIO_NO_ENCONTRADO`.

---

## 4. Movimientos de inventario

### `POST /api/inventory/movements`

Cuerpo validado con `RecordInventoryMovementSchema`:

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| `productId` | UUID | Sí |
| `movementType` | `ENTRY`, `EXIT`, `ADJUSTMENT`, `RESERVATION`, `RELEASE` | Sí |
| `quantity` | entero positivo | Sí |
| `reason` | texto de 1 a 255 caracteres | Sí |
| `reference` | texto de hasta 255 caracteres | No |

### Tipos y reglas

| Tipo | Efecto en `quantityOnHand` | Efecto en `quantityReserved` | Regla |
|------|----------------------------|------------------------------|-------|
| `ENTRY` | Incrementa | Sin cambio | Cantidad positiva |
| `EXIT` | Decrementa | Sin cambio | Solo consume disponibilidad libre; rechaza afectar stock reservado |
| `ADJUSTMENT` | Se fija al valor indicado | Sin cambio | No puede quedar por debajo de `quantityReserved` |
| `RESERVATION` | Sin cambio | Incrementa | Rechaza si `available < quantity` |
| `RELEASE` | Sin cambio | Decrementa | Rechaza liberar más de lo reservado |

Invariante:

```
quantityOnHand >= quantityReserved >= 0
```

### Transacción

1. `SELECT ... FOR UPDATE` sobre `Inventory` (orden global: inventario primero).
2. Lectura del estado actual.
3. Aplicación de `applyInventoryMovement()`.
4. Actualización de existencias.
5. Creación de `InventoryMovement`.
6. Creación de `OperationLog`.

Todo ocurre en una sola transacción `ReadCommitted` con `timeout: 15000` y `maxWait: 10000`. Un timeout (`P2028`) devuelve `503 TRANSACTION_TIMEOUT`.

### `GET /api/inventory/movements`

Parámetros: `page`, `pageSize`, `productId`, `movementType`. Devuelve historial paginado con producto y usuario que registró el movimiento.

---

## 5. Reservas de inventario

### `POST /api/inventory/reservations`

Cuerpo validado con `CreateInventoryReservationSchema`:

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| `productId` | UUID | Sí |
| `quantity` | entero positivo | Sí |
| `reference` | texto de hasta 255 caracteres | No |
| `expiresAt` | fecha ISO 8601 | No |
| `idempotencyKey` | texto de 1 a 255 caracteres | Sí, salvo que se envíe el header |

### Idempotencia obligatoria

La clave se envía en el header `Idempotency-Key` o en el campo `idempotencyKey` del cuerpo. Si se envían ambos, deben coincidir.

| Situación | HTTP | Código |
|-----------|------|--------|
| Sin clave | `400` | `IDEMPOTENCY_KEY_REQUIRED` |
| Header y body distintos | `400` | `IDEMPOTENCY_KEY_MISMATCH` |
| Primera creación | `201` | `success: true`, `replayed: false` |
| Reintento idéntico | `200` | `success: true`, `replayed: true`, misma reserva |
| Clave reutilizada con otro payload | `409` | `IDEMPOTENCY_KEY_REUSED` |
| Carrera perdida por `UNIQUE` (`P2002`) | `200` o `409` | Replay si el payload coincide; error si no |
| Timeout (`P2028`) | `503` | `TRANSACTION_TIMEOUT` |

La comparación incluye `productId`, `quantity`, `reference` y `expiresAt`. Las claves son globalmente únicas; el cliente debe generar una clave nueva por operación.

### Concurrencia

1. Camino rápido: búsqueda por `idempotencyKey` fuera de la transacción.
2. `SELECT ... FOR UPDATE` sobre `Inventory`.
3. Revalidación de idempotencia dentro de la transacción.
4. Lectura de inventario y aplicación de `reserveInventory()`.
5. Creación de la reserva, actualización de `quantityReserved` y `OperationLog` en la misma transacción.

La restricción `UNIQUE` de `idempotencyKey` es la última defensa ante dos transacciones simultáneas.

### `DELETE /api/inventory/reservations/[id]`

1. Valida que `id` sea UUID.
2. Lee `productId` de la reserva.
3. Bloquea `Inventory` y luego `InventoryReservation` (orden global).
4. Relee la reserva y exige estado `ACTIVE`.
5. Aplica `releaseInventory()`; no usa clamp para ocultar inconsistencias.
6. Actualiza `quantityReserved`, marca `RELEASED`, registra `releasedAt` y `OperationLog`.

| Situación | HTTP | Código |
|-----------|------|--------|
| UUID inválido | `400` | `VALIDATION_ERROR` |
| Reserva inexistente | `404` | `RESERVA_NO_ENCONTRADA` |
| Reserva no activa | `400` | `RESERVA_NO_ACTIVA` |
| Inventario inconsistente | `409` | `INVENTARIO_INCONSISTENTE` |
| Liberación correcta | `200` | `success: true` |

Dos liberaciones simultáneas de la misma reserva producen exactamente una liberación efectiva.

---

## 6. Concurrencia y orden de bloqueo

Orden global obligatorio:

```
1. Inventory (por productId)
2. InventoryReservation (por id)
```

Helpers: `src/lib/inventory-locks.ts`.

Ninguna operación debe bloquear una reserva antes que el inventario del que depende. Las transacciones usan `ReadCommitted`; la consistencia se garantiza con bloqueos de fila y la restricción `UNIQUE` de idempotencia.

---

## 7. Códigos de error relevantes

| Código | HTTP | Significado |
|--------|------|-------------|
| `FORBIDDEN` | 403 | El usuario no tiene `INVENTARIO` ni `ADMIN` |
| `CSRF_INVALID` | 403 | Token CSRF ausente o inválido |
| `VALIDATION_ERROR` | 400 | Datos o UUID inválidos |
| `STOCK_INSUFICIENTE` | 400 | No hay disponibilidad suficiente |
| `CANTIDAD_RESERVADA_INSUFICIENTE` | 400 | Se intenta liberar más de lo reservado |
| `INVENTARIO_INCONSISTENTE` | 409 | El estado físico y el reservado no coinciden |
| `INVENTARIO_NO_ENCONTRADO` | 404 | No existe fila de inventario para el producto |
| `RESERVA_NO_ENCONTRADA` | 404 | No existe la reserva |
| `RESERVA_NO_ACTIVA` | 400 | La reserva ya fue liberada o no está activa |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | Falta la clave de idempotencia |
| `IDEMPOTENCY_KEY_MISMATCH` | 400 | Header y body no coinciden |
| `IDEMPOTENCY_KEY_REUSED` | 409 | La clave se usó con otro payload |
| `TRANSACTION_TIMEOUT` | 503 | Timeout por concurrencia; reintentar con la misma clave |
| `INTERNAL_ERROR` | 500 | Error no controlado |

---

## 8. Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/inventory/route.ts` | GET listar inventario con filtro `lowStock` y paginación |
| `src/app/api/inventory/[productId]/route.ts` | GET inventario de producto |
| `src/app/api/inventory/movements/route.ts` | GET historial, POST registrar movimiento |
| `src/app/api/inventory/reservations/route.ts` | POST crear reserva idempotente |
| `src/app/api/inventory/reservations/[id]/route.ts` | DELETE liberar reserva |
| `src/lib/inventory-rules.ts` | Reglas puras de cantidades |
| `src/lib/inventory-locks.ts` | Bloqueos `FOR UPDATE` y orden global |
| `src/lib/inventory-serializers.ts` | Serialización de reservas |
| `src/lib/roles.ts` | `canAccessInventory()` y jerarquía de roles |
| `src/lib/validations.ts` | Esquemas Zod de movimientos y reservas |
| `prisma/migrations/005_integridad_inventario/migration.sql` | Idempotencia, CHECK constraints y rol `INVENTARIO` |
