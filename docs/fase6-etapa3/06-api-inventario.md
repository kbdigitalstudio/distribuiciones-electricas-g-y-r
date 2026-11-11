# 06. API de Inventario

## Endpoints implementados

| Método | Endpoint | Descripción | Acceso |
|--------|----------|-------------|--------|
| GET | `/api/inventory` | Consultar inventario general | INVENTARIO / ADMIN |
| GET | `/api/inventory/[productId]` | Consultar inventario de producto | INVENTARIO / ADMIN |
| GET | `/api/inventory/movements` | Consultar movimientos de inventario | INVENTARIO / ADMIN |
| POST | `/api/inventory/movements` | Registrar movimiento de inventario | INVENTARIO / ADMIN |
| POST | `/api/inventory/reservations` | Crear reserva de inventario | INVENTARIO / ADMIN |
| DELETE | `/api/inventory/reservations/[id]` | Liberar reserva de inventario | INVENTARIO / ADMIN |

## Rol INVENTARIO

El rol "INVENTARIO" de la matriz del prompt se mapea al rol `VENDEDOR` (nivel 2) existente en la Etapa 2, ya que no existe un rol dedicado "INVENTARIO" en el sistema actual.

## Movimientos de inventario

### Tipos de movimiento

| Tipo | Descripción | Efecto en quantityOnHand |
|------|-------------|--------------------------|
| `ENTRY` | Entrada de stock | Incrementa |
| `EXIT` | Salida de stock | Decrementa (valida disponibilidad) |
| `ADJUSTMENT` | Ajuste directo | Establece el valor indicado |
| `RESERVATION` | Reserva de stock | No cambia onHand, incrementa reserved |
| `RELEASE` | Liberación de reserva | Decrementa reserved |

### Reglas transaccionales

| Regla | Implementación |
|-------|---------------|
| Transacción Prisma | Todos los movimientos usan `$transaction` para atomicidad |
| Bloqueo de fila | `findUnique` dentro de la transacción para evitar condiciones de carrera |
| Stock insuficiente | `EXIT` y `RESERVATION` rechazan si no hay suficiente stock disponible |
| Cantidades no negativas | Validado en aplicación y CHECK constraint en BD |
| Trazabilidad | Cada movimiento registra `previousQuantity`, `newQuantity`, `reason`, `reference`, `createdBy` |

## Reservas de inventario

| Regla | Implementación |
|-------|---------------|
| Reserva atómica | Verifica stock disponible dentro de transacción antes de reservar |
| No sobreventa | `available = onHand - reserved`; rechaza si `available < quantity` |
| Liberación controlada | `DELETE` marca reserva como `RELEASED` y decrementa `quantityReserved` |
| Expiración opcional | Campo `expiresAt` para reservas temporales |
| No duplicadas | Cada reserva tiene UUID único |

## Concurrencia

La implementación usa transacciones de Prisma con `findUnique` para leer el estado actual del inventario dentro de la transacción. Esto previene condiciones de carrera donde dos solicitudes concurrentes pudieran reservar las mismas unidades.

**Nota:** Para garantías más fuertes de concurrencia en producción, se recomienda usar `SELECT ... FOR UPDATE` o aislamiento de nivel serializable en PostgreSQL.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `src/app/api/inventory/route.ts` | GET listar inventario |
| `src/app/api/inventory/[productId]/route.ts` | GET inventario de producto |
| `src/app/api/inventory/movements/route.ts` | GET listar movimientos, POST registrar |
| `src/app/api/inventory/reservations/route.ts` | POST crear reserva, DELETE liberar |
