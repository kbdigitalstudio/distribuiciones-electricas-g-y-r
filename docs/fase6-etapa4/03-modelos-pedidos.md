# 03 — Modelos de pedidos

## Alcance

Se reutilizan `Order` y `OrderItem`. Se agregaron idempotencia, unicidad de conversión, snapshots de producto, observaciones e historial explícito de estados. No se creó un modelo paralelo ni se modificó el flujo de pagos.

## Modelo `Order`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `customerId` | UUID | Cliente |
| `userId` | UUID | Vendedor o administrador responsable |
| `orderNumber` | Texto único | Número no secuencial `PED-AAAAMMDD-<12 hex>` |
| `quoteId` | UUID único nulo | Cotización de origen; único para impedir doble conversión |
| `idempotencyKey` | Texto único nulo | Clave de idempotencia de creación |
| `status` | `OrderStatus` | `PENDING_PAYMENT`, `PAID`, `FULFILLED`, `CANCELLED`, `REFUNDED` |
| `subtotalCents` | BigInt | Subtotal en centavos COP |
| `taxCents` | BigInt | Impuestos; hoy siempre `0` |
| `totalCents` | BigInt | Total; hoy igual al subtotal |
| `notes` | Texto nulo | Observaciones |
| `paymentMethod` | Texto nulo | Referencia histórica; no se establece por API |
| `paymentReference` | Texto nulo | Referencia histórica; no se establece por API |
| `paidAt` | Timestamp nulo | Marca histórica; no se establece por API |
| `createdAt` / `updatedAt` | Timestamp | Auditoría temporal |

### Relaciones

- `customer`: cliente del pedido.
- `user`: responsable.
- `quote`: cotización de origen opcional.
- `items`: líneas del pedido.
- `statusHistory`: historial de transiciones.

## Modelo `OrderItem`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `orderId` | UUID | Pedido |
| `productId` | UUID | Producto |
| `priceId` | UUID nulo | Precio de catálogo usado; nulo si proviene de precio manual |
| `productName` | Texto nulo | Snapshot del nombre |
| `productSku` | Texto nulo | Snapshot del SKU |
| `productSlug` | Texto nulo | Snapshot del slug |
| `currency` | Texto(3) nulo | Moneda del snapshot |
| `pricingSource` | `PricingSource` | `CATALOG` o `MANUAL` |
| `quantity` | Entero | Cantidad positiva |
| `unitPriceCents` | BigInt | Precio unitario histórico |
| `subtotalCents` | BigInt | `unitPriceCents * quantity` |

No tiene borrado lógico: las líneas del pedido son inmutables desde la API.

### Invariantes en base de datos

- `quantity > 0`.
- `unitPriceCents >= 0`.
- `subtotalCents >= 0`.
- `subtotalCents = unitPriceCents * quantity`.
- `totalCents = subtotalCents + taxCents`.
- `pricingSource = CATALOG` exige `priceId`; `MANUAL` exige `priceId` nulo.
- `idempotencyKey` no puede ser texto vacío si está presente.
- `quoteId` es único.

## Modelo `OrderStatusHistory`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `orderId` | UUID | Pedido |
| `fromStatus` | `OrderStatus` nulo | Estado anterior |
| `toStatus` | `OrderStatus` | Estado nuevo |
| `changedBy` | UUID | Usuario |
| `reason` | Texto nulo | Motivo |
| `createdAt` | Timestamp | Fecha |

Historial de solo inserción.

## Estados y transiciones

```
PENDING_PAYMENT → CANCELLED
PAID            → FULFILLED | REFUNDED   (no alcanzable por API)
FULFILLED       → REFUNDED             (no alcanzable por API)
CANCELLED       (terminal)
REFUNDED        (terminal)
```

Reglas efectivas de la API:

- `PENDING_PAYMENT → CANCELLED` es la única transición ejecutable.
- `PAID` y `REFUNDED` se rechazan siempre con `409 PAGO_NO_AUTORIZADO`.
- No se permite repetir el estado (`409 SIN_CAMBIO_DE_ESTADO`).
- No se permite una transición no listada (`409 TRANSICION_INVALIDA`).
- No existe endpoint `DELETE`; el pedido no se borra físicamente.

## Creación directa

- Requiere `VENDEDOR` o `ADMIN`.
- Requiere clave de idempotencia (`Idempotency-Key` o `idempotencyKey` en el cuerpo).
- Solo usa precios de catálogo vigentes; no acepta precio manual.
- Valida cliente activo y no eliminado.
- Valida productos activos y no eliminados.
- Valida cantidades positivas y no duplicadas.
- Valida disponibilidad de inventario en modo lectura.
- Calcula importes en el servidor.
- Crea pedido, líneas, historial y `OperationLog` en una transacción.

## Conversión desde cotización

- Requiere cotización `SENT` vigente o `ACCEPTED`.
- Conserva precios, cantidades y snapshots de la cotización.
- Copia los totales de la cotización y valida su consistencia interna.
- No vuelve a consultar el precio actual del catálogo.
- No reserva ni descuenta inventario.
- Registra `quoteId` y la clave de idempotencia.
- El detalle del pedido incluye la cotización de origen.

## Idempotencia

- La clave es única en `Order`.
- Misma clave + mismo cliente + mismas líneas → devuelve el pedido existente con `created: false` y HTTP 200.
- Misma clave + datos distintos → `409 IDEMPOTENCY_KEY_REUTILIZADA`.
- Conversión con clave repetida para la misma cotización → devuelve el pedido existente.
- La restricción única de base de datos protege la concurrencia.

## Inventario

- La validación es de solo lectura.
- No se crea `InventoryReservation`.
- No se modifica `quantityOnHand` ni `quantityReserved`.
- Dos pedidos concurrentes podrían sobrevender hasta que se apruebe una política de reservas. Riesgo documentado.

## Pagos

- No existe integración de pagos, pasarela, conciliación ni facturación electrónica.
- Los campos de pago existen por compatibilidad histórica, pero la API no los establece.
- Nunca se marca un pedido como `PAID` sin una integración real autorizada.

## Evidencia

- Esquema y migración 006.
- Reglas: `src/lib/commercial.ts`.
- Rutas: `src/app/api/orders/**`.
- Conversión: `src/app/api/quotes/[id]/convert/route.ts`.
- Pruebas de integración: `tests/integration/commercial-api.test.ts`.
