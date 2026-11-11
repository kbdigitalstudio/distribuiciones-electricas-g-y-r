"use node";

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "./src/lib/session";

// Rutas públicas que no requieren autenticación (cualquier método)
const PUBLIC_PATHS = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
];

// Rutas de catálogo con lectura pública: GET permite acceso sin sesión,
// métodos que modifican estado requieren sesión y autorización por rol en el route handler
const CATALOG_READ_PUBLIC_PATHS = [
  "/api/products",
  "/api/categories",
];

// Rutas que requieren autenticación para cualquier método
const AUTH_REQUIRED_PATHS = [
  "/api/users",
  "/api/roles",
  "/api/admin",
  "/api/inventory",
];

// Rutas que requieren rol ADMIN
const ADMIN_PATHS = ["/api/roles", "/api/admin"];

/**
 * Middleware de protección de rutas para el backend GYR (Etapas 2 y 3).
 *
 * - Verifica sesión válida (cookie HttpOnly) en rutas protegidas.
 * - Permite GET público en rutas de catálogo (productos, categorías).
 * - Valida CSRF (double submit cookie) en métodos que modifican estado.
 * - No modifica archivos originales del proyecto.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // 1. Rutas de API de autenticación: permiten acceso sin sesión
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Rutas de catálogo con lectura pública (GET sin sesión)
  if (CATALOG_READ_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Métodos de solo lectura: permitir sin sesión
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      return NextResponse.next();
    }
    // Métodos que modifican estado: requieren sesión
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    // CSRF para métodos de escritura
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headerCsrf = request.headers.get("x-csrf-token");
      if (!headerCsrf) {
        return NextResponse.json(
          { error: "Token CSRF requerido", code: "CSRF_REQUIRED" },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  // 3. Rutas protegidas: requieren autenticación para cualquier método
  if (AUTH_REQUIRED_PATHS.some((p) => pathname.startsWith(p))) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // 4. Rutas de administrador: requieren rol ADMIN
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
      if (session.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Acceso denegado: rol insuficiente", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    // 5. CSRF: validar presencia en métodos que modifican estado
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const headerCsrf = request.headers.get("x-csrf-token");
      if (!headerCsrf) {
        return NextResponse.json(
          { error: "Token CSRF requerido", code: "CSRF_REQUIRED" },
          { status: 403 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: [
    // Aplicar middleware a todas las rutas de API
    "/api/:path*",
  ],
};
