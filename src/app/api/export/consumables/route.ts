import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listConsumables, listConsumableCategories } from "@/lib/actions/consumables";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "consumables:read");

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const categoryId = request.nextUrl.searchParams.get("categoryId");
    const manufacturerId = request.nextUrl.searchParams.get("manufacturerId");
    const [consumableResult, categories, manufacturers] = await Promise.all([
      listConsumables(search, {
        limit: 1_000_000,
        categoryIds: categoryId ? categoryId.split(",").filter(Boolean) : [],
        manufacturerIds: manufacturerId ? manufacturerId.split(",").filter(Boolean) : [],
      }),
      listConsumableCategories(),
      listManufacturers(),
    ]);
    const data = consumableResult.data;
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const manufacturerById = new Map(manufacturers.map((m) => [m.id, m.name]));

    const headers = ["Name", "Category", "Manufacturer", "Quantity", "Min Quantity"];
    const rows = data.map((c) => [
      c.name,
      categoryById.get(c.categoryId) ?? "",
      c.manufacturerId ? (manufacturerById.get(c.manufacturerId) ?? "") : "",
      c.qtyTotal,
      c.minQty,
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("consumables_export") });
  } catch (error) {
    console.error("Failed to export consumables:", error);
    return NextResponse.json({ error: "Failed to export consumables" }, { status: 500 });
  }
}
