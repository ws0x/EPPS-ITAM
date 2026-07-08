"use server";

import { eq, and, isNull, sql } from "drizzle-orm";
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
  kitItems,
} from "@/db/schema";

export type CheckoutActionState = { error?: string; success?: boolean } | undefined;

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

  if (!assetId) return { error: "Asset ID is required." };
  if (!assignedToUserId) return { error: "User is required for checkout." };

  const expectedCheckinAt = expectedCheckinAtStr ? new Date(expectedCheckinAtStr) : null;

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
          locationId: targetUser.locationId || assetData.requiresAcceptance ? null : targetUser.locationId,
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

      // 6. Log Audit
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
        },
      });
    });

    revalidatePath("/assets");
    revalidatePath(`/assets/${assetId}`);
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

  try {
    await db.transaction(async (tx) => {
      // 1. Verify kit exists
      const [kit] = await tx
        .select()
        .from(kits)
        .where(eq(kits.id, kitId))
        .limit(1);

      if (!kit) throw new Error("Kit not found.");
      if (kit.companyId !== currentUser.companyId) throw new Error("Unauthorized kit.");

      // 2. Fetch kit items
      const items = await tx
        .select()
        .from(kitItems)
        .where(eq(kitItems.kitId, kitId));

      if (items.length === 0) throw new Error("Kit contains no items to check out.");

      // 3. Create kit checkout log
      const [kitCheckout] = await tx
        .insert(checkouts)
        .values({
          checkoutableType: "kit",
          checkoutableId: kitId,
          assignedToUserId,
          checkedOutByUserId: currentUser.id,
          notes: notes || `Checked out kit: ${kit.name}`,
        })
        .returning({ id: checkouts.id });

      // 4. Polymorphic checkout of all items inside the kit
      const deployedStatusId = await getStatusLabelId(currentUser.companyId, "Deployed");

      for (const item of items) {
        if (item.itemType === "model") {
          // Find available assets of this model
          const availableAssets = await tx
            .select()
            .from(assets)
            .where(
              and(
                eq(assets.modelId, item.itemId),
                isNull(assets.assignedToUserId),
                eq(assets.statusId, await getStatusLabelId(currentUser.companyId, "Ready to Deploy"))
              )
            )
            .limit(item.quantity);

          if (availableAssets.length < item.quantity) {
            throw new Error(
              `Could not check out kit. Insufficient ready-to-deploy assets of model ID '${item.itemId}'. Needed ${item.quantity}, found ${availableAssets.length}.`
            );
          }

          for (const asset of availableAssets) {
            // Update asset
            await tx
              .update(assets)
              .set({
                assignedToUserId,
                statusId: deployedStatusId,
                updatedAt: new Date(),
              })
              .where(eq(assets.id, asset.id));

            // Log individual asset checkout linked to the kit checkout
            await tx.insert(checkouts).values({
              checkoutableType: "asset",
              checkoutableId: asset.id,
              assignedToUserId,
              checkedOutByUserId: currentUser.id,
              notes: `Checked out as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
            });
          }
        } else if (item.itemType === "license") {
          // Find unassigned license seats
          const availableSeats = await tx
            .select()
            .from(licenseSeats)
            .where(
              and(
                eq(licenseSeats.licenseId, item.itemId),
                isNull(licenseSeats.assignedToUserId),
                isNull(licenseSeats.assignedToAssetId)
              )
            )
            .limit(item.quantity);

          if (availableSeats.length < item.quantity) {
            throw new Error(
              `Could not check out kit. Insufficient seats for license ID '${item.itemId}'. Needed ${item.quantity}, found ${availableSeats.length}.`
            );
          }

          for (const seat of availableSeats) {
            await tx
              .update(licenseSeats)
              .set({
                assignedToUserId,
              })
              .where(eq(licenseSeats.id, seat.id));

            await tx.insert(checkouts).values({
              checkoutableType: "license_seat",
              checkoutableId: seat.id,
              assignedToUserId,
              checkedOutByUserId: currentUser.id,
              notes: `Assigned as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
            });
          }
        } else if (item.itemType === "consumable") {
          // Decrement consumable stock
          const [consumable] = await tx
            .select()
            .from(consumables)
            .where(eq(consumables.id, item.itemId))
            .limit(1);

          if (!consumable || consumable.qtyTotal < item.quantity) {
            throw new Error(
              `Could not check out kit. Insufficient stock for consumable '${consumable?.name || item.itemId}'. Needed ${item.quantity}.`
            );
          }

          await tx
            .update(consumables)
            .set({
              qtyTotal: consumable.qtyTotal - item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(consumables.id, item.itemId));

          const [assignment] = await tx
            .insert(consumableAssignments)
            .values({
              consumableId: item.itemId,
              assignedToUserId,
              quantity: item.quantity,
            })
            .returning({ id: consumableAssignments.id });

          await tx.insert(checkouts).values({
            checkoutableType: "consumable_assignment",
            checkoutableId: assignment.id,
            assignedToUserId,
            checkedOutByUserId: currentUser.id,
            checkedInAt: new Date(),
            checkedInByUserId: currentUser.id,
            notes: `Consumed as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
          });
        }
      }

      // 5. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "kit.checkout",
        targetType: "kit",
        targetId: kitId,
        meta: {
          assignedToUserId,
          notes,
          checkoutId: kitCheckout.id,
        },
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
