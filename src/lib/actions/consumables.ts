"use server";

import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { consumables, consumableAssignments, categories, manufacturers, users } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listConsumableCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "consumable")))
    .orderBy(asc(categories.name));
}

export async function listConsumables() {
  const user = await requireUser();
  return db
    .select()
    .from(consumables)
    .where(eq(consumables.companyId, user.companyId))
    .orderBy(asc(consumables.name));
}

export async function getConsumableWithDetails(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: consumables.id,
      name: consumables.name,
      categoryId: consumables.categoryId,
      categoryName: categories.name,
      manufacturerId: consumables.manufacturerId,
      manufacturerName: manufacturers.name,
      modelNumber: consumables.modelNumber,
      qtyTotal: consumables.qtyTotal,
      minQty: consumables.minQty,
      purchaseCost: consumables.purchaseCost,
      notes: consumables.notes,
    })
    .from(consumables)
    .innerJoin(categories, eq(consumables.categoryId, categories.id))
    .leftJoin(manufacturers, eq(consumables.manufacturerId, manufacturers.id))
    .where(and(eq(consumables.id, id), eq(consumables.companyId, user.companyId)))
    .limit(1);
  return row ?? null;
}

/**
 * Consumables have no check-in lifecycle — a unit assigned to someone is
 * consumed, not returned — so this is a plain distribution ledger (who got
 * how much, when), not a "currently holds" view like license seats.
 */
export async function listConsumableAssignments(consumableId: string) {
  await requireUser();
  return db
    .select({
      id: consumableAssignments.id,
      assignedToUserId: consumableAssignments.assignedToUserId,
      assignedToFirstName: users.firstName,
      assignedToLastName: users.lastName,
      assignedToEmail: users.email,
      quantity: consumableAssignments.quantity,
      createdAt: consumableAssignments.createdAt,
    })
    .from(consumableAssignments)
    .innerJoin(users, eq(consumableAssignments.assignedToUserId, users.id))
    .where(eq(consumableAssignments.consumableId, consumableId))
    .orderBy(asc(consumableAssignments.createdAt));
}

export type ActionState = { error?: string } | undefined;

export async function createConsumable(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "consumables:*");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [newConsumable] = await db
    .insert(consumables)
    .values({
      companyId: user.companyId,
      categoryId,
      name,
      manufacturerId: emptyToNull(formData.get("manufacturerId")),
      modelNumber: emptyToNull(formData.get("modelNumber")),
      qtyTotal: toIntOrNull(formData.get("qtyTotal")) ?? 0,
      minQty: toIntOrNull(formData.get("minQty")) ?? 0,
      purchaseCost: emptyToNull(formData.get("purchaseCost")),
      notes: emptyToNull(formData.get("notes")),
    })
    .returning();

  await logCreate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "consumable",
    targetId: newConsumable.id,
    row: newConsumable,
  });

  revalidatePath("/consumables");
}

export async function updateConsumable(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "consumables:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [before] = await db.select().from(consumables).where(eq(consumables.id, id)).limit(1);
  if (!before) return { error: "Consumable not found." };

  const [after] = await db
    .update(consumables)
    .set({
      name,
      categoryId,
      manufacturerId: emptyToNull(formData.get("manufacturerId")),
      modelNumber: emptyToNull(formData.get("modelNumber")),
      qtyTotal: toIntOrNull(formData.get("qtyTotal")) ?? 0,
      minQty: toIntOrNull(formData.get("minQty")) ?? 0,
      purchaseCost: emptyToNull(formData.get("purchaseCost")),
      notes: emptyToNull(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(consumables.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "consumable",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/consumables");
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
