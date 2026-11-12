"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { canManageQuote } from "@/lib/commercial-access";
import {
  CommercialError,
  assertQuoteTransition,
  isQuoteExpired,
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
import { quoteDetailInclude } from "@/lib/commercial-includes";
import { lockQuoteRow } from "@/lib/commercial-locks";
import {
  serializeQuote,
  serializeQuoteStatusHistory,
} from "@/lib/commercial-serializers";
import { QuoteStatusChangeSchema } from "@/lib/validations";

// POST /api/quotes/[id]/status — Cambiar estado de una cotización
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
    return errorResponse("ID_INVALIDO", "Identificador de cotización inválido", 400);
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
  }

  const parsed = QuoteStatusChangeSchema.safeParse(body);
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
    const quote = await db.$transaction(
      async (tx) => {
        await lockQuoteRow(tx, id);

        const existing = await tx.quote.findUnique({ where: { id } });

        if (!existing) {
          throw new CommercialError(
            "COTIZACION_NO_ENCONTRADA",
            "Cotización no encontrada",
            404
          );
        }

        if (!canManageQuote(existing, auth.session.userId, auth.roles)) {
          throw new CommercialError(
            "FORBIDDEN",
            "No puede administrar esta cotización",
            403
          );
        }

        assertQuoteTransition(existing.status, targetStatus);

        const now = new Date();
        const expired = isQuoteExpired(existing.validUntil, now);

        if (
          (targetStatus === "SENT" || targetStatus === "ACCEPTED") &&
          expired
        ) {
          throw new CommercialError(
            "COTIZACION_VENCIDA",
            "La cotización está vencida; primero debe marcarse como EXPIRED",
            409
          );
        }

        if (targetStatus === "EXPIRED" && !expired) {
          throw new CommercialError(
            "COTIZACION_VIGENTE",
            "Solo puede marcarse como EXPIRED una cotización cuya vigencia ya terminó",
            409
          );
        }

        if (targetStatus === "CANCELLED") {
          const converted = await tx.order.findUnique({
            where: { quoteId: id },
            select: { id: true },
          });

          if (converted) {
            throw new CommercialError(
              "COTIZACION_CON_PEDIDO",
              "La cotización ya originó un pedido y no puede cancelarse",
              409
            );
          }
        }

        await tx.quote.update({
          where: { id },
          data: { status: targetStatus },
        });

        await tx.quoteStatusHistory.create({
          data: {
            quoteId: id,
            fromStatus: existing.status,
            toStatus: targetStatus,
            changedBy: auth.session.userId,
            reason,
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "QUOTE_STATUS_CHANGE",
            entityType: "Quote",
            entityId: id,
            details: jsonSafe({
              fromStatus: existing.status,
              toStatus: targetStatus,
              changedBy: auth.session.userId,
              reason,
            }) as Prisma.InputJsonValue,
          },
        });

        return tx.quote.findUniqueOrThrow({
          where: { id },
          include: quoteDetailInclude,
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
      quote: {
        ...serializeQuote(quote),
        statusHistory: quote.statusHistory.map(serializeQuoteStatusHistory),
      },
    });
  } catch (error) {
    if (error instanceof CommercialError && error.status === 403) {
      return forbiddenResponse(error.message);
    }
    return handleCommercialError(error, "Error cambiando estado de cotización:");
  }
}
