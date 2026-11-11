# 08. Archivos Creados y Modificados

## Archivos CREADOS (nuevos, no modifican originales)

### Configuración y base de datos
1. `prisma/schema.prisma` — Esquema de Prisma con 15 tablas
2. `prisma/migrations/001_init/migration.sql` — Migración SQL inicial
3. `.env.example` — Plantilla de variables de entorno

### Librería del backend
4. `src/lib/auth.ts` — Hash de contraseñas, JWT, CSRF, validaciones de auth
5. `src/lib/db.ts` — Prisma Client singleton
6. `src/lib/session.ts` — Gestión de cookies de sesión
7. `src/lib/validations.ts` — Esquemas Zod de validación
8. `src/lib/authz.ts` — Autorización por roles y permisos
9. `src/types/auth.types.ts` — Tipos TypeScript de autenticación

### API Routes (Next.js App Router)
10. `src/app/api/auth/register/route.ts` — Registro de usuarios
11. `src/app/api/auth/login/route.ts` — Inicio de sesión (con fuerza bruta y anti-enumeración)
12. `src/app/api/auth/logout/route.ts` — Cierre de sesión
13. `src/app/api/auth/me/route.ts` — Datos de sesión actual
14. `src/app/api/users/route.ts` — Listar y crear usuarios (ADMIN)
15. `src/app/api/users/[id]/route.ts` — Obtener, actualizar, desactivar usuario
16. `src/app/api/roles/route.ts` — Listar y crear roles (ADMIN)

### Middleware
17. `middleware.ts` — Protección de rutas, CSRF, verificación de sesión

### Documentación
18. `docs/fase6-etapa2/README.md` — Índice de la etapa
19. `docs/fase6-etapa2/01-arquitectura-implementada.md`
20. `docs/fase6-etapa2/02-tablas-migraciones.md`
21. `docs/fase6-etapa2/03-endpoints-implementados.md`
22. `docs/fase6-etapa2/04-autenticacion.md`
23. `docs/fase6-etapa2/05-matriz-roles-permisos.md`
24. `docs/fase6-etapa2/06-resultados-pruebas-seguridad.md`
25. `docs/fase6-etapa2/07-dependencias-auditorias.md`
26. `docs/fase6-etapa2/08-archivos-modificados.md`
27. `docs/fase6-etapa2/09-problemas-pendientes.md`
28. `docs/fase6-etapa2/10-instrucciones-ejecucion-local.md`

## Archivos MODIFICADOS

Ningún archivo original del proyecto fue modificado. Todos los archivos listados arriba son **nuevos**.

## Archivos NO modificados (confirmado)

- `src/data/products.ts` — Datos de productos originales
- `src/types/user.ts` — Tipos de usuario originales
- `src/hooks/use-cart.tsx` — Carrito original
- `src/app/checkout/page.tsx` — Checkout original
- `next.config.ts` — Configuración de Next.js
- `tsconfig.json` — Configuración de TypeScript
- `package.json` original — Solo se agregaron dependencias, no se modificó el archivo manualmente (usó `npm install`)
- Todos los archivos de páginas, componentes y layouts originales
