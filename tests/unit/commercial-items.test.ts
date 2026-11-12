import { describe, expect, it } from "vitest";

import { CommercialError } from "@/lib/commercial";
import {
  assertStockAvailable,
  resolveCommercialItems,
  type CommercialDbClient,
} from "@/lib/commercial-items";

interface FakeProduct {
  id: string;
  name: string;
  sku: string | null;
  slug: string;
  isActive: boolean;
  deletedAt: Date | null;
}

interface FakePrice {
  id: string;
  productId: string;
  priceCents: bigint;
  currency: string;
  isActive: boolean;
  validFrom: Date;
  validTo: Date | null;
}

interface FakeInventory {
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
}

function product(overrides: Partial<FakeProduct> = {}): FakeProduct {
  return {
    id: "product-1",
    name: "Producto de prueba",
    sku: "SKU-1",
    slug: "producto-prueba",
    isActive: true,
    deletedAt: null,
    ...overrides,
  };
}

function price(overrides: Partial<FakePrice> = {}): FakePrice {
  return {
    id: "price-1",
    productId: "product-1",
    priceCents: BigInt(12345),
    currency: "COP",
    isActive: true,
    validFrom: new Date("2020-01-01T00:00:00.000Z"),
    validTo: null,
    ...overrides,
  };
}

function makeClient(
  products: FakeProduct[],
  prices: FakePrice[],
  inventories: FakeInventory[] = []
): CommercialDbClient {
  const now = Date.now();

  return {
    product: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        products.filter(
          (item) =>
            where.id.in.includes(item.id) &&
            item.isActive &&
            item.deletedAt === null
        ),
    },
    price: {
      findMany: async ({
        where,
      }: {
        where: { productId: { in: string[] } };
      }) =>
        prices
          .filter(
            (item) =>
              where.productId.in.includes(item.productId) &&
              item.isActive &&
              item.validFrom.getTime() <= now &&
              (item.validTo === null || item.validTo.getTime() >= now)
          )
          .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime()),
    },
    inventory: {
      findMany: async ({
        where,
      }: {
        where: { productId: { in: string[] } };
      }) =>
        inventories.filter((item) => where.productId.in.includes(item.productId)),
    },
  } as unknown as CommercialDbClient;
}

function expectCode(fn: () => Promise<unknown>, code: string): Promise<void> {
  return expect(fn()).rejects.toMatchObject({ name: "CommercialError", code });
}

describe("resolución de líneas comerciales", () => {
  it("usa precio de catálogo vigente y calcula subtotales", async () => {
    const client = makeClient([product()], [price()]);

    const resolved = await resolveCommercialItems(
      client,
      [{ productId: "product-1", quantity: 2 }],
      { allowManualPrice: true }
    );

    expect(resolved.items).toHaveLength(1);
    expect(resolved.items[0]).toMatchObject({
      priceId: "price-1",
      pricingSource: "CATALOG",
      currency: "COP",
      productName: "Producto de prueba",
      productSku: "SKU-1",
      quantity: 2,
      unitPriceCents: BigInt(12345),
      subtotalCents: BigInt(24690),
    });
    expect(resolved.subtotalCents).toBe(BigInt(24690));
    expect(resolved.taxCents).toBe(BigInt(0));
    expect(resolved.totalCents).toBe(BigInt(24690));
  });

  it("permite precio manual solo si no hay precio de catálogo", async () => {
    const client = makeClient([product()], []);

    const resolved = await resolveCommercialItems(
      client,
      [
        {
          productId: "product-1",
          quantity: 2,
          unitPriceCents: BigInt(9999),
        },
      ],
      { allowManualPrice: true }
    );

    expect(resolved.items[0]).toMatchObject({
      priceId: null,
      pricingSource: "MANUAL",
      currency: "COP",
      unitPriceCents: BigInt(9999),
      subtotalCents: BigInt(19998),
    });
  });

  it("rechaza precio manual si ya existe precio de catálogo", async () => {
    const client = makeClient([product()], [price()]);

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [
            {
              productId: "product-1",
              quantity: 1,
              unitPriceCents: BigInt(1),
            },
          ],
          { allowManualPrice: true }
        ),
      "PRECIO_MANUAL_NO_PERMITIDO"
    );
  });

  it("rechaza producto sin precio confirmado", async () => {
    const client = makeClient([product()], []);

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [{ productId: "product-1", quantity: 1 }],
          { allowManualPrice: true }
        ),
      "PRECIO_NO_CONFIRMADO"
    );

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [{ productId: "product-1", quantity: 1 }],
          { allowManualPrice: false }
        ),
      "PRECIO_NO_CONFIRMADO"
    );
  });

  it("rechaza productos duplicados, inexistentes o inactivos", async () => {
    const client = makeClient(
      [product(), product({ id: "product-2", isActive: false })],
      [price(), price({ id: "price-2", productId: "product-2" })]
    );

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [
            { productId: "product-1", quantity: 1 },
            { productId: "product-1", quantity: 1 },
          ],
          { allowManualPrice: false }
        ),
      "PRODUCTO_DUPLICADO"
    );

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [{ productId: "product-inexistente", quantity: 1 }],
          { allowManualPrice: false }
        ),
      "PRODUCTO_NO_DISPONIBLE"
    );

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [{ productId: "product-2", quantity: 1 }],
          { allowManualPrice: false }
        ),
      "PRODUCTO_NO_DISPONIBLE"
    );
  });

  it("rechaza cantidades inválidas y precios fuera de rango", async () => {
    const client = makeClient([product()], []);

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [
            {
              productId: "product-1",
              quantity: 0,
              unitPriceCents: BigInt(100),
            },
          ],
          { allowManualPrice: true }
        ),
      "CANTIDAD_INVALIDA"
    );

    await expectCode(
      () =>
        resolveCommercialItems(
          client,
          [
            {
              productId: "product-1",
              quantity: 1,
              unitPriceCents: BigInt("1000000000000001"),
            },
          ],
          { allowManualPrice: true }
        ),
      "IMPORTE_FUERA_DE_RANGO"
    );
  });
});

describe("validación de disponibilidad de solo lectura", () => {
  it("acepta disponibilidad suficiente", async () => {
    const client = makeClient([product()], [], [
      { productId: "product-1", quantityOnHand: 5, quantityReserved: 2 },
    ]);

    await expect(
      assertStockAvailable(client, [
        { productId: "product-1", quantity: 3 },
      ])
    ).resolves.toBeUndefined();
  });

  it("rechaza stock insuficiente", async () => {
    const client = makeClient([product()], [], [
      { productId: "product-1", quantityOnHand: 5, quantityReserved: 2 },
    ]);

    await expectCode(
      () =>
        assertStockAvailable(client, [
          { productId: "product-1", quantity: 4 },
        ]),
      "STOCK_INSUFICIENTE"
    );
  });

  it("rechaza producto sin inventario configurado", async () => {
    const client = makeClient([product()], []);

    await expectCode(
      () =>
        assertStockAvailable(client, [
          { productId: "product-1", quantity: 1 },
        ]),
      "INVENTARIO_NO_CONFIGURADO"
    );
  });
});

describe("CommercialError", () => {
  it("conserva código y estado HTTP", () => {
    const error = new CommercialError("CODIGO", "Mensaje", 409);
    expect(error.code).toBe("CODIGO");
    expect(error.status).toBe(409);
    expect(error).toBeInstanceOf(Error);
  });
});
