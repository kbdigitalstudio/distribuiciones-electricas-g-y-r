/**
 * Reglas de roles puras (sin dependencias de Prisma, cookies ni Next.js).
 *
 * Importante:
 * - CLIENTE, VENDEDOR y ADMIN forman una jerarquía de privilegios.
 * - INVENTARIO es un rol funcional ORTOGONAL: no pertenece a esa jerarquía y
 *   no se deriva de VENDEDOR. El acceso a inventario se concede explícitamente
 *   con canAccessInventory().
 */

export const ROLE_LEVELS = {
  CLIENTE: 1,
  VENDEDOR: 2,
  ADMIN: 3,
} as const;

export type HierarchicalRole = keyof typeof ROLE_LEVELS;

/** Roles con acceso explícito a las operaciones de inventario. */
export const INVENTORY_ROLES = ["INVENTARIO", "ADMIN"] as const;

export type InventoryRole = (typeof INVENTORY_ROLES)[number];

export function getRoleLevel(role: string): number {
  return ROLE_LEVELS[role as HierarchicalRole] ?? 0;
}

export function hasRole(userRoles: string[], requiredRole: string): boolean {
  return userRoles.includes(requiredRole);
}

export function hasAnyRole(
  userRoles: string[],
  requiredRoles: readonly string[]
): boolean {
  return requiredRoles.some((role) => userRoles.includes(role));
}

export function hasMinRole(userRoles: string[], minRole: string): boolean {
  if (userRoles.length === 0) return false;
  const userLevel = Math.max(...userRoles.map((role) => getRoleLevel(role)));
  return userLevel >= getRoleLevel(minRole);
}

/**
 * Autorización de inventario: INVENTARIO explícito o ADMIN.
 * VENDEDOR NO obtiene acceso por tener nivel 2.
 */
export function canAccessInventory(userRoles: string[]): boolean {
  return hasAnyRole(userRoles, INVENTORY_ROLES);
}
