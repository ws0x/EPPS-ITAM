import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listPurchaseOrders } from "@/lib/actions/purchase-orders";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "purchase_orders:read");

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const data = await listPurchaseOrders(search);

    const headers = ["PO Number", "Date", "Supplier", "Status", "Prepared By"];
    const rows = data.map((po) => [
      po.poNumber,
      po.date,
      po.supplierName,
      po.status,
      po.preparedByFirstName ? `${po.preparedByFirstName} ${po.preparedByLastName ?? ""}`.trim() : po.preparedByEmail,
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("purchase_orders_export") });
  } catch (error) {
    console.error("Failed to export purchase orders:", error);
    return NextResponse.json({ error: "Failed to export purchase orders" }, { status: 500 });
  }
}
