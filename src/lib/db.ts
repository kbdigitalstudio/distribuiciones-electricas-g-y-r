/**
 * Capa de acceso a datos (Prisma Client).
 *
 * NOTA: Requiere ejecutar `npx prisma generate` después de instalar
 * dependencias y configurar DATABASE_URL, para que Prisma genere el
 * cliente tipado. Sin ese paso, la importación de PrismaClient fallará
 * en tiempo de ejecución (no en TypeScript, gracias al @ts-ignore).
 *
 * En desarrollo local con hot-reload, se usa un singleton para evitar
 * múltiples instancias de PrismaClient.
 */

"use node";

// @ts-ignore - PrismaClient se genera con `npx prisma generate`
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
