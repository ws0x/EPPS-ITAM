"use server";

import { eq, asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { statusLabels } from "@/db/schema";

export async function listStatusLabels() {
  const user = await requireUser();
  return db
    .select()
    .from(statusLabels)
    .where(eq(statusLabels.companyId, user.companyId))
    .orderBy(asc(statusLabels.name));
}
