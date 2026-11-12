# 09 — Seguridad y permisos

## Capas de seguridad

La Etapa 4 aplica defensa en profundidad:

1. **Middleware** para rutas protegidas.
2. **Verificación de sesión** en cada Route Handler.
3. **Resolución de roles desde base de datos** en cada petición.
4. **Autorización por registro** (propietario, responsable o vínculo de cliente).
5. **CSRF double-submit** en mutaciones.
6. **Validación Zod** del cuerpo y de los parámetros.
7. **Restricciones de base de datos** (unicidad, checks, claves foráneas).
8. **Transacciones y bloqueos de fila** para concurrencia.
9. **Auditoría** en `OperationLog` e historiales.
10. **Minimización de datos personales** en la serialización.

No se confía en permisos, roles ni identificadores enviados por el frontend.

## Autenticación

- La sesión se transporta en la cookie HttpOnly `gyr_session`, firmada como JWT.
- El refresh token vive en `gyr_refresh_token`, también HttpOnly.
- El token CSRF vive en `gyr_csrf_token`, legible por el cliente para enviarlo en el header.
- El middleware incluye `/api/customers`, `/api/quotes` y `/api/orders` en las rutas que requieren autenticación.
- Cada handler vuelve a llamar `getAuthenticatedUser(request)`:
  - Verifica la sesión con `getSession()`.
  - Carga el usuario desde la base.
  - Rechaza usuarios inexistentes o inactivos con `404 USER_NOT_FOUND`.
  - Obtiene los roles reales desde `UserRole`/`Role`.
- Los roles usados para autorizar no provienen del cuerpo ni de un encabezado del cliente.

## CSRF

- Mecanismo: double-submit cookie.
- El cliente envía `x-csrf-token`.
- El servidor compara contra la cookie `gyr_csrf_token` con `validateCsrfToken`.
- Si falta o no coincide → `403 CSRF_INVALID`.
- Se exige en:
  - `POST /api/customers`
  - `PATCH /api/customers/[id]`
  - `DELETE /api/customers/[id]`
  - `POST /api/quotes`
  - `PATCH /api/quotes/[id]`
  - `POST /api/quotes/[id]/status`
  - `POST /api/quotes/[id]/convert`
  - `POST /api/orders`
  - `PATCH /api/orders/[id]`
  - `POST /api/orders/[id]/status`
- Los `GET` no exigen CSRF porque no modifican estado.

La prueba de integración desactiva el validador y verifica que **las 10 mutaciones** responden `403 CSRF_INVALID`.

## Matriz de autorización

### Clientes

| Operación | ADMIN | VENDEDOR | CLIENTE | INVENTARIO |
|---|---|---|---|---|
| Listar | Todos | Creados o propio | Propio | 403 |
| Crear | Sí | Sí | 403 | 403 |
| Ver | Todos | Creados o propio | Propio | 404 |
| Editar | Todos | Creados o propio | 403 | 403 |
| Desactivar | Todos | Creados o propio | 403 | 403 |
| Cambiar `isActive` | Sí | 403 | 403 | 403 |

### Cotizaciones

| Operación | ADMIN | VENDEDOR | CLIENTE | INVENTARIO |
|---|---|---|---|---|
| Listar | Todas | Responsable | Cliente propio | 403 |
| Crear | Sí | Sí | 403 | 403 |
| Ver | Todas | Responsable | Cliente propio | 404 |
| Editar | Todas | Responsable | 403 | 403 |
| Cambiar estado | Todas | Responsable | 403 | 403 |
| Convertir | Todas | Responsable | 403 | 403 |
| Ver líneas | Todas | Responsable | Cliente propio | 404 |

### Pedidos

| Operación | ADMIN | VENDEDOR | CLIENTE | INVENTARIO |
|---|---|---|---|---|
| Listar | Todos | Responsable | Cliente propio | 403 |
| Crear directo | Sí | Sí | 403 | 403 |
| Ver | Todos | Responsable | Cliente propio | 404 |
| Editar notas | Todos | Responsable | 403 | 403 |
| Cambiar estado | Todos | Responsable | 403 | 403 |
| Ver líneas | Todos | Responsable | Cliente propio | 404 |

`INVENTARIO` es un rol funcional independiente. No obtiene acceso comercial implícito por ser un rol operativo.

## Aislamiento horizontal

- Un VENDEDOR no puede leer ni editar clientes de otro vendedor.
- Un VENDEDOR solo administra cotizaciones y pedidos donde figura como `userId`.
- Un CLIENTE solo accede a su propio `Customer`, sus cotizaciones y sus pedidos.
- Los accesos a registros ajenos en detalle, líneas y conversión responden `404` para no revelar existencia.
- Los listados aplican el filtro de alcance antes de paginar; no se pagina y luego se filtra en memoria.
- Un VENDEDOR puede crear cotizaciones para cualquier cliente activo, pero su listado de clientes sigue limitado a los que creó o a su propio vínculo. Esta asimetría es intencional y está documentada.

## Validación de entrada

- Zod valida cuerpo, query y estados.
- Los UUID se validan antes de consultar la base (`ID_INVALIDO`).
- Los cuerpos vacíos o con campos no declarados se rechazan cuando el esquema es estricto o no los contempla.
- Los importes:
  - Se aceptan como entero seguro o cadena de hasta 15 dígitos.
  - Se convierten a `BigInt`.
  - Nunca se aceptan decimales flotantes.
- Las cantidades deben ser enteras y positivas.
- Los estados solo se aceptan si pertenecen al enum aprobado.
- Los totales nunca se aceptan del cliente.

## Protección de datos personales

- `serializeCustomer` devuelve solo campos comerciales.
- Nunca se incluye `passwordHash`.
- Nunca se incluye la clave de idempotencia en la respuesta del pedido.
- Los campos de pago se exponen solo como referencia histórica; la API no los establece.
- Los datos de contacto se entregan únicamente a roles autorizados sobre el cliente.
- Los accesos no autorizados no distinguen entre “no existe” y “no autorizado”.
- Los logs de operación guardan actor, acción y nombres de campos; no volcados completos de datos personales.
- No se incorporaron datos sensibles innecesarios (salud, biometría, datos financieros).

## Restricciones de base de datos

- `Customer`: unicidad compuesta `(documentType, documentNumber)`.
- `QuoteItem` / `OrderItem`:
  - `quantity > 0`.
  - `unitPriceCents >= 0`.
  - `subtotalCents >= 0`.
  - `subtotalCents = unitPriceCents * quantity`.
  - Coherencia entre `pricingSource` y `priceId`.
- `Quote` / `Order`:
  - Importes no negativos.
  - `totalCents = subtotalCents + taxCents`.
- `Order.idempotencyKey` único.
- `Order.quoteId` único.
- `Quote.quoteNumber` y `Order.orderNumber` únicos.
- Claves foráneas con `RESTRICT`/`SET NULL` según corresponda.

Estas restricciones protegen incluso si un bug de aplicación intentara escribir datos inconsistentes.

## Transacciones y concurrencia

- Altas y conversiones usan `db.$transaction`.
- Aislamiento `ReadCommitted`, `timeout 15000`, `maxWait 10000`.
- Bloqueos:
  - `Customer FOR SHARE` al crear pedidos.
  - `Quote FOR UPDATE` al editar, cambiar estado o convertir.
  - `Order FOR UPDATE` al editar o cambiar estado.
- Los bloqueos se liberan al confirmar o revertir.
- La unicidad de `idempotencyKey` y `quoteId` cubre carreras que el bloqueo no alcance.
- Los conflictos `P2002` se traducen a respuestas idempotentes o `409`, no a `500`.

## Auditoría

Acciones registradas en `OperationLog`:

| Acción | Operación |
|---|---|
| `CUSTOMER_CREATE` | Alta de cliente |
| `CUSTOMER_UPDATE` | Edición de cliente |
| `CUSTOMER_DEACTIVATE` | Baja lógica |
| `QUOTE_CREATE` | Alta de cotización |
| `QUOTE_UPDATE` | Edición de borrador o reemplazo de líneas |
| `QUOTE_STATUS_CHANGE` | Transición de estado |
| `QUOTE_CONVERT_TO_ORDER` | Conversión |
| `ORDER_CREATE` | Pedido directo |
| `ORDER_UPDATE` | Edición de observaciones |
| `ORDER_STATUS_CHANGE` | Transición de pedido |

Además:

- `QuoteStatusHistory` y `OrderStatusHistory` conservan `fromStatus`, `toStatus`, actor, motivo y fecha.
- Son tablas de solo inserción desde la API.
- No se actualizan ni se eliminan.

## Evidencia de pruebas de seguridad

En `tests/integration/commercial-api.test.ts`:

- Sin sesión → `401 UNAUTHENTICATED`.
- Sin CSRF o CSRF inválido → `403 CSRF_INVALID` en las 10 mutaciones.
- CLIENTE no puede crear clientes, cotizaciones ni pedidos.
- VENDEDOR ajeno recibe `404` al leer cotizaciones y pedidos de otro.
- CLIENTE ajeno recibe `404` al leer clientes, cotizaciones y pedidos de otro.
- INVENTARIO recibe `403` en listados comerciales.
- IDs no UUID → `400 ID_INVALIDO` sin consultar la base.
- La clave de idempotencia no aparece en la respuesta.

En `tests/unit/commercial-access.test.ts`:

- 11 pruebas de roles y alcance.
- Verifica que `INVENTARIO` y roles vacíos no obtengan permisos comerciales.
- Verifica los filtros `customerScopeWhere`, `quoteScopeWhere` y `orderScopeWhere`.

## Riesgos residuales

1. No se añadió un límite de tasa específico para las APIs comerciales en esta etapa.
2. La sesión del storefront actual no establece la cookie backend; el portal muestra estado anónimo hasta integrar el login.
3. La validación de stock es de solo lectura; dos pedidos concurrentes podrían sobrevender hasta que se apruebe una política de reservas.
4. El middleware no se ejercita en las pruebas de integración, que invocan los handlers directamente. La protección de middleware se valida por compilación y revisión, no por una prueba HTTP de extremo a extremo.
5. No existe integración de pagos; los estados `PAID` y `REFUNDED` son inalcanzables por diseño.
6. No existe rate limiting ni bloqueo por usuario para operaciones comerciales más allá de lo ya existente en autenticación.

## Referencias

- `middleware.ts`
- `src/lib/authz.ts`
- `src/lib/session.ts`
- `src/lib/commercial-access.ts`
- `src/lib/commercial-http.ts`
- `src/lib/commercial-locks.ts`
- `tests/unit/commercial-access.test.ts`
- `tests/integration/commercial-api.test.ts`
