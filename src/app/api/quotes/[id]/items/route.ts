"use node";

import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { canReadQuote } from "@/lib/commercial-access";
import { isUuid } from "@/lib/commercial";
import {
  errorResponse,
  handleCommercialError,
  notFoundResponse,
} from "@/lib/commercial-http";
import { commercialCustomerSelect } from "@/lib/commercial-includes";
import { serializeQuoteItem } from "@/lib/commercial-serializers";

// GET /api/quotes/[id]/items — Líneas de la cotización
// Query: includeDeleted=true devuelve también las líneas reemplazadas.
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
      include: { customer: { select: commercialCustomerSelect } },
    });

    if (!quote || !canReadQuote(quote, auth.session.userId, auth.roles)) {
      return notFoundResponse(
        "COTIZACION_NO_ENCONTRADA",
        "Cotización no encontrada"
      );
    }

    const includeDeleted =
      new URL(request.url).searchParams.get("includeDeleted") === "true";

    const items = await db.quoteItem.findMany({
      where: {
        quoteId: id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      quoteId: id,
      items: items.map(serializeQuoteItem),
    });
  } catch (error) {
    return handleCommercialError(error, "Error listando líneas de cotización:");
  }
}
