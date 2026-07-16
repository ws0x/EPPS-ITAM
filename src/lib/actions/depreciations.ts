"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { depreciations } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listDepreciationSchedules() {
  const user = await requireUser();
  return db
    .select()
    .from(depreciations)
    .where(eq(depreciations.companyId, user.companyId))
    .orderBy(asc(depreciations.name));
}

export type ActionState = { error?: string } | undefined;

export async function createDepreciationSchedule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  const months = Number(formData.get("months") ?? 0);
  const minimumValuePct = Number(formData.get("minimumValuePct") ?? 0);

  if (!name) return { error: "Name is required." };
  if (!Number.isInteger(months) || months <= 0) return { error: "Useful life (months) must be a positive whole number." };
  if (!Number.isInteger(minimumValuePct) || minimumValuePct < 0 || minimumValuePct > 100) {
    return { error: "Minimum value % must be a whole number between 0 and 100." };
  }

  const [newSchedule] = await db
    .insert(depreciations)
    .values({ companyId: user.companyId, name, months, minimumValuePct })
    .returning();

  await logCreate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "depreciation",
    targetId: newSchedule.id,
    row: newSchedule,
  });

  revalidatePath("/depreciation");
}

export async function updateDepreciationSchedule(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const months = Number(formData.get("months") ?? 0);
  const minimumValuePct = Number(formData.get("minimumValuePct") ?? 0);

  if (!name) return { error: "Name is required." };
  if (!Number.isInteger(months) || months <= 0) return { error: "Useful life (months) must be a positive whole number." };
  if (!Number.isInteger(minimumValuePct) || minimumValuePct < 0 || minimumValuePct > 100) {
    return { error: "Minimum value % must be a whole number between 0 and 100." };
  }

  const [before] = await db.select().from(depreciations).where(eq(depreciations.id, id)).limit(1);
  if (!before) return { error: "Depreciation schedule not found." };

  const [after] = await db
    .update(depreciations)
    .set({ name, months, minimumValuePct })
    .where(eq(depreciations.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "depreciation",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/depreciation");
}
