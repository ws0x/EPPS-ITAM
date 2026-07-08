"use server";

import { eq, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function listUsers() {
  const user = await requireUser();
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.companyId, user.companyId))
    .orderBy(asc(users.firstName));
}
