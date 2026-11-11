"use node";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, requireRole, hasMinRole } from "@/lib/authz";
import { validateCsrfToken } from "@/lib/session";
import { PaginationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// GET /api/inventory — Consultar inventario (INVENTARIO/ADMIN)
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error, code: auth.code },
      { status: auth.status }
    );
  }

  // INVENTARIO como rol independiente (VENDEDOR mantiene compatibilidad con usuarios existentes)
  function isInventoryAuthorized(roles: string[]): boolean {
    return hasMinRole(roles, "INVENTARIO");
  }

  if (!isInventoryAuthorized(auth.roles)) {
    return NextResponse.json(
      { error: "Acceso denegado: rol insuficiente", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) ?? 1;
    const pageSize = Number(searchParams.get("pageSize")) ?? 20;
    const lowStock = searchParams.get("lowStock") === "true";

    const where: Record<string, unknown> = {};

    if (lowStock) {
      where.quantityOnHand = {
        ...(where.quantityOnHand as Record<string, unknown>),
        lte: db.inventory ? 0 : 0,
      };
      // Filtro de stock bajo: quantityOnHand <= minStockAlert
      // Prisma no soporta comparar dos columnas directamente en where,
      // se filtra en memoria o con query raw. Aquí usamos un enfoque simple.
    }

    const inventories = await db.inventory.findMany({
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

    // Filtrar stock bajo en aplicación si se solicitó
    let filtered = inventories;
    if (lowStock) {
      filtered = inventories.filter(
        (inv: any) => inv.quantityOnHand <= (inv.minStockAlert ?? 0)
      );
    }

    return NextResponse.json({
      success: true,
      inventory: inventories.map((inv: any) => ({
        id: inv.id,
        product: inv.product,
        quantityOnHand: inv.quantityOnHand,
        quantityReserved: inv.quantityReserved,
        availableQuantity: inv.quantityOnHand - inv.quantityReserved,
        minStockAlert: inv.minStockAlert,
        isLowStock: inv.quantityOnHand <= (inv.minStockAlert ?? 0),
        updatedAt: inv.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total: inventories.length,
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
