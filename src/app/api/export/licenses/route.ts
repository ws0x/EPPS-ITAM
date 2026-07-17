import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listLicenses, listLicenseCategories } from "@/lib/actions/licenses";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "licenses:read");

    const searchParams = request.nextUrl.searchParams;
    const [licenseResult, categories, manufacturers] = await Promise.all([
      listLicenses({
        search: searchParams.get("search")?.trim() ?? undefined,
        expiresFrom: searchParams.get("expiresFrom") ?? undefined,
        expiresTo: searchParams.get("expiresTo") ?? undefined,
        categoryIds: searchParams.get("categoryId")?.split(",").filter(Boolean) ?? [],
        manufacturerIds: searchParams.get("manufacturerId")?.split(",").filter(Boolean) ?? [],
        // Export always covers every matching row, not just one page.
        limit: 1_000_000,
      }),
      listLicenseCategories(),
      listManufacturers(),
    ]);
    const data = licenseResult.data;
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const manufacturerById = new Map(manufacturers.map((m) => [m.id, m.name]));

    const headers = ["Name", "Category", "Manufacturer", "License Key", "Seats Used", "Seats Total", "Purchase Date", "Purchase Cost", "Expires"];
    const rows = data.map((l) => [
      l.name,
      categoryById.get(l.categoryId) ?? "",
      l.manufacturerId ? (manufacturerById.get(l.manufacturerId) ?? "") : "",
      l.licenseKey,
      l.seatsUsed,
      l.seatsTotal,
      l.purchaseDate,
      l.purchaseCost,
      l.expiresAt,
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("licenses_export") });
  } catch (error) {
    console.error("Failed to export licenses:", error);
    return NextResponse.json({ error: "Failed to export licenses" }, { status: 500 });
  }
}
