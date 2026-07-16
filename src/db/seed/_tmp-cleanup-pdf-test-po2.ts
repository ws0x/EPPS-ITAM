import { eq } from "drizzle-orm";
import { db } from "../client";
import { purchaseOrders } from "../schema/purchase-orders";

async function main() {
  const [deleted] = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, "8d1cefe0-83e7-4d56-8f6d-7f3a62e5544b")).returning();
  console.log("Deleted test PO:", deleted?.poNumber);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
