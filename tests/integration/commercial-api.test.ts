import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
  validateCsrfToken: vi.fn(async () => true),
}));

import { getSession, validateCsrfToken } from "@/lib/session";
import { db } from "@/lib/db";

import { GET as listCustomers, POST as createCustomer } from "@/app/api/customers/route";
import {
  DELETE as deleteCustomer,
  GET as getCustomer,
  PATCH as updateCustomer,
} from "@/app/api/customers/[id]/route";
import { GET as listQuotes, POST as createQuote } from "@/app/api/quotes/route";
import {
  GET as getQuote,
  PATCH as updateQuote,
} from "@/app/api/quotes/[id]/route";
import { POST as changeQuoteStatus } from "@/app/api/quotes/[id]/status/route";
import { GET as getQuoteItems } from "@/app/api/quotes/[id]/items/route";
import { POST as convertQuote } from "@/app/api/quotes/[id]/convert/route";
import { GET as listOrders, POST as createOrder } from "@/app/api/orders/route";
import {
  GET as getOrder,
  PATCH as updateOrder,
} from "@/app/api/orders/[id]/route";
import { POST as changeOrderStatus } from "@/app/api/orders/[id]/status/route";
import { GET as getOrderItems } from "@/app/api/orders/[id]/items/route";

interface TestUser {
  id: string;
  email: string;
}

interface JsonBody {
  success?: boolean;
  code?: string;
  created?: boolean;
  customer?: Record<string, unknown>;
  customers?: Array<Record<string, unknown>>;
  quote?: Record<string, unknown>;
  quotes?: Array<Record<string, unknown>>;
  order?: Record<string, unknown>;
  orders?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  pagination?: Record<string, unknown>;
  [key: string]: unknown;
}

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasTestDatabase ? describe : describe.skip;

const createdUserIds: string[] = [];

let adminUser: TestUser;
let vendedor1User: TestUser;
let vendedor2User: TestUser;
let clienteUser: TestUser;
let inventarioUser: TestUser;

let categoryId = "";
let productCatalogId = "";
let productSecondId = "";
let productNoPriceId = "";
let productInactiveId = "";

let customerAId = "";
let customerBId = "";
let customerClienteId = "";

const CATALOG_PRICE = BigInt(12345);
const SECOND_PRICE = BigInt(5000);

function setSession(user: TestUser | null, role = "VENDEDOR"): void {
  if (!user) {
    vi.mocked(getSession).mockResolvedValue(null);
    return;
  }

  vi.mocked(getSession).mockResolvedValue({
    userId: user.id,
    email: user.email,
    role,
    csrf: "test-csrf",
  });
}

function futureIso(days = 7): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-csrf-token": "test-csrf",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function responseJson(response: Response): Promise<JsonBody> {
  return response.json();
}

async function createTestUser(
  prefix: string,
  roleId: string,
  suffix: string
): Promise<TestUser> {
  const user = await db.user.create({
    data: {
      email: `${prefix}-${suffix}@gyr.test`,
      passwordHash: "test-only",
      nombre: `Test ${prefix}`,
      telefono: "0000000",
      direccion: "Test",
      ciudad: "Test",
      departamento: "Test",
      roles: { create: { role: { connect: { id: roleId } } } },
    },
  });

  createdUserIds.push(user.id);
  return { id: user.id, email: user.email };
}

async function createCustomerViaApi(
  body: Record<string, unknown>
): Promise<{ response: Response; body: JsonBody }> {
  const response = await createCustomer(
    jsonRequest("http://localhost/api/customers", "POST", body)
  );
  return { response, body: await responseJson(response) };
}

async function createQuoteViaApi(
  customerId: string,
  items: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): Promise<{ response: Response; body: JsonBody }> {
  const response = await createQuote(
    jsonRequest("http://localhost/api/quotes", "POST", {
      customerId,
      validUntil: futureIso(),
      items,
      ...overrides,
    })
  );
  return { response, body: await responseJson(response) };
}

async function createOrderViaApi(
  customerId: string,
  items: Array<Record<string, unknown>>,
  idempotencyKey: string,
  overrides: Record<string, unknown> = {}
): Promise<{ response: Response; body: JsonBody }> {
  const response = await createOrder(
    jsonRequest(
      "http://localhost/api/orders",
      "POST",
      { customerId, items, ...overrides },
      { "idempotency-key": idempotencyKey }
    )
  );
  return { response, body: await responseJson(response) };
}

async function setQuoteStatus(
  quoteId: string,
  status: string
): Promise<{ response: Response; body: JsonBody }> {
  const response = await changeQuoteStatus(
    jsonRequest(
      `http://localhost/api/quotes/${quoteId}/status`,
      "POST",
      { status }
    ),
    { params: Promise.resolve({ id: quoteId }) }
  );
  return { response, body: await responseJson(response) };
}

async function convertQuoteViaApi(
  quoteId: string,
  idempotencyKey: string,
  body: Record<string, unknown> = {}
): Promise<{ response: Response; body: JsonBody }> {
  const response = await convertQuote(
    jsonRequest(
      `http://localhost/api/quotes/${quoteId}/convert`,
      "POST",
      body,
      { "idempotency-key": idempotencyKey }
    ),
    { params: Promise.resolve({ id: quoteId }) }
  );
  return { response, body: await responseJson(response) };
}

async function resetFixtureState(): Promise<void> {
  const userIds = createdUserIds;

  await db.orderItem.deleteMany({
    where: { order: { userId: { in: userIds } } },
  });
  await db.orderStatusHistory.deleteMany({
    where: { order: { userId: { in: userIds } } },
  });
  await db.order.deleteMany({ where: { userId: { in: userIds } } });

  await db.quoteItem.deleteMany({
    where: { quote: { userId: { in: userIds } } },
  });
  await db.quoteStatusHistory.deleteMany({
    where: { quote: { userId: { in: userIds } } },
  });
  await db.quote.deleteMany({ where: { userId: { in: userIds } } });

  await db.operationLog.deleteMany({ where: { userId: { in: userIds } } });

  await db.customer.updateMany({
    where: {
      id: { in: [customerAId, customerBId, customerClienteId] },
    },
    data: { isActive: true, deletedAt: null },
  });

  await db.product.updateMany({
    where: {
      id: {
        in: [
          productCatalogId,
          productSecondId,
          productNoPriceId,
          productInactiveId,
        ],
      },
    },
    data: { isActive: true },
  });

  await db.product.update({
    where: { id: productInactiveId },
    data: { isActive: false },
  });

  for (const productId of [
    productCatalogId,
    productSecondId,
    productNoPriceId,
    productInactiveId,
  ]) {
    await db.inventory.updateMany({
      where: { productId },
      data: { quantityOnHand: 100, quantityReserved: 0 },
    });
  }

  await db.price.updateMany({
    where: { productId: { in: [productCatalogId, productSecondId] } },
    data: { isActive: true },
  });
}

describeIntegration("integración real con PostgreSQL (comercial)", () => {
  beforeAll(async () => {
    await db.$connect();

    const suffix = randomUUID();

    const [roleAdmin, roleVendedor, roleCliente, roleInventario] =
      await Promise.all([
        db.role.upsert({
          where: { name: "ADMIN" },
          update: {},
          create: { name: "ADMIN", description: "Test role" },
        }),
        db.role.upsert({
          where: { name: "VENDEDOR" },
          update: {},
          create: { name: "VENDEDOR", description: "Test role" },
        }),
        db.role.upsert({
          where: { name: "CLIENTE" },
          update: {},
          create: { name: "CLIENTE", description: "Test role" },
        }),
        db.role.upsert({
          where: { name: "INVENTARIO" },
          update: {},
          create: { name: "INVENTARIO", description: "Test role" },
        }),
      ]);

    adminUser = await createTestUser("admin-comercial", roleAdmin.id, suffix);
    vendedor1User = await createTestUser(
      "vendedor1-comercial",
      roleVendedor.id,
      suffix
    );
    vendedor2User = await createTestUser(
      "vendedor2-comercial",
      roleVendedor.id,
      suffix
    );
    clienteUser = await createTestUser(
      "cliente-comercial",
      roleCliente.id,
      suffix
    );
    inventarioUser = await createTestUser(
      "inventario-comercial",
      roleInventario.id,
      suffix
    );

    const category = await db.category.create({
      data: {
        name: `Categoría comercial ${suffix}`,
        slug: `cat-comercial-${suffix}`,
      },
    });
    categoryId = category.id;

    const productCatalog = await db.product.create({
      data: {
        categoryId: category.id,
        name: `Cable de prueba ${suffix}`,
        slug: `cable-comercial-${suffix}`,
        sku: `CAB-${suffix}`,
      },
    });
    productCatalogId = productCatalog.id;

    const productSecond = await db.product.create({
      data: {
        categoryId: category.id,
        name: `Breaker de prueba ${suffix}`,
        slug: `breaker-comercial-${suffix}`,
        sku: `BRK-${suffix}`,
      },
    });
    productSecondId = productSecond.id;

    const productNoPrice = await db.product.create({
      data: {
        categoryId: category.id,
        name: `Producto sin precio ${suffix}`,
        slug: `sin-precio-${suffix}`,
        sku: `SP-${suffix}`,
      },
    });
    productNoPriceId = productNoPrice.id;

    const productInactive = await db.product.create({
      data: {
        categoryId: category.id,
        name: `Producto inactivo ${suffix}`,
        slug: `inactivo-${suffix}`,
        sku: `IN-${suffix}`,
        isActive: false,
      },
    });
    productInactiveId = productInactive.id;

    await Promise.all([
      db.price.create({
        data: {
          productId: productCatalog.id,
          priceCents: CATALOG_PRICE,
          currency: "COP",
        },
      }),
      db.price.create({
        data: {
          productId: productSecond.id,
          priceCents: SECOND_PRICE,
          currency: "COP",
        },
      }),
      db.price.create({
        data: {
          productId: productInactive.id,
          priceCents: CATALOG_PRICE,
          currency: "COP",
        },
      }),
    ]);

    await Promise.all([
      db.inventory.create({
        data: {
          productId: productCatalog.id,
          quantityOnHand: 100,
          quantityReserved: 0,
        },
      }),
      db.inventory.create({
        data: {
          productId: productSecond.id,
          quantityOnHand: 100,
          quantityReserved: 0,
        },
      }),
      db.inventory.create({
        data: {
          productId: productNoPrice.id,
          quantityOnHand: 100,
          quantityReserved: 0,
        },
      }),
      db.inventory.create({
        data: {
          productId: productInactive.id,
          quantityOnHand: 100,
          quantityReserved: 0,
        },
      }),
    ]);

    const customerA = await db.customer.create({
      data: {
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `A-${suffix}`,
        primerNombre: "Ana",
        primerApellido: "Uno",
        pais: "Colombia",
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        direccion: "Calle 1 # 2-3",
        telefono: "3001111111",
        email: `ana-${suffix}@gyr.test`,
        createdById: vendedor1User.id,
        updatedById: vendedor1User.id,
      },
    });
    customerAId = customerA.id;

    const customerB = await db.customer.create({
      data: {
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `B-${suffix}`,
        primerNombre: "Bruno",
        primerApellido: "Dos",
        pais: "Colombia",
        ciudad: "Medellín",
        departamento: "Antioquia",
        direccion: "Carrera 4 # 5-6",
        telefono: "3002222222",
        email: `bruno-${suffix}@gyr.test`,
        createdById: vendedor2User.id,
        updatedById: vendedor2User.id,
      },
    });
    customerBId = customerB.id;

    const customerCliente = await db.customer.create({
      data: {
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `C-${suffix}`,
        primerNombre: "Carla",
        primerApellido: "Tres",
        pais: "Colombia",
        ciudad: "Cali",
        departamento: "Valle del Cauca",
        direccion: "Avenida 7 # 8-9",
        telefono: "3003333333",
        email: `carla-${suffix}@gyr.test`,
        userId: clienteUser.id,
        createdById: adminUser.id,
        updatedById: adminUser.id,
      },
    });
    customerClienteId = customerCliente.id;
  });

  beforeEach(async () => {
    await resetFixtureState();
    vi.mocked(validateCsrfToken).mockResolvedValue(true);
    vi.mocked(getSession).mockReset();
    setSession(vendedor1User, "VENDEDOR");
  });

  afterAll(async () => {
    await resetFixtureState();

    if (createdUserIds.length > 0) {
      await db.customer.deleteMany({
        where: {
          OR: [
            { createdById: { in: createdUserIds } },
            { userId: { in: createdUserIds } },
          ],
        },
      });
      await db.price.deleteMany({
        where: {
          productId: {
            in: [
              productCatalogId,
              productSecondId,
              productNoPriceId,
              productInactiveId,
            ],
          },
        },
      });
      await db.inventory.deleteMany({
        where: {
          productId: {
            in: [
              productCatalogId,
              productSecondId,
              productNoPriceId,
              productInactiveId,
            ],
          },
        },
      });
      await db.product.deleteMany({
        where: {
          id: {
            in: [
              productCatalogId,
              productSecondId,
              productNoPriceId,
              productInactiveId,
            ],
          },
        },
      });
      await db.category.deleteMany({ where: { id: categoryId } });
      await db.userRole.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await db.$disconnect();
  });

  describe("clientes", () => {
    it("crea un cliente normalizando datos y sin exponer campos sensibles", async () => {
      const suffix = randomUUID();
      const { response, body } = await createCustomerViaApi({
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: ` 90.${suffix.slice(0, 6)}  `,
        primerNombre: "  Néstor ",
        primerApellido: "  Gómez  ",
        ciudad: "  Bogotá  ",
        departamento: "Cundinamarca",
        direccion: "  Calle   10  # 20-30 ",
        telefono: "+57 300 123 4567",
        email: "  VENTAS@GYR.TEST ",
      });

      expect(response.status).toBe(201);
      const customer = body.customer as Record<string, unknown>;
      expect(customer.documentNumber).toBe(
        `90${suffix.slice(0, 6)}`.toUpperCase()
      );
      expect(customer.primerNombre).toBe("Néstor");
      expect(customer.direccion).toBe("Calle 10 # 20-30");
      expect(customer.telefono).toBe("+573001234567");
      expect(customer.email).toBe("ventas@gyr.test");
      expect(customer.createdById).toBe(vendedor1User.id);
      expect(customer).not.toHaveProperty("passwordHash");

      const log = await db.operationLog.findFirst({
        where: { action: "CUSTOMER_CREATE", entityId: customer.id as string },
      });
      expect(log).not.toBeNull();
    });

    it("rechaza identificación duplicada aunque cambie el formato", async () => {
      const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
      const first = await createCustomerViaApi({
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `9.${suffix}`,
        primerNombre: "Duplicado",
        primerApellido: "Uno",
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        direccion: "Calle 1",
        telefono: "3001234567",
        email: `dup1-${suffix}@gyr.test`,
      });
      expect(first.response.status).toBe(201);

      const second = await createCustomerViaApi({
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `9 ${suffix}`,
        primerNombre: "Duplicado",
        primerApellido: "Dos",
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        direccion: "Calle 2",
        telefono: "3001234568",
        email: `dup2-${suffix}@gyr.test`,
      });
      expect(second.response.status).toBe(409);
      expect(second.body.code).toBe("IDENTIFICACION_DUPLICADA");
    });

    it("solo ADMIN cambia el estado de activación", async () => {
      const response = await updateCustomer(
        jsonRequest(`http://localhost/api/customers/${customerAId}`, "PATCH", {
          isActive: false,
        }),
        { params: Promise.resolve({ id: customerAId }) }
      );

      expect(response.status).toBe(403);
    });

    it("aplica alcance de listado por rol y filtros de búsqueda", async () => {
      setSession(vendedor1User, "VENDEDOR");
      let response = await listCustomers(
        new Request("http://localhost/api/customers?pageSize=100")
      );
      let body = await responseJson(response);
      expect(response.status).toBe(200);
      let ids = (body.customers ?? []).map((item) => item.id);
      expect(ids).toContain(customerAId);
      expect(ids).not.toContain(customerBId);

      const filtered = await listCustomers(
        new Request("http://localhost/api/customers?search=Ana")
      );
      expect(filtered.status).toBe(200);
      expect(
        (await responseJson(filtered)).customers?.map((item) => item.id)
      ).toContain(customerAId);

      setSession(vendedor2User, "VENDEDOR");
      response = await listCustomers(
        new Request("http://localhost/api/customers?pageSize=100")
      );
      ids = ((await responseJson(response)).customers ?? []).map(
        (item) => item.id
      );
      expect(ids).toContain(customerBId);
      expect(ids).not.toContain(customerAId);

      setSession(clienteUser, "CLIENTE");
      response = await listCustomers(
        new Request("http://localhost/api/customers?pageSize=100")
      );
      ids = ((await responseJson(response)).customers ?? []).map(
        (item) => item.id
      );
      expect(ids).toEqual([customerClienteId]);

      setSession(adminUser, "ADMIN");
      response = await listCustomers(
        new Request("http://localhost/api/customers?pageSize=100")
      );
      ids = ((await responseJson(response)).customers ?? []).map(
        (item) => item.id
      );
      expect(ids).toEqual(
        expect.arrayContaining([customerAId, customerBId, customerClienteId])
      );

      setSession(inventarioUser, "INVENTARIO");
      response = await listCustomers(new Request("http://localhost/api/customers"));
      expect(response.status).toBe(403);
    });

    it("aísla lectura y edición entre vendedores y clientes", async () => {
      setSession(vendedor2User, "VENDEDOR");
      const deniedRead = await getCustomer(
        new Request(`http://localhost/api/customers/${customerAId}`),
        { params: Promise.resolve({ id: customerAId }) }
      );
      expect(deniedRead.status).toBe(404);

      const deniedPatch = await updateCustomer(
        jsonRequest(`http://localhost/api/customers/${customerAId}`, "PATCH", {
          ciudad: "Medellín",
        }),
        { params: Promise.resolve({ id: customerAId }) }
      );
      expect(deniedPatch.status).toBe(403);

      setSession(clienteUser, "CLIENTE");
      const ownRead = await getCustomer(
        new Request(`http://localhost/api/customers/${customerClienteId}`),
        { params: Promise.resolve({ id: customerClienteId }) }
      );
      expect(ownRead.status).toBe(200);

      const foreignRead = await getCustomer(
        new Request(`http://localhost/api/customers/${customerAId}`),
        { params: Promise.resolve({ id: customerAId }) }
      );
      expect(foreignRead.status).toBe(404);

      setSession(vendedor1User, "VENDEDOR");
      const allowedPatch = await updateCustomer(
        jsonRequest(`http://localhost/api/customers/${customerAId}`, "PATCH", {
          ciudad: "  Bogotá   D.C. ",
        }),
        { params: Promise.resolve({ id: customerAId }) }
      );
      expect(allowedPatch.status).toBe(200);
      expect(
        ((await responseJson(allowedPatch)).customer as Record<string, unknown>)
          .ciudad
      ).toBe("Bogotá D.C.");
    });

    it("elimina lógicamente y rechaza operaciones posteriores", async () => {
      const suffix = randomUUID();
      const created = await createCustomerViaApi({
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `D-${suffix}`,
        primerNombre: "Borrar",
        primerApellido: "Prueba",
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        direccion: "Calle 9",
        telefono: "3009999999",
        email: `borrar-${suffix}@gyr.test`,
      });
      expect(created.response.status).toBe(201);
      const customerId = (created.body.customer as Record<string, unknown>)
        .id as string;

      const deleted = await deleteCustomer(
        jsonRequest(`http://localhost/api/customers/${customerId}`, "DELETE"),
        { params: Promise.resolve({ id: customerId }) }
      );
      expect(deleted.status).toBe(200);
      const deletedBody = await responseJson(deleted);
      expect((deletedBody.customer as Record<string, unknown>).isActive).toBe(
        false
      );
      expect(
        (deletedBody.customer as Record<string, unknown>).deletedAt
      ).not.toBeNull();

      const afterDelete = await getCustomer(
        new Request(`http://localhost/api/customers/${customerId}`),
        { params: Promise.resolve({ id: customerId }) }
      );
      expect(afterDelete.status).toBe(404);

      const secondDelete = await deleteCustomer(
        jsonRequest(`http://localhost/api/customers/${customerId}`, "DELETE"),
        { params: Promise.resolve({ id: customerId }) }
      );
      expect(secondDelete.status).toBe(409);
      expect((await responseJson(secondDelete)).code).toBe(
        "CLIENTE_YA_DESACTIVADO"
      );

      const quote = await createQuoteViaApi(customerId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      expect(quote.response.status).toBe(400);
      expect(quote.body.code).toBe("CLIENTE_NO_DISPONIBLE");
    });
  });

  describe("cotizaciones", () => {
    it("crea un borrador con snapshots y totales calculados por el servidor", async () => {
      const { response, body } = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 2 },
      ]);

      expect(response.status).toBe(201);
      const quote = body.quote as Record<string, unknown>;
      expect(quote.status).toBe("DRAFT");
      expect(quote.quoteNumber).toMatch(/^COT-\d{8}-[0-9A-F]{12}$/);
      expect(quote.subtotalCents).toBe("24690");
      expect(quote.taxCents).toBe("0");
      expect(quote.totalCents).toBe("24690");
      expect(quote.userId).toBe(vendedor1User.id);

      const items = quote.items as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0].productName).toContain("Cable de prueba");
      expect(items[0].pricingSource).toBe("CATALOG");
      expect(items[0].unitPriceCents).toBe("12345");
      expect(items[0].subtotalCents).toBe("24690");

      const detail = await getQuote(
        new Request(`http://localhost/api/quotes/${quote.id as string}`),
        { params: Promise.resolve({ id: quote.id as string }) }
      );
      expect(detail.status).toBe(200);
      const history = (await responseJson(detail)).quote as Record<
        string,
        unknown
      >;
      expect(
        (history.statusHistory as Array<Record<string, unknown>>)[0].toStatus
      ).toBe("DRAFT");
    });

    it("permite precio manual solo cuando no existe precio de catálogo", async () => {
      setSession(vendedor1User, "VENDEDOR");

      const manual = await createQuoteViaApi(customerAId, [
        {
          productId: productNoPriceId,
          quantity: 2,
          unitPriceCents: 9999,
        },
      ]);
      expect(manual.response.status).toBe(201);
      const manualItem = (
        (manual.body.quote as Record<string, unknown>).items as Array<
          Record<string, unknown>
        >
      )[0];
      expect(manualItem.pricingSource).toBe("MANUAL");
      expect(manualItem.priceId).toBeNull();
      expect(manualItem.unitPriceCents).toBe("9999");

      const missing = await createQuoteViaApi(customerAId, [
        { productId: productNoPriceId, quantity: 1 },
      ]);
      expect(missing.response.status).toBe(400);
      expect(missing.body.code).toBe("PRECIO_NO_CONFIRMADO");

      const forbidden = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1, unitPriceCents: 1 },
      ]);
      expect(forbidden.response.status).toBe(400);
      expect(forbidden.body.code).toBe("PRECIO_MANUAL_NO_PERMITIDO");
    });

    it("rechaza productos inactivos y vencimiento pasado", async () => {
      const inactive = await createQuoteViaApi(customerAId, [
        { productId: productInactiveId, quantity: 1 },
      ]);
      expect(inactive.response.status).toBe(400);
      expect(inactive.body.code).toBe("PRODUCTO_NO_DISPONIBLE");

      const past = await createQuoteViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 1 }],
        { validUntil: new Date(Date.now() - 60_000).toISOString() }
      );
      expect(past.response.status).toBe(400);
      expect(past.body.code).toBe("VENCIMIENTO_INVALIDO");
    });

    it("reemplaza líneas en borrador preservando las anteriores", async () => {
      const created = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      expect(created.response.status).toBe(201);
      const quoteId = (created.body.quote as Record<string, unknown>).id as string;

      const updated = await updateQuote(
        jsonRequest(`http://localhost/api/quotes/${quoteId}`, "PATCH", {
          items: [{ productId: productSecondId, quantity: 2 }],
        }),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(updated.status).toBe(200);
      const updatedQuote = (await responseJson(updated)).quote as Record<
        string,
        unknown
      >;
      expect(updatedQuote.subtotalCents).toBe("10000");
      expect(
        (updatedQuote.items as Array<Record<string, unknown>>).map(
          (item) => item.productId
        )
      ).toEqual([productSecondId]);

      const allItems = await getQuoteItems(
        new Request(
          `http://localhost/api/quotes/${quoteId}/items?includeDeleted=true`
        ),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(allItems.status).toBe(200);
      const items = (await responseJson(allItems)).items ?? [];
      expect(items).toHaveLength(2);
      expect(items.filter((item) => item.deletedAt !== null)).toHaveLength(1);

      const activeItems = await getQuoteItems(
        new Request(`http://localhost/api/quotes/${quoteId}/items`),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(((await responseJson(activeItems)).items ?? []).length).toBe(1);
    });

    it("bloquea edición fuera de borrador y de cotizaciones vencidas", async () => {
      const created = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const quoteId = (created.body.quote as Record<string, unknown>).id as string;

      const sent = await setQuoteStatus(quoteId, "SENT");
      expect(sent.response.status).toBe(200);

      const denied = await updateQuote(
        jsonRequest(`http://localhost/api/quotes/${quoteId}`, "PATCH", {
          notes: "intento",
        }),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(denied.status).toBe(409);
      expect((await responseJson(denied)).code).toBe("COTIZACION_NO_EDITABLE");

      const draft = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const draftId = (draft.body.quote as Record<string, unknown>).id as string;
      await db.quote.update({
        where: { id: draftId },
        data: { validUntil: new Date(Date.now() - 60_000) },
      });

      const expiredEdit = await updateQuote(
        jsonRequest(`http://localhost/api/quotes/${draftId}`, "PATCH", {
          notes: "vencida",
        }),
        { params: Promise.resolve({ id: draftId }) }
      );
      expect(expiredEdit.status).toBe(409);
      expect((await responseJson(expiredEdit)).code).toBe("COTIZACION_VENCIDA");
    });

    it("valida transiciones, vencimiento e historial", async () => {
      const created = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const quoteId = (created.body.quote as Record<string, unknown>).id as string;

      const invalid = await setQuoteStatus(quoteId, "ACCEPTED");
      expect(invalid.response.status).toBe(409);
      expect(invalid.body.code).toBe("TRANSICION_INVALIDA");

      const sent = await setQuoteStatus(quoteId, "SENT");
      expect(sent.response.status).toBe(200);

      const same = await setQuoteStatus(quoteId, "SENT");
      expect(same.response.status).toBe(409);
      expect(same.body.code).toBe("SIN_CAMBIO_DE_ESTADO");

      const accepted = await setQuoteStatus(quoteId, "ACCEPTED");
      expect(accepted.response.status).toBe(200);

      const terminal = await setQuoteStatus(quoteId, "CANCELLED");
      expect(terminal.response.status).toBe(409);
      expect(terminal.body.code).toBe("TRANSICION_INVALIDA");

      const detail = await getQuote(
        new Request(`http://localhost/api/quotes/${quoteId}`),
        { params: Promise.resolve({ id: quoteId }) }
      );
      const history = (
        ((await responseJson(detail)).quote as Record<string, unknown>)
          .statusHistory as Array<Record<string, unknown>>
      ).map((item) => item.toStatus);
      expect(history).toEqual(["DRAFT", "SENT", "ACCEPTED"]);

      const expired = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const expiredId = (expired.body.quote as Record<string, unknown>)
        .id as string;

      const expiringSent = await setQuoteStatus(expiredId, "SENT");
      expect(expiringSent.response.status).toBe(200);

      await db.quote.update({
        where: { id: expiredId },
        data: { validUntil: new Date(Date.now() - 60_000) },
      });

      const markExpired = await setQuoteStatus(expiredId, "EXPIRED");
      expect(markExpired.response.status).toBe(200);

      const terminalExpired = await setQuoteStatus(expiredId, "SENT");
      expect(terminalExpired.response.status).toBe(409);
      expect(terminalExpired.body.code).toBe("TRANSICION_INVALIDA");

      const expiredDraft = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const expiredDraftId = (
        expiredDraft.body.quote as Record<string, unknown>
      ).id as string;
      await db.quote.update({
        where: { id: expiredDraftId },
        data: { validUntil: new Date(Date.now() - 60_000) },
      });

      const cannotSend = await setQuoteStatus(expiredDraftId, "SENT");
      expect(cannotSend.response.status).toBe(409);
      expect(cannotSend.body.code).toBe("COTIZACION_VENCIDA");
    });

    it("aísla cotizaciones entre vendedores y clientes", async () => {
      const created = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const quoteId = (created.body.quote as Record<string, unknown>).id as string;

      setSession(vendedor2User, "VENDEDOR");
      const foreign = await getQuote(
        new Request(`http://localhost/api/quotes/${quoteId}`),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(foreign.status).toBe(404);

      setSession(clienteUser, "CLIENTE");
      const otherClient = await getQuote(
        new Request(`http://localhost/api/quotes/${quoteId}`),
        { params: Promise.resolve({ id: quoteId }) }
      );
      expect(otherClient.status).toBe(404);

      setSession(vendedor1User, "VENDEDOR");
      const ownClientQuote = await createQuoteViaApi(customerClienteId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const ownClientQuoteId = (
        ownClientQuote.body.quote as Record<string, unknown>
      ).id as string;

      setSession(clienteUser, "CLIENTE");
      const own = await getQuote(
        new Request(`http://localhost/api/quotes/${ownClientQuoteId}`),
        { params: Promise.resolve({ id: ownClientQuoteId }) }
      );
      expect(own.status).toBe(200);

      const list = await listQuotes(
        new Request("http://localhost/api/quotes?pageSize=100")
      );
      expect(list.status).toBe(200);
      const ids = ((await responseJson(list)).quotes ?? []).map(
        (item) => item.id
      );
      expect(ids).toEqual([ownClientQuoteId]);

      setSession(vendedor2User, "VENDEDOR");
      const vendorList = await listQuotes(
        new Request("http://localhost/api/quotes?pageSize=100")
      );
      expect(
        ((await responseJson(vendorList)).quotes ?? []).map((item) => item.id)
      ).not.toContain(ownClientQuoteId);
    });
  });

  describe("conversión cotización → pedido", () => {
    async function sentQuote(
      customerId = customerAId
    ): Promise<{ quoteId: string; items: Array<Record<string, unknown>> }> {
      const created = await createQuoteViaApi(customerId, [
        { productId: productCatalogId, quantity: 2 },
      ]);
      expect(created.response.status).toBe(201);
      const quote = created.body.quote as Record<string, unknown>;
      const quoteId = quote.id as string;
      const sent = await setQuoteStatus(quoteId, "SENT");
      expect(sent.response.status).toBe(200);
      return {
        quoteId,
        items: quote.items as Array<Record<string, unknown>>,
      };
    }

    it("convierte una cotización enviada conservando precios y sin tocar stock", async () => {
      const { quoteId, items } = await sentQuote();

      const { response, body } = await convertQuoteViaApi(
        quoteId,
        `conv-${randomUUID()}`
      );
      expect(response.status).toBe(201);
      expect(body.created).toBe(true);

      const order = body.order as Record<string, unknown>;
      expect(order.quoteId).toBe(quoteId);
      expect(order.status).toBe("PENDING_PAYMENT");
      expect(order.subtotalCents).toBe("24690");
      expect(order.taxCents).toBe("0");
      expect(order.totalCents).toBe("24690");
      expect(order.quoteNumber).toBeUndefined();
      expect((order.quote as Record<string, unknown>).id).toBe(quoteId);

      const orderItems = order.items as Array<Record<string, unknown>>;
      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].unitPriceCents).toBe(items[0].unitPriceCents);
      expect(orderItems[0].subtotalCents).toBe(items[0].subtotalCents);
      expect(orderItems[0].productName).toBe(items[0].productName);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId: productCatalogId },
      });
      expect(inventory.quantityOnHand).toBe(100);
      expect(inventory.quantityReserved).toBe(0);

      const history = await db.orderStatusHistory.findMany({
        where: { orderId: order.id as string },
      });
      expect(history).toHaveLength(1);
      expect(history[0].toStatus).toBe("PENDING_PAYMENT");

      const quote = await db.quote.findUniqueOrThrow({ where: { id: quoteId } });
      expect(quote.status).toBe("SENT");
    });

    it("es idempotente y evita conversiones duplicadas", async () => {
      const { quoteId } = await sentQuote();
      const key = `conv-idem-${randomUUID()}`;

      const first = await convertQuoteViaApi(quoteId, key);
      expect(first.response.status).toBe(201);
      const firstId = (first.body.order as Record<string, unknown>).id as string;

      const replay = await convertQuoteViaApi(quoteId, key);
      expect(replay.response.status).toBe(200);
      expect(replay.body.created).toBe(false);
      expect((replay.body.order as Record<string, unknown>).id).toBe(firstId);

      const differentKey = await convertQuoteViaApi(
        quoteId,
        `conv-other-${randomUUID()}`
      );
      expect(differentKey.response.status).toBe(409);
      expect(differentKey.body.code).toBe("COTIZACION_YA_CONVERTIDA");

      const secondQuote = await sentQuote();
      const reusedKey = await convertQuoteViaApi(secondQuote.quoteId, key);
      expect(reusedKey.response.status).toBe(409);
      expect(reusedKey.body.code).toBe("IDEMPOTENCY_KEY_REUTILIZADA");

      expect(
        await db.order.count({ where: { quoteId } })
      ).toBe(1);
    });

    it("rechaza borradores, cotizaciones vencidas y productos no disponibles", async () => {
      const draft = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const draftId = (draft.body.quote as Record<string, unknown>).id as string;
      const draftConversion = await convertQuoteViaApi(
        draftId,
        `conv-draft-${randomUUID()}`
      );
      expect(draftConversion.response.status).toBe(409);
      expect(draftConversion.body.code).toBe("COTIZACION_NO_CONVERTIBLE");

      const { quoteId } = await sentQuote();
      await db.quote.update({
        where: { id: quoteId },
        data: { validUntil: new Date(Date.now() - 60_000) },
      });
      const expired = await convertQuoteViaApi(
        quoteId,
        `conv-expired-${randomUUID()}`
      );
      expect(expired.response.status).toBe(409);
      expect(expired.body.code).toBe("COTIZACION_VENCIDA");

      const unavailable = await sentQuote();
      await db.product.update({
        where: { id: productCatalogId },
        data: { isActive: false },
      });
      const unavailableConversion = await convertQuoteViaApi(
        unavailable.quoteId,
        `conv-unavailable-${randomUUID()}`
      );
      expect(unavailableConversion.response.status).toBe(409);
      expect(unavailableConversion.body.code).toBe("PRODUCTO_NO_DISPONIBLE");
      expect(
        await db.order.count({ where: { quoteId: unavailable.quoteId } })
      ).toBe(0);
    });

    it("permite convertir una cotización aceptada aunque haya vencido", async () => {
      const { quoteId } = await sentQuote();
      const accepted = await setQuoteStatus(quoteId, "ACCEPTED");
      expect(accepted.response.status).toBe(200);

      await db.quote.update({
        where: { id: quoteId },
        data: { validUntil: new Date(Date.now() - 60_000) },
      });

      const conversion = await convertQuoteViaApi(
        quoteId,
        `conv-accepted-${randomUUID()}`
      );
      expect(conversion.response.status).toBe(201);
    });

    it("no permite cancelar una cotización que ya originó un pedido", async () => {
      const { quoteId } = await sentQuote();
      const conversion = await convertQuoteViaApi(
        quoteId,
        `conv-cancel-${randomUUID()}`
      );
      expect(conversion.response.status).toBe(201);

      const cancel = await setQuoteStatus(quoteId, "CANCELLED");
      expect(cancel.response.status).toBe(409);
      expect(cancel.body.code).toBe("COTIZACION_CON_PEDIDO");
    });

    it("serializa conversiones concurrentes con una sola clave o claves distintas", async () => {
      const sameKeyQuote = await sentQuote();
      const sameKey = `conv-race-${randomUUID()}`;

      const sameKeyResponses = await Promise.all(
        Array.from({ length: 5 }, () =>
          convertQuoteViaApi(sameKeyQuote.quoteId, sameKey)
        )
      );
      const sameKeyStatuses = sameKeyResponses.map(
        (item) => item.response.status
      );
      expect(sameKeyStatuses.filter((status) => status === 201)).toHaveLength(1);
      expect(sameKeyStatuses.filter((status) => status === 200)).toHaveLength(4);
      expect(
        await db.order.count({ where: { quoteId: sameKeyQuote.quoteId } })
      ).toBe(1);

      const distinctKeyQuote = await sentQuote();
      const distinctResponses = await Promise.all(
        Array.from({ length: 5 }, () =>
          convertQuoteViaApi(
            distinctKeyQuote.quoteId,
            `conv-race-${randomUUID()}`
          )
        )
      );
      const distinctStatuses = distinctResponses.map(
        (item) => item.response.status
      );
      expect(distinctStatuses.filter((status) => status === 201)).toHaveLength(1);
      expect(distinctStatuses.filter((status) => status === 409)).toHaveLength(4);
      expect(
        await db.order.count({ where: { quoteId: distinctKeyQuote.quoteId } })
      ).toBe(1);
    });
  });

  describe("pedidos", () => {
    it("crea un pedido directo con totales del servidor e idempotencia", async () => {
      const key = `order-${randomUUID()}`;
      const { response, body } = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 2 }],
        key
      );

      expect(response.status).toBe(201);
      expect(body.created).toBe(true);
      const order = body.order as Record<string, unknown>;
      expect(order.status).toBe("PENDING_PAYMENT");
      expect(order.orderNumber).toMatch(/^PED-\d{8}-[0-9A-F]{12}$/);
      expect(order.subtotalCents).toBe("24690");
      expect(order.taxCents).toBe("0");
      expect(order.totalCents).toBe("24690");
      expect(order.quoteId).toBeNull();
      expect(order).not.toHaveProperty("idempotencyKey");

      const replay = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 2 }],
        key
      );
      expect(replay.response.status).toBe(200);
      expect(replay.body.created).toBe(false);
      expect((replay.body.order as Record<string, unknown>).id).toBe(order.id);

      expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId: productCatalogId },
      });
      expect(inventory.quantityOnHand).toBe(100);
      expect(inventory.quantityReserved).toBe(0);
    });

    it("acepta la clave en el cuerpo y rechaza reutilización con otros datos", async () => {
      const bodyKey = `body-key-${randomUUID()}`;
      const viaBody = await createOrder(
        jsonRequest("http://localhost/api/orders", "POST", {
          customerId: customerAId,
          items: [{ productId: productCatalogId, quantity: 1 }],
          idempotencyKey: bodyKey,
        })
      );
      expect(viaBody.status).toBe(201);

      const conflict = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 3 }],
        bodyKey
      );
      expect(conflict.response.status).toBe(409);
      expect(conflict.body.code).toBe("IDEMPOTENCY_KEY_REUTILIZADA");

      const missing = await createOrder(
        jsonRequest("http://localhost/api/orders", "POST", {
          customerId: customerAId,
          items: [{ productId: productCatalogId, quantity: 1 }],
        })
      );
      expect(missing.status).toBe(400);
      expect((await responseJson(missing)).code).toBe(
        "IDEMPOTENCY_KEY_REQUIRED"
      );
    });

    it("rechaza productos sin precio, stock insuficiente y clientes inactivos", async () => {
      const noPrice = await createOrderViaApi(
        customerAId,
        [{ productId: productNoPriceId, quantity: 1 }],
        `order-noprice-${randomUUID()}`
      );
      expect(noPrice.response.status).toBe(400);
      expect(noPrice.body.code).toBe("PRECIO_NO_CONFIRMADO");

      await db.inventory.update({
        where: { productId: productCatalogId },
        data: { quantityOnHand: 1 },
      });
      const noStock = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 5 }],
        `order-nostock-${randomUUID()}`
      );
      expect(noStock.response.status).toBe(400);
      expect(noStock.body.code).toBe("STOCK_INSUFICIENTE");

      const suffix = randomUUID();
      const inactiveCustomer = await db.customer.create({
        data: {
          personType: "NATURAL",
          documentType: "CC",
          documentNumber: `IN-${suffix}`,
          primerNombre: "Inactivo",
          primerApellido: "Prueba",
          ciudad: "Bogotá",
          departamento: "Cundinamarca",
          direccion: "Calle 0",
          telefono: "3000000000",
          email: `inactivo-${suffix}@gyr.test`,
          isActive: false,
          createdById: vendedor1User.id,
        },
      });

      const inactive = await createOrderViaApi(
        inactiveCustomer.id,
        [{ productId: productCatalogId, quantity: 1 }],
        `order-inactive-${randomUUID()}`
      );
      expect(inactive.response.status).toBe(400);
      expect(inactive.body.code).toBe("CLIENTE_NO_DISPONIBLE");

      expect(await db.order.count({ where: { userId: vendedor1User.id } })).toBe(
        0
      );
    });

    it("CLIENTE no puede crear pedidos ni usar la API comercial de escritura", async () => {
      setSession(clienteUser, "CLIENTE");

      const order = await createOrderViaApi(
        customerClienteId,
        [{ productId: productCatalogId, quantity: 1 }],
        `cliente-order-${randomUUID()}`
      );
      expect(order.response.status).toBe(403);

      const quote = await createQuoteViaApi(customerClienteId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      expect(quote.response.status).toBe(403);
    });

    it("valida transiciones y bloquea estados de pago no autorizados", async () => {
      const created = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 1 }],
        `order-status-${randomUUID()}`
      );
      const orderId = (created.body.order as Record<string, unknown>).id as string;

      const paid = await changeOrderStatus(
        jsonRequest(`http://localhost/api/orders/${orderId}/status`, "POST", {
          status: "PAID",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(paid.status).toBe(409);
      expect((await responseJson(paid)).code).toBe("PAGO_NO_AUTORIZADO");

      const fulfilled = await changeOrderStatus(
        jsonRequest(`http://localhost/api/orders/${orderId}/status`, "POST", {
          status: "FULFILLED",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(fulfilled.status).toBe(409);
      expect((await responseJson(fulfilled)).code).toBe("TRANSICION_INVALIDA");

      const patched = await updateOrder(
        jsonRequest(`http://localhost/api/orders/${orderId}`, "PATCH", {
          notes: "  Entregar   en obra ",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(patched.status).toBe(200);
      expect(
        ((await responseJson(patched)).order as Record<string, unknown>).notes
      ).toBe("Entregar en obra");

      const cancelled = await changeOrderStatus(
        jsonRequest(`http://localhost/api/orders/${orderId}/status`, "POST", {
          status: "CANCELLED",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(cancelled.status).toBe(200);

      const again = await changeOrderStatus(
        jsonRequest(`http://localhost/api/orders/${orderId}/status`, "POST", {
          status: "CANCELLED",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(again.status).toBe(409);
      expect((await responseJson(again)).code).toBe("SIN_CAMBIO_DE_ESTADO");

      const latePatch = await updateOrder(
        jsonRequest(`http://localhost/api/orders/${orderId}`, "PATCH", {
          notes: "tarde",
        }),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(latePatch.status).toBe(409);
      expect((await responseJson(latePatch)).code).toBe("PEDIDO_NO_EDITABLE");

      const detail = await getOrder(
        new Request(`http://localhost/api/orders/${orderId}`),
        { params: Promise.resolve({ id: orderId }) }
      );
      const history = (
        ((await responseJson(detail)).order as Record<string, unknown>)
          .statusHistory as Array<Record<string, unknown>>
      ).map((item) => item.toStatus);
      expect(history).toEqual(["PENDING_PAYMENT", "CANCELLED"]);
    });

    it("aísla pedidos y líneas entre vendedores y clientes", async () => {
      const created = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 1 }],
        `order-scope-${randomUUID()}`
      );
      const orderId = (created.body.order as Record<string, unknown>).id as string;

      setSession(vendedor2User, "VENDEDOR");
      const foreign = await getOrder(
        new Request(`http://localhost/api/orders/${orderId}`),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(foreign.status).toBe(404);

      const foreignItems = await getOrderItems(
        new Request(`http://localhost/api/orders/${orderId}/items`),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(foreignItems.status).toBe(404);

      setSession(vendedor1User, "VENDEDOR");
      const ownClientOrder = await createOrderViaApi(
        customerClienteId,
        [{ productId: productCatalogId, quantity: 1 }],
        `order-client-${randomUUID()}`
      );
      const ownClientOrderId = (
        ownClientOrder.body.order as Record<string, unknown>
      ).id as string;

      setSession(clienteUser, "CLIENTE");
      const otherClient = await getOrder(
        new Request(`http://localhost/api/orders/${orderId}`),
        { params: Promise.resolve({ id: orderId }) }
      );
      expect(otherClient.status).toBe(404);

      const own = await getOrder(
        new Request(`http://localhost/api/orders/${ownClientOrderId}`),
        { params: Promise.resolve({ id: ownClientOrderId }) }
      );
      expect(own.status).toBe(200);

      const items = await getOrderItems(
        new Request(`http://localhost/api/orders/${ownClientOrderId}/items`),
        { params: Promise.resolve({ id: ownClientOrderId }) }
      );
      expect(items.status).toBe(200);
      expect(((await responseJson(items)).items ?? []).length).toBe(1);

      const list = await listOrders(
        new Request("http://localhost/api/orders?pageSize=100")
      );
      expect(
        ((await responseJson(list)).orders ?? []).map((item) => item.id)
      ).toEqual([ownClientOrderId]);
    });

    it("serializa creaciones concurrentes con la misma clave", async () => {
      const key = `order-race-${randomUUID()}`;
      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          createOrderViaApi(
            customerAId,
            [{ productId: productCatalogId, quantity: 1 }],
            key
          )
        )
      );

      const statuses = responses.map((item) => item.response.status);
      expect(statuses.every((status) => status === 200 || status === 201)).toBe(
        true
      );
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 200)).toHaveLength(5);

      const ids = new Set(
        responses.map(
          (item) => (item.body.order as Record<string, unknown>).id as string
        )
      );
      expect(ids.size).toBe(1);
      expect(await db.order.count({ where: { idempotencyKey: key } })).toBe(1);
    });
  });

  describe("seguridad transversal", () => {
    it("responde 401 sin sesión y 403 sin CSRF en todas las mutaciones", async () => {
      setSession(vendedor1User, "VENDEDOR");

      const draft = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const draftId = (draft.body.quote as Record<string, unknown>).id as string;
      const sent = await createQuoteViaApi(customerAId, [
        { productId: productCatalogId, quantity: 1 },
      ]);
      const sentId = (sent.body.quote as Record<string, unknown>).id as string;
      await setQuoteStatus(sentId, "SENT");

      const order = await createOrderViaApi(
        customerAId,
        [{ productId: productCatalogId, quantity: 1 }],
        `csrf-order-${randomUUID()}`
      );
      const orderId = (order.body.order as Record<string, unknown>).id as string;

      const dedicated = await createCustomerViaApi({
        personType: "NATURAL",
        documentType: "CC",
        documentNumber: `CSRF-${randomUUID()}`,
        primerNombre: "Csrf",
        primerApellido: "Prueba",
        ciudad: "Bogotá",
        departamento: "Cundinamarca",
        direccion: "Calle 1",
        telefono: "3001230000",
        email: `csrf-${randomUUID()}@gyr.test`,
      });
      const dedicatedId = (dedicated.body.customer as Record<string, unknown>)
        .id as string;

      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const mutations: Array<Promise<Response>> = [
        createCustomer(
          jsonRequest("http://localhost/api/customers", "POST", {
            personType: "NATURAL",
            documentType: "CC",
            documentNumber: `NO-${randomUUID()}`,
            primerNombre: "Sin",
            primerApellido: "Csrf",
            ciudad: "Bogotá",
            departamento: "Cundinamarca",
            direccion: "Calle 1",
            telefono: "3001230001",
            email: `sin-csrf-${randomUUID()}@gyr.test`,
          })
        ),
        updateCustomer(
          jsonRequest(`http://localhost/api/customers/${customerAId}`, "PATCH", {
            ciudad: "Sin CSRF",
          }),
          { params: Promise.resolve({ id: customerAId }) }
        ),
        deleteCustomer(
          jsonRequest(
            `http://localhost/api/customers/${dedicatedId}`,
            "DELETE"
          ),
          { params: Promise.resolve({ id: dedicatedId }) }
        ),
        createQuote(
          jsonRequest("http://localhost/api/quotes", "POST", {
            customerId: customerAId,
            validUntil: futureIso(),
            items: [{ productId: productCatalogId, quantity: 1 }],
          })
        ),
        updateQuote(
          jsonRequest(`http://localhost/api/quotes/${draftId}`, "PATCH", {
            notes: "sin csrf",
          }),
          { params: Promise.resolve({ id: draftId }) }
        ),
        changeQuoteStatus(
          jsonRequest(
            `http://localhost/api/quotes/${draftId}/status`,
            "POST",
            { status: "SENT" }
          ),
          { params: Promise.resolve({ id: draftId }) }
        ),
        convertQuote(
          jsonRequest(
            `http://localhost/api/quotes/${sentId}/convert`,
            "POST",
            {},
            { "idempotency-key": `csrf-conv-${randomUUID()}` }
          ),
          { params: Promise.resolve({ id: sentId }) }
        ),
        createOrder(
          jsonRequest(
            "http://localhost/api/orders",
            "POST",
            {
              customerId: customerAId,
              items: [{ productId: productCatalogId, quantity: 1 }],
            },
            { "idempotency-key": `csrf-direct-${randomUUID()}` }
          )
        ),
        updateOrder(
          jsonRequest(`http://localhost/api/orders/${orderId}`, "PATCH", {
            notes: "sin csrf",
          }),
          { params: Promise.resolve({ id: orderId }) }
        ),
        changeOrderStatus(
          jsonRequest(
            `http://localhost/api/orders/${orderId}/status`,
            "POST",
            { status: "CANCELLED" }
          ),
          { params: Promise.resolve({ id: orderId }) }
        ),
      ];

      const responses = await Promise.all(mutations);
      for (const response of responses) {
        expect(response.status).toBe(403);
        expect((await responseJson(response)).code).toBe("CSRF_INVALID");
      }

      vi.mocked(validateCsrfToken).mockResolvedValue(true);
      vi.mocked(getSession).mockResolvedValue(null);

      const unauthenticated = await listCustomers(
        new Request("http://localhost/api/customers")
      );
      expect(unauthenticated.status).toBe(401);
      expect((await responseJson(unauthenticated)).code).toBe("UNAUTHENTICATED");
    });

    it("rechaza identificadores inválidos sin consultar la base", async () => {
      const response = await getQuote(
        new Request("http://localhost/api/quotes/no-es-uuid"),
        { params: Promise.resolve({ id: "no-es-uuid" }) }
      );
      expect(response.status).toBe(400);
      expect((await responseJson(response)).code).toBe("ID_INVALIDO");
    });
  });
});
