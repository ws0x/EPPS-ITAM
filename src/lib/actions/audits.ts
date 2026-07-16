"use server";

import { eq, inArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import { assets } from "@/db/schema";
import { logEvent } from "@/lib/audit";

export type AuditActionState = { error?: string; success?: boolean } | undefined;

function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Confirms an asset's physical presence "as of now" - the actual workflow
 * Snipe-IT calls an "audit" (walk the floor, scan/confirm each item is where
 * the system thinks it is). Sets lastAuditAt to now and schedules the next
 * one; doesn't touch location/status/assignment, since a clean audit doesn't
 * imply anything changed about the item, only that it was seen.
 */
export async function runAssetAuditAction(_prevState: AuditActionState, formData: FormData): Promise<AuditActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:edit");

  const assetId = String(formData.get("assetId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;
  const intervalMonths = Number(formData.get("intervalMonths") ?? 12);

  if (!assetId) return { error: "Asset ID is required." };
  if (!Number.isInteger(intervalMonths) || intervalMonths <= 0) {
    return { error: "Audit interval must be a positive whole number of months." };
  }

  try {
    const now = new Date();
    const nextAuditDate = addMonths(now, intervalMonths);

    await db.transaction(async (tx) => {
      const [assetRow] = await tx
        .select({ id: assets.id, companyId: assets.companyId, assetTag: assets.assetTag })
        .from(assets)
        .where(eq(assets.id, assetId))
        .limit(1);

      if (!assetRow) throw new Error("Asset not found.");
      if (assetRow.companyId !== user.companyId) throw new Error("Unauthorized asset.");

      await tx
        .update(assets)
        .set({ lastAuditAt: now, nextAuditDate, updatedAt: now })
        .where(eq(assets.id, assetId));

      await logEvent(tx, {
        companyId: user.companyId,
        actorUserId: user.id,
        actionType: "asset.audited",
        targetType: "asset",
        targetId: assetId,
        meta: { assetTag: assetRow.assetTag, notes, nextAuditDate },
      });
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record audit." };
  }
}

export async function bulkRunAssetAuditAction(_prevState: AuditActionState, formData: FormData): Promise<AuditActionState> {
  const user = await requireUser();
  requirePermission(user, "assets:edit");

  const assetIdsStr = String(formData.get("assetIds") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;
  const intervalMonths = Number(formData.get("intervalMonths") ?? 12);

  if (!assetIdsStr) return { error: "Asset IDs are required." };
  const assetIds = assetIdsStr.split(",").map((id) => id.trim()).filter(Boolean);
  if (assetIds.length === 0) return { error: "No valid asset IDs provided." };
  if (!Number.isInteger(intervalMonths) || intervalMonths <= 0) {
    return { error: "Audit interval must be a positive whole number of months." };
  }

  try {
    const now = new Date();
    const nextAuditDate = addMonths(now, intervalMonths);

    await db.transaction(async (tx) => {
      const assetRows = await tx
        .select({ id: assets.id, companyId: assets.companyId, assetTag: assets.assetTag })
        .from(assets)
        .where(and(inArray(assets.id, assetIds), eq(assets.companyId, user.companyId)));

      if (assetRows.length !== assetIds.length) {
        throw new Error("One or more selected assets could not be found.");
      }

      await tx
        .update(assets)
        .set({ lastAuditAt: now, nextAuditDate, updatedAt: now })
        .where(inArray(assets.id, assetIds));

      for (const assetRow of assetRows) {
        await logEvent(tx, {
          companyId: user.companyId,
          actorUserId: user.id,
          actionType: "asset.audited",
          targetType: "asset",
          targetId: assetRow.id,
          meta: { assetTag: assetRow.assetTag, notes, nextAuditDate, isBulk: true },
        });
      }
    });

    revalidatePath("/assets");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to record bulk audit." };
  }
}
