"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { departments } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listDepartments() {
  const user = await requireUser();
  return db
    .select()
    .from(departments)
    .where(eq(departments.companyId, user.companyId))
    .orderBy(asc(departments.name));
}

export type ActionState = { error?: string } | undefined;

export async function createDepartment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const [newDepartment] = await db
    .insert(departments)
    .values({
      companyId: user.companyId,
      name,
      managerId: emptyToNull(formData.get("managerId")),
      defaultLocationId: emptyToNull(formData.get("defaultLocationId")),
      notes: emptyToNull(formData.get("notes")),
    })
    .returning();

  await logCreate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "department",
    targetId: newDepartment.id,
    row: newDepartment,
  });

  revalidatePath("/departments");
}

export async function updateDepartment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  const [before] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
  if (!before) return { error: "Department not found." };

  const [after] = await db
    .update(departments)
    .set({
      name,
      managerId: emptyToNull(formData.get("managerId")),
      defaultLocationId: emptyToNull(formData.get("defaultLocationId")),
      notes: emptyToNull(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(departments.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "department",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/departments");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
