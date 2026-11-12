"use node";

import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { canReadOrder } from "@/lib/commercial-access";
import { isUuid } from "@/lib/commercial";
import {
  errorResponse,
  handleCommercialError,
  notFoundResponse,
} from "@/lib/commercial-http";
import { commercialCustomerSelect } from "@/lib/commercial-includes";
import { serializeOrderItem } from "@/lib/commercial-serializers";

// GET /api/orders/[id]/items — Líneas del pedido
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return errorResponse("ID_INVALIDO", "Identificador de pedido inválido", 400);
  }

  try {
    const order = await db.order.findUnique({
      where: { id },
      include: { customer: { select: commercialCustomerSelect } },
    });

    if (!order || !canReadOrder(order, auth.session.userId, auth.roles)) {
      return notFoundResponse("PEDIDO_NO_ENCONTRADO", "Pedido no encontrado");
    }

    const items = await db.orderItem.findMany({
      where: { orderId: id },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      success: true,
      orderId: id,
      items: items.map(serializeOrderItem),
    });
  } catch (error) {
    return handleCommercialError(error, "Error listando líneas de pedido:");
  }
}
