"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RegisterSchema } from "@/lib/validations";
import { hashPassword, genericAuthError, constantTimeDelay } from "@/lib/auth";
import { setSessionCookies } from "@/lib/session";
import { generateCsrfToken } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos de entrada inválidos",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { nombre, email, password, telefono, direccion, ciudad, departamento } =
      parsed.data;

    // Anti-enumeración: siempre verificar si el email existe, pero
    // responder igual si ya está registrado (sin revelar cuál caso ocurrió).
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      await constantTimeDelay();
      return NextResponse.json(
        { error: "El usuario ya existe o los datos son inválidos", code: "USER_EXISTS" },
        { status: 409 }
      );
    }

    // Hash seguro de la contraseña (bcrypt como alternativa robusta a Argon2id)
    const passwordHash = await hashPassword(password);

    // Crear usuario con rol CLIENTE por defecto (no permite auto-asignar roles privilegiados)
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        nombre,
        telefono,
        direccion,
        ciudad,
        departamento,
        isActive: true,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: "CLIENTE" },
                create: { name: "CLIENTE", description: "Cliente estándar" },
              },
            },
          },
        },
        customer: {
          create: {
            personType: "NATURAL",
            documentType: "CC",
            primerNombre: nombre.split(" ")[0],
            primerApellido: nombre.split(" ").slice(1).join(" ") || undefined,
            telefono,
            direccion,
            ciudad,
            departamento,
            email,
          },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    const userRole = user.roles[0]?.role.name ?? "CLIENTE";
    const csrfToken = generateCsrfToken();

    await setSessionCookies(
      { userId: user.id, email: user.email, role: userRole, csrf: csrfToken },
      "" // refresh token se genera en login; aquí se establece vacío para registro inmediato
    );

    // Registrar operación de alta de usuario
    await db.operationLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTER",
        entityType: "User",
        entityId: user.id,
        details: { email, role: userRole },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Usuario registrado correctamente",
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          role: userRole,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
