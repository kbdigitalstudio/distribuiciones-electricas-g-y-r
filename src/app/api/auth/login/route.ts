"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LoginSchema } from "@/lib/validations";
import {
  verifyPassword,
  genericAuthError,
  constantTimeDelay,
  INVALID_CREDENTIALS_MSG,
} from "@/lib/auth";
import { signAccessToken, signRefreshToken, type TokenPayload } from "@/lib/auth";
import { setSessionCookies } from "@/lib/session";
import { generateCsrfToken } from "@/lib/auth";

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES ?? 15);

export async function POST(request: Request): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      // Anti-enumeración: mismo retraso aunque falle la validación
      await constantTimeDelay();
      return NextResponse.json(genericAuthError(), { status: 401 });
    }

    const { email, password } = parsed.data;

    // --- Protección contra fuerza bruta ---
    const lockoutUntil = new Date(
      Date.now() - LOCKOUT_MINUTES * 60 * 1000
    );
    const recentAttempts = await db.loginAttempt.count({
      where: {
        email,
        ipAddress: ip,
        attemptedAt: { gte: lockoutUntil },
        success: false,
      },
    });

    if (recentAttempts >= MAX_LOGIN_ATTEMPTS) {
      await constantTimeDelay();
      return NextResponse.json(
        {
          error: "Demasiados intentos fallidos. Intente de nuevo más tarde.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    // --- Buscar usuario ---
    const user = await db.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    let passwordValid = false;

    if (user) {
      // Anti-enumeración: si el usuario está inactivo, también fallar igual
      if (user.isActive) {
        passwordValid = await verifyPassword(password, user.passwordHash);
      }

      if (passwordValid) {
        // Éxito: limpiar intentos fallidos y registrar intento exitoso
        await db.loginAttempt.create({
          data: {
            userId: user.id,
            email,
            ipAddress: ip,
            success: true,
          },
        });

        const userRole = user.roles[0]?.role.name ?? "CLIENTE";
        const csrfToken = generateCsrfToken();

        const refreshToken = signRefreshToken({
          userId: user.id,
          email: user.email,
        });

        await setSessionCookies(
          { userId: user.id, email: user.email, role: userRole, csrf: csrfToken },
          refreshToken
        );

        await db.operationLog.create({
          data: {
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
            details: { ipAddress: ip, role: userRole },
          },
        });

        return NextResponse.json({
          success: true,
          message: "Inicio de sesión exitoso",
          user: {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            role: userRole,
          },
        });
      }
    }

    // --- Fallo: registrar intento y responder genérico (anti-enumeración) ---
    await constantTimeDelay();
    await db.loginAttempt.create({
      data: {
        userId: user?.id,
        email,
        ipAddress: ip,
        success: false,
      },
    });

    return NextResponse.json(genericAuthError(), { status: 401 });
  } catch (error) {
    console.error("Error en login:", error);
    await constantTimeDelay();
    return NextResponse.json(genericAuthError(), { status: 401 });
  }
}
