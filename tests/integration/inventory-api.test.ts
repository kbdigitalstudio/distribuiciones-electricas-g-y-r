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

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { POST as createReservation } from "@/app/api/inventory/reservations/route";
import { DELETE as releaseReservation } from "@/app/api/inventory/reservations/[id]/route";
import { GET as getInventory } from "@/app/api/inventory/route";
import { POST as createMovement } from "@/app/api/inventory/movements/route";

interface TestUser {
  id: string;
  email: string;
}

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasTestDatabase ? describe : describe.skip;

let inventarioUser: TestUser;
let vendedorUser: TestUser;
let clienteUser: TestUser;
let adminUser: TestUser;

let categoryId = "";
let productId = "";
const createdUserIds: string[] = [];

function allUserIds(): string[] {
  return createdUserIds;
}

function setSession(user: TestUser, role: string): void {
  vi.mocked(getSession).mockResolvedValue({
    userId: user.id,
    email: user.email,
    role,
    csrf: "test-csrf",
  });
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
      roles: {
        create: {
          role: { connect: { id: roleId } },
        },
      },
    },
  });

  createdUserIds.push(user.id);
  return { id: user.id, email: user.email };
}

function reservationRequest(
  body: Record<string, unknown>,
  idempotencyKey?: string
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }

  return new Request("http://localhost/api/inventory/reservations", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function movementRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/inventory/movements", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface ApiResponse {
  code?: string;
  replayed?: boolean;
  reservation?: { id: string; [key: string]: unknown };
  [key: string]: unknown;
}

async function responseJson(response: Response): Promise<ApiResponse> {
  return response.json();
}

async function setStock(quantityOnHand: number, quantityReserved = 0): Promise<void> {
  await db.inventory.update({
    where: { productId },
    data: { quantityOnHand, quantityReserved },
  });
}

describeIntegration("integración real con PostgreSQL (INVENTARIO)", () => {
  beforeAll(async () => {
    await db.$connect();

    const suffix = randomUUID();

    const [roleInventario, roleVendedor, roleCliente, roleAdmin] =
      await Promise.all([
        db.role.upsert({
          where: { name: "INVENTARIO" },
          update: {},
          create: { name: "INVENTARIO", description: "Test role" },
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
          where: { name: "ADMIN" },
          update: {},
          create: { name: "ADMIN", description: "Test role" },
        }),
      ]);

    inventarioUser = await createTestUser("inventario", roleInventario.id, suffix);
    vendedorUser = await createTestUser("vendedor", roleVendedor.id, suffix);
    clienteUser = await createTestUser("cliente", roleCliente.id, suffix);
    adminUser = await createTestUser("admin", roleAdmin.id, suffix);

    const category = await db.category.create({
      data: {
        name: `Categoría test ${suffix}`,
        slug: `cat-test-${suffix}`,
      },
    });
    categoryId = category.id;

    const product = await db.product.create({
      data: {
        categoryId: category.id,
        name: `Producto test ${suffix}`,
        slug: `producto-test-${suffix}`,
      },
    });
    productId = product.id;

    await db.inventory.create({
      data: {
        productId: product.id,
        quantityOnHand: 5,
        quantityReserved: 0,
      },
    });
  });

  beforeEach(async () => {
    await db.inventoryReservation.deleteMany({ where: { productId } });
    await db.inventoryMovement.deleteMany({ where: { productId } });
    await db.operationLog.deleteMany({
      where: { userId: { in: allUserIds() } },
    });
    await setStock(5, 0);

    vi.mocked(getSession).mockReset();
    setSession(inventarioUser, "INVENTARIO");
  });

  afterAll(async () => {
    if (productId) {
      await db.operationLog.deleteMany({
        where: { userId: { in: allUserIds() } },
      });
      await db.inventoryReservation.deleteMany({ where: { productId } });
      await db.inventoryMovement.deleteMany({ where: { productId } });
      await db.inventory.deleteMany({ where: { productId } });
      await db.product.deleteMany({ where: { id: productId } });
    }

    if (categoryId) {
      await db.category.deleteMany({ where: { id: categoryId } });
    }

    if (createdUserIds.length > 0) {
      await db.userRole.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }

    await db.$disconnect();
  });

  describe("autorización del rol INVENTARIO", () => {
    it("permite INVENTARIO y ADMIN; rechaza VENDEDOR y CLIENTE", async () => {
      setSession(inventarioUser, "INVENTARIO");
      const inventarioResponse = await createReservation(
        reservationRequest(
          { productId, quantity: 1 },
          `auth-inventario-${randomUUID()}`
        )
      );
      expect(inventarioResponse.status).toBe(201);

      setSession(vendedorUser, "VENDEDOR");
      const vendedorResponse = await createReservation(
        reservationRequest(
          { productId, quantity: 1 },
          `auth-vendedor-${randomUUID()}`
        )
      );
      expect(vendedorResponse.status).toBe(403);

      setSession(clienteUser, "CLIENTE");
      const clienteResponse = await createReservation(
        reservationRequest(
          { productId, quantity: 1 },
          `auth-cliente-${randomUUID()}`
        )
      );
      expect(clienteResponse.status).toBe(403);

      setSession(adminUser, "ADMIN");
      const adminResponse = await createReservation(
        reservationRequest(
          { productId, quantity: 1 },
          `auth-admin-${randomUUID()}`
        )
      );
      expect(adminResponse.status).toBe(201);

      const count = await db.inventoryReservation.count({
        where: { productId },
      });
      expect(count).toBe(2);
    });

    it("protege la consulta GET de inventario", async () => {
      setSession(vendedorUser, "VENDEDOR");
      const denied = await getInventory(
        new Request("http://localhost/api/inventory")
      );
      expect(denied.status).toBe(403);

      setSession(inventarioUser, "INVENTARIO");
      const allowed = await getInventory(
        new Request("http://localhost/api/inventory")
      );
      expect(allowed.status).toBe(200);
    });
  });

  describe("concurrencia y sobreventa", () => {
    it("con 10 reservas simultáneas y stock 1, solo una gana", async () => {
      await setStock(1, 0);
      setSession(inventarioUser, "INVENTARIO");

      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          createReservation(
            reservationRequest(
              { productId, quantity: 1 },
              `race-${randomUUID()}`
            )
          )
        )
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 400)).toHaveLength(9);

      for (const response of responses.filter((item) => item.status === 400)) {
        const body = await responseJson(response);
        expect(body.code).toBe("STOCK_INSUFICIENTE");
      }

      const reservations = await db.inventoryReservation.count({
        where: { productId },
      });
      expect(reservations).toBe(1);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityOnHand).toBe(1);
      expect(inventory.quantityReserved).toBe(1);
      expect(inventory.quantityOnHand - inventory.quantityReserved).toBe(0);
    });

    it("EXIT no consume stock reservado y RELEASE no libera de más", async () => {
      setSession(inventarioUser, "INVENTARIO");

      const reserved = await createReservation(
        reservationRequest(
          { productId, quantity: 4 },
          `movement-reserve-${randomUUID()}`
        )
      );
      expect(reserved.status).toBe(201);

      const exitDenied = await createMovement(
        movementRequest({
          productId,
          movementType: "EXIT",
          quantity: 2,
          reason: "prueba de stock reservado",
        })
      );
      expect(exitDenied.status).toBe(400);
      expect((await responseJson(exitDenied)).code).toBe("STOCK_INSUFICIENTE");

      const exitAllowed = await createMovement(
        movementRequest({
          productId,
          movementType: "EXIT",
          quantity: 1,
          reason: "salida de disponibilidad libre",
        })
      );
      expect(exitAllowed.status).toBe(201);

      let inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityOnHand).toBe(4);
      expect(inventory.quantityReserved).toBe(4);
      expect(inventory.quantityOnHand - inventory.quantityReserved).toBe(0);

      const releaseDenied = await createMovement(
        movementRequest({
          productId,
          movementType: "RELEASE",
          quantity: 5,
          reason: "liberación inválida",
        })
      );
      expect(releaseDenied.status).toBe(400);
      expect((await responseJson(releaseDenied)).code).toBe(
        "CANTIDAD_RESERVADA_INSUFICIENTE"
      );

      inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(4);
    });

    it("VENDEDOR no puede registrar movimientos de inventario", async () => {
      setSession(vendedorUser, "VENDEDOR");

      const response = await createMovement(
        movementRequest({
          productId,
          movementType: "ENTRY",
          quantity: 1,
          reason: "no autorizado",
        })
      );

      expect(response.status).toBe(403);
    });
  });

  describe("idempotencia de reservas", () => {
    it("10 solicitudes simultáneas con la misma clave crean una sola reserva", async () => {
      setSession(inventarioUser, "INVENTARIO");
      const key = `idem-race-${randomUUID()}`;

      const responses = await Promise.all(
        Array.from({ length: 10 }, () =>
          createReservation(
            reservationRequest({ productId, quantity: 1 }, key)
          )
        )
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 200)).toHaveLength(9);
      expect(statuses.every((status) => status === 200 || status === 201)).toBe(
        true
      );

      const bodies = await Promise.all(
        responses.map((response) => responseJson(response))
      );
      const reservationIds = new Set(
        bodies.map((body) => body.reservation!.id as string)
      );
      expect(reservationIds.size).toBe(1);

      const count = await db.inventoryReservation.count({
        where: { idempotencyKey: key },
      });
      expect(count).toBe(1);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(1);
    });

    it("un reintento secuencial devuelve la misma reserva", async () => {
      setSession(inventarioUser, "INVENTARIO");
      const key = `idem-retry-${randomUUID()}`;

      const first = await createReservation(
        reservationRequest({ productId, quantity: 2 }, key)
      );
      expect(first.status).toBe(201);
      const firstBody = await responseJson(first);

      const second = await createReservation(
        reservationRequest({ productId, quantity: 2 }, key)
      );
      expect(second.status).toBe(200);
      const secondBody = await responseJson(second);

      expect(secondBody.reservation!.id).toBe(firstBody.reservation!.id);
      expect(secondBody.replayed).toBe(true);

      const count = await db.inventoryReservation.count({
        where: { idempotencyKey: key },
      });
      expect(count).toBe(1);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(2);
    });

    it("rechaza reutilizar la clave con un payload distinto", async () => {
      setSession(inventarioUser, "INVENTARIO");
      const key = `idem-conflict-${randomUUID()}`;

      const first = await createReservation(
        reservationRequest({ productId, quantity: 1 }, key)
      );
      expect(first.status).toBe(201);

      const conflict = await createReservation(
        reservationRequest({ productId, quantity: 2 }, key)
      );
      expect(conflict.status).toBe(409);
      expect((await responseJson(conflict)).code).toBe(
        "IDEMPOTENCY_KEY_REUSED"
      );

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(1);
    });

    it("exige una clave de idempotencia", async () => {
      setSession(inventarioUser, "INVENTARIO");

      const response = await createReservation(
        reservationRequest({ productId, quantity: 1 })
      );
      expect(response.status).toBe(400);
      expect((await responseJson(response)).code).toBe(
        "IDEMPOTENCY_KEY_REQUIRED"
      );

      const count = await db.inventoryReservation.count({
        where: { productId },
      });
      expect(count).toBe(0);
    });

    it("rechaza que header y body tengan claves distintas", async () => {
      setSession(inventarioUser, "INVENTARIO");

      const request = new Request(
        "http://localhost/api/inventory/reservations",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": "header-key",
          },
          body: JSON.stringify({
            productId,
            quantity: 1,
            idempotencyKey: "body-key",
          }),
        }
      );

      const response = await createReservation(request);
      expect(response.status).toBe(400);
      expect((await responseJson(response)).code).toBe(
        "IDEMPOTENCY_KEY_MISMATCH"
      );
    });
  });

  describe("liberación de reservas", () => {
    it("restaura la disponibilidad y no permite liberar dos veces", async () => {
      setSession(inventarioUser, "INVENTARIO");

      const created = await createReservation(
        reservationRequest(
          { productId, quantity: 2 },
          `release-${randomUUID()}`
        )
      );
      expect(created.status).toBe(201);
      const createdBody = await responseJson(created);
      const reservationId = createdBody.reservation!.id as string;

      const released = await releaseReservation(
        new Request(
          `http://localhost/api/inventory/reservations/${reservationId}`,
          { method: "DELETE" }
        ),
        { params: Promise.resolve({ id: reservationId }) }
      );
      expect(released.status).toBe(200);

      let inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(0);
      expect(inventory.quantityOnHand - inventory.quantityReserved).toBe(5);

      const secondRelease = await releaseReservation(
        new Request(
          `http://localhost/api/inventory/reservations/${reservationId}`,
          { method: "DELETE" }
        ),
        { params: Promise.resolve({ id: reservationId }) }
      );
      expect(secondRelease.status).toBe(400);
      expect((await responseJson(secondRelease)).code).toBe(
        "RESERVA_NO_ACTIVA"
      );

      inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(0);
    });

    it("dos liberaciones simultáneas solo liberan una vez", async () => {
      setSession(inventarioUser, "INVENTARIO");

      const created = await createReservation(
        reservationRequest(
          { productId, quantity: 3 },
          `release-race-${randomUUID()}`
        )
      );
      expect(created.status).toBe(201);
      const createdBody = await responseJson(created);
      const reservationId = createdBody.reservation!.id as string;

      const release = () =>
        releaseReservation(
          new Request(
            `http://localhost/api/inventory/reservations/${reservationId}`,
            { method: "DELETE" }
          ),
          { params: Promise.resolve({ id: reservationId }) }
        );

      const responses = await Promise.all([release(), release()]);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 400]);

      const inventory = await db.inventory.findUniqueOrThrow({
        where: { productId },
      });
      expect(inventory.quantityReserved).toBe(0);
    });
  });
});
