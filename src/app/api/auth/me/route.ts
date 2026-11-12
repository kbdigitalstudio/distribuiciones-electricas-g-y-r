"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "No autenticado", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: {
        roles: { include: { role: true } },
        customer: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Usuario no encontrado o inactivo", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        telefono: user.telefono,
        direccion: user.direccion,
        ciudad: user.ciudad,
        departamento: user.departamento,
        isActive: user.isActive,
        emailVerifiedAt: user.emailVerifiedAt,
        roles: user.roles.map((r) => r.role.name),
        customer: user.customer,
      },
    });
  } catch (error) {
    console.error("Error en /me:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
