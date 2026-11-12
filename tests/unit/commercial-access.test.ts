import { describe, expect, it } from "vitest";

import {
  canManageCommercial,
  canManageCustomer,
  canManageOrder,
  canManageQuote,
  canReadCustomer,
  canReadOrder,
  canReadQuote,
  customerScopeWhere,
  isAdmin,
  isCliente,
  isVendedor,
  orderScopeWhere,
  quoteScopeWhere,
} from "@/lib/commercial-access";

const yo = "usuario-yo";
const otro = "usuario-otro";

const customerPropio = { userId: yo, createdById: otro };
const customerCreado = { userId: otro, createdById: yo };
const customerAjeno = { userId: otro, createdById: otro };

describe("roles comerciales", () => {
  it("identifica cada rol sin permisos implícitos", () => {
    expect(isAdmin(["ADMIN"])).toBe(true);
    expect(isAdmin(["VENDEDOR"])).toBe(false);
    expect(isVendedor(["VENDEDOR"])).toBe(true);
    expect(isCliente(["CLIENTE"])).toBe(true);
    expect(canManageCommercial(["VENDEDOR"])).toBe(true);
    expect(canManageCommercial(["ADMIN"])).toBe(true);
    expect(canManageCommercial(["CLIENTE"])).toBe(false);
    expect(canManageCommercial(["INVENTARIO"])).toBe(false);
    expect(canManageCommercial([])).toBe(false);
  });
});

describe("alcance de clientes", () => {
  it("ADMIN lee y administra cualquier cliente", () => {
    expect(canReadCustomer(customerAjeno, yo, ["ADMIN"])).toBe(true);
    expect(canManageCustomer(customerAjeno, yo, ["ADMIN"])).toBe(true);
  });

  it("VENDEDOR solo accede a clientes que creó o a su propio registro", () => {
    expect(canReadCustomer(customerCreado, yo, ["VENDEDOR"])).toBe(true);
    expect(canReadCustomer(customerPropio, yo, ["VENDEDOR"])).toBe(true);
    expect(canReadCustomer(customerAjeno, yo, ["VENDEDOR"])).toBe(false);

    expect(canManageCustomer(customerCreado, yo, ["VENDEDOR"])).toBe(true);
    expect(canManageCustomer(customerPropio, yo, ["VENDEDOR"])).toBe(true);
    expect(canManageCustomer(customerAjeno, yo, ["VENDEDOR"])).toBe(false);
  });

  it("CLIENTE solo lee su propio registro y nunca lo administra", () => {
    expect(canReadCustomer(customerPropio, yo, ["CLIENTE"])).toBe(true);
    expect(canReadCustomer(customerCreado, yo, ["CLIENTE"])).toBe(false);
    expect(canReadCustomer(customerAjeno, yo, ["CLIENTE"])).toBe(false);
    expect(canManageCustomer(customerPropio, yo, ["CLIENTE"])).toBe(false);
  });

  it("roles no comerciales no acceden a clientes", () => {
    expect(canReadCustomer(customerPropio, yo, ["INVENTARIO"])).toBe(false);
    expect(canManageCustomer(customerPropio, yo, ["INVENTARIO"])).toBe(false);
    expect(canReadCustomer(customerPropio, yo, [])).toBe(false);
  });

  it("genera filtros de consulta coherentes con las reglas", () => {
    expect(customerScopeWhere(yo, ["ADMIN"])).toEqual({});
    expect(customerScopeWhere(yo, ["VENDEDOR"])).toEqual({
      OR: [{ createdById: yo }, { userId: yo }],
    });
    expect(customerScopeWhere(yo, ["CLIENTE"])).toEqual({ userId: yo });
    expect(customerScopeWhere(yo, ["INVENTARIO"])).toBeNull();
  });
});

describe("alcance de cotizaciones y pedidos", () => {
  const quotePropia = { userId: yo, customer: { userId: otro } };
  const quoteDeMiCliente = { userId: otro, customer: { userId: yo } };
  const quoteAjena = { userId: otro, customer: { userId: otro } };

  it("ADMIN administra cualquier cotización", () => {
    expect(canReadQuote(quoteAjena, yo, ["ADMIN"])).toBe(true);
    expect(canManageQuote(quoteAjena, yo, ["ADMIN"])).toBe(true);
  });

  it("VENDEDOR solo administra cotizaciones de las que es responsable", () => {
    expect(canReadQuote(quotePropia, yo, ["VENDEDOR"])).toBe(true);
    expect(canManageQuote(quotePropia, yo, ["VENDEDOR"])).toBe(true);
    expect(canReadQuote(quoteDeMiCliente, yo, ["VENDEDOR"])).toBe(false);
    expect(canManageQuote(quoteDeMiCliente, yo, ["VENDEDOR"])).toBe(false);
    expect(canReadQuote(quoteAjena, yo, ["VENDEDOR"])).toBe(false);
  });

  it("CLIENTE solo lee las cotizaciones de su propio registro", () => {
    expect(canReadQuote(quoteDeMiCliente, yo, ["CLIENTE"])).toBe(true);
    expect(canReadQuote(quoteAjena, yo, ["CLIENTE"])).toBe(false);
    expect(canManageQuote(quoteDeMiCliente, yo, ["CLIENTE"])).toBe(false);
  });

  it("permite leer pedidos de mi cliente y nunca administrarlos como CLIENTE", () => {
    const orderDeMiCliente = { userId: otro, customer: { userId: yo } };
    const orderAjena = { userId: otro, customer: { userId: otro } };

    expect(canReadOrder(orderDeMiCliente, yo, ["CLIENTE"])).toBe(true);
    expect(canReadOrder(orderAjena, yo, ["CLIENTE"])).toBe(false);
    expect(canManageOrder(orderDeMiCliente, yo, ["CLIENTE"])).toBe(false);

    expect(canReadOrder(orderDeMiCliente, yo, ["VENDEDOR"])).toBe(false);
    expect(canManageOrder(orderDeMiCliente, yo, ["VENDEDOR"])).toBe(false);
    expect(canReadOrder(orderDeMiCliente, yo, ["ADMIN"])).toBe(true);
  });

  it("aísla el listado por responsable o por cliente", () => {
    expect(quoteScopeWhere(yo, ["ADMIN"])).toEqual({});
    expect(quoteScopeWhere(yo, ["VENDEDOR"])).toEqual({ userId: yo });
    expect(quoteScopeWhere(yo, ["CLIENTE"])).toEqual({
      customer: { userId: yo },
    });
    expect(orderScopeWhere(yo, ["VENDEDOR"])).toEqual({ userId: yo });
    expect(orderScopeWhere(yo, ["CLIENTE"])).toEqual({
      customer: { userId: yo },
    });
    expect(orderScopeWhere(yo, ["INVENTARIO"])).toBeNull();
  });
});
