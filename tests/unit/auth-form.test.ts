import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  buildAuthPayload,
  validateAuthForm,
  type AuthFormValues,
} from "@/lib/auth-form";

const validLoginValues: AuthFormValues = {
  email: "usuario@ejemplo.com",
  password: "secreto123",
};

const validRegisterValues = {
  nombre: "Ana Pérez",
  email: "ana@ejemplo.com",
  password: "secreto123",
  telefono: "3001234567",
  direccion: "Calle 1 #2-3",
  ciudad: "Bogotá",
  departamento: "Cundinamarca",
} satisfies AuthFormValues;

const registerRequiredFields = [
  "nombre",
  "email",
  "password",
  "telefono",
  "direccion",
  "ciudad",
  "departamento",
] as const;

describe("buildAuthPayload", () => {
  it("login devuelve solo email y password", () => {
    const payload = buildAuthPayload("login", {
      ...validLoginValues,
      nombre: "Ana Pérez",
      telefono: "3001234567",
      direccion: "Calle 1 #2-3",
      ciudad: "Bogotá",
      departamento: "Cundinamarca",
    });

    expect(payload).toEqual({
      email: "usuario@ejemplo.com",
      password: "secreto123",
    });
    expect(Object.keys(payload).sort()).toEqual(["email", "password"]);
    expect(Object.values(payload)).not.toContain(undefined);
  });

  it("register devuelve los siete campos exactos", () => {
    const payload = buildAuthPayload("register", validRegisterValues);

    expect(payload).toEqual({
      nombre: "Ana Pérez",
      email: "ana@ejemplo.com",
      password: "secreto123",
      telefono: "3001234567",
      direccion: "Calle 1 #2-3",
      ciudad: "Bogotá",
      departamento: "Cundinamarca",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "ciudad",
      "departamento",
      "direccion",
      "email",
      "nombre",
      "password",
      "telefono",
    ]);
    expect(Object.values(payload)).not.toContain(undefined);
  });
});

describe("validateAuthForm", () => {
  it("login marca error cuando el email no es válido", () => {
    const errors = validateAuthForm("login", {
      email: "correo-invalido",
      password: "secreto123",
    });

    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeUndefined();
  });

  it("login marca error cuando la contraseña está vacía", () => {
    const errors = validateAuthForm("login", {
      email: "usuario@ejemplo.com",
      password: "",
    });

    expect(errors.password).toBeTruthy();
    expect(errors.email).toBeUndefined();
  });

  it("login no devuelve errores con valores válidos", () => {
    expect(validateAuthForm("login", validLoginValues)).toEqual({});
  });

  for (const field of registerRequiredFields) {
    it(`register marca error cuando falta ${field}`, () => {
      const values: AuthFormValues = { ...validRegisterValues, [field]: "" };
      const errors = validateAuthForm("register", values);

      expect(errors[field]).toBeTruthy();
    });
  }

  it("register marca error con una contraseña de siete caracteres", () => {
    const errors = validateAuthForm("register", {
      ...validRegisterValues,
      password: "1234567",
    });

    expect(errors.password).toBeTruthy();
  });

  it("register marca error cuando el email no es válido", () => {
    const errors = validateAuthForm("register", {
      ...validRegisterValues,
      email: "correo-invalido",
    });

    expect(errors.email).toBeTruthy();
  });

  it("register no devuelve errores con valores válidos", () => {
    expect(validateAuthForm("register", validRegisterValues)).toEqual({});
  });
});

describe("authErrorMessage", () => {
  it("401 devuelve un mensaje genérico sin revelar el correo", () => {
    const message = authErrorMessage(401, {
      error: "El correo ana@ejemplo.com no existe",
      code: "INVALID_CREDENTIALS",
    });

    expect(message).toBe("Correo o contraseña incorrectos.");
    expect(message).not.toContain("ana@ejemplo.com");
  });

  it("409 informa que el correo ya está registrado", () => {
    expect(
      authErrorMessage(409, { error: "Ya existe", code: "USER_EXISTS" }),
    ).toBe("Ese correo ya está registrado.");
  });

  it("429 pide esperar por exceso de intentos", () => {
    expect(
      authErrorMessage(429, { error: "Demasiados", code: "RATE_LIMITED" }),
    ).toBe("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
  });

  it("400 con details devuelve el mensaje del primer campo con error", () => {
    const message = authErrorMessage(400, {
      error: "Datos inválidos",
      code: "VALIDATION_ERROR",
      details: { email: ["Email inválido"] },
    });

    expect(message).toContain("Email inválido");
  });

  it("500 devuelve un mensaje genérico", () => {
    expect(authErrorMessage(500, { error: "Error interno" })).toBe(
      "No pudimos completar la operación. Inténtalo de nuevo.",
    );
  });

  it("no lanza con body nulo o inesperado", () => {
    const casos: Array<[number, unknown]> = [
      [401, null],
      [400, undefined],
      [500, "texto inesperado"],
      [400, { details: "no es un objeto" }],
      [0, null],
    ];

    for (const [status, body] of casos) {
      expect(() => authErrorMessage(status, body)).not.toThrow();

      const message = authErrorMessage(status, body);
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
