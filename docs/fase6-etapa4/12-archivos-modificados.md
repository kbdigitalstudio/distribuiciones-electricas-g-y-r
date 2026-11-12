# 12 — Archivos modificados

## Estado general

- Repositorio: `C:\Proyectos\GYR\gyr-next`.
- Rama: `master`.
- Último commit previo: `8717dfe`.
- Los cambios de la Etapa 4 están en el árbol de trabajo; no se hizo commit ni push.
- No se modificaron archivos del sitio original fuera de `gyr-next`.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `middleware.ts` | Agrega `/api/customers`, `/api/quotes` y `/api/orders` a rutas con autenticación obligatoria |
| `prisma/schema.prisma` | Campos comerciales, snapshots, idempotencia, unicidad de conversión, historiales y enums |
| `src/lib/authz.ts` | Tipado explícito de éxito/error de `getAuthenticatedUser` |
| `src/lib/validations.ts` | Esquemas Zod de clientes, cotizaciones, pedidos, estados, listados y conversión |
| `src/app/perfil/page.tsx` | Inserta `CommercialPortal` debajo del perfil existente |

## Archivos nuevos

### Migración

| Archivo | Contenido |
|---|---|
| `prisma/migrations/006_comercial_clientes_cotizaciones_pedidos/migration.sql` | Migración aditiva, enums nativos, columnas, índices, checks e historiales |

### Librerías comerciales

| Archivo | Responsabilidad |
|---|---|
| `src/lib/commercial.ts` | Transiciones, errores, normalización, importes, numeración, idempotencia, paginación |
| `src/lib/commercial-access.ts` | RBAC y filtros de alcance por registro |
| `src/lib/commercial-http.ts` | Respuestas de error, validación, CSRF y mapeo de errores |
| `src/lib/commercial-includes.ts` | Includes compartidos de Prisma |
| `src/lib/commercial-items.ts` | Resolución de productos/precios y validación de stock de solo lectura |
| `src/lib/commercial-locks.ts` | Bloqueos `FOR SHARE` / `FOR UPDATE` |
| `src/lib/commercial-serializers.ts` | Serialización segura de dinero, clientes, documentos e historiales |

### API de clientes

| Archivo | Endpoints |
|---|---|
| `src/app/api/customers/route.ts` | `GET`, `POST` |
| `src/app/api/customers/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |

### API de cotizaciones

| Archivo | Endpoints |
|---|---|
| `src/app/api/quotes/route.ts` | `GET`, `POST` |
| `src/app/api/quotes/[id]/route.ts` | `GET`, `PATCH` |
| `src/app/api/quotes/[id]/status/route.ts` | `POST` |
| `src/app/api/quotes/[id]/items/route.ts` | `GET` |
| `src/app/api/quotes/[id]/convert/route.ts` | `POST` |

### API de pedidos

| Archivo | Endpoints |
|---|---|
| `src/app/api/orders/route.ts` | `GET`, `POST` |
| `src/app/api/orders/[id]/route.ts` | `GET`, `PATCH` |
| `src/app/api/orders/[id]/status/route.ts` | `POST` |
| `src/app/api/orders/[id]/items/route.ts` | `GET` |

### Frontend

| Archivo | Contenido |
|---|---|
| `src/components/commercial/commercial-portal.tsx` | Portal comercial progresivo con API real |

### Pruebas

| Archivo | Tipo |
|---|---|
| `tests/unit/commercial-rules.test.ts` | Unitarias |
| `tests/unit/commercial-items.test.ts` | Unitarias |
| `tests/unit/commercial-serializers.test.ts` | Unitarias |
| `tests/unit/commercial-access.test.ts` | Unitarias |
| `tests/integration/commercial-api.test.ts` | Integración real con PostgreSQL |

### Documentación

| Archivo |
|---|
| `docs/fase6-etapa4/00-auditoria-inicial.md` |
| `docs/fase6-etapa4/01-modelos-clientes.md` |
| `docs/fase6-etapa4/02-modelos-cotizaciones.md` |
| `docs/fase6-etapa4/03-modelos-pedidos.md` |
| `docs/fase6-etapa4/04-migraciones.md` |
| `docs/fase6-etapa4/05-api-clientes.md` |
| `docs/fase6-etapa4/06-api-cotizaciones.md` |
| `docs/fase6-etapa4/07-api-pedidos.md` |
| `docs/fase6-etapa4/08-conversion-cotizacion-pedido.md` |
| `docs/fase6-etapa4/09-seguridad-y-permisos.md` |
| `docs/fase6-etapa4/10-integracion-frontend.md` |
| `docs/fase6-etapa4/11-pruebas-y-resultados.md` |
| `docs/fase6-etapa4/12-archivos-modificados.md` |
| `docs/fase6-etapa4/13-problemas-pendientes.md` |
| `docs/fase6-etapa4/14-informe-final.md` |

## Archivos que no se modificaron

- Páginas públicas del sitio.
- Componentes de navegación, header, footer, logo y menú móvil.
- Estilos globales, colores y tipografía Sora.
- Catálogo, producto, carrito y checkout.
- Slugs y rutas existentes.
- Archivos del proyecto original fuera de `gyr-next`.
- Migraciones `001` a `005`.
- Endpoints de autenticación, productos, categorías e inventario.

## Observación sobre `middleware.ts`

El bloque de reglas de `AGENTS.md` se regenera automáticamente por `next dev`. No forma parte de la lógica de la Etapa 4.

## Verificación de limpieza

`git status --short` muestra únicamente:

```
 M middleware.ts
 M prisma/schema.prisma
 M src/app/perfil/page.tsx
 M src/lib/authz.ts
 M src/lib/validations.ts
?? docs/fase6-etapa4/
?? prisma/migrations/006_comercial_clientes_cotizaciones_pedidos/
?? src/app/api/customers/
?? src/app/api/orders/
?? src/app/api/quotes/
?? src/components/commercial/
?? src/lib/commercial-access.ts
?? src/lib/commercial-http.ts
?? src/lib/commercial-includes.ts
?? src/lib/commercial-items.ts
?? src/lib/commercial-locks.ts
?? src/lib/commercial-serializers.ts
?? src/lib/commercial.ts
?? tests/integration/commercial-api.test.ts
?? tests/unit/commercial-access.test.ts
?? tests/unit/commercial-items.test.ts
?? tests/unit/commercial-rules.test.ts
?? tests/unit/commercial-serializers.test.ts
```

No hay archivos temporales, binarios, capturas ni artefactos de build versionados.
