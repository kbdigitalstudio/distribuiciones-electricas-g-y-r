# 07. Dependencias Instaladas y Auditorías

## Dependencias instaladas en esta etapa

| Paquete | Versión | Tipo | Propósito |
|---------|---------|------|-----------|
| `prisma` | 5.22.0 | devDependecy | CLI de Prisma ORM (migraciones, generate) |
| `@prisma/client` | 5.22.0 | dependency | Cliente de Prisma ORM |
| `jsonwebtoken` | 9.0.2 | dependency | Firma y verificación de JWT |
| `@types/jsonwebtoken` | 9.0.9 | devDependecy | Tipos TypeScript para jsonwebtoken |
| `bcryptjs` | 2.4.3 | dependency | Hash seguro de contraseñas (alternativa a Argon2id) |
| `@types/bcryptjs` | 2.4.6 | devDependecy | Tipos TypeScript para bcryptjs |
| `cookie` | 0.7.2 | dependency | Parseo y serialización de cookies HTTP |
| `@types/cookie` | 0.7.2 | devDependecy | Tipos TypeScript para cookie |
| `zod` | 3.24.2 | dependency | Validación de esquemas de entrada |

## Auditorías de dependencias

### `npm audit --omit=dev` (producción)
```
vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
dependencies: { prod: 20, dev: 375, optional: 82, total: 432 }
```
**Resultado:** 0 vulnerabilidades en producción.

### `npm audit` (completo)
```
vulnerabilities: { info: 0, low: 0, moderate: 7, high: 0, critical: 0, total: 7 }
```
**Resultado:** 7 vulnerabilidades `moderate` en devDependencies (`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `minimatch`, `typescript-eslint`). No afectan producción. No se ejecutó `npm audit fix --force`.

## Variables de entorno (`.env.example`)

Las siguientes variables se definen en `.env.example` (no se suben valores reales al repositorio):

- `DATABASE_URL` — Conexión a PostgreSQL
- `JWT_SECRET` — Secreto para firmar access tokens (mínimo 32 caracteres)
- `JWT_REFRESH_SECRET` — Secreto para firmar refresh tokens (mínimo 32 caracteres)
- `COOKIE_NAME`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `COOKIE_SAMESITE` — Configuración de cookies
- `CSRF_COOKIE_NAME` — Nombre de la cookie CSRF
- `APP_URL`, `APP_PORT` — URL de la aplicación
- `MAX_LOGIN_ATTEMPTS`, `LOCKOUT_MINUTES` — Protección fuerza bruta
- `NODE_ENV` — Entorno de ejecución

## Archivos excluidos del repositorio

- `.env` — Nunca se debe subir con valores reales
- `node_modules/` — Dependencias instaladas
- `.next/` — Build de Next.js
