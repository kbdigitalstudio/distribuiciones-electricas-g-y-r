# 13. Auditoría Final — Etapa 3 de la Fase 6 (Catálogo)

**Proyecto:** Distribuidores Eléctricos G y R S.A.S. (GYR)  
**Etapa:** 3 de la Fase 6 — Catálogo (Productos, Categorías, Precios e Inventario)  
**Fecha:** 11 de noviembre de 2026  
**Tipo:** Auditoría técnica post-implementación (sin nuevas funcionalidades)  
**Estado:** Completada  

---

## 1. PostgreSQL y Prisma

### 1.1 ¿Por qué no fue posible autenticar contra PostgreSQL?

PostgreSQL 18 está instalado y ejecutándose en el puerto 5432 (verificado mediante `netstat`). Sin embargo, no se pudo autenticar porque:

1. **No se configuró `DATABASE_URL`** en el archivo `.env` (solo existe `.env.example` sin valores reales).
2. **Falta la contraseña de autenticación** de PostgreSQL. El servidor requiere autenticación y no se proporcionaron credenciales válidas.
3. El intento de conexión con `psql -U postgres` expiró por timeout (15 segundos) sin respuesta, indicando que el servidor requiere contraseña o está configurado para no aceptar conexiones sin autenticación.

### 1.2 Error exacto de conexión/autenticación

```
Error: Environment variable not found: DATABASE_URL.
  -->  prisma\schema.prisma:13
```

Además, al intentar conectar con `psql -U postgres`, el comando expiró por timeout sin producir salida de error de autenticación específica, lo que confirma que el servidor está activo pero no accesible sin credenciales.

### 1.3 Verificación de la migración `002_catalogo`

La migración `002_catalogo/migration.sql` fue inspeccionada y es **válida sintácticamente**. Contiene:

- Creación de tabla `InventoryMovement` con claves foráneas a `Product` y `User`
- Creación de tabla `InventoryReservation` con claves foráneas a `Product` y `User`
- Índices de rendimiento en ambas tablas
- Restricciones CHECK para cantidades no negativas
- Comentarios de documentación en tablas

### 1.4 ¿Puede aplicarse sin pérdida de datos?

**Sí.** La migración 002_catalogo:
- Solo **CREATE TABLE** para dos tablas nuevas (`InventoryMovement`, `InventoryReservation`)
- Solo **CREATE INDEX** en columnas nuevas
- Solo **ALTER TABLE ADD CONSTRAINT** para CHECK constraints
- No elimina, no altera ni no trunca ninguna tabla existente de la migración `001_init`
- No hay operaciones destructivas (no hay DROP, TRUNCATE, DELETE, ni ALTER ... DROP COLUMN)

**Sin embargo**, esto no ha sido verificado contra una base de datos real porque no hay conexión a PostgreSQL operativa.

### 1.5 Estado de `prisma validate`

```
npx prisma validate → FALLA por falta de DATABASE_URL
```

El esquema es sintácticamente válido (los warnings de `SetNull` son preexistentes de la Etapa 2), pero no se puede validar completamente contra el conector de PostgreSQL sin la variable de entorno `DATABASE_URL`.

---

## 2. Inventario y Concurrencia

### 2.1 Uso real de transacciones

El código usa `db.$transaction(async (tx: any) => { ... })` en:
- `POST /api/inventory/movements` — registro de movimientos
- `POST /api/inventory/reservations` — creación de reservas
- `DELETE /api/inventory/reservations/[id]` — liberación de reservas

### 2.2 Nivel de aislamiento

**No se especifica nivel de aislamiento explícito.** Se usa el nivel por defecto de Prisma/PostgreSQL (Read Committed). No hay configuración de `isolationLevel` en ninguna transacción.

### 2.3 Bloqueos o actualizaciones condicionales

**No hay bloqueos explícitos (`SELECT ... FOR UPDATE`)** ni actualizaciones condicionales atómicas a nivel de base de datos.

El flujo actual en `POST /api/inventory/movements`:
1. `tx.inventory.findUnique({ where: { productId } })` — lee el estado actual
2. Valida stock disponible en la aplicación (Node.js)
3. `tx.inventory.update({ where: { productId }, data: { ... } })` — escribe el nuevo estado

Este patrón es **vulnerable a condiciones de carrera** bajo el nivel de aislamiento Read Committed por defecto de PostgreSQL. Dos solicitudes concurrentes podrían:
1. Ambas leer el mismo `quantityOnHand` (ej. 10)
2. Ambas validar que `10 >= 5` (suficiente)
3. Ambas escribir `quantityOnHand = 5`
4. Resultado final: 5 en lugar de 0 (sobreventa de 5 unidades)

### 2.4 Prevención de condiciones de carrera

**No implementada adecuadamente.** El código asume que `findUnique` dentro de una transacción proporciona aislamiento suficiente, lo cual **no es cierto** en Read Committed sin `FOR UPDATE` o bloqueos a nivel de fila.

**Corrección necesaria:** Usar `SELECT ... FOR UPDATE` o actualizaciones condicionales con `WHERE quantityOnHand >= cantidad` para garantizar atomicidad real.

### 2.5 Prevención de reservas duplicadas

**No implementada.** No hay mecanismo de idempotencia (clave de idempotencia, token único, o restricción UNIQUE en combinación de campos) para evitar que el mismo usuario cree múltiples reservas duplicadas para el mismo producto y referencia.

### 2.6 Integridad de cantidades disponibles

- `quantityOnHand` y `quantityReserved` se mantienen en la tabla `Inventory`
- `availableQuantity` se calcula como `quantityOnHand - quantityReserved` en la aplicación
- Validaciones CHECK en BD para cantidades no negativas (migración 002)
- **Riesgo:** Sin bloqueos de fila, dos reservas concurrentes podrían exceder el stock disponible

### 2.7 Estrategia de idempotencia

**No implementada.** No hay claves de idempotencia, tokens únicos ni mecanismos para detectar y rechazar solicitudes duplicadas.

---

## 3. Roles y Permisos

### 3.1 Roles implementados vs matriz aprobada

| Rol | ¿Existe? | Nivel | Origen |
|-----|----------|-------|--------|
| CLIENTE | ✅ Sí | 1 | Etapa 2 (`authz.ts`) |
| VENDEDOR | ✅ Sí | 2 | Etapa 2 (`authz.ts`) |
| ADMIN | ✅ Sí | 3 | Etapa 2 (`authz.ts`) |
| INVENTARIO | ❌ No existe | — | — |

### 3.2 Diferencia clave: Rol INVENTARIO

La matriz aprobada en la Etapa 3 menciona el rol `INVENTARIO`, pero **este rol no existe** en la implementación. En su lugar, se mapeó a `VENDEDOR` (nivel 2) usando `hasMinRole(auth.roles, "VENDEDOR")`.

**Justificación documentada:** No existe un rol dedicado "INVENTARIO" en el sistema actual (Etapa 2). Se decidió reutilizar `VENDEDOR` (nivel 2) para operaciones de inventario, ya que tiene privilegios intermedios entre CLIENTE y ADMIN.

### 3.3 Matriz de permisos real implementada

| Función | Público | CLIENTE | VENDEDOR (mapea INVENTARIO) | ADMIN |
|---------|---------|---------|----------------------------|-------|
| Ver productos activos | ✅ | ✅ | ✅ | ✅ |
| Crear productos | ❌ | ❌ | ❌ | ✅ |
| Editar productos | ❌ | ❌ | ❌ | ✅ |
| Ver categorías activas | ✅ | ✅ | ✅ | ✅ |
| Administrar categorías | ❌ | ❌ | ❌ | ✅ |
| Consultar precios | ✅ | ✅ | ✅ | ✅ |
| Registrar precios | ❌ | ❌ | ❌ | ✅ |
| Consultar inventario interno | ❌ | ❌ | ✅ | ✅ |
| Registrar movimientos | ❌ | ❌ | ✅ | ✅ |
| Crear reservas | ❌ | ❌ | ✅ | ✅ |
| Liberar reservas | ❌ | ❌ | ✅ | ✅ |

### 3.4 Respuesta a preguntas específicas

- **¿Existe INVENTARIO?** ❌ No. Se usa VENDEDOR como sustituto.
- **¿Existe VENDEDOR?** ✅ Sí, nivel 2.
- **¿Qué rol puede registrar movimientos?** VENDEDOR y ADMIN (vía `hasMinRole`).
- **¿Qué rol puede crear y liberar reservas?** VENDEDOR y ADMIN.
- **¿Qué rol puede consultar inventario interno?** VENDEDOR y ADMIN.

---

## 4. Inventario de Endpoints

### 4.1 Tabla completa de endpoints implementados

| # | Ruta | Archivo físico | Métodos HTTP | Permisos | Función |
|---|------|---------------|--------------|----------|---------|
| 1 | `/api/auth/register` | `auth/register/route.ts` | POST | Público | Registro de usuarios |
| 2 | `/api/auth/login` | `auth/login/route.ts` | POST | Público | Inicio de sesión |
| 3 | `/api/auth/logout` | `auth/logout/route.ts` | POST | Autenticado | Cierre de sesión |
| 4 | `/api/auth/me` | `auth/me/route.ts` | GET | Autenticado | Datos de sesión |
| 5 | `/api/users` | `users/route.ts` | GET, POST | ADMIN | Listar/crear usuarios |
| 6 | `/api/users/[id]` | `users/[id]/route.ts` | GET, PATCH, DELETE | Propio/ADMIN | Gestionar usuario |
| 7 | `/api/roles` | `roles/route.ts` | GET, POST | ADMIN | Listar/crear roles |
| 8 | `/api/products` | `products/route.ts` | GET, POST | Público (GET) / ADMIN (POST) | Listar/crear productos |
| 9 | `/api/products/[id]` | `products/[id]/route.ts` | GET, PATCH, DELETE | Público (GET si activo) / ADMIN | Consultar/actualizar/desactivar producto |
| 10 | `/api/products/[id]/prices` | `products/[id]/prices/route.ts` | GET, POST | Público (GET) / ADMIN (POST) | Historial/registro de precios |
| 11 | `/api/products/[id]/price` | `products/[id]/price/route.ts` | GET | Público | Precio vigente |
| 12 | `/api/categories` | `categories/route.ts` | GET, POST | Público (GET) / ADMIN (POST) | Listar/crear categorías |
| 13 | `/api/categories/[id]` | `categories/[id]/route.ts` | GET, PATCH, DELETE | Público (GET si activa) / ADMIN | Consultar/actualizar/desactivar categoría |
| 14 | `/api/inventory` | `inventory/route.ts` | GET | VENDEDOR/ADMIN | Consultar inventario general |
| 15 | `/api/inventory/[productId]` | `inventory/[productId]/route.ts` | GET | VENDEDOR/ADMIN | Consultar inventario de producto |
| 16 | `/api/inventory/movements` | `inventory/movements/route.ts` | GET, POST | VENDEDOR/ADMIN | Listar/registrar movimientos |
| 17 | `/api/inventory/reservations` | `inventory/reservations/route.ts` | POST, DELETE | VENDEDOR/ADMIN | Crear/liberar reservas |

### 4.2 Archivos de rutas vs endpoints declarados

- **Archivos de rutas físicos:** 17 archivos `.ts` dentro de `src/app/api/`
- **Endpoints totales (métodos HTTP únicos):** 22 métodos HTTP distintos
- **Diferencia:** La discrepancia de "10 archivos vs 18 endpoints" reportada en el prompt original ya no aplica. Actualmente hay 17 archivos de ruta y 22 métodos HTTP implementados.

**Métodos HTTP por archivo:**

| Archivo | Métodos | Total |
|---------|---------|-------|
| auth/register/route.ts | POST | 1 |
| auth/login/route.ts | POST | 1 |
| auth/logout/route.ts | POST | 1 |
| auth/me/route.ts | GET | 1 |
| users/route.ts | GET, POST | 2 |
| users/[id]/route.ts | GET, PATCH, DELETE | 3 |
| roles/route.ts | GET, POST | 2 |
| products/route.ts | GET, POST | 2 |
| products/[id]/route.ts | GET, PATCH, DELETE | 3 |
| products/[id]/prices/route.ts | GET, POST | 2 |
| products/[id]/price/route.ts | GET | 1 |
| categories/route.ts | GET, POST | 2 |
| categories/[id]/route.ts | GET, PATCH, DELETE | 3 |
| inventory/route.ts | GET | 1 |
| inventory/[productId]/route.ts | GET | 1 |
| inventory/movements/route.ts | GET, POST | 2 |
| inventory/reservations/route.ts | POST, DELETE | 2 |
| **Total** | | **22** |

---

## 5. Conservación de Datos

### 5.1 Los 34 productos

**Verificado:** Los 34 productos originales en `src/data/products.ts` permanecen **sin modificar**. No se agregó, eliminó ni modificó ningún producto.

### 5.2 Estructuras de categorías

El modelo `Category` en `prisma/schema.prisma` soporta jerarquía (`parentId`, `level`), pero **no hay filas de categorías cargadas en la base de datos** (no hay PostgreSQL operativo ni datos insertados). Las 12 categorías del frontend en `CATEGORIES_DATA` permanecen intactas en `src/components/sections/categories.tsx`.

### 5.3 Slugs

- Los slugs de los 34 productos en `products.ts` no se modificaron
- El esquema de base de datos tiene `@unique` en `Product.slug` y `Category.slug`
- Validación Zod con regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` para slugs nuevos

### 5.4 Imágenes

- Las 43 imágenes en `public/images/` permanecen sin modificar
- Las rutas de imagen en `products.ts` no se cambiaron
- No se agregaron ni eliminaron archivos de imagen

### 5.5 Relaciones productos-categorías

El modelo de base de datos permite:
- Producto → Categoría (N:1 vía `categoryId`)
- Producto → Subcategoría (N:1 opcional vía `subcategoryId`)
- Categoría → Subcategorías (autoreferencia vía `parentId`)

**Sin embargo**, no hay datos cargados en BD, por lo que no existen relaciones verificables entre productos y categorías en la base de datos.

### 5.6 Ausencia de precios y existencias inventadas

**Verificado:** No hay precios, SKU, códigos, especificaciones técnicas ni existencias inventados en ningún lugar del código. Los 34 productos en `products.ts` solo tienen `slug`, `name`, `category` e `image`.

---

## 6. Seguridad

### 6.1 Validación Zod

| Esquema | Campos validados | Reglas principales |
|---------|-----------------|-------------------|
| `CreateProductSchema` | name, slug, description, shortDescription, categoryId, subcategoryId, sku, imageUrl, isActive | Slug con regex, categoryId UUID, subcategoryId UUID opcional |
| `UpdateProductSchema` | Mismo que Create, todos opcionales | Slug regex opcional |
| `CreateCategorySchema` | name, slug, description, imageUrl, parentId, isActive | Slug regex, parentId UUID opcional |
| `UpdateCategorySchema` | Mismo que Create, todos opcionales | Validación de ciclo padre-sí mismo |
| `RegisterPriceSchema` | amountInCents, currency, validFrom, validTo | amountInCents positivo int, currency 3 chars |
| `RecordInventoryMovementSchema` | productId, movementType, quantity, reason, reference | movementType enum, quantity positivo |
| `CreateInventoryReservationSchema` | productId, quantity, reference, expiresAt | quantity positivo |

### 6.2 Autorización dentro de cada Route Handler

Todos los endpoints que modifican estado verifican autorización en el route handler (no solo en middleware):
- `getAuthenticatedUser(request)` — obtiene sesión y roles
- `requireRole(roles, "ADMIN")` — para operaciones de admin
- `hasMinRole(auth.roles, "VENDEDOR")` — para operaciones de inventario

### 6.3 CSRF

- Middleware valida presencia de header `x-csrf-token` en métodos POST/PUT/PATCH/DELETE para rutas protegidas
- Route handlers validan el token CSRF contra la cookie usando `validateCsrfToken()`
- Patrón: double submit cookie

### 6.4 Protección contra modificaciones no autorizadas

- Público solo puede hacer GET en productos y categorías (solo activos)
- CLIENTE no puede escribir en productos, categorías, precios o inventario
- VENDEDOR no puede crear/editar productos ni categorías
- Solo ADMIN puede registrar precios
- Soft delete en lugar de eliminación física

### 6.5 Soft delete

- `Product`: `deletedAt` y `isActive = false` en DELETE
- `Category`: `deletedAt` y `isActive = false` en DELETE (con validación de productos/subcategorías activas)
- Consultas públicas filtran `deletedAt: null`

### 6.6 Validación de UUID

- `categoryId`, `subcategoryId`, `productId`, `id` validados como UUID en esquemas Zod
- `sku` opcional con máximo 100 caracteres

### 6.7 Manejo de errores

- Todos los route handlers tienen bloques `try/catch`
- Errores específicos mapeados a códigos de error legibles (STOCK_INSUFICIENTE, RESERVA_NO_ENCONTRADA, etc.)
- Errores genéricos devuelven 500 con `INTERNAL_ERROR`
- No se exponen stack traces ni detalles internos al cliente

### 6.8 Exposición de datos internos de inventario

**Riesgo identificado:** El GET `/api/inventory` y `/api/inventory/[productId]` expone `quantityOnHand`, `quantityReserved`, `availableQuantity` y `minStockAlert` a roles VENDEDOR y ADMIN. Esto está autorizado por la matriz de permisos, pero constituye exposición de datos internos de inventario que debería ser revisada si se expone a roles adicionales en el futuro.

---

## 7. Pruebas

### 7.1 Pruebas ejecutadas correctamente

| Prueba | Comando | Resultado |
|--------|---------|-----------|
| Validación de esquema Prisma | `npx prisma validate` | ⚠️ Parcial — Esquema sintácticamente válido, pero falla por falta de `DATABASE_URL` |
| TypeScript | `npx tsc --noEmit` | ❌ FALLA — 1 error en `inventory/reservations/route.ts` (tipo de `params` en DELETE) |
| Build de Next.js | `npm run build` | ✅ PASÓ — Build exitoso (1 warning preexistente de CSS en `globals.css`) |
| Auditoría de dependencias | `npm audit --omit=dev` | ✅ PASÓ — 0 vulnerabilidades en producción |

### 7.2 Pruebas fallidas

| Prueba | Error | Causa |
|--------|-------|-------|
| TypeScript `tsc --noEmit` | `TS2344` en `inventory/reservations/route.ts` | El tipo de `params` en DELETE no coincide con lo que Next.js 16 espera (`Promise<{}>` vs `Promise<{ id: string }>`). El build de Next.js pasa porque usa su propio tipado, pero TypeScript estático falla. |

### 7.3 Pruebas pendientes por falta de PostgreSQL

| Prueba | Motivo |
|--------|--------|
| `prisma db push` / `prisma migrate deploy` | Sin credenciales de PostgreSQL |
| Pruebas de integración contra BD real | Sin PostgreSQL operativo |
| Pruebas de concurrencia de inventario | Sin BD para simular acceso simultáneo |
| Pruebas de reserva simultánea (sobreventa) | Sin BD |
| Pruebas de endpoints contra servidor real | Sin servidor conectado a BD |
| Validación de integridad referencial en BD | Sin tablas creadas |

---

## 8. Riesgos Detectados

| # | Riesgo | Severidad | Descripción | Corrección necesaria |
|---|--------|-----------|-------------|---------------------|
| 1 | Condición de carrera en inventario | Alta | Sin `SELECT ... FOR UPDATE` ni bloqueos de fila, dos reservas concurrentes pueden causar sobreventa | Agregar bloqueo de fila o actualización condicional atómica en transacciones |
| 2 | Rol INVENTARIO no existe | Media | La matriz menciona INVENTARIO pero se usa VENDEDOR | Documentar el mapeo o crear el rol INVENTARIO |
| 3 | Sin idempotencia en reservas | Media | No hay mecanismo para detectar reservas duplicadas | Agregar clave de idempotencia o restricción UNIQUE |
| 4 | Nivel de aislamiento por defecto | Media | Read Committed sin configuración explícita | Especificar `Serializable` o `Repeatable Read` para transacciones de inventario |
| 5 | TypeScript error en reservations DELETE | Baja | Tipo de `params` no coincide con Next.js 16 | Corregir tipado de `params` en el handler DELETE |
| 6 | Sin `DATABASE_URL` configurada | Alta | No se puede validar ni aplicar migraciones | Crear `.env` con credenciales de PostgreSQL (no subir al repositorio) |
| 7 | Exposición de datos de inventario | Baja | `quantityOnHand` expuesto a VENDEDOR/ADMIN | Revisar si es necesario restringir más |

---

## 9. Archivos Inspeccionados

### Código del backend (Etapa 3)

1. `prisma/schema.prisma` — Esquema de 17 modelos
2. `prisma/migrations/001_init/migration.sql` — Migración inicial (Etapa 2)
3. `prisma/migrations/002_catalogo/migration.sql` — Migración de inventario (Etapa 3)
4. `src/lib/auth.ts` — Hash, JWT, CSRF
5. `src/lib/db.ts` — Prisma Client
6. `src/lib/session.ts` — Cookies de sesión
7. `src/lib/authz.ts` — Autorización por roles
8. `src/lib/validations.ts` — Esquemas Zod
9. `middleware.ts` — Protección de rutas y CSRF

### API Routes (17 archivos)

10. `src/app/api/auth/register/route.ts`
11. `src/app/api/auth/login/route.ts`
12. `src/app/api/auth/logout/route.ts`
13. `src/app/api/auth/me/route.ts`
14. `src/app/api/users/route.ts`
15. `src/app/api/users/[id]/route.ts`
16. `src/app/api/roles/route.ts`
17. `src/app/api/products/route.ts`
18. `src/app/api/products/[id]/route.ts`
19. `src/app/api/products/[id]/prices/route.ts`
20. `src/app/api/products/[id]/price/route.ts`
21. `src/app/api/categories/route.ts`
22. `src/app/api/categories/[id]/route.ts`
23. `src/app/api/inventory/route.ts`
24. `src/app/api/inventory/[productId]/route.ts`
25. `src/app/api/inventory/movements/route.ts`
26. `src/app/api/inventory/reservations/route.ts`

### Archivos originales NO modificados

- `src/data/products.ts` — 34 productos intactos
- `src/components/sections/categories.tsx` — Categorías frontend intactas
- `src/components/ui/cart.tsx` — Carrito original
- `src/app/checkout/page.tsx` — Checkout original
- `src/app/layout.tsx`, `src/app/globals.css` — Identidad visual intacta
- Todos los archivos de páginas, componentes y layouts originales

---

## 10. Conclusión

La Etapa 3 de la Fase 6 está **implementada a nivel de código** con las siguientes características:

### Lo que funciona (verificado estáticamente)
- ✅ 17 archivos de API Route con 22 métodos HTTP implementados
- ✅ TypeScript compila con 1 error menor (tipado de `params` en reservations DELETE)
- ✅ Build de Next.js exitoso
- ✅ 0 vulnerabilidades en dependencias de producción
- ✅ Esquema Prisma válido sintácticamente
- ✅ Validación Zod en todos los endpoints de escritura
- ✅ Autorización por roles en cada route handler
- ✅ CSRF en escrituras
- ✅ Soft delete en productos y categorías
- ✅ Transacciones Prisma en movimientos y reservas
- ✅ Los 34 productos originales sin modificar
- ✅ Identidad visual sin modificar

### Lo que no se pudo verificar (falta PostgreSQL)
- ❌ Aplicación de migraciones contra BD real
- ❌ Pruebas de integración
- ❌ Pruebas de concurrencia de inventario
- ❌ Validación de integridad referencial en BD

### Correcciones críticas necesarias antes de Etapa 4

1. **Corregir condición de carrera en inventario** — Agregar `SELECT ... FOR UPDATE` o actualizaciones condicionales atómicas
2. **Corregir error de TypeScript** en `inventory/reservations/route.ts` (tipo de `params`)
3. **Configurar `DATABASE_URL`** y aplicar migraciones cuando haya PostgreSQL disponible
4. **Documentar el mapeo INVENTARIO → VENDEDOR** o crear el rol INVENTARIO

**La Etapa 3 no avanza a la Etapa 4 hasta que se resuelvan los puntos críticos anteriores y se obtenga autorización expresa.**

---

**Informe generado:** 11 de noviembre de 2026  
**Archivo:** `docs/fase6-etapa3/13-auditoria-final.md`