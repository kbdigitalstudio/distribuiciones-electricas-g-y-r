# 06. Resultados de Pruebas de Seguridad

## Pruebas ejecutadas en esta etapa

| ID | Prueba | Resultado | Detalle |
|----|--------|-----------|---------|
| T-01 | `npm audit --omit=dev` | ✅ PASÓ | 0 vulnerabilidades en dependencias de producción |
| T-02 | `npm audit` (completo) | ⚠️ PARCIAL | 7 vulnerabilidades `moderate` solo en devDependencies (herramientas de linting/tipado TypeScript). No afectan producción |
| T-03 | `tsc --noEmit` | ✅ PASÓ | 0 errores de TypeScript |
| T-04 | `next build` | ✅ PASÓ | Build exitoso (1 warning preexistente de CSS en `globals.css`, no relacionado con esta etapa) |

## Pruebas de seguridad definidas (pendientes de ejecución con BD operativa)

| ID | Prueba | Criterio de éxito | Estado |
|----|--------|-------------------|--------|
| S-01 | Cookie de sesión HttpOnly, Secure, SameSite=Strict | Verificado en devtools | Pendiente (requiere BD) |
| S-02 | `isAuthenticated` no falsificable desde localStorage | Servidor rechaza sesión falsa | Pendiente (requiere BD) |
| S-03 | Contraseñas hasheadas (bcrypt) | No hay `password` en texto plano en BD | Pendiente (requiere BD) |
| S-04 | Rate limiting en login | Bloqueo tras 5 intentos fallidos | Implementado en código, pendiente prueba con BD |
| S-05 | CORS restringido | Solo dominios autorizados | Pendiente (requiere configuración de despliegue) |
| S-06 | JWT expiración | Token expira tras 15 min | Implementado en código |
| S-07 | CSRF token requerido en POST/PUT/DELETE | Middleware valida `X-CSRF-Token` | Implementado en middleware |
| S-08 | Anti-enumeración de cuentas | Respuesta genérica para email no existente | Implementado en código |
| S-09 | Soft delete de usuarios | `isActive = false` en lugar de eliminación | Implementado en código |
| S-10 | Orden ID no predecible | UUID v4 (definido en schema) | Implementado en schema |

## Vulnerabilidades de dependencias

**Producción (`--omit=dev`):** 0 vulnerabilidades.

**Desarrollo (completo):** 7 vulnerabilidades `moderate`, todas en `@typescript-eslint/*` y `minimatch`. Son herramientas de desarrollo que no se ejecutan en producción y no afectan al usuario final. No se ejecutó `npm audit fix --force` (restricción de la Fase 6).

## Limitaciones de las pruebas

- No se pudo ejecutar contra una base de datos PostgreSQL operativa (restricción de la Etapa 2)
- No se pudieron realizar pruebas de penetración reales
- No se pudieron probar los webhooks de pago (no hay pasarela integrada)
- Las pruebas de seguridad contra la BD se ejecutarán en Etapa 3+ con BD disponible
