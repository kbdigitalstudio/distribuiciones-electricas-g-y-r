# 02. Contratos API y Responsabilidades de Cada Módulo

Este documento define los contratos API (endpoints, métodos, parámetros, respuestas esperadas) para cada módulo del backend. Son **contratos de diseño** — no se implementan en esta etapa.

## Convenciones

- Base path: `/api`
- Formato: JSON
- Autenticación: por definir (futuro — JWT en cookie HttpOnly o sesión)
- Errores: `{ error: string, code?: string, details?: any }`
- IDs: UUID v4 (no secuenciales)
- Monedas: centavos (BIGINT) en COP, sin decimales flotantes

---

## 1. Autenticación (`/api/auth`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/auth/register` | POST | Registrar nuevo usuario | Público |
| `/api/auth/login` | POST | Iniciar sesión, establecer cookie de sesión | Público |
| `/api/auth/logout` | POST | Cerrar sesión, eliminar cookie | Autenticado |
| `/api/auth/me` | GET | Obtener usuario autenticado actual | Autenticado |
| `/api/auth/password-reset-request` | POST | Solicitar restablecimiento de contraseña | Público |
| `/api/auth/password-reset-confirm` | POST | Confirmar restablecimiento con token | Público |

**Responsabilidad:** Módulo `services/auth/`

---

## 2. Usuarios y Roles (`/api/users`, `/api/roles`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/users` | GET | Listar usuarios | Admin |
| `/api/users/:id` | GET | Obtener usuario por ID | Admin / propio |
| `/api/users/:id` | PUT | Actualizar usuario | Admin / propio |
| `/api/users/:id` | DELETE | Desactivar usuario | Admin |
| `/api/roles` | GET | Listar roles | Admin |
| `/api/roles` | POST | Crear rol | Admin |
| `/api/users/:id/roles` | POST | Asignar rol a usuario | Admin |

**Responsabilidad:** Módulo `services/auth/` (usuarios y roles)

---

## 3. Productos (`/api/products`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/products` | GET | Listar productos con filtros (categoría, búsqueda) | Público |
| `/api/products/:slug` | GET | Obtener producto por slug | Público |
| `/api/admin/products` | POST | Crear producto | Admin |
| `/api/admin/products/:id` | PUT | Actualizar producto | Admin |
| `/api/admin/products/:id` | DELETE | Desactivar producto | Admin |
| `/api/admin/products/:id/image` | POST | Subir/reemplazar fotografía | Admin |

**Responsabilidad:** Módulo `services/products/`

---

## 4. Categorías y Subcategorías (`/api/categories`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/categories` | GET | Listar categorías (con subcategorías) | Público |
| `/api/categories` | POST | Crear categoría | Admin |
| `/api/categories/:id` | PUT | Actualizar categoría | Admin |
| `/api/categories/:id` | DELETE | Eliminar categoría (si no tiene productos) | Admin |
| `/api/categories/:id/subcategories` | GET | Listar subcategorías de una categoría | Público |

**Responsabilidad:** Módulo `services/categories/`

---

## 5. Precios (`/api/prices`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/products/:id/prices` | GET | Historial de precios de un producto | Público / Admin |
| `/api/admin/prices` | POST | Registrar nuevo precio (con rango de validez) | Admin |
| `/api/admin/prices/:id` | PUT | Actualizar precio (cerrar vigencia anterior) | Admin |

**Responsabilidad:** Módulo `services/prices/`

---

## 6. Inventario (`/api/inventory`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/inventory/:productId` | GET | Consultar stock disponible | Público |
| `/api/admin/inventory/:productId` | PUT | Actualizar existencias | Admin |
| `/api/admin/inventory/low-stock` | GET | Listar productos por debajo del mínimo | Admin |

**Responsabilidad:** Módulo `services/inventory/`

---

## 7. Clientes (`/api/customers`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/customers` | GET | Listar clientes | Admin |
| `/api/customers/:id` | GET | Obtener cliente por ID | Admin / propio |
| `/api/customers` | POST | Registrar cliente | Público / Autenticado |
| `/api/customers/:id` | PUT | Actualizar datos del cliente | Admin / propio |

**Responsabilidad:** Módulo `services/customers/`

---

## 8. Cotizaciones (`/api/quotes`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/quotes` | POST | Crear solicitud de cotización | Autenticado |
| `/api/quotes` | GET | Listar cotizaciones | Admin / propio |
| `/api/quotes/:id` | GET | Obtener cotización por ID | Admin / propio |
| `/api/quotes/:id` | PUT | Actualizar estado (enviada/aceptada/expirada) | Admin |
| `/api/quotes/:id/items` | GET | Listar ítems de la cotización | Admin / propio |

**Responsabilidad:** Módulo `services/quotes/`

---

## 9. Pedidos (`/api/orders`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/orders` | POST | Crear pedido comercial (pendiente de pago) | Autenticado |
| `/api/orders` | GET | Listar pedidos | Admin / propio |
| `/api/orders/:id` | GET | Obtener pedido por ID | Admin / propio |
| `/api/orders/:id` | PUT | Actualizar estado del pedido | Admin |
| `/api/orders/:id/payment` | POST | Registrar referencia de pago (webhook de pasarela) | Sistema / Admin |

**Responsabilidad:** Módulo `services/orders/`

---

## 10. Panel Administrativo (`/api/admin`)

| Endpoint | Método | Descripción | Acceso |
|----------|--------|-------------|--------|
| `/api/admin/dashboard` | GET | Resumen de métricas (productos, pedidos pendientes, stock bajo) | Admin |
| `/api/admin/operation-log` | GET | Historial de operaciones de admin | Admin |
| `/api/admin/operation-log` | POST | Registrar operación de auditoría | Sistema |

**Responsabilidad:** Módulo `services/operations/` + agregación de otros módulos

---

## Matriz de responsabilidades por módulo

| Módulo | Tablas de BD | Endpoints principales | Validaciones |
|--------|-------------|----------------------|--------------|
| `services/auth/` | users, roles, role_assignments, permissions | auth, users, roles | email, password, role existence |
| `services/products/` | products, categories | products | slug unique, category exists, image URL |
| `services/categories/` | categories | categories | name unique, parent exists |
| `services/prices/` | prices | prices | valid_from < valid_to, positive amount |
| `services/inventory/` | inventory | inventory | quantity >= 0, product exists |
| `services/customers/` | customers | customers | person_type, NIT format (Colombia) |
| `services/quotes/` | quotes, quote_items | quotes | customer exists, items valid, valid_until future |
| `services/orders/` | orders, order_items | orders | customer exists, stock available, payment reference |
| `services/operations/` | operation_log | operation-log | user exists, action defined |

## Decisiones pendientes (Etapa 2+)

- Proveedor de autenticación: NextAuth.js (Auth.js) vs JWT propio.
- Formato de cookie de sesión: nombre, dominio, SameSite, Secure.
- Estrategia de subida de imágenes: S3 directo vs proxy por API.
- Estrategia de webhooks de pago: validación de firma, idempotencia.
