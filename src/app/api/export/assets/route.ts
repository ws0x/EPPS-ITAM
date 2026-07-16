import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listAssetsForExport } from "@/lib/actions/assets";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "assets:read"); // Standard read access needed

    const searchParams = request.nextUrl.searchParams;
    const data = await listAssetsForExport({
      search: searchParams.get("search")?.trim() ?? undefined,
      statusId: searchParams.get("statusId") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      locationId: searchParams.get("locationId") ?? undefined,
      purchaseDateFrom: searchParams.get("purchaseDateFrom") ?? undefined,
      purchaseDateTo: searchParams.get("purchaseDateTo") ?? undefined,
    });

    const headers = [
      "Asset Tag",
      "Name",
      "Serial",
      "Category",
      "Model",
      "Status",
      "Location",
      "Assigned To",
      "Purchase Date",
      "Purchase Cost",
    ];

    const rows = data.map((row) => {
      const assignedTo = row.assignedToEmail
        ? row.assignedToFirstName
          ? `${row.assignedToFirstName} ${row.assignedToLastName ?? ""}`.trim()
          : row.assignedToEmail
        : "";

      return [
        row.assetTag,
        row.name,
        row.serial,
        row.category,
        row.model,
        row.status,
        row.location,
        assignedTo,
        row.purchaseDate,
        row.purchaseCost,
      ];
    });

    return new NextResponse(buildCsv(headers, rows), {
      headers: csvResponseHeaders("assets_export"),
    });
  } catch (error) {
    console.error("Failed to export assets:", error);
    return NextResponse.json({ error: "Failed to export assets" }, { status: 500 });
  }
}
