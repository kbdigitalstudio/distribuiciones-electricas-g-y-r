"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import {
  CreateCategorySchema,
  PaginationSchema,
} from "@/lib/validations";

export const dynamic = "force-dynamic";

// GET /api/categories — Listar categorías (público: solo activas)
// Query: page, pageSize, search, parentId, isActive
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) ?? 1;
    const pageSize = Number(searchParams.get("pageSize")) ?? 20;
    const search = searchParams.get("search") ?? undefined;
    const parentId = searchParams.get("parentId") ?? undefined;
    const isActiveParam = searchParams.get("isActive");

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (isActiveParam !== undefined) {
      const isActive = isActiveParam === "true";
      if (!isActive) {
        const auth = await getAuthenticatedUser(request);
        if ("error" in auth) {
          return NextResponse.json(
            { error: auth.error, code: auth.code },
            { status: auth.status }
          );
        }
        const forbidden = requireRole(auth.roles, "ADMIN");
        if (forbidden) {
          return NextResponse.json(
            { error: forbidden.error, code: forbidden.code },
            { status: forbidden.status }
          );
        }
      }
      where.isActive = isActive;
    } else {
      where.isActive = true;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (parentId !== undefined) {
      where.parentId = parentId === "" ? null : parentId;
    }

    const [categories, total] = await Promise.all([
      db.category.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ level: "asc" }, { name: "asc" }],
        include: {
          parent: true,
          children: { where: { deletedAt: null, isActive: true } },
          _count: { select: { productsByCategory: true } },
        },
      }),
      db.category.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        parentId: c.parentId,
        level: c.level,
        isActive: c.isActive,
        parent: c.parent,
        children: c.children,
        productCount: c._count.productsByCategory,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error listando categorías:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/categories — Crear categoría (solo ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return NextResponse.json(
      { error: forbidden.error, code: forbidden.code },
      { status: forbidden.status }
    );
  }

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json(
      { error: "Token CSRF inválido", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = CreateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Datos inválidos",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      slug,
      description,
      imageUrl,
      parentId,
      isActive,
    } = parsed.data;

    // Verificar slug único
    const existingSlug = await db.category.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: "El slug ya existe", code: "SLUG_DUPLICADO" },
        { status: 409 }
      );
    }

    // Validar categoría padre si se especifica
    let level = 0;
    if (parentId) {
      const parent = await db.category.findUnique({ where: { id: parentId } });
      if (!parent || parent.deletedAt !== null) {
        return NextResponse.json(
          { error: "Categoría padre no encontrada", code: "PADRE_NO_ENCONTRADO" },
          { status: 404 }
        );
      }
      level = parent.level + 1;

      // Validar que no haya ciclos: la categoría padre no puede ser descendiente de sí misma
      // (Simplificación: validar que el nivel no exceda un límite razonable)
      if (level > 10) {
        return NextResponse.json(
          { error: "Jerarquía de categorías demasiado profunda", code: "JERARQUIA_MUY_PROFUNDA" },
          { status: 400 }
        );
      }
    }

    const category = await db.category.create({
      data: {
        name,
        slug,
        description: description ?? null,
        imageUrl: imageUrl ?? null,
        parentId: parentId ?? null,
        level,
        isActive: isActive ?? true,
      },
      include: { parent: true },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "CATEGORY_CREATE",
        entityType: "Category",
        entityId: category.id,
        details: { name, slug, parentId, level, createdBy: auth.session.userId },
      },
    });

    return NextResponse.json(
      {
        success: true,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parent: category.parent,
          level: category.level,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creando categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
