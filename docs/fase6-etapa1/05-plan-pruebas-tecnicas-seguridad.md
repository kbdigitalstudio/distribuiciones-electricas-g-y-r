# 05. Plan de Pruebas Técnicas y de Seguridad

Este documento define las pruebas técnicas y de seguridad que deberán superarse antes de considerar lista una etapa de implementación. Son **pruebas planificadas** — no se ejecutan en esta etapa.

## Categoría 1: Pruebas de dependencias y compatibilidad

| ID | Prueba | Criterio de éxito | Herramienta |
|----|--------|-------------------|-------------|
| T-01 | `npm audit --omit=dev` | 0 vulnerabilidades en producción | npm |
| T-02 | `npm audit` (completo) | Solo vulnerabilidades `moderate` en dev, 0 `high`/`critical` | npm |
| T-03 | `tsc --noEmit` | 0 errores de TypeScript | TypeScript |
| T-04 | `next build` | Build exitoso sin errores | Next.js |
| T-05 | Compatibilidad Next.js 16 + Route Handlers | Los archivos `route.ts` son reconocidos por el framework | Next.js docs |

## Categoría 2: Pruebas de seguridad de autenticación

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| S-01 | Cookie de sesión marcada `HttpOnly`, `Secure`, `SameSite=Strict` | Verificado en devtools de navegador |
| S-02 | `isAuthenticated` no verificable desde localStorage | Intento de acceso con `localStorage.user = {isAuthenticated: true}` es rechazado por servidor |
| S-03 | Contraseñas hasheadas (bcrypt/argon2) | No se almacena `password` en texto plano en BD |
| S-04 | Rate limiting en login | Bloqueo tras N intentos fallidos |
| S-05 | CORS restringido | Solo dominios autorizados pueden llamar a la API |
| S-06 | JWT/token expiración | Token expira tras tiempo configurado; renovación solo con refresh token |

## Categoría 3: Pruebas de integridad de datos y carrito

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| D-01 | Precios validados en servidor | El cliente no puede enviar un precio; el servidor consulta BD |
| D-02 | Stock validado antes de crear pedido | Intentar pedir más de lo disponible → error 400 |
| D-03 | Order ID no predecible | `orderId` es UUID v4, no `Date.now()` ni secuencial |
| D-04 | Precio congelado en momento del pedido | El precio se guarda en `order_items.unit_price_cents` al crear el pedido |
| D-05 | Soft delete | Producto desactivado no aparece en catálogo público pero conserva historial |

## Categoría 4: Pruebas de XSS y exposición de información

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| X-01 | Sanitización de nombres de productos | Inyectar `<script>` en nombre de producto no ejecuta JS |
| X-02 | Sanitización de URLs de imagen | Solo URLs válidas y de dominio permitido se renderizan |
| X-03 | Datos personales no en localStorage | Después de migración, `localStorage.user` no contiene email, teléfono, dirección |
| X-04 | CSP (Content Security Policy) | Cabeceras CSP configuradas para bloquear scripts inline no autorizados |
| X-05 | Headers de seguridad | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` |

## Categoría 5: Pruebas de pagos y cotizaciones (sin pasarela real)

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| P-01 | Diferenciación cotización vs pedido | Crear cotización no genera pago; crear pedido va a `pending_payment` |
| P-02 | Estado de pago solo cambia por servidor | El cliente no puede marcar un pedido como `paid` desde frontend |
| P-03 | Cotización expirable | Cotización pasada su `valid_until` no puede aceptarse |
| P-04 | Webhook de pago idempotente | Recibir mismo webhook dos veces no duplica el pedido ni el pago |

## Categoría 6: Pruebas de base de datos (modelo de 15 tablas)

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| B-01 | Integridad referencial | Eliminar categoría con productos → error o cascada controlada |
| B-02 | UUID como PK | Todos los IDs generados son UUID v4, no enteros secuenciales |
| B-03 | Precios en centavos | Ningún campo de precio usa DECIMAL/FLOAT; todos BIGINT centavos |
| B-04 | Índices de rendimiento | Consultas de producto por slug y categoría usan índice |
| B-05 | Log de operaciones | Cualquier cambio en admin genera entrada en `operation_log` |

## Categoría 7: Pruebas de panel administrativo

| ID | Prueba | Criterio de éxito |
|----|--------|-------------------|
| A-01 | Control de acceso por rol | Usuario sin rol `admin` no puede acceder a `/api/admin/*` |
| A-02 | Auditoría de cambios | Editar producto genera log en `operation_log` con usuario, acción, antes/después |
| A-03 | Validación de entrada | Crear producto con slug duplicado → error 409 |

## Ejecución y gates

Cada etapa de implementación debe superar las pruebas correspondientes antes de pasar a la siguiente:

| Etapa | Pruebas requeridas |
|-------|-------------------|
| Etapa 1 (Preparación) | T-01 a T-05 (documentación y compatibilidad) |
| Etapa 2 (Backend base) | T-01 a T-05, S-01 a S-06, D-01 a D-05 |
| Etapa 3 (Catálogo) | T-01 a T-05, X-01 a X-05, B-01 a B-05 |
| Etapa 4 (Clientes y cotizaciones) | P-01 a P-04, D-01 a D-05 |
| Etapa 5 (Pedidos) | P-01 a P-04, B-01 a B-05, A-01 a A-03 |
| Etapa 6 (Pagos PSE) | P-01 a P-04, S-01 a S-06, X-01 a X-05 |
| Etapa 7 (Producción) | Todas las anteriores + pruebas de carga e integración |

## Herramientas sugeridas (para etapas futuras)

- **Pruebas unitarias/integración:** Vitest o Jest + Testing Library
- **Pruebas de API:** Supertest (para Next.js Route Handlers)
- **Pruebas de seguridad:** OWASP ZAP, npm audit, manual penetration testing checklist
- **Pruebas de base de datos:** pgTAP o pruebas de integración con contenedor PostgreSQL efímero
- **Linter:** ESLint (ya configurado en el proyecto)
