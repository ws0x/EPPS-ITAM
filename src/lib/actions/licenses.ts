"use server";

import { eq, asc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { licenses, licenseSeats, categories } from "@/db/schema";

export async function listLicenseCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "license")))
    .orderBy(asc(categories.name));
}

export async function listLicenses() {
  const user = await requireUser();
  return db
    .select({
      id: licenses.id,
      name: licenses.name,
      categoryId: licenses.categoryId,
      manufacturerId: licenses.manufacturerId,
      licenseKey: licenses.licenseKey,
      seatsTotal: licenses.seatsTotal,
      seatsUsed: sql<number>`coalesce((select count(*) from ${licenseSeats} where ${licenseSeats.licenseId} = ${licenses.id}), 0)::int`,
      purchaseDate: licenses.purchaseDate,
      purchaseCost: licenses.purchaseCost,
      expiresAt: licenses.expiresAt,
      notes: licenses.notes,
    })
    .from(licenses)
    .where(eq(licenses.companyId, user.companyId))
    .orderBy(asc(licenses.name));
}

export type ActionState = { error?: string } | undefined;

export async function createLicense(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "licenses:*");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  await db.insert(licenses).values({
    companyId: user.companyId,
    categoryId,
    name,
    manufacturerId: emptyToNull(formData.get("manufacturerId")),
    licenseKey: emptyToNull(formData.get("licenseKey")),
    seatsTotal: toIntOrNull(formData.get("seatsTotal")) ?? 1,
    purchaseDate: emptyToNull(formData.get("purchaseDate")),
    purchaseCost: emptyToNull(formData.get("purchaseCost")),
    expiresAt: emptyToNull(formData.get("expiresAt")),
    notes: emptyToNull(formData.get("notes")),
  });

  revalidatePath("/licenses");
}

export async function updateLicense(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "licenses:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  await db
    .update(licenses)
    .set({
      name,
      categoryId,
      manufacturerId: emptyToNull(formData.get("manufacturerId")),
      licenseKey: emptyToNull(formData.get("licenseKey")),
      seatsTotal: toIntOrNull(formData.get("seatsTotal")) ?? 1,
      purchaseDate: emptyToNull(formData.get("purchaseDate")),
      purchaseCost: emptyToNull(formData.get("purchaseCost")),
      expiresAt: emptyToNull(formData.get("expiresAt")),
      notes: emptyToNull(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(licenses.id, id));

  revalidatePath("/licenses");
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}

function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const str = value ? String(value).trim() : "";
  if (!str) return null;
  const n = Number.parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
}
