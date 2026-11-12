"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/authz";
import { canAccessInventory } from "@/lib/roles";

// GET /api/inventory/[productId] — Consultar inventario de producto (INVENTARIO/ADMIN)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  if (!canAccessInventory(auth.roles)) {
    return NextResponse.json(
      { error: "Acceso denegado: se requiere rol INVENTARIO o ADMIN", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const { productId } = await params;

    const inventory = await db.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: { id: true, slug: true, name: true, isActive: true },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json(
        {
          error: "Inventario no encontrado para este producto",
          code: "INVENTARIO_NO_ENCONTRADO",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      inventory: {
        id: inventory.id,
        product: inventory.product,
        quantityOnHand: inventory.quantityOnHand,
        quantityReserved: inventory.quantityReserved,
        availableQuantity: inventory.quantityOnHand - inventory.quantityReserved,
        minStockAlert: inventory.minStockAlert,
        isLowStock: inventory.quantityOnHand <= inventory.minStockAlert,
        updatedAt: inventory.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error consultando inventario de producto:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
