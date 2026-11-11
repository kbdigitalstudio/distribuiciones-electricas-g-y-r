# 10. Archivos Creados y Modificados

## Archivos CREADOS (nuevos)

### API Routes del catálogo
1. `src/app/api/products/route.ts` — Listar y crear productos
2. `src/app/api/products/[id]/route.ts` — Consultar, actualizar, desactivar producto
3. `src/app/api/products/[id]/prices/route.ts` — Historial y registro de precios
4. `src/app/api/products/[id]/price/route.ts` — Precio vigente
5. `src/app/api/categories/route.ts` — Listar y crear categorías
6. `src/app/api/categories/[id]/route.ts` — Consultar, actualizar, desactivar categoría
7. `src/app/api/inventory/route.ts` — Consultar inventario general
8. `src/app/api/inventory/[productId]/route.ts` — Consultar inventario de producto
9. `src/app/api/inventory/movements/route.ts` — Listar y registrar movimientos
10. `src/app/api/inventory/reservations/route.ts` — Crear y liberar reservas

### Documentación
11. `docs/fase6-etapa3/00-auditoria-inicial.md`
12. `docs/fase6-etapa3/01-modelos-y-base-de-datos.md`
13. `docs/fase6-etapa3/02-migraciones.md`
14. `docs/fase6-etapa3/03-api-productos.md`
15. `docs/fase6-etapa3/04-api-categorias.md`
16. `docs/fase6-etapa3/05-api-precios.md`
17. `docs/fase6-etapa3/06-api-inventario.md`
18. `docs/fase6-etapa3/07-seguridad-y-permisos.md`
19. `docs/fase6-etapa3/08-integracion-frontend.md`
20. `docs/fase6-etapa3/09-pruebas-y-resultados.md`
21. `docs/fase6-etapa3/10-archivos-modificados.md`
22. `docs/fase6-etapa3/11-problemas-pendientes.md`
23. `docs/fase6-etapa3/12-informe-final.md`

## Archivos MODIFICADOS

| Archivo | Modificación |
|---------|--------------|
| `prisma/schema.prisma` | Agregados modelos `InventoryMovement` e `InventoryReservation` con relaciones inversas en `Product` y `User` |
| `prisma/migrations/002_catalogo/migration.sql` | Nueva migración para tablas de inventario (creado como nuevo) |
| `src/lib/validations.ts` | Agregados esquemas Zod para productos, categorías, precios, movimientos e inventario |
| `middleware.ts` | Agregadas rutas de catálogo con lectura pública y rutas de inventario protegidas |

**Nota:** `prisma/migrations/002_catalogo/migration.sql` es un archivo nuevo dentro de la carpeta de migraciones.

## Archivos NO modificados (confirmado intactos)

| Archivo | Razón |
|---------|-------|
| `src/data/products.ts` | Datos originales de los 34 productos |
| `src/components/sections/categories.tsx` | Categorías de navegación frontend |
| `src/components/ui/cart.tsx` | Carrito original |
| `src/app/checkout/page.tsx` | Checkout original |
| `src/hooks/use-cart.tsx` | Hook de carrito original |
| `src/lib/auth.ts` | Autenticación Etapa 2 (reutilizado) |
| `src/lib/db.ts` | Conexión BD Etapa 2 (reutilizado) |
| `src/lib/session.ts` | Sesiones Etapa 2 (reutilizado) |
| `src/lib/authz.ts` | Autorización Etapa 2 (reutilizado) |
| `next.config.ts` | Configuración Next.js original |
| `tsconfig.json` | Configuración TypeScript original |
| Cualquier archivo de identidad visual | Restricción innegociable de la Fase 6 |
