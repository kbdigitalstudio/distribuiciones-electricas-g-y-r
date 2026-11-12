# 14. Correcciones Post-Auditoría — Etapa 3 de la Fase 6

- **Proyecto:** Distribuidores Eléctricos G y R S.A.S. (GYR)
- **Etapa:** 3 de la Fase 6 — Catálogo (correcciones posteriores a la auditoría)
- **Fecha:** 11 de noviembre de 2026
- **Estado:** Correcciones aplicadas y verificadas contra PostgreSQL real desechable. Migración a producción pendiente de autorización.
- **Alcance:** cierre de los 5 hallazgos de la auditoría y del hallazgo adicional de identificadores detectado al aplicar las migraciones desde cero. No se inició la Etapa 4.

> **Vigencia documental:** este documento reemplaza la versión anterior de `14-correcciones-auditoria.md` y prevalece sobre las afirmaciones de los documentos `00` a `13` en lo relativo a: disponibilidad de PostgreSQL, mapeo `INVENTARIO → VENDEDOR`, idempotencia opcional y pruebas no ejecutadas. Esos documentos quedan como registro histórico de la etapa, no como estado actual.

---

## 1. Resumen ejecutivo

| # | Hallazgo | Severidad | Estado | Evidencia |
|---|----------|-----------|--------|-----------|
| 1 | Condición de carrera en reservas de inventario | Alta | ✅ Corregido y probado | Bloqueo `SELECT ... FOR UPDATE` con orden global; prueba de 10 reservas simultáneas con stock 1: exactamente 1 gana |
| 2 | Error de TypeScript en el handler de reservas | Baja | ✅ Verificado | `npx tsc --noEmit` sin errores; se confirmó la firma correcta de Next.js 16 |
| 3 | PostgreSQL no configurado | Alta | ✅ Verificado en entorno desechable / ⚠️ Producción pendiente | PostgreSQL 18.4 en puerto 55432; 5/5 migraciones aplicadas en `gyr_test` |
| 4 | Ausencia de idempotencia en reservas | Media | ✅ Corregido y probado | Clave obligatoria, `UNIQUE NOT NULL` en PostgreSQL y 5 pruebas de idempotencia |
| 5 | Rol `INVENTARIO` inexistente | Media | ✅ Corregido y probado | Rol independiente en BD y en `src/lib/roles.ts`; `VENDEDOR` ya no recibe acceso implícito |
| 6 | Desfase de identificadores SQL/Prisma | Crítico (adicional) | ✅ Corregido y verificado | Migración `004_normalizacion_identificadores`; Prisma consulta la BD migrada correctamente |

**Resultado global:** las correcciones están implementadas y verificadas. La única acción de infraestructura pendiente es aplicar las migraciones en la base de producción, lo cual no se hizo porque no se dispone de `DATABASE_URL` ni de credenciales autorizadas.

---

## 2. Entorno de verificación

| Elemento | Valor |
|----------|-------|
| Sistema operativo | Windows (entorno local del proyecto) |
| Node.js | v24.18.0 |
| Next.js | 16.4.6 (Turbopack, `cacheComponents: true`) |
| Prisma CLI / Client | 5.22.0 (ambos fijados, sin rango `^`) |
| Vitest | 4.0.18 |
| PostgreSQL de pruebas | 18.4, cluster desechable en `127.0.0.1:55432` |
| Base de pruebas | `gyr_test` |
| `DATABASE_URL` usada en pruebas | `postgresql://postgres@127.0.0.1:55432/gyr_test?schema=public` |
| PostgreSQL de producción | Puerto 5432; **no fue tocado** |

**Protecciones del entorno de pruebas:**

- `tests/global-setup.ts` rechaza cualquier `TEST_DATABASE_URL` cuyo nombre de base no contenga `test`.
- Las pruebas de integración crean usuarios, categoría, producto e inventario con UUID aleatorios y los eliminan en `afterAll`.
- No se insertaron datos comerciales reales ni se modificó `src/data/products.ts`.

---

## 3. Corrección 1 — Concurrencia y sobreventa

### 3.1 Problema real

Una transacción de Prisma por sí sola no impide que dos solicitudes lean el mismo `quantityOnHand`, validen disponibilidad y ambas escriban. Sin bloqueo de fila, el resultado puede ser sobreventa o una `quantityReserved` incorrecta.

### 3.2 Solución implementada

Se centralizaron los bloqueos en `src/lib/inventory-locks.ts`:

```sql
SELECT "id" FROM "Inventory" WHERE "productId" = $1::uuid FOR UPDATE;
SELECT "id" FROM "InventoryReservation" WHERE "id" = $1::uuid FOR UPDATE;
```

**Orden global de bloqueo, obligatorio para todas las operaciones:**

1. `Inventory` (por `productId`)
2. `InventoryReservation` (por `id`)

Ninguna operación bloquea una reserva antes que el inventario del que depende. Esto reduce el riesgo de interbloqueos.

### 3.3 Uso por endpoint

| Operación | Archivo | Secuencia |
|-----------|---------|-----------|
| Crear reserva (`POST`) | `src/app/api/inventory/reservations/route.ts` | Bloquea `Inventory`, revalida idempotencia dentro de la transacción, lee inventario, crea reserva, actualiza `quantityReserved` y escribe `OperationLog` |
| Liberar reserva (`DELETE`) | `src/app/api/inventory/reservations/[id]/route.ts` | Lee `productId` sin bloqueo, bloquea `Inventory` y luego `InventoryReservation`, revalida estado `ACTIVE`, libera y registra auditoría |
| Registrar movimiento (`POST`) | `src/app/api/inventory/movements/route.ts` | Bloquea `Inventory`, aplica reglas puras, actualiza existencias, crea movimiento y `OperationLog` |

Las tres operaciones usan `ReadCommitted`, `timeout: 15000` y `maxWait: 10000`. Un `P2028` se traduce a `503 TRANSACTION_TIMEOUT`, nunca a un éxito falso.

### 3.4 Reglas de cantidades

Las reglas están aisladas en `src/lib/inventory-rules.ts` y se aplican antes de escribir:

| Tipo | Regla |
|------|-------|
| `ENTRY` | Incrementa `quantityOnHand`; no altera `quantityReserved` |
| `EXIT` | Solo consume disponibilidad libre (`onHand - reserved`); rechaza consumir stock reservado |
| `ADJUSTMENT` | Fija `quantityOnHand`; rechaza dejarlo por debajo de `quantityReserved` |
| `RESERVATION` | Aumenta `quantityReserved`; rechaza si `available < quantity` |
| `RELEASE` | Disminuye `quantityReserved`; rechaza liberar más de lo reservado |

Invariante garantizada en aplicación y en PostgreSQL:

```
quantityOnHand >= quantityReserved >= 0
```

No se usa `Math.max(0, ...)` para ocultar inconsistencias. Si la reserva y el inventario no coinciden, la liberación responde `409 INVENTARIO_INCONSISTENTE` y exige revisión manual.

### 3.5 Evidencia

Prueba de integración real: 10 solicitudes simultáneas, stock 1, claves de idempotencia distintas.

```
✓ 12 tests de integración
  ✓ con 10 reservas simultáneas y stock 1, solo una gana
  ✓ EXIT no consume stock reservado y RELEASE no libera de más
  ✓ dos liberaciones simultáneas solo liberan una vez
```

Resultado observado: una respuesta `201`, nueve respuestas `400 STOCK_INSUFICIENTE`, `quantityReserved = 1` y ninguna sobreventa.

---

## 4. Corrección 2 — TypeScript del handler de reservas

El hallazgo original afirmaba que Next.js 16 esperaba `params: Promise<{ [key: string]: string }>` y que el handler usaba `Promise<{ id: string }>`. Esa premisa era incorrecta.

En Next.js 16.4.6 la firma correcta para una ruta dinámica es:

```ts
{ params }: { params: Promise<{ id: string }> }
```

El handler `src/app/api/inventory/reservations/[id]/route.ts` usa exactamente esa firma, hace `await params` y valida el UUID con Zod. La compilación lo confirma:

```
npx tsc --noEmit        → 0 errores
npm run build           → TypeScript finalizado sin errores
```

Adicionalmente se eliminaron `any` del backend y se tiparon las opciones de `jsonwebtoken` con `SignOptions["expiresIn"]`, sin `as any` y sin `@ts-ignore`.

---

## 5. Corrección 3 — PostgreSQL

### 5.1 Estado real

No se dispone de `DATABASE_URL` de producción ni de credenciales autorizadas. Por tanto:

- ❌ No se aplicaron migraciones en producción.
- ❌ No se modificó ni se inspeccionó la base de producción del puerto 5432.
- ❌ No se insertaron datos comerciales.

Para verificar el código se levantó un **cluster PostgreSQL 18.4 desechable** en el puerto 55432, base `gyr_test`, aislado de producción.

### 5.2 Verificación realizada

Se recreó `gyr_test` desde cero y se ejecutó:

```bash
npx prisma migrate deploy
```

Resultado:

```
5 migrations found in prisma/migrations
Applying migration `001_init`
Applying migration `002_catalogo`
Applying migration `003_idempotencia`
Applying migration `004_normalizacion_identificadores`
Applying migration `005_integridad_inventario`
All migrations have been successfully applied.
```

Verificación física posterior con `psql`:

| Verificación | Resultado |
|--------------|-----------|
| Versión del servidor | PostgreSQL 18.4 |
| Migraciones aplicadas | 5 |
| Columna `InventoryReservation.idempotencyKey` | `text`, `NOT NULL` |
| CHECK constraints de inventario | 11 |
| Roles en BD | `ADMIN`, `CLIENTE`, `INVENTARIO`, `VENDEDOR` |
| Columnas de `Inventory` | `id`, `productId`, `quantityOnHand`, `quantityReserved`, `minStockAlert`, `updatedAt` |
| Prisma Client contra la BD migrada | `PRISMA_OK [{"name":"INVENTARIO"}]` |

### 5.3 Acción pendiente para producción

Cuando se autorice y se proporcione la conexión real:

```bash
# 1. Configurar DATABASE_URL de producción en el entorno seguro
# 2. Realizar respaldo verificable de la base
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status
```

No se debe ejecutar `prisma db push` en producción ni usar `migrate reset`. Las migraciones son aditivas/restrictivas y no eliminan tablas ni columnas con datos.

---

## 6. Corrección 4 — Idempotencia obligatoria

### 6.1 Contrato

La creación de reservas exige una clave por operación, enviada en el header `Idempotency-Key` o en el campo `idempotencyKey` del cuerpo.

| Situación | HTTP | Código |
|-----------|------|--------|
| Sin clave | `400` | `IDEMPOTENCY_KEY_REQUIRED` |
| Header y body presentes pero distintos | `400` | `IDEMPOTENCY_KEY_MISMATCH` |
| Reintento idéntico (mismo payload) | `200` | `success: true`, `replayed: true`, misma reserva |
| Primera creación | `201` | `success: true`, `replayed: false` |
| Clave reutilizada con payload distinto | `409` | `IDEMPOTENCY_KEY_REUSED` |
| Carrera perdida por `UNIQUE` (`P2002`) con payload idéntico | `200` | Devuelve la reserva ganadora |
| Timeout transaccional (`P2028`) | `503` | `TRANSACTION_TIMEOUT` |

La comparación de payload incluye `productId`, `quantity`, `reference` y `expiresAt`.

### 6.2 Base de datos

- `idempotencyKey` es `TEXT NOT NULL` y tiene restricción `UNIQUE`.
- Existe un `CHECK` que exige longitud mayor a cero tras `btrim`.
- Se eliminó el índice redundante `idx_inventoryReservation_idempotencyKey`; el índice único de la restricción es suficiente.
- La clave es **global**: un cliente debe generar una clave nueva por cada operación.

### 6.3 Evidencia

```
✓ 10 solicitudes simultáneas con la misma clave crean una sola reserva
✓ un reintento secuencial devuelve la misma reserva
✓ rechaza reutilizar la clave con un payload distinto
✓ exige una clave de idempotencia
✓ rechaza que header y body tengan claves distintas
```

---

## 7. Corrección 5 — Rol `INVENTARIO` independiente

### 7.1 Decisión de diseño

`INVENTARIO` **no** pertenece a la jerarquía `CLIENTE < VENDEDOR < ADMIN`. Es un rol funcional ortogonal que se concede explícitamente.

```ts
ROLE_LEVELS = { CLIENTE: 1, VENDEDOR: 2, ADMIN: 3 }
INVENTORY_ROLES = ["INVENTARIO", "ADMIN"]
canAccessInventory(roles) = roles incluye INVENTARIO o ADMIN
```

Consecuencias intencionales:

- `VENDEDOR` conserva su rol y su nivel jerárquico, pero **ya no obtiene acceso implícito al inventario**.
- Un usuario que necesite operar inventario debe tener el rol `INVENTARIO` asignado, además de su rol comercial si aplica.
- `ADMIN` conserva acceso completo.
- Esta corrección no se debe revertir silenciosamente para “mantener compatibilidad”; es un cambio de permisos deliberado.

### 7.2 Matriz de permisos vigente

| Función | Público | CLIENTE | VENDEDOR | INVENTARIO | ADMIN |
|---------|---------|---------|----------|------------|-------|
| Ver productos activos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear/editar productos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver categorías activas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Administrar categorías | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar precios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar precios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar inventario | ❌ | ❌ | ❌ | ✅ | ✅ |
| Registrar movimientos | ❌ | ❌ | ❌ | ✅ | ✅ |
| Crear reservas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Liberar reservas | ❌ | ❌ | ❌ | ✅ | ✅ |

### 7.3 Evidencia

```
✓ permite INVENTARIO y ADMIN; rechaza VENDEDOR y CLIENTE
✓ protege la consulta GET de inventario
✓ VENDEDOR no puede registrar movimientos de inventario
```

---

## 8. Hallazgo adicional — Desfase de identificadores SQL/Prisma

### 8.1 Problema detectado

Al aplicar las migraciones desde cero, `004_integridad_inventario` falló con:

```
ERROR: column "quantityOnHand" does not exist
HINT: Perhaps you meant to reference the column "Inventory.quantityonhand".
```

Causa: las migraciones `001`–`003` crearon columnas sin comillas. PostgreSQL pliega los identificadores sin comillas a minúsculas, por lo que la base quedó con `passwordhash`, `quantityonhand`, etc., mientras Prisma espera `"passwordHash"`, `"quantityOnHand"`, etc. Ninguna consulta de Prisma habría funcionado contra ese esquema.

### 8.2 Solución

Se agregó la migración `004_normalizacion_identificadores`:

- Renombra las columnas existentes al camelCase que usa Prisma.
- Es condicional: si la columna ya tiene el nombre correcto, no hace nada.
- Si ambas variantes coexisten, aborta para evitar datos ambiguos.
- No elimina tablas, columnas ni datos.
- Los índices, claves foráneas y CHECK constraints se actualizan automáticamente con el renombrado.

Después se agregó `005_integridad_inventario`, que aplica las restricciones y el rol independiente.

Las migraciones `001`–`003` se conservan sin cambios como historia. Una instalación limpia aplica las cinco en orden y termina con el esquema correcto.

---

## 9. Cambio adicional — Filtro `lowStock` y paginación

Durante la revisión se corrigió un bug real en `GET /api/inventory`:

- El parámetro `lowStock` se aceptaba pero el filtro no se aplicaba.
- `pagination.total` devolvía el tamaño de la página, no el total real.

Comportamiento actual:

- `lowStock=true` obtiene los IDs con `quantityOnHand <= minStockAlert` mediante SQL y pagina sobre ese conjunto.
- `total` y `totalPages` reflejan el conjunto filtrado completo.
- La paginación se valida con `PaginationSchema` (`page` positivo, `pageSize` máximo 100).

---

## 10. Verificación ejecutada

La verificación se separa por tipo. Solo se marca como ejecutado lo que realmente se ejecutó en este entorno.

### 10.1 Verificaciones estáticas

| Verificación | Comando | Resultado |
|--------------|---------|-----------|
| TypeScript | `npx tsc --noEmit` | ✅ 0 errores |
| Esquema Prisma | `npx prisma validate` | ✅ Válido; solo 2 advertencias preexistentes de `onDelete: SetNull` |
| Lint backend | `npx eslint src/app/api src/lib tests` | ✅ 0 errores, 14 advertencias |
| Lint completo | `npm run lint` | ⚠️ 6 errores y 44 advertencias, todos en frontend preexistente (ver §12) |
| Auditoría de producción | `npm audit --omit=dev` | ✅ 0 vulnerabilidades |
| Auditoría completa | `npm audit` | ⚠️ 9 advisories dev-only (8 moderadas, 1 crítica en Vitest UI) |
| Build de Next.js | `npm run build` | ✅ Exitoso; 1 warning CSS preexistente |

### 10.2 Pruebas unitarias

Comando: `npm run test:unit` (sin base de datos)

```
Test Files  3 passed (3)
Tests       28 passed (28)
```

| Archivo | Pruebas | Cobertura |
|---------|---------|-----------|
| `tests/unit/inventory-rules.test.ts` | 15 | Reservas, liberaciones, movimientos, invariantes |
| `tests/unit/roles.test.ts` | 6 | Jerarquía y rol `INVENTARIO` independiente |
| `tests/unit/validations.test.ts` | 7 | Zod de reservas y movimientos |

### 10.3 Pruebas de integración contra PostgreSQL real

Comando:

```powershell
$env:TEST_DATABASE_URL="postgresql://postgres@127.0.0.1:55432/gyr_test?schema=public"
npm run test:integration
```

```
Test Files  1 passed (1)
Tests       12 passed (12)
```

Cobertura real:

| Grupo | Pruebas |
|-------|---------|
| Autorización del rol `INVENTARIO` | 2 |
| Concurrencia y sobreventa | 3 |
| Idempotencia de reservas | 5 |
| Liberación de reservas | 2 |

Los `console.error` que aparecen durante la ejecución corresponden a los casos negativos esperados (`STOCK_INSUFICIENTE`, `RESERVA_NO_ACTIVA`, etc.); no son fallos de la suite.

### 10.4 Suite completa

Comando: `npm test`

```
Test Files  4 passed (4)
Tests       40 passed (40)
```

### 10.5 Build

Comando (valores de build no productivos):

```powershell
$env:DATABASE_URL="postgresql://postgres@127.0.0.1:55432/gyr_test?schema=public"
$env:JWT_SECRET="build-only-jwt-secret-0123456789abcdef"
$env:JWT_REFRESH_SECRET="build-only-refresh-secret-0123456789abcdef"
npm run build
```

Resultado:

- Build compilado correctamente.
- 72 páginas generadas.
- Los **18 route handlers** de API aparecen como `ƒ (Dynamic)`.
- No se introdujo caché estática en endpoints.
- Único warning: `@theme` en `src/app/globals.css`, preexistente y ajeno a esta etapa.

Los secretos usados en el build son valores ficticios de compilación; no son secretos de producción.

### 10.6 Migraciones

| Verificación | Resultado |
|--------------|-----------|
| Instalación limpia en `gyr_test` | ✅ 5/5 migraciones aplicadas |
| `prisma migrate status` | ✅ Sin migraciones pendientes |
| Consulta de Prisma Client contra la BD migrada | ✅ Correcta |
| Base de producción | ❌ No modificada; sin credenciales |

---

## 11. API de inventario — Comportamiento vigente

| Método | Endpoint | Acceso | Comportamiento |
|--------|----------|--------|----------------|
| GET | `/api/inventory` | `INVENTARIO` / `ADMIN` | Lista paginada; `lowStock=true` filtra `onHand <= minStockAlert` |
| GET | `/api/inventory/[productId]` | `INVENTARIO` / `ADMIN` | Consulta por producto; `404 INVENTARIO_NO_ENCONTRADO` si no existe |
| GET | `/api/inventory/movements` | `INVENTARIO` / `ADMIN` | Historial paginado; filtros `productId` y `movementType` |
| POST | `/api/inventory/movements` | `INVENTARIO` / `ADMIN` | Aplica reglas de movimiento y registra auditoría |
| POST | `/api/inventory/reservations` | `INVENTARIO` / `ADMIN` | Reserva idempotente con bloqueo de fila |
| DELETE | `/api/inventory/reservations/[id]` | `INVENTARIO` / `ADMIN` | Libera una reserva `ACTIVE`; UUID validado |

Todos los handlers de escritura validan CSRF y autorización en el servidor. La autorización no depende del middleware ni del cliente.

---

## 12. Archivos modificados y creados

### 12.1 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `next-env.d.ts` | Regenerado por `next build` (referencias de `.next/dev` a `.next/types`) |
| `package.json` | Scripts de prueba; `@prisma/client` y `prisma` fijados en `5.22.0`; Vitest `4.0.18` |
| `package-lock.json` | Resolución consistente con las versiones fijadas |
| `prisma/schema.prisma` | `idempotencyKey` obligatorio y eliminación del índice redundante |
| `src/app/api/auth/login/route.ts` | Eliminación de `dynamic = "force-dynamic"` para Next 16 |
| `src/app/api/auth/logout/route.ts` | Eliminación de `dynamic = "force-dynamic"` |
| `src/app/api/auth/me/route.ts` | Eliminación de `dynamic` y de `any` en roles |
| `src/app/api/auth/register/route.ts` | Eliminación de `dynamic = "force-dynamic"` |
| `src/app/api/categories/[id]/route.ts` | Eliminación de `dynamic = "force-dynamic"` |
| `src/app/api/categories/route.ts` | Eliminación de `dynamic` y de `any` en el mapeo |
| `src/app/api/inventory/[productId]/route.ts` | Autorización explícita con `canAccessInventory` y eliminación de `dynamic` |
| `src/app/api/inventory/movements/route.ts` | Reglas puras, bloqueo de fila, autorización explícita y auditoría transaccional |
| `src/app/api/inventory/reservations/route.ts` | Idempotencia obligatoria, bloqueo, replay/conflicto, timeout y auditoría transaccional |
| `src/app/api/inventory/route.ts` | Filtro `lowStock`, paginación correcta, autorización explícita y eliminación de `dynamic` |
| `src/app/api/products/[id]/price/route.ts` | Eliminación de `dynamic = "force-dynamic"` |
| `src/app/api/products/[id]/prices/route.ts` | Eliminación de `dynamic` y de `any` en el mapeo |
| `src/app/api/products/[id]/route.ts` | Eliminación de `dynamic = "force-dynamic"` |
| `src/app/api/products/route.ts` | Eliminación de `dynamic` y de `any` en el mapeo |
| `src/app/api/roles/route.ts` | Tipado de relaciones anidadas y eliminación de `any` |
| `src/app/api/users/[id]/route.ts` | Eliminación de `any` en roles |
| `src/app/api/users/route.ts` | Eliminación de `any` en roles |
| `src/lib/auth.ts` | Tipado de opciones JWT sin `any` |
| `src/lib/authz.ts` | Re-exportación de reglas puras y tipado de roles |
| `src/lib/db.ts` | Eliminación de `@ts-ignore` |
| `src/lib/validations.ts` | Clave de idempotencia con `trim`, mínimo 1 y máximo 255 |

### 12.2 Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `prisma/migrations/004_normalizacion_identificadores/migration.sql` | Normaliza identificadores a camelCase para Prisma |
| `prisma/migrations/005_integridad_inventario/migration.sql` | Idempotencia `TEXT NOT NULL`, CHECK constraints y rol `INVENTARIO` |
| `src/app/api/inventory/reservations/[id]/route.ts` | Liberación de reservas con UUID, bloqueo y revalidación |
| `src/lib/inventory-locks.ts` | Bloqueos `FOR UPDATE` con orden global |
| `src/lib/inventory-rules.ts` | Invariantes puras de inventario |
| `src/lib/inventory-serializers.ts` | Serialización compartida de reservas |
| `src/lib/roles.ts` | Reglas puras de roles y `canAccessInventory` |
| `tests/global-setup.ts` | Migración de la BD de pruebas con protección de nombre |
| `tests/setup.ts` | Variables de entorno de prueba |
| `tests/integration/inventory-api.test.ts` | 12 pruebas contra PostgreSQL real |
| `tests/unit/inventory-rules.test.ts` | 15 pruebas de reglas de inventario |
| `tests/unit/roles.test.ts` | 6 pruebas de roles |
| `tests/unit/validations.test.ts` | 7 pruebas de Zod |
| `vitest.config.ts` | Configuración de Vitest con alias `@` |

---

## 13. Archivos y activos no modificados

| Elemento | Estado |
|----------|--------|
| `src/data/products.ts` y los 34 productos | Sin cambios; no se inventaron precios, SKU ni especificaciones |
| Identidad visual, logotipos y assets de marca | Sin cambios |
| Slugs, rutas y páginas del sitio original | Sin cambios |
| `next.config.ts` | Sin cambios (`cacheComponents: true` se mantiene) |
| `middleware.ts` | Sin cambios |
| `tsconfig.json` | Sin cambios |
| `src/app/checkout/page.tsx`, `src/app/perfil/page.tsx`, `src/hooks/use-cart.tsx`, `src/components/sections/category-page.tsx` | Sin cambios; conservan errores de lint preexistentes |
| Base de datos de producción | Sin cambios; no fue contactada |

---

## 14. Problemas pendientes y riesgos

| # | Problema | Impacto | Acción requerida |
|---|----------|---------|------------------|
| 1 | Sin `DATABASE_URL` de producción | Las migraciones no están aplicadas en producción | Proporcionar credenciales autorizadas, respaldar y ejecutar `prisma migrate deploy` |
| 2 | Lint completo con 6 errores preexistentes de frontend | `npm run lint` sale con código 1 | Corregir en una tarea de frontend separada; no se tocaron archivos ajenos a la Etapa 3 |
| 3 | 9 advisories dev-only en `npm audit` | No afectan el bundle de producción | Evaluar actualización de Vitest/ESLint cuando sea compatible; no usar `npm audit fix --force` sin revisión |
| 4 | Prueba de concurrencia funcional, no benchmark de capacidad | No mide latencia bajo carga sostenida | Ejecutar prueba de carga antes de producción si el negocio lo requiere |
| 5 | Migración `003` creó la columna de idempotencia nullable | Ya corregida por `005`; una instalación limpia termina correcta | Mantener `001`–`003` como historia; no editar migraciones aplicadas |

### Detalle del lint preexistente

Los 6 errores están fuera del backend de la Etapa 3:

- `src/app/checkout/page.tsx`: `react-hooks/set-state-in-effect`, `@typescript-eslint/no-explicit-any`.
- `src/app/perfil/page.tsx`: `react-hooks/set-state-in-effect`, `react-hooks/immutability`.
- `src/components/sections/category-page.tsx`: `react-hooks/static-components`.
- `src/hooks/use-cart.tsx`: `react-hooks/set-state-in-effect`.

El lint acotado al backend (`src/app/api`, `src/lib`, `tests`) queda en **0 errores y 14 advertencias**.

### Detalle de `npm audit`

- `npm audit --omit=dev`: **0 vulnerabilidades**.
- `npm audit`: **9 advisories dev-only** (8 moderadas, 1 crítica). La crítica corresponde al servidor UI de Vitest; no forma parte del runtime de producción. `npm audit fix --force` instalaría una versión fuera del rango fijado y no se aplicó.

---

## 15. Estado final

- ✅ Los 5 hallazgos de la auditoría están corregidos o verificados.
- ✅ Se detectó y corrigió un sexto problema crítico de identificadores que impedía usar Prisma contra el esquema migrado.
- ✅ 28/28 pruebas unitarias y 12/12 pruebas de integración contra PostgreSQL real.
- ✅ `tsc`, `prisma validate` y build de Next.js sin errores.
- ✅ 5/5 migraciones aplicadas en una base limpia desechable.
- ✅ 0 vulnerabilidades de producción.
- ⚠️ Migraciones de producción pendientes por falta de credenciales autorizadas.
- ⚠️ Lint completo con 6 errores preexistentes de frontend, fuera del alcance de la Etapa 3.
- ⛔ La Etapa 4 **no** se ha iniciado.

**Detenido al finalizar las correcciones de la Etapa 3. Se requiere autorización expresa para aplicar migraciones en producción y para iniciar la Etapa 4.**
