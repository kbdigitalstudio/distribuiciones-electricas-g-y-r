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
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
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
