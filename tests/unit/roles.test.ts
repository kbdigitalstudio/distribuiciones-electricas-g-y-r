import { describe, expect, it } from "vitest";
import {
  canAccessInventory,
  getRoleLevel,
  hasAnyRole,
  hasMinRole,
  hasRole,
  ROLE_LEVELS,
} from "@/lib/roles";

describe("jerarquía CLIENTE < VENDEDOR < ADMIN", () => {
  it("mantiene los niveles aprobados", () => {
    expect(ROLE_LEVELS).toEqual({
      CLIENTE: 1,
      VENDEDOR: 2,
      ADMIN: 3,
    });
  });

  it("hasMinRole respeta la jerarquía", () => {
    expect(hasMinRole(["CLIENTE"], "VENDEDOR")).toBe(false);
    expect(hasMinRole(["VENDEDOR"], "VENDEDOR")).toBe(true);
    expect(hasMinRole(["ADMIN"], "VENDEDOR")).toBe(true);
    expect(hasMinRole([], "CLIENTE")).toBe(false);
  });

  it("hasRole y hasAnyRole verifican roles explícitos", () => {
    expect(hasRole(["INVENTARIO"], "INVENTARIO")).toBe(true);
    expect(hasRole(["INVENTARIO"], "VENDEDOR")).toBe(false);
    expect(hasAnyRole(["CLIENTE", "INVENTARIO"], ["INVENTARIO", "ADMIN"])).toBe(true);
  });
});

describe("rol INVENTARIO independiente", () => {
  it("no forma parte de la jerarquía de niveles", () => {
    expect(getRoleLevel("INVENTARIO")).toBe(0);
    expect(hasMinRole(["INVENTARIO"], "CLIENTE")).toBe(false);
    expect(hasMinRole(["INVENTARIO"], "VENDEDOR")).toBe(false);
  });

  it("concede acceso a inventario solo a INVENTARIO y ADMIN", () => {
    expect(canAccessInventory(["INVENTARIO"])).toBe(true);
    expect(canAccessInventory(["ADMIN"])).toBe(true);
    expect(canAccessInventory(["ADMIN", "INVENTARIO"])).toBe(true);
  });

  it("NO mapea VENDEDOR ni CLIENTE a INVENTARIO", () => {
    expect(canAccessInventory(["VENDEDOR"])).toBe(false);
    expect(canAccessInventory(["CLIENTE"])).toBe(false);
    expect(canAccessInventory([])).toBe(false);
  });
});
