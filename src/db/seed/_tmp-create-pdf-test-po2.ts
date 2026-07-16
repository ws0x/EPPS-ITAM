import { db } from "../client";
import { companies, users } from "../schema/core";
import { purchaseOrders, purchaseOrderLines } from "../schema/purchase-orders";
import { eq } from "drizzle-orm";

async function main() {
  const [company] = await db.select().from(companies).limit(1);
  const [admin] = await db.select().from(users).where(eq(users.email, "yusuf.naeem@makkacorp.com")).limit(1);

  const [po] = await db
    .insert(purchaseOrders)
    .values({
      companyId: company.id,
      poNumber: "IT PDF-TEST-2026-V2",
      poYear: 2026,
      poSequence: 998,
      date: "2026-07-16",
      quotationNumber: "RFQ-2026-0042",
      supplierName: "PDF Test Supplier V2",
      supplierAddress: "123 Test St, Cairo",
      supplierTel: "0100000000",
      supplierEmail: "supplier@test.com",
      vatRegistered: true,
      advancePaymentRegistered: false,
      eInvoiced: true,
      miscAmount: "500",
      miscType: "Shipping Cost",
      paymentTerm: "Net 30",
      deliveryDate: "2026-08-01",
      note: "Test note for PDF rendering v2",
      preparedByUserId: admin.id,
      approverUserId: company.managingDirectorUserId!,
      status: "draft",
    })
    .returning();

  await db.insert(purchaseOrderLines).values([
    {
      poId: po.id,
      lineNumber: 1,
      itemCode: "LAP-0001",
      description: "Dell Laptop XPS 15 Long Description Test",
      unit: "pcs",
      unitPrice: "25000",
      quantity: "2",
      beneficiaryCompany: "Makka",
      beneficiaryDepartment: "IT",
      beneficiaryEmployee: "John Doe",
    },
    {
      poId: po.id,
      lineNumber: 2,
      itemCode: null,
      description: "Office Chairs",
      unit: "pcs",
      unitPrice: "1500",
      quantity: "10",
      beneficiaryCompany: "Fibco Global",
      beneficiaryDepartment: "HR & Personnel",
      beneficiaryEmployee: null,
    },
    {
      poId: po.id,
      lineNumber: 3,
      itemCode: "MON-0012",
      description: "Dell 27\" Monitor",
      unit: "pcs",
      unitPrice: "8500",
      quantity: "5",
      beneficiaryCompany: "Factory - MIG",
      beneficiaryDepartment: "Machinery Sales",
      beneficiaryEmployee: "Ahmed Saeed",
    },
  ]);

  console.log("Created test PO id:", po.id);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
