"use server";

import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import {
  assets,
  checkouts,
  acceptances,
  auditLogs,
  statusLabels,
  users,
  models,
  categories,
  licenseSeats,
  licenses,
  consumableAssignments,
  consumables,
  kits,
  requests,
  roles,
} from "@/db/schema";
import { executeKitCheckout } from "@/lib/kit-checkout";
import crypto from "node:crypto";

export type CheckoutActionState = { error?: string; success?: boolean; pendingApproval?: boolean } | undefined;

/**
 * Helper to find or fallback status label IDs
 */
async function getStatusLabelId(companyId: string, name: string, deployableOnly = true): Promise<string> {
  let [label] = await db
    .select({ id: statusLabels.id })
    .from(statusLabels)
    .where(and(eq(statusLabels.companyId, companyId), eq(statusLabels.name, name)))
    .limit(1);

  if (!label && deployableOnly) {
    // Fallback to any deployable status label
    [label] = await db
      .select({ id: statusLabels.id })
      .from(statusLabels)
      .where(and(eq(statusLabels.companyId, companyId), eq(statusLabels.deployable, true)))
      .limit(1);
  }

  if (!label) {
    throw new Error(`Could not find a suitable status label for '${name}'`);
  }
  return label.id;
}

/**
 * Check out a serialized asset to a user
 */
export async function checkoutAssetAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "assets:checkout");

  const assetId = String(formData.get("assetId") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const expectedCheckinAtStr = formData.get("expectedCheckinAt") ? String(formData.get("expectedCheckinAt")) : null;
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;
  const requestId = formData.get("requestId") ? String(formData.get("requestId")) : null;

  if (!assetId) return { error: "Asset ID is required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };

  const expectedCheckinAt = expectedCheckinAtStr ? new Date(expectedCheckinAtStr) : null;

  // IT checkout policy: every IT-staff-initiated direct checkout (technician
  // or admin) is approval-gated to the IT Manager. The IT Manager's own
  // checkouts stay instant - they're the approval authority for this gate,
  // requiring their own sign-off would be circular.
  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      // Find the IT Manager for this company
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await db.transaction(async (tx) => {
        // Validate asset availability
        const [assetData] = await tx
          .select({ id: assets.id, assignedToUserId: assets.assignedToUserId })
          .from(assets)
          .where(eq(assets.id, assetId))
          .limit(1);

        if (!assetData) throw new Error("Asset not found.");
        if (assetData.assignedToUserId) throw new Error("Asset is already checked out.");

        // Insert Checkout Request
        const [newReq] = await tx
          .insert(requests)
          .values({
            companyId: currentUser.companyId,
            requesterUserId: currentUser.id,
            approverUserId,
            checkoutAssetId: assetId,
            checkoutTargetUserId: assignedToUserId,
            expectedCheckinAt,
            quantity: 1,
            status: "pending_approval",
            justification: notes,
            approvalTokenHash: tokenHash,
          })
          .returning({ id: requests.id });

        // Log request create
        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "request.create_checkout",
          targetType: "request",
          targetId: newReq.id,
          meta: {
            checkoutAssetId: assetId,
            checkoutTargetUserId: assignedToUserId,
            approverUserId,
          },
        });
      });

      revalidatePath("/assets");
      revalidatePath(`/assets/${assetId}`);
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit checkout approval request." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Get the asset and join categories to check acceptance requirement
      const [assetData] = await tx
        .select({
          id: assets.id,
          companyId: assets.companyId,
          assignedToUserId: assets.assignedToUserId,
          requiresAcceptance: categories.requiresAcceptance,
          eulaText: categories.eulaText,
        })
        .from(assets)
        .innerJoin(models, eq(assets.modelId, models.id))
        .innerJoin(categories, eq(models.categoryId, categories.id))
        .where(eq(assets.id, assetId))
        .limit(1);

      if (!assetData) throw new Error("Asset not found.");
      if (assetData.assignedToUserId) throw new Error("Asset is already checked out.");

      // Verify asset belongs to company
      if (assetData.companyId !== currentUser.companyId) throw new Error("Unauthorized asset.");

      // 2. Find target user
      const [targetUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, assignedToUserId))
        .limit(1);

      if (!targetUser) throw new Error("Target user not found.");

      // 3. Update asset assignment & status to 'Deployed'
      const deployedStatusId = await getStatusLabelId(currentUser.companyId, "Deployed");
      await tx
        .update(assets)
        .set({
          assignedToUserId,
          statusId: deployedStatusId,
          locationId: assetData.requiresAcceptance ? null : targetUser.locationId,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId));

      // 4. Create checkout log
      const [checkoutRow] = await tx
        .insert(checkouts)
        .values({
          checkoutableType: "asset",
          checkoutableId: assetId,
          assignedToUserId,
          checkedOutByUserId: currentUser.id,
          expectedCheckinAt,
          notes,
        })
        .returning({ id: checkouts.id });

      // 5. Create acceptance prompt if required by category
      if (assetData.requiresAcceptance) {
        await tx.insert(acceptances).values({
          checkoutId: checkoutRow.id,
          status: "pending",
          eulaSnapshot: assetData.eulaText || "Default EULA",
        });
      }

      // 6. Transition request to fulfilled if requestId is provided
      if (requestId) {
        await tx
          .update(requests)
          .set({
            status: "fulfilled",
            fulfilledCheckoutId: checkoutRow.id,
            updatedAt: new Date(),
          })
          .where(eq(requests.id, requestId));
      }

      // 7. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "asset.checkout",
        targetType: "asset",
        targetId: assetId,
        meta: {
          assignedToUserId,
          notes,
          expectedCheckinAt: expectedCheckinAtStr,
          checkoutId: checkoutRow.id,
          requestId,
        },
      });
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    revalidatePath("/requests");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkout asset." };
  }
}

/**
 * Check in a serialized asset back to inventory
 */
export async function checkinAssetAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "assets:checkin");

  const assetId = String(formData.get("assetId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!assetId) return { error: "Asset ID is required." };

  try {
    await db.transaction(async (tx) => {
      // 1. Get the asset and current assignment
      const [assetData] = await tx
        .select()
        .from(assets)
        .where(eq(assets.id, assetId))
        .limit(1);

      if (!assetData) throw new Error("Asset not found.");
      if (!assetData.assignedToUserId) throw new Error("Asset is not checked out.");
      if (assetData.companyId !== currentUser.companyId) throw new Error("Unauthorized asset.");

      // 2. Find active checkout record
      const [activeCheckout] = await tx
        .select()
        .from(checkouts)
        .where(
          and(
            eq(checkouts.checkoutableId, assetId),
            eq(checkouts.checkoutableType, "asset"),
            isNull(checkouts.checkedInAt)
          )
        )
        .limit(1);

      // 3. Update asset back to "Ready to Deploy"
      const readyToDeployStatusId = await getStatusLabelId(currentUser.companyId, "Ready to Deploy");
      await tx
        .update(assets)
        .set({
          assignedToUserId: null,
          statusId: readyToDeployStatusId,
          locationId: assetData.rtdLocationId, // return to default location
          updatedAt: new Date(),
        })
        .where(eq(assets.id, assetId));

      // 4. Close checkout log
      if (activeCheckout) {
        await tx
          .update(checkouts)
          .set({
            checkedInAt: new Date(),
            checkedInByUserId: currentUser.id,
            notes: notes || activeCheckout.notes,
          })
          .where(eq(checkouts.id, activeCheckout.id));
      }

      // 5. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "asset.checkin",
        targetType: "asset",
        targetId: assetId,
        meta: {
          notes,
          previousAssigneeId: assetData.assignedToUserId,
        },
      });
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkin asset." };
  }
}

/**
 * Check out a specific license seat to a user or asset
 */
export async function checkoutLicenseSeatAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "licenses:*"); // Technicians or managers handle licenses

  const seatId = String(formData.get("seatId") ?? "");
  const assignedToUserId = formData.get("assignedToUserId") ? String(formData.get("assignedToUserId")) : null;
  const assignedToAssetId = formData.get("assignedToAssetId") ? String(formData.get("assignedToAssetId")) : null;
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!seatId) return { error: "License seat ID is required." };
  if (!assignedToUserId && !assignedToAssetId) {
    return { error: "Either a User or an Asset is required for license checkout." };
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Verify seat exists and is unassigned
      const [seat] = await tx
        .select()
        .from(licenseSeats)
        .where(eq(licenseSeats.id, seatId))
        .limit(1);

      if (!seat) throw new Error("License seat not found.");
      if (seat.assignedToUserId || seat.assignedToAssetId) {
        throw new Error("License seat is already assigned.");
      }

      // Verify license belongs to company
      const [lic] = await tx
        .select()
        .from(licenses)
        .where(eq(licenses.id, seat.licenseId))
        .limit(1);

      if (!lic || lic.companyId !== currentUser.companyId) {
        throw new Error("Unauthorized license seat.");
      }

      // 2. Update license seat
      await tx
        .update(licenseSeats)
        .set({
          assignedToUserId,
          assignedToAssetId,
          notes,
        })
        .where(eq(licenseSeats.id, seatId));

      // 3. Create checkout log
      const [checkoutRow] = await tx
        .insert(checkouts)
        .values({
          checkoutableType: "license_seat",
          checkoutableId: seatId,
          assignedToUserId: assignedToUserId || currentUser.id, // standard tracking fallback
          checkedOutByUserId: currentUser.id,
          notes,
        })
        .returning({ id: checkouts.id });

      // 4. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "license.checkout_seat",
        targetType: "license_seat",
        targetId: seatId,
        meta: {
          assignedToUserId,
          assignedToAssetId,
          notes,
          checkoutId: checkoutRow.id,
        },
      });
    });

    revalidatePath("/licenses");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkout license seat." };
  }
}

/**
 * Check in a license seat (free it up)
 */
export async function checkinLicenseSeatAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "licenses:*");

  const seatId = String(formData.get("seatId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!seatId) return { error: "License seat ID is required." };

  try {
    await db.transaction(async (tx) => {
      // 1. Verify seat exists and is assigned
      const [seat] = await tx
        .select()
        .from(licenseSeats)
        .where(eq(licenseSeats.id, seatId))
        .limit(1);

      if (!seat) throw new Error("License seat not found.");
      if (!seat.assignedToUserId && !seat.assignedToAssetId) {
        throw new Error("License seat is not assigned.");
      }

      // Verify license belongs to company
      const [lic] = await tx
        .select()
        .from(licenses)
        .where(eq(licenses.id, seat.licenseId))
        .limit(1);

      if (!lic || lic.companyId !== currentUser.companyId) {
        throw new Error("Unauthorized license seat.");
      }

      // 2. Find active checkout record
      const [activeCheckout] = await tx
        .select()
        .from(checkouts)
        .where(
          and(
            eq(checkouts.checkoutableId, seatId),
            eq(checkouts.checkoutableType, "license_seat"),
            isNull(checkouts.checkedInAt)
          )
        )
        .limit(1);

      // 3. Clear assignment on seat
      await tx
        .update(licenseSeats)
        .set({
          assignedToUserId: null,
          assignedToAssetId: null,
          notes: null,
        })
        .where(eq(licenseSeats.id, seatId));

      // 4. Close checkout log
      if (activeCheckout) {
        await tx
          .update(checkouts)
          .set({
            checkedInAt: new Date(),
            checkedInByUserId: currentUser.id,
            notes: notes || activeCheckout.notes,
          })
          .where(eq(checkouts.id, activeCheckout.id));
      }

      // 5. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "license.checkin_seat",
        targetType: "license_seat",
        targetId: seatId,
        meta: {
          notes,
          previousAssigneeUserId: seat.assignedToUserId,
          previousAssigneeAssetId: seat.assignedToAssetId,
        },
      });
    });

    revalidatePath("/licenses");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkin license seat." };
  }
}

/**
 * Check out a consumable to a user (decrements inventory)
 */
export async function checkoutConsumableAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "consumables:*");

  const consumableId = String(formData.get("consumableId") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!consumableId) return { error: "Consumable ID is required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };
  if (quantity <= 0) return { error: "Quantity must be greater than zero." };

  // Same IT checkout policy as assets: technician/admin-initiated checkouts
  // are approval-gated to the IT Manager.
  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await db.transaction(async (tx) => {
        const [consumable] = await tx
          .select({ id: consumables.id, qtyTotal: consumables.qtyTotal, companyId: consumables.companyId })
          .from(consumables)
          .where(eq(consumables.id, consumableId))
          .limit(1);

        if (!consumable) throw new Error("Consumable not found.");
        if (consumable.companyId !== currentUser.companyId) throw new Error("Unauthorized consumable.");
        if (consumable.qtyTotal < quantity) {
          throw new Error(`Insufficient stock. Only ${consumable.qtyTotal} units remaining.`);
        }

        const [newReq] = await tx
          .insert(requests)
          .values({
            companyId: currentUser.companyId,
            requesterUserId: currentUser.id,
            approverUserId,
            checkoutConsumableId: consumableId,
            checkoutTargetUserId: assignedToUserId,
            quantity,
            status: "pending_approval",
            justification: notes,
            approvalTokenHash: tokenHash,
          })
          .returning({ id: requests.id });

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "request.create_checkout",
          targetType: "request",
          targetId: newReq.id,
          meta: { checkoutConsumableId: consumableId, checkoutTargetUserId: assignedToUserId, approverUserId },
        });
      });

      revalidatePath("/consumables");
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit checkout approval request." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Verify consumable has enough inventory
      const [consumable] = await tx
        .select()
        .from(consumables)
        .where(eq(consumables.id, consumableId))
        .limit(1);

      if (!consumable) throw new Error("Consumable not found.");
      if (consumable.companyId !== currentUser.companyId) throw new Error("Unauthorized consumable.");
      if (consumable.qtyTotal < quantity) {
        throw new Error(`Insufficient stock. Only ${consumable.qtyTotal} units remaining.`);
      }

      // 2. Decrement inventory
      await tx
        .update(consumables)
        .set({
          qtyTotal: consumable.qtyTotal - quantity,
          updatedAt: new Date(),
        })
        .where(eq(consumables.id, consumableId));

      // 3. Create consumable assignment
      const [assignment] = await tx
        .insert(consumableAssignments)
        .values({
          consumableId,
          assignedToUserId,
          quantity,
        })
        .returning({ id: consumableAssignments.id });

      // 4. Create checkout log (consumables are immediately checked out/consumed)
      const [checkoutRow] = await tx
        .insert(checkouts)
        .values({
          checkoutableType: "consumable_assignment",
          checkoutableId: assignment.id,
          assignedToUserId,
          checkedOutByUserId: currentUser.id,
          checkedInAt: new Date(), // immediately closed since it is consumed
          checkedInByUserId: currentUser.id,
          notes,
        })
        .returning({ id: checkouts.id });

      // 5. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "consumable.checkout",
        targetType: "consumable",
        targetId: consumableId,
        meta: {
          assignedToUserId,
          quantity,
          notes,
          checkoutId: checkoutRow.id,
        },
      });
    });

    revalidatePath("/consumables");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkout consumable." };
  }
}

/**
 * Check out a pre-packaged Kit to a user
 */
export async function checkoutKitAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "kits:*");

  const kitId = String(formData.get("kitId") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!kitId) return { error: "Kit ID is required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };

  // Same IT checkout policy as assets/consumables: technician/admin-initiated
  // checkouts are approval-gated to the IT Manager.
  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      await db.transaction(async (tx) => {
        const [kit] = await tx
          .select({ id: kits.id, companyId: kits.companyId })
          .from(kits)
          .where(eq(kits.id, kitId))
          .limit(1);

        if (!kit) throw new Error("Kit not found.");
        if (kit.companyId !== currentUser.companyId) throw new Error("Unauthorized kit.");

        const [newReq] = await tx
          .insert(requests)
          .values({
            companyId: currentUser.companyId,
            requesterUserId: currentUser.id,
            approverUserId,
            checkoutKitId: kitId,
            checkoutTargetUserId: assignedToUserId,
            quantity: 1,
            status: "pending_approval",
            justification: notes,
            approvalTokenHash: tokenHash,
          })
          .returning({ id: requests.id });

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "request.create_checkout",
          targetType: "request",
          targetId: newReq.id,
          meta: { checkoutKitId: kitId, checkoutTargetUserId: assignedToUserId, approverUserId },
        });
      });

      revalidatePath("/kits");
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit checkout approval request." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      await executeKitCheckout(tx, {
        companyId: currentUser.companyId,
        kitId,
        assignedToUserId,
        checkedOutByUserId: currentUser.id,
        notes,
      });
    });

    revalidatePath("/kits");
    revalidatePath("/assets");
    revalidatePath("/licenses");
    revalidatePath("/consumables");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to checkout kit." };
  }
}

/**
 * Offboarding bulk check-in: returns every asset, license seat, and kit
 * currently held by a user in one transaction. Consumables are deliberately
 * left untouched - they're consumed, not returned, so there's nothing to
 * check back in (see getUserHoldings' comment for the same point).
 */
export async function checkInEverythingForUserAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "User ID is required." };

  try {
    let assetCount = 0;
    let seatCount = 0;
    let kitCount = 0;

    await db.transaction(async (tx) => {
      const [targetUser] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!targetUser) throw new Error("User not found.");
      if (targetUser.companyId !== currentUser.companyId) throw new Error("Unauthorized user.");

      requirePermission(currentUser, "assets:checkin");
      requirePermission(currentUser, "licenses:*");

      // 1. Check in every held asset
      const heldAssets = await tx.select().from(assets).where(eq(assets.assignedToUserId, userId));
      const readyToDeployStatusId =
        heldAssets.length > 0 ? await getStatusLabelId(currentUser.companyId, "Ready to Deploy") : null;

      for (const asset of heldAssets) {
        const [activeCheckout] = await tx
          .select()
          .from(checkouts)
          .where(and(eq(checkouts.checkoutableId, asset.id), eq(checkouts.checkoutableType, "asset"), isNull(checkouts.checkedInAt)))
          .limit(1);

        await tx
          .update(assets)
          .set({ assignedToUserId: null, statusId: readyToDeployStatusId!, locationId: asset.rtdLocationId, updatedAt: new Date() })
          .where(eq(assets.id, asset.id));

        if (activeCheckout) {
          await tx
            .update(checkouts)
            .set({ checkedInAt: new Date(), checkedInByUserId: currentUser.id, notes: `Offboarding: bulk check-in for ${targetUser.email}` })
            .where(eq(checkouts.id, activeCheckout.id));
        }

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "asset.checkin",
          targetType: "asset",
          targetId: asset.id,
          meta: { previousAssigneeId: userId, reason: "offboarding_bulk_checkin" },
        });
        assetCount += 1;
      }

      // 2. Check in every held license seat
      const heldSeats = await tx.select().from(licenseSeats).where(eq(licenseSeats.assignedToUserId, userId));
      for (const seat of heldSeats) {
        const [activeCheckout] = await tx
          .select()
          .from(checkouts)
          .where(
            and(eq(checkouts.checkoutableId, seat.id), eq(checkouts.checkoutableType, "license_seat"), isNull(checkouts.checkedInAt)),
          )
          .limit(1);

        await tx
          .update(licenseSeats)
          .set({ assignedToUserId: null, assignedToAssetId: null, notes: null })
          .where(eq(licenseSeats.id, seat.id));

        if (activeCheckout) {
          await tx
            .update(checkouts)
            .set({ checkedInAt: new Date(), checkedInByUserId: currentUser.id, notes: `Offboarding: bulk check-in for ${targetUser.email}` })
            .where(eq(checkouts.id, activeCheckout.id));
        }

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "license.checkin_seat",
          targetType: "license_seat",
          targetId: seat.id,
          meta: { previousAssigneeUserId: userId, reason: "offboarding_bulk_checkin" },
        });
        seatCount += 1;
      }

      // 3. Close every open kit-level checkout (the kit's own component items
      // were already returned above via steps 1-2, since they carry their own
      // checkouts rows keyed by their own ids)
      const heldKitCheckouts = await tx
        .select()
        .from(checkouts)
        .where(and(eq(checkouts.assignedToUserId, userId), eq(checkouts.checkoutableType, "kit"), isNull(checkouts.checkedInAt)));

      for (const kitCheckout of heldKitCheckouts) {
        await tx
          .update(checkouts)
          .set({ checkedInAt: new Date(), checkedInByUserId: currentUser.id, notes: `Offboarding: bulk check-in for ${targetUser.email}` })
          .where(eq(checkouts.id, kitCheckout.id));

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "kit.checkin",
          targetType: "kit",
          targetId: kitCheckout.checkoutableId,
          meta: { previousAssigneeId: userId, reason: "offboarding_bulk_checkin" },
        });
        kitCount += 1;
      }

      // 4. Summary event on the user record itself
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "user.offboarding_checkin_all",
        targetType: "user",
        targetId: userId,
        meta: { assetCount, seatCount, kitCount },
      });
    });

    revalidatePath("/assets");
    revalidatePath("/licenses");
    revalidatePath("/kits");
    revalidatePath(`/users/${userId}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to check in items." };
  }
}

export async function bulkCheckoutAssetAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "assets:checkout");

  const assetIdsStr = String(formData.get("assetIds") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const expectedCheckinAtStr = formData.get("expectedCheckinAt") ? String(formData.get("expectedCheckinAt")) : null;
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!assetIdsStr) return { error: "Asset IDs are required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };

  const assetIds = assetIdsStr.split(",").map((id) => id.trim()).filter(Boolean);
  if (assetIds.length === 0) return { error: "No valid asset IDs provided." };

  const expectedCheckinAt = expectedCheckinAtStr ? new Date(expectedCheckinAtStr) : null;

  // IT checkout policy: every IT-staff-initiated direct checkout (technician
  // or admin) is approval-gated to the IT Manager (see single-asset checkout
  // above for why the IT Manager's own checkouts are exempt).
  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      // Find the IT Manager for this company
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      await db.transaction(async (tx) => {
        for (const assetId of assetIds) {
          // Validate asset availability
          const [assetData] = await tx
            .select({ id: assets.id, assignedToUserId: assets.assignedToUserId })
            .from(assets)
            .where(eq(assets.id, assetId))
            .limit(1);

          if (!assetData) throw new Error(`Asset ID ${assetId} not found.`);
          if (assetData.assignedToUserId) throw new Error(`Asset ${assetId} is already checked out.`);

          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

          // Insert Checkout Request
          const [newReq] = await tx
            .insert(requests)
            .values({
              companyId: currentUser.companyId,
              requesterUserId: currentUser.id,
              approverUserId,
              checkoutAssetId: assetId,
              checkoutTargetUserId: assignedToUserId,
              expectedCheckinAt,
              quantity: 1,
              status: "pending_approval",
              justification: notes,
              approvalTokenHash: tokenHash,
            })
            .returning({ id: requests.id });

          // Log request create
          await tx.insert(auditLogs).values({
            companyId: currentUser.companyId,
            actorUserId: currentUser.id,
            actionType: "request.create_checkout",
            targetType: "request",
            targetId: newReq.id,
            meta: {
              checkoutAssetId: assetId,
              checkoutTargetUserId: assignedToUserId,
              approverUserId,
              isBulk: true,
            },
          });
        }
      });

      revalidatePath("/assets");
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit bulk checkout approval requests." };
    }
  }

  // If IT Manager or Admin, perform checkout immediately
  try {
    const deployedStatusId = await getStatusLabelId(currentUser.companyId, "Deployed");
    await db.transaction(async (tx) => {
      // Find target user
      const [targetUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, assignedToUserId))
        .limit(1);

      if (!targetUser) throw new Error("Target user not found.");

      for (const assetId of assetIds) {
        const [assetData] = await tx
          .select({
            id: assets.id,
            companyId: assets.companyId,
            assignedToUserId: assets.assignedToUserId,
            requiresAcceptance: categories.requiresAcceptance,
            eulaText: categories.eulaText,
          })
          .from(assets)
          .innerJoin(models, eq(assets.modelId, models.id))
          .innerJoin(categories, eq(models.categoryId, categories.id))
          .where(eq(assets.id, assetId))
          .limit(1);

        if (!assetData) throw new Error(`Asset ID ${assetId} not found.`);
        if (assetData.assignedToUserId) throw new Error(`Asset ${assetId} is already checked out.`);
        if (assetData.companyId !== currentUser.companyId) throw new Error(`Unauthorized asset ID ${assetId}.`);

        // Update asset
        await tx
          .update(assets)
          .set({
            assignedToUserId,
            statusId: deployedStatusId,
            locationId: assetData.requiresAcceptance ? null : targetUser.locationId,
            updatedAt: new Date(),
          })
          .where(eq(assets.id, assetId));

        // Create checkout record
        const [checkoutRow] = await tx
          .insert(checkouts)
          .values({
            checkoutableType: "asset",
            checkoutableId: assetId,
            assignedToUserId,
            checkedOutByUserId: currentUser.id,
            expectedCheckinAt,
            notes,
          })
          .returning({ id: checkouts.id });

        // Acceptance prompt
        if (assetData.requiresAcceptance) {
          await tx.insert(acceptances).values({
            checkoutId: checkoutRow.id,
            status: "pending",
            eulaSnapshot: assetData.eulaText || "Default EULA",
          });
        }

        // Log Audit
        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "asset.checkout",
          targetType: "asset",
          targetId: assetId,
          meta: {
            assignedToUserId,
            expectedCheckinAt: expectedCheckinAtStr,
            checkoutId: checkoutRow.id,
          },
        });
      }
    });

    revalidatePath("/assets");
    revalidatePath("/requests");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to execute bulk checkout." };
  }
}

export async function bulkCheckinAssetAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "assets:checkin");

  const assetIdsStr = String(formData.get("assetIds") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!assetIdsStr) return { error: "Asset IDs are required." };

  const assetIds = assetIdsStr.split(",").map((id) => id.trim()).filter(Boolean);
  if (assetIds.length === 0) return { error: "No valid asset IDs provided." };

  try {
    const readyToDeployStatusId = await getStatusLabelId(currentUser.companyId, "Ready to Deploy");
    await db.transaction(async (tx) => {
      for (const assetId of assetIds) {
        const [assetData] = await tx
          .select()
          .from(assets)
          .where(eq(assets.id, assetId))
          .limit(1);

        if (!assetData) throw new Error(`Asset ID ${assetId} not found.`);
        if (!assetData.assignedToUserId) throw new Error(`Asset ${assetId} is not checked out.`);
        if (assetData.companyId !== currentUser.companyId) throw new Error(`Unauthorized asset ID ${assetId}.`);

        // Find active checkout
        const [activeCheckout] = await tx
          .select()
          .from(checkouts)
          .where(
            and(
              eq(checkouts.checkoutableId, assetId),
              eq(checkouts.checkoutableType, "asset"),
              isNull(checkouts.checkedInAt)
            )
          )
          .limit(1);

        // Update asset
        await tx
          .update(assets)
          .set({
            assignedToUserId: null,
            statusId: readyToDeployStatusId,
            locationId: assetData.rtdLocationId,
            updatedAt: new Date(),
          })
          .where(eq(assets.id, assetId));

        if (activeCheckout) {
          // Close checkout
          await tx
            .update(checkouts)
            .set({
              checkedInAt: new Date(),
              checkedInByUserId: currentUser.id,
              notes,
            })
            .where(eq(checkouts.id, activeCheckout.id));
        }

        // Log Audit
        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "asset.checkin",
          targetType: "asset",
          targetId: assetId,
          meta: {
            previousAssigneeUserId: assetData.assignedToUserId,
            notes,
          },
        });
      }
    });

    revalidatePath("/assets");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to execute bulk check-in." };
  }
}

/**
 * Bulk-checkout multiple different consumables (each with its own quantity)
 * to one person in a single action - mirrors bulkCheckoutAssetAction's
 * shape, including the same technician/admin approval gate.
 */
export async function bulkCheckoutConsumableAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "consumables:*");

  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;
  const itemsRaw = String(formData.get("items") ?? "");

  if (!assignedToUserId) return { error: "User is required for checkout." };
  if (!itemsRaw) return { error: "No consumables selected." };

  let items: { consumableId: string; quantity: number }[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "Invalid item selection." };
  }
  if (!Array.isArray(items) || items.length === 0) return { error: "No consumables selected." };
  for (const item of items) {
    if (!item.consumableId || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { error: "Each selected consumable needs a valid quantity." };
    }
  }

  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      await db.transaction(async (tx) => {
        for (const item of items) {
          const [consumable] = await tx
            .select({ id: consumables.id, qtyTotal: consumables.qtyTotal, companyId: consumables.companyId })
            .from(consumables)
            .where(eq(consumables.id, item.consumableId))
            .limit(1);

          if (!consumable) throw new Error(`Consumable ID ${item.consumableId} not found.`);
          if (consumable.companyId !== currentUser.companyId) throw new Error(`Unauthorized consumable ID ${item.consumableId}.`);
          if (consumable.qtyTotal < item.quantity) {
            throw new Error(`Insufficient stock for consumable ID ${item.consumableId}. Only ${consumable.qtyTotal} remaining.`);
          }

          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

          const [newReq] = await tx
            .insert(requests)
            .values({
              companyId: currentUser.companyId,
              requesterUserId: currentUser.id,
              approverUserId,
              checkoutConsumableId: item.consumableId,
              checkoutTargetUserId: assignedToUserId,
              quantity: item.quantity,
              status: "pending_approval",
              justification: notes,
              approvalTokenHash: tokenHash,
            })
            .returning({ id: requests.id });

          await tx.insert(auditLogs).values({
            companyId: currentUser.companyId,
            actorUserId: currentUser.id,
            actionType: "request.create_checkout",
            targetType: "request",
            targetId: newReq.id,
            meta: { checkoutConsumableId: item.consumableId, checkoutTargetUserId: assignedToUserId, approverUserId, isBulk: true },
          });
        }
      });

      revalidatePath("/consumables");
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit bulk checkout approval requests." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [consumable] = await tx
          .select({ id: consumables.id, qtyTotal: consumables.qtyTotal, companyId: consumables.companyId })
          .from(consumables)
          .where(eq(consumables.id, item.consumableId))
          .limit(1);

        if (!consumable) throw new Error(`Consumable ID ${item.consumableId} not found.`);
        if (consumable.companyId !== currentUser.companyId) throw new Error(`Unauthorized consumable ID ${item.consumableId}.`);
        if (consumable.qtyTotal < item.quantity) {
          throw new Error(`Insufficient stock for consumable ID ${item.consumableId}. Only ${consumable.qtyTotal} remaining.`);
        }

        await tx
          .update(consumables)
          .set({ qtyTotal: consumable.qtyTotal - item.quantity, updatedAt: new Date() })
          .where(eq(consumables.id, item.consumableId));

        const [assignment] = await tx
          .insert(consumableAssignments)
          .values({ consumableId: item.consumableId, assignedToUserId, quantity: item.quantity })
          .returning({ id: consumableAssignments.id });

        const [checkoutRow] = await tx
          .insert(checkouts)
          .values({
            checkoutableType: "consumable_assignment",
            checkoutableId: assignment.id,
            assignedToUserId,
            checkedOutByUserId: currentUser.id,
            checkedInAt: new Date(),
            checkedInByUserId: currentUser.id,
            notes,
          })
          .returning({ id: checkouts.id });

        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "consumable.checkout",
          targetType: "consumable",
          targetId: item.consumableId,
          meta: { assignedToUserId, quantity: item.quantity, notes, checkoutId: checkoutRow.id, isBulk: true },
        });
      }
    });

    revalidatePath("/consumables");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to execute bulk consumable checkout." };
  }
}

/**
 * Bulk-checkout multiple kits to one person in a single action - each kit
 * still fans out to its own component items (assets/seats/consumables) via
 * the same polymorphic logic as the single-kit checkoutKitAction, just
 * looped. Same technician/admin approval gate as everything else here.
 */
export async function bulkCheckoutKitAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const currentUser = await requireUser();
  requirePermission(currentUser, "kits:*");

  const kitIdsStr = String(formData.get("kitIds") ?? "");
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const notes = formData.get("notes") ? String(formData.get("notes")).trim() : null;

  if (!kitIdsStr) return { error: "Kit IDs are required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };

  const kitIds = kitIdsStr.split(",").map((id) => id.trim()).filter(Boolean);
  if (kitIds.length === 0) return { error: "No valid kit IDs provided." };

  const requiresCheckoutApproval =
    currentUser.role.name === "technician" || currentUser.role.name === "admin";
  if (requiresCheckoutApproval) {
    try {
      const [itManager] = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.companyId, currentUser.companyId), eq(roles.name, "it_manager")))
        .limit(1);

      const approverUserId = itManager?.id;
      if (!approverUserId) {
        return { error: "No IT Manager found in the system to route checkout approval to." };
      }

      await db.transaction(async (tx) => {
        for (const kitId of kitIds) {
          const [kit] = await tx
            .select({ id: kits.id, companyId: kits.companyId })
            .from(kits)
            .where(eq(kits.id, kitId))
            .limit(1);

          if (!kit) throw new Error(`Kit ID ${kitId} not found.`);
          if (kit.companyId !== currentUser.companyId) throw new Error(`Unauthorized kit ID ${kitId}.`);

          const token = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

          const [newReq] = await tx
            .insert(requests)
            .values({
              companyId: currentUser.companyId,
              requesterUserId: currentUser.id,
              approverUserId,
              checkoutKitId: kitId,
              checkoutTargetUserId: assignedToUserId,
              quantity: 1,
              status: "pending_approval",
              justification: notes,
              approvalTokenHash: tokenHash,
            })
            .returning({ id: requests.id });

          await tx.insert(auditLogs).values({
            companyId: currentUser.companyId,
            actorUserId: currentUser.id,
            actionType: "request.create_checkout",
            targetType: "request",
            targetId: newReq.id,
            meta: { checkoutKitId: kitId, checkoutTargetUserId: assignedToUserId, approverUserId, isBulk: true },
          });
        }
      });

      revalidatePath("/kits");
      revalidatePath("/requests");
      return { success: true, pendingApproval: true };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to submit bulk checkout approval requests." };
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (const kitId of kitIds) {
        await executeKitCheckout(tx, {
          companyId: currentUser.companyId,
          kitId,
          assignedToUserId,
          checkedOutByUserId: currentUser.id,
          notes,
          extraAuditMeta: { isBulk: true },
        });
      }
    });

    revalidatePath("/kits");
    revalidatePath("/assets");
    revalidatePath("/licenses");
    revalidatePath("/consumables");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to execute bulk kit checkout." };
  }
}
