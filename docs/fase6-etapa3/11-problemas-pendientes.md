# 11. Problemas Pendientes

## Problemas técnicos

| # | Problema | Impacto | Solución prevista |
|---|----------|---------|-------------------|
| 1 | No se pudo conectar a PostgreSQL | No se pueden aplicar migraciones ni probar contra BD real | Obtener credenciales de PostgreSQL, ejecutar `npx prisma generate` y `npx prisma db push` |
| 2 | `prisma generate` no ejecutado | `@prisma/client` no tiene tipos generados | Ejecutar con scripts de instalación autorizados |
| 3 | Build tiene 1 warning preexistente en `globals.css` | Bajo — warning de CSS/Tailwind, no relacionado con Etapa 3 | No es responsabilidad de esta etapa |
| 4 | Pruebas de integración no ejecutadas | No se validó el comportamiento contra BD real | Ejecutar cuando haya BD disponible |
| 5 | Pruebas de concurrencia de inventario no ejecutadas | No se verificó la ausencia de sobreventa bajo concurrencia | Ejecutar contra BD PostgreSQL con pruebas de carga |
| 6 | No se aplicaron migraciones | Las tablas `InventoryMovement` e `InventoryReservation` no existen en BD | Aplicar `002_catalogo` cuando haya BD |

## Decisiones documentadas

| Decisión | Justificación |
|----------|---------------|
| Rol INVENTARIO → VENDEDOR | No existe rol "INVENTARIO" en Etapa 2; se usa VENDEDOR (nivel 2) para operaciones de inventario |
| Lectura pública de productos/categorías | Permite que el catálogo sea visible sin autenticación, cumpliendo el requisito de acceso público |
| Soft delete en Product y Category | Mantiene trazabilidad y compatibilidad con historial relacionado |
| Precios en centavos (BIGINT) | Evita errores de punto flotante en cálculos monetarios |
| "A cotizar" cuando no hay precio | Cumple con el requisito de no inventar precios |

## Bloqueos identificados

| Bloqueo | Motivo | Acción requerida |
|---------|--------|------------------|
| Sin credenciales de PostgreSQL | No se puede autenticar para conectar | Obtener contraseña de administrador de PostgreSQL |
| Sin `prisma generate` | Los tipos de Prisma no están disponibles | Ejecutar con scripts autorizados |
| Sin migraciones aplicadas | Las tablas nuevas no existen en BD | Aplicar migración 002_catalogo |
