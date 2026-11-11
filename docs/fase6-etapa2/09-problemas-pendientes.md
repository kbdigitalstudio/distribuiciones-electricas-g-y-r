# 09. Problemas Pendientes

## Problemas técnicos

| # | Problema | Impacto | Solución prevista (Etapa 3+) |
|---|----------|---------|------------------------------|
| 1 | `prisma generate` no se ejecutó | `@prisma/client` no genera el cliente tipado; `db.ts` usa `@ts-ignore` | Ejecutar `npx prisma generate` con scripts de instalación autorizados y PostgreSQL disponible |
| 2 | No hay PostgreSQL operativo | No se pueden aplicar migraciones ni probar contra BD real | Instalar PostgreSQL local, configurar `DATABASE_URL`, ejecutar `npx prisma db push` |
| 3 | `next build` tiene 1 warning preexistente en `globals.css` (`@theme` no reconocido) | Bajo — es un warning de CSS/Tailwind, no relacionado con esta etapa | No es responsabilidad de esta etapa (archivo original sin modificar) |
| 4 | Refresh token rotation no implementado | El refresh token se establece pero no se rota en cada uso | Implementar rotación de refresh tokens en Etapa 3 |
| 5 | Endpoints de productos, categorías, precios, inventario no implementados | No se puede gestionar catálogo aún | Implementar en Etapa 3 |
| 6 | Endpoints de clientes, cotizaciones, pedidos no implementados | No se puede gestionar ventas aún | Implementar en Etapas 4 y 5 |
| 7 | Integración con pasarela de pago PSE no implementada | No se puede procesar pagos | Implementar en Etapa 6 |

## Problemas de seguridad pendientes

| # | Problema | Impacto | Mitigación |
|---|----------|---------|------------|
| 1 | No se pudo probar contra BD real | Las consultas a BD no se validaron en entorno real | Probar en Etapa 3 con PostgreSQL operativo |
| 2 | No se ejecutaron pruebas de penetración | No se validaron vulnerabilidades reales | Planificar para Etapa 7 (pre-producción) |
| 3 | CORS no configurado | Riesgo de peticiones cross-origin no autorizadas | Configurar CORS en Etapa 7 |

## Notas

- Ningún problema bloquea el avance a la Etapa 3, pero se requiere PostgreSQL operativo para probar la persistencia de datos.
- El código está listo para ejecutarse una vez que se genere el cliente Prisma y se conecte la base de datos.
