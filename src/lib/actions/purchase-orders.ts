"use server";

import crypto from "node:crypto";
import { eq, and, or, asc, desc, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { db } from "@/db/client";
import {
  companies,
  users,
  purchaseOrders,
  purchaseOrderLines,
  poBeneficiaryCompanies,
  poBeneficiaryDepartments,
} from "@/db/schema";
import { logCreate, logUpdate, logDelete, logEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { nextPoNumber, currentPoYear } from "@/lib/po-number";

export type ActionState = { error?: string; success?: boolean; emailError?: string } | undefined;

export async function listPurchaseOrders(search?: string) {
  const user = await requireUser();
  const preparedBy = users;
  const trimmed = search?.trim();

  return db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      date: purchaseOrders.date,
      supplierName: purchaseOrders.supplierName,
      status: purchaseOrders.status,
      preparedByFirstName: preparedBy.firstName,
      preparedByLastName: preparedBy.lastName,
      preparedByEmail: preparedBy.email,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(preparedBy, eq(purchaseOrders.preparedByUserId, preparedBy.id))
    .where(
      and(
        eq(purchaseOrders.companyId, user.companyId),
        trimmed
          ? or(ilike(purchaseOrders.poNumber, `%${trimmed}%`), ilike(purchaseOrders.supplierName, `%${trimmed}%`))
          : undefined,
      ),
    )
    .orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseOrder(id: string) {
  const user = await requireUser();

  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, user.companyId)))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select()
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, id))
    .orderBy(asc(purchaseOrderLines.lineNumber));

  return { order, lines };
}

export async function listPoBeneficiaryCompanies() {
  const user = await requireUser();
  return db
    .select()
    .from(poBeneficiaryCompanies)
    .where(eq(poBeneficiaryCompanies.companyId, user.companyId))
    .orderBy(asc(poBeneficiaryCompanies.name));
}

export async function listPoBeneficiaryDepartments() {
  const user = await requireUser();
  return db
    .select()
    .from(poBeneficiaryDepartments)
    .where(eq(poBeneficiaryDepartments.companyId, user.companyId))
    .orderBy(asc(poBeneficiaryDepartments.name));
}

/** Creates a bare draft PO (no lines yet) and sends the user straight to its edit page. */
export async function createPurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "purchase_orders:*");

  const [company] = await db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1);
  if (!company?.managingDirectorUserId) {
    return { error: "No Managing Director is configured for this company yet - set companies.managingDirectorUserId first." };
  }

  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  if (!supplierName) return { error: "Supplier name is required." };
  if (!dateStr) return { error: "Date is required." };

  let newPoId = "";
  await db.transaction(async (tx) => {
    const year = currentPoYear();
    const { sequence, poNumber } = await nextPoNumber(tx, user.companyId, year);

    const [newPo] = await tx
      .insert(purchaseOrders)
      .values({
        companyId: user.companyId,
        poNumber,
        poYear: year,
        poSequence: sequence,
        date: dateStr,
        prNumber: emptyToNull(formData.get("prNumber")),
        supplierName,
        supplierAddress: emptyToNull(formData.get("supplierAddress")),
        supplierTel: emptyToNull(formData.get("supplierTel")),
        supplierFax: emptyToNull(formData.get("supplierFax")),
        supplierEmail: emptyToNull(formData.get("supplierEmail")),
        preparedByUserId: user.id,
        approverUserId: company.managingDirectorUserId!,
        status: "draft",
      })
      .returning();

    newPoId = newPo.id;

    await logCreate(tx, {
      companyId: user.companyId,
      actorUserId: user.id,
      targetType: "purchase_order",
      targetId: newPo.id,
      row: newPo,
    });
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${newPoId}`);
}

/** Updates header fields on a still-draft PO (supplier info, terms, VAT/WHT toggles, misc charge). */
export async function updatePurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "purchase_orders:*");

  const id = String(formData.get("id") ?? "");
  const [before] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, user.companyId)))
    .limit(1);
  if (!before) return { error: "Purchase order not found." };
  if (before.status !== "draft") return { error: "Only a draft purchase order can be edited." };

  const supplierName = String(formData.get("supplierName") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "");
  if (!supplierName) return { error: "Supplier name is required." };
  if (!dateStr) return { error: "Date is required." };

  const [after] = await db
    .update(purchaseOrders)
    .set({
      date: dateStr,
      prNumber: emptyToNull(formData.get("prNumber")),
      quotationNumber: emptyToNull(formData.get("quotationNumber")),
      supplierName,
      supplierAddress: emptyToNull(formData.get("supplierAddress")),
      supplierTel: emptyToNull(formData.get("supplierTel")),
      supplierFax: emptyToNull(formData.get("supplierFax")),
      supplierEmail: emptyToNull(formData.get("supplierEmail")),
      vatRegistered: formData.get("vatRegistered") === "on",
      advancePaymentRegistered: formData.get("advancePaymentRegistered") === "on",
      eInvoiced: formData.get("eInvoiced") === "on",
      miscAmount: emptyToNull(formData.get("miscAmount")),
      miscType: emptyToNull(formData.get("miscType")),
      paymentTerm: emptyToNull(formData.get("paymentTerm")),
      deliveryDate: emptyToNull(formData.get("deliveryDate")),
      note: emptyToNull(formData.get("note")),
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, id))
    .returning();

  await logUpdate(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    targetType: "purchase_order",
    targetId: id,
    before,
    after,
  });

  revalidatePath(`/purchase-orders/${id}`);
}

export async function addPoLine(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "purchase_orders:*");

  const poId = String(formData.get("poId") ?? "");
  const [po] = await db
    .select({ status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.companyId, user.companyId)))
    .limit(1);
  if (!po) return { error: "Purchase order not found." };
  if (po.status !== "draft") return { error: "Only a draft purchase order can be edited." };

  const description = String(formData.get("description") ?? "").trim();
  const unitPrice = String(formData.get("unitPrice") ?? "");
  const quantity = String(formData.get("quantity") ?? "");
  const beneficiaryCompany = String(formData.get("beneficiaryCompany") ?? "").trim();
  const beneficiaryDepartment = String(formData.get("beneficiaryDepartment") ?? "").trim();

  if (!description) return { error: "Description is required." };
  if (!unitPrice || Number.isNaN(Number(unitPrice))) return { error: "A valid unit price is required." };
  if (!quantity || Number.isNaN(Number(quantity))) return { error: "A valid quantity is required." };
  if (!beneficiaryCompany) return { error: "Beneficiary company is required." };
  if (!beneficiaryDepartment) return { error: "Beneficiary department is required." };

  const existingLines = await db
    .select({ lineNumber: purchaseOrderLines.lineNumber })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, poId));
  const nextLineNumber = existingLines.reduce((max, l) => Math.max(max, l.lineNumber), 0) + 1;

  const [newLine] = await db
    .insert(purchaseOrderLines)
    .values({
      poId,
      lineNumber: nextLineNumber,
      itemCode: emptyToNull(formData.get("itemCode")),
      description,
      unit: emptyToNull(formData.get("unit")),
      unitPrice,
      quantity,
      beneficiaryCompany,
      beneficiaryDepartment,
      beneficiaryEmployee: emptyToNull(formData.get("beneficiaryEmployee")),
    })
    .returning();

  await logEvent(db, {
    companyId: user.companyId,
    actorUserId: user.id,
    actionType: "purchase_order_line.added",
    targetType: "purchase_order",
    targetId: poId,
    meta: { lineId: newLine.id, description, unitPrice, quantity },
  });

  revalidatePath(`/purchase-orders/${poId}`);
}

export async function removePoLine(formData: FormData) {
  const user = await requireUser();
  requirePermission(user, "purchase_orders:*");

  const poId = String(formData.get("poId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");

  const [po] = await db
    .select({ status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.companyId, user.companyId)))
    .limit(1);
  if (!po || po.status !== "draft") return;

  const [removed] = await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.id, lineId)).returning();

  if (removed) {
    await logDelete(db, {
      companyId: user.companyId,
      actorUserId: user.id,
      targetType: "purchase_order",
      targetId: poId,
      row: { ...removed, poId },
    });
  }

  revalidatePath(`/purchase-orders/${poId}`);
}

/** Locks the draft, generates the approval token, and emails the Managing Director. */
export async function submitPurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  requirePermission(user, "purchase_orders:*");

  const id = String(formData.get("id") ?? "");

  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.companyId, user.companyId)))
    .limit(1);
  if (!po) return { error: "Purchase order not found." };
  if (po.status !== "draft") return { error: "This purchase order has already been submitted." };

  const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, id));
  if (lines.length === 0) return { error: "Add at least one line item before submitting." };

  const [approver] = await db.select({ email: users.email }).from(users).where(eq(users.id, po.approverUserId)).limit(1);
  if (!approver) return { error: "Approver account could not be found." };

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await db.transaction(async (tx) => {
    await tx
      .update(purchaseOrders)
      .set({ status: "pending_approval", approvalTokenHash: tokenHash, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id));

    await logEvent(tx, {
      companyId: user.companyId,
      actorUserId: user.id,
      actionType: "purchase_order.submitted",
      targetType: "purchase_order",
      targetId: id,
      meta: { approverUserId: po.approverUserId },
    });
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const reviewUrl = `${appUrl}/purchase-orders/decide?id=${id}&token=${token}`;
  const preparerName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email;

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded-lg">
      <h2 style="color: #0f766e; margin-top: 0;">Purchase Order Approval Required</h2>
      <p>Hello,</p>
      <p><strong>${preparerName}</strong> has submitted purchase order <strong>${po.poNumber}</strong> (supplier: ${po.supplierName}) for your approval.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${reviewUrl}" style="background: #0f766e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          Review Purchase Order
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b;">
        Note: This link is secure and requires you to log in to the ITAM platform. The link is valid for 7 days.
      </p>
    </div>
  `;

  let emailError: string | undefined;
  try {
    const emailResult = await sendEmail({
      to: approver.email,
      subject: `[PO Approval Required] ${po.poNumber} - ${po.supplierName}`,
      html: emailHtml,
    });
    if (!emailResult.success) emailError = emailResult.error || "Unknown email delivery failure";
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
  }

  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { success: true, emailError };
}

/** Approve or reject a submitted PO. Only the designated Managing Director (or an admin override) may decide. */
export async function decidePurchaseOrder(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  const token = String(formData.get("token") ?? "");
  const status = String(formData.get("status") ?? "") as "approved" | "rejected";
  const rejectionReason = formData.get("rejectionReason") ? String(formData.get("rejectionReason")).trim() : null;

  if (!id) return { error: "Purchase order ID is required." };
  if (!token) return { error: "Security token is required." };
  if (status !== "approved" && status !== "rejected") return { error: "Invalid decision." };
  if (status === "rejected" && !rejectionReason) return { error: "A reason must be provided when rejecting." };

  try {
    await db.transaction(async (tx) => {
      const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
      if (!po) throw new Error("Purchase order not found.");
      if (po.status !== "pending_approval") {
        throw new Error(`This purchase order has already been decided (${po.status}).`);
      }

      const hasOverride = user.role.name === "admin";
      if (po.approverUserId !== user.id && !hasOverride) {
        throw new Error("You are not authorized to decide on this purchase order.");
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      if (po.approvalTokenHash !== tokenHash) {
        throw new Error("Security token mismatch. This link is unauthorized.");
      }

      // updatedAt doubles as "submitted at" here: submitPurchaseOrder() is the last thing
      // to touch a pending_approval row (edits are blocked once it leaves draft), so it's
      // stable until decided - no separate submittedAt column needed.
      const diffDays = Math.ceil(Math.abs(Date.now() - po.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) throw new Error("This approval link has expired (exceeded 7-day limit).");

      await tx
        .update(purchaseOrders)
        .set({
          status,
          rejectionReason: status === "rejected" ? rejectionReason : null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      await logEvent(tx, {
        companyId: po.companyId,
        actorUserId: user.id,
        actionType: status === "approved" ? "purchase_order.approved" : "purchase_order.rejected",
        targetType: "purchase_order",
        targetId: id,
        meta: { rejectionReason },
      });
    });

    revalidatePath(`/purchase-orders/${id}`);
    revalidatePath("/purchase-orders");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to process purchase order decision." };
  }
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const str = value ? String(value).trim() : "";
  return str.length ? str : null;
}
