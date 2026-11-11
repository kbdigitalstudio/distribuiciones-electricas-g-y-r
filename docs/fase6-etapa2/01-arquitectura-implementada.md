# 01. Arquitectura Implementada

## Resumen

Se implementó la arquitectura de backend base para GYR utilizando **Next.js 16 App Router** como capa de API (Route Handlers) y **PostgreSQL** como base de datos relacional (esquema preparado, no conectado operativo en esta etapa).

## Capas de la arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js App Router — existente, sin modificar)   │
│  ├── Páginas públicas (catálogo, producto, contacto)        │
│  ├── Carrito (localStorage — pendiente de migración Etapa 3)│
│  └── Checkout (localStorage — pendiente de migración Etapa 5)│
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS / JSON
┌─────────────────────────────────────────────────────────────┐
│  BACKEND API (Next.js Route Handlers — src/app/api/)        │
│  ├── /api/auth/register, login, logout, me                  │
│  ├── /api/users (CRUD usuarios, admin)                      │
│  ├── /api/roles (gestión de roles, admin)                   │
│  └── middleware.ts (protección de rutas, CSRF, sesión)      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  CAPA DE DATOS (Prisma ORM + PostgreSQL — preparado)        │
│  ├── prisma/schema.prisma (modelo de 15 tablas)             │
│  ├── prisma/migrations/001_init/migration.sql               │
│  └── src/lib/db.ts (Prisma Client singleton)                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│  UTILIDADES (src/lib/)                                      │
│  ├── auth.ts (hash bcrypt, JWT, CSRF, validación)           │
│  ├── session.ts (cookies HttpOnly, Secure, SameSite)        │
│  ├── validations.ts (esquemas Zod)                          │
│  └── authz.ts (autorización por roles)                      │
└─────────────────────────────────────────────────────────────┘
```

## Decisiones técnicas

| Decisión | Justificación |
|----------|---------------|
| Next.js Route Handlers | Reutiliza el despliegue existente; no requiere servidor separado |
| PostgreSQL | Integridad referencial, transacciones ACID para pedidos/inventario |
| Prisma ORM | Tipado seguro, migraciones, ecosistema TypeScript |
| bcrypt (hash de contraseñas) | Alternativa robusta a Argon2id, pure JS (sin compilación nativa) |
| JWT + cookies HttpOnly | Sesiones servidor, no almacenar tokens en localStorage |
| Double Submit Cookie (CSRF) | Protección CSRF sin dependencias adicionales |
| UUID como PK | Evita IDs secuenciales predecibles |
| `runtime: "nodejs"` en middleware | Permite uso de módulos Node.js (crypto) en middleware |

## ¿Qué NO se implementó en esta etapa?

- Conexión operativa a PostgreSQL (requiere `prisma db push` con BD disponible)
- Migración de carrito y pedidos de localStorage (Etapa 3 y 5)
- Integración con pasarela de pago (Etapa 6)
- Panel de administración de productos (Etapa 3)
