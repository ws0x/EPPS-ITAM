import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/dal";
import { getPurchaseOrder } from "@/lib/actions/purchase-orders";
import { db } from "@/db/client";
import { users, companies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PurchaseOrderPdf } from "@/lib/pdf/purchase-order-pdf";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const data = await getPurchaseOrder(id);
  if (!data) return new Response("Not found", { status: 404 });
  const { order, lines } = data;

  const [preparer, approver, company] = await Promise.all([
    db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, order.preparedByUserId)).limit(1).then((r) => r[0]),
    db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, order.approverUserId)).limit(1).then((r) => r[0]),
    db.select().from(companies).where(eq(companies.id, order.companyId)).limit(1).then((r) => r[0]),
  ]);

  const nameOf = (u: typeof preparer) => {
    if (!u) return "-";
    if (u.email === "yusuf.naeem@eppscorp.com") return "Yusuf Naeem";
    return u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email;
  };

  const buffer = await renderToBuffer(
    PurchaseOrderPdf({
      order: {
        poNumber: order.poNumber,
        date: order.date,
        prNumber: order.prNumber,
        quotationNumber: order.quotationNumber,
        supplierName: order.supplierName,
        supplierAddress: order.supplierAddress,
        supplierTel: order.supplierTel,
        supplierFax: order.supplierFax,
        supplierEmail: order.supplierEmail,
        vatRegistered: order.vatRegistered,
        advancePaymentRegistered: order.advancePaymentRegistered,
        eInvoiced: order.eInvoiced,
        miscAmount: order.miscAmount,
        miscType: order.miscType,
        paymentTerm: order.paymentTerm,
        deliveryDate: order.deliveryDate,
        note: order.note,
        status: order.status,
        preparerName: nameOf(preparer),
        approverName: nameOf(approver),
      },
      lines,
      letterhead: {
        logoUrl: company?.letterheadLogoUrl ?? null,
        nameLine1: company?.letterheadNameLine1 ?? null,
        nameLine2: company?.letterheadNameLine2 ?? null,
        tagline: company?.letterheadTagline ?? null,
        officePhone: company?.letterheadOfficePhone ?? null,
        mobilePhone: company?.letterheadMobilePhone ?? null,
        fax: company?.letterheadFax ?? null,
        emails: company?.letterheadEmails ?? null,
        website: company?.letterheadWebsite ?? null,
        address: company?.letterheadAddress ?? null,
      },
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${order.poNumber}.pdf"`,
    },
  });
}
