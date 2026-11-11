# 04. Funcionamiento de Autenticación

## Flujo de registro (`POST /api/auth/register`)

1. Validar entrada con `RegisterSchema` (Zod)
2. Verificar que el email no exista (anti-enumeración: respuesta genérica si existe)
3. Hashear contraseña con **bcrypt** (12 salt rounds, alternativa robusta a Argon2id)
4. Crear usuario con rol **CLIENTE** por defecto (no permite auto-asignar roles privilegiados)
5. Crear perfil de `Customer` vinculado
6. Generar CSRF token
7. Establecer cookies: `gyr_session` (JWT access, HttpOnly, Secure, SameSite=Strict) y `gyr_csrf_token` (no HttpOnly, para double submit CSRF)
8. Registrar en `OperationLog` (acción: USER_REGISTER)

## Flujo de login (`POST /api/auth/login`)

1. Validar entrada con `LoginSchema` (Zod)
2. **Protección fuerza bruta**: contar intentos fallidos recientes (email + IP). Si ≥ 5 en 15 min, responder 429
3. Buscar usuario por email
4. **Anti-enumeración**: si el usuario no existe o la contraseña es incorrecta, responder siempre "Credenciales inválidas" (mismo retraso constante 50-150ms para evitar timing attacks)
5. Si las credenciales son correctas y el usuario está activo:
   - Registrar intento exitoso en `LoginAttempt`
   - Limpiar intentos fallidos previos
   - Generar access token (JWT, 15 min) y refresh token (JWT, 7 días)
   - Establecer cookies de sesión
   - Registrar en `OperationLog` (acción: USER_LOGIN)
6. Si falla: registrar intento fallido en `LoginAttempt`, responder genérico

## Flujo de logout (`POST /api/auth/logout`)

1. Obtener sesión actual
2. Registrar en `OperationLog` (acción: USER_LOGOUT)
3. Limpiar todas las cookies de sesión (maxAge: 0)
4. Responder éxito

## Sesión (`GET /api/auth/me`)

1. Leer cookie `gyr_session` (HttpOnly)
2. Verificar JWT (firma, expiración, issuer, audience)
3. Retornar datos del usuario con roles y perfil de cliente
4. Si no hay sesión válida: responder 401

## Tokens

| Token | Almacenamiento | Vida | Propósito |
|-------|---------------|------|-----------|
| Access token (JWT) | Cookie `gyr_session` (HttpOnly, Secure, SameSite=Strict) | 15 min | Autenticación en peticiones API |
| Refresh token (JWT) | Cookie `gyr_refresh_token` (HttpOnly, Secure, SameSite=Strict) | 7 d | Renovar access token |
| CSRF token | Cookie `gyr_csrf_token` (no HttpOnly) | 15 min | Protección CSRF (double submit) |

## Medidas de seguridad implementadas

| Medida | Implementación |
|--------|---------------|
| Hash de contraseñas | bcrypt con 12 salt rounds |
| Contraseñas no en localStorage | Nunca se almacenan en cliente |
| Tokens no en localStorage | Solo en cookies HttpOnly |
| Anti-enumeración de cuentas | Respuesta genérica para email no existente / contraseña incorrecta |
| Protección fuerza bruta | Bloqueo tras 5 intentos fallidos en 15 min (por email + IP) |
| Anti-timing attack | Retraso constante 50-150ms en respuestas de auth fallidas |
| Cookies seguras | HttpOnly, Secure (HTTPS), SameSite=Strict |
| CSRF protección | Double submit cookie + header `X-CSRF-Token` |
| UUID como identificador | No IDs secuenciales predecibles |
| Validación de entrada | Zod schemas en servidor para todas las peticiones |

## Notas

- El refresh token se establece en login pero su rotación completa se implementará en Etapa 3+
- No se almacenan contraseñas ni tokens en localStorage (cumple restricción de la Etapa 2)
- Variables sensibles (`JWT_SECRET`, `JWT_REFRESH_SECRET`) en `.env`, no en Git
