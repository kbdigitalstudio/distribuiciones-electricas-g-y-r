# 10. Instrucciones para Ejecutar el Backend Localmente

## Prerrequisitos

1. **Node.js** v20 o superior (actual: v24.18.0)
2. **npm** v10 o superior (actual: 11.16.0)
3. **PostgreSQL** v14 o superior (NO instalado en este entorno, debe instalarse por separado)

## Paso 1: Instalar dependencias

```bash
cd C:\Proyectos\GYR\gyr-next
npm install
```

## Paso 2: Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
copy .env.example .env

# Editar .env con los valores reales de tu entorno
# Ejemplo para PostgreSQL local:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/gyr_db"
# JWT_SECRET="cambiar_por_un_secreto_de_al_menos_32_caracteres"
# JWT_REFRESH_SECRET="cambiar_por_otro_secreto_diferente_de_32_caracteres"
# COOKIE_SECURE="false"  (solo en desarrollo local sin HTTPS)
# NODE_ENV="development"
```

**Importante:** Nunca subir `.env` con valores reales al repositorio.

## Paso 3: Generar cliente de Prisma

```bash
npx prisma generate
```

> Requiere que los scripts de instalación de npm estén autorizados. Si falla, ejecutar:
> `npm approve-scripts --allow-scripts-pending`

## Paso 4: Crear base de datos y aplicar migraciones

```bash
# 1. Crear la base de datos en PostgreSQL (ejemplo con psql)
createdb gyr_db

# 2. Aplicar el esquema
npx prisma db push

# O usando migraciones
npx prisma migrate deploy
```

## Paso 5: Ejecutar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Paso 6: Verificar build de producción

```bash
npm run build
```

## Endpoints disponibles tras el despliegue local

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `http://localhost:3000/api/auth/register` | POST | Registrar usuario |
| `http://localhost:3000/api/auth/login` | POST | Iniciar sesión |
| `http://localhost:3000/api/auth/logout` | POST | Cerrar sesión |
| `http://localhost:3000/api/auth/me` | GET | Datos de sesión |
| `http://localhost:3000/api/users` | GET/POST | Listar/crear usuarios (ADMIN) |
| `http://localhost:3000/api/users/[id]` | GET/PUT/DELETE | Gestionar usuario |
| `http://localhost:3000/api/roles` | GET/POST | Listar/crear roles (ADMIN) |

## Comandos de utilidad

```bash
# Verificar TypeScript
npx tsc --noEmit

# Auditoría de dependencias de producción
npm audit --omit=dev

# Generar cliente Prisma (después de cambios en schema.prisma)
npx prisma generate

# Abrir Prisma Studio (interfaz web para la BD)
npx prisma studio
```

## Notas importantes

- **No se conectó PostgreSQL en esta etapa.** El código está preparado pero requiere una base de datos operativa para funcionar completamente.
- **No se modificaron archivos originales del proyecto.**
- **No se desplegó a producción.**
- **No se integraron pasarelas de pago.**
