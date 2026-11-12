"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { canManageOrder } from "@/lib/commercial-access";
import {
  CommercialError,
  assertOrderTransition,
  isUuid,
  jsonSafe,
  normalizeText,
} from "@/lib/commercial";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import { orderDetailInclude } from "@/lib/commercial-includes";
import { lockOrderRow } from "@/lib/commercial-locks";
import {
  serializeOrder,
  serializeOrderStatusHistory,
} from "@/lib/commercial-serializers";
import { OrderStatusChangeSchema } from "@/lib/validations";

// POST /api/orders/[id]/status — Cambiar estado de un pedido.
//
// PAID y REFUNDED no son alcanzables por API: requieren una integración de
// pagos real y autorizada. La respuesta es PAGO_NO_AUTORIZADO.
export async function POST(
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

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
  }

  const parsed = OrderStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const { status: targetStatus } = parsed.data;
  const reason =
    parsed.data.reason === undefined
      ? null
      : parsed.data.reason === null
        ? null
        : normalizeText(parsed.data.reason);

  try {
    const order = await db.$transaction(
      async (tx) => {
        await lockOrderRow(tx, id);

        const existing = await tx.order.findUnique({ where: { id } });

        if (!existing) {
          throw new CommercialError(
            "PEDIDO_NO_ENCONTRADO",
            "Pedido no encontrado",
            404
          );
        }

        if (!canManageOrder(existing, auth.session.userId, auth.roles)) {
          throw new CommercialError(
            "FORBIDDEN",
            "No puede administrar este pedido",
            403
          );
        }

        assertOrderTransition(existing.status, targetStatus);

        await tx.order.update({
          where: { id },
          data: { status: targetStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            fromStatus: existing.status,
            toStatus: targetStatus,
            changedBy: auth.session.userId,
            reason,
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "ORDER_STATUS_CHANGE",
            entityType: "Order",
            entityId: id,
            details: jsonSafe({
              fromStatus: existing.status,
              toStatus: targetStatus,
              changedBy: auth.session.userId,
              reason,
            }) as Prisma.InputJsonValue,
          },
        });

        return tx.order.findUniqueOrThrow({
          where: { id },
          include: orderDetailInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
        maxWait: 10000,
      }
    );

    return NextResponse.json({
      success: true,
      order: {
        ...serializeOrder(order),
        statusHistory: order.statusHistory.map(serializeOrderStatusHistory),
      },
    });
  } catch (error) {
    if (error instanceof CommercialError && error.status === 403) {
      return forbiddenResponse(error.message);
    }
    return handleCommercialError(error, "Error cambiando estado de pedido:");
  }
}
