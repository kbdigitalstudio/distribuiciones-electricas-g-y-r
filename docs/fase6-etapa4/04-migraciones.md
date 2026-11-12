# 04 — Migraciones

## Resumen

La Etapa 4 agrega una única migración:

```
prisma/migrations/006_comercial_clientes_cotizaciones_pedidos/migration.sql
```

Requiere las migraciones `001` a `005`. Fue aplicada únicamente en la base de pruebas `gyr_test` (PostgreSQL en `127.0.0.1:55432`). **No se ejecutó en producción.**

## Carácter no destructivo

La migración es aditiva:

- Agrega columnas, índices, restricciones y dos tablas de historial.
- No elimina tablas, columnas ni filas.
- No reescribe precios, cantidades ni totales históricos.
- Los snapshots de líneas históricas quedan `NULL` y no se inventan valores.
- Los pedidos históricos quedan con `idempotencyKey NULL`.
- Retira la restricción global `Customer_documentNumber_key` y la reemplaza por la unicidad compuesta `(documentType, documentNumber)`. No se borra ningún dato.
- Agrega restricciones `CHECK` monetarias y de cantidades.
- Agrega `QuoteStatusHistory` y `OrderStatusHistory` con `ON DELETE CASCADE` respecto de su documento e `ON DELETE RESTRICT` respecto del usuario.

## Corrección de compatibilidad incluida

Las migraciones anteriores crearon `Customer.personType`, `Customer.documentType`, `Quote.status` y `Order.status` como `VARCHAR`, mientras que el esquema Prisma los declara como enums nativos. Prisma Client envía parámetros con cast a esos tipos, por lo que sin ellos fallaban las altas.

La migración 006:

1. Crea los tipos `PersonType`, `DocumentType`, `QuoteStatus`, `OrderStatus` y `PricingSource` si no existen.
2. Convierte las columnas `VARCHAR` a los enums con `USING (...::text::"Tipo")`.
3. Si existiera un valor no permitido, PostgreSQL aborta la migración sin borrar datos.

## Cambios por tabla

### `Customer`

- Nuevas columnas: `pais`, `isActive`, `deletedAt`, `createdById`, `updatedById`.
- Nueva unicidad: `(documentType, documentNumber)`.
- Índices: `userId`, `documentNumber`, `isActive`, `deletedAt`, `createdById`, `updatedById`.
- Claves foráneas de actores con `ON DELETE SET NULL`.
- `CHECK` de documento y país no vacíos.

### `QuoteItem`

- `priceId` pasa a ser nullable.
- Nuevas columnas: `productName`, `productSku`, `productSlug`, `currency`, `pricingSource`, `deletedAt`, `createdAt`, `updatedAt`.
- Índice por `deletedAt`.
- `CHECK` de cantidad positiva, precios no negativos, subtotal consistente y coherencia precio/catálogo-manual.

### `Order`

- Nuevas columnas: `idempotencyKey`, `notes`.
- Índices únicos: `idempotencyKey`, `quoteId`.
- `CHECK` de clave no vacía, importes no negativos y total consistente.

### `OrderItem`

- `priceId` pasa a ser nullable.
- Nuevas columnas: `productName`, `productSku`, `productSlug`, `currency`, `pricingSource`.
- `CHECK` de cantidad, importes y coherencia de origen de precio.

### `Quote` y `Order`

- `CHECK` de subtotal, impuesto y total.
- `Quote.totalCents = subtotalCents + taxCents`.
- `Order.totalCents = subtotalCents + taxCents`.

### Nuevas tablas

- `QuoteStatusHistory`.
- `OrderStatusHistory`.

## Prevalidación antes de aplicar en una base con datos

Ejecutar en una réplica o ventana de solo lectura:

```sql
-- Documentos duplicados bajo la nueva unicidad compuesta
SELECT "documentType", "documentNumber", COUNT(*)
FROM "Customer"
WHERE "documentNumber" IS NOT NULL
GROUP BY "documentType", "documentNumber"
HAVING COUNT(*) > 1;

-- Documentos vacíos
SELECT id FROM "Customer"
WHERE "documentNumber" IS NOT NULL AND btrim("documentNumber") = '';

-- Países vacíos
SELECT id FROM "Customer" WHERE btrim("pais") = '';

-- Estados fuera de los enums
SELECT DISTINCT "personType" FROM "Customer"
WHERE "personType" NOT IN ('NATURAL', 'JURIDICA');
SELECT DISTINCT "documentType" FROM "Customer"
WHERE "documentType" NOT IN ('CC', 'CE', 'NIT', 'PASSAPORTE');
SELECT DISTINCT status FROM "Quote"
WHERE status NOT IN ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
SELECT DISTINCT status FROM "Order"
WHERE status NOT IN ('PENDING_PAYMENT', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- Líneas inconsistentes
SELECT id FROM "QuoteItem"
WHERE quantity <= 0
   OR "unitPriceCents" < 0
   OR "subtotalCents" < 0
   OR "subtotalCents" <> "unitPriceCents" * quantity;

SELECT id FROM "OrderItem"
WHERE quantity <= 0
   OR "unitPriceCents" < 0
   OR "subtotalCents" < 0
   OR "subtotalCents" <> "unitPriceCents" * quantity;

-- Totales inconsistentes
SELECT id FROM "Quote"
WHERE "subtotalCents" < 0
   OR "taxCents" < 0
   OR "totalCents" <> "subtotalCents" + "taxCents";

SELECT id FROM "Order"
WHERE "subtotalCents" < 0
   OR "taxCents" < 0
   OR "totalCents" <> "subtotalCents" + "taxCents";

-- Conversiones duplicadas (la unicidad de quoteId fallará si hay más de una)
SELECT "quoteId", COUNT(*)
FROM "Order"
WHERE "quoteId" IS NOT NULL
GROUP BY "quoteId"
HAVING COUNT(*) > 1;
```

Si alguna consulta devuelve filas, **no aplicar** hasta definir un plan de corrección autorizado.

## Procedimiento de aplicación (cuando se autorice)

1. Respaldar la base de datos y verificar que el respaldo sea restaurable.
2. Ejecutar las consultas de prevalidación.
3. Programar ventana de mantenimiento.
4. Configurar `DATABASE_URL` del entorno autorizado.
5. Ejecutar:

```bash
npx prisma migrate deploy
```

6. Ejecutar las verificaciones posteriores:

```sql
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT COUNT(*) FROM "QuoteStatusHistory";
SELECT COUNT(*) FROM "OrderStatusHistory";
SELECT COUNT(*) FROM "Order" WHERE "idempotencyKey" IS NOT NULL;
```

7. Ejecutar `npx prisma generate` en el pipeline de despliegue.
8. Desplegar la aplicación y ejecutar pruebas de humo autenticadas.

## Rollback

No existe una migración `down`. La estrategia recomendada es **forward-fix**:

- Si falla una restricción, corregir los datos y volver a intentar.
- Si falla el despliegue de la aplicación, mantener la migración aplicada (es aditiva) y corregir el código.
- Si se requiere revertir por una decisión autorizada, restaurar el respaldo previo. Un rollback manual que elimine tablas o columnas perdería historial y snapshots.

## Evidencia de ejecución en pruebas

- Clúster desechable en `127.0.0.1:55432`.
- Base `gyr_test`.
- Las 6 migraciones fueron aplicadas correctamente.
- `npx prisma migrate deploy` reportó “No pending migrations to apply.” en la última ejecución.
- `npx prisma validate` indicó que el esquema es válido, con dos advertencias preexistentes de `SetNull` sobre campos requeridos en inventario.

## Producción

**No se ejecutó ninguna migración de producción.** La aplicación en producción sigue sin cambios por esta etapa. Cualquier aplicación requiere autorización expresa y el procedimiento anterior.
