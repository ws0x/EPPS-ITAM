"use server";

import { eq, asc, desc, and, or, ilike, inArray, gte, lte, sql, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { assets, models, categories, statusLabels, locations, users } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

type AssetFilterParams = {
  search?: string;
  statusId?: string;
  categoryId?: string;
  locationId?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
};

/** Shared by listAssets, the CSV export route, and the PDF export route so the filter set stays in sync everywhere. */
function buildAssetsWhereClause(companyId: string, params?: AssetFilterParams): SQL | undefined {
  const search = params?.search?.trim();

  let whereClause: SQL | undefined = eq(assets.companyId, companyId);
  if (search) {
    whereClause = and(
      whereClause,
      or(
        ilike(assets.assetTag, `%${search}%`),
        ilike(assets.name, `%${search}%`),
        ilike(assets.serial, `%${search}%`),
        ilike(models.name, `%${search}%`),
        ilike(categories.name, `%${search}%`)
      )
    );
  }

  const statusIds = params?.statusId?.split(",").filter(Boolean) ?? [];
  const categoryIds = params?.categoryId?.split(",").filter(Boolean) ?? [];
  const locationIds = params?.locationId?.split(",").filter(Boolean) ?? [];

  if (statusIds.length === 1) {
    whereClause = and(whereClause, eq(assets.statusId, statusIds[0]));
  } else if (statusIds.length > 1) {
    whereClause = and(whereClause, inArray(assets.statusId, statusIds));
  }
  if (categoryIds.length === 1) {
    whereClause = and(whereClause, eq(models.categoryId, categoryIds[0]));
  } else if (categoryIds.length > 1) {
    whereClause = and(whereClause, inArray(models.categoryId, categoryIds));
  }
  if (locationIds.length === 1) {
    whereClause = and(whereClause, eq(assets.locationId, locationIds[0]));
  } else if (locationIds.length > 1) {
    whereClause = and(whereClause, inArray(assets.locationId, locationIds));
  }
  if (params?.purchaseDateFrom) {
    whereClause = and(whereClause, gte(assets.purchaseDate, params.purchaseDateFrom));
  }
  if (params?.purchaseDateTo) {
    whereClause = and(whereClause, lte(assets.purchaseDate, params.purchaseDateTo));
  }

  return whereClause;
}

/** Same filtered result set as listAssets, but unpaginated - for CSV/PDF export and reports. */
export async function listAssetsForExport(params?: AssetFilterParams) {
  const user = await requireUser();
  const assignedUser = users;
  const whereClause = buildAssetsWhereClause(user.companyId, params);

  return db
    .select({
      assetTag: assets.assetTag,
      name: assets.name,
      serial: assets.serial,
      category: categories.name,
      model: models.name,
      status: statusLabels.name,
      location: locations.name,
      assignedToFirstName: assignedUser.firstName,
      assignedToLastName: assignedUser.lastName,
      assignedToEmail: assignedUser.email,
      purchaseDate: assets.purchaseDate,
      purchaseCost: assets.purchaseCost,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .leftJoin(assignedUser, eq(assets.assignedToUserId, assignedUser.id))
    .where(whereClause)
    .orderBy(asc(assets.assetTag));
}

export async function listAssets(params?: {
  page?: number;
  limit?: number;
  search?: string;
  statusId?: string;
  categoryId?: string;
  locationId?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  sort?: string;
  dir?: "asc" | "desc";
}) {
  const user = await requireUser();
  const assignedUser = users;

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;

  const offset = (page - 1) * limit;

  const whereClause = buildAssetsWhereClause(user.companyId, params);

  function sortColumnFor(sort?: string) {
    switch (sort) {
      case "name":
        return assets.name;
      case "category":
        return categories.name;
      case "model":
        return models.name;
      case "status":
        return statusLabels.name;
      case "location":
        return locations.name;
      default:
        return assets.assetTag;
    }
  }
  const orderBy = params?.dir === "desc" ? desc(sortColumnFor(params?.sort)) : asc(sortColumnFor(params?.sort));

  // 1. Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .where(whereClause);

  // 2. Get paginated data
  const data = await db
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      serial: assets.serial,
      modelName: models.name,
      categoryName: categories.name,
      statusName: statusLabels.name,
      statusColor: statusLabels.color,
      locationName: locations.name,
      assignedToFirstName: assignedUser.firstName,
      assignedToLastName: assignedUser.lastName,
      assignedToEmail: assignedUser.email,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .leftJoin(assignedUser, eq(assets.assignedToUserId, assignedUser.id))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    totalCount: Number(count),
    page,
    limit,
    totalPages: Math.ceil(Number(count) / limit),
  };
}

export async function getAsset(id: string) {
  await requireUser();
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

export async function getAssetWithDetails(id: string) {
  const user = await requireUser();
  const assignedUser = users;

  const [row] = await db
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      serial: assets.serial,
      modelId: assets.modelId,
      modelName: models.name,
      categoryId: models.categoryId,
      categoryName: categories.name,
      statusId: assets.statusId,
      statusName: statusLabels.name,
      statusColor: statusLabels.color,
      locationId: assets.locationId,
      locationName: locations.name,
      rtdLocationId: assets.rtdLocationId,
      departmentId: assets.departmentId,
      purchaseDate: assets.purchaseDate,
      purchaseCost: assets.purchaseCost,
      warrantyMonths: assets.warrantyMonths,
      notes: assets.notes,
      assignedToUserId: assets.assignedToUserId,
      assignedToFirstName: assignedUser.firstName,
      assignedToLastName: assignedUser.lastName,
      assignedToEmail: assignedUser.email,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(categories, eq(models.categoryId, categories.id))
    .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
    .leftJoin(locations, eq(assets.locationId, locations.id))
    .leftJoin(assignedUser, eq(assets.assignedToUserId, assignedUser.id))
    .where(and(eq(assets.id, id), eq(assets.companyId, user.companyId)))
    .limit(1);

  return row ?? null;
}

export type ActionState = { error?: string } | undefined;

export async function createAsset(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const modelId = String(formData.get("modelId") ?? "");
  const statusId = String(formData.get("statusId") ?? "");
  if (!modelId) return { error: "Model is required." };
  if (!statusId) return { error: "Status is required." };

  const locationId = emptyToNull(formData.get("locationId"));

  try {
    const [modelRow] = await db
      .select({ categoryId: models.categoryId })
      .from(models)
      .where(eq(models.id, modelId))
      .limit(1);

    if (!modelRow) return { error: "Model not found." };

    await db.transaction(async (tx) => {
      // Lock the category row to prevent duplicate sequence numbers under concurrency
      const [catRow] = await tx
        .select({ id: categories.id, codePrefix: categories.codePrefix, lastSequence: categories.lastSequence })
        .from(categories)
        .where(eq(categories.id, modelRow.categoryId))
        .for("update");

      if (!catRow) throw new Error("Model category not found.");

      const nextSequence = catRow.lastSequence + 1;
      const prefix = catRow.codePrefix || "ITAM";
      const generatedTag = `${prefix}-${String(nextSequence).padStart(4, "0")}`;

      // Update the sequence on the category
      await tx
        .update(categories)
        .set({ lastSequence: nextSequence })
        .where(eq(categories.id, catRow.id));

      const [newAsset] = await tx
        .insert(assets)
        .values({
          companyId: user.companyId,
          assetTag: generatedTag,
          modelId,
          statusId,
          name: emptyToNull(formData.get("name")),
          serial: emptyToNull(formData.get("serial")),
          locationId,
          rtdLocationId: locationId,
          departmentId: emptyToNull(formData.get("departmentId")),
          purchaseDate: emptyToNull(formData.get("purchaseDate")),
          purchaseCost: emptyToNull(formData.get("purchaseCost")),
          warrantyMonths: toIntOrNull(formData.get("warrantyMonths")),
          notes: emptyToNull(formData.get("notes")),
          createdByUserId: user.id,
        })
        .returning();

      await logCreate(tx, {
        companyId: user.companyId,
        actorUserId: user.id,
        targetType: "asset",
        targetId: newAsset.id,
        row: newAsset,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("assets_asset_tag_unique")) {
      return { error: "Generated asset tag is already in use. Please try again." };
    }
    return { error: err instanceof Error ? err.message : "Failed to create asset." };
  }

  revalidatePath("/assets");
  redirect("/assets");
}

export async function updateAsset(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const id = String(formData.get("id"));
  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const modelId = String(formData.get("modelId") ?? "");
  const statusId = String(formData.get("statusId") ?? "");
  if (!assetTag) return { error: "Asset tag is required." };
  if (!modelId) return { error: "Model is required." };
  if (!statusId) return { error: "Status is required." };

  try {
    const [before] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (!before) return { error: "Asset not found." };

    await db.transaction(async (tx) => {
      const [after] = await tx
        .update(assets)
        .set({
          assetTag,
          modelId,
          statusId,
          name: emptyToNull(formData.get("name")),
          serial: emptyToNull(formData.get("serial")),
          locationId: emptyToNull(formData.get("locationId")),
          departmentId: emptyToNull(formData.get("departmentId")),
          purchaseDate: emptyToNull(formData.get("purchaseDate")),
          purchaseCost: emptyToNull(formData.get("purchaseCost")),
          warrantyMonths: toIntOrNull(formData.get("warrantyMonths")),
          notes: emptyToNull(formData.get("notes")),
          updatedAt: new Date(),
        })
        .where(eq(assets.id, id))
        .returning();

      await logUpdate(tx, {
        companyId: user.companyId,
        actorUserId: user.id,
        targetType: "asset",
        targetId: id,
        before,
        after,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("assets_asset_tag_unique")) {
      return { error: "That asset tag is already in use." };
    }
    throw err;
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
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
