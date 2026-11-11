import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// Roles jerárquicos: niveles para comparar privilegios
const ROLE_LEVELS: Record<string, number> = {
  CLIENTE: 1,
  VENDEDOR: 2,
  ADMIN: 3,
};

export function getRoleLevel(role: string): number {
  return ROLE_LEVELS[role] ?? 0;
}

export function hasRole(userRoles: string[], requiredRole: string): boolean {
  return userRoles.includes(requiredRole);
}

export function hasMinRole(userRoles: string[], minRole: string): boolean {
  const userLevel = Math.max(...userRoles.map((r: any) => getRoleLevel(r)));
  const requiredLevel = getRoleLevel(minRole);
  return userLevel >= requiredLevel;
}

export async function getAuthenticatedUser(request: Request) {
  const session = await getSession();
  if (!session) {
    return { error: "No autenticado", code: "UNAUTHENTICATED", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { roles: { include: { role: true } } },
  });

  if (!user || !user.isActive) {
    return { error: "Usuario no encontrado o inactivo", code: "USER_NOT_FOUND", status: 404 };
  }

  const roles = user.roles.map((r: any) => r.role.name);
  return { user, session, roles };
}

export function requireRole(roles: string[], required: string) {
  if (!hasMinRole(roles, required)) {
    return { error: "Acceso denegado: rol insuficiente", code: "FORBIDDEN", status: 403 };
  }
  return null;
}

export function canModifyUser(targetUserId: string, sessionUserId: string, roles: string[]): boolean {
  // Un usuario puede modificar su propio perfil
  if (targetUserId === sessionUserId) return true;
  // Solo ADMIN puede modificar otros usuarios
  return hasRole(roles, "ADMIN");
}
