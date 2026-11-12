"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/authz";
import { canAccessInventory } from "@/lib/roles";
import { PaginationSchema } from "@/lib/validations";

// GET /api/inventory — Consultar inventario (INVENTARIO/ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
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
    const { searchParams } = new URL(request.url);
    const pagination = PaginationSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!pagination.success) {
      return NextResponse.json(
        {
          error: "Parámetros de paginación inválidos",
          code: "VALIDATION_ERROR",
          details: pagination.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { page, pageSize } = pagination.data;
    const lowStock = searchParams.get("lowStock") === "true";

    // Prisma no permite comparar dos columnas en `where`; se obtienen los IDs
    // que cumplen quantityOnHand <= minStockAlert y luego se pagina en SQL.
    let where: { id?: { in: string[] } } = {};
    let total: number;

    if (lowStock) {
      const lowStockRows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Inventory"
        WHERE "quantityOnHand" <= "minStockAlert"
      `;
      const lowStockIds = lowStockRows.map((row) => row.id);

      if (lowStockIds.length === 0) {
        return NextResponse.json({
          success: true,
          inventory: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        });
      }

      where = { id: { in: lowStockIds } };
      total = lowStockIds.length;
    } else {
      total = await db.inventory.count();
    }

    const inventories = await db.inventory.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      inventory: inventories.map((inv) => ({
        id: inv.id,
        product: inv.product,
        quantityOnHand: inv.quantityOnHand,
        quantityReserved: inv.quantityReserved,
        availableQuantity: inv.quantityOnHand - inv.quantityReserved,
        minStockAlert: inv.minStockAlert,
        isLowStock: inv.quantityOnHand <= inv.minStockAlert,
        updatedAt: inv.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error consultando inventario:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
