import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildSeedPlan, parseProducts } from "../../prisma/seed.mjs";

const source = readFileSync(
  join(process.cwd(), "src", "data", "products.ts"),
  "utf8"
);

describe("seed del catálogo", () => {
  it("lee todos los productos del archivo de datos del sitio", () => {
    const products = parseProducts(source);

    expect(products.length).toBeGreaterThan(20);
    expect(products.map((p) => p.slug)).toContain("tt-36kv");
    expect(products.every((p) => p.name && p.imageUrl)).toBe(true);
  });

  it("avisa si el archivo de datos cambia de formato", () => {
    expect(() => parseProducts("const PRODUCTS = [];")).toThrow(/Seed abortado/);
  });

  it("asigna cada producto a una categoría conocida", () => {
    const plan = buildSeedPlan(parseProducts(source));
    const total = plan.reduce((n, c) => n + c.products.length, 0);

    expect(plan.length).toBeGreaterThan(10);
    expect(total).toBe(parseProducts(source).length);
    expect(plan.find((c) => c.slug === "interruptores-tomacorrientes")).toBeDefined();
  });
});
