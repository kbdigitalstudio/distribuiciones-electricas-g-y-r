"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, clearSessionCookies } from "@/lib/session";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (session) {
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
      { status: 200 }
    );
  }
}
