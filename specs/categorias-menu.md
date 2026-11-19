# Spec — Mega-menú de Categorías + Modal de Auth (GYR)

> Contrato de diseño para la Fase 2 (implementación). Fuente de datos: `api-contract.md`.
> Estética: la actual de GYR (blanco, borde `--color-gyr-border`, `shadow-xs`, nav en mayúsculas
> pequeñas, hover verde). Sin 3D, sin degradados decorativos, sin glassmorphism, sin bounce.

---

## 0. Contexto y datos (ya verificados)

- La referencia (`interelectricas.com.co`) tiene un mega-menú de **2 niveles**: categorías de primer
  nivel con icono → al seleccionar una se abre un panel lateral con sus subcategorías.
- En GYR el catálogo real son **14 categorías** y **33 productos** (verificado por HTTP contra
  producción: `GET /api/categories?parentId=&pageSize=100` y `GET /api/products?pageSize=100`).
- **Nivel 2 = productos** de la categoría (el catálogo no tiene subcategorías).
- Dos peticiones **en paralelo**, nunca una por categoría:
  `GET /api/categories?parentId=&pageSize=100` y `GET /api/products?pageSize=100`.
- Enlaces: categoría → `/<slug>` (p. ej. `/alta-tension`); producto → `/producto/<slug>`.
- `productCount` viene en cada categoría → se muestra como badge.
- `currentPrice` es `null` (no hay precios) → el flyout **no** muestra precios, solo nombre.

---

## 1. Tokens (añadir a `@theme` en `src/app/globals.css`)

| Token | Valor | Ratio | Uso |
|---|---|---|---|
| `--color-gyr-primary-strong` | `#0f766e` | **5.47:1** sobre blanco | Texto de enlace/hover, CTA principal (fondo + texto blanco 5.47:1), íconos activos |
| `--color-gyr-focus` | `#0f766e` | 5.47:1 sobre blanco; 4.05:1 sobre `--color-gyr-primary` | Indicador de foco (contorno) |
| `--color-gyr-danger` | `#b91c1c` | **6.47:1** sobre blanco | Errores de formulario, texto de error |
| `--color-gyr-danger-bg` | `#fef2f2` | — | Fondo del mensaje de error general |

Reglas de uso de color (bloqueantes):

- `--color-gyr-primary` (`#25d366`) **deja de usarse como color de texto** y **deja de usarse como
  fondo con texto blanco**: da 1.98:1 sobre blanco. Se conserva **solo como acento visual**
  (borde decorativo, marca, WhatsApp, estados no textuales). Si aparece un texto sobre verde, va
  en `--color-gyr-heading` (`#333333`, 12.6:1).
- El CTA principal: fondo `--color-gyr-primary-strong` + texto `#ffffff` (5.47:1 ✓).
- Estados hover de enlaces del nav: `--color-gyr-primary-strong` (antes era verde ilegible).
- Nunca `outline: none` sin sustituto. Foco visible obligatorio:
  `focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[--color-gyr-focus]`.

---

## 2. Mega-menú "Categorías" (desktop ≥ 1024 px)

### 2.1 Disparador

- Sustituye al actual `<li>` "Productos" en `src/components/layout/navigation.tsx`.
- Es un **botón** (no un enlace): abre/cierra el panel.
- Apariencia: mismo estilo que los enlaces del nav (`text-sm font-semibold uppercase text-gyr-text`),
  con un ícono de cuadrícula/etiquetas (`lucide-react`: `LayoutGrid` o `Tags`) a la izquierda del
  texto "Categorías". Ícono `w-4 h-4`.
- `aria-expanded={abierto}`, `aria-controls="categories-menu"`, `aria-haspopup="true"`.
- Hover/focus: texto `--color-gyr-primary-strong`.
- Objetivo táctil ≥ 44 px de alto (`py-2` + `min-h-[44px]`).

### 2.2 Panel

```
┌────────────────────────────────────────────────────────────────────────────┐
│  LOGO        Inicio  Nosotros  Contacto  [▦ Categorías]  Catálogo  🔍 🛒 👤 │  header sticky
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │ Alta Tensión              8  │  │ Alta Tensión                      │  │
│  │ Media Tensión             7  │  │ ┌────┐ TT 36 kV                  │  │
│  │ Baja Tensión              6  │  │ ├────┤ TC 36 kV                  │  │
│  │ Conductores Eléctricos    1  │  │ └────┘ Transformador de Potencia │  │
│  │ Tubería                   3  │  │                                   │  │
│  │ Transformadores           1  │  │                                   │  │
│  │ … (14 en total, scroll)     │  │                                   │  │
│  └──────────────────────────────┘  └───────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
   columna nivel 1 (280 px)              flyout nivel 2 (1fr, máx 320 px de contenido)
```

- Contenedor: `absolute inset-x-0 top-full z-50 bg-white border-b border-gyr-border shadow-md`.
  Se ancla al header (el header ya es `sticky top-0 z-40`; el panel sube a `z-50`).
- Interior: `container px-4` + `grid grid-cols-[280px_1fr]` (≥1024 px). Debajo de 1024 px el panel
  **no** se usa (el drawer móvil lleva su propio acordeón).
- Altura máxima: `max-h-[420px]` con `overflow-y-auto` en la columna de nivel 1.
- Radio: `rounded-b-2xl` solo en la esquina inferior exterior (encaja con el header).
- Ninguna imagen de fondo, ningún gradiente: fondo blanco puro.

### 2.3 Nivel 1 (categorías)

- Cada ítem es un **botón** con dos objetivos:
  - **Hover / foco** → abre su flyout (nivel 2) en la columna derecha.
  - **Clic** → navega a `/<slug>` (la página de la categoría).
- Estilo: `w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm
  font-medium text-gyr-heading rounded-lg hover:bg-gyr-surface-alt hover:text-gyr-primary-strong
  transition-colors duration-200`.
- Estado activo (categoría abierta): `bg-gyr-surface-alt text-gyr-primary-strong` + indicador
  `border-l-2 border-gyr-primary-strong` (`pl-[10px]` para no saltar el layout).
- Badge de productos: `text-xs text-gyr-text bg-gyr-border-light rounded-full px-2 py-0.5`
  (`aria-label="8 productos"`).
- `aria-expanded` en el botón = si su flyout está visible. `aria-controls` apunta al id del flyout.

### 2.4 Nivel 2 (flyout de productos)

- Columna derecha: `border-l border-gyr-border-light pl-6`.
- Título: `h3 text-sm font-semibold uppercase text-gyr-heading` con el nombre de la categoría.
- Lista: `ul divide-y divide-gyr-border-light`.
- Cada producto es un **enlace** a `/producto/<slug>`:
  - `flex items-center gap-3 py-2.5 text-sm text-gyr-text hover:text-gyr-primary-strong
    hover:bg-gyr-surface-alt rounded-lg px-2 transition-colors duration-200`.
  - Miniatura `w-10 h-10 rounded-lg object-contain bg-gyr-surface-alt shrink-0` (si hay `imageUrl`;
    si no, un ícono `Package` de `lucide-react` con `aria-hidden`).
  - Nombre: `font-medium`.
- La categoría **sin productos**: en la columna derecha, texto `text-sm text-gyr-text`:
  "Esta categoría está en preparación. <a>Ver catálogo</a>" (enlace a `/catalogo`).

### 2.5 Interacción y teclado

- El panel abre con clic en el disparador y con `Enter`/`Espacio` sobre él.
- `Escape` cierra el panel y **devuelve el foco al disparador**.
- Clic fuera del panel (o en otra zona del header) lo cierra.
- Navegación por teclado dentro del panel: `Tab` recorre los ítems en orden de DOM
  (columna 1 → columna 2). Opcional: `↑`/`↓` mueven el foco entre categorías de la columna 1.
- Al abrir el panel, el foco **no** se Teletransporta (no es modal): el foco se queda en el disparador
  y el usuario tabula hasta el panel. El panel no atrapa el foco.
- `aria-live="polite"` en un elemento oculto que anuncia "Categorías cargadas: 14 categorías,
  33 productos" (o "No se pudieron cargar las categorías").

### 2.6 Estados

| Estado | Qué se muestra |
|---|---|
| Cargando | Skeleton: 6 filas grises (`bg-gyr-border-light h-10 rounded-lg animate-pulse`) en la columna 1. `aria-busy="true"` en el panel. |
| Error (API) | Columna 1 con mensaje `text-sm text-gyr-danger`: "No pudimos cargar las categorías." + botón "Reintentar" (`outline` de 1 px `--color-gyr-danger`, texto `--color-gyr-danger`, min-h 44 px). Nunca un panel vacío. |
| Catálogo vacío | "Estamos organizando nuestro catálogo." + enlace "Ver catálogo" → `/catalogo`. Nunca un panel vacío. |
| Éxito | Las 14 categorías con su badge de productos. |

### 2.7 Responsive

- **≥1024 px**: mega-menú como se describe arriba. El nav de escritorio se muestra
  (`hidden md:flex` actual) → el breakpoint real del sitio es `md` (768 px). **El mega-menú solo
  existe en `md` y superior**; por debajo, el drawer móvil.
- **<768 px** (drawer `MobileMenu`): sección "Categorías" como **acordeón**:
  - Botón por categoría (`aria-expanded`, `aria-controls`), 16 px de alto, `min-h-[44px]`,
    `border-b border-gyr-border-light`, con el badge de productos a la derecha.
  - Al desplegar, la lista de productos como enlaces (`/producto/<slug>`), `text-sm`,
    `pl-4 border-l-2 border-gyr-border-light`.
  - Se eliminan de ahí las 15 categorías hardcodeadas actuales.
  - Si la API falla: mensaje + "Reintentar"; si no hay categorías: "Próximamente" + enlace a
    `/catalogo`.

---

## 3. Modal de autenticación (reescritura, sin 3D)

### 3.1 Estructura

- Se elimina **todo** el volteo 3D: nada de `perspective-*`, `transform-style-preserve-3d`,
  `rotate-y-180`, `backface-hidden`, `transition-transform`. Tailwind 4 no tiene esas utilidades y
  por eso el modal se veía espejado y el registro nunca aparecía.
- El cambio de modo es **cambio de estado** (`mode: "login" | "register"`): se monta un panel u
  otro. Sin animación de transform; opcionalmente un `fade-in` de 150 ms solo con opacidad.
- Panel: `w-full max-w-[380px] bg-white rounded-3xl border border-gyr-border-light shadow-auth
  overflow-hidden`. Altura variable según el modo (login ~420 px, registro con scroll).
- Fondo del overlay: `bg-black/70` (sin `backdrop-blur`: el desenfoque es el anti-patrón "glass").
- Cabecera: título `h2 text-xl font-bold text-gyr-heading` con `id="auth-title"` (el dialogo lo
  referencia con `aria-labelledby="auth-title"`), botón de cerrar `X` (44×44 px, `aria-label="Cerrar"`).

### 3.2 Campos

Login (2):

| Campo | `type` | `id` | Label visible | Autocomplete |
|---|---|---|---|---|
| Email | `email` | `auth-email` | "Correo electrónico" | `email` |
| Contraseña | `password` | `auth-password` | "Contraseña" | `current-password` |

Registro (7): `Nombre completo`, `Correo electrónico`, `Contraseña`, `Teléfono`, `Dirección`,
`Ciudad`, `Departamento` (ids `auth-nombre`, `auth-email`, `auth-password`, `auth-telefono`,
`auth-direccion`, `auth-ciudad`, `auth-departamento`).

- Cada campo: `<label htmlFor="…">` visible **siempre** (no solo placeholder), `text-sm font-medium
  text-gyr-heading`.
- Input: `w-full px-3 py-2.5 min-h-[44px] border border-gyr-surface-editable rounded-lg
  bg-gyr-surface-alt text-gyr-heading placeholder:text-gyr-text/70 focus-visible:outline-3
  focus-visible:outline-offset-2 focus-visible:outline-[--color-gyr-focus]`.
- `aria-invalid` + `aria-describedby="<id>-error"` cuando el campo tiene error; el mensaje va en
  `text-sm text-gyr-danger` **debajo** del campo (`id="<id>-error"`).
- El registro se muestra en un contenedor `max-h-[70vh] overflow-y-auto` (7 campos no caben en 520 px).

### 3.3 Acciones y estados

- Botón principal: `w-full min-h-[44px] rounded-lg font-semibold bg-gyr-primary-strong text-white
  hover:bg-[--color-gyr-primary-strong]/90 transition-colors duration-200` (+ `shadow-btn-primary`).
  - Texto: "Entrar" (login) / "Crear cuenta" (registro).
  - Enviando: `disabled`, `opacity-70`, spinner (`Loader2` con `animate-spin`, `aria-hidden`) y
    texto "Enviando…" + `aria-busy="true"` en el formulario.
- Enlace de cambio de modo al pie (centro, `text-sm`):
  - Login → "¿No tienes cuenta? **Regístrate**" (el "Regístrate" es `button type="button"`,
    `text-gyr-primary-strong font-semibold hover:underline`, min-h 44 px).
  - Registro → "¿Ya tienes cuenta? **Inicia sesión**".
- Error general (401/409/429/500/red): bloque `role="alert"` con
  `bg-gyr-danger-bg border border-red-200 text-gyr-danger text-sm rounded-lg p-3 mt-4`, texto de
  `authErrorMessage(status, body)` (ver `src/lib/auth-form.ts`).
- Éxito: `onClose()` + refrescar la sesión (`GET /api/auth/me`) + aviso breve "Sesión iniciada" /
  "Cuenta creada" (el repo ya tiene `use-toast`).
- Nunca `console.error` como único rastro del error: el mensaje va en pantalla.

### 3.4 Accesibilidad (WCAG 2.2 AA)

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="auth-title"`.
- Cierre con `Escape` (y con el botón "Cerrar").
- Al abrir: el foco va al **primer campo** del panel activo.
- Al cerrar: el foco vuelve al **disparador** (el botón de usuario del header).
- El foco queda dentro del modal mientras está abierto (focus trap: Tab/Shift+Tab ciclan).
- Todos los controles con objetivo ≥ 44×44 px.
- Contraste: texto de campo `--color-gyr-heading`/`,text-gyr-text` sobre blanco (≥ 4.5:1);
  CTA `#ffffff` sobre `--color-gyr-primary-strong` (5.47:1); error `--color-gyr-danger` (6.47:1).
- El overlay no debe atrapar el scroll del body: `overflow-hidden` en `body` al abrir.

---

## 4. Criterios de aceptación (verificables)

1. El nav de escritorio tiene un botón "Categorías" con `aria-expanded`; el dropdown hardcodeado
   "Productos" desaparece.
2. Al abrirlo, el panel lista las **14** categorías de la API con su badge de productos
   (`productCount`).
3. Al hacer hover/foco en una categoría, el flyout de la derecha lista **sus productos** con enlace
   a `/producto/<slug>`; ninguna petición adicional por categoría (solo 2 peticiones al abrir).
4. Con teclado: `Enter` en el disparador abre, `Tab` llega a las categorías y a los productos,
   `Escape` cierra y el foco vuelve al disparador.
5. Cada control interactivo muestra un indicador de foco visible (contorno ≥ 3 px,
   `--color-gyr-focus`, offset ≥ 2 px). Cero `outline-none` sin sustituto.
6. En <768 px el drawer móvil muestra las categorías como acordeón y no hay entradas hardcodeadas.
7. Si la API falla, se ve un mensaje de error con botón "Reintentar"; si viene vacía, "Próximamente"
   + enlace a `/catalogo`. Nunca un panel vacío.
8. El modal de auth **no** usa `perspective`, `transform-style-preserve-3d`, `rotate-y-180` ni
   `backface-hidden` (0 coincidencias en el código).
9. "Regístrate" muestra el formulario de registro con los **7** campos, sin espejo y con scroll
   interno si no cabe.
10. Cada campo tiene `<label htmlFor>` visible y su mensaje de error asociado con
    `aria-describedby`.
11. `POST /api/auth/register` se llama con exactamente los 7 campos; `POST /api/auth/login` con
    exactamente email + password (ver `src/lib/auth-form.ts`).
12. Un 401/409/429/500 se muestra en pantalla con el mensaje de `authErrorMessage`; el formulario
    queda utilizable (no se bloquea).
13. Un registro/login exitoso cierra el modal, refresca `/api/auth/me` y el header muestra el
    usuario conectado.
14. `Escape` cierra el modal y el foco vuelve al botón de usuario del header.
15. Contraste AA: el texto del CTA es `#ffffff` sobre `--color-gyr-primary-strong` (5.47:1) y
    `#25d366` no se usa como texto ni como fondo con texto blanco.
16. `npx tsc --noEmit`, `npm run lint` y `npm run build` pasan; `npx vitest run tests/unit` sigue en
    verde (101 tests).
17. Sin `console.log`, sin mutación de objetos/arrays, sin dependencias nuevas.
