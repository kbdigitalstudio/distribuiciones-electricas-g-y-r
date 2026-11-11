"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { UpdateCategorySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

async function authAndAdmin(
  request: Request
) {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return {
      response: NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      ),
      auth: null,
    };
  }

  const forbidden = requireRole(auth.roles, "ADMIN");
  if (forbidden) {
    return {
      response: NextResponse.json(
        { error: forbidden.error, code: forbidden.code },
        { status: forbidden.status }
      ),
      auth: null,
    };
  }

  return { response: null, auth };
}

// GET /api/categories/[id] — Consultar categoría (público si está activa)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const category = await db.category.findUnique({
      where: { id, deletedAt: null },
      include: {
        parent: true,
        children: { where: { deletedAt: null, isActive: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoría no encontrada", code: "CATEGORIA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    if (!category.isActive) {
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

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        parentId: category.parentId,
        level: category.level,
        isActive: category.isActive,
        parent: category.parent,
        children: category.children,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error consultando categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PATCH /api/categories/[id] — Actualizar categoría (solo ADMIN)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAdmin(request);
  if (result.response) return result.response;
  const auth = result.auth!;

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json(
      { error: "Token CSRF inválido", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = UpdateCategorySchema.safeParse(body);

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

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Categoría no encontrada", code: "CATEGORIA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    // Verificar slug único si se cambia
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const existingSlug = await db.category.findUnique({
        where: { slug: parsed.data.slug },
      });
      if (existingSlug) {
        return NextResponse.json(
          { error: "El slug ya existe", code: "SLUG_DUPLICADO" },
          { status: 409 }
        );
      }
    }

    // Validar categoría padre si se cambia
    let level = existing.level;
    if (parsed.data.parentId !== undefined) {
      if (parsed.data.parentId === id) {
        return NextResponse.json(
          { error: "Una categoría no puede ser padre de sí misma", code: "CICLO_DETECTADO" },
          { status: 400 }
        );
      }
      if (parsed.data.parentId) {
        const parent = await db.category.findUnique({
          where: { id: parsed.data.parentId },
        });
        if (!parent || parent.deletedAt !== null) {
          return NextResponse.json(
            { error: "Categoría padre no encontrada", code: "PADRE_NO_ENCONTRADO" },
            { status: 404 }
          );
        }
        level = parent.level + 1;
        if (level > 10) {
          return NextResponse.json(
            { error: "Jerarquía de categorías demasiado profunda", code: "JERARQUIA_MUY_PROFUNDA" },
            { status: 400 }
          );
        }
      } else {
        level = 0;
      }
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.imageUrl !== undefined)
      updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.parentId !== undefined) {
      updates.parentId = parsed.data.parentId ?? null;
      updates.level = level;
    }
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    const category = await db.category.update({
      where: { id },
      data: updates,
      include: { parent: true },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "CATEGORY_UPDATE",
        entityType: "Category",
        entityId: id,
        details: { updatedBy: auth.session.userId, fields: Object.keys(updates) },
      },
    });

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent: category.parent,
        level: category.level,
      },
    });
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] — Desactivación lógica (solo ADMIN)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAdmin(request);
  if (result.response) return result.response;
  const auth = result.auth!;

  const csrfHeader = request.headers.get("x-csrf-token");
  if (!(await validateCsrfToken(csrfHeader))) {
    return NextResponse.json(
      { error: "Token CSRF inválido", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }

  try {
    const existing = await db.category.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Categoría no encontrada", code: "CATEGORIA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    // Verificar que no tenga productos asociados activos
    const productsCount = await db.product.count({
      where: { categoryId: id, deletedAt: null, isActive: true },
    });
    if (productsCount > 0) {
      return NextResponse.json(
        {
          error: "No se puede desactivar una categoría con productos activos",
          code: "CATEGORIA_CON_PRODUCTOS",
        },
        { status: 409 }
      );
    }

    // Verificar que no tenga subcategorías activas
    const childrenCount = await db.category.count({
      where: { parentId: id, deletedAt: null, isActive: true },
    });
    if (childrenCount > 0) {
      return NextResponse.json(
        {
          error: "No se puede desactivar una categoría con subcategorías activas",
          code: "CATEGORIA_CON_SUBCATEGORIAS",
        },
        { status: 409 }
      );
    }

    await db.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "CATEGORY_DELETE",
        entityType: "Category",
        entityId: id,
        details: { deletedBy: auth.session.userId },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Categoría desactivada correctamente",
    });
  } catch (error) {
    console.error("Error desactivando categoría:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
