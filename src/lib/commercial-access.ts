import type {
  Customer,
  Order,
  Prisma,
  Quote,
} from "@prisma/client";

/**
 * Reglas de autorización comercial.
 *
 * Se aplican en cada Route Handler. No se confía en permisos del frontend.
 * - ADMIN: acceso total.
 * - VENDEDOR: clientes que creó y cotizaciones/pedidos de los que es responsable.
 * - CLIENTE: únicamente su propio Customer, sus cotizaciones y sus pedidos.
 */

export function isAdmin(roles: string[]): boolean {
  return roles.includes("ADMIN");
}

export function isVendedor(roles: string[]): boolean {
  return roles.includes("VENDEDOR");
}

export function isCliente(roles: string[]): boolean {
  return roles.includes("CLIENTE");
}

export function canManageCommercial(roles: string[]): boolean {
  return isAdmin(roles) || isVendedor(roles);
}

export function canReadCustomer(
  customer: Pick<Customer, "userId" | "createdById">,
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isCliente(roles)) return customer.userId === sessionUserId;
  if (isVendedor(roles)) {
    return (
      customer.createdById === sessionUserId ||
      customer.userId === sessionUserId
    );
  }
  return false;
}

export function canManageCustomer(
  customer: Pick<Customer, "createdById" | "userId">,
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isVendedor(roles)) {
    return (
      customer.createdById === sessionUserId ||
      customer.userId === sessionUserId
    );
  }
  return false;
}

export function canReadQuote(
  quote: Pick<Quote, "userId"> & { customer: Pick<Customer, "userId"> },
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isVendedor(roles)) return quote.userId === sessionUserId;
  if (isCliente(roles)) return quote.customer.userId === sessionUserId;
  return false;
}

export function canManageQuote(
  quote: Pick<Quote, "userId">,
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isVendedor(roles)) return quote.userId === sessionUserId;
  return false;
}

export function canReadOrder(
  order: Pick<Order, "userId"> & { customer: Pick<Customer, "userId"> },
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isVendedor(roles)) return order.userId === sessionUserId;
  if (isCliente(roles)) return order.customer.userId === sessionUserId;
  return false;
}

export function canManageOrder(
  order: Pick<Order, "userId">,
  sessionUserId: string,
  roles: string[]
): boolean {
  if (isAdmin(roles)) return true;
  if (isVendedor(roles)) return order.userId === sessionUserId;
  return false;
}

export function customerScopeWhere(
  sessionUserId: string,
  roles: string[]
): Prisma.CustomerWhereInput | null {
  if (isAdmin(roles)) return {};
  if (isVendedor(roles)) {
    return {
      OR: [{ createdById: sessionUserId }, { userId: sessionUserId }],
    };
  }
  if (isCliente(roles)) return { userId: sessionUserId };
  return null;
}

export function quoteScopeWhere(
  sessionUserId: string,
  roles: string[]
): Prisma.QuoteWhereInput | null {
  if (isAdmin(roles)) return {};
  if (isVendedor(roles)) return { userId: sessionUserId };
  if (isCliente(roles)) return { customer: { userId: sessionUserId } };
  return null;
}

export function orderScopeWhere(
  sessionUserId: string,
  roles: string[]
): Prisma.OrderWhereInput | null {
  if (isAdmin(roles)) return {};
  if (isVendedor(roles)) return { userId: sessionUserId };
  if (isCliente(roles)) return { customer: { userId: sessionUserId } };
  return null;
}
