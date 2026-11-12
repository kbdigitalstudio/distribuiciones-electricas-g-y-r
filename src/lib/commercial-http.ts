import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { CommercialError, isPrismaUniqueError } from "@/lib/commercial";
import { validateCsrfToken } from "@/lib/session";

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    details === undefined ? { error: message, code } : { error: message, code, details },
    { status }
  );
}

export function validationErrorResponse(error: ZodError): NextResponse {
  return errorResponse(
    "VALIDATION_ERROR",
    "Datos inválidos",
    400,
    error.flatten().fieldErrors
  );
}

export async function requireCsrf(request: Request): Promise<NextResponse | null> {
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return errorResponse("CSRF_INVALID", "Token CSRF inválido", 403);
  }
  return null;
}

export function handleCommercialError(
  error: unknown,
  context: string
): NextResponse {
  if (error instanceof CommercialError) {
    return errorResponse(error.code, error.message, error.status);
  }

  if (isPrismaUniqueError(error)) {
    return errorResponse(
      "REGISTRO_DUPLICADO",
      "La operación entra en conflicto con un registro existente",
      409
    );
  }

  console.error(context, error);
  return errorResponse("INTERNAL_ERROR", "Error interno del servidor", 500);
}

export function forbiddenResponse(
  message = "Acceso denegado"
): NextResponse {
  return errorResponse("FORBIDDEN", message, 403);
}

export function notFoundResponse(
  code: string,
  message: string
): NextResponse {
  return errorResponse(code, message, 404);
}
