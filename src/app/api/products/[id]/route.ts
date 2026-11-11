"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, canModifyUser } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { UpdateProductSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

async function authAndAuthorize(
  request: Request,
  productId: string,
  requireAdmin: boolean
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

  if (requireAdmin) {
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
  }

  return { response: null, auth };
}

// GET /api/products/[id] — Consultar producto (público si está activo)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: true,
        subcategory: true,
        prices: {
          where: { isActive: true },
          orderBy: { validFrom: "desc" },
          take: 1,
        },
        inventory: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado", code: "PRODUCTO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    // Si el producto está inactivo, solo autenticados pueden verlo
    if (!product.isActive) {
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
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        category: product.category,
        subcategory: product.subcategory,
        sku: product.sku,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        currentPrice: product.prices[0]?.priceCents
          ? {
              amountInCents: product.prices[0].priceCents,
              currency: product.prices[0].currency,
            }
          : null,
        inventory: product.inventory
          ? {
              quantityOnHand: product.inventory.quantityOnHand,
              quantityReserved: product.inventory.quantityReserved,
              availableQuantity:
                product.inventory.quantityOnHand -
                product.inventory.quantityReserved,
              minStockAlert: product.inventory.minStockAlert,
            }
          : null,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error consultando producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// PATCH /api/products/[id] — Actualizar producto (solo ADMIN)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const result = await authAndAuthorize(request, id, true);
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
    const parsed = UpdateProductSchema.safeParse(body);

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

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Producto no encontrado", code: "PRODUCTO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    // Verificar slug único si se cambia
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const existingSlug = await db.product.findUnique({
        where: { slug: parsed.data.slug },
      });
      if (existingSlug) {
        return NextResponse.json(
          { error: "El slug ya existe", code: "SLUG_DUPLICADO" },
          { status: 409 }
        );
      }
    }

    // Verificar SKU único si se cambia
    if (parsed.data.sku && parsed.data.sku !== existing.sku) {
      const existingSku = await db.product.findUnique({
        where: { sku: parsed.data.sku },
      });
      if (existingSku) {
        return NextResponse.json(
          { error: "El SKU ya existe", code: "SKU_DUPLICADO" },
          { status: 409 }
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.slug !== undefined) updates.slug = parsed.data.slug;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.shortDescription !== undefined)
      updates.shortDescription = parsed.data.shortDescription;
    if (parsed.data.categoryId !== undefined)
      updates.categoryId = parsed.data.categoryId;
    if (parsed.data.subcategoryId !== undefined)
      updates.subcategoryId = parsed.data.subcategoryId;
    if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
    if (parsed.data.imageUrl !== undefined)
      updates.imageUrl = parsed.data.imageUrl;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    const product = await db.product.update({
      where: { id },
      data: updates,
      include: { category: true, subcategory: true },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "PRODUCT_UPDATE",
        entityType: "Product",
        entityId: id,
        details: { updatedBy: auth.session.userId, fields: Object.keys(updates) },
      },
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
      },
    });
  } catch (error) {
    console.error("Error actualizando producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] — Desactivación lógica (solo ADMIN)
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
    return NextResponse.json(
      { error: "Token CSRF inválido", code: "CSRF_INVALID" },
      { status: 403 }
    );
  }

  try {
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt !== null) {
      return NextResponse.json(
        { error: "Producto no encontrado", code: "PRODUCTO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    // Soft delete: establecer deletedAt y isActive = false
    await db.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "PRODUCT_DELETE",
        entityType: "Product",
        entityId: id,
        details: { deletedBy: auth.session.userId },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Producto desactivado correctamente",
    });
  } catch (error) {
    console.error("Error desactivando producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
