-- Migration 006_comercial_clientes_cotizaciones_pedidos — GYR Backend (Etapa 4)
--
-- Objetivo:
--   1. Completar Customer: país, estado, borrado lógico y actores de creación/edición.
--   2. Cambiar la unicidad de identificación a (documentType, documentNumber).
--   3. Agregar snapshots comerciales, origen de precio y borrado lógico de líneas
--      a QuoteItem y OrderItem.
--   4. Agregar idempotencia y unicidad de conversión a Order.
--   5. Crear historial explícito de estados para Quote y Order.
--   6. Reforzar invariantes monetarias y de cantidades en PostgreSQL.
--
-- Características:
--   - Aditiva y no destructiva: no elimina tablas, columnas ni filas.
--   - El cambio de unicidad de Customer retira una restricción y crea un índice
--     único más específico; no borra datos.
--   - Los snapshots de registros históricos quedan NULL: no se inventan datos.
--   - Los pedidos históricos quedan con idempotencyKey NULL.
--   - Antes de aplicar en una base con datos, ejecutar las consultas de
--     prevalidación documentadas en docs/fase6-etapa4/04-migraciones.md.
--
-- Requiere las migraciones 001 a 005 aplicadas.

-- ---------------------------------------------------------------------------
-- 1. Tipos enumerados.
--
-- Las migraciones 001 crearon personType, documentType, Quote.status y
-- Order.status como VARCHAR, mientras que el esquema Prisma los declara como
-- enums nativos. Prisma Client envía parámetros con cast a esos tipos, por lo
-- que sin ellos cualquier alta de cliente/cotización/pedido falla con
-- "type ... does not exist". Esta migración crea los tipos y convierte las
-- columnas existentes con USING explícito. Si existiera un valor no permitido,
-- PostgreSQL aborta la migración sin borrar datos.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PersonType') THEN
    CREATE TYPE "PersonType" AS ENUM ('NATURAL', 'JURIDICA');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('CC', 'CE', 'NIT', 'PASSAPORTE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuoteStatus') THEN
    CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PricingSource') THEN
    CREATE TYPE "PricingSource" AS ENUM ('CATALOG', 'MANUAL');
  END IF;
END $$;

ALTER TABLE "Customer" ALTER COLUMN "personType" DROP DEFAULT;
ALTER TABLE "Customer"
  ALTER COLUMN "personType" TYPE "PersonType"
  USING ("personType"::text::"PersonType");
ALTER TABLE "Customer"
  ALTER COLUMN "personType" SET DEFAULT 'NATURAL'::"PersonType";

ALTER TABLE "Customer" ALTER COLUMN "documentType" DROP DEFAULT;
ALTER TABLE "Customer"
  ALTER COLUMN "documentType" TYPE "DocumentType"
  USING ("documentType"::text::"DocumentType");
ALTER TABLE "Customer"
  ALTER COLUMN "documentType" SET DEFAULT 'CC'::"DocumentType";

ALTER TABLE "Quote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quote"
  ALTER COLUMN "status" TYPE "QuoteStatus"
  USING ("status"::text::"QuoteStatus");
ALTER TABLE "Quote"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"QuoteStatus";

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING ("status"::text::"OrderStatus");
ALTER TABLE "Order"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT'::"OrderStatus";

-- ---------------------------------------------------------------------------
-- 2. Customer
-- ---------------------------------------------------------------------------
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "pais" TEXT NOT NULL DEFAULT 'Colombia';

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3) NULL;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "createdById" UUID NULL;

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "updatedById" UUID NULL;

-- La unicidad global anterior impedía reutilizar el mismo número en tipos de
-- documento distintos. Se reemplaza por unicidad por tipo de documento.
ALTER TABLE "Customer"
  DROP CONSTRAINT IF EXISTS "Customer_documentNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_documentType_documentNumber_key"
  ON "Customer"("documentType", "documentNumber");

CREATE INDEX IF NOT EXISTS "Customer_userId_idx"
  ON "Customer"("userId");

CREATE INDEX IF NOT EXISTS "Customer_documentNumber_idx"
  ON "Customer"("documentNumber");

CREATE INDEX IF NOT EXISTS "Customer_isActive_idx"
  ON "Customer"("isActive");

CREATE INDEX IF NOT EXISTS "Customer_deletedAt_idx"
  ON "Customer"("deletedAt");

CREATE INDEX IF NOT EXISTS "Customer_createdById_idx"
  ON "Customer"("createdById");

CREATE INDEX IF NOT EXISTS "Customer_updatedById_idx"
  ON "Customer"("updatedById");

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Customer"
  ADD CONSTRAINT "chk_customer_documentNumber_not_blank"
  CHECK ("documentNumber" IS NULL OR btrim("documentNumber") <> '');

ALTER TABLE "Customer"
  ADD CONSTRAINT "chk_customer_pais_not_blank"
  CHECK (btrim("pais") <> '');

-- ---------------------------------------------------------------------------
-- 3. QuoteItem: snapshots, precio manual y borrado lógico de líneas.
-- ---------------------------------------------------------------------------
ALTER TABLE "QuoteItem"
  ALTER COLUMN "priceId" DROP NOT NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "productName" TEXT NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "productSku" TEXT NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "productSlug" TEXT NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "pricingSource" "PricingSource" NOT NULL DEFAULT 'CATALOG';

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3) NULL;

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "QuoteItem_deletedAt_idx"
  ON "QuoteItem"("deletedAt");

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "chk_quoteItem_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "chk_quoteItem_unitPrice_non_negative"
  CHECK ("unitPriceCents" >= 0);

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "chk_quoteItem_subtotal_non_negative"
  CHECK ("subtotalCents" >= 0);

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "chk_quoteItem_subtotal_consistent"
  CHECK ("subtotalCents" = "unitPriceCents" * "quantity");

ALTER TABLE "QuoteItem"
  ADD CONSTRAINT "chk_quoteItem_pricingSource_valid"
  CHECK (
    ("pricingSource" = 'CATALOG' AND "priceId" IS NOT NULL) OR
    ("pricingSource" = 'MANUAL' AND "priceId" IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 4. Order: idempotencia, observaciones y una sola conversión por cotización.
-- ---------------------------------------------------------------------------
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT NULL;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "notes" TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key"
  ON "Order"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Order_quoteId_key"
  ON "Order"("quoteId");

ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_idempotencyKey_not_blank"
  CHECK ("idempotencyKey" IS NULL OR btrim("idempotencyKey") <> '');

ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_subtotal_non_negative"
  CHECK ("subtotalCents" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_tax_non_negative"
  CHECK ("taxCents" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "chk_order_total_consistent"
  CHECK ("totalCents" = "subtotalCents" + "taxCents");

-- ---------------------------------------------------------------------------
-- 5. OrderItem: snapshots y precio manual proveniente de una cotización.
-- ---------------------------------------------------------------------------
ALTER TABLE "OrderItem"
  ALTER COLUMN "priceId" DROP NOT NULL;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "productName" TEXT NULL;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "productSku" TEXT NULL;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "productSlug" TEXT NULL;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NULL;

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "pricingSource" "PricingSource" NOT NULL DEFAULT 'CATALOG';

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "chk_orderItem_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "chk_orderItem_unitPrice_non_negative"
  CHECK ("unitPriceCents" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "chk_orderItem_subtotal_non_negative"
  CHECK ("subtotalCents" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "chk_orderItem_subtotal_consistent"
  CHECK ("subtotalCents" = "unitPriceCents" * "quantity");

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "chk_orderItem_pricingSource_valid"
  CHECK (
    ("pricingSource" = 'CATALOG' AND "priceId" IS NOT NULL) OR
    ("pricingSource" = 'MANUAL' AND "priceId" IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 6. Invariantes de totales de cotización.
-- ---------------------------------------------------------------------------
ALTER TABLE "Quote"
  ADD CONSTRAINT "chk_quote_subtotal_non_negative"
  CHECK ("subtotalCents" >= 0);

ALTER TABLE "Quote"
  ADD CONSTRAINT "chk_quote_tax_non_negative"
  CHECK ("taxCents" >= 0);

ALTER TABLE "Quote"
  ADD CONSTRAINT "chk_quote_total_consistent"
  CHECK ("totalCents" = "subtotalCents" + "taxCents");

-- ---------------------------------------------------------------------------
-- 7. Historial de estados de cotizaciones.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "QuoteStatusHistory" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "quoteId" UUID NOT NULL,
  "fromStatus" "QuoteStatus" NULL,
  "toStatus" "QuoteStatus" NOT NULL,
  "changedBy" UUID NOT NULL,
  reason TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "QuoteStatusHistory_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuoteStatusHistory_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QuoteStatusHistory_quoteId_createdAt_idx"
  ON "QuoteStatusHistory"("quoteId", "createdAt");

CREATE INDEX IF NOT EXISTS "QuoteStatusHistory_changedBy_idx"
  ON "QuoteStatusHistory"("changedBy");

CREATE INDEX IF NOT EXISTS "QuoteStatusHistory_toStatus_idx"
  ON "QuoteStatusHistory"("toStatus");

-- ---------------------------------------------------------------------------
-- 8. Historial de estados de pedidos.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrderStatusHistory" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderId" UUID NOT NULL,
  "fromStatus" "OrderStatus" NULL,
  "toStatus" "OrderStatus" NOT NULL,
  "changedBy" UUID NOT NULL,
  reason TEXT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "OrderStatusHistory_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderStatusHistory_changedBy_fkey"
    FOREIGN KEY ("changedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_createdAt_idx"
  ON "OrderStatusHistory"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "OrderStatusHistory_changedBy_idx"
  ON "OrderStatusHistory"("changedBy");

CREATE INDEX IF NOT EXISTS "OrderStatusHistory_toStatus_idx"
  ON "OrderStatusHistory"("toStatus");

-- ---------------------------------------------------------------------------
-- 9. Comentarios de trazabilidad.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN "Customer"."createdById"
  IS 'Usuario que creó el registro comercial; NULL en altas históricas o autoregistro previo';

COMMENT ON COLUMN "Customer"."deletedAt"
  IS 'Fecha de eliminación lógica; nunca se borra físicamente un cliente';

COMMENT ON COLUMN "QuoteItem"."pricingSource"
  IS 'CATALOG: precio vigente de Price; MANUAL: precio explícito autorizado cuando no hay precio de catálogo';

COMMENT ON COLUMN "QuoteItem"."deletedAt"
  IS 'Borrado lógico de líneas reemplazadas en un borrador; conserva historial';

COMMENT ON COLUMN "Order"."idempotencyKey"
  IS 'Clave de idempotencia única por solicitud de creación de pedido';

COMMENT ON COLUMN "Order"."quoteId"
  IS 'Cotización de origen; UNIQUE impide más de un pedido por cotización';

COMMENT ON TABLE "QuoteStatusHistory"
  IS 'Historial inmutable de cambios de estado de cotizaciones';

COMMENT ON TABLE "OrderStatusHistory"
  IS 'Historial inmutable de cambios de estado de pedidos';
