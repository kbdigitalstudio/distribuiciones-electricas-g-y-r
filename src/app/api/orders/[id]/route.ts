"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageOrder,
  canReadOrder,
} from "@/lib/commercial-access";
import {
  CommercialError,
  isUuid,
  jsonSafe,
  normalizeText,
} from "@/lib/commercial";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  notFoundResponse,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import { orderDetailInclude } from "@/lib/commercial-includes";
import { lockOrderRow } from "@/lib/commercial-locks";
import {
  serializeOrder,
  serializeOrderStatusHistory,
} from "@/lib/commercial-serializers";
import { UpdateOrderSchema } from "@/lib/validations";

// GET /api/orders/[id] — Consultar pedido autorizado
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
      include: orderDetailInclude,
    });

    if (!order || !canReadOrder(order, auth.session.userId, auth.roles)) {
      return notFoundResponse("PEDIDO_NO_ENCONTRADO", "Pedido no encontrado");
    }

    return NextResponse.json({
      success: true,
      order: {
        ...serializeOrder(order),
        statusHistory: order.statusHistory.map(serializeOrderStatusHistory),
      },
    });
  } catch (error) {
    return handleCommercialError(error, "Error consultando pedido:");
  }
}

// PATCH /api/orders/[id] — Actualizar observaciones (solo pendiente de pago)
export async function PATCH(
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

  const parsed = UpdateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;

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

        if (existing.status !== "PENDING_PAYMENT") {
          throw new CommercialError(
            "PEDIDO_NO_EDITABLE",
            "Solo pueden editarse observaciones de un pedido pendiente de pago",
            409
          );
        }

        await tx.order.update({
          where: { id },
          data: {
            notes:
              data.notes === undefined
                ? existing.notes
                : data.notes === null
                  ? null
                  : normalizeText(data.notes),
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "ORDER_UPDATE",
            entityType: "Order",
            entityId: id,
            details: jsonSafe({
              updatedBy: auth.session.userId,
              fields: Object.keys(data),
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
    return handleCommercialError(error, "Error actualizando pedido:");
  }
}
