"use server";

import { eq, asc, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { kits, kitItems, models, consumables, licenses } from "@/db/schema";

export async function listKits() {
  const user = await requireUser();
  return db
    .select({
      id: kits.id,
      name: kits.name,
      notes: kits.notes,
      itemCount: sql<number>`count(${kitItems.id})::int`,
    })
    .from(kits)
    .leftJoin(kitItems, eq(kitItems.kitId, kits.id))
    .where(eq(kits.companyId, user.companyId))
    .groupBy(kits.id)
    .orderBy(asc(kits.name));
}

export async function getKit(id: string) {
  await requireUser();
  const [row] = await db.select().from(kits).where(eq(kits.id, id)).limit(1);
  return row ?? null;
}

export async function listKitItems(kitId: string) {
  await requireUser();
  const items = await db.select().from(kitItems).where(eq(kitItems.kitId, kitId));

  const modelIds = items.filter((i) => i.itemType === "model").map((i) => i.itemId);
  const consumableIds = items.filter((i) => i.itemType === "consumable").map((i) => i.itemId);
  const licenseIds = items.filter((i) => i.itemType === "license").map((i) => i.itemId);

  const [modelRows, consumableRows, licenseRows] = await Promise.all([
    modelIds.length ? db.select({ id: models.id, name: models.name }).from(models).where(inArray(models.id, modelIds)) : [],
    consumableIds.length
      ? db.select({ id: consumables.id, name: consumables.name }).from(consumables).where(inArray(consumables.id, consumableIds))
      : [],
    licenseIds.length
      ? db.select({ id: licenses.id, name: licenses.name }).from(licenses).where(inArray(licenses.id, licenseIds))
      : [],
  ]);

  const nameById = new Map([...modelRows, ...consumableRows, ...licenseRows].map((r) => [r.id, r.name]));

  return items.map((item) => ({
    ...item,
    itemName: nameById.get(item.itemId) ?? "(deleted item)",
  }));
}

export type ActionState = { error?: string } | undefined;

export async function createKit(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "kits:*");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await db.insert(kits).values({ companyId: user.companyId, name, notes: emptyToNull(formData.get("notes")) });

  revalidatePath("/kits");
}

export async function updateKit(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "kits:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };

  await db
    .update(kits)
    .set({ name, notes: emptyToNull(formData.get("notes")) })
    .where(eq(kits.id, id));

  revalidatePath("/kits");
  revalidatePath(`/kits/${id}`);
}

export async function addKitItem(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "kits:*");

  const kitId = String(formData.get("kitId"));
  const itemType = String(formData.get("itemType") ?? "") as "model" | "consumable" | "license";
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number.parseInt(String(formData.get("quantity") ?? "1"), 10) || 1;

  if (!["model", "consumable", "license"].includes(itemType)) return { error: "Item type is required." };
  if (!itemId) return { error: "Select an item." };

  await db.insert(kitItems).values({ kitId, itemType, itemId, quantity });

  revalidatePath(`/kits/${kitId}`);
}

export async function removeKitItem(formData: FormData) {
  const user = await requireUser();
  requirePermission(user, "kits:*");

  const kitId = String(formData.get("kitId"));
  const kitItemId = String(formData.get("kitItemId"));

  await db.delete(kitItems).where(eq(kitItems.id, kitItemId));
  revalidatePath(`/kits/${kitId}`);
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
