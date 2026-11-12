"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, canModifyUser } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";

async function authAndAuthorize(request: Request, userId: string, requireAdmin: boolean) {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return { response: NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status }), auth: null };
  }

  if (requireAdmin) {
    const forbidden = requireRole(auth.roles, "ADMIN");
    if (forbidden) {
      return { response: NextResponse.json({ error: forbidden.error, code: forbidden.code }, { status: forbidden.status }), auth: null };
    }
  } else if (!canModifyUser(userId, auth.session.userId, auth.roles)) {
    return { response: NextResponse.json({ error: "No puede modificar este usuario", code: "FORBIDDEN" }, { status: 403 }), auth: null };
  }

  return { response: null, auth };
}

// GET /api/users/[id] — Obtener usuario (propio o ADMIN)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAuthorize(request, id, false);
  if (result.response) return result.response;

  const user = await db.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } }, customer: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado", code: "USER_NOT_FOUND" }, { status: 404 });
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
      roles: user.roles.map((r) => r.role.name),
      customer: user.customer,
    },
  });
}

// PUT /api/users/[id] — Actualizar usuario (propio o ADMIN)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAuthorize(request, id, false);
  if (result.response) return result.response;
  const auth = result.auth!;

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json({ error: "Token CSRF inválido", code: "CSRF_INVALID" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { nombre, telefono, direccion, ciudad, departamento, isActive, roleName } = body;

    const updates: Record<string, unknown> = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (telefono !== undefined) updates.telefono = telefono;
    if (direccion !== undefined) updates.direccion = direccion;
    if (ciudad !== undefined) updates.ciudad = ciudad;
    if (departamento !== undefined) updates.departamento = departamento;
    if (isActive !== undefined) {
      // Solo ADMIN puede desactivar/activar usuarios
      if (!hasRole(auth.roles, "ADMIN")) {
        return NextResponse.json({ error: "No puede cambiar el estado de activación", code: "FORBIDDEN" }, { status: 403 });
      }
      updates.isActive = isActive;
    }

    // Cambiar rol solo si es ADMIN
    if (roleName !== undefined && hasRole(auth.roles, "ADMIN")) {
      await db.userRole.updateMany({
        where: { userId: id },
        data: {}, // Se manejaría con disconnect/connect en implementación completa
      });
      // Nota: asignación completa de rol requiere transacción; se deja como placeholder estructural
    }

    const user = await db.user.update({
      where: { id },
      data: updates,
      include: { roles: { include: { role: true } } },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "USER_UPDATE",
        entityType: "User",
        entityId: id,
        details: { updatedBy: auth.session.userId, fields: Object.keys(updates) },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        roles: user.roles.map((r) => r.role.name),
      },
    });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Desactivar usuario (solo ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAuthorize(request, id, true);
  if (result.response) return result.response;
  const auth = result.auth!;

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json({ error: "Token CSRF inválido", code: "CSRF_INVALID" }, { status: 403 });
  }

  try {
    // Soft delete: establecer isActive = false
    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "USER_DEACTIVATE",
        entityType: "User",
        entityId: id,
        details: { deactivatedBy: auth.session.userId },
      },
    });

    return NextResponse.json({ success: true, message: "Usuario desactivado" });
  } catch (error) {
    console.error("Error desactivando usuario:", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

function hasRole(roles: string[], role: string): boolean {
  return roles.includes(role);
}
