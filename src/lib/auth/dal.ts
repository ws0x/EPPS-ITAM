import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { users, roles } from "@/db/schema";

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string;
  departmentId: string | null;
  locationId: string | null;
  managerId: string | null;
  role: {
    id: string;
    name: string;
    permissions: string[];
  };
};

/**
 * The one place session validity is checked. Uses supabase.auth.getUser(),
 * which re-verifies the token against Supabase's auth server (unlike
 * getSession(), which only trusts the cookie) - this is the "secure" check,
 * as opposed to proxy.ts's optimistic redirect-only check. Cached per
 * request via React's cache() so repeated calls in one render don't repeat
 * the DB round trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      companyId: users.companyId,
      departmentId: users.departmentId,
      locationId: users.locationId,
      managerId: users.managerId,
      loginEnabled: users.loginEnabled,
      roleId: roles.id,
      roleName: roles.name,
      rolePermissions: roles.permissions,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!row || !row.loginEnabled) return null;

  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    companyId: row.companyId,
    departmentId: row.departmentId,
    locationId: row.locationId,
    managerId: row.managerId,
    role: {
      id: row.roleId,
      name: row.roleName,
      permissions: row.rolePermissions,
    },
  };
});

/** Use in Server Components/Actions/Route Handlers that require a signed-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
