"use server";

import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { acceptances, checkouts, assets, statusLabels, auditLogs } from "@/db/schema";

export type AcceptanceActionState = { error?: string; success?: boolean } | undefined;

/**
 * Helper to find status label IDs
 */
async function getStatusLabelId(companyId: string, name: string, deployableOnly = true): Promise<string> {
  let [label] = await db
    .select({ id: statusLabels.id })
    .from(statusLabels)
    .where(and(eq(statusLabels.companyId, companyId), eq(statusLabels.name, name)))
    .limit(1);

  if (!label && deployableOnly) {
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
 * Accept a checked-out item by signing the EULA
 */
export async function acceptCheckoutAction(
  _prevState: AcceptanceActionState,
  formData: FormData
): Promise<AcceptanceActionState> {
  const currentUser = await requireUser();

  const acceptanceId = String(formData.get("acceptanceId") ?? "");
  const signatureText = String(formData.get("signatureText") ?? "").trim();

  if (!acceptanceId) return { error: "Acceptance ID is required." };
  if (!signatureText) return { error: "You must type your full name to accept." };

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Acceptance & Checkout
      const [accRow] = await tx
        .select({
          id: acceptances.id,
          status: acceptances.status,
          checkoutId: checkouts.id,
          assignedToUserId: checkouts.assignedToUserId,
          checkoutableType: checkouts.checkoutableType,
          checkoutableId: checkouts.checkoutableId,
        })
        .from(acceptances)
        .innerJoin(checkouts, eq(acceptances.checkoutId, checkouts.id))
        .where(eq(acceptances.id, acceptanceId))
        .limit(1);

      if (!accRow) throw new Error("Acceptance record not found.");
      if (accRow.status !== "pending") {
        throw new Error(`This item has already been marked as ${accRow.status}.`);
      }

      // 2. Validate Authorization: Only the assignee can sign
      if (accRow.assignedToUserId !== currentUser.id) {
        throw new Error("You are not authorized to accept this item assignment.");
      }

      // 3. Update Acceptance Status
      await tx
        .update(acceptances)
        .set({
          status: "accepted",
          signatureUrl: signatureText,
          acceptedAt: new Date(),
        })
        .where(eq(acceptances.id, acceptanceId));

      // 4. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "checkout.accepted",
        targetType: accRow.checkoutableType,
        targetId: accRow.checkoutableId,
        meta: {
          acceptanceId,
          signatureText,
        },
      });
    });

    revalidatePath("/requests");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to accept item." };
  }
}

/**
 * Decline a checked-out item
 */
export async function declineCheckoutAction(
  _prevState: AcceptanceActionState,
  formData: FormData
): Promise<AcceptanceActionState> {
  const currentUser = await requireUser();

  const acceptanceId = String(formData.get("acceptanceId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!acceptanceId) return { error: "Acceptance ID is required." };
  if (!note) return { error: "A note explaining why you declined is required." };

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Acceptance & Checkout
      const [accRow] = await tx
        .select({
          id: acceptances.id,
          status: acceptances.status,
          checkoutId: checkouts.id,
          assignedToUserId: checkouts.assignedToUserId,
          checkoutableType: checkouts.checkoutableType,
          checkoutableId: checkouts.checkoutableId,
        })
        .from(acceptances)
        .innerJoin(checkouts, eq(acceptances.checkoutId, checkouts.id))
        .where(eq(acceptances.id, acceptanceId))
        .limit(1);

      if (!accRow) throw new Error("Acceptance record not found.");
      if (accRow.status !== "pending") {
        throw new Error(`This item has already been marked as ${accRow.status}.`);
      }

      // 2. Validate Authorization
      if (accRow.assignedToUserId !== currentUser.id) {
        throw new Error("You are not authorized to decline this item assignment.");
      }

      // 3. Update Acceptance Status
      await tx
        .update(acceptances)
        .set({
          status: "declined",
          note: note,
          declinedAt: new Date(),
        })
        .where(eq(acceptances.id, acceptanceId));

      // 4. If checkout is an asset, return the asset back to inventory (checkin)
      if (accRow.checkoutableType === "asset") {
        const [assetData] = await tx
          .select()
          .from(assets)
          .where(eq(assets.id, accRow.checkoutableId))
          .limit(1);

        if (assetData) {
          const readyToDeployStatusId = await getStatusLabelId(currentUser.companyId, "Ready to Deploy");
          
          // Reclaim asset in DB
          await tx
            .update(assets)
            .set({
              assignedToUserId: null,
              statusId: readyToDeployStatusId,
              locationId: assetData.rtdLocationId,
              updatedAt: new Date(),
            })
            .where(eq(assets.id, assetData.id));

          // Close the checkout log
          await tx
            .update(checkouts)
            .set({
              checkedInAt: new Date(),
              checkedInByUserId: currentUser.id, // closed by user (declined)
              notes: `Declined by employee. Reason: ${note}`,
            })
            .where(eq(checkouts.id, accRow.checkoutId));
        }
      }

      // 5. Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "checkout.declined",
        targetType: accRow.checkoutableType,
        targetId: accRow.checkoutableId,
        meta: {
          acceptanceId,
          declineReason: note,
        },
      });
    });

    revalidatePath("/requests");
    revalidatePath("/dashboard");
    revalidatePath("/assets");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to decline item." };
  }
}
