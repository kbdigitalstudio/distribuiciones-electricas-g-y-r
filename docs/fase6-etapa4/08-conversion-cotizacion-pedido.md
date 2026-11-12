# 08 — Conversión cotización → pedido

## Endpoint

```
POST /api/quotes/[id]/convert
```

- Roles: ADMIN o VENDEDOR responsable de la cotización.
- CSRF obligatorio.
- Cuerpo opcional:

```json
{
  "idempotencyKey": "opcional-si-se-envía-en-el-header",
  "notes": "Observaciones del pedido"
}
```

La clave también puede enviarse en el header `Idempotency-Key`. Si ambos existen y difieren → `400 IDEMPOTENCY_KEY_MISMATCH`.

## Precondiciones

| Condición | Error si falla |
|---|---|
| ID UUID válido | `400 ID_INVALIDO` |
| Cotización existente | `404 COTIZACION_NO_ENCONTRADA` |
| Actor autorizado | `403 FORBIDDEN` |
| Sin pedido previo para esa cotización | `409 COTIZACION_YA_CONVERTIDA` |
| Estado `SENT` vigente o `ACCEPTED` | `409 COTIZACION_NO_CONVERTIBLE` |
| `SENT` no vencida | `409 COTIZACION_VENCIDA` |
| Al menos una línea activa | `409 SIN_LINEAS` |
| Cantidades enteras positivas | `409 CANTIDAD_INVALIDA` |
| Precios no negativos | `409 PRECIO_INVALIDO` |
| Subtotal de línea = precio × cantidad | `409 TOTALES_INCONSISTENTES` |
| Subtotal de cotización = suma de líneas | `409 TOTALES_INCONSISTENTES` |
| Total = subtotal + impuestos | `409 TOTALES_INCONSISTENTES` |
| Productos activos y no eliminados | `409 PRODUCTO_NO_DISPONIBLE` |
| Stock disponible (solo lectura) | `400 STOCK_INSUFICIENTE` |

Una cotización `ACCEPTED` puede convertirse aunque su `validUntil` ya haya pasado: la aceptación registrada es la decisión comercial. Una cotización `SENT` vencida no puede convertirse.

## Flujo atómico

Todo ocurre dentro de una transacción `ReadCommitted` con `SELECT ... FOR UPDATE` sobre la cotización:

1. Bloquear la fila `Quote`.
2. Cargar la cotización con sus líneas activas.
3. Autorizar al actor.
4. Resolver idempotencia:
   - Si la clave ya existe y pertenece a la misma cotización y al mismo usuario → devolver el pedido existente con `created: false`.
   - Si la clave existe para otra operación → `409 IDEMPOTENCY_KEY_REUTILIZADA`.
5. Verificar que la cotización no tenga pedido previo (`Order.quoteId` único).
6. Validar estado y vencimiento.
7. Validar consistencia de cantidades, precios y totales.
8. Verificar productos activos.
9. Validar stock disponible en modo lectura.
10. Generar número `PED-AAAAMMDD-<12 hex aleatorios>`.
11. Crear `Order` con:
    - `customerId` de la cotización.
    - `userId` del actor que convierte.
    - `quoteId` de la cotización.
    - `idempotencyKey`.
    - `status = PENDING_PAYMENT`.
    - `subtotalCents`, `taxCents`, `totalCents` copiados de la cotización.
    - `notes`: las del cuerpo si existen; si no, las de la cotización.
12. Copiar las líneas a `OrderItem` conservando:
    - `productId`, `priceId`, `productName`, `productSku`, `productSlug`.
    - `currency`, `pricingSource`, `quantity`.
    - `unitPriceCents`, `subtotalCents`.
13. Insertar `OrderStatusHistory` inicial con motivo de conversión.
14. Insertar `OperationLog` `QUOTE_CONVERT_TO_ORDER`.
15. Confirmar la transacción y devolver el pedido.

## Qué se conserva

- Precios y cantidades exactos de la cotización.
- Snapshots de producto y moneda.
- Origen del precio (`CATALOG` o `MANUAL`).
- Totales.
- Vínculo `quoteId`.
- Observaciones, si se enviaron.

La conversión **no vuelve a consultar el precio actual del catálogo**. Un cambio posterior de precio no altera el pedido.

## Qué no hace

- No reserva inventario.
- No descuenta `quantityOnHand`.
- No modifica `quantityReserved`.
- No crea `InventoryReservation`.
- No aplica descuentos.
- No calcula impuestos.
- No cambia el estado de la cotización.
- No envía correos ni notificaciones.
- No crea pagos ni facturas.

La cotización `SENT` sigue en `SENT` después de originar el pedido; el vínculo queda en `Order.quoteId`. Esta decisión se documenta para confirmación comercial.

## Idempotencia

| Caso | Resultado |
|---|---|
| Misma clave, misma cotización, mismo usuario | `200`, `created: false`, mismo pedido |
| Misma clave usada en otra cotización u operación | `409 IDEMPOTENCY_KEY_REUTILIZADA` |
| Clave distinta, cotización ya convertida | `409 COTIZACION_YA_CONVERTIDA` |
| Sin clave | `400 IDEMPOTENCY_KEY_REQUIRED` |

La protección tiene dos capas:

1. Verificación dentro de la transacción.
2. Restricciones únicas `Order.idempotencyKey` y `Order.quoteId`, con recuperación ante `P2002`.

## Concurrencia

El bloqueo `FOR UPDATE` serializa las conversiones de una misma cotización.

Evidencia real de la suite de integración:

- 5 conversiones concurrentes con la misma clave:
  - exactamente 1 respuesta `201`;
  - 4 respuestas `200` con el mismo pedido;
  - 1 solo pedido en base.
- 5 conversiones concurrentes con claves distintas:
  - exactamente 1 respuesta `201`;
  - 4 respuestas `409 COTIZACION_YA_CONVERTIDA`;
  - 1 solo pedido en base.

## Rollback

Si cualquiera de los pasos falla, la transacción revierte completamente:

- No queda pedido huérfano.
- No quedan líneas sin pedido.
- No queda historial sin documento.
- No queda log de una operación no confirmada.

## Cancelación posterior

Una cotización que ya originó un pedido no puede cancelarse:

```
POST /api/quotes/[id]/status  { "status": "CANCELLED" }
→ 409 COTIZACION_CON_PEDIDO
```

Esto evita inconsistencias entre un pedido existente y una cotización cancelada.

## Ejemplo

```bash
curl -X POST http://localhost:3000/api/quotes/$QUOTE_ID/convert \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: conversion-$QUOTE_ID" \
  -H "x-csrf-token: $CSRF" \
  -b "gyr_session=$SESSION; gyr_csrf_token=$CSRF" \
  -d '{ "notes": "Conversión autorizada por el cliente" }'
```

Respuesta:

```json
{
  "success": true,
  "created": true,
  "order": {
    "id": "uuid",
    "orderNumber": "PED-20261111-AB12CD34EF56",
    "status": "PENDING_PAYMENT",
    "quoteId": "uuid",
    "quote": { "id": "uuid", "quoteNumber": "COT-20261111-..." },
    "subtotalCents": "24690",
    "taxCents": "0",
    "totalCents": "24690",
    "items": []
  }
}
```

## Evidencia

- Implementación: `src/app/api/quotes/[id]/convert/route.ts`.
- Reglas de transición y números: `src/lib/commercial.ts`.
- Stock de solo lectura: `src/lib/commercial-items.ts`.
- Bloqueo: `src/lib/commercial-locks.ts`.
- Pruebas: 6 casos del bloque “conversión cotización → pedido” en `tests/integration/commercial-api.test.ts`.
