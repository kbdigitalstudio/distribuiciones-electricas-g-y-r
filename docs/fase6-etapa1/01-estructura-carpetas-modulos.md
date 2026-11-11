# 01. Estructura de Carpetas y Módulos Propuestos

Este documento define la estructura de carpetas y módulos que se prepararán para la futura implementación del backend de GYR. Se trata de una **estructura de preparación** — no se crean archivos de implementación funcional, solo documentación y esqueleto de organización.

## Estructura propuesta dentro de `src/`

```
src/
├── app/                    # Next.js App Router (páginas existentes — no tocar)
├── components/             # Componentes UI existentes (no tocar)
├── data/                   # Datos estáticos existentes (products.ts — no tocar)
├── hooks/                  # Hooks existentes (use-cart, etc. — no tocar)
├── services/               # Capa de servicios (NUEVO — preparación)
│   ├── auth/
│   ├── products/
│   ├── categories/
│   ├── prices/
│   ├── inventory/
│   ├── customers/
│   ├── quotes/
│   ├── orders/
│   └── operations/
├── types/                  # Tipos TypeScript existentes (user.ts — no tocar)
│   └── backend.types.ts    # NUEVO: tipos para el modelo de datos backend
├── lib/                    # Utilidades y configuración (NUEVO)
│   ├── db.ts               # NUEVO: configuración de base de datos (sin conectar)
│   └── validations.ts      # NUEVO: esquemas de validación (Zod)
└── api/                    # Route Handlers de Next.js (NUEVO — preparados, sin activar)
    ├── auth/
    ├── products/
    ├── categories/
    ├── prices/
    ├── inventory/
    ├── customers/
    ├── quotes/
    ├── orders/
    └── admin/
```

## Módulos propuestos y responsabilidades

| Módulo | Carpeta | Responsabilidad | Estado en Etapa 1 |
|--------|---------|-----------------|-------------------|
| Autenticación | `services/auth/` | Registro, login, logout, gestión de sesiones, roles | Estructura documentada |
| Productos | `services/products/` | Catálogo, detalle, búsqueda, filtros por categoría | Estructura documentada |
| Categorías | `services/categories/` | CRUD de categorías y subcategorías (jerarquía) | Estructura documentada |
| Precios | `services/prices/` | Gestión de precios, historial, rangos de validez | Estructura documentada |
| Inventario | `services/inventory/` | Stock disponible, reservas, alertas de bajo stock | Estructura documentada |
| Clientes | `services/customers/` | Datos de clientes (natural/jurídica, NIT) | Estructura documentada |
| Cotizaciones | `services/quotes/` | Solicitudes de cotización, estados, expiración | Estructura documentada |
| Pedidos | `services/orders/` | Pedidos comerciales, estados de pago, historial | Estructura documentada |
| Operaciones | `services/operations/` | Log de auditoría de acciones administrativas | Estructura documentada |
| Base de datos | `lib/db.ts` | Configuración de conexión (sin activar) | Documentada |
| Validaciones | `lib/validations.ts` | Esquemas de validación de entrada (Zod) | Documentada |

## Decisión técnica: ubicación del código backend

Se propone usar **Next.js Route Handlers** (`src/app/api/...`) para exponer los endpoints del backend. Esto permite:

- Reutilizar el mismo despliegue de Next.js para frontend y API.
- No levantar un servidor separado en esta primera versión.
- Mantener todo el código en TypeScript con las mismas convenciones del proyecto.

**Nota:** Los archivos de Route Handlers se documentan aquí pero no se implementan funcionalmente en esta etapa. Solo se prepara la estructura de carpetas y los contratos.

## Compatibilidad con Next.js 16

El proyecto usa Next.js 16.4.6 con App Router. Los Route Handlers se definen en archivos `route.ts` dentro de carpetas de `app/api/`. La configuración actual en `next.config.ts` es mínima y compatible con esta estructura.

```ts
// next.config.ts (actual, sin cambios)
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
};
```

No se requieren cambios en `next.config.ts` para preparar la estructura de API.

## Archivos creados en esta etapa

Ningún archivo de implementación funcional se crea en `src/`. Solo documentación bajo `docs/fase6-etapa1/`.

Si se desea crear una estructura de carpetas vacía como referencia, se puede hacer sin archivos de código ejecutable. Queda a criterio del equipo decidir si crear carpetas vacías `.gitkeep` o solo documentar la estructura.
