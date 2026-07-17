import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listKits } from "@/lib/actions/kits";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "kits:read");

    const search = request.nextUrl.searchParams.get("search")?.trim();
    const { data } = await listKits(search, { limit: 1_000_000 });

    const headers = ["Name", "Item Count", "Notes"];
    const rows = data.map((k) => [k.name, k.itemCount, k.notes]);

    return new NextResponse(buildCsv(headers, rows), { headers: csvResponseHeaders("kits_export") });
  } catch (error) {
    console.error("Failed to export kits:", error);
    return NextResponse.json({ error: "Failed to export kits" }, { status: 500 });
  }
}
