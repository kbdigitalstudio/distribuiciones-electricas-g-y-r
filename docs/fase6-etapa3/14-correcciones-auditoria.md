# 14. Correcciones Post-Auditoría — Etapa 3 de la Fase 6

**Proyecto:** Distribuidores Eléctricos G y R S.A.S. (GYR)  
**Etapa:** 3 de la Fase 6 — Catálogo (Correcciones post-auditoría)  
**Fecha:** 11 de noviembre de 2026  
**Estado:** Completado  

---

## Resumen Ejecutivo

Se resolvieron los 5 hallazgos identificados en la auditoría final de la Etapa 3:

| # | Hallazgo | Severidad | Estado | Solución |
|---|----------|-----------|--------|----------|
| 1 | Condición de carrera en reservas de inventario | Alta | ✅ Corregido | Bloqueo de fila `SELECT FOR UPDATE` en transacciones Prisma |
| 2 | Error de TypeScript en `inventory/reservations/route.ts` | Baja | ✅ Corregido | Tipo de `params` ajustado a `Promise<{ [key: string]: string }>` |
| 3 | PostgreSQL sin configurar | Alta | ⚠️ Documentado | `DATABASE_URL` documentada en `.env.example`, no se inventaron credenciales |
| 4 | Ausencia de idempotencia en reservas | Media | ✅ Corregido | Campo `idempotencyKey` con restricción UNIQUE en BD |
| 5 | Rol INVENTARIO inexistente | Media | ✅ Corregido | Rol `INVENTARIO` agregado a `ROLE_LEVELS` (nivel 2, independiente de VENDEDOR) |

---

## FASE A — Concurrencia (Bloqueo de Fila)

### Problema
Las transacciones de Prisma por sí solas no previenen condiciones de carrera. Sin bloqueo de fila, dos solicitudes concurrentes podían leer el mismo `quantityOnHand`, validar que hay stock, y ambas escribir un nuevo valor, causando sobreventa.

### Solución Implementada

Se agregó `SELECT FOR UPDATE` mediante `tx.$queryRaw` en:

| Archivo | Operación | Bloqueo |
|---------|-----------|---------|
| `src/app/api/inventory/reservations/route.ts` | POST (crear reserva) | `SELECT * FROM "Inventory" WHERE "productId" = ... FOR UPDATE` |
| `src/app/api/inventory/reservations/route.ts` | DELETE (liberar reserva) | Bloqueo de reserva + bloqueo de inventario |
| `src/app/api/inventory/movements/route.ts` | POST (registrar movimiento) | `SELECT * FROM "Inventory" WHERE "productId" = ... FOR UPDATE` |

### Orden de Bloqueo
El orden es consistente: primero se bloquea el inventario del producto, luego se realizan las operaciones. Esto reduce el riesgo de interbloqueos (deadlocks).

### Cantidades No Negativas
- Validación `available < quantity` antes de permitir `EXIT` o `RESERVATION`
- Validación `newQuantity < 0` después de cualquier ajuste
- `Math.max(0, ...)` al liberar reservas para evitar valores negativos
- Restricciones CHECK en migración `002_catalogo` para cantidades no negativas

---

## FASE B — TypeScript

### Problema
El handler `DELETE` en `inventory/reservations/route.ts` usaba `params: Promise<{ id: string }>`, pero Next.js 16 espera `params: Promise<{ [key: string]: string }>` para rutas dinámicas.

### Solución
Cambiado el tipo de `params` de `Promise<{ id: string }>` a `Promise<{ [key: string]: string }>`.

### Resultado
`npx tsc --noEmit` → **0 errores**

---

## FASE C — Idempotencia

### Problema
No había mecanismo para detectar y rechazar solicitudes de reserva duplicadas enviadas concurrentemente por el mismo cliente.

### Solución Implementada

1. **Schema de Prisma** (`prisma/schema.prisma`):
   - Campo `idempotencyKey String? @unique` agregado a `InventoryReservation`
   - Índice `@@index([idempotencyKey])` agregado

2. **Migración** (`prisma/migrations/003_idempotencia/migration.sql`):
   - `ALTER TABLE "InventoryReservation" ADD COLUMN "idempotencyKey" VARCHAR(255) NULL`
   - `ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_idempotencyKey_key" UNIQUE ("idempotencyKey")`
   - `CREATE INDEX idx_inventoryReservation_idempotencyKey ON "InventoryReservation"("idempotencyKey")`

3. **Validación Zod** (`src/lib/validations.ts`):
   - Campo `idempotencyKey: z.string().max(255).optional().nullable()` agregado a `CreateInventoryReservationSchema`

4. **Handler POST** (`src/app/api/inventory/reservations/route.ts`):
   - Si se proporciona `idempotencyKey`, se verifica si ya existe una reserva con esa clave
   - Si existe, se devuelve la reserva existente (HTTP 200) en lugar de crear una nueva
   - Error `P2002` (violación de UNIQUE) manejado específicamente con código `IDEMPOTENCY_KEY_DUPLICATE` (HTTP 409)

---

## FASE D — Rol INVENTARIO

### Problema
El rol `INVENTARIO` mencionado en la matriz de permisos no existía; se usaba `VENDEDOR` como sustituto.

### Solución Implementada

1. **`src/lib/authz.ts`**:
   - Agregado `INVENTARIO: 2` a `ROLE_LEVELS` (mismo nivel que `VENDEDOR`, independiente)
   - Función `isInventoryAuthorized(roles)` que usa `hasMinRole(roles, "INVENTARIO")`

2. **Rutas de inventario actualizadas** para usar `isInventoryAuthorized`:
   - `src/app/api/inventory/route.ts` (GET)
   - `src/app/api/inventory/[productId]/route.ts` (GET)
   - `src/app/api/inventory/movements/route.ts` (GET, POST)
   - `src/app/api/inventory/reservations/route.ts` (POST, DELETE)

### Matriz de Permisos Actualizada

| Función | Público | CLIENTE | VENDEDOR | INVENTARIO | ADMIN |
|---------|---------|---------|----------|------------|-------|
| Ver productos activos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear/editar productos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver categorías activas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Administrar categorías | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar precios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar precios | ❌ | ❌ | ❌ | ❌ | ✅ |
| Consultar inventario | ❌ | ❌ | ✅ | ✅ | ✅ |
| Registrar movimientos | ❌ | ❌ | ✅ | ✅ | ✅ |
| Crear reservas | ❌ | ❌ | ✅ | ✅ | ✅ |
| Liberar reservas | ❌ | ❌ | ✅ | ✅ | ✅ |

**Nota:** `VENDEDOR` mantiene acceso (nivel 2 = nivel de `INVENTARIO`), por lo que usuarios existentes con rol `VENDEDOR` no pierden acceso.

---

## FASE E — PostgreSQL

### Estado
PostgreSQL 18 está instalado en el puerto 5432, pero **no se pudo autenticar** porque:
- No hay `DATABASE_URL` configurada con credenciales reales
- No se proporcionó contraseña de PostgreSQL

### Archivo `.env.example`
Documentado con comentario explicativo:
```
# Base de datos PostgreSQL (requerido)
# Configurar con credenciales reales antes de ejecutar npx prisma db push
# Ejemplo: postgresql://usuario:contraseña@localhost:5432/gyr_db?schema=public
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/gyr_db?schema=public"
```

### No se realizaron:
- ❌ Conexión a base de datos operativa
- ❌ Aplicación de migraciones (`prisma db push` / `prisma migrate deploy`)
- ❌ Inserción de datos comerciales
- ❌ Invención de credenciales

---

## FASE F — Validación

### Pruebas Ejecutadas

| Prueba | Comando | Resultado | Detalle |
|--------|---------|-----------|---------|
| TypeScript | `npx tsc --noEmit` | ✅ PASÓ | 0 errores |
| Build de Next.js | `npm run build` | ✅ PASÓ | Build exitoso (1 warning preexistente de CSS en `globals.css`, no relacionado con esta etapa) |
| Auditoría de dependencias | `npm audit --omit=dev` | ✅ PASÓ | 0 vulnerabilidades en producción |
| Validación de Prisma | `npx prisma validate` | ⚠️ Parcial | Esquema sintácticamente válido, pero falla por falta de `DATABASE_URL` (sin PostgreSQL operativo) |
| Generación de cliente Prisma | `npx prisma generate` | ❌ Pendiente | Requiere `DATABASE_URL` y scripts de instalación autorizados |

### Pruebas No Ejecutadas (requieren PostgreSQL)

| Prueba | Motivo |
|--------|--------|
| Pruebas de integración contra BD real | Sin credenciales de PostgreSQL |
| Pruebas de concurrencia de inventario | Sin BD para simular acceso simultáneo |
| Pruebas de idempotencia contra BD real | Sin tabla `InventoryReservation` creada |
| Pruebas de autorización de INVENTARIO contra BD real | Sin usuarios con rol INVENTARIO creados |

### Archivos de Prueba Unitarias
No se crearon archivos de prueba unitarias porque no hay framework de testing configurado en el proyecto y no se puede ejecutar contra PostgreSQL. Las pruebas de concurrencia e idempotencia están documentadas como pendientes.

---

## Archivos Modificados

| Archivo | Cambio | FASE |
|---------|--------|------|
| `prisma/schema.prisma` | Agregado `idempotencyKey` con `@unique` e índice en `InventoryReservation` | C |
| `prisma/migrations/003_idempotencia/migration.sql` | Nueva migración: columna `idempotencyKey`, restricción UNIQUE, índice | C |
| `src/lib/authz.ts` | Agregado `INVENTARIO: 2` a `ROLE_LEVELS` | D |
| `src/lib/validations.ts` | Agregado `idempotencyKey` a `CreateInventoryReservationSchema` | C |
| `src/app/api/inventory/reservations/route.ts` | Bloqueo de fila (SELECT FOR UPDATE), idempotencia, rol INVENTARIO, TypeScript corregido | A, B, C, D |
| `src/app/api/inventory/movements/route.ts` | Bloqueo de fila (SELECT FOR UPDATE), rol INVENTARIO | A, D |
| `src/app/api/inventory/route.ts` | Rol INVENTARIO en lugar de VENDEDOR | D |
| `src/app/api/inventory/[productId]/route.ts` | Rol INVENTARIO en lugar de VENDEDOR | D |
| `.env.example` | Documentación de `DATABASE_URL` | E |

---

## Archivos NO Modificados

| Archivo | Razón |
|---------|-------|
| `src/data/products.ts` | 34 productos originales intactos |
| `src/components/sections/categories.tsx` | Categorías frontend intactas |
| `src/app/checkout/page.tsx` | Checkout original (Etapa 5) |
| `src/hooks/use-cart.tsx` | Carrito original |
| `src/lib/auth.ts` | Autenticación Etapa 2 (reutilizado) |
| `src/lib/db.ts` | Conexión BD Etapa 2 (reutilizado) |
| `src/lib/session.ts` | Sesiones Etapa 2 (reutilizado) |
| `next.config.ts`, `tsconfig.json` | Configuración original sin cambios |
| Archivos de identidad visual | Sin modificar |

---

## Problemas Pendientes

| # | Problema | Motivo | Acción requerida |
|---|----------|--------|------------------|
| 1 | PostgreSQL no configurado | Falta `DATABASE_URL` con credenciales reales | Configurar `.env`, ejecutar `npx prisma generate` y `npx prisma db push` |
| 2 | Pruebas de integración no ejecutadas | Sin BD operativa | Ejecutar cuando haya PostgreSQL disponible |
| 3 | Pruebas de concurrencia no verificadas | Sin BD para simular acceso simultáneo | Ejecutar pruebas de carga contra BD PostgreSQL |
| 4 | Pruebas de idempotencia no verificadas | Sin tabla `InventoryReservation` creada | Ejecutar cuando migración `003_idempotencia` esté aplicada |

---

## Estado Final de la Etapa 3

La Etapa 3 está **completa a nivel de código** con todas las correcciones de la auditoría aplicadas:

- ✅ Concurrencia resuelta con `SELECT FOR UPDATE`
- ✅ TypeScript sin errores
- ✅ Idempotencia implementada con restricción UNIQUE en BD
- ✅ Rol `INVENTARIO` independiente creado
- ✅ Build exitoso
- ✅ 0 vulnerabilidades en producción
- ⚠️ Migraciones no aplicadas (falta PostgreSQL operativo)
- ⚠️ Pruebas de integración pendientes (falta PostgreSQL)

**Detenido al finalizar las correcciones.** Esperando autorización para continuar con la Etapa 4.
