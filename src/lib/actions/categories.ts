"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { categories, assetTagCounters } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";
import { currentAssetTagYear } from "@/lib/asset-tag";

export async function listCategories() {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.companyId, user.companyId))
    .orderBy(asc(categories.name));

  const year = currentAssetTagYear();
  const counters = await db
    .select({ categoryId: assetTagCounters.categoryId, lastSequence: assetTagCounters.lastSequence })
    .from(assetTagCounters)
    .where(eq(assetTagCounters.year, year));
  const countByCategory = new Map(counters.map((c) => [c.categoryId, c.lastSequence]));

  return rows.map((cat) => ({ ...cat, taggedThisYear: countByCategory.get(cat.id) ?? 0 }));
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
