import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { getDepreciationDetail } from "@/lib/actions/analytics";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  try {
    await requireUser();
    const rows = await getDepreciationDetail();

    const headers = [
      "Asset Tag",
      "Name",
      "Category",
      "Depreciation Schedule",
      "Purchase Date",
      "Purchase Cost",
      "Current Book Value",
    ];
    const csvRows = rows.map((r) => [
      r.assetTag,
      r.name,
      r.categoryName,
      r.scheduleName,
      r.purchaseDate,
      r.purchaseCost,
      r.currentValue,
    ]);

    return new NextResponse(buildCsv(headers, csvRows), { headers: csvResponseHeaders("depreciation_report") });
  } catch (error) {
    console.error("Failed to export depreciation report:", error);
    return NextResponse.json({ error: "Failed to export depreciation report" }, { status: 500 });
  }
}
