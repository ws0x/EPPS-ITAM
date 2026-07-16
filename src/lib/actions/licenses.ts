"use server";

import { eq, asc, and, or, isNotNull, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { licenses, licenseSeats, categories, assets, users } from "@/db/schema";
import { logCreate, logUpdate } from "@/lib/audit";

export async function listLicenseCategories() {
  const user = await requireUser();
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "license")))
    .orderBy(asc(categories.name));
}

export async function listLicenses(search?: string) {
  const user = await requireUser();
  const trimmed = search?.trim();

  return db
    .select({
      id: licenses.id,
      name: licenses.name,
      categoryId: licenses.categoryId,
      manufacturerId: licenses.manufacturerId,
      licenseKey: licenses.licenseKey,
      seatsTotal: licenses.seatsTotal,
      seatsUsed: sql<number>`count(${licenseSeats.id})::int`,
      purchaseDate: licenses.purchaseDate,
      purchaseCost: licenses.purchaseCost,
      expiresAt: licenses.expiresAt,
      notes: licenses.notes,
    })
    .from(licenses)
    .leftJoin(
      licenseSeats,
      and(
        eq(licenseSeats.licenseId, licenses.id),
        or(isNotNull(licenseSeats.assignedToUserId), isNotNull(licenseSeats.assignedToAssetId)),
      ),
    )
    .where(
      and(
        eq(licenses.companyId, user.companyId),
        trimmed ? or(ilike(licenses.name, `%${trimmed}%`), ilike(licenses.licenseKey, `%${trimmed}%`)) : undefined,
      ),
    )
    .groupBy(licenses.id)
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

  const seatsTotalVal = toIntOrNull(formData.get("seatsTotal")) ?? 1;

  try {
    await db.transaction(async (tx) => {
      const [newLicense] = await tx
        .insert(licenses)
        .values({
          companyId: user.companyId,
          categoryId,
          name,
          manufacturerId: emptyToNull(formData.get("manufacturerId")),
          licenseKey: emptyToNull(formData.get("licenseKey")),
          seatsTotal: seatsTotalVal,
          purchaseDate: emptyToNull(formData.get("purchaseDate")),
          purchaseCost: emptyToNull(formData.get("purchaseCost")),
          expiresAt: emptyToNull(formData.get("expiresAt")),
          notes: emptyToNull(formData.get("notes")),
        })
        .returning();

      if (seatsTotalVal > 0) {
        const seatsToInsert = Array.from({ length: seatsTotalVal }).map(() => ({
          licenseId: newLicense.id,
        }));
        await tx.insert(licenseSeats).values(seatsToInsert);
      }

      await logCreate(tx, {
        companyId: user.companyId,
        actorUserId: user.id,
        targetType: "license",
        targetId: newLicense.id,
        row: newLicense,
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create license." };
  }

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

  const seatsTotalVal = toIntOrNull(formData.get("seatsTotal")) ?? 1;

  try {
    await db.transaction(async (tx) => {
      // 1. Get current seats
      const currentSeats = await tx
        .select()
        .from(licenseSeats)
        .where(eq(licenseSeats.licenseId, id));

      const assignedSeatsCount = currentSeats.filter(
        (s) => s.assignedToUserId || s.assignedToAssetId
      ).length;

      if (seatsTotalVal < assignedSeatsCount) {
        throw new Error(
          `Cannot shrink seats total to ${seatsTotalVal}. There are currently ${assignedSeatsCount} seats assigned.`
        );
      }

      const [before] = await tx.select().from(licenses).where(eq(licenses.id, id)).limit(1);
      if (!before) throw new Error("License not found.");

      // 2. Update license details
      const [after] = await tx
        .update(licenses)
        .set({
          name,
          categoryId,
          manufacturerId: emptyToNull(formData.get("manufacturerId")),
          licenseKey: emptyToNull(formData.get("licenseKey")),
          seatsTotal: seatsTotalVal,
          purchaseDate: emptyToNull(formData.get("purchaseDate")),
          purchaseCost: emptyToNull(formData.get("purchaseCost")),
          expiresAt: emptyToNull(formData.get("expiresAt")),
          notes: emptyToNull(formData.get("notes")),
          updatedAt: new Date(),
        })
        .where(eq(licenses.id, id))
        .returning();

      await logUpdate(tx, {
        companyId: user.companyId,
        actorUserId: user.id,
        targetType: "license",
        targetId: id,
        before,
        after,
      });

      // 3. Sync seat rows
      const diff = seatsTotalVal - currentSeats.length;
      if (diff > 0) {
        // Add seats
        const seatsToInsert = Array.from({ length: diff }).map(() => ({
          licenseId: id,
        }));
        await tx.insert(licenseSeats).values(seatsToInsert);
      } else if (diff < 0) {
        // Remove unassigned seats
        const unassignedSeats = currentSeats.filter(
          (s) => !s.assignedToUserId && !s.assignedToAssetId
        );
        const toDeleteCount = Math.abs(diff);
        const seatsToDelete = unassignedSeats.slice(0, toDeleteCount).map((s) => s.id);

        if (seatsToDelete.length > 0) {
          for (const seatId of seatsToDelete) {
            await tx.delete(licenseSeats).where(eq(licenseSeats.id, seatId));
          }
        }
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update license." };
  }

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

export async function getLicenseWithDetails(id: string) {
  const user = await requireUser();
  const [row] = await db
    .select({
      id: licenses.id,
      name: licenses.name,
      categoryId: licenses.categoryId,
      categoryName: categories.name,
      manufacturerId: licenses.manufacturerId,
      licenseKey: licenses.licenseKey,
      seatsTotal: licenses.seatsTotal,
      purchaseDate: licenses.purchaseDate,
      purchaseCost: licenses.purchaseCost,
      expiresAt: licenses.expiresAt,
      notes: licenses.notes,
    })
    .from(licenses)
    .innerJoin(categories, eq(licenses.categoryId, categories.id))
    .where(and(eq(licenses.id, id), eq(licenses.companyId, user.companyId)))
    .limit(1);
  return row ?? null;
}

export async function listLicenseSeatsWithDetails(licenseId: string) {
  await requireUser();
  const assignedUser = users;
  const assignedAsset = assets;

  return db
    .select({
      id: licenseSeats.id,
      licenseId: licenseSeats.licenseId,
      assignedToUserId: licenseSeats.assignedToUserId,
      assignedToUserFirstName: assignedUser.firstName,
      assignedToUserLastName: assignedUser.lastName,
      assignedToUserEmail: assignedUser.email,
      assignedToAssetId: licenseSeats.assignedToAssetId,
      assignedToAssetName: assignedAsset.name,
      assignedToAssetTag: assignedAsset.assetTag,
      notes: licenseSeats.notes,
      createdAt: licenseSeats.createdAt,
    })
    .from(licenseSeats)
    .leftJoin(assignedUser, eq(licenseSeats.assignedToUserId, assignedUser.id))
    .leftJoin(assignedAsset, eq(licenseSeats.assignedToAssetId, assignedAsset.id))
    .where(eq(licenseSeats.licenseId, licenseId))
    .orderBy(asc(licenseSeats.createdAt));
}
