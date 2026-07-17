"use server";

import { eq, asc, desc, and, ilike, inArray, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { accessories, accessoryAssignments, checkouts, categories, manufacturers, users } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listAccessoryCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "accessory")))
    .orderBy(asc(categories.name));
}

/**
 * qtyAvailable = qtyTotal - sum(quantity of assignments still open, i.e. the
 * paired checkouts row has no checkedInAt) - computed on read so it can
 * never drift out of sync with the assignment ledger, same reasoning as
 * depreciation's on-read book value.
 */
export async function listAccessories(
  search?: string,
  opts?: {
    page?: number;
    limit?: number;
    categoryIds?: string[];
    manufacturerIds?: string[];
    sort?: string;
    dir?: "asc" | "desc";
  },
) {
  const user = await requireUser();
  const trimmed = search?.trim();
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 50;
  const offset = (page - 1) * limit;

  const whereClause = and(
    eq(accessories.companyId, user.companyId),
    trimmed ? ilike(accessories.name, `%${trimmed}%`) : undefined,
    opts?.categoryIds?.length ? inArray(accessories.categoryId, opts.categoryIds) : undefined,
    opts?.manufacturerIds?.length ? inArray(accessories.manufacturerId, opts.manufacturerIds) : undefined,
  );

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accessories).where(whereClause);

  const openAssigned = sql<number>`coalesce(sum(${accessoryAssignments.quantity}) filter (where ${checkouts.checkedInAt} is null), 0)::int`;

  function sortColumnFor(sort?: string) {
    switch (sort) {
      case "quantity":
        return accessories.qtyTotal;
      default:
        return accessories.name;
    }
  }
  const orderBy = opts?.dir === "desc" ? desc(sortColumnFor(opts?.sort)) : asc(sortColumnFor(opts?.sort));

  const data = await db
    .select({
      id: accessories.id,
      companyId: accessories.companyId,
      categoryId: accessories.categoryId,
      manufacturerId: accessories.manufacturerId,
      name: accessories.name,
      modelNumber: accessories.modelNumber,
      qtyTotal: accessories.qtyTotal,
      minQty: accessories.minQty,
      purchaseCost: accessories.purchaseCost,
      notes: accessories.notes,
      qtyAssigned: openAssigned,
    })
    .from(accessories)
    .leftJoin(accessoryAssignments, eq(accessoryAssignments.accessoryId, accessories.id))
    .leftJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, accessoryAssignments.id), eq(checkouts.checkoutableType, "accessory_assignment")),
    )
    .where(whereClause)
    .groupBy(accessories.id)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: data.map((row) => ({ ...row, qtyAvailable: row.qtyTotal - row.qtyAssigned })),
    totalCount: Number(count),
    page,
    limit,
    totalPages: Math.ceil(Number(count) / limit),
  };
}

export async function getAccessoryWithDetails(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: accessories.id,
      name: accessories.name,
      categoryId: accessories.categoryId,
      categoryName: categories.name,
      manufacturerId: accessories.manufacturerId,
      manufacturerName: manufacturers.name,
      modelNumber: accessories.modelNumber,
      qtyTotal: accessories.qtyTotal,
      minQty: accessories.minQty,
      purchaseCost: accessories.purchaseCost,
      notes: accessories.notes,
    })
    .from(accessories)
    .innerJoin(categories, eq(accessories.categoryId, categories.id))
    .leftJoin(manufacturers, eq(accessories.manufacturerId, manufacturers.id))
    .where(and(eq(accessories.id, id), eq(accessories.companyId, user.companyId)))
    .limit(1);
  if (!row) return null;

  const openAssigned = await db
    .select({ total: sql<number>`coalesce(sum(${accessoryAssignments.quantity}), 0)::int` })
    .from(accessoryAssignments)
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, accessoryAssignments.id), eq(checkouts.checkoutableType, "accessory_assignment")),
    )
    .where(and(eq(accessoryAssignments.accessoryId, id), isNull(checkouts.checkedInAt)));

  return { ...row, qtyAssigned: openAssigned[0]?.total ?? 0, qtyAvailable: row.qtyTotal - (openAssigned[0]?.total ?? 0) };
}

/** Full assignment history (open and returned) for one accessory, newest first. */
export async function listAccessoryAssignments(accessoryId: string) {
  await requireUser();
  return db
    .select({
      id: accessoryAssignments.id,
      assignedToUserId: accessoryAssignments.assignedToUserId,
      assignedToFirstName: users.firstName,
      assignedToLastName: users.lastName,
      assignedToEmail: users.email,
      quantity: accessoryAssignments.quantity,
      checkedOutAt: checkouts.checkedOutAt,
      checkedInAt: checkouts.checkedInAt,
      notes: checkouts.notes,
    })
    .from(accessoryAssignments)
    .innerJoin(users, eq(accessoryAssignments.assignedToUserId, users.id))
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, accessoryAssignments.id), eq(checkouts.checkoutableType, "accessory_assignment")),
    )
    .where(eq(accessoryAssignments.accessoryId, accessoryId))
    .orderBy(sql`${checkouts.checkedOutAt} desc`);
}

export type ActionState = { error?: string } | undefined;

export async function createAccessory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "accessories:*");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [newAccessory] = await db
    .insert(accessories)
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
    targetType: "accessory",
    targetId: newAccessory.id,
    row: newAccessory,
  });

  revalidatePath("/accessories");
}

export async function updateAccessory(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "accessories:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [before] = await db.select().from(accessories).where(eq(accessories.id, id)).limit(1);
  if (!before) return { error: "Accessory not found." };

  const [after] = await db
    .update(accessories)
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
    .where(eq(accessories.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "accessory",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/accessories");
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
