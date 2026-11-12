"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";

// GET /api/roles — Listar roles (solo ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return NextResponse.json({ error: forbidden.error, code: forbidden.code }, { status: forbidden.status });
  }

  const roles = await db.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
  });

  return NextResponse.json({
    success: true,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions.map((rp) => rp.permission),
      userCount: r._count.userRoles,
    })),
  });
}

// POST /api/roles — Crear rol (solo ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return NextResponse.json({ error: forbidden.error, code: forbidden.code }, { status: forbidden.status });
  }

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json({ error: "Token CSRF inválido", code: "CSRF_INVALID" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, permissionIds } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Nombre de rol obligatorio", code: "VALIDATION_ERROR" }, { status: 400 });
    }

    const existing = await db.role.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "El rol ya existe", code: "ROLE_EXISTS" }, { status: 409 });
    }

    const role = await db.role.create({
      data: {
        name,
        description: description ?? null,
        permissions: permissionIds && Array.isArray(permissionIds)
          ? {
              create: permissionIds.map((permissionId: string) => ({
                permission: { connect: { id: permissionId } },
              })),
            }
          : undefined,
      },
      include: { permissions: { include: { permission: true } } },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "ROLE_CREATE",
        entityType: "Role",
        entityId: role.id,
        details: { name, description, createdBy: auth.session.userId },
      },
    });

    return NextResponse.json({
      success: true,
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creando rol:", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
