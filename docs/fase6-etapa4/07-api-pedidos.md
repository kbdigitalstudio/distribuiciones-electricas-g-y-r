# 07 — API de pedidos

## Convenciones

- Base: `/api/orders`.
- Sesión HttpOnly y CSRF obligatorio en mutaciones.
- Importes en centavos COP, serializados como cadenas.
- El servidor calcula los totales; no se aceptan precios, descuentos, impuestos ni totales del cliente en pedidos directos.
- Crear un pedido no reserva ni descuenta inventario.

## Endpoints

| Método | Ruta | Rol permitido | CSRF |
|---|---|---|---|
| `GET` | `/api/orders` | ADMIN, VENDEDOR, CLIENTE (alcance propio) | No |
| `POST` | `/api/orders` | ADMIN, VENDEDOR | Sí |
| `GET` | `/api/orders/[id]` | ADMIN, VENDEDOR responsable, CLIENTE propietario | No |
| `PATCH` | `/api/orders/[id]` | ADMIN, VENDEDOR responsable | Sí |
| `POST` | `/api/orders/[id]/status` | ADMIN, VENDEDOR responsable | Sí |
| `GET` | `/api/orders/[id]/items` | ADMIN, VENDEDOR responsable, CLIENTE propietario | No |

No existe `DELETE /api/orders/[id]`. Los pedidos no se borran físicamente ni lógicamente desde la API.

## GET /api/orders

### Parámetros

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | entero | `1` | Positivo |
| `pageSize` | entero | `20` | Máximo `100` |
| `search` | texto | — | Número de pedido, nombre/razón social del cliente o número de cotización |
| `status` | enum | — | `PENDING_PAYMENT`, `PAID`, `FULFILLED`, `CANCELLED`, `REFUNDED` |
| `customerId` | UUID | — | Filtra por cliente |
| `quoteId` | UUID | — | Filtra por cotización de origen |
| `from` | ISO 8601 | — | `createdAt >= from` |
| `to` | ISO 8601 | — | `createdAt <= to` |

### Alcance

| Rol | Filtro |
|---|---|
| ADMIN | Sin restricción |
| VENDEDOR | `userId = usuario` |
| CLIENTE | `customer.userId = usuario` |
| INVENTARIO u otro | `403 FORBIDDEN` |

Orden: `createdAt` descendente.

### Respuesta 200

```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "PED-20261111-AB12CD34EF56",
      "status": "PENDING_PAYMENT",
      "customerId": "uuid",
      "customer": { "id": "uuid", "displayName": "Ana Uno" },
      "userId": "uuid",
      "responsable": { "id": "uuid", "nombre": "Vendedor Uno" },
      "quoteId": null,
      "quote": null,
      "subtotalCents": "24690",
      "taxCents": "0",
      "totalCents": "24690",
      "notes": null,
      "paymentMethod": null,
      "paymentReference": null,
      "paidAt": null,
      "items": [ { "...": "snapshot de línea" } ],
      "createdAt": "2026-11-11T00:00:00.000Z",
      "updatedAt": "2026-11-11T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

La clave de idempotencia nunca se serializa.

## POST /api/orders

Crea un pedido directo en estado `PENDING_PAYMENT`.

### Idempotencia

La clave se toma de:

1. Header `Idempotency-Key`, o
2. Campo `idempotencyKey` del cuerpo.

Reglas:

| Caso | Resultado |
|---|---|
| Sin clave | `400 IDEMPOTENCY_KEY_REQUIRED` |
| Header y cuerpo con valores distintos | `400 IDEMPOTENCY_KEY_MISMATCH` |
| Clave de más de 255 caracteres | `400 IDEMPOTENCY_KEY_INVALIDA` |
| Misma clave, mismo usuario, cliente y líneas | `200` con `created: false` y el pedido existente |
| Misma clave con datos distintos | `409 IDEMPOTENCY_KEY_REUTILIZADA` |

La comparación de líneas es por `productId` y `quantity`, sin importar el orden.

### Cuerpo

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `customerId` | UUID | Sí | Cliente activo y no eliminado |
| `idempotencyKey` | texto | Condicional | 1–255; alternativa al header |
| `notes` | texto | No | Máximo 5000 |
| `items` | arreglo | Sí | 1–100 |
| `items[].productId` | UUID | Sí | Producto activo y no eliminado |
| `items[].quantity` | entero | No | Default 1; positivo; máximo 1.000.000 |

### Precios

- Un pedido directo **solo** usa precio de catálogo vigente.
- No se acepta `unitPriceCents` en pedidos directos.
- Si un producto no tiene precio confirmado → `400 PRECIO_NO_CONFIRMADO`.
- Para vender un producto sin precio de catálogo debe crearse y convertirse una cotización con precio manual autorizado.
- El esquema del pedido directo no incluye `unitPriceCents`, por lo que cualquier intento de imponer precio se ignora o se rechaza por validación estricta del esquema.

### Inventario

- Se valida disponibilidad en modo lectura.
- Se considera `quantityOnHand - quantityReserved`.
- Si no alcanza → `400 STOCK_INSUFICIENTE`.
- Si el producto no tiene registro de inventario → error de disponibilidad.
- No se crea `InventoryReservation`.
- No se modifica `quantityOnHand` ni `quantityReserved`.

### Efectos transaccionales

Con bloqueo `Customer FOR SHARE`:

- Verifica cliente activo.
- Verifica idempotencia.
- Resuelve productos y precios.
- Valida stock.
- Genera número `PED-AAAAMMDD-<12 hex aleatorios>`.
- Inserta `Order`, `OrderItem`, `OrderStatusHistory` inicial y `OperationLog` `ORDER_CREATE`.

### Respuesta

- `201` si se creó.
- `200` si fue una repetición idempotente (`created: false`).

```json
{
  "success": true,
  "created": true,
  "order": { "...": "pedido con líneas" }
}
```

### Errores

| HTTP | Código | Causa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Esquema inválido |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Falta la clave |
| 400 | `IDEMPOTENCY_KEY_MISMATCH` | Header y cuerpo difieren |
| 400 | `IDEMPOTENCY_KEY_INVALIDA` | Clave demasiado larga |
| 400 | `CLIENTE_NO_DISPONIBLE` | Cliente inactivo, eliminado o inexistente |
| 400 | `PRODUCTO_NO_DISPONIBLE` | Producto no disponible |
| 400 | `PRODUCTO_DUPLICADO` | Producto repetido |
| 400 | `PRECIO_NO_CONFIRMADO` | Producto sin precio de catálogo |
| 400 | `STOCK_INSUFICIENTE` | Disponibilidad insuficiente |
| 403 | `CSRF_INVALID` / `FORBIDDEN` | CSRF o rol |
| 409 | `IDEMPOTENCY_KEY_REUTILIZADA` | Clave usada con otros datos |
| 409 | `REGISTRO_DUPLICADO` | Conflicto de unicidad no atribuible a la clave |
| 500 | `INTERNAL_ERROR` | Error no controlado |

## GET /api/orders/[id]

Devuelve el pedido con líneas e historial:

```json
{
  "success": true,
  "order": {
    "...": "campos del pedido",
    "items": [],
    "statusHistory": [
      {
        "id": "uuid",
        "fromStatus": null,
        "toStatus": "PENDING_PAYMENT",
        "changedBy": "uuid",
        "reason": "Creación del pedido",
        "createdAt": "2026-11-11T00:00:00.000Z"
      }
    ]
  }
}
```

- ID inválido → `400 ID_INVALIDO`.
- Inexistente o no autorizado → `404 PEDIDO_NO_ENCONTRADO`.

## PATCH /api/orders/[id]

### Cuerpo

```json
{ "notes": "Entregar en obra" }
```

- Solo `notes`; máximo 5000; acepta `null`.
- Debe enviarse al menos un campo.

### Reglas

1. Solo ADMIN o el VENDEDOR responsable.
2. Solo pedidos en `PENDING_PAYMENT`.
3. Registra `OperationLog` `ORDER_UPDATE`.
4. No permite cambiar líneas, precios, totales, cliente, estado ni campos de pago.

### Errores

| HTTP | Código | Causa |
|---|---|---|
| 404 | `PEDIDO_NO_ENCONTRADO` | No existe |
| 403 | `FORBIDDEN` | No es responsable |
| 409 | `PEDIDO_NO_EDITABLE` | Estado distinto de `PENDING_PAYMENT` |

## POST /api/orders/[id]/status

### Cuerpo

```json
{ "status": "CANCELLED", "reason": "Solicitud del cliente" }
```

### Transiciones efectivas

```
PENDING_PAYMENT → CANCELLED
PAID            → FULFILLED | REFUNDED   (no alcanzable por API)
FULFILLED       → REFUNDED              (no alcanzable por API)
CANCELLED       → terminal
REFUNDED        → terminal
```

Reglas:

1. `PAID` y `REFUNDED` se rechazan siempre con `409 PAGO_NO_AUTORIZADO`.
2. Repetir el estado actual → `409 SIN_CAMBIO_DE_ESTADO`.
3. Transición no listada → `409 TRANSICION_INVALIDA`.
4. La única transición ejecutable es `PENDING_PAYMENT → CANCELLED`.
5. Se registra `OrderStatusHistory` y `OperationLog` `ORDER_STATUS_CHANGE` en la misma transacción con bloqueo `FOR UPDATE`.

### Por qué no se puede marcar PAID

No existe pasarela de pagos, conciliación, facturación electrónica ni integración autorizada. Permitir `PAID` sin una fuente de verdad de pago produciría estados comerciales falsos. Los campos `paymentMethod`, `paymentReference` y `paidAt` se conservan como referencia histórica y la API no los establece.

## GET /api/orders/[id]/items

```json
{
  "success": true,
  "orderId": "uuid",
  "items": [ { "...": "snapshot inmutable de línea" } ]
}
```

- Las líneas de pedido no tienen borrado lógico ni edición.
- Se ordenan por `id` ascendente.

## Idempotencia y concurrencia

- `Order.idempotencyKey` es único.
- `Order.quoteId` es único.
- Ante dos creaciones simultáneas con la misma clave:
  - Una transacción inserta.
  - Las demás detectan la clave o el conflicto `P2002`.
  - Si el payload coincide, devuelven el mismo pedido con `200`.
  - Si no coincide, devuelven `409`.
- La prueba de integración ejecuta 6 creaciones concurrentes con la misma clave y verifica exactamente 1 pedido y 1 respuesta `201`, con 5 respuestas `200`.

## Ejemplo de pedido directo

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 7f1c2a9e-orden-001" \
  -H "x-csrf-token: $CSRF" \
  -b "gyr_session=$SESSION; gyr_csrf_token=$CSRF" \
  -d '{
    "customerId": "11111111-1111-4111-8111-111111111111",
    "notes": "Entrega en obra",
    "items": [
      { "productId": "22222222-2222-4222-8222-222222222222", "quantity": 2 }
    ]
  }'
```

## Evidencia

- Implementación: `src/app/api/orders/route.ts`, `src/app/api/orders/[id]/route.ts`, `[id]/status/route.ts`, `[id]/items/route.ts`.
- Reglas: `src/lib/commercial.ts`, `src/lib/commercial-items.ts`, `src/lib/commercial-locks.ts`.
- Pruebas: 7 casos de pedidos en `tests/integration/commercial-api.test.ts`, incluidos idempotencia, concurrencia, alcance y estados.
