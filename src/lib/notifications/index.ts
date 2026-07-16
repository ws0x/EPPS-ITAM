"use server";

/**
 * Digest notification senders - Phase K. Reachable two ways: the manual
 * "Send now" buttons on /settings/notifications (admin-only, one company at
 * a time), and - as of the 2026-07-16 session - a Vercel Cron entry
 * (vercel.json) hitting /api/cron/notifications, which runs every digest for
 * every company. The cron is wired but not truly "live": it 401s unless
 * CRON_SECRET is set (it isn't, anywhere yet), and even if it ran,
 * sendEmail() no-ops without RESEND_API_KEY (also unset). Turning this on
 * for real is exactly two env vars, not a code change - see BACKLOG.md
 * Phase K/Phase U for the explicit "wire but don't activate" decision this
 * followed.
 *
 * Recipients are a fixed list (every admin/it_manager user in the company),
 * per an explicit decision to skip building per-user notification
 * preferences for a feature that isn't even being activated yet - except
 * for the pending-approval reminder, which instead notifies each request/PO's
 * actual assigned approver, since that's the one person who can act on it;
 * blasting the fixed list for every stalled approval would be noise for
 * everyone except the approver.
 */

import { eq, and, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { users, roles, requests, purchaseOrders, checkouts, consumables, notificationLog } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email";
import { getLicenseExpiryForecastForCompany, getWarrantyExpiryForecastForCompany } from "@/lib/actions/analytics";

type DigestResult = { success: boolean; sent: number; recipients: number; message: string };

async function getFixedRecipients(companyId: string) {
  return db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.companyId, companyId), inArray(roles.name, ["admin", "it_manager"]), eq(users.loginEnabled, true)));
}

async function logAndSend(
  companyId: string,
  triggeredByUserId: string | null,
  type: "license_expiry" | "warranty_expiry" | "pending_approval" | "overdue_checkout" | "low_stock_consumable",
  recipient: { id: string; email: string },
  subject: string,
  html: string,
  itemCount: number,
) {
  const result = await sendEmail({ to: recipient.email, subject, html });
  await db.insert(notificationLog).values({
    companyId,
    type,
    recipientUserId: recipient.id,
    itemCount,
    success: result.success,
    error: result.success ? null : (result.error ?? "Unknown error"),
    triggeredByUserId,
  });
  return result.success;
}

function wrapHtml(title: string, bodyHtml: string) {
  return `<div style="font-family: sans-serif; max-width: 600px;"><h2>${title}</h2>${bodyHtml}<p style="color:#888;font-size:12px;margin-top:24px;">Sent from EPPS ITAM.</p></div>`;
}

async function runLicenseExpiryDigest(companyId: string, triggeredByUserId: string | null): Promise<DigestResult> {
  const { upcoming } = await getLicenseExpiryForecastForCompany(companyId);
  if (upcoming.length === 0) {
    return { success: true, sent: 0, recipients: 0, message: "No licenses expiring within 90 days - nothing to send." };
  }

  const recipients = await getFixedRecipients(companyId);
  const html = wrapHtml(
    `${upcoming.length} License(s) Expiring Within 90 Days`,
    `<ul>${upcoming.map((l) => `<li><strong>${l.name}</strong> - expires ${l.expiresAt} (${l.daysUntil} day${l.daysUntil === 1 ? "" : "s"})</li>`).join("")}</ul>`,
  );

  let sent = 0;
  for (const r of recipients) {
    if (await logAndSend(companyId, triggeredByUserId, "license_expiry", r, `[ITAM] ${upcoming.length} license(s) expiring soon`, html, upcoming.length)) sent++;
  }
  return { success: true, sent, recipients: recipients.length, message: `Sent to ${sent}/${recipients.length} recipient(s).` };
}

async function runWarrantyExpiryDigest(companyId: string, triggeredByUserId: string | null): Promise<DigestResult> {
  const upcoming = await getWarrantyExpiryForecastForCompany(companyId);
  if (upcoming.length === 0) {
    return { success: true, sent: 0, recipients: 0, message: "No warranties expiring within 90 days - nothing to send." };
  }

  const recipients = await getFixedRecipients(companyId);
  const html = wrapHtml(
    `${upcoming.length} Asset Warrant${upcoming.length === 1 ? "y" : "ies"} Expiring Within 90 Days`,
    `<ul>${upcoming.map((a) => `<li><strong>${a.label}</strong> - expires ${a.expiresAt} (${a.daysUntil} day${a.daysUntil === 1 ? "" : "s"})</li>`).join("")}</ul>`,
  );

  let sent = 0;
  for (const r of recipients) {
    if (await logAndSend(companyId, triggeredByUserId, "warranty_expiry", r, `[ITAM] ${upcoming.length} warranty(s) expiring soon`, html, upcoming.length)) sent++;
  }
  return { success: true, sent, recipients: recipients.length, message: `Sent to ${sent}/${recipients.length} recipient(s).` };
}

const PENDING_APPROVAL_THRESHOLD_DAYS = 2;

async function runPendingApprovalReminder(companyId: string, triggeredByUserId: string | null): Promise<DigestResult> {
  const cutoff = new Date(Date.now() - PENDING_APPROVAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const [staleRequests, stalePos] = await Promise.all([
    db
      .select({ id: requests.id, approverUserId: requests.approverUserId, createdAt: requests.createdAt })
      .from(requests)
      .where(and(eq(requests.companyId, companyId), eq(requests.status, "pending_approval"), lt(requests.createdAt, cutoff))),
    db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, approverUserId: purchaseOrders.approverUserId, createdAt: purchaseOrders.createdAt })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.companyId, companyId), eq(purchaseOrders.status, "pending_approval"), lt(purchaseOrders.createdAt, cutoff))),
  ]);

  const byApprover = new Map<string, { requestCount: number; poNumbers: string[] }>();
  for (const r of staleRequests) {
    const entry = byApprover.get(r.approverUserId) ?? { requestCount: 0, poNumbers: [] };
    entry.requestCount++;
    byApprover.set(r.approverUserId, entry);
  }
  for (const po of stalePos) {
    const entry = byApprover.get(po.approverUserId) ?? { requestCount: 0, poNumbers: [] };
    entry.poNumbers.push(po.poNumber);
    byApprover.set(po.approverUserId, entry);
  }

  if (byApprover.size === 0) {
    return { success: true, sent: 0, recipients: 0, message: `No approvals pending more than ${PENDING_APPROVAL_THRESHOLD_DAYS} days - nothing to send.` };
  }

  const approverIds = Array.from(byApprover.keys());
  const approvers = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, approverIds));

  let sent = 0;
  let totalItems = 0;
  for (const approver of approvers) {
    const entry = byApprover.get(approver.id)!;
    const itemCount = entry.requestCount + entry.poNumbers.length;
    totalItems += itemCount;
    const parts: string[] = [];
    if (entry.requestCount > 0) parts.push(`<li>${entry.requestCount} item request(s) awaiting your approval</li>`);
    if (entry.poNumbers.length > 0) parts.push(`<li>Purchase order(s) awaiting your approval: ${entry.poNumbers.join(", ")}</li>`);
    const html = wrapHtml(
      `You have ${itemCount} approval(s) waiting more than ${PENDING_APPROVAL_THRESHOLD_DAYS} days`,
      `<ul>${parts.join("")}</ul>`,
    );
    if (await logAndSend(companyId, triggeredByUserId, "pending_approval", approver, `[ITAM] ${itemCount} approval(s) waiting on you`, html, itemCount)) sent++;
  }
  return { success: true, sent, recipients: approvers.length, message: `Sent to ${sent}/${approvers.length} approver(s), ${totalItems} stale item(s) total.` };
}

async function runOverdueCheckoutReminder(companyId: string, triggeredByUserId: string | null): Promise<DigestResult> {
  const now = new Date();
  const overdue = await db
    .select({
      id: checkouts.id,
      checkoutableType: checkouts.checkoutableType,
      assignedToUserId: checkouts.assignedToUserId,
      expectedCheckinAt: checkouts.expectedCheckinAt,
    })
    .from(checkouts)
    .innerJoin(users, eq(checkouts.assignedToUserId, users.id))
    .where(
      and(
        eq(users.companyId, companyId),
        isNull(checkouts.checkedInAt),
        // lt() against a nullable column already excludes NULL rows at the SQL level (NULL < x is unknown, not true).
        lt(checkouts.expectedCheckinAt, now),
      ),
    );

  if (overdue.length === 0) {
    return { success: true, sent: 0, recipients: 0, message: "No overdue checkouts (with an expected check-in date set) - nothing to send." };
  }

  const recipients = await getFixedRecipients(companyId);
  const html = wrapHtml(
    `${overdue.length} Overdue Checkout(s)`,
    `<ul>${overdue.map((c) => `<li>${c.checkoutableType} checked out to user, was due back ${c.expectedCheckinAt}</li>`).join("")}</ul>`,
  );

  let sent = 0;
  for (const r of recipients) {
    if (await logAndSend(companyId, triggeredByUserId, "overdue_checkout", r, `[ITAM] ${overdue.length} overdue checkout(s)`, html, overdue.length)) sent++;
  }
  return { success: true, sent, recipients: recipients.length, message: `Sent to ${sent}/${recipients.length} recipient(s).` };
}

async function runLowStockConsumableAlert(companyId: string, triggeredByUserId: string | null): Promise<DigestResult> {
  const rows = await db
    .select({ name: consumables.name, qtyTotal: consumables.qtyTotal, minQty: consumables.minQty })
    .from(consumables)
    .where(eq(consumables.companyId, companyId));
  const low = rows.filter((c) => c.qtyTotal <= c.minQty);

  if (low.length === 0) {
    return { success: true, sent: 0, recipients: 0, message: "No consumables at or below their minimum quantity - nothing to send." };
  }

  const recipients = await getFixedRecipients(companyId);
  const html = wrapHtml(
    `${low.length} Consumable(s) at or Below Minimum Stock`,
    `<ul>${low.map((c) => `<li><strong>${c.name}</strong> - ${c.qtyTotal} in stock (minimum ${c.minQty})</li>`).join("")}</ul>`,
  );

  let sent = 0;
  for (const r of recipients) {
    if (await logAndSend(companyId, triggeredByUserId, "low_stock_consumable", r, `[ITAM] ${low.length} consumable(s) low on stock`, html, low.length)) sent++;
  }
  return { success: true, sent, recipients: recipients.length, message: `Sent to ${sent}/${recipients.length} recipient(s).` };
}

// Thin session-authorized wrappers - what /settings/notifications' manual
// "Send now" buttons call. Signatures unchanged from before this refactor.

export async function sendLicenseExpiryDigestAction(): Promise<DigestResult> {
  const actor = await requireUser();
  requirePermission(actor, "*");
  return runLicenseExpiryDigest(actor.companyId, actor.id);
}

export async function sendWarrantyExpiryDigestAction(): Promise<DigestResult> {
  const actor = await requireUser();
  requirePermission(actor, "*");
  return runWarrantyExpiryDigest(actor.companyId, actor.id);
}

export async function sendPendingApprovalReminderAction(): Promise<DigestResult> {
  const actor = await requireUser();
  requirePermission(actor, "*");
  return runPendingApprovalReminder(actor.companyId, actor.id);
}

export async function sendOverdueCheckoutReminderAction(): Promise<DigestResult> {
  const actor = await requireUser();
  requirePermission(actor, "*");
  return runOverdueCheckoutReminder(actor.companyId, actor.id);
}

export async function sendLowStockConsumableAlertAction(): Promise<DigestResult> {
  const actor = await requireUser();
  requirePermission(actor, "*");
  return runLowStockConsumableAlert(actor.companyId, actor.id);
}

/**
 * Runs every digest for one company, no session required - what the cron
 * route calls per-company. triggeredByUserId is null (no human triggered
 * this), which notification_log's schema already supports.
 */
export async function runAllDigestsForCompany(companyId: string) {
  const results = await Promise.all([
    runLicenseExpiryDigest(companyId, null),
    runWarrantyExpiryDigest(companyId, null),
    runPendingApprovalReminder(companyId, null),
    runOverdueCheckoutReminder(companyId, null),
    runLowStockConsumableAlert(companyId, null),
  ]);
  return {
    licenseExpiry: results[0],
    warrantyExpiry: results[1],
    pendingApproval: results[2],
    overdueCheckout: results[3],
    lowStockConsumable: results[4],
  };
}
