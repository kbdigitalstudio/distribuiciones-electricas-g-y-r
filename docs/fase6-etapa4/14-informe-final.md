# 14 — Informe final

## Resumen ejecutivo

La Etapa 4 quedó implementada en `C:\Proyectos\GYR\gyr-next`, rama `master`, sobre la arquitectura existente de Next.js Route Handlers, Prisma y PostgreSQL.

Se entregaron:

- API de clientes con alta, consulta, edición, baja lógica, paginación, búsqueda, filtros y control de duplicados.
- API de cotizaciones con snapshots, precios de catálogo o manuales autorizados, totales del servidor, edición de borradores, reemplazo lógico de líneas, estados e historial.
- API de pedidos con creación directa, idempotencia, validación de stock de solo lectura, estados e historial.
- Conversión atómica cotización → pedido, idempotente y protegida contra duplicados.
- Seguridad por sesión, roles, alcance por registro, CSRF, validación Zod, transacciones y auditoría.
- Migración aditiva aplicada únicamente en la base de pruebas.
- Integración frontend progresiva en `/perfil`, sin alterar la identidad GYR.
- 15 documentos en `docs/fase6-etapa4/`.

**No se inició la Etapa 5. No se ejecutó nada en producción.**

## Cumplimiento del alcance

| Criterio | Estado | Evidencia |
|---|---|---|
| Auditoría inicial previa | Cumplido | `00-auditoria-inicial.md` |
| Reutilizar modelos existentes sin duplicar | Cumplido | `01`–`03`, `prisma/schema.prisma` |
| API de clientes | Cumplido | `05`, rutas `/api/customers`, 6 pruebas de integración |
| API de cotizaciones | Cumplido | `06`, rutas `/api/quotes`, 7 pruebas de integración |
| API de pedidos | Cumplido | `07`, rutas `/api/orders`, 7 pruebas de integración |
| Conversión cotización → pedido | Cumplido | `08`, ruta `/convert`, 6 pruebas de integración |
| Snapshots históricos | Cumplido | Campos de snapshot en `QuoteItem` y `OrderItem` |
| Dinero en centavos enteros | Cumplido | `BigInt`, serialización como cadena, checks SQL |
| Cálculo de totales en servidor | Cumplido | `calculateTotals`, `resolveCommercialItems` |
| Sin precios inventados | Cumplido | Precio de catálogo o precio manual explícito; si no, error |
| Sin impuestos ni descuentos inventados | Cumplido | `taxCents = 0`, sin campos de descuento |
| Transiciones controladas | Cumplido | Tablas de transición y pruebas |
| Historial de estados | Cumplido | `QuoteStatusHistory`, `OrderStatusHistory` |
| Borrado lógico | Cumplido | Clientes y líneas de cotización |
| Sin borrado físico de comercio | Cumplido | No hay `DELETE` de pedidos; clientes se desactivan |
| Idempotencia de pedidos | Cumplido | Clave única, header/cuerpo, pruebas de concurrencia |
| Sin conversión duplicada | Cumplido | `Order.quoteId` único y bloqueo |
| Sin reserva ni descuento automático de stock | Cumplido | Validación de solo lectura; prueba verifica stock intacto |
| `PAID` no alcanzable sin pago real | Cumplido | `PAGO_NO_AUTORIZADO` |
| Autorización server-side | Cumplido | `getAuthenticatedUser`, RBAC por registro |
| CSRF en mutaciones | Cumplido | 10 mutaciones verificadas con `CSRF_INVALID` |
| Protección horizontal entre clientes | Cumplido | Pruebas de aislamiento; respuestas `404` |
| PII minimizada | Cumplido | Serializadores y pruebas |
| Migración no destructiva | Cumplido | `006`, aditiva; aplicada solo en `gyr_test` |
| Migración de producción | **No ejecutada** | Bloqueada por autorización |
| Pruebas unitarias | Cumplido | 77 pruebas, 7 archivos |
| Pruebas de integración PostgreSQL | Cumplido | 28 pruebas comerciales + 12 de inventario |
| Typecheck | Cumplido | `npx tsc --noEmit` sin errores |
| Build | Cumplido | `npm run build` exitoso |
| Auditoría de dependencias | Cumplido | `npm audit --omit=dev`: 0 vulnerabilidades |
| Integración frontend progresiva | Cumplido con salvedad | Portal real en `/perfil`; login backend pendiente |
| Documentación completa | Cumplido | 15 documentos `00`–`14` |
| Detenerse antes de Etapa 5 | Cumplido | Sin cambios posteriores a esta etapa |

## Resultados reales

```
Prisma validate: válido (2 advertencias preexistentes de SetNull)
Prisma generate: correcto
tsc --noEmit: sin errores
npm run build: exitoso
npm audit --omit=dev: 0 vulnerabilidades
Vitest: 9 archivos, 117 pruebas aprobadas
  - Unitarias: 7 archivos, 77 pruebas
  - Integración comercial: 28 pruebas
  - Integración de inventario: 12 pruebas
Migración 006: aplicada en gyr_test, sin pendientes
```

## Seguridad

- Sesión JWT en cookie HttpOnly.
- Roles resueltos desde base de datos en cada request.
- CSRF double-submit en las 10 mutaciones.
- Autorización por registro, no solo por rol.
- Aislamiento entre vendedores y entre clientes.
- Respuestas `404` para no revelar registros ajenos.
- Validación Zod y límites de tamaño.
- Restricciones SQL de integridad monetaria y de cantidades.
- Transacciones con bloqueos de fila.
- Auditoría de operaciones e historiales de estado.
- Sin datos sensibles innecesarios.
- Sin exposición de `passwordHash` ni claves de idempotencia.

## Frontend

Se agregó `CommercialPortal` en `/perfil`:

- Consume datos reales.
- No usa datos de ejemplo.
- Muestra cotizaciones, pedidos y clientes autorizados.
- Permite acciones de ciclo de vida aprobadas.
- Respeta la identidad visual existente.
- No modifica navegación, colores, tipografía, slugs ni rutas públicas.

Salvedad honesta: el login del storefront sigue usando `localStorage` y no establece la cookie backend. Por eso el portal muestra un estado anónimo hasta que se integre `/api/auth/login`. No se afirma una integración de extremo a extremo que no existe.

## Migración

- Archivo: `prisma/migrations/006_comercial_clientes_cotizaciones_pedidos/migration.sql`.
- Carácter aditivo.
- Incluye corrección de compatibilidad de enums nativos.
- Requiere prevalidación en bases con datos.
- No tiene `down`; la estrategia es forward-fix o restauración de respaldo.
- **No se aplicó en producción.**

## Riesgos principales

1. Sin reserva de inventario, puede haber sobreventa concurrente.
2. Sin integración de pagos, `PAID` y `REFUNDED` no son alcanzables.
3. Sin política de impuestos ni descuentos.
4. Login del storefront no conectado a la sesión backend.
5. Sin formularios de alta/edición en el frontend.
6. Sin restauración de clientes desactivados.
7. Borrador vencido no puede marcarse `EXPIRED` directamente.
8. Pruebas de integración no ejercitan middleware ni HTTP real.
9. Endpoints de precios de la Etapa 3 devuelven `BigInt` crudo (preexistente, no corregido).
10. Dos advertencias Prisma preexistentes de `SetNull`.

El detalle está en `13-problemas-pendientes.md`.

## Lo que no se hizo

- No se inició la Etapa 5.
- No se modificó producción.
- No se ejecutaron migraciones de producción.
- No se crearon pasarelas de pago.
- No se procesaron pagos reales.
- No se implementó facturación electrónica.
- No se enviaron correos, WhatsApp ni notificaciones externas.
- No se inventaron clientes, precios, descuentos, impuestos ni políticas comerciales.
- No se reconstruyó el sitio ni se alteró su identidad visual.
- No se corrigieron defectos preexistentes fuera del alcance.

## Conclusión

La Etapa 4 está implementada, probada contra PostgreSQL real y documentada. Los criterios técnicos del alcance se cumplen, con las salvedades explícitas de migración de producción y login del storefront.

El trabajo se detiene aquí. **No se inicia la Etapa 5 hasta recibir autorización expresa.**
