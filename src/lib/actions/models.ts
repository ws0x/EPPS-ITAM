"use server";

import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { models, categories } from "@/db/schema";

export async function listModels() {
  const user = await requireUser();
  return db
    .select()
    .from(models)
    .where(eq(models.companyId, user.companyId))
    .orderBy(asc(models.name));
}

/** Only "asset"-type categories — Models back Assets specifically (Licenses/Consumables reference categories directly). */
export async function listAssetCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "asset")))
    .orderBy(asc(categories.name));
}

export type ActionState = { error?: string } | undefined;

export async function createModel(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  await db.insert(models).values({
    companyId: user.companyId,
    categoryId,
    manufacturerId: emptyToNull(formData.get("manufacturerId")),
    name,
    modelNumber: emptyToNull(formData.get("modelNumber")),
  });

  revalidatePath("/models");
}

export async function updateModel(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  await db
    .update(models)
    .set({
      name,
      categoryId,
      manufacturerId: emptyToNull(formData.get("manufacturerId")),
      modelNumber: emptyToNull(formData.get("modelNumber")),
      updatedAt: new Date(),
    })
    .where(eq(models.id, id));

  revalidatePath("/models");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
