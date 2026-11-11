"use node";

import { cookies } from "next/headers";
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  type TokenPayload,
} from "./auth";

const SESSION_COOKIE = process.env.COOKIE_NAME ?? "gyr_session";
const CSRF_COOKIE = process.env.CSRF_COOKIE_NAME ?? "gyr_csrf_token";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? undefined;
const COOKIE_SAMESITE =
  (process.env.COOKIE_SAMESITE as "strict" | "lax" | "none") ?? "strict";

export interface SessionUser {
  userId: string;
  email: string;
  role: string;
  csrf: string;
}

/**
 * Lee el token de sesión de la cookie HttpOnly y lo verifica.
 * Retorna null si no hay sesión válida.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const payload = verifyAccessToken(token) as TokenPayload;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      csrf: payload.csrf,
    };
  } catch {
    return null;
  }
}

/**
 * Lee el refresh token de la cookie y lo verifica.
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("gyr_refresh_token")?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Establece las cookies de sesión (access + refresh) y CSRF.
 */
export async function setSessionCookies(
  session: SessionUser,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();

  const accessToken = signAccessToken({
    userId: session.userId,
    email: session.email,
    role: session.role,
    csrf: session.csrf,
  });

  const maxAge = 15 * 60; // 15 minutos para access token
  const refreshMaxAge = 7 * 24 * 60 * 60; // 7 días para refresh

  cookieStore.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge,
  });

  cookieStore.set("gyr_refresh_token", refreshToken, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: refreshMaxAge,
  });

  // CSRF token (no HttpOnly para que el cliente pueda leerlo y enviarlo en header)
  cookieStore.set(CSRF_COOKIE, session.csrf, {
    httpOnly: false,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge,
  });
}

/**
 * Elimina todas las cookies de sesión.
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  cookieStore.set("gyr_refresh_token", "", { path: "/", maxAge: 0 });
  cookieStore.set(CSRF_COOKIE, "", { path: "/", maxAge: 0 });
}

/**
 * Valida el token CSRF enviado en el header contra la cookie.
 */
export async function validateCsrfToken(
  headerCsrf: string | null
): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieCsrf = cookieStore.get(CSRF_COOKIE)?.value;
    if (!cookieCsrf || !headerCsrf) return false;
    return cookieCsrf === headerCsrf;
  } catch {
    return false;
  }
}
