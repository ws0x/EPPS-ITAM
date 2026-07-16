import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { getLicenseExpiryForecast } from "@/lib/actions/analytics";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  try {
    await requireUser();
    const { upcoming } = await getLicenseExpiryForecast();

    const headers = ["License Name", "Expires", "Days Until Expiry"];
    const rows = upcoming.map((l) => [l.name, l.expiresAt, l.daysUntil]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("license_expiry_report") });
  } catch (error) {
    console.error("Failed to export license expiry report:", error);
    return NextResponse.json({ error: "Failed to export license expiry report" }, { status: 500 });
  }
}
