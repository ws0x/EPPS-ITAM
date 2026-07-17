import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listAccessories, listAccessoryCategories } from "@/lib/actions/accessories";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "accessories:read");

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const categoryId = request.nextUrl.searchParams.get("categoryId");
    const manufacturerId = request.nextUrl.searchParams.get("manufacturerId");
    const [accessoryResult, categories, manufacturers] = await Promise.all([
      listAccessories(search, {
        limit: 1_000_000,
        categoryIds: categoryId ? categoryId.split(",").filter(Boolean) : [],
        manufacturerIds: manufacturerId ? manufacturerId.split(",").filter(Boolean) : [],
      }),
      listAccessoryCategories(),
      listManufacturers(),
    ]);
    const data = accessoryResult.data;
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const manufacturerById = new Map(manufacturers.map((m) => [m.id, m.name]));

    const headers = ["Name", "Category", "Manufacturer", "Quantity Total", "Quantity Available", "Min Quantity"];
    const rows = data.map((a) => [
      a.name,
      categoryById.get(a.categoryId) ?? "",
      a.manufacturerId ? (manufacturerById.get(a.manufacturerId) ?? "") : "",
      a.qtyTotal,
      a.qtyAvailable,
      a.minQty,
    ]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("accessories_export") });
  } catch (error) {
    console.error("Failed to export accessories:", error);
    return NextResponse.json({ error: "Failed to export accessories" }, { status: 500 });
  }
}
