"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageCommercial,
  quoteScopeWhere,
} from "@/lib/commercial-access";
import {
  CommercialError,
  buildPagination,
  generateCommercialNumber,
  jsonSafe,
} from "@/lib/commercial";
import { quoteListInclude } from "@/lib/commercial-includes";
import { resolveCommercialItems } from "@/lib/commercial-items";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import { serializeQuote } from "@/lib/commercial-serializers";
import {
  CreateQuoteSchema,
  QuoteListQuerySchema,
} from "@/lib/validations";

// GET /api/quotes — Listar cotizaciones autorizadas
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const scope = quoteScopeWhere(auth.session.userId, auth.roles);
  if (!scope) {
    return forbiddenResponse("Acceso denegado: rol comercial no autorizado");
  }

  const query = QuoteListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );

  if (!query.success) {
    return validationErrorResponse(query.error);
  }

  try {
    const { page, pageSize, status, customerId, from, to, search } = query.data;

    const filters: Prisma.QuoteWhereInput[] = [scope];

    if (status) filters.push({ status });
    if (customerId) filters.push({ customerId });
    if (from || to) {
      filters.push({
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      });
    }

    if (search) {
      filters.push({
        OR: [
          { quoteNumber: { contains: search, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { razonSocial: { contains: search, mode: "insensitive" } },
                { primerNombre: { contains: search, mode: "insensitive" } },
                { primerApellido: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      });
    }

    const where: Prisma.QuoteWhereInput = { AND: filters };

    const [quotes, total] = await Promise.all([
      db.quote.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: quoteListInclude,
      }),
      db.quote.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      quotes: quotes.map((quote) => serializeQuote(quote)),
      pagination: buildPagination(page, pageSize, total),
    });
  } catch (error) {
    return handleCommercialError(error, "Error listando cotizaciones:");
  }
}

// POST /api/quotes — Crear cotización en borrador (VENDEDOR/ADMIN)
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  if (!canManageCommercial(auth.roles)) {
    return forbiddenResponse(
      "Acceso denegado: se requiere rol VENDEDOR o ADMIN"
    );
  }

  const csrfError = await requireCsrf(request);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
  }

  const parsed = CreateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;
  const validUntil = new Date(data.validUntil);

  if (validUntil.getTime() <= Date.now()) {
    return errorResponse(
      "VENCIMIENTO_INVALIDO",
      "La fecha de vencimiento debe ser futura",
      400
    );
  }

  try {
    const quote = await db.$transaction(
      async (tx) => {
        const customer = await tx.customer.findFirst({
          where: {
            id: data.customerId,
            deletedAt: null,
            isActive: true,
          },
        });

        if (!customer) {
          throw new CommercialError(
            "CLIENTE_NO_DISPONIBLE",
            "El cliente no existe, está inactivo o fue eliminado"
          );
        }

        const resolved = await resolveCommercialItems(tx, data.items, {
          allowManualPrice: true,
        });

        const quoteNumber = generateCommercialNumber("COT");

        const created = await tx.quote.create({
          data: {
            customerId: data.customerId,
            userId: auth.session.userId,
            quoteNumber,
            status: "DRAFT",
            subtotalCents: resolved.subtotalCents,
            taxCents: resolved.taxCents,
            totalCents: resolved.totalCents,
            validUntil,
            notes: data.notes ?? null,
          },
        });

        await tx.quoteItem.createMany({
          data: resolved.items.map((item) => ({
            quoteId: created.id,
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

        await tx.quoteStatusHistory.create({
          data: {
            quoteId: created.id,
            fromStatus: null,
            toStatus: "DRAFT",
            changedBy: auth.session.userId,
            reason: "Creación de la cotización",
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "QUOTE_CREATE",
            entityType: "Quote",
            entityId: created.id,
            details: jsonSafe({
              quoteNumber,
              customerId: data.customerId,
              itemCount: resolved.items.length,
              subtotalCents: resolved.subtotalCents,
              taxCents: resolved.taxCents,
              totalCents: resolved.totalCents,
              createdBy: auth.session.userId,
            }) as Prisma.InputJsonValue,
          },
        });

        return tx.quote.findUniqueOrThrow({
          where: { id: created.id },
          include: quoteListInclude,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
        maxWait: 10000,
      }
    );

    return NextResponse.json(
      { success: true, quote: serializeQuote(quote) },
      { status: 201 }
    );
  } catch (error) {
    return handleCommercialError(error, "Error creando cotización:");
  }
}
