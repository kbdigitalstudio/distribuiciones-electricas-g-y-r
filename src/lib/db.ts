/**
 * Capa de acceso a datos (Prisma Client).
 *
 * NOTA: Requiere ejecutar `npx prisma generate` después de instalar
 * dependencias y configurar DATABASE_URL, para que Prisma genere el
 * cliente tipado en node_modules/@prisma/client.
 *
 * En desarrollo local con hot-reload, se usa un singleton para evitar
 * múltiples instancias de PrismaClient.
 */

"use node";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;

  if (typeof process !== "undefined" && process.addListener) {
    process.addListener("beforeExit", async () => {
      await db.$disconnect();
    });
  }
}

export default db;
