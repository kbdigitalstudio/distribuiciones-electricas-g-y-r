# Resumen de implementación — Mega-menú de Categorías + Modal de Auth

Fase 2 del pipeline UI (implementación). Spec: `specs/categorias-menu.md`. Contrato: `api-contract.md`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/app/globals.css` | Tokens nuevos: `--color-gyr-primary-strong` (#0f766e), `--color-gyr-focus`, `--color-gyr-danger` (#b91c1c), `--color-gyr-danger-bg` |
| `src/components/layout/categories-menu.tsx` | **Nuevo**: mega-menú de escritorio + `CategoryAccordion` móvil + hook `useCategoriesData` con caché en memoria |
| `src/components/layout/navigation.tsx` | Sustituye el dropdown hardcodeado "Productos" por el botón "Categorías" |
| `src/components/layout/mobile-menu.tsx` | La sección "Productos" hardcodeada (15 enlaces, uno 404) → acordeón con la API |
| `src/components/ui/auth-modal.tsx` | Reescrito: sin 3D, login ⇄ registro por estado, submit real a la API, a11y completa |
| `src/components/layout/user-access.tsx` | `<div onClick>` → `<button>` + estado de sesión + menú de cuenta con "Cerrar sesión" |
| `src/components/layout/header.tsx` | Estado `sessionRefresh` para refrescar la sesión sin recargar la página |
| `src/components/sections/categories.tsx` | Tarjeta "Aislamiento y protección" (404) → Alta/Media/Baja Tensión (las 14 categorías reales) |
| `api-contract.md` | Corrección: la agrupación es por `product.category.id` (objeto anidado), no `categoryId` plano; `/aislamiento-proteccion` no existe |

## Decisiones clave

- **2 peticiones en paralelo** (`/api/categories?parentId=&pageSize=100` y `/api/products?pageSize=100`), nunca una
  por categoría. Caché en memoria del cliente (`cachedData` + `pendingRequest`) → escritorio y móvil comparten la
  misma respuesta.
- **Nivel 2 = productos** agrupados por `product.category.id`, con enlace `/producto/<slug>`.
- El panel se ancla al `<header>` (`sticky` = bloque contenedor) con `absolute inset-x-0 top-full`; por eso el `<li>`
  del nav **no** lleva `relative`.
- `normal-case font-normal` en el panel: el `<ul>` del nav es `uppercase font-semibold` y el panel lo heredaba.
- El login/registro **no guarda tokens**: la sesión viaja por cookie httpOnly; el modal solo hace `fetch` con
  `credentials: "same-origin"` y el header revalida con `GET /api/auth/me`.
- `src/lib/auth-form.ts` **no** se tocó: `buildAuthPayload`, `validateAuthForm` y `authErrorMessage` son la única
  fuente de payload, validación y mensajes.

## Criterios de aceptación del spec

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Botón "Categorías" con `aria-expanded`; fuera el dropdown "Productos" | ✅ | `navigation.tsx` + `categories-menu.tsx` |
| 2 | El panel lista las 14 categorías con su badge | ✅ | E2E: `n=14` |
| 3 | Flyout con los productos de la categoría activa, sin N+1 | ✅ | E2E: hover cambia el flyout; solo 2 peticiones |
| 4 | `Enter` abre, `Tab` recorre, `Escape` cierra y devuelve el foco | ✅ | E2E: foco vuelve al disparador ("CATEGORÍAS") |
| 5 | Indicador de foco visible (≥3 px, token `--color-gyr-focus`) | ✅ | E2E: `outlineWidth: 3px` |
| 6 | <768 px: acordeón, sin entradas hardcodeadas | ✅ | E2E móvil: `aria-expanded=true`, 37 enlaces de producto |
| 7 | Error → mensaje + "Reintentar"; vacío → "Próximamente" + `/catalogo` | ✅ | E2E (sin BD local): error + botón; estado vacío implementado |
| 8 | Cero 3D en el modal | ✅ | `grep`: 0 coincidencias de `perspective|preserve-3d|rotate-y-180|backface-hidden` |
| 9 | "Regístrate" muestra 7 campos, sin espejo, con scroll interno | ✅ | E2E: `inputCount=7`, `transformStyle=null` |
| 10 | `label htmlFor` visible + `aria-describedby` en errores | ✅ | E2E: 7 labels detectados |
| 11 | Payload exacto por endpoint | ✅ | `buildAuthPayload` (contrato TDD existente) |
| 12 | 401/409/429/500 visibles y formulario usable | ✅ | `role="alert"` + `authErrorMessage` |
| 13 | Éxito → cierra, refresca `/api/auth/me`, header con el usuario | ✅ | `onSuccess` → `sessionRefresh` → `UserAccess` revalida |
| 14 | `Escape` cierra y el foco vuelve al botón de usuario | ✅ | `previouslyFocusedRef` + efecto de cierre |
| 15 | Contraste AA: CTA `#ffffff` sobre `#0f766e` (5.47:1) | ✅ | Tokens del spec; `#25d366` solo como acento visual |
| 16 | `tsc` / `lint` / `vitest` / `build` | ⚠️ parcial | `tsc` ✅, `vitest` 101/101 ✅, `build` ✅. `npm run lint` mantiene **10 errores preexistentes** en archivos no tocados (`src/lib/commercial-serializers.ts`, `tests/integration/commercial-api.test.ts`); los archivos nuevos solo tienen el warning de `<img>` (mismo patrón que `header.tsx`/`footer.tsx`/`logo.tsx` del repo) |
| 17 | Sin `console.log`, sin mutación, sin dependencias nuevas | ✅ | `grep` + revisión del diff |

## Verificación ejecutada

```
npx tsc --noEmit              → TSC_EXIT=0
npx vitest run tests/unit     → 9 archivos, 101 tests, todos en verde
npm run build                 → OK (rutas estáticas + PPR generadas)
npm run lint                  → 10 errores preexistentes, 0 nuevos en los archivos tocados
E2E Playwright/Edge (mock de la API con datos reales de producción):
  mega-menú → 13/14 checks OK (el único fallo era del propio script: el clic de prueba caía
  dentro del borde del panel; re-verificado: clic fuera cierra ✅, clic dentro no cierra ✅)
  modal de auth → 9/12 checks OK (los 3 fallos restantes son 500 de la API local por falta de
  BD en el entorno; en producción la API responde 200/201 — verificado por HTTP con curl)
```
