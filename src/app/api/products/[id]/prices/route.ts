"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { RegisterPriceSchema, PaginationSchema } from "@/lib/validations";

// GET /api/products/[id]/prices — Consultar historial de precios (público)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) ?? 1;
    const pageSize = Number(searchParams.get("pageSize")) ?? 20;

    const product = await db.product.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado", code: "PRODUCTO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const [prices, total] = await Promise.all([
      db.price.findMany({
        where: { productId: id },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { validFrom: "desc" },
      }),
      db.price.count({ where: { productId: id } }),
    ]);

    return NextResponse.json({
      success: true,
      product: { id: product.id, name: product.name, slug: product.slug },
      prices: prices.map((p) => ({
        id: p.id,
        amountInCents: p.priceCents,
        currency: p.currency,
        validFrom: p.validFrom,
        validTo: p.validTo,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error consultando historial de precios:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/prices — Registrar precio (solo ADMIN)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
    const parsed = RegisterPriceSchema.safeParse(body);

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

    const product = await db.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado", code: "PRODUCTO_NO_ENCONTRADO" },
        { status: 404 }
      );
    }

    const { amountInCents, currency, validFrom, validTo } = parsed.data;

    const validFromDate = validFrom ? new Date(validFrom) : new Date();
    const validToDate = validTo ? new Date(validTo) : null;

    // Validar que validTo sea posterior a validFrom
    if (validToDate && validToDate <= validFromDate) {
      return NextResponse.json(
        {
          error: "La fecha de fin debe ser posterior a la fecha de inicio",
          code: "VIGENCIA_INVALIDA",
        },
        { status: 400 }
      );
    }

    // Desactivar precios anteriores del producto (soft close)
    await db.price.updateMany({
      where: { productId: id, isActive: true },
      data: { isActive: false },
    });

    const price = await db.price.create({
      data: {
        productId: id,
        priceCents: amountInCents,
        currency,
        validFrom: validFromDate,
        validTo: validToDate,
        isActive: true,
      },
    });

    await db.operationLog.create({
      data: {
        userId: auth.session.userId,
        action: "PRICE_REGISTER",
        entityType: "Price",
        entityId: price.id,
        details: {
          productId: id,
          amountInCents,
          currency,
          validFrom: validFromDate,
          validTo: validToDate,
          registeredBy: auth.session.userId,
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        price: {
          id: price.id,
          amountInCents: price.priceCents,
          currency: price.currency,
          validFrom: price.validFrom,
          validTo: price.validTo,
          isActive: price.isActive,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registrando precio:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
