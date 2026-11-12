import { z } from "zod";

// ------------------------------------------------------------
// Esquemas de validación de entrada (servidor)
// ------------------------------------------------------------

export const RegisterSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio").max(100),
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
  telefono: z.string().min(1, "El teléfono es obligatorio").max(50),
  direccion: z.string().min(1, "La dirección es obligatoria").max(500),
  ciudad: z.string().min(1, "La ciudad es obligatoria").max(100),
  departamento: z.string().min(1, "El departamento es obligatorio").max(100),
});

export const LoginSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres").max(128),
});

export const UserRoleSchema = z.object({
  roleId: z.string().uuid("ID de rol inválido"),
});

export const CreateCustomerSchema = z.object({
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CC", "CE", "NIT", "PASSAPORTE"]),
  documentNumber: z.string().max(50).optional(),
  razonSocial: z.string().max(255).optional(),
  primerNombre: z.string().max(100).optional(),
  primerApellido: z.string().max(100).optional(),
  ciudad: z.string().max(100).optional(),
  departamento: z.string().max(100).optional(),
  direccion: z.string().max(500).optional(),
  telefono: z.string().max(50).optional(),
  email: z.string().email().optional(),
});

// ------------------------------------------------------------
// Esquemas de validación — Catálogo (Etapa 3)
// ------------------------------------------------------------

// Regex para slug: solo letras minúsculas, números y guiones
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateProductSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(255),
  slug: z.string()
    .min(2, "El slug es obligatorio")
    .max(255)
    .refine((val) => slugRegex.test(val), {
      message: "El slug debe contener solo letras, números y guiones",
    }),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  categoryId: z.string().uuid("ID de categoría inválido"),
  subcategoryId: z.string().uuid("ID de subcategoría inválido").optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url("URL de imagen inválida").max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string()
    .min(2)
    .max(255)
    .refine((val) => slugRegex.test(val), {
      message: "El slug debe contener solo letras, números y guiones",
    })
    .optional(),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),
  categoryId: z.string().uuid("ID de categoría inválido").optional(),
  subcategoryId: z.string().uuid("ID de subcategoría inválido").optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  imageUrl: z.string().url("URL de imagen inválida").max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio").max(255),
  slug: z.string()
    .min(2, "El slug es obligatorio")
    .max(255)
    .refine((val) => slugRegex.test(val), {
      message: "El slug debe contener solo letras, números y guiones",
    }),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url("URL de imagen inválida").max(500).optional().nullable(),
  parentId: z.string().uuid("ID de categoría padre inválido").optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string()
    .min(2)
    .max(255)
    .refine((val) => slugRegex.test(val), {
      message: "El slug debe contener solo letras, números y guiones",
    })
    .optional(),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url("URL de imagen inválida").max(500).optional().nullable(),
  parentId: z.string().uuid("ID de categoría padre inválido").optional().nullable(),
  isActive: z.boolean().optional(),
});

export const RegisterPriceSchema = z.object({
  amountInCents: z.number().int().positive("El importe debe ser mayor a cero"),
  currency: z.string().length(3, "La moneda debe tener 3 caracteres").default("COP"),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const RecordInventoryMovementSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  movementType: z.enum(["ENTRY", "EXIT", "ADJUSTMENT", "RESERVATION", "RELEASE"]),
  quantity: z.number().int().positive("La cantidad debe ser mayor a cero"),
  reason: z.string().min(1, "El motivo es obligatorio").max(255),
  reference: z.string().max(255).optional().nullable(),
});

export const CreateInventoryReservationSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a cero"),
  reference: z.string().max(255).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z
    .string()
    .trim()
    .min(1, "La clave de idempotencia no puede estar vacía")
    .max(255, "La clave de idempotencia no puede superar 255 caracteres")
    .optional()
    .nullable(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ------------------------------------------------------------
// Esquemas de validación — Clientes, cotizaciones y pedidos (Etapa 4)
// ------------------------------------------------------------

const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Importe en centavos COP. Se acepta un entero JSON (seguro hasta 2^53) o una
 * cadena de hasta 15 dígitos para evitar pérdida de precisión. Se transforma a
 * BigInt y nunca se acepta punto flotante.
 */
export const MoneyCentsSchema = z
  .union([
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    z
      .string()
      .regex(/^\d{1,15}$/, "El importe debe ser un entero positivo en centavos")
      .transform((value) => Number(value)),
  ])
  .transform((value) => BigInt(value));

const customerFields = {
  personType: z.enum(["NATURAL", "JURIDICA"]),
  documentType: z.enum(["CC", "CE", "NIT", "PASSAPORTE"]),
  documentNumber: z.string().trim().min(3).max(50),
  razonSocial: z.string().trim().min(2).max(255).optional().nullable(),
  primerNombre: z.string().trim().min(1).max(100).optional().nullable(),
  primerApellido: z.string().trim().min(1).max(100).optional().nullable(),
  pais: z.string().trim().min(2).max(100).default("Colombia"),
  ciudad: z.string().trim().min(2).max(100),
  departamento: z.string().trim().min(2).max(100),
  direccion: z.string().trim().min(3).max(500),
  telefono: z.string().trim().min(7).max(50),
  email: z.string().trim().email("Email inválido").max(255).toLowerCase(),
  isActive: z.boolean().default(true),
} as const;

export const CreateCustomerApiSchema = z
  .object(customerFields)
  .superRefine((data, ctx) => {
    if (data.personType === "NATURAL") {
      if (!data.primerNombre) {
        ctx.addIssue({
          code: "custom",
          path: ["primerNombre"],
          message: "El primer nombre es obligatorio para persona natural",
        });
      }
      if (!data.primerApellido) {
        ctx.addIssue({
          code: "custom",
          path: ["primerApellido"],
          message: "El primer apellido es obligatorio para persona natural",
        });
      }
    }

    if (data.personType === "JURIDICA" && !data.razonSocial) {
      ctx.addIssue({
        code: "custom",
        path: ["razonSocial"],
        message: "La razón social es obligatoria para persona jurídica",
      });
    }
  });

export const UpdateCustomerApiSchema = z
  .object({
    personType: z.enum(["NATURAL", "JURIDICA"]).optional(),
    documentType: z.enum(["CC", "CE", "NIT", "PASSAPORTE"]).optional(),
    documentNumber: z.string().trim().min(3).max(50).optional(),
    razonSocial: z.string().trim().min(2).max(255).optional().nullable(),
    primerNombre: z.string().trim().min(1).max(100).optional().nullable(),
    primerApellido: z.string().trim().min(1).max(100).optional().nullable(),
    pais: z.string().trim().min(2).max(100).optional(),
    ciudad: z.string().trim().min(2).max(100).optional(),
    departamento: z.string().trim().min(2).max(100).optional(),
    direccion: z.string().trim().min(3).max(500).optional(),
    telefono: z.string().trim().min(7).max(50).optional(),
    email: z.string().trim().email("Email inválido").max(255).toLowerCase().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const CustomerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
  personType: z.enum(["NATURAL", "JURIDICA"]).optional(),
  documentType: z.enum(["CC", "CE", "NIT", "PASSAPORTE"]).optional(),
  isActive: booleanQuerySchema.optional(),
});

export const QuoteItemInputSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  quantity: z.number().int().positive().max(1_000_000).default(1),
  unitPriceCents: MoneyCentsSchema.optional(),
});

export const CreateQuoteSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  validUntil: isoDateTimeSchema,
  notes: z.string().trim().max(5000).optional().nullable(),
  items: z.array(QuoteItemInputSchema).min(1).max(100),
});

export const UpdateQuoteSchema = z
  .object({
    validUntil: isoDateTimeSchema.optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
    items: z.array(QuoteItemInputSchema).min(1).max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const QuoteStatusChangeSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "EXPIRED", "CANCELLED"]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const QuoteListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "EXPIRED", "CANCELLED"]).optional(),
  customerId: z.string().uuid().optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

const orderItemInputSchema = z.object({
  productId: z.string().uuid("ID de producto inválido"),
  quantity: z.number().int().positive().max(1_000_000).default(1),
});

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  idempotencyKey: z.string().trim().min(1).max(255).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  items: z.array(orderItemInputSchema).min(1).max(100),
});

export const UpdateOrderSchema = z
  .object({
    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const OrderStatusChangeSchema = z.object({
  status: z.enum([
    "PENDING_PAYMENT",
    "PAID",
    "FULFILLED",
    "CANCELLED",
    "REFUNDED",
  ]),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const OrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z
    .enum(["PENDING_PAYMENT", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"])
    .optional(),
  customerId: z.string().uuid().optional(),
  quoteId: z.string().uuid().optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

export const ConvertQuoteSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

// ------------------------------------------------------------
// Tipos inferidos
// ------------------------------------------------------------
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type RegisterPriceInput = z.infer<typeof RegisterPriceSchema>;
export type RecordInventoryMovementInput = z.infer<typeof RecordInventoryMovementSchema>;
export type CreateInventoryReservationInput = z.infer<typeof CreateInventoryReservationSchema>;
export type CreateCustomerApiInput = z.infer<typeof CreateCustomerApiSchema>;
export type UpdateCustomerApiInput = z.infer<typeof UpdateCustomerApiSchema>;
export type CustomerListQueryInput = z.infer<typeof CustomerListQuerySchema>;
export type QuoteItemInput = z.infer<typeof QuoteItemInputSchema>;
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>;
export type QuoteStatusChangeInput = z.infer<typeof QuoteStatusChangeSchema>;
export type QuoteListQueryInput = z.infer<typeof QuoteListQuerySchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderSchema>;
export type OrderStatusChangeInput = z.infer<typeof OrderStatusChangeSchema>;
export type OrderListQueryInput = z.infer<typeof OrderListQuerySchema>;
export type ConvertQuoteInput = z.infer<typeof ConvertQuoteSchema>;
