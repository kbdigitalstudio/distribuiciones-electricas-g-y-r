import type { Prisma } from "@prisma/client";

/**
 * Includes compartidos de las consultas comerciales.
 *
 * Se mantienen en un solo lugar para que listado, detalle y conversión
 * devuelvan exactamente la misma forma de datos.
 */

export const commercialCustomerSelect = {
  id: true,
  userId: true,
  personType: true,
  razonSocial: true,
  primerNombre: true,
  primerApellido: true,
} satisfies Prisma.CustomerSelect;

export const quoteListInclude = {
  customer: { select: commercialCustomerSelect },
  user: { select: { id: true, nombre: true } },
  items: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.QuoteInclude;

export const quoteDetailInclude = {
  ...quoteListInclude,
  statusHistory: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.QuoteInclude;

export const orderListInclude = {
  customer: { select: commercialCustomerSelect },
  user: { select: { id: true, nombre: true } },
  quote: { select: { id: true, quoteNumber: true } },
  items: { orderBy: { id: "asc" } },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  ...orderListInclude,
  statusHistory: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;
