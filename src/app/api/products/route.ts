"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import {
  CreateProductSchema,
  PaginationSchema,
} from "@/lib/validations";

// GET /api/products — Listar productos (público: solo activos)
// Query: page, pageSize, search, categoryId, isActive
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) ?? 1;
    const pageSize = Number(searchParams.get("pageSize")) ?? 20;
    const search = searchParams.get("search") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const isActiveParam = searchParams.get("isActive");

    // Filtro base: solo productos no eliminados lógicamente
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    // Si se solicita explícitamente isActive=false, solo ADMIN puede ver inactivos
    if (isActiveParam !== undefined) {
      const isActive = isActiveParam === "true";
      if (!isActive) {
        // Verificar autenticación y rol para ver inactivos
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
      // Por defecto, solo activos para público y clientes
      where.isActive = true;
    }

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
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
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      products: products.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        shortDescription: p.shortDescription,
        category: p.category,
        subcategory: p.subcategory,
        sku: p.sku,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        currentPrice: p.prices[0]?.priceCents
          ? {
              amountInCents: p.prices[0].priceCents,
              currency: p.prices[0].currency,
            }
          : null, // null = "A cotizar"
        inventory: p.inventory
          ? {
              quantityOnHand: p.inventory.quantityOnHand,
              quantityReserved: p.inventory.quantityReserved,
              availableQuantity:
                p.inventory.quantityOnHand - p.inventory.quantityReserved,
              minStockAlert: p.inventory.minStockAlert,
            }
          : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error listando productos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/products — Crear producto (solo ADMIN)
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
    const parsed = CreateProductSchema.safeParse(body);

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
      shortDescription,
      categoryId,
      subcategoryId,
      sku,
      imageUrl,
      isActive,
    } = parsed.data;

    // Verificar que el slug no exista
    const existingSlug = await db.product.findUnique({ where: { slug } });
    if (existingSlug) {
      return NextResponse.json(
        { error: "El slug ya existe", code: "SLUG_DUPLICADO" },
        { status: 409 }
      );
    }

    // Verificar que la categoría exista
    const category = await db.category.findUnique({ where: { id: categoryId } });
    if (!category || category.deletedAt !== null) {
      return NextResponse.json(
        { error: "Categoría no encontrada", code: "CATEGORIA_NO_ENCONTRADA" },
        { status: 404 }
      );
    }

    // Si hay subcategoría, verificar que exista y que pertenezca a la categoría
    if (subcategoryId) {
      const subcategory = await db.category.findUnique({
        where: { id: subcategoryId },
      });
      if (!subcategory || subcategory.deletedAt !== null) {
        return NextResponse.json(
          { error: "Subcategoría no encontrada", code: "SUBCATEGORIA_NO_ENCONTRADA" },
          { status: 404 }
        );
      }
      if (subcategory.parentId !== categoryId) {
        return NextResponse.json(
          {
            error: "La subcategoría no pertenece a la categoría especificada",
            code: "SUBCATEGORIA_INVALIDA",
          },
          { status: 400 }
        );
      }
    }

    // Verificar SKU único si se proporciona
    if (sku) {
      const existingSku = await db.product.findUnique({ where: { sku } });
      if (existingSku) {
        return NextResponse.json(
          { error: "El SKU ya existe", code: "SKU_DUPLICADO" },
          { status: 409 }
        );
      }
    }

    const product = await db.product.create({
      data: {
        name,
        slug,
        description: description ?? null,
        shortDescription: shortDescription ?? null,
        categoryId,
        subcategoryId: subcategoryId ?? null,
        sku: sku ?? null,
        imageUrl: imageUrl ?? null,
        isActive: isActive ?? true,
      },
      include: { category: true, subcategory: true },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "PRODUCT_CREATE",
        entityType: "Product",
        entityId: product.id,
        details: {
          name,
          slug,
          categoryId,
          createdBy: auth.session.userId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        product: {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          subcategory: product.subcategory,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creando producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
