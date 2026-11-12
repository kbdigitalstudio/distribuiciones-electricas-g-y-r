"use node";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, {
  type SignOptions,
  type VerifyOptions,
} from "jsonwebtoken";

// ------------------------------------------------------------
// Hash de contraseñas (bcrypt como alternativa robusta a Argon2id)
// ------------------------------------------------------------
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ------------------------------------------------------------
// JWT (access token de corta vida + refresh token)
// ------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET no está definido o es demasiado corto (mínimo 32 caracteres)"
  );
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
  throw new Error(
    "JWT_REFRESH_SECRET no está definido o es demasiado corto (mínimo 32 caracteres)"
  );
}

export type TokenPayload = {
  userId: string;
  email: string;
  role: string;
  csrf: string;
};

type JwtSignOptions = {
  expiresIn?: SignOptions["expiresIn"];
  issuer?: string;
  audience?: string;
};

function signToken(
  secret: string,
  payload: object,
  opts: SignOptions
): string {
  return jwt.sign(payload, secret, opts);
}

function verifyToken<T = unknown>(
  token: string,
  secret: string,
  opts: VerifyOptions
): T {
  return jwt.verify(token, secret, opts) as T;
}

export function signAccessToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
  opts?: JwtSignOptions
): string {
  return signToken(JWT_SECRET, payload, {
    expiresIn: (opts?.expiresIn ??
      process.env.JWT_EXPIRES_IN ??
      "15m") as SignOptions["expiresIn"],
    issuer: "gyr",
    audience: "gyr-app",
    ...opts,
  });
}

export function signRefreshToken(payload: {
  userId: string;
  email: string;
}): string {
  return signToken(JWT_REFRESH_SECRET, payload, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ??
      "7d") as SignOptions["expiresIn"],
    issuer: "gyr",
    audience: "gyr-app",
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return verifyToken<TokenPayload>(token, JWT_SECRET, {
    issuer: "gyr",
    audience: "gyr-app",
  });
}

export function verifyRefreshToken(token: string): {
  userId: string;
  email: string;
} {
  return verifyToken(token, JWT_REFRESH_SECRET, {
    issuer: "gyr",
    audience: "gyr-app",
  });
}

// ------------------------------------------------------------
// CSRF token (double submit cookie pattern)
// ------------------------------------------------------------
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ------------------------------------------------------------
// Utilidades de respuesta de error genérica (anti-enumeración)
// ------------------------------------------------------------
export const INVALID_CREDENTIALS_MSG = "Credenciales inválidas";

export async function constantTimeDelay(): Promise<void> {
  const ms = 50 + Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function genericAuthError() {
  return {
    error: INVALID_CREDENTIALS_MSG,
    code: "INVALID_CREDENTIALS",
  };
}
