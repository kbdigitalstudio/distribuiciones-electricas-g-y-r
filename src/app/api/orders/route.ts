"use node";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getAuthenticatedUser } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  canManageCommercial,
  orderScopeWhere,
} from "@/lib/commercial-access";
import {
  CommercialError,
  buildPagination,
  generateCommercialNumber,
  isPrismaUniqueError,
  jsonSafe,
  resolveIdempotencyKey,
} from "@/lib/commercial";
import {
  errorResponse,
  forbiddenResponse,
  handleCommercialError,
  requireCsrf,
  validationErrorResponse,
} from "@/lib/commercial-http";
import {
  orderDetailInclude,
  orderListInclude,
} from "@/lib/commercial-includes";
import {
  assertStockAvailable,
  resolveCommercialItems,
} from "@/lib/commercial-items";
import { lockCustomerRow } from "@/lib/commercial-locks";
import { serializeOrder } from "@/lib/commercial-serializers";
import {
  CreateOrderSchema,
  OrderListQuerySchema,
} from "@/lib/validations";

interface RequestedItem {
  productId: string;
  quantity: number;
}

function sameRequestedItems(
  existing: Array<{ productId: string; quantity: number }>,
  requested: RequestedItem[]
): boolean {
  if (existing.length !== requested.length) return false;

  const existingByProduct = new Map(
    existing.map((item) => [item.productId, item.quantity])
  );

  if (existingByProduct.size !== existing.length) return false;

  return requested.every(
    (item) => existingByProduct.get(item.productId) === item.quantity
  );
}

// GET /api/orders — Listar pedidos autorizados
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedUser(request);
  if ("error" in auth) {
    return errorResponse(auth.code!, auth.error, auth.status);
  }

  const scope = orderScopeWhere(auth.session.userId, auth.roles);
  if (!scope) {
    return forbiddenResponse("Acceso denegado: rol comercial no autorizado");
  }

  const query = OrderListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );

  if (!query.success) {
    return validationErrorResponse(query.error);
  }

  try {
    const { page, pageSize, search, status, customerId, quoteId, from, to } =
      query.data;

    const filters: Prisma.OrderWhereInput[] = [scope];

    if (status) filters.push({ status });
    if (customerId) filters.push({ customerId });
    if (quoteId) filters.push({ quoteId });
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
          { orderNumber: { contains: search, mode: "insensitive" } },
          {
            customer: {
              OR: [
                { razonSocial: { contains: search, mode: "insensitive" } },
                { primerNombre: { contains: search, mode: "insensitive" } },
                { primerApellido: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          {
            quote: {
              quoteNumber: { contains: search, mode: "insensitive" },
            },
          },
        ],
      });
    }

    const where: Prisma.OrderWhereInput = { AND: filters };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: orderListInclude,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      orders: orders.map(serializeOrder),
      pagination: buildPagination(page, pageSize, total),
    });
  } catch (error) {
    return handleCommercialError(error, "Error listando pedidos:");
  }
}

// POST /api/orders — Crear pedido directo (VENDEDOR/ADMIN)
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

  const parsed = CreateOrderSchema.safeParse(body);
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
        await lockCustomerRow(tx, data.customerId);

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

        const existing = await tx.order.findUnique({
          where: { idempotencyKey },
          include: orderDetailInclude,
        });

        if (existing) {
          if (
            existing.userId !== auth.session.userId ||
            existing.customerId !== data.customerId ||
            !sameRequestedItems(existing.items, data.items)
          ) {
            throw new CommercialError(
              "IDEMPOTENCY_KEY_REUTILIZADA",
              "La clave de idempotencia ya fue usada con datos distintos",
              409
            );
          }

          return { order: existing, created: false };
        }

        // Un pedido directo solo usa precios de catálogo. Si un producto no
        // tiene precio confirmado, debe cotizarse manualmente primero.
        const resolved = await resolveCommercialItems(tx, data.items, {
          allowManualPrice: false,
        });

        await assertStockAvailable(tx, data.items);

        const orderNumber = generateCommercialNumber("PED");

        const created = await tx.order.create({
          data: {
            customerId: data.customerId,
            userId: auth.session.userId,
            orderNumber,
            idempotencyKey,
            status: "PENDING_PAYMENT",
            subtotalCents: resolved.subtotalCents,
            taxCents: resolved.taxCents,
            totalCents: resolved.totalCents,
            notes: data.notes ?? null,
          },
        });

        await tx.orderItem.createMany({
          data: resolved.items.map((item) => ({
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
            reason: "Creación del pedido",
          },
        });

        await tx.operationLog.create({
          data: {
            userId: auth.session.userId,
            action: "ORDER_CREATE",
            entityType: "Order",
            entityId: created.id,
            details: jsonSafe({
              orderNumber,
              customerId: data.customerId,
              idempotencyKey,
              itemCount: resolved.items.length,
              subtotalCents: resolved.subtotalCents,
              taxCents: resolved.taxCents,
              totalCents: resolved.totalCents,
              createdBy: auth.session.userId,
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
        order: serializeOrder(result.order),
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
        existing.userId === auth.session.userId &&
        existing.customerId === data.customerId &&
        sameRequestedItems(existing.items, data.items)
      ) {
        return NextResponse.json({
          success: true,
          created: false,
          order: serializeOrder(existing),
        });
      }

      if (existing) {
        return errorResponse(
          "IDEMPOTENCY_KEY_REUTILIZADA",
          "La clave de idempotencia ya fue usada con datos distintos",
          409
        );
      }

      return errorResponse(
        "REGISTRO_DUPLICADO",
        "La creación del pedido entra en conflicto con un registro existente",
        409
      );
    }

    return handleCommercialError(error, "Error creando pedido:");
  }
}
