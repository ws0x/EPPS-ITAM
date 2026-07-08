"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { departments } from "@/db/schema";

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

  await db.insert(departments).values({
    companyId: user.companyId,
    name,
    managerId: emptyToNull(formData.get("managerId")),
    defaultLocationId: emptyToNull(formData.get("defaultLocationId")),
    notes: emptyToNull(formData.get("notes")),
  });

  revalidatePath("/departments");
}

export async function updateDepartment(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await db
    .update(departments)
    .set({
      name,
      managerId: emptyToNull(formData.get("managerId")),
      defaultLocationId: emptyToNull(formData.get("defaultLocationId")),
      notes: emptyToNull(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(departments.id, id));

  revalidatePath("/departments");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
