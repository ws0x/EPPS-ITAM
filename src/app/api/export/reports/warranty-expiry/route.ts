import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { getWarrantyExpiryForecast } from "@/lib/actions/analytics";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  try {
    await requireUser();
    const upcoming = await getWarrantyExpiryForecast();

    const headers = ["Asset", "Warranty Expires", "Days Until Expiry"];
    const rows = upcoming.map((a) => [a.label, a.expiresAt, a.daysUntil]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("warranty_expiry_report") });
  } catch (error) {
    console.error("Failed to export warranty expiry report:", error);
    return NextResponse.json({ error: "Failed to export warranty expiry report" }, { status: 500 });
  }
}
