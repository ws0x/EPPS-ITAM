import "server-only";
import { eq, and, isNull } from "drizzle-orm";
import type { db } from "@/db/client";
import {
  kits,
  kitItems,
  assets,
  licenseSeats,
  consumables,
  consumableAssignments,
  checkouts,
  statusLabels,
  auditLogs,
} from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Checks out every component item of a kit (assets/license seats/consumables,
 * polymorphic per kitItems.itemType) to one person, plus the kit-level
 * checkout row and audit log entry. Shared by the single-kit, bulk-kit, and
 * request-approval-fulfillment checkout paths, which previously each carried
 * their own copy of this fan-out logic - three copies of the same ~80 lines,
 * found during a repo audit and consolidated here.
 */
export async function executeKitCheckout(
  tx: Tx,
  params: {
    companyId: string;
    kitId: string;
    assignedToUserId: string;
    checkedOutByUserId: string;
    notes: string | null;
    extraAuditMeta?: Record<string, unknown>;
  },
): Promise<{ kitCheckoutId: string; kitName: string }> {
  const { companyId, kitId, assignedToUserId, checkedOutByUserId, notes, extraAuditMeta } = params;

  const [kit] = await tx.select().from(kits).where(eq(kits.id, kitId)).limit(1);
  if (!kit) throw new Error(`Kit ID ${kitId} not found.`);
  if (kit.companyId !== companyId) throw new Error(`Unauthorized kit ID ${kitId}.`);

  const items = await tx.select().from(kitItems).where(eq(kitItems.kitId, kitId));
  if (items.length === 0) throw new Error(`Kit "${kit.name}" contains no items to check out.`);

  const [kitCheckout] = await tx
    .insert(checkouts)
    .values({
      checkoutableType: "kit",
      checkoutableId: kitId,
      assignedToUserId,
      checkedOutByUserId,
      notes: notes || `Checked out kit: ${kit.name}`,
    })
    .returning({ id: checkouts.id });

  const [deployedLabel] = await tx
    .select({ id: statusLabels.id })
    .from(statusLabels)
    .where(and(eq(statusLabels.companyId, companyId), eq(statusLabels.name, "Deployed")))
    .limit(1);
  const deployedStatusId = deployedLabel?.id;
  if (!deployedStatusId) throw new Error("'Deployed' status label not found. Run db:seed first.");

  const [readyLabel] = await tx
    .select({ id: statusLabels.id })
    .from(statusLabels)
    .where(and(eq(statusLabels.companyId, companyId), eq(statusLabels.name, "Ready to Deploy")))
    .limit(1);
  const readyStatusId = readyLabel?.id;

  for (const item of items) {
    if (item.itemType === "model") {
      const availableAssets = readyStatusId
        ? await tx
            .select()
            .from(assets)
            .where(and(eq(assets.modelId, item.itemId), isNull(assets.assignedToUserId), eq(assets.statusId, readyStatusId)))
            .limit(item.quantity)
        : [];

      if (availableAssets.length < item.quantity) {
        throw new Error(
          `Could not check out kit "${kit.name}". Insufficient ready-to-deploy assets of model ID '${item.itemId}'. Needed ${item.quantity}, found ${availableAssets.length}.`,
        );
      }

      for (const asset of availableAssets) {
        await tx
          .update(assets)
          .set({ assignedToUserId, statusId: deployedStatusId, updatedAt: new Date() })
          .where(eq(assets.id, asset.id));

        await tx.insert(checkouts).values({
          checkoutableType: "asset",
          checkoutableId: asset.id,
          assignedToUserId,
          checkedOutByUserId,
          notes: `Checked out as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
        });
      }
    } else if (item.itemType === "license") {
      const availableSeats = await tx
        .select()
        .from(licenseSeats)
        .where(
          and(
            eq(licenseSeats.licenseId, item.itemId),
            isNull(licenseSeats.assignedToUserId),
            isNull(licenseSeats.assignedToAssetId),
          ),
        )
        .limit(item.quantity);

      if (availableSeats.length < item.quantity) {
        throw new Error(
          `Could not check out kit "${kit.name}". Insufficient seats for license ID '${item.itemId}'. Needed ${item.quantity}, found ${availableSeats.length}.`,
        );
      }

      for (const seat of availableSeats) {
        await tx.update(licenseSeats).set({ assignedToUserId }).where(eq(licenseSeats.id, seat.id));

        await tx.insert(checkouts).values({
          checkoutableType: "license_seat",
          checkoutableId: seat.id,
          assignedToUserId,
          checkedOutByUserId,
          notes: `Assigned as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
        });
      }
    } else if (item.itemType === "consumable") {
      const [consumable] = await tx.select().from(consumables).where(eq(consumables.id, item.itemId)).limit(1);
      if (!consumable || consumable.qtyTotal < item.quantity) {
        throw new Error(
          `Could not check out kit "${kit.name}". Insufficient stock for consumable '${consumable?.name || item.itemId}'. Needed ${item.quantity}.`,
        );
      }

      await tx
        .update(consumables)
        .set({ qtyTotal: consumable.qtyTotal - item.quantity, updatedAt: new Date() })
        .where(eq(consumables.id, item.itemId));

      const [assignment] = await tx
        .insert(consumableAssignments)
        .values({ consumableId: item.itemId, assignedToUserId, quantity: item.quantity })
        .returning({ id: consumableAssignments.id });

      await tx.insert(checkouts).values({
        checkoutableType: "consumable_assignment",
        checkoutableId: assignment.id,
        assignedToUserId,
        checkedOutByUserId,
        checkedInAt: new Date(),
        checkedInByUserId: checkedOutByUserId,
        notes: `Consumed as part of Kit: ${kit.name} (Checkout ID: ${kitCheckout.id})`,
      });
    }
  }

  await tx.insert(auditLogs).values({
    companyId,
    actorUserId: checkedOutByUserId,
    actionType: "kit.checkout",
    targetType: "kit",
    targetId: kitId,
    meta: { assignedToUserId, notes, checkoutId: kitCheckout.id, ...extraAuditMeta },
  });

  return { kitCheckoutId: kitCheckout.id, kitName: kit.name };
}
