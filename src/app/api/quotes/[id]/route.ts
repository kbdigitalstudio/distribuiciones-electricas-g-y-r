"use node";

import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageQuote,
  canReadQuote,
} from "@/lib/commercial-access";
import {
  CommercialError,
  isQuoteExpired,
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
import { quoteDetailInclude } from "@/lib/commercial-includes";
import { resolveCommercialItems } from "@/lib/commercial-items";
import { lockQuoteRow } from "@/lib/commercial-locks";
import {
  serializeQuote,
  serializeQuoteStatusHistory,
} from "@/lib/commercial-serializers";
import { UpdateQuoteSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

// GET /api/quotes/[id] — Consultar cotización autorizada
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
    return errorResponse("ID_INVALIDO", "Identificador de cotización inválido", 400);
  }

  try {
    const quote = await db.quote.findUnique({
      where: { id },
      include: quoteDetailInclude,
    });

    if (!quote || !canReadQuote(quote, auth.session.userId, auth.roles)) {
      return notFoundResponse(
        "COTIZACION_NO_ENCONTRADA",
        "Cotización no encontrada"
      );
    }

    return NextResponse.json({
      success: true,
      quote: {
        ...serializeQuote(quote),
        statusHistory: quote.statusHistory.map(serializeQuoteStatusHistory),
      },
    });
  } catch (error) {
    return handleCommercialError(error, "Error consultando cotización:");
  }
}

// PATCH /api/quotes/[id] — Editar borrador (ADMIN o VENDEDOR responsable)
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

  const parsed = UpdateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;

  let newValidUntil: Date | undefined;
  if (data.validUntil !== undefined) {
    newValidUntil = new Date(data.validUntil);
    if (newValidUntil.getTime() <= Date.now()) {
      return errorResponse(
        "VENCIMIENTO_INVALIDO",
        "La fecha de vencimiento debe ser futura",
        400
      );
    }
  }

  try {
    const quote = await db.$transaction(
      async (tx) => {
        await lockQuoteRow(tx, id);

        const existing = await tx.quote.findUnique({
          where: { id },
          include: { items: { where: { deletedAt: null } } },
        });

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

        if (existing.status !== "DRAFT") {
          throw new CommercialError(
            "COTIZACION_NO_EDITABLE",
            "Solo las cotizaciones en borrador pueden editarse",
            409
          );
        }

        if (isQuoteExpired(existing.validUntil)) {
          throw new CommercialError(
            "COTIZACION_VENCIDA",
            "La cotización está vencida; no se permite editarla sin una operación autorizada",
            409
          );
        }

        let totals:
          | {
              subtotalCents: bigint;
              taxCents: bigint;
              totalCents: bigint;
            }
          | undefined;
        let resolvedItems:
          | Awaited<ReturnType<typeof resolveCommercialItems>>["items"]
          | undefined;

        if (data.items !== undefined) {
          const resolved = await resolveCommercialItems(tx, data.items, {
            allowManualPrice: true,
          });
          resolvedItems = resolved.items;
          totals = {
            subtotalCents: resolved.subtotalCents,
            taxCents: resolved.taxCents,
            totalCents: resolved.totalCents,
          };
        }

        const updateData: Prisma.QuoteUpdateInput = {};

        if (newValidUntil !== undefined) {
          updateData.validUntil = newValidUntil;
        }

        if (data.notes !== undefined) {
          updateData.notes =
            data.notes === null ? null : normalizeText(data.notes);
        }

        if (totals) {
          updateData.subtotalCents = totals.subtotalCents;
          updateData.taxCents = totals.taxCents;
          updateData.totalCents = totals.totalCents;
        }

        await tx.quote.update({ where: { id }, data: updateData });

        if (resolvedItems) {
          // Reemplazo de líneas en borrador: se conserva la historia de las
          // líneas anteriores con deletedAt y se crean líneas nuevas.
          await tx.quoteItem.updateMany({
            where: { quoteId: id, deletedAt: null },
            data: { deletedAt: new Date() },
          });

          await tx.quoteItem.createMany({
            data: resolvedItems.map((item) => ({
              quoteId: id,
              productId: item.productId,
              priceId: item.priceId,
              productName: item.productName,
              productSku: item.productSku,
              productSlug: item.productSlug,
              currency: item.currency,
              pricingSource: item.pricingSource,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              subtotalCents: item.subtotalCents,
            })),
          });
        }

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "QUOTE_UPDATE",
            entityType: "Quote",
            entityId: id,
            details: jsonSafe({
              updatedBy: auth.session.userId,
              fields: Object.keys(data),
              replacedItems: data.items !== undefined,
              totals,
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
    return handleCommercialError(error, "Error actualizando cotización:");
  }
}
