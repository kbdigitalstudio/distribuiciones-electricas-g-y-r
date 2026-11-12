-- Migration 004_normalizacion_identificadores — GYR Backend (Etapa 3 Correcciones)
--
-- PROBLEMA DETECTADO:
--   Las migraciones 001_init y 002_catalogo crearon columnas SIN comillas.
--   PostgreSQL pliega los identificadores sin comillas a minúsculas, por lo que
--   la base quedó con columnas como "passwordhash", "quantityonhand", etc.
--   Prisma siempre cita los identificadores y espera "passwordHash",
--   "quantityOnHand", etc. Con ese desfase, cualquier consulta de Prisma falla
--   con "column does not exist".
--
-- SOLUCIÓN:
--   Renombrar las columnas existentes al nombre camelCase que usa el esquema de
--   Prisma. Los índices, claves foráneas y CHECK constraints de PostgreSQL se
--   actualizan automáticamente al renombrar la columna.
--
-- SEGURIDAD:
--   - No se eliminan tablas, columnas ni datos.
--   - El bloque es condicional: si una columna ya tiene el nombre camelCase
--     (por ejemplo, una base creada con `prisma db push`), no hace nada.
--   - Si ambas variantes existen, se aborta para no dejar datos ambiguos.

DO $$
DECLARE
  mapping RECORD;
  old_exists BOOLEAN;
  new_exists BOOLEAN;
BEGIN
  FOR mapping IN
    SELECT *
    FROM (VALUES
      -- User
      ('User', 'passwordhash', 'passwordHash'),
      ('User', 'isactive', 'isActive'),
      ('User', 'emailverifiedat', 'emailVerifiedAt'),
      ('User', 'createdat', 'createdAt'),
      ('User', 'updatedat', 'updatedAt'),

      -- Role
      ('Role', 'createdat', 'createdAt'),
      ('Role', 'updatedat', 'updatedAt'),

      -- Permission
      ('Permission', 'createdat', 'createdAt'),

      -- UserRole
      ('UserRole', 'userid', 'userId'),
      ('UserRole', 'roleid', 'roleId'),
      ('UserRole', 'assignedat', 'assignedAt'),

      -- RolePermission
      ('RolePermission', 'roleid', 'roleId'),
      ('RolePermission', 'permissionid', 'permissionId'),

      -- Customer
      ('Customer', 'userid', 'userId'),
      ('Customer', 'persontype', 'personType'),
      ('Customer', 'documenttype', 'documentType'),
      ('Customer', 'documentnumber', 'documentNumber'),
      ('Customer', 'razonsocial', 'razonSocial'),
      ('Customer', 'primernombre', 'primerNombre'),
      ('Customer', 'primerapellido', 'primerApellido'),
      ('Customer', 'createdat', 'createdAt'),
      ('Customer', 'updatedat', 'updatedAt'),

      -- Category
      ('Category', 'imageurl', 'imageUrl'),
      ('Category', 'parentid', 'parentId'),
      ('Category', 'isactive', 'isActive'),
      ('Category', 'deletedat', 'deletedAt'),
      ('Category', 'createdat', 'createdAt'),
      ('Category', 'updatedat', 'updatedAt'),

      -- Product
      ('Product', 'categoryid', 'categoryId'),
      ('Product', 'subcategoryid', 'subcategoryId'),
      ('Product', 'shortdescription', 'shortDescription'),
      ('Product', 'imageurl', 'imageUrl'),
      ('Product', 'isactive', 'isActive'),
      ('Product', 'deletedat', 'deletedAt'),
      ('Product', 'createdat', 'createdAt'),
      ('Product', 'updatedat', 'updatedAt'),

      -- Price
      ('Price', 'productid', 'productId'),
      ('Price', 'pricecents', 'priceCents'),
      ('Price', 'validfrom', 'validFrom'),
      ('Price', 'validto', 'validTo'),
      ('Price', 'isactive', 'isActive'),
      ('Price', 'createdat', 'createdAt'),

      -- Inventory
      ('Inventory', 'productid', 'productId'),
      ('Inventory', 'quantityonhand', 'quantityOnHand'),
      ('Inventory', 'quantityreserved', 'quantityReserved'),
      ('Inventory', 'minstockalert', 'minStockAlert'),
      ('Inventory', 'updatedat', 'updatedAt'),

      -- InventoryMovement
      ('InventoryMovement', 'productid', 'productId'),
      ('InventoryMovement', 'movementtype', 'movementType'),
      ('InventoryMovement', 'previousquantity', 'previousQuantity'),
      ('InventoryMovement', 'newquantity', 'newQuantity'),
      ('InventoryMovement', 'createdby', 'createdBy'),
      ('InventoryMovement', 'createdat', 'createdAt'),

      -- InventoryReservation (idempotencyKey ya fue creada entre comillas en 003)
      ('InventoryReservation', 'productid', 'productId'),
      ('InventoryReservation', 'reservedat', 'reservedAt'),
      ('InventoryReservation', 'releasedat', 'releasedAt'),
      ('InventoryReservation', 'createdby', 'createdBy'),
      ('InventoryReservation', 'expiresat', 'expiresAt'),

      -- Quote
      ('Quote', 'customerid', 'customerId'),
      ('Quote', 'userid', 'userId'),
      ('Quote', 'quotenumber', 'quoteNumber'),
      ('Quote', 'subtotalcents', 'subtotalCents'),
      ('Quote', 'taxcents', 'taxCents'),
      ('Quote', 'totalcents', 'totalCents'),
      ('Quote', 'validuntil', 'validUntil'),
      ('Quote', 'createdat', 'createdAt'),
      ('Quote', 'updatedat', 'updatedAt'),

      -- QuoteItem
      ('QuoteItem', 'quoteid', 'quoteId'),
      ('QuoteItem', 'productid', 'productId'),
      ('QuoteItem', 'priceid', 'priceId'),
      ('QuoteItem', 'unitpricecents', 'unitPriceCents'),
      ('QuoteItem', 'subtotalcents', 'subtotalCents'),

      -- Order
      ('Order', 'customerid', 'customerId'),
      ('Order', 'userid', 'userId'),
      ('Order', 'ordernumber', 'orderNumber'),
      ('Order', 'quoteid', 'quoteId'),
      ('Order', 'subtotalcents', 'subtotalCents'),
      ('Order', 'taxcents', 'taxCents'),
      ('Order', 'totalcents', 'totalCents'),
      ('Order', 'paymentmethod', 'paymentMethod'),
      ('Order', 'paymentreference', 'paymentReference'),
      ('Order', 'paidat', 'paidAt'),
      ('Order', 'createdat', 'createdAt'),
      ('Order', 'updatedat', 'updatedAt'),

      -- OrderItem
      ('OrderItem', 'orderid', 'orderId'),
      ('OrderItem', 'productid', 'productId'),
      ('OrderItem', 'priceid', 'priceId'),
      ('OrderItem', 'unitpricecents', 'unitPriceCents'),
      ('OrderItem', 'subtotalcents', 'subtotalCents'),

      -- OperationLog
      ('OperationLog', 'userid', 'userId'),
      ('OperationLog', 'entitytype', 'entityType'),
      ('OperationLog', 'entityid', 'entityId'),
      ('OperationLog', 'ipaddress', 'ipAddress'),
      ('OperationLog', 'useragent', 'userAgent'),
      ('OperationLog', 'createdat', 'createdAt'),

      -- LoginAttempt
      ('LoginAttempt', 'userid', 'userId'),
      ('LoginAttempt', 'ipaddress', 'ipAddress'),
      ('LoginAttempt', 'attemptedat', 'attemptedAt')
    ) AS m(table_name, old_column, new_column)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = mapping.table_name
        AND column_name = mapping.old_column
    ) INTO old_exists;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = mapping.table_name
        AND column_name = mapping.new_column
    ) INTO new_exists;

    IF old_exists AND NOT new_exists THEN
      EXECUTE format(
        'ALTER TABLE %I RENAME COLUMN %I TO %I',
        mapping.table_name,
        mapping.old_column,
        mapping.new_column
      );
    ELSIF old_exists AND new_exists THEN
      RAISE EXCEPTION
        'Columnas % y % coexisten en la tabla %; se requiere revisión manual',
        mapping.old_column, mapping.new_column, mapping.table_name;
    END IF;
  END LOOP;
END $$;

COMMENT ON SCHEMA public IS 'Esquema GYR: identificadores normalizados a camelCase para Prisma';
