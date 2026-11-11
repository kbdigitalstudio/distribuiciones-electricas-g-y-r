"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, hasRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { CreateCustomerSchema, PaginationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// GET /api/users — Listar usuarios (solo ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return NextResponse.json({ error: forbidden.error, code: forbidden.code }, { status: forbidden.status });
  }

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page")) ?? 1;
  const pageSize = Number(searchParams.get("pageSize")) ?? 20;

  const users = await db.user.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" },
    include: {
      roles: { include: { role: true } },
      customer: true,
    },
  });

  return NextResponse.json({
    success: true,
    users: users.map((u: any) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      telefono: u.telefono,
      ciudad: u.ciudad,
      departamento: u.departamento,
      isActive: u.isActive,
      createdAt: u.createdAt,
      roles: u.roles.map((r: any) => r.role.name),
      customer: u.customer,
    })),
    page,
    pageSize,
  });
}

// POST /api/users — Crear usuario (solo ADMIN, no permite auto-asignar roles privilegiados)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return NextResponse.json({ error: forbidden.error, code: forbidden.code }, { status: forbidden.status });
  }

  // Validar CSRF
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json({ error: "Token CSRF inválido", code: "CSRF_INVALID" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = CreateCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, nombre, telefono, direccion, ciudad, departamento, roleName } = body;

    // Solo ADMIN puede asignar roles; por defecto CLIENTE
    const roleToAssign = hasRole(auth.roles, "ADMIN") && roleName ? roleName : "CLIENTE";

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "El email ya está registrado", code: "USER_EXISTS" }, { status: 409 });
    }

    const { hashPassword } = await import("@/lib/auth");
    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        nombre,
        telefono,
        direccion,
        ciudad,
        departamento,
        isActive: true,
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { name: roleToAssign },
                create: { name: roleToAssign, description: `Rol ${roleToAssign}` },
              },
            },
          },
        },
        customer: {
          create: {
            personType: "NATURAL",
            documentType: "CC",
            primerNombre: nombre,
            telefono,
            direccion,
            ciudad,
            departamento,
            email,
          },
        },
      },
      include: { roles: { include: { role: true } } },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "USER_CREATE",
        entityType: "User",
        entityId: user.id,
        details: { email, role: roleToAssign, createdBy: auth.session.userId },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        roles: user.roles.map((r: any) => r.role.name),
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creando usuario:", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
