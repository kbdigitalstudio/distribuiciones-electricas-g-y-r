# 02 — Modelos de cotizaciones

## Alcance

Se reutilizan `Quote` y `QuoteItem`. Se agregaron snapshots comerciales, origen del precio, borrado lógico de líneas e historial explícito de estados. No se creó un modelo paralelo.

## Modelo `Quote`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `customerId` | UUID | Cliente de la cotización |
| `userId` | UUID | Vendedor o administrador responsable |
| `quoteNumber` | Texto único | Número no secuencial `COT-AAAAMMDD-<12 hex>` |
| `status` | `QuoteStatus` | `DRAFT`, `SENT`, `ACCEPTED`, `EXPIRED`, `CANCELLED` |
| `subtotalCents` | BigInt | Subtotal en centavos COP |
| `taxCents` | BigInt | Impuestos; hoy siempre `0` |
| `totalCents` | BigInt | Total; hoy igual al subtotal |
| `validUntil` | Timestamp | Vigencia |
| `notes` | Texto | Observaciones |
| `createdAt` / `updatedAt` | Timestamp | Auditoría temporal |

### Relaciones

- `customer`: cliente asociado.
- `user`: responsable comercial.
- `items`: líneas de la cotización.
- `orders`: pedidos originados (`Order.quoteId` es único).
- `statusHistory`: historial de transiciones.

## Modelo `QuoteItem`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `quoteId` | UUID | Cotización |
| `productId` | UUID | Producto |
| `priceId` | UUID nulo | Precio de catálogo usado; nulo en precio manual |
| `productName` | Texto nulo | Snapshot del nombre |
| `productSku` | Texto nulo | Snapshot del SKU |
| `productSlug` | Texto nulo | Snapshot del slug |
| `currency` | Texto(3) nulo | Moneda del snapshot (`COP`) |
| `pricingSource` | `PricingSource` | `CATALOG` o `MANUAL` |
| `quantity` | Entero | Cantidad positiva |
| `unitPriceCents` | BigInt | Precio unitario histórico |
| `subtotalCents` | BigInt | `unitPriceCents * quantity` |
| `deletedAt` | Timestamp nulo | Baja lógica de líneas reemplazadas |
| `createdAt` / `updatedAt` | Timestamp | Auditoría |

### Invariantes en base de datos

- `quantity > 0`.
- `unitPriceCents >= 0`.
- `subtotalCents >= 0`.
- `subtotalCents = unitPriceCents * quantity`.
- `pricingSource = CATALOG` exige `priceId` no nulo.
- `pricingSource = MANUAL` exige `priceId` nulo.

## Modelo `QuoteStatusHistory`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | Clave primaria |
| `quoteId` | UUID | Cotización |
| `fromStatus` | `QuoteStatus` nulo | Estado anterior; nulo en la creación |
| `toStatus` | `QuoteStatus` | Estado nuevo |
| `changedBy` | UUID | Usuario que ejecutó el cambio |
| `reason` | Texto nulo | Motivo opcional |
| `createdAt` | Timestamp | Fecha del cambio |

Es un historial de solo inserción. No se actualiza ni se borra desde la API.

## Estados y transiciones aprobadas

```
DRAFT  → SENT | CANCELLED
SENT   → ACCEPTED | EXPIRED | CANCELLED
ACCEPTED  (terminal)
EXPIRED   (terminal)
CANCELLED (terminal)
```

Reglas adicionales:

- No se permite repetir el mismo estado (`409 SIN_CAMBIO_DE_ESTADO`).
- No se permite una transición fuera de la tabla (`409 TRANSICION_INVALIDA`).
- `SENT` y `ACCEPTED` se rechazan si la cotización está vencida (`409 COTIZACION_VENCIDA`).
- `EXPIRED` solo se permite si la vigencia ya terminó (`409 COTIZACION_VIGENTE`).
- Una cotización que ya originó un pedido no puede cancelarse (`409 COTIZACION_CON_PEDIDO`).
- Una cotización `ACCEPTED` puede convertirse aunque su `validUntil` haya pasado; la aceptación es la decisión comercial registrada.
- Un borrador vencido no puede marcarse `EXPIRED` directamente porque la tabla solo permite esa transición desde `SENT`. Puede cancelarse. Esta decisión se documenta en `13-problemas-pendientes.md`.

## Edición

- Solo se edita en `DRAFT` y con vigencia futura.
- El reemplazo de líneas usa borrado lógico: las líneas activas reciben `deletedAt` y se crean líneas nuevas.
- `GET /api/quotes/[id]/items?includeDeleted=true` devuelve también las líneas reemplazadas.
- La edición no modifica snapshots de líneas ya reemplazadas.

## Precios

- Se usa el precio de catálogo vigente (`Price.isActive`, `validFrom <= now`, `validTo` nulo o futuro).
- El servidor calcula los totales; el cliente no puede enviar subtotales ni totales.
- El precio manual solo se acepta cuando no existe precio de catálogo vigente y el solicitante es `VENDEDOR` o `ADMIN`.
- Si existe precio de catálogo y se envía `unitPriceCents`, se rechaza con `PRECIO_MANUAL_NO_PERMITIDO`.
- Si no existe precio y no se envía precio manual, se rechaza con `PRECIO_NO_CONFIRMADO`.

## Impuestos y descuentos

- No existe política de impuestos ni de descuentos aprobada.
- `taxCents` se crea en `0` y `totalCents = subtotalCents`.
- La API no acepta impuestos ni descuentos enviados por el cliente.

## Numeración

- Formato `COT-AAAAMMDD-<12 hex aleatorios>`.
- Generada con `crypto.randomBytes`; no es secuencial ni predecible.
- La restricción `UNIQUE` protege ante una colisión improbable.

## Serialización

- Los importes se devuelven como cadenas decimales de centavos para evitar la pérdida de precisión y el error de JSON con `BigInt`.
- `isExpired` se calcula en el servidor al serializar.
- Las líneas incluyen el snapshot histórico, no el precio actual del producto.

## Evidencia

- Esquema y migración 006.
- Reglas: `src/lib/commercial.ts`.
- Resolución de líneas: `src/lib/commercial-items.ts`.
- Serialización: `src/lib/commercial-serializers.ts`.
- Pruebas unitarias y de integración de cotizaciones.
