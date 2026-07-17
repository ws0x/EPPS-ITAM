"use server";

import { eq, asc, desc, and, ilike, inArray, sql, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { components, componentAssignments, checkouts, categories, manufacturers, assets } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listComponentCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "component")))
    .orderBy(asc(categories.name));
}

/** Same on-read available-quantity math as accessories - see accessories.ts. */
export async function listComponents(
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
    eq(components.companyId, user.companyId),
    trimmed ? ilike(components.name, `%${trimmed}%`) : undefined,
    opts?.categoryIds?.length ? inArray(components.categoryId, opts.categoryIds) : undefined,
    opts?.manufacturerIds?.length ? inArray(components.manufacturerId, opts.manufacturerIds) : undefined,
  );

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(components).where(whereClause);

  const openAssigned = sql<number>`coalesce(sum(${componentAssignments.quantity}) filter (where ${checkouts.checkedInAt} is null), 0)::int`;

  function sortColumnFor(sort?: string) {
    switch (sort) {
      case "quantity":
        return components.qtyTotal;
      default:
        return components.name;
    }
  }
  const orderBy = opts?.dir === "desc" ? desc(sortColumnFor(opts?.sort)) : asc(sortColumnFor(opts?.sort));

  const data = await db
    .select({
      id: components.id,
      companyId: components.companyId,
      categoryId: components.categoryId,
      manufacturerId: components.manufacturerId,
      name: components.name,
      modelNumber: components.modelNumber,
      qtyTotal: components.qtyTotal,
      minQty: components.minQty,
      purchaseCost: components.purchaseCost,
      notes: components.notes,
      qtyAssigned: openAssigned,
    })
    .from(components)
    .leftJoin(componentAssignments, eq(componentAssignments.componentId, components.id))
    .leftJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, componentAssignments.id), eq(checkouts.checkoutableType, "component_assignment")),
    )
    .where(whereClause)
    .groupBy(components.id)
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

export async function getComponentWithDetails(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: components.id,
      name: components.name,
      categoryId: components.categoryId,
      categoryName: categories.name,
      manufacturerId: components.manufacturerId,
      manufacturerName: manufacturers.name,
      modelNumber: components.modelNumber,
      qtyTotal: components.qtyTotal,
      minQty: components.minQty,
      purchaseCost: components.purchaseCost,
      notes: components.notes,
    })
    .from(components)
    .innerJoin(categories, eq(components.categoryId, categories.id))
    .leftJoin(manufacturers, eq(components.manufacturerId, manufacturers.id))
    .where(and(eq(components.id, id), eq(components.companyId, user.companyId)))
    .limit(1);
  if (!row) return null;

  const openAssigned = await db
    .select({ total: sql<number>`coalesce(sum(${componentAssignments.quantity}), 0)::int` })
    .from(componentAssignments)
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, componentAssignments.id), eq(checkouts.checkoutableType, "component_assignment")),
    )
    .where(and(eq(componentAssignments.componentId, id), isNull(checkouts.checkedInAt)));

  return { ...row, qtyAssigned: openAssigned[0]?.total ?? 0, qtyAvailable: row.qtyTotal - (openAssigned[0]?.total ?? 0) };
}

/** Full assignment history (open and returned) for one component, newest first. */
export async function listComponentAssignments(componentId: string) {
  await requireUser();
  return db
    .select({
      id: componentAssignments.id,
      assignedToAssetId: componentAssignments.assignedToAssetId,
      assignedToAssetTag: assets.assetTag,
      assignedToAssetName: assets.name,
      quantity: componentAssignments.quantity,
      checkedOutAt: checkouts.checkedOutAt,
      checkedInAt: checkouts.checkedInAt,
      notes: checkouts.notes,
    })
    .from(componentAssignments)
    .innerJoin(assets, eq(componentAssignments.assignedToAssetId, assets.id))
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, componentAssignments.id), eq(checkouts.checkoutableType, "component_assignment")),
    )
    .where(eq(componentAssignments.componentId, componentId))
    .orderBy(sql`${checkouts.checkedOutAt} desc`);
}

/** Currently-installed (open) component assignments for one asset, for the asset detail page. */
export async function listInstalledComponentsForAsset(assetId: string) {
  await requireUser();
  return db
    .select({
      id: componentAssignments.id,
      componentId: components.id,
      componentName: components.name,
      quantity: componentAssignments.quantity,
      checkedOutAt: checkouts.checkedOutAt,
    })
    .from(componentAssignments)
    .innerJoin(components, eq(componentAssignments.componentId, components.id))
    .innerJoin(
      checkouts,
      and(eq(checkouts.checkoutableId, componentAssignments.id), eq(checkouts.checkoutableType, "component_assignment")),
    )
    .where(and(eq(componentAssignments.assignedToAssetId, assetId), isNull(checkouts.checkedInAt)))
    .orderBy(sql`${checkouts.checkedOutAt} desc`);
}

export type ActionState = { error?: string } | undefined;

export async function createComponent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "components:*");

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [newComponent] = await db
    .insert(components)
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
    targetType: "component",
    targetId: newComponent.id,
    row: newComponent,
  });

  revalidatePath("/components");
}

export async function updateComponent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "components:*");

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!name) return { error: "Name is required." };
  if (!categoryId) return { error: "Category is required." };

  const [before] = await db.select().from(components).where(eq(components.id, id)).limit(1);
  if (!before) return { error: "Component not found." };

  const [after] = await db
    .update(components)
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
    .where(eq(components.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "component",
    targetId: id,
    before,
    after,
  });

  revalidatePath("/components");
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
