"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { canManageQuote } from "@/lib/commercial-access";
import {
  CommercialError,
  generateCommercialNumber,
  isPrismaUniqueError,
  isQuoteExpired,
  isUuid,
  jsonSafe,
  resolveIdempotencyKey,
} from "@/lib/commercial";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  notFoundResponse,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import {
  orderDetailInclude,
  quoteListInclude,
} from "@/lib/commercial-includes";
import { assertStockAvailable } from "@/lib/commercial-items";
import { lockQuoteRow } from "@/lib/commercial-locks";
import {
  serializeOrder,
  serializeOrderStatusHistory,
} from "@/lib/commercial-serializers";
import { ConvertQuoteSchema } from "@/lib/validations";

function serializedOrder(order: {
  statusHistory?: Parameters<typeof serializeOrderStatusHistory>[0][];
} & Parameters<typeof serializeOrder>[0]) {
  return {
    ...serializeOrder(order),
    statusHistory: (order.statusHistory ?? []).map(
      serializeOrderStatusHistory
    ),
  };
}

// POST /api/quotes/[id]/convert — Conversión atómica cotización → pedido
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

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse("JSON_INVALIDO", "El cuerpo debe ser JSON válido", 400);
    }
  }

  const parsed = ConvertQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;

  let idempotencyKey: string;
  try {
    idempotencyKey = resolveIdempotencyKey(request, data.idempotencyKey);
  } catch (error) {
    return handleCommercialError(error, "Error validando idempotencia:");
  }

  try {
    const result = await db.$transaction(
      async (tx) => {
        await lockQuoteRow(tx, id);

        const quote = await tx.quote.findUnique({
          where: { id },
          include: quoteListInclude,
        });

        if (!quote) {
          throw new CommercialError(
            "COTIZACION_NO_ENCONTRADA",
            "Cotización no encontrada",
            404
          );
        }

        if (!canManageQuote(quote, auth.session.userId, auth.roles)) {
          throw new CommercialError(
            "FORBIDDEN",
            "No puede convertir esta cotización",
            403
          );
        }

        // Idempotencia: una repetición de la misma conversión devuelve el
        // pedido ya creado, aunque la cotización haya cambiado de estado luego.
        const existingByKey = await tx.order.findUnique({
          where: { idempotencyKey },
          include: orderDetailInclude,
        });

        if (existingByKey) {
          if (
            existingByKey.quoteId !== quote.id ||
            existingByKey.userId !== auth.session.userId
          ) {
            throw new CommercialError(
              "IDEMPOTENCY_KEY_REUTILIZADA",
              "La clave de idempotencia ya fue usada para otra operación",
              409
            );
          }
          return { order: existingByKey, created: false };
        }

        const existingByQuote = await tx.order.findUnique({
          where: { quoteId: quote.id },
          include: orderDetailInclude,
        });

        if (existingByQuote) {
          throw new CommercialError(
            "COTIZACION_YA_CONVERTIDA",
            "La cotización ya originó un pedido",
            409
          );
        }

        if (quote.status !== "SENT" && quote.status !== "ACCEPTED") {
          throw new CommercialError(
            "COTIZACION_NO_CONVERTIBLE",
            "Solo una cotización enviada o aceptada puede convertirse en pedido",
            409
          );
        }

        if (
          quote.status === "SENT" &&
          isQuoteExpired(quote.validUntil)
        ) {
          throw new CommercialError(
            "COTIZACION_VENCIDA",
            "La cotización está vencida y no puede convertirse",
            409
          );
        }

        const items = quote.items;

        if (items.length === 0) {
          throw new CommercialError(
            "SIN_LINEAS",
            "La cotización no tiene líneas activas para convertir",
            409
          );
        }

        let subtotal = BigInt(0);
        const quantityByProduct = new Map<string, number>();

        for (const item of items) {
          if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
            throw new CommercialError(
              "CANTIDAD_INVALIDA",
              "La cotización contiene una cantidad inválida",
              409
            );
          }

          if (item.unitPriceCents < BigInt(0)) {
            throw new CommercialError(
              "PRECIO_INVALIDO",
              "La cotización contiene un precio inválido",
              409
            );
          }

          const expectedSubtotal =
            item.unitPriceCents * BigInt(item.quantity);

          if (expectedSubtotal !== item.subtotalCents) {
            throw new CommercialError(
              "TOTALES_INCONSISTENTES",
              "El subtotal de una línea no coincide con precio y cantidad",
              409
            );
          }

          subtotal += item.subtotalCents;
          quantityByProduct.set(
            item.productId,
            (quantityByProduct.get(item.productId) ?? 0) + item.quantity
          );
        }

        if (subtotal !== quote.subtotalCents) {
          throw new CommercialError(
            "TOTALES_INCONSISTENTES",
            "El subtotal de la cotización no coincide con sus líneas",
            409
          );
        }

        if (quote.totalCents !== quote.subtotalCents + quote.taxCents) {
          throw new CommercialError(
            "TOTALES_INCONSISTENTES",
            "El total de la cotización no coincide con subtotal e impuestos",
            409
          );
        }

        const productIds = [...quantityByProduct.keys()];

        const availableProducts = await tx.product.findMany({
          where: {
            id: { in: productIds },
            deletedAt: null,
            isActive: true,
          },
          select: { id: true },
        });

        if (availableProducts.length !== productIds.length) {
          throw new CommercialError(
            "PRODUCTO_NO_DISPONIBLE",
            "Uno o más productos de la cotización no están disponibles",
            409
          );
        }

        // Validación de disponibilidad de solo lectura. No reserva ni
        // descuenta inventario; la política de reservas no está aprobada.
        await assertStockAvailable(
          tx,
          [...quantityByProduct.entries()].map(([productId, quantity]) => ({
            productId,
            quantity,
          }))
        );

        const orderNumber = generateCommercialNumber("PED");

        const created = await tx.order.create({
          data: {
            customerId: quote.customerId,
            userId: auth.session.userId,
            orderNumber,
            quoteId: quote.id,
            idempotencyKey,
            status: "PENDING_PAYMENT",
            subtotalCents: quote.subtotalCents,
            taxCents: quote.taxCents,
            totalCents: quote.totalCents,
            notes: data.notes ?? quote.notes,
          },
        });

        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: created.id,
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

        await tx.orderStatusHistory.create({
          data: {
            orderId: created.id,
            fromStatus: null,
            toStatus: "PENDING_PAYMENT",
            changedBy: auth.session.userId,
            reason: `Conversión de la cotización ${quote.quoteNumber}`,
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "QUOTE_CONVERT_TO_ORDER",
            entityType: "Order",
            entityId: created.id,
            details: jsonSafe({
              quoteId: quote.id,
              quoteNumber: quote.quoteNumber,
              orderNumber,
              idempotencyKey,
              itemCount: items.length,
              subtotalCents: quote.subtotalCents,
              taxCents: quote.taxCents,
              totalCents: quote.totalCents,
              convertedBy: auth.session.userId,
            }) as Prisma.InputJsonValue,
          },
        });

        const order = await tx.order.findUniqueOrThrow({
          where: { id: created.id },
          include: orderDetailInclude,
        });

        return { order, created: true };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
        maxWait: 10000,
      }
    );

    return NextResponse.json(
      {
        success: true,
        created: result.created,
        order: serializedOrder(result.order),
      },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof CommercialError && error.status === 403) {
      return forbiddenResponse(error.message);
    }

    if (isPrismaUniqueError(error)) {
      const existing = await db.order.findUnique({
        where: { idempotencyKey },
        include: orderDetailInclude,
      });

      if (
        existing &&
        existing.quoteId === id &&
        existing.userId === auth.session.userId
      ) {
        return NextResponse.json({
          success: true,
          created: false,
          order: serializedOrder(existing),
        });
      }

      if (existing) {
        return errorResponse(
          "IDEMPOTENCY_KEY_REUTILIZADA",
          "La clave de idempotencia ya fue usada para otra operación",
          409
        );
      }

      const converted = await db.order.findUnique({
        where: { quoteId: id },
        include: orderDetailInclude,
      });

      if (converted) {
        return errorResponse(
          "COTIZACION_YA_CONVERTIDA",
          "La cotización ya originó un pedido",
          409
        );
      }

      return errorResponse(
        "REGISTRO_DUPLICADO",
        "La conversión entra en conflicto con un registro existente",
        409
      );
    }

    return handleCommercialError(error, "Error convirtiendo cotización:");
  }
}
