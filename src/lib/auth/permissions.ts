import "server-only";
import type { CurrentUser } from "./dal";

/**
 * Permission strings are "resource:action" (e.g. "assets:checkout") or a
 * wildcard segment ("assets:*", or "*" for admin). Matches seedRoles in
 * src/db/seed/data.ts.
 */
export function hasPermission(user: CurrentUser, permission: string): boolean {
  const perms = user.role.permissions;
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;

  const [resource] = permission.split(":");
  return perms.includes(`${resource}:*`);
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Throws if the user lacks the permission — call at the top of every Server Action/mutation. */
export function requirePermission(user: CurrentUser, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new ForbiddenError(permission);
  }
}

/** True if `manager` is `subordinate`'s direct manager — used for approval-cycle routing. */
export function isDirectManagerOf(managerId: string, subordinate: Pick<CurrentUser, "managerId">): boolean {
  return subordinate.managerId === managerId;
}
