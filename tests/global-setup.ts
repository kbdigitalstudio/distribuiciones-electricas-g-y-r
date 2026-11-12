import { execSync } from "node:child_process";

/**
 * Aplica las migraciones de Prisma a la base de datos de pruebas antes de
 * ejecutar las pruebas de integración.
 *
 * Protección: TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga
 * "test" (por ejemplo gyr_test). Nunca se debe usar una base de producción.
 */
function assertTestDatabase(url: string): void {
  const databaseName = new URL(url).pathname.replace(/^\//, "");

  if (!/(^|[_\-])test($|[_\-])/i.test(databaseName)) {
    throw new Error(
      `TEST_DATABASE_URL debe apuntar a una base de pruebas; base recibida: "${databaseName}"`
    );
  }
}

export default function globalSetup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl) {
    // Las pruebas de integración se omiten; las unitarias no usan BD.
    return;
  }

  assertTestDatabase(testDatabaseUrl);

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
    },
    stdio: "inherit",
  });
}
