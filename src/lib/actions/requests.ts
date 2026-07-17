"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import {
  requests,
  users,
  roles,
  models,
  categories,
  auditLogs,
  assets,
  checkouts,
  acceptances,
  statusLabels,
  consumables,
  consumableAssignments,
} from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { executeKitCheckout } from "@/lib/kit-checkout";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import crypto from "node:crypto";

export type RequestActionState = { error?: string; success?: boolean; emailError?: string } | undefined;

/**
 * Helper to find fallback approver (IT Manager) for a company
 */
async function getFallbackApproverId(companyId: string): Promise<string> {
  const [itManager] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.companyId, companyId), eq(roles.name, "it_manager")))
    .limit(1);

  if (itManager) return itManager.id;

  // Fallback to Admin
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.companyId, companyId), eq(roles.name, "admin")))
    .limit(1);

  if (admin) return admin.id;

  // Final fallback to any user (e.g. system creator)
  const [firstUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.companyId, companyId))
    .limit(1);

  if (!firstUser) {
    throw new Error("No users found in this company to route approval to.");
  }
  return firstUser.id;
}

/**
 * Submit a request for an asset/category model
 */
export async function createRequestAction(
  _prevState: RequestActionState,
  formData: FormData
): Promise<RequestActionState> {
  const currentUser = await requireUser();

  const modelId = formData.get("modelId") ? String(formData.get("modelId")) : null;
  const categoryId = formData.get("categoryId") ? String(formData.get("categoryId")) : null;
  const quantity = Number(formData.get("quantity") ?? 1);
  const justification = formData.get("justification") ? String(formData.get("justification")).trim() : null;

  if (!modelId && !categoryId) {
    return { error: "Either a Model or a Category must be requested." };
  }
  if (quantity <= 0) return { error: "Quantity must be greater than zero." };

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    let approverUserId = currentUser.managerId;
    if (!approverUserId) {
      // Fallback to IT Manager per user decision
      approverUserId = await getFallbackApproverId(currentUser.companyId);
    }

    const [approverData] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, approverUserId))
      .limit(1);

    if (!approverData) throw new Error("Approver email details not found.");

    let itemName = "Requested Item";
    if (modelId) {
      const [m] = await db.select({ name: models.name }).from(models).where(eq(models.id, modelId)).limit(1);
      if (m) itemName = m.name;
    } else if (categoryId) {
      const [c] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId)).limit(1);
      if (c) itemName = c.name;
    }

    let createdRequestId = "";

    // 1. Database Operations (Transaction)
    await db.transaction(async (tx) => {
      // Insert Request
      const [newRequest] = await tx
        .insert(requests)
        .values({
          companyId: currentUser.companyId,
          requesterUserId: currentUser.id,
          approverUserId: approverUserId!,
          modelId,
          categoryId,
          quantity,
          status: "pending_approval",
          justification,
          approvalTokenHash: tokenHash,
        })
        .returning({ id: requests.id });

      createdRequestId = newRequest.id;

      // Log Audit
      await tx.insert(auditLogs).values({
        companyId: currentUser.companyId,
        actorUserId: currentUser.id,
        actionType: "request.create",
        targetType: "request",
        targetId: newRequest.id,
        meta: {
          approverUserId,
          quantity,
          modelId,
          categoryId,
        },
      });
    });

    // 2. Dispatch Email (Outside of DB Transaction)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const reviewUrl = `${appUrl}/requests/decide?id=${createdRequestId}&token=${token}`;

    const requesterName = currentUser.firstName
      ? `${currentUser.firstName} ${currentUser.lastName ?? ""}`.trim()
      : currentUser.email;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg">
        <h2 style="color: #0f766e; margin-top: 0;">ITAM Approval Request</h2>
        <p>Hello,</p>
        <p><strong>${requesterName}</strong> has requested the allocation of the following item:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Requested Item</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${itemName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Quantity</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${quantity}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Justification</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${justification ?? "No justification provided."}</td>
          </tr>
        </table>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${reviewUrl}" style="background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Review Request
          </a>
        </div>

        <p style="font-size: 12px; color: #64748b;">
          Note: This link is secure and requires you to log in to the ITAM platform. The request link is valid for 7 days.
        </p>
      </div>
    `;

    let emailError: string | undefined = undefined;
    try {
      const emailResult = await sendEmail({
        to: approverData.email,
        subject: `[ITAM Approval Required] ${itemName} requested by ${requesterName}`,
        html: emailHtml,
      });

      if (!emailResult.success) {
        emailError = emailResult.error || "Unknown email delivery failure";
        console.error(`Email delivery failed: ${emailError}`);
      }
    } catch (mailErr) {
      emailError = mailErr instanceof Error ? mailErr.message : String(mailErr);
      console.error(`Email dispatch error: ${emailError}`);
    }

    revalidatePath("/dashboard");
    revalidatePath("/requests");
    return { success: true, emailError };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create approval request." };
  }
}

type RequestRow = typeof requests.$inferSelect;

/**
 * Shared decision-application logic used by both the token-based email-link
 * decision (decideRequestAction) and the in-app decision (decideRequestInAppAction).
 * Applies the approve/reject outcome - including executing the checkout when
 * approving a checkout-type request - and writes the audit trail. Callers are
 * responsible for authorization and (where applicable) token validation before
 * calling this.
 */
async function applyRequestDecision(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  currentUser: Awaited<ReturnType<typeof requireUser>>,
  reqRow: RequestRow,
  status: "approved" | "rejected",
  rejectionReason: string | null
) {
  const requestId = reqRow.id;

  // Update Request status & execute checkout if it is a checkout request
  if (status === "approved" && reqRow.checkoutAssetId) {
        // Load asset details to check requiresAcceptance
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
          .where(eq(assets.id, reqRow.checkoutAssetId))
          .limit(1);

        if (!assetData) throw new Error("Asset requested for checkout not found.");
        if (assetData.assignedToUserId) throw new Error("Asset is already checked out.");

        // Load target user
        const [targetUser] = await tx
          .select({ id: users.id, locationId: users.locationId })
          .from(users)
          .where(eq(users.id, reqRow.checkoutTargetUserId!))
          .limit(1);

        if (!targetUser) throw new Error("Target assignee not found.");

        // Resolve Deployed status label ID
        const [deployedLabel] = await tx
          .select({ id: statusLabels.id })
          .from(statusLabels)
          .where(and(eq(statusLabels.companyId, currentUser.companyId), eq(statusLabels.name, "Deployed")))
          .limit(1);

        const deployedStatusId = deployedLabel?.id;
        if (!deployedStatusId) throw new Error("'Deployed' status label not found. Run db:seed first.");

        // Update asset status
        await tx
          .update(assets)
          .set({
            assignedToUserId: targetUser.id,
            statusId: deployedStatusId,
            locationId: assetData.requiresAcceptance ? null : targetUser.locationId,
            updatedAt: new Date(),
          })
          .where(eq(assets.id, assetData.id));

        // Create checkout record
        const [checkoutRow] = await tx
          .insert(checkouts)
          .values({
            checkoutableType: "asset",
            checkoutableId: assetData.id,
            assignedToUserId: targetUser.id,
            checkedOutByUserId: reqRow.requesterUserId,
            expectedCheckinAt: reqRow.expectedCheckinAt,
            notes: reqRow.justification,
          })
          .returning({ id: checkouts.id });

        // Create acceptance if required
        if (assetData.requiresAcceptance) {
          await tx.insert(acceptances).values({
            checkoutId: checkoutRow.id,
            status: "pending",
            eulaSnapshot: assetData.eulaText || "Default EULA",
          });
        }

        // Set request status to fulfilled
        await tx
          .update(requests)
          .set({
            status: "fulfilled",
            fulfilledCheckoutId: checkoutRow.id,
            decidedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(requests.id, requestId));

        // Log checkout audit
        await tx.insert(auditLogs).values({
          companyId: currentUser.companyId,
          actorUserId: currentUser.id,
          actionType: "asset.checkout",
          targetType: "asset",
          targetId: assetData.id,
          meta: {
            assignedToUserId: targetUser.id,
            requestId,
          },
        });
  } else if (status === "approved" && reqRow.checkoutConsumableId) {
    const [consumable] = await tx
      .select({ id: consumables.id, qtyTotal: consumables.qtyTotal, companyId: consumables.companyId })
      .from(consumables)
      .where(eq(consumables.id, reqRow.checkoutConsumableId))
      .limit(1);

    if (!consumable) throw new Error("Consumable requested for checkout not found.");
    if (consumable.qtyTotal < reqRow.quantity) {
      throw new Error(`Insufficient stock. Only ${consumable.qtyTotal} units remaining.`);
    }

    await tx
      .update(consumables)
      .set({ qtyTotal: consumable.qtyTotal - reqRow.quantity, updatedAt: new Date() })
      .where(eq(consumables.id, consumable.id));

    const [assignment] = await tx
      .insert(consumableAssignments)
      .values({
        consumableId: consumable.id,
        assignedToUserId: reqRow.checkoutTargetUserId!,
        quantity: reqRow.quantity,
      })
      .returning({ id: consumableAssignments.id });

    const [checkoutRow] = await tx
      .insert(checkouts)
      .values({
        checkoutableType: "consumable_assignment",
        checkoutableId: assignment.id,
        assignedToUserId: reqRow.checkoutTargetUserId!,
        checkedOutByUserId: reqRow.requesterUserId,
        checkedInAt: new Date(),
        checkedInByUserId: reqRow.requesterUserId,
        notes: reqRow.justification,
      })
      .returning({ id: checkouts.id });

    await tx
      .update(requests)
      .set({ status: "fulfilled", fulfilledCheckoutId: checkoutRow.id, decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(requests.id, requestId));

    await tx.insert(auditLogs).values({
      companyId: currentUser.companyId,
      actorUserId: currentUser.id,
      actionType: "consumable.checkout",
      targetType: "consumable",
      targetId: consumable.id,
      meta: { assignedToUserId: reqRow.checkoutTargetUserId, quantity: reqRow.quantity, requestId },
    });
  } else if (status === "approved" && reqRow.checkoutKitId) {
    const { kitCheckoutId } = await executeKitCheckout(tx, {
      companyId: currentUser.companyId,
      kitId: reqRow.checkoutKitId,
      assignedToUserId: reqRow.checkoutTargetUserId!,
      checkedOutByUserId: reqRow.requesterUserId,
      notes: reqRow.justification,
      extraAuditMeta: { requestId },
    });

    await tx
      .update(requests)
      .set({ status: "fulfilled", fulfilledCheckoutId: kitCheckoutId, decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(requests.id, requestId));
  } else {
    await tx
      .update(requests)
      .set({
        status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));
  }

  // Log Audit for request decision
  await tx.insert(auditLogs).values({
    companyId: currentUser.companyId,
    actorUserId: currentUser.id,
    actionType: status === "approved" ? "request.approved" : "request.rejected",
    targetType: "request",
    targetId: requestId,
    meta: {
      rejectionReason,
      approverId: currentUser.id,
    },
  });
}

function validateDecisionInput(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "") as "approved" | "rejected";
  const rejectionReason = formData.get("rejectionReason") ? String(formData.get("rejectionReason")).trim() : null;

  if (!requestId) return { error: "Request ID is required." } as const;
  if (status !== "approved" && status !== "rejected") {
    return { error: "Invalid status selection." } as const;
  }
  if (status === "rejected" && !rejectionReason) {
    return { error: "A reason must be provided when rejecting a request." } as const;
  }
  return { requestId, status, rejectionReason } as const;
}

/**
 * Process a decision on a request via the emailed one-click link (token-based,
 * no login-session authorization beyond the approver-or-override check).
 */
export async function decideRequestAction(
  _prevState: RequestActionState,
  formData: FormData
): Promise<RequestActionState> {
  const currentUser = await requireUser();

  try {
    await checkRateLimit(`decide_action:requests:${currentUser.id}`, 5, 5);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }

  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Security token is required." };

  const parsed = validateDecisionInput(formData);
  if ("error" in parsed) return parsed;
  const { requestId, status, rejectionReason } = parsed;

  try {
    await db.transaction(async (tx) => {
      const [reqRow] = await tx.select().from(requests).where(eq(requests.id, requestId)).limit(1);

      if (!reqRow) throw new Error("Request not found.");
      if (reqRow.status !== "pending_approval") {
        throw new Error(`This request has already been decided (${reqRow.status}).`);
      }

      // The logged-in user must be either the designated approver or an IT Manager/Admin override
      const hasOverride = currentUser.role.name === "admin" || currentUser.role.name === "it_manager";
      if (reqRow.approverUserId !== currentUser.id && !hasOverride) {
        throw new Error("You are not authorized to decide on this request.");
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      if (reqRow.approvalTokenHash !== tokenHash) {
        throw new Error("Security token mismatch. Request is unauthorized.");
      }

      const diffTime = Math.abs(Date.now() - reqRow.createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        throw new Error("This request link has expired (exceeded 7-day limit).");
      }

      await applyRequestDecision(tx, currentUser, reqRow, status, rejectionReason);
    });

    revalidatePath("/dashboard");
    revalidatePath("/requests");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to process request decision." };
  }
}

/**
 * Process a decision on a request from inside the app (logged-in approver,
 * no emailed token needed). Exists because RESEND_API_KEY isn't configured
 * yet in every environment and, even once it is, an approver shouldn't be
 * stuck waiting on an email to act on something they can already see on
 * /requests - see BACKLOG.md Phase I/Phase A's "no in-app visibility" gap.
 * Authorization is intentionally the same rule as the token path (designated
 * approver, or admin/it_manager override) minus the token itself.
 */
export async function decideRequestInAppAction(
  _prevState: RequestActionState,
  formData: FormData
): Promise<RequestActionState> {
  const currentUser = await requireUser();

  const parsed = validateDecisionInput(formData);
  if ("error" in parsed) return parsed;
  const { requestId, status, rejectionReason } = parsed;

  try {
    await db.transaction(async (tx) => {
      const [reqRow] = await tx.select().from(requests).where(eq(requests.id, requestId)).limit(1);

      if (!reqRow) throw new Error("Request not found.");
      if (reqRow.status !== "pending_approval") {
        throw new Error(`This request has already been decided (${reqRow.status}).`);
      }

      const hasOverride = currentUser.role.name === "admin" || currentUser.role.name === "it_manager";
      if (reqRow.approverUserId !== currentUser.id && !hasOverride) {
        throw new Error("You are not authorized to decide on this request.");
      }

      await applyRequestDecision(tx, currentUser, reqRow, status, rejectionReason);
    });

    revalidatePath("/dashboard");
    revalidatePath("/requests");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to process request decision." };
  }
}
