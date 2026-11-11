-- Migration 001_init — GYR Backend (Etapa 2)
-- Esquema inicial de base de datos PostgreSQL
-- No se cargan datos comerciales inventados.

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tablas base
CREATE TABLE "User" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) NOT NULL,
  direccion VARCHAR(500) NOT NULL,
  ciudad VARCHAR(100) NOT NULL,
  departamento VARCHAR(100) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  emailVerifiedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Role" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Permission" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "UserRole" (
  userId UUID NOT NULL,
  roleId UUID NOT NULL,
  assignedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (userId, roleId),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (roleId) REFERENCES "Role"(id) ON DELETE CASCADE
);

CREATE TABLE "RolePermission" (
  roleId UUID NOT NULL,
  permissionId UUID NOT NULL,
  PRIMARY KEY (roleId, permissionId),
  FOREIGN KEY (roleId) REFERENCES "Role"(id) ON DELETE CASCADE,
  FOREIGN KEY (permissionId) REFERENCES "Permission"(id) ON DELETE CASCADE
);

CREATE TABLE "Customer" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NULL UNIQUE,
  personType VARCHAR(20) NOT NULL DEFAULT 'NATURAL',
  documentType VARCHAR(20) NOT NULL DEFAULT 'CC',
  documentNumber VARCHAR(50) NULL UNIQUE,
  razonSocial VARCHAR(255) NULL,
  primerNombre VARCHAR(100) NULL,
  primerApellido VARCHAR(100) NULL,
  ciudad VARCHAR(100) NULL,
  departamento VARCHAR(100) NULL,
  direccion VARCHAR(500) NULL,
  telefono VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE TABLE "Category" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NULL,
  imageUrl VARCHAR(500) NULL,
  parentId UUID NULL,
  level INTEGER NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT true,
  deletedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (parentId) REFERENCES "Category"(id)
);

CREATE TABLE "Product" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoryId UUID NOT NULL,
  subcategoryId UUID NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  shortDescription VARCHAR(500) NULL,
  sku VARCHAR(100) NULL UNIQUE,
  imageUrl VARCHAR(500) NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  deletedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (categoryId) REFERENCES "Category"(id),
  FOREIGN KEY (subcategoryId) REFERENCES "Category"(id)
);

CREATE TABLE "Price" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID NOT NULL,
  priceCents BIGINT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  validFrom TIMESTAMP NOT NULL DEFAULT NOW(),
  validTo TIMESTAMP NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (productId) REFERENCES "Product"(id)
);

CREATE TABLE "Inventory" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productId UUID NOT NULL UNIQUE,
  quantityOnHand INTEGER NOT NULL DEFAULT 0,
  quantityReserved INTEGER NOT NULL DEFAULT 0,
  minStockAlert INTEGER NOT NULL DEFAULT 0,
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (productId) REFERENCES "Product"(id)
);

CREATE TABLE "Quote" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customerId UUID NOT NULL,
  userId UUID NOT NULL,
  quoteNumber VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  subtotalCents BIGINT NOT NULL,
  taxCents BIGINT NOT NULL,
  totalCents BIGINT NOT NULL,
  validUntil TIMESTAMP NOT NULL,
  notes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (customerId) REFERENCES "Customer"(id),
  FOREIGN KEY (userId) REFERENCES "User"(id)
);

CREATE TABLE "QuoteItem" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quoteId UUID NOT NULL,
  productId UUID NOT NULL,
  priceId UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unitPriceCents BIGINT NOT NULL,
  subtotalCents BIGINT NOT NULL,
  FOREIGN KEY (quoteId) REFERENCES "Quote"(id),
  FOREIGN KEY (productId) REFERENCES "Product"(id),
  FOREIGN KEY (priceId) REFERENCES "Price"(id)
);

CREATE TABLE "Order" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customerId UUID NOT NULL,
  userId UUID NOT NULL,
  orderNumber VARCHAR(50) NOT NULL UNIQUE,
  quoteId UUID NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT',
  subtotalCents BIGINT NOT NULL,
  taxCents BIGINT NOT NULL,
  totalCents BIGINT NOT NULL,
  paymentMethod VARCHAR(50) NULL,
  paymentReference VARCHAR(255) NULL,
  paidAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (customerId) REFERENCES "Customer"(id),
  FOREIGN KEY (userId) REFERENCES "User"(id),
  FOREIGN KEY (quoteId) REFERENCES "Quote"(id)
);

CREATE TABLE "OrderItem" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orderId UUID NOT NULL,
  productId UUID NOT NULL,
  priceId UUID NOT NULL,
  quantity INTEGER NOT NULL,
  unitPriceCents BIGINT NOT NULL,
  subtotalCents BIGINT NOT NULL,
  FOREIGN KEY (orderId) REFERENCES "Order"(id),
  FOREIGN KEY (productId) REFERENCES "Product"(id),
  FOREIGN KEY (priceId) REFERENCES "Price"(id)
);

CREATE TABLE "OperationLog" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NULL,
  action VARCHAR(100) NOT NULL,
  entityType VARCHAR(100) NOT NULL,
  entityId VARCHAR(255) NULL,
  details JSON NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent VARCHAR(500) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE TABLE "LoginAttempt" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  userId UUID NULL,
  email VARCHAR(255) NOT NULL,
  ipAddress VARCHAR(45) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  attemptedAt TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE SET NULL
);

-- Índices de rendimiento
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_isActive ON "User"(isActive);
CREATE INDEX idx_category_parentId ON "Category"(parentId);
CREATE INDEX idx_category_slug ON "Category"(slug);
CREATE INDEX idx_category_isActive ON "Category"(isActive);
CREATE INDEX idx_product_categoryId ON "Product"(categoryId);
CREATE INDEX idx_product_subcategoryId ON "Product"(subcategoryId);
CREATE INDEX idx_product_slug ON "Product"(slug);
CREATE INDEX idx_product_isActive ON "Product"(isActive);
CREATE INDEX idx_price_productId ON "Price"(productId);
CREATE INDEX idx_price_isActive ON "Price"(isActive);
CREATE INDEX idx_inventory_productId ON "Inventory"(productId);
CREATE INDEX idx_quote_customerId ON "Quote"(customerId);
CREATE INDEX idx_quote_userId ON "Quote"(userId);
CREATE INDEX idx_quote_status ON "Quote"(status);
CREATE INDEX idx_quote_validUntil ON "Quote"(validUntil);
CREATE INDEX idx_order_customerId ON "Order"(customerId);
CREATE INDEX idx_order_userId ON "Order"(userId);
CREATE INDEX idx_order_status ON "Order"(status);
CREATE INDEX idx_order_paidAt ON "Order"(paidAt);
CREATE INDEX idx_operationLog_userId ON "OperationLog"(userId);
CREATE INDEX idx_operationLog_createdAt ON "OperationLog"(createdAt);
CREATE INDEX idx_loginAttempt_email ON "LoginAttempt"(email);
CREATE INDEX idx_loginAttempt_ipAddress ON "LoginAttempt"(ipAddress);
CREATE INDEX idx_loginAttempt_attemptedAt ON "LoginAttempt"(attemptedAt);

-- Comentarios
COMMENT ON TABLE "User" IS 'Usuarios del sistema (clientes y staff)';
COMMENT ON TABLE "Role" IS 'Roles de acceso (admin, vendedor, cliente)';
COMMENT ON TABLE "Permission" IS 'Permisos granulares por recurso y acción';
COMMENT ON TABLE "Customer" IS 'Perfil comercial del cliente (natural/jurídica)';
COMMENT ON TABLE "Category" IS 'Categorías y subcategorías (jerárquico)';
COMMENT ON TABLE "Product" IS 'Catálogo de productos';
COMMENT ON TABLE "Price" IS 'Historial de precios por producto';
COMMENT ON TABLE "Inventory" IS 'Stock y disponibilidad';
COMMENT ON TABLE "Quote" IS 'Solicitudes de cotización';
COMMENT ON TABLE "Order" IS 'Pedidos comerciales';
COMMENT ON TABLE "OperationLog" IS 'Log de auditoría de operaciones administrativas';
COMMENT ON TABLE "LoginAttempt" IS 'Intentos de login para protección contra fuerza bruta';
