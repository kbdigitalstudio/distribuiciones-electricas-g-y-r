/**
 * Setup de pruebas.
 *
 * Las pruebas unitarias no necesitan base de datos.
 * Las de integración solo se ejecutan si TEST_DATABASE_URL está definida y
 * apunta a una base de datos de pruebas (ver tests/global-setup.ts).
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

Object.assign(process.env, { NODE_ENV: "test" });
