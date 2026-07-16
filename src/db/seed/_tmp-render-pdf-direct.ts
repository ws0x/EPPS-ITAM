import fs from "node:fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { purchaseOrders, purchaseOrderLines, users, companies } from "../schema";
import { PurchaseOrderPdf } from "../../lib/pdf/purchase-order-pdf";

const PO_ID = "8d1cefe0-83e7-4d56-8f6d-7f3a62e5544b";

async function main() {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, PO_ID)).limit(1);
  const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, PO_ID));
  const [preparer] = await db.select().from(users).where(eq(users.id, order.preparedByUserId)).limit(1);
  const [approver] = await db.select().from(users).where(eq(users.id, order.approverUserId)).limit(1);
  const [company] = await db.select().from(companies).where(eq(companies.id, order.companyId)).limit(1);

  const nameOf = (u: typeof preparer) => (u ? (u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email) : "—");

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
        logoUrl: company.letterheadLogoUrl,
        nameLine1: company.letterheadNameLine1,
        nameLine2: company.letterheadNameLine2,
        tagline: company.letterheadTagline,
        officePhone: company.letterheadOfficePhone,
        mobilePhone: company.letterheadMobilePhone,
        fax: company.letterheadFax,
        emails: company.letterheadEmails,
        website: company.letterheadWebsite,
        address: company.letterheadAddress,
      },
    }),
  );

  const outPath = String.raw`C:\Users\youse\AppData\Local\Temp\claude\D--Projects\76bc20b9-ded4-4384-9e54-9bd76edb6d5f\scratchpad\po-test-v2.pdf`;
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote PDF to", outPath, "size:", buffer.length);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
