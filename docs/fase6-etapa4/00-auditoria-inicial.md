# 00. Auditoría inicial — Fase 6, Etapa 4

**Fecha:** 2026-11-11  
**Alcance:** clientes, cotizaciones, pedidos y conversión cotización → pedido.  
**Rama:** `master`  
**Commit de partida:** `8717dfe` (Etapa 3 cerrada y verificada).  
**Producción:** no inspeccionada ni modificada. Toda verificación se realiza contra PostgreSQL de pruebas.

---

## 1. Archivos y documentación inspeccionados

### Esquema y migraciones

- `prisma/schema.prisma`
- `prisma/migrations/001_init/migration.sql`
- `prisma/migrations/002_catalogo/migration.sql`
- `prisma/migrations/003_idempotencia/migration.sql`
- `prisma/migrations/004_normalizacion_identificadores/migration.sql`
- `prisma/migrations/005_integridad_inventario/migration.sql`
- `tests/global-setup.ts`

### Librerías existentes

- `src/lib/db.ts`
- `src/lib/auth.ts`
- `src/lib/session.ts`
- `src/lib/authz.ts`
- `src/lib/roles.ts`
- `src/lib/validations.ts`
- `src/lib/inventory-rules.ts`
- `src/lib/inventory-locks.ts`
- `src/lib/inventory-serializers.ts`
- `middleware.ts`

### API existente

- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/products/route.ts`
- `src/app/api/products/[id]/route.ts`
- `src/app/api/products/[id]/price/route.ts`
- `src/app/api/products/[id]/prices/route.ts`
- `src/app/api/categories/route.ts`
- `src/app/api/inventory/route.ts`
- `src/app/api/inventory/[productId]/route.ts`
- `src/app/api/inventory/movements/route.ts`
- `src/app/api/inventory/reservations/route.ts`
- `src/app/api/inventory/reservations/[id]/route.ts`

### Documentación aprobada de etapas anteriores

- `docs/fase6-etapa1/02-contratos-api.md`
- `docs/fase6-etapa1/03-modelo-datos-ajustes.md`
- `docs/fase6-etapa1/05-plan-pruebas-tecnicas-seguridad.md`
- `docs/fase6-etapa2/05-matriz-roles-permisos.md`
- `docs/fase6-etapa2/06-resultados-pruebas-seguridad.md`
- `docs/fase6-etapa3/06-api-inventario.md`
- `docs/fase6-etapa3/07-seguridad-y-permisos.md`
- `docs/fase6-etapa3/14-correcciones-auditoria.md`

---

## 2. Arquitectura encontrada

| Elemento | Implementación existente |
|---|---|
| Framework | Next.js 16.4.6, App Router, Route Handlers |
| ORM / BD | Prisma 5.22.0 + PostgreSQL 18 |
| Identificadores | UUID (`@db.Uuid`) |
| Autenticación | JWT en cookie HttpOnly (`gyr_session`) + refresh token |
| CSRF | Double-submit cookie (`gyr_csrf_token` + header `x-csrf-token`) |
| Validación | Zod 4 en servidor |
| RBAC | Jerarquía `CLIENTE < VENDEDOR < ADMIN`; rol funcional independiente `INVENTARIO` |
| Auditoría | Modelo `OperationLog` |
| Borrado | Lógico mediante `deletedAt` / `isActive` (catálogo y usuarios) |
| Dinero | `BigInt` en centavos COP |
| Pruebas | Vitest; integración real contra PostgreSQL de pruebas |

### Roles existentes

- `CLIENTE`: consulta catálogo, puede ver su propio perfil, sus cotizaciones y pedidos.
- `VENDEDOR`: gestión comercial; sin acceso implícito a inventario.
- `ADMIN`: acceso total.
- `INVENTARIO`: rol funcional ortogonal, solo inventario.

No existen permisos granulares cargados en `Permission`/`RolePermission`; la autorización efectiva se resuelve por rol y pertenencia del registro. No se introducen permisos implícitos nuevos.

---

## 3. Modelos comerciales existentes

### `Customer`

Campos actuales: `id`, `userId` (único, opcional), `personType`, `documentType`, `documentNumber` (único global, opcional), `razonSocial`, `primerNombre`, `primerApellido`, `ciudad`, `departamento`, `direccion`, `telefono`, `email`, `createdAt`, `updatedAt`.

Relaciones: `User?`, `Quote[]`, `Order[]`.

**Brechas frente a Etapa 4:**

- No tiene país.
- No tiene estado propio ni fecha de eliminación lógica.
- No registra quién creó ni quién modificó.
- `documentNumber` es único global, no por tipo de documento.
- No existe una clasificación comercial distinta de `personType`; la política de “tipo de cliente” no está definida.

### `Quote` / `QuoteItem`

`Quote`: `id`, `customerId`, `userId`, `quoteNumber` (único), `status`, `subtotalCents`, `taxCents`, `totalCents`, `validUntil`, `notes`, `createdAt`, `updatedAt`.

`QuoteItem`: `id`, `quoteId`, `productId`, `priceId` (obligatorio), `quantity`, `unitPriceCents`, `subtotalCents`.

**Brechas:**

- Las líneas no guardan snapshot de nombre, SKU, slug, moneda ni origen del precio.
- `priceId` obligatorio impide representar una línea manual cuando el producto no tiene precio confirmado.
- No hay historial explícito de estados.
- No hay borrado lógico de líneas para conservar revisadas de un borrador.
- No hay marca de conversión; la relación se deduce de `Order.quoteId`, que hoy no es única.

### `Order` / `OrderItem`

`Order`: `id`, `customerId`, `userId`, `orderNumber` (único), `quoteId` (opcional, no único), `status`, `subtotalCents`, `taxCents`, `totalCents`, `paymentMethod`, `paymentReference`, `paidAt`, `createdAt`, `updatedAt`.

`OrderItem`: `id`, `orderId`, `productId`, `priceId` (obligatorio), `quantity`, `unitPriceCents`, `subtotalCents`.

**Brechas:**

- No hay clave de idempotencia para reintentos.
- `quoteId` no impide más de un pedido por cotización.
- No hay snapshots de línea.
- No hay historial explícito de estados.
- No hay observaciones.
- No hay `deletedAt`; no se implementará borrado físico ni endpoint DELETE.

### Otros modelos reutilizados

- `User`: responsable comercial, relaciones de auditoría y autenticación.
- `Product`: catálogo; se valida activo y no eliminado.
- `Price`: precio histórico; se selecciona el vigente y se conserva su identificador cuando existe.
- `InventoryReservation`: no se usará automáticamente en esta etapa.
- `OperationLog`: auditoría de operaciones.

---

## 4. Estados aprobados en Etapa 1

Los estados del esquema y de la documentación aprobada son:

### Cotizaciones

`DRAFT | SENT | ACCEPTED | EXPIRED | CANCELLED`

Equivalencias en español: borrador, enviada, aceptada, vencida, cancelada.

**No existe** `RECHAZADA`. El prompt la menciona como referencia, pero introducirla alteraría el enum aprobado. Se documenta como decisión pendiente y no se implementa.

### Pedidos

`PENDING_PAYMENT | PAID | FULFILLED | CANCELLED | REFUNDED`

Equivalencias: pendiente de pago, pagado, cumplido, cancelado, reembolsado.

**No existen** `CONFIRMADO`, `EN_PROCESO` ni `COMPLETADO`. No se introducen estados nuevos.

### Transiciones que se implementarán

Cotizaciones:

- `DRAFT → SENT`
- `DRAFT → CANCELLED`
- `SENT → ACCEPTED` (solo si no está vencida)
- `SENT → EXPIRED` (solo si `validUntil` ya pasó)
- `SENT → CANCELLED`
- `ACCEPTED`, `EXPIRED`, `CANCELLED`: terminales.

Pedidos:

- `PENDING_PAYMENT → CANCELLED`
- `PAID → FULFILLED`
- `PAID → REFUNDED`
- `FULFILLED → REFUNDED`
- `CANCELLED`, `REFUNDED`: terminales.
- `PAID` y `REFUNDED` no se podrán alcanzar por API mientras no exista una integración de pagos real y autorizada. La API responderá con un error explícito `PAGO_NO_AUTORIZADO`.

---

## 5. Reglas comerciales no definidas

Se documentan y **no se inventan**:

1. **Impuestos:** no existe tarifa, régimen ni configuración de IVA aprobada. Las cotizaciones y pedidos se crearán con `taxCents = 0` y `totalCents = subtotalCents`. La estructura queda preparada para una política futura.
2. **Descuentos:** no existe política de descuentos autorizados. No se acepta ningún campo de descuento. El precio manual solo se permite cuando el producto no tiene precio de catálogo confirmado.
3. **Tipo de cliente:** no existe clasificación comercial (por ejemplo, minorista/mayorista). Se reutiliza `personType` (`NATURAL`/`JURIDICA`) como tipo de persona. No se agrega una categoría inventada.
4. **País:** se agrega `pais` con valor técnico por defecto `Colombia`, editable. No se inventan políticas de exportación.
5. **Conversión y reservas:** la política aprobada no ordena reservar inventario al convertir una cotización. No se reserva ni se descuenta stock. La creación de un borrador no afecta existencias.
6. **Creación de cotizaciones/pedidos por `CLIENTE`:** la matriz de referencia dice “según política aprobada”, pero no existe esa política. Se deniega por ahora y se documenta como pendiente.
7. **“Tipo de cliente” y estado:** se usa `isActive` + `deletedAt` para el estado y la eliminación lógica. No se crea un enum de estado adicional.
8. **Facturación electrónica, correos, WhatsApp y pasarelas:** fuera de alcance; no se implementan.

---

## 6. Decisiones técnicas de la etapa

| Tema | Decisión |
|---|---|
| Modelos | Se reutilizan `Customer`, `Quote`, `QuoteItem`, `Order`, `OrderItem`, `User`, `Product`, `Price`, `InventoryReservation`. |
| Snapshots | Se agregan campos de snapshot a `QuoteItem` y `OrderItem`; los registros nuevos siempre los llenan. Los registros antiguos quedan con snapshot nulo, sin inventar datos. |
| Precio manual | Solo si el producto no tiene precio vigente. El usuario autorizado debe enviar `unitPriceCents` explícito. No se acepta precio manual si existe precio de catálogo. |
| Precio de catálogo | Se toma de `Price` vigente (`isActive`, `validFrom <= ahora`, `validTo` nulo o futuro). Se conserva `priceId` como referencia histórica. |
| Totales | Se calculan exclusivamente en el servidor con `BigInt`; el cliente no puede enviar subtotal, impuesto ni total. |
| Dinero en JSON | Se serializa como cadena decimal de centavos para no perder precisión ni fallar por `BigInt`. |
| Números comerciales | `COT-AAAAMMDD-<12 hex aleatorios>` y `PED-AAAAMMDD-<12 hex aleatorios>`; no secuenciales ni predecibles. La restricción `UNIQUE` protege colisiones. |
| Idempotencia de pedidos | Obligatoria mediante `Idempotency-Key` o `idempotencyKey`. Se persiste en `Order.idempotencyKey` (único). |
| Conversión duplicada | `Order.quoteId` pasa a `UNIQUE`; una cotización solo puede originar un pedido. |
| Historial | Nuevas tablas `QuoteStatusHistory` y `OrderStatusHistory`, más `OperationLog`. |
| Líneas de borrador | Al reemplazar líneas se marca `deletedAt`; no se eliminan físicamente. |
| Borrado de clientes | Lógico (`isActive = false`, `deletedAt`). No se borran cotizaciones ni pedidos. |
| Pedidos | No se implementa DELETE. No hay borrado físico ni lógico de pedidos en esta etapa. |
| Autorización | Se valida en cada Route Handler; el middleware solo añade una primera barrera de sesión/CSRF. |
| Aislamiento | `CLIENTE` solo accede a su propio `Customer`, sus cotizaciones y sus pedidos. `VENDEDOR` accede a los registros que tiene asignados como responsable o que creó. |
| PII | No se devuelve `passwordHash`; los logs de auditoría registran IDs y nombres de campos, no valores personales completos. |
| Inventario | No se modifica ni se consulta inventario interno desde estas APIs. |

---

## 7. Brechas técnicas detectadas fuera del alcance

1. **Serialización de `BigInt` en endpoints de precios existentes:** `GET /api/products/[id]/prices`, `GET /api/products/[id]/price` y los listados de productos devuelven `priceCents` como `BigInt`. `NextResponse.json` no puede serializar `BigInt`; esto es un defecto preexistente de Etapa 3. No se corrige en esta etapa para no ampliar el alcance, pero los endpoints nuevos usan serializadores explícitos. Se registra en `13-problemas-pendientes.md`.
2. **Frontend de autenticación:** el modal de login/registro existente no llama a la API; el sitio usa `localStorage`. La integración visual de Etapa 4 se hará de forma progresiva y se documentará su alcance real.
3. **Permisos granulares:** no hay filas en `Permission`/`RolePermission`; la autorización se basa en roles y pertenencia. No se crean permisos implícitos.
4. **Drift de migraciones:** algunas columnas/índices del esquema no fueron creados por las migraciones iniciales; la migración 004 corrigió nombres. La nueva migración se escribe explícitamente y se valida contra una base de pruebas creada con `migrate deploy`.

---

## 8. Plan de implementación

1. Migración aditiva `006_comercial_clientes_cotizaciones_pedidos`.
2. Reglas compartidas: transiciones, normalización, numeración, serialización monetaria.
3. API de clientes con RBAC, PII, duplicados y borrado lógico.
4. API de cotizaciones con snapshots, cálculo server-side, borradores e historial.
5. API de pedidos con idempotencia, snapshots e historial.
6. Conversión atómica cotización → pedido con prevención de duplicados.
7. Middleware de sesión para las nuevas rutas.
8. Integración frontend progresiva sin alterar la identidad visual.
9. Pruebas unitarias, integración PostgreSQL, autorización, CSRF, idempotencia y concurrencia.
10. Documentación y verificación final.

---

## 9. Conclusión de la auditoría

El proyecto ya cuenta con la estructura comercial necesaria. La Etapa 4 no requiere reconstruir módulos ni duplicar modelos: requiere completar trazabilidad, snapshots, historial, idempotencia y controles de acceso. Las decisiones comerciales no definidas quedan expresamente documentadas y no se implementan por inferencia.
