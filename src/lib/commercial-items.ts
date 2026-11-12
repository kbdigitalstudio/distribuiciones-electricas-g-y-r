import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  CommercialError,
  MAX_MONEY_CENTS,
  calculateLineSubtotal,
  calculateTotals,
} from "@/lib/commercial";

export type CommercialDbClient = Prisma.TransactionClient | typeof db;

export interface RequestedCommercialItem {
  productId: string;
  quantity: number;
  unitPriceCents?: bigint;
}

export interface ResolvedCommercialItem {
  productId: string;
  priceId: string | null;
  productName: string;
  productSku: string | null;
  productSlug: string;
  currency: string;
  pricingSource: "CATALOG" | "MANUAL";
  quantity: number;
  unitPriceCents: bigint;
  subtotalCents: bigint;
}

export interface ResolvedCommercialItems {
  items: ResolvedCommercialItem[];
  subtotalCents: bigint;
  taxCents: bigint;
  totalCents: bigint;
}

interface ResolveOptions {
  /**
   * Las cotizaciones permiten precio manual explícito cuando el producto no
   * tiene precio vigente. Los pedidos directos no lo permiten: solo usan
   * precio de catálogo. La conversión reutiliza los snapshots de la cotización.
   */
  allowManualPrice: boolean;
}

/**
 * Valida productos activos, precios vigentes y cantidades, y calcula los
 * importes en centavos. No modifica inventario ni crea registros.
 */
export async function resolveCommercialItems(
  client: CommercialDbClient,
  requested: RequestedCommercialItem[],
  options: ResolveOptions
): Promise<ResolvedCommercialItems> {
  if (requested.length === 0) {
    throw new CommercialError(
      "SIN_LINEAS",
      "La operación debe incluir al menos una línea"
    );
  }

  const seen = new Set<string>();
  for (const item of requested) {
    if (seen.has(item.productId)) {
      throw new CommercialError(
        "PRODUCTO_DUPLICADO",
        "Un producto no puede repetirse en la misma operación"
      );
    }
    seen.add(item.productId);
  }

  const productIds = requested.map((item) => item.productId);

  const products = await client.product.findMany({
    where: {
      id: { in: productIds },
      deletedAt: null,
      isActive: true,
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  for (const item of requested) {
    if (!productById.has(item.productId)) {
      throw new CommercialError(
        "PRODUCTO_NO_DISPONIBLE",
        "El producto no existe, está inactivo o fue eliminado",
        400
      );
    }
  }

  const now = new Date();
  const prices = await client.price.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: { validFrom: "desc" },
  });

  const priceByProductId = new Map<string, (typeof prices)[number]>();
  for (const price of prices) {
    if (!priceByProductId.has(price.productId)) {
      priceByProductId.set(price.productId, price);
    }
  }

  const items: ResolvedCommercialItem[] = requested.map((item) => {
    const product = productById.get(item.productId)!;
    const activePrice = priceByProductId.get(item.productId);

    let priceId: string | null = null;
    let pricingSource: "CATALOG" | "MANUAL";
    let unitPriceCents: bigint;
    let currency: string;

    if (activePrice) {
      if (item.unitPriceCents !== undefined) {
        throw new CommercialError(
          "PRECIO_MANUAL_NO_PERMITIDO",
          "El producto tiene precio de catálogo vigente; no se acepta un precio manual"
        );
      }

      priceId = activePrice.id;
      pricingSource = "CATALOG";
      unitPriceCents = activePrice.priceCents;
      currency = activePrice.currency;
    } else {
      if (!options.allowManualPrice || item.unitPriceCents === undefined) {
        throw new CommercialError(
          "PRECIO_NO_CONFIRMADO",
          "El producto no tiene precio confirmado y requiere cotización manual autorizada"
        );
      }

      if (item.unitPriceCents > MAX_MONEY_CENTS) {
        throw new CommercialError(
          "IMPORTE_FUERA_DE_RANGO",
          "El precio manual excede el rango permitido"
        );
      }

      pricingSource = "MANUAL";
      unitPriceCents = item.unitPriceCents;
      currency = "COP";
    }

    const subtotalCents = calculateLineSubtotal(
      unitPriceCents,
      item.quantity
    );

    return {
      productId: product.id,
      priceId,
      productName: product.name,
      productSku: product.sku,
      productSlug: product.slug,
      currency,
      pricingSource,
      quantity: item.quantity,
      unitPriceCents,
      subtotalCents,
    };
  });

  const totals = calculateTotals(items);

  return {
    items,
    ...totals,
  };
}

/**
 * Validación de disponibilidad de solo lectura antes de crear un pedido.
 *
 * No reserva ni descuenta existencias. La política de reservas automáticas no
 * está aprobada; por eso dos pedidos concurrentes podrían pasar esta
 * validación. Se documenta como limitación y se probará la validación simple.
 */
export async function assertStockAvailable(
  client: CommercialDbClient,
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  const productIds = [...new Set(items.map((item) => item.productId))];

  const inventories = await client.inventory.findMany({
    where: { productId: { in: productIds } },
  });

  const inventoryByProductId = new Map(
    inventories.map((inventory) => [inventory.productId, inventory])
  );

  for (const item of items) {
    const inventory = inventoryByProductId.get(item.productId);

    if (!inventory) {
      throw new CommercialError(
        "INVENTARIO_NO_CONFIGURADO",
        "El producto no tiene inventario configurado; no se puede validar disponibilidad"
      );
    }

    const available = inventory.quantityOnHand - inventory.quantityReserved;

    if (available < item.quantity) {
      throw new CommercialError(
        "STOCK_INSUFICIENTE",
        "No hay disponibilidad suficiente para la cantidad solicitada"
      );
    }
  }
}
