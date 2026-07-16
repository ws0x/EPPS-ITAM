"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(eq(categories.companyId, user.companyId))
    .orderBy(asc(categories.name));
}

export type ActionState = { error?: string } | undefined;

export async function createCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "asset") as "asset" | "license" | "consumable";
  const codePrefix = String(formData.get("codePrefix") ?? "").trim().toUpperCase();

  if (!name) return { error: "Name is required." };
  if (!codePrefix) return { error: "Code prefix is required." };

  const requiresAcceptance = formData.get("requiresAcceptance") === "true";
  const eulaText = emptyToNull(formData.get("eulaText"));

  const [newCategory] = await db
    .insert(categories)
    .values({
      companyId: user.companyId,
      name,
      type,
      requiresAcceptance,
      eulaText,
      codePrefix,
      lastSequence: 0,
    })
    .returning();

  await logCreate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "category",
    targetId: newCategory.id,
    row: newCategory,
  });

  revalidatePath("/categories");
}

export async function updateCategory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const codePrefix = String(formData.get("codePrefix") ?? "").trim().toUpperCase();

  if (!name) return { error: "Name is required." };
  if (!codePrefix) return { error: "Code prefix is required." };

  const requiresAcceptance = formData.get("requiresAcceptance") === "true";
  const eulaText = emptyToNull(formData.get("eulaText"));

  const [before] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!before) return { error: "Category not found." };

  const [after] = await db
    .update(categories)
    .set({
      name,
      requiresAcceptance,
      eulaText,
      codePrefix,
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "category",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/categories");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
