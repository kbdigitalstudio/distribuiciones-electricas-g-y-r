# 06 — API de cotizaciones

## Convenciones

- Base: `/api/quotes`.
- Sesión HttpOnly y CSRF obligatorio en todas las mutaciones.
- Importes en centavos COP enteros y serializados como cadenas decimales.
- El servidor calcula subtotal, impuestos y total. El cliente no puede enviar totales.
- No se aceptan descuentos ni impuestos enviados por el cliente.

## Endpoints

| Método | Ruta | Rol permitido | CSRF |
|---|---|---|---|
| `GET` | `/api/quotes` | ADMIN, VENDEDOR, CLIENTE (alcance propio) | No |
| `POST` | `/api/quotes` | ADMIN, VENDEDOR | Sí |
| `GET` | `/api/quotes/[id]` | ADMIN, VENDEDOR responsable, CLIENTE propietario | No |
| `PATCH` | `/api/quotes/[id]` | ADMIN, VENDEDOR responsable | Sí |
| `POST` | `/api/quotes/[id]/status` | ADMIN, VENDEDOR responsable | Sí |
| `GET` | `/api/quotes/[id]/items` | ADMIN, VENDEDOR responsable, CLIENTE propietario | No |
| `POST` | `/api/quotes/[id]/convert` | ADMIN, VENDEDOR responsable | Sí |

La conversión se documenta en `08-conversion-cotizacion-pedido.md`.

## GET /api/quotes

### Parámetros

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | entero | `1` | Positivo |
| `pageSize` | entero | `20` | Máximo `100` |
| `search` | texto | — | Máximo 100; número de cotización o nombre/razón social del cliente |
| `status` | enum | — | `DRAFT`, `SENT`, `ACCEPTED`, `EXPIRED`, `CANCELLED` |
| `customerId` | UUID | — | Filtra por cliente |
| `from` | ISO 8601 | — | `createdAt >= from` |
| `to` | ISO 8601 | — | `createdAt <= to` |

### Alcance

| Rol | Filtro |
|---|---|
| ADMIN | Sin restricción |
| VENDEDOR | `userId = usuario` (responsable) |
| CLIENTE | `customer.userId = usuario` |
| INVENTARIO u otro | `403 FORBIDDEN` |

Orden: `createdAt` descendente. Cada cotización incluye sus líneas activas.

### Respuesta 200

```json
{
  "success": true,
  "quotes": [
    {
      "id": "uuid",
      "quoteNumber": "COT-20261111-9F3A1C7B2D4E",
      "status": "DRAFT",
      "customerId": "uuid",
      "customer": { "id": "uuid", "displayName": "Ana Uno" },
      "userId": "uuid",
      "responsable": { "id": "uuid", "nombre": "Vendedor Uno" },
      "subtotalCents": "24690",
      "taxCents": "0",
      "totalCents": "24690",
      "validUntil": "2026-11-18T00:00:00.000Z",
      "isExpired": false,
      "notes": null,
      "items": [
        {
          "id": "uuid",
          "productId": "uuid",
          "priceId": "uuid",
          "productName": "Cable de prueba",
          "productSku": "CAB-001",
          "productSlug": "cable-de-prueba",
          "currency": "COP",
          "pricingSource": "CATALOG",
          "quantity": 2,
          "unitPriceCents": "12345",
          "subtotalCents": "24690",
          "deletedAt": null,
          "createdAt": "2026-11-11T00:00:00.000Z",
          "updatedAt": "2026-11-11T00:00:00.000Z"
        }
      ],
      "createdAt": "2026-11-11T00:00:00.000Z",
      "updatedAt": "2026-11-11T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

## POST /api/quotes

Crea una cotización en estado `DRAFT`.

### Cuerpo

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `customerId` | UUID | Sí | Cliente activo y no eliminado |
| `validUntil` | ISO 8601 con offset | Sí | Debe ser futuro |
| `notes` | texto | No | Máximo 5000 |
| `items` | arreglo | Sí | 1–100 líneas |
| `items[].productId` | UUID | Sí | Producto activo y no eliminado |
| `items[].quantity` | entero | No | Default 1; positivo; máximo 1.000.000 |
| `items[].unitPriceCents` | entero o cadena | No | Precio manual en centavos; solo si no hay precio de catálogo |

### Reglas de líneas

1. No se permite repetir el mismo `productId` en una cotización (`PRODUCTO_DUPLICADO`).
2. El producto debe existir, estar activo y no eliminado (`PRODUCTO_NO_DISPONIBLE`).
3. Se busca el precio de catálogo vigente:
   - `Price.isActive = true`
   - `Price.validFrom <= ahora`
   - `Price.validTo` nulo o futuro
   - Se toma el `validFrom` más reciente.
4. Si existe precio de catálogo:
   - Se usa ese precio y `pricingSource = CATALOG`.
   - Si el cliente envía `unitPriceCents`, se rechaza con `PRECIO_MANUAL_NO_PERMITIDO`.
5. Si no existe precio de catálogo:
   - Sin `unitPriceCents` → `PRECIO_NO_CONFIRMADO`.
   - Con `unitPriceCents` autorizado → `pricingSource = MANUAL`, `priceId = null`.
6. Los importes se calculan con aritmética `BigInt`.
7. Se guardan snapshots de nombre, SKU, slug y moneda.
8. Los totales se calculan en el servidor: `taxCents = 0`, `totalCents = subtotalCents`.

### Efectos transaccionales

En una sola transacción:

- Inserta `Quote` en `DRAFT`.
- Inserta las líneas `QuoteItem`.
- Inserta `QuoteStatusHistory` con `fromStatus = null`, `toStatus = DRAFT`.
- Inserta `OperationLog` `QUOTE_CREATE`.

El número se genera como `COT-AAAAMMDD-<12 hex aleatorios>`, no secuencial.

### Respuesta 201

```json
{
  "success": true,
  "quote": { "...": "cotización con líneas e isExpired" }
}
```

### Errores

| HTTP | Código | Causa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Esquema inválido |
| 400 | `VENCIMIENTO_INVALIDO` | `validUntil` no es futuro |
| 400 | `CLIENTE_NO_DISPONIBLE` | Cliente inexistente, inactivo o eliminado |
| 400 | `PRODUCTO_NO_DISPONIBLE` | Producto inexistente, inactivo o eliminado |
| 400 | `PRODUCTO_DUPLICADO` | Producto repetido |
| 400 | `PRECIO_NO_CONFIRMADO` | Sin precio de catálogo y sin precio manual |
| 400 | `PRECIO_MANUAL_NO_PERMITIDO` | Se envió precio manual existiendo catálogo |
| 400 | `CANTIDAD_INVALIDA` / `PRECIO_INVALIDO` | Valores fuera de regla |
| 400 | `IMPORTE_FUERA_DE_RANGO` | Excede el máximo permitido |
| 403 | `CSRF_INVALID` / `FORBIDDEN` | CSRF o rol |
| 500 | `INTERNAL_ERROR` | Error no controlado |

## GET /api/quotes/[id]

Devuelve la cotización con líneas activas e historial de estados:

```json
{
  "success": true,
  "quote": {
    "...": "campos de la cotización",
    "items": [],
    "statusHistory": [
      {
        "id": "uuid",
        "fromStatus": null,
        "toStatus": "DRAFT",
        "changedBy": "uuid",
        "reason": "Creación de la cotización",
        "createdAt": "2026-11-11T00:00:00.000Z"
      }
    ]
  }
}
```

- Un ID no UUID responde `400 ID_INVALIDO` sin consultar la base.
- Si no existe o no está autorizada, responde `404 COTIZACION_NO_ENCONTRADA`.
- El `404` se usa también para cotizaciones de otro vendedor u otro cliente.

## PATCH /api/quotes/[id]

### Cuerpo

Al menos uno de:

| Campo | Reglas |
|---|---|
| `validUntil` | ISO 8601 futuro |
| `notes` | Texto hasta 5000 o `null` |
| `items` | Arreglo 1–100; reemplaza las líneas activas |

### Reglas

1. Solo `DRAFT`.
2. No debe estar vencida.
3. Solo ADMIN o el VENDEDOR responsable.
4. Si se envían líneas:
   - Se validan con las mismas reglas del alta.
   - Las líneas activas anteriores reciben `deletedAt` (borrado lógico).
   - Se crean líneas nuevas con snapshots y precios recalculados.
   - Se actualizan los totales.
5. No se puede cambiar el estado por esta ruta.
6. Se registra `OperationLog` `QUOTE_UPDATE`.

### Errores

| HTTP | Código | Causa |
|---|---|---|
| 404 | `COTIZACION_NO_ENCONTRADA` | No existe |
| 403 | `FORBIDDEN` | No es responsable |
| 409 | `COTIZACION_NO_EDITABLE` | No está en `DRAFT` |
| 409 | `COTIZACION_VENCIDA` | `validUntil` ya pasó |
| 400 | `VENCIMIENTO_INVALIDO` | Nueva fecha no futura |
| 400 | Errores de línea | Igual que el alta |

## GET /api/quotes/[id]/items

- Sin parámetros: solo líneas activas (`deletedAt = null`).
- `?includeDeleted=true`: devuelve también las líneas reemplazadas, ordenadas por `createdAt`.
- Requiere lectura autorizada de la cotización.

```json
{
  "success": true,
  "quoteId": "uuid",
  "items": [ { "...": "snapshot de línea" } ]
}
```

## POST /api/quotes/[id]/status

### Cuerpo

```json
{ "status": "SENT", "reason": "Enviada al cliente por correo" }
```

- `status`: obligatorio, uno de los cinco estados.
- `reason`: opcional, máximo 1000.

### Transiciones

```
DRAFT     → SENT | CANCELLED
SENT      → ACCEPTED | EXPIRED | CANCELLED
ACCEPTED  → (terminal)
EXPIRED   → (terminal)
CANCELLED → (terminal)
```

Reglas adicionales:

1. Repetir el estado actual → `409 SIN_CAMBIO_DE_ESTADO`.
2. Transición no listada → `409 TRANSICION_INVALIDA`.
3. `SENT` o `ACCEPTED` con vigencia vencida → `409 COTIZACION_VENCIDA`.
4. `EXPIRED` con vigencia aún activa → `409 COTIZACION_VIGENTE`.
5. `CANCELLED` si ya existe un pedido originado → `409 COTIZACION_CON_PEDIDO`.
6. Un borrador vencido no puede pasar directamente a `EXPIRED` porque la tabla solo permite `SENT → EXPIRED`; puede cancelarse. Ver `13-problemas-pendientes.md`.

### Efectos

En una transacción con bloqueo `FOR UPDATE`:

- Actualiza `Quote.status`.
- Inserta `QuoteStatusHistory`.
- Inserta `OperationLog` `QUOTE_STATUS_CHANGE`.
- Devuelve la cotización con historial.

## Ejemplo de creación

```bash
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "gyr_session=$SESSION; gyr_csrf_token=$CSRF" \
  -d '{
    "customerId": "11111111-1111-4111-8111-111111111111",
    "validUntil": "2026-11-30T23:59:59.000Z",
    "notes": "Entrega en obra",
    "items": [
      { "productId": "22222222-2222-4222-8222-222222222222", "quantity": 2 }
    ]
  }'
```

## Evidencia

- Implementación: `src/app/api/quotes/route.ts`, `src/app/api/quotes/[id]/route.ts`, `[id]/status/route.ts`, `[id]/items/route.ts`.
- Reglas: `src/lib/commercial.ts`, `src/lib/commercial-items.ts`.
- Serialización: `src/lib/commercial-serializers.ts`.
- Pruebas: 7 casos de cotizaciones en `tests/integration/commercial-api.test.ts`; 19 reglas monetarias/estado en `tests/unit/commercial-rules.test.ts`; 10 reglas de líneas en `tests/unit/commercial-items.test.ts`.
