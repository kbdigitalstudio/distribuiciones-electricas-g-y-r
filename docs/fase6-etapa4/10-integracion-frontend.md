# 10 — Integración frontend

## Alcance

La integración es **progresiva y no invasiva**. No se reconstruyó el sitio, no se modificaron colores, tipografía Sora, navegación, slugs ni rutas públicas. Se agregó un portal comercial dentro de la página existente `/perfil`.

## Componente agregado

```
src/components/commercial/commercial-portal.tsx
```

Componente cliente que consume la API real de la Etapa 4.

### Funcionalidad implementada

- Verificación de sesión contra `/api/auth/me`.
- Estado anónimo honesto si no existe sesión backend.
- Pestañas:
  - Cotizaciones.
  - Pedidos.
  - Clientes (solo ADMIN/VENDEDOR).
- Listados paginados:
  - Página y tamaño 10.
  - Búsqueda por texto.
  - Filtro por estado en cotizaciones y pedidos.
  - Botón de actualización.
- Detalle expandible:
  - Número, cliente, responsable, estado.
  - Fechas y vigencia.
  - Subtotal, impuestos y total en COP.
  - Líneas con snapshots históricos, cantidad, precio unitario, subtotal y origen del precio.
  - Observaciones.
- Acciones de ciclo de vida permitidas por la API:
  - `DRAFT → SENT`.
  - `DRAFT → CANCELLED`.
  - `SENT → ACCEPTED`.
  - `SENT → EXPIRED` cuando ya venció.
  - `SENT/ACCEPTED → convertir a pedido`.
  - `PENDING_PAYMENT → CANCELLED` en pedidos.
- Manejo de errores con el código y mensaje del servidor.
- Confirmación explícita antes de cancelar o convertir.
- Envío de `x-csrf-token` leído de la cookie `gyr_csrf_token`.
- `credentials: "same-origin"` y `cache: "no-store"`.

### Lo que no hace

- No crea clientes.
- No crea ni edita cotizaciones.
- No crea pedidos directos.
- No edita observaciones.
- No muestra datos de ejemplo ni registros inventados.
- No muestra inventario interno.
- No expone datos privados en páginas públicas.
- No procesa pagos.
- No envía correos ni notificaciones.

## Integración en `/perfil`

Se importó `CommercialPortal` y se insertó debajo del formulario de perfil existente:

```tsx
<CommercialPortal />
```

No se alteró:

- El formulario de perfil.
- El encabezado, footer o menú.
- La paleta (`gyr-primary`, `gyr-heading`, `gyr-text`, etc.).
- La tipografía Sora.
- El carrito, checkout o catálogo.
- Las rutas y slugs existentes.

## Sesión del storefront

Existe una desconexión conocida:

- El modal de autenticación del storefront usa `localStorage`.
- La API comercial usa cookies HttpOnly emitidas por `/api/auth/login`.
- Por eso, un usuario que “inicia sesión” en el modal actual no obtiene automáticamente sesión backend.
- `CommercialPortal` consulta `/api/auth/me`; si no hay cookie, muestra un estado anónimo explicativo y **no** consulta ni muestra registros.

Esto es deliberado: se prefirió un estado honesto antes que simular datos o afirmar una integración inexistente.

### Trabajo pendiente para completar la integración

1. Conectar el modal de login/registro del storefront con `/api/auth/login` y `/api/auth/register`.
2. Propagar el token CSRF después del login.
3. Manejar refresh y cierre de sesión contra `/api/auth/logout`.
4. Definir la experiencia para usuarios con rol `CLIENTE` sin registro `Customer` vinculado.
5. Añadir formularios de alta/edición cuando se apruebe el flujo comercial.
6. Añadir pruebas E2E de navegador.

## Seguridad de la integración

- El frontend no decide permisos: si intenta una acción no autorizada, el servidor responde `403` o `404`.
- El portal solo muestra pestañas según los roles que devuelve `/api/auth/me`, pero la autorización real ocurre en cada handler.
- Los importes se formatean en COP a partir de cadenas de centavos.
- No se usa `innerHTML` ni se insertan datos sin escape de React.
- No se almacenan datos comerciales en `localStorage`.
- No se registran datos personales en consola.
- No se muestran las claves de idempotencia.
- Las conversiones generan una clave nueva con `crypto.randomUUID()` por acción.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `npm run build`: compilación exitosa; `/perfil` aparece en la salida del build.
- La página `/perfil` sigue siendo una ruta estática/cliente según el build existente.
- No se ejecutaron pruebas de navegador ni capturas; no se afirma una validación visual de extremo a extremo.

## Riesgos y limitaciones

1. Sin login backend integrado, el portal permanece anónimo en el flujo normal del storefront.
2. No hay formularios de creación; el alta debe hacerse por API.
3. No hay E2E de navegador que cubra clics reales, cookies y CSRF.
4. La paginación es por offset; cambios concurrentes pueden desplazar resultados entre páginas.
5. No se implementó un estado de carga optimista; tras una acción se recarga el listado.
6. No se añadió un panel administrativo dedicado.

## Evidencia

- Componente: `src/components/commercial/commercial-portal.tsx`.
- Página: `src/app/perfil/page.tsx`.
- API consumida: `/api/auth/me`, `/api/customers`, `/api/quotes`, `/api/quotes/[id]/status`, `/api/quotes/[id]/convert`, `/api/orders`, `/api/orders/[id]/status`.
- Build: `npm run build` exitoso.
