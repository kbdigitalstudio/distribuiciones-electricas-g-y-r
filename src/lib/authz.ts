import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/session";
import {
  getRoleLevel,
  hasRole,
  hasMinRole,
  hasAnyRole,
  canAccessInventory,
} from "@/lib/roles";

// Re-exportar las reglas puras mantiene compatibilidad con los imports
// existentes desde "@/lib/authz".
export {
  getRoleLevel,
  hasRole,
  hasMinRole,
  hasAnyRole,
  canAccessInventory,
};

type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  include: { roles: { include: { role: true } } };
}>;

export interface AuthenticationSuccess {
  user: AuthenticatedUserRecord;
  session: SessionUser;
  roles: string[];
}

export interface AuthenticationError {
  error: string;
  code: string;
  status: number;
}

export async function getAuthenticatedUser(
  request: Request
): Promise<AuthenticationSuccess | AuthenticationError> {
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

  const roles = user.roles.map((r: { role: { name: string } }) => r.role.name);
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
