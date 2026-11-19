export type AuthMode = "login" | "register";

export interface AuthFormValues {
  email: string;
  password: string;
  nombre?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
}

type AuthField = keyof AuthFormValues;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const REGISTER_FIELDS: AuthField[] = [
  "nombre",
  "email",
  "password",
  "telefono",
  "direccion",
  "ciudad",
  "departamento",
];

const GENERIC_ERROR = "No pudimos completar la operación. Inténtalo de nuevo.";

/** Payload exacto que espera cada endpoint. Sin campos de más. */
export function buildAuthPayload(
  mode: AuthMode,
  values: AuthFormValues
): Record<string, string> {
  if (mode === "login") {
    return {
      email: values.email,
      password: values.password,
    };
  }

  return {
    nombre: values.nombre ?? "",
    email: values.email,
    password: values.password,
    telefono: values.telefono ?? "",
    direccion: values.direccion ?? "",
    ciudad: values.ciudad ?? "",
    departamento: values.departamento ?? "",
  };
}

/** Errores por campo en español. Objeto vacío = válido. */
export function validateAuthForm(
  mode: AuthMode,
  values: AuthFormValues
): Partial<Record<AuthField, string>> {
  const errors: Partial<Record<AuthField, string>> = {};

  if (!values.email.trim()) {
    errors.email = "El correo es obligatorio";
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Introduce un correo válido";
  }

  if (!values.password) {
    errors.password = "La contraseña es obligatoria";
  } else if (mode === "register" && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  if (mode === "login") {
    return errors;
  }

  const requiredMessages: Partial<Record<AuthField, string>> = {
    nombre: "El nombre es obligatorio",
    telefono: "El teléfono es obligatorio",
    direccion: "La dirección es obligatoria",
    ciudad: "La ciudad es obligatoria",
    departamento: "El departamento es obligatorio",
  };

  for (const field of REGISTER_FIELDS) {
    if (field === "email" || field === "password") {
      continue;
    }
    if (!values[field]?.trim()) {
      errors[field] = requiredMessages[field] ?? "Este campo es obligatorio";
    }
  }

  return errors;
}

/** Mensaje en español para el usuario a partir del status + body de la API. */
export function authErrorMessage(status: number, body: unknown): string {
  if (status === 401) {
    return "Correo o contraseña incorrectos.";
  }

  if (status === 409) {
    return "Ese correo ya está registrado.";
  }

  if (status === 429) {
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  }

  if (status === 400) {
    const fieldError = firstFieldError(body);
    if (fieldError) {
      return fieldError;
    }
  }

  return GENERIC_ERROR;
}

function firstFieldError(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const details = (body as { details?: unknown }).details;
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  for (const value of Object.values(details as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0];
    }
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}
