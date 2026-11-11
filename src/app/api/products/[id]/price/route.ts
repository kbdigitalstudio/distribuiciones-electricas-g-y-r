"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/products/[id]/price — Consultar precio vigente (público)
// Retorna null si no hay precio configurado (permite mostrar "A cotizar")
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

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

    const now = new Date();

    const activePrice = await db.price.findFirst({
      where: {
        productId: id,
        isActive: true,
        validFrom: { lte: now },
        ...(now.getTime() > 0
          ? {
              OR: [{ validTo: null }, { validTo: { gte: now } }],
            }
          : {}),
      },
      orderBy: { validFrom: "desc" },
    });

    if (!activePrice) {
      return NextResponse.json({
        success: true,
        product: { id: product.id, name: product.name, slug: product.slug },
        price: null, // null indica "A cotizar"
        message: "A cotizar",
      });
    }

    return NextResponse.json({
      success: true,
      product: { id: product.id, name: product.name, slug: product.slug },
      price: {
        amountInCents: activePrice.priceCents,
        currency: activePrice.currency,
        validFrom: activePrice.validFrom,
        validTo: activePrice.validTo,
      },
    });
  } catch (error) {
    console.error("Error consultando precio vigente:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
