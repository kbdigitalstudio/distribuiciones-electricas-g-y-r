# Contrato compartido — Menú de categorías + Login/Registro (GYR)

> Este archivo es la fuente de verdad para la Fase 2. **No redefinir estas interfaces.**
> Leer también `PRODUCT.md` (registro: brand; anti-referencia: "no un catálogo vacío"; WCAG 2.2 AA obligatorio).

## 1. Referencia a replicar (interelectricas.com.co)

Estructura capturada de la web de referencia:

- En la barra de navegación hay un disparador **"Categorías"** (icono hamburguesa + texto).
- Al abrirlo aparece un panel con **23 categorías de primer nivel**, cada una con **icono + nombre**.
- Al pasar el cursor/foco sobre una categoría se abre un **flyout de 600 px** con la lista de sus
  **subcategorías** (productos): "Aisladores" → Accesorios Aisladores, Aislador Carrete, Aislador
  Linepost, Aislador Suspensión, Aislador Tensor, Aislador Tipo Pin.
- Es un mega-menú de **2 niveles**: Categoría → Subcategorías. Sin imágenes gigantes, sin degradados.

Adaptación a GYR: misma interacción (2 niveles, panel + flyout), estética propia (tokens GYR,
sin 3D, sin degradados decorativos).

## 2. API de categorías (YA EXISTE — no modificar)

```http
GET /api/categories?parentId=&pageSize=100
```

- `parentId=` (string vacío) → devuelve **solo categorías de primer nivel** (`parentId === null`).
- Sin `parentId` → devuelve todas las activas paginadas.
- `pageSize` máximo 100. Paginación por defecto 20 (insuficiente para el menú: usar `pageSize=100`).
- Respuesta:

```jsonc
{
  "success": true,
  "categories": [
    {
      "id": "uuid",
      "name": "Alta Tensión",
      "slug": "alta-tension",
      "description": "…",
      "imageUrl": "…",
      "parentId": null,
      "level": 1,
      "isActive": true,
      "parent": null,
      "children": [ /* subcategorías, mismo shape, productCount incluido */ ],
      "productCount": 12
    }
  ],
  "pagination": { "page": 1, "pageSize": 100, "total": 15, "totalPages": 1 }
}
```

Reglas:
- Es **público** (sin sesión) siempre que no se pase `isActive=false`.
- La respuesta ya trae `children` anidados: **no** hace falta una segunda petición.
- Si `categories` viene vacío → **no renderizar un panel vacío**: mostrar el enlace "Catálogo" y un
  estado "Próximamente" (anti-referencia del `PRODUCT.md`: nada de catálogo vacío).

### 2.bis Nivel 2 del menú = productos de la categoría (decisión final)

El catálogo comercial real de GYR (`src/data/products.ts`, 31 productos en 14 categorías) **no tiene
subcategorías**: los "tipos de producto" de cada categoría (p. ej. "Alta Tensión" → TT 36 kV, TC 36 kV,
Transformador de Potencia) son exactamente lo que la web de referencia muestra como subcategorías.

Por eso el flyout del mega-menú se alimenta de **productos**, no de `children`:

```http
GET /api/products?categoryId=<uuid>&pageSize=50
```

- Público. Devuelve `{ success, products: [{ id, slug, name, imageUrl, category, subcategory, currentPrice, inventory }], pagination }`.
- `currentPrice` es `null` (no hay precios en el catálogo) → la UI muestra "A cotizar", no un precio inventado.
- Enlace de cada ítem del flyout: `/producto/<slug>` (las páginas de producto ya existen y usan el
  mismo `slug`).

**El menú hace 2 peticiones en paralelo, no una por categoría** (evita N+1):

```http
GET /api/categories?parentId=&pageSize=100   → nivel 1 (14 categorías)
GET /api/products?pageSize=100                → nivel 2, agrupado por `product.category.id` en el cliente
```

La clave de agrupación es **`product.category.id`** (objeto anidado, verificado contra producción),
no un `categoryId` plano: `products.map(p => p.category.id)`.

`pageSize` máximo = 100 (`PaginationSchema`). Con 31 productos entra todo en una sola respuesta.

> Nota de despliegue: la BD de producción estaba vacía (0 categorías / 0 productos). Se añadió
> `prisma/seed.mjs` (idempotente, `update: {}`: solo crea lo que falta, nunca pisa datos) que carga
> las 14 categorías y los 31 productos desde `src/data/products.ts`. Se ejecuta en el build de Vercel
> (`prisma migrate deploy && prisma generate && prisma db seed && next build`).

### Rutas de destino

Cada categoría debe enlazar a la ruta pública que ya existe en el repo (14 páginas estáticas):

`/alta-tension` · `/media-tension` · `/baja-tension` · `/conductores-electricos` · `/tuberia` ·
`/transformadores` · `/puesta-tierra` · `/herrajeria` · `/cajas-tableros` ·
`/maniobra` · `/medidores-energia` · `/accesorios-red-ecologica` · `/accesorios-red-trenzada` ·
`/interruptores-tomacorrientes`

> `/aislamiento-proteccion` **NO existe** (404): no está en el catálogo real. Cualquier enlace a esa
> ruta debe desaparecer o apuntar a `/catalogo`.

Regla de enlace: `href = "/" + slug`. Si la categoría no tiene página propia, enlazar a `/catalogo`.

## 3. API de autenticación (YA EXISTE — no modificar)

```http
POST /api/auth/login
Content-Type: application/json
{ "email": "…", "password": "…" }
```

| Caso | Status | Body |
|---|---|---|
| OK | 200 | `{ success: true, message: "…", user: { id, email, nombre, role } }` |
| Credenciales malas | 401 | `{ error: "…", code: "…" }` |
| Rate limit | 429 | `{ error: "…", code: "RATE_LIMITED" }` |

```http
POST /api/auth/register
Content-Type: application/json
{
  "nombre": "…",          // min 2, max 100
  "email": "…",           // email válido
  "password": "…",        // min 8, max 128
  "telefono": "…",        // obligatorio, min 1, max 50
  "direccion": "…",       // obligatorio, min 1, max 500
  "ciudad": "…",          // obligatorio, min 1, max 100
  "departamento": "…"     // obligatorio, min 1, max 100
}
```

| Caso | Status | Body |
|---|---|---|
| OK | 201 | `{ success: true, message: "…", user: { id, email, nombre, role } }` |
| Validación | 400 | `{ error: "…", code: "VALIDATION_ERROR", details: { campo: [msg] } }` |
| Email existente | 409 | `{ error: "…", code: "USER_EXISTS" }` |

- La **sesión se establece por cookie httpOnly del servidor**: el cliente NO guarda tokens.
- Tras un 200/201 el cliente debe cerrar el modal y refrescar el estado de usuario del header.
- `GET /api/auth/me` → `{ user: {…} }` (200) o 401 si no hay sesión.

## 4. Módulo nuevo con contrato fijo (para TDD)

**Archivo:** `src/lib/auth-form.ts` (nuevo, sin dependencias).

```ts
export type AuthMode = "login" | "register";

export interface AuthFormValues {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
}

/** Payload exacto que espera cada endpoint. Sin campos de más. */
export function buildAuthPayload(
  mode: AuthMode,
  values: AuthFormValues
): Record<string, string>;

/** Errores por campo en español. Objeto vacío = válido. */
export function validateAuthForm(
  mode: AuthMode,
  values: AuthFormValues
): Partial<Record<keyof AuthFormValues, string>>;

/** Mensaje en español para el usuario a partir de status + body de la API. */
export function authErrorMessage(status: number, body: unknown): string;
```

Reglas de `validateAuthForm`:
- `login`: email con formato válido y password no vacía.
- `register`: los 7 campos obligatorios; password ≥ 8 caracteres; email válido.
- Mensajes en español, sineco de los del servidor.

Reglas de `authErrorMessage`:
- 401 → "Correo o contraseña incorrectos." (no revelar cuál)
- 409 → "Ese correo ya está registrado."
- 429 → "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
- 400 con `details` → mensaje del primer campo con error.
- 500 / red → "No pudimos completar la operación. Inténtalo de nuevo."

**Test (rojo primero):** `tests/unit/auth-form.test.ts` — lo escribe @tdd-guide ANTES de la
implementación. @frontend-react NO debe modificar ese archivo: si un test falla, se ajusta la
implementación, no el test.

## 5. Archivos que puede tocar @frontend-react

| Archivo | Acción |
|---|---|
| `src/components/layout/navigation.tsx` | Reemplazar la lista hardcodeada `PRODUCT_CATEGORIES` por el menú dinámico |
| `src/components/layout/categories-menu.tsx` | **Nuevo** — mega-menú de 2 niveles |
| `src/components/layout/mobile-menu.tsx` | Añadir el acordeón de categorías en móvil |
| `src/components/ui/auth-modal.tsx` | **Reescribir** — sin 3D, formularios funcionales |
| `src/lib/auth-form.ts` | **Nuevo** — contrato de la sección 4 |
| `src/components/layout/user-access.tsx` | Botón real + estado de sesión (refresca `/api/auth/me`) |
| `src/app/globals.css` | **Solo** si hace falta un token de foco o de panel |

Fuera de alcance: `src/app/api/**` (las APIs ya están hechas), `prisma/schema.prisma`,
`package.json` (no añadir dependencias).

## 6. Reglas de implementación

- **Nada de 3D.** `transform-style-preserve-3d` y `perspective-1200` NO existen en Tailwind 4:
  son la causa del bug actual (el modal se voltea espejado y el registro nunca aparece).
- **WCAG 2.2 AA:** foco visible con `focus-visible:` (nunca `outline-none` sin sustituto),
  `role="dialog"` + `aria-modal` + `aria-labelledby`, cierre con Escape, foco devuelto al
  disparador, `<label htmlFor>` en cada campo, `aria-describedby` para errores, objetivos ≥ 44 px.
- **Sin mutación**: estado con `useState`/`useReducer` inmutable.
- **Errores siempre visibles**: mensaje en el formulario, no solo `console.error`.
- Token de color: usar `--color-gyr-*`. **El verde `#25d366` no cumple contraste AA como texto ni
  con texto blanco encima**: para texto usar un token AA; para CTA, texto oscuro o token hover.
