"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, clearSessionCookies } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (session) {
      // Logout cambia estado: exige el token CSRF (cookie no httpOnly + header).
      const csrfHeader = request.headers.get("x-csrf-token");
      if (!csrfHeader || csrfHeader !== session.csrf) {
        return NextResponse.json(
          { success: false, error: "Token CSRF inválido" },
          { status: 403 },
        );
      }

      await db.operationLog.create({
        data: {
          userId: session.userId,
          action: "USER_LOGOUT",
          entityType: "User",
          entityId: session.userId,
        },
      });
    }

    await clearSessionCookies();

    return NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  } catch (error) {
    console.error("Error en logout:", error);
    // Mesmo en error, limpiar cookies para forzar salida
    await clearSessionCookies();
    return NextResponse.json(
      { success: true, message: "Sesión cerrada" },
      { status: 200 },
    );
  }
}
