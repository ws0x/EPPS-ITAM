"use server";

import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { assets, models, categories, statusLabels, locations, users } from "@/db/schema";

export async function listAssets() {
  const user = await requireUser();
  const assignedUser = users;

  return db
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
    .where(eq(assets.companyId, user.companyId))
    .orderBy(asc(assets.assetTag));
}

export async function getAsset(id: string) {
  await requireUser();
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

export type ActionState = { error?: string } | undefined;

export async function createAsset(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:*");

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const modelId = String(formData.get("modelId") ?? "");
  const statusId = String(formData.get("statusId") ?? "");
  if (!assetTag) return { error: "Asset tag is required." };
  if (!modelId) return { error: "Model is required." };
  if (!statusId) return { error: "Status is required." };

  const locationId = emptyToNull(formData.get("locationId"));

  try {
    await db.insert(assets).values({
      companyId: user.companyId,
      assetTag,
      modelId,
      statusId,
      name: emptyToNull(formData.get("name")),
      serial: emptyToNull(formData.get("serial")),
      locationId,
      rtdLocationId: locationId,
      departmentId: emptyToNull(formData.get("departmentId")),
      assignedToUserId: emptyToNull(formData.get("assignedToUserId")),
      purchaseDate: emptyToNull(formData.get("purchaseDate")),
      purchaseCost: emptyToNull(formData.get("purchaseCost")),
      warrantyMonths: toIntOrNull(formData.get("warrantyMonths")),
      notes: emptyToNull(formData.get("notes")),
      createdByUserId: user.id,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("assets_asset_tag_unique")) {
      return { error: "That asset tag is already in use." };
    }
    throw err;
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
    await db
      .update(assets)
      .set({
        assetTag,
        modelId,
        statusId,
        name: emptyToNull(formData.get("name")),
        serial: emptyToNull(formData.get("serial")),
        locationId: emptyToNull(formData.get("locationId")),
        departmentId: emptyToNull(formData.get("departmentId")),
        assignedToUserId: emptyToNull(formData.get("assignedToUserId")),
        purchaseDate: emptyToNull(formData.get("purchaseDate")),
        purchaseCost: emptyToNull(formData.get("purchaseCost")),
        warrantyMonths: toIntOrNull(formData.get("warrantyMonths")),
        notes: emptyToNull(formData.get("notes")),
        updatedAt: new Date(),
      })
      .where(eq(assets.id, id));
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
