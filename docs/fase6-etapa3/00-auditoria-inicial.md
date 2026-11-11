# 00. Auditoría Inicial — Etapa 3 (Catálogo)

**Proyecto:** Distribuidores Eléctricos G y R S.A.S. (GYR)  
**Etapa:** 3 de la Fase 6 — Catálogo (Productos, Categorías, Precios e Inventario)  
**Fecha:** 11 de noviembre de 2026  
**Estado:** En ejecución  

## 1. Estado de la Base de Datos

| Elemento | Estado | Detalle |
|----------|--------|---------|
| PostgreSQL instalado | ✅ Sí | Versión 18 en `C:\Program Files\PostgreSQL\18\bin` |
| psql en PATH | ❌ No | No está en el PATH del sistema |
| Servidor PostgreSQL corriendo | ❓ No verificado | No se pudo confirmar si hay un servidor operativo |
| Base de datos `gyr_db` | ❓ No verificada | No se pudo confirmar existencia |
| Migración `001_init` aplicada | ❌ No | No hay BD operativa para aplicar |

**Conclusión:** No hay una base de datos PostgreSQL operativa disponible en este entorno. Todas las migraciones y pruebas de integración quedan preparadas y documentadas, pero no ejecutadas contra BD real.

## 2. Estado de Prisma

| Elemento | Estado | Detalle |
|----------|--------|---------|
| `prisma/schema.prisma` | ✅ Existe | 15 tablas definidas (User, Role, Permission, UserRole, RolePermission, Customer, Category, Product, Price, Inventory, Quote, QuoteItem, Order, OrderItem, OperationLog, LoginAttempt) |
| `prisma/migrations/001_init/migration.sql` | ✅ Existe | Migración inicial con las 15 tablas |
| `prisma generate` | ❌ No ejecutado | Requiere scripts de instalación autorizados y no se ejecutó por restricciones del entorno |
| `@prisma/client` tipado | ⚠️ Parcial | Se usa `@ts-ignore` en `src/lib/db.ts` hasta que se ejecute `prisma generate` |

## 3. Estructura Actual de Productos (`src/data/products.ts`)

| Métrica | Valor |
|---------|-------|
| Total de productos | 34 |
| Campos por producto | slug, name, category, image (description opcional, no usada) |
| Precio | ❌ No disponible ("A cotizar") |
| SKU / Código | ❌ No disponible |
| Especificaciones técnicas | ❌ No disponible |
| Stock / Existencia | ❌ No disponible |

**Categorías en products.ts (con posibles duplicados):**
Alta Tensión, Media Tensión, Baja Tensión, Conductores Eléctricos, Transformadores, Tubería, Maniobra, Medidores de Energía, Puesta a Tierra, Herrajería, Cajas y Tableros, Accesorios para Red Ecológica, Accesorios para Red Trenzada

**Observación:** Hay nombres de categoría duplicados con significados diferentes (ej. "Transformador de Distribución" en Media Tensión y Transformadores; "Tableros Alumbrado NQ" en Baja Tensión y Cajas y Tableros; "Crucetas Metálicas" en Media Tensión y Herrajería). Esto se resuelve con el modelo jerárquico de `Category` (parentId).

## 4. Estructura de Categorías

| Origen | Cantidad | Notas |
|--------|----------|-------|
| `src/components/sections/categories.tsx` (CATEGORIES_DATA) | 12 | Categorías de navegación del frontend |
| `prisma/schema.prisma` (modelo Category) | 0 filas (esquema solo) | Modelo con parentId, slug, level, isActive, deletedAt |

Las 12 categorías del frontend no coinciden exactamente con las categorías de productos en `products.ts` (13 categorías distintas). El modelo de base de datos permite reconciliar ambas mediante jerarquía.

## 5. Estado de Inventario

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Modelo `Inventory` en schema.prisma | ✅ Existe | productId (UK), quantityOnHand, quantityReserved, minStockAlert, updatedAt |
| Modelo `InventoryMovement` | ❌ No existe | Debe agregarse al esquema |
| Modelo `InventoryReservation` | ❌ No existe | Debe agregarse al esquema |
| Datos de existencias iniciales | ❌ No hay | No se inventan cantidades |
| `availableQuantity` | ⚠️ Derivada | quantityOnHand - quantityReserved (no columna propia) |

## 6. Estado de Precios

| Elemento | Estado | Detalle |
|----------|--------|---------|
| Modelo `Price` en schema.prisma | ✅ Existe | productId, priceCents (BIGINT), currency (COP), validFrom, validTo, isActive, createdAt |
| Datos de precios | ❌ No hay | No se inventan precios |
| Precios en productos actuales | ❌ "A cotizar" | Los 34 productos no tienen precio |

## 7. Dependencias Existentes

| Paquete | Versión | Propósito en Etapa 3 |
|---------|---------|----------------------|
| `@prisma/client` | 5.22.0 | ORM y acceso a BD |
| `prisma` | 5.22.0 | CLI (migraciones, generate) |
| `zod` | 3.24.2 | Validación de entrada |
| `bcryptjs` | 2.4.3 | (Etapa 2) Hash de contraseñas |
| `jsonwebtoken` | 9.0.2 | (Etapa 2) JWT |
| `cookie` | 0.7.2 | (Etapa 2) Parseo de cookies |

## 8. Riesgos Encontrados

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| No hay PostgreSQL operativo | No se pueden aplicar migraciones ni probar contra BD real | Documentar migraciones preparadas; ejecutar pruebas estáticas (tsc, build, audit) |
| `prisma generate` no ejecutado | `@prisma/client` no tiene tipos reales | Usar `@ts-ignore` en db.ts; dejar preparado para cuando se ejecute |
| Categorías duplicadas en products.ts | Confusión en mapeo a modelo jerárquico | Usar `parentId` en Category para diferenciar subcategorías |
| Sin datos de precios ni stock | No se puede mostrar precio real ni disponibilidad | Mostrar "A cotizar" y "Por confirmar" |

## 9. Archivos que Requieren Modificaciones

| Archivo | Modificación |
|---------|--------------|
| `prisma/schema.prisma` | Agregar modelos `InventoryMovement` e `InventoryReservation` |
| `prisma/migrations/002_catalogo/migration.sql` | Nueva migración para tablas de inventario (movimientos y reservas) |
| `src/lib/validations.ts` | Agregar esquemas Zod para productos, categorías, precios, inventario |
| `src/app/api/products/route.ts` | Nuevo endpoint GET/POST productos |
| `src/app/api/products/[id]/route.ts` | Nuevo endpoint GET/PATCH/DELETE producto |
| `src/app/api/categories/route.ts` | Nuevo endpoint GET/POST categorías |
| `src/app/api/categories/[id]/route.ts` | Nuevo endpoint GET/PATCH/DELETE categoría |
| `src/app/api/products/[id]/prices/route.ts` | Nuevo endpoint GET historial / POST registrar precio |
| `src/app/api/products/[id]/price/route.ts` | Nuevo endpoint GET precio vigente |
| `src/app/api/inventory/route.ts` | Nuevo endpoint GET consultar inventario |
| `src/app/api/inventory/[productId]/route.ts` | Nuevo endpoint GET inventario de producto |
| `src/app/api/inventory/movements/route.ts` | Nuevo endpoint GET/POST movimientos |
| `src/app/api/inventory/reservations/route.ts` | Nuevo endpoint POST/DELETE reservas |

## 10. Archivos que NO Deben Modificarse

| Archivo | Razón |
|---------|-------|
| `src/data/products.ts` | Datos originales de los 34 productos; no se eliminan ni sobrescriben |
| `src/components/sections/categories.tsx` | Categorías de navegación frontend originales |
| `src/app/checkout/page.tsx` | Checkout original (pendiente de Etapa 5) |
| `src/hooks/use-cart.tsx` | Carrito original (pendiente de migración en Etapa 5) |
| `src/lib/auth.ts` | Módulo de autenticación Etapa 2; se reutiliza sin modificar |
| `src/lib/db.ts` | Módulo de conexión BD; se reutiliza sin modificar |
| `src/lib/session.ts` | Módulo de sesiones; se reutiliza sin modificar |
| `src/lib/authz.ts` | Módulo de autorización; se reutiliza sin modificar |
| `middleware.ts` | Middleware de protección; se reutiliza sin modificar |
| `next.config.ts` | Configuración de Next.js original |
| `tsconfig.json` | Configuración de TypeScript original |
| Cualquier archivo de identidad visual (logo, colores, fuentes, imágenes) | Restricción innegociable de la Fase 6 |

## 11. Decisiones Tomadas (Etapa 3)

1. **Reutilizar modelos existentes:** Product, Category, Price, Inventory ya están en el schema. No se duplican.
2. **Agregar modelos faltantes:** InventoryMovement e InventoryReservation se agregan al esquema y a una nueva migración (002_catalogo).
3. **Sin datos inventados:** No se insertan precios, SKU, stock ni categorías de demostración.
4. **Precios pendientes:** Cuando no hay precio, la API devuelve un estado que permite mostrar "A cotizar".
5. **Inventario transaccional:** Los movimientos y reservas usan transacciones Prisma para evitar sobreventa.
6. **Soft delete:** Product y Category ya tienen `deletedAt`; se respeta en todas las consultas públicas.

## Siguiente Paso

Proceder a la modificación del esquema Prisma (3.2) y creación de la migración (3.3).
