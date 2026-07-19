import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, models, categories } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requireUser();
    const isTechOrManager = user.role.name === "admin" || user.role.name === "it_manager" || user.role.name === "technician";
    if (!isTechOrManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const rows = await db
      .select({
        assetTag: assets.assetTag,
        name: assets.name,
        category: categories.name,
        nextAuditDate: assets.nextAuditDate,
      })
      .from(assets)
      .innerJoin(models, eq(assets.modelId, models.id))
      .innerJoin(categories, eq(models.categoryId, categories.id))
      .where(and(eq(assets.companyId, user.companyId)));

    const headers = ["Asset Tag", "Name", "Category", "Next Audit Date", "Compliance Status"];
    const csvRows = rows.map((a) => {
      const status = !a.nextAuditDate ? "Never Scheduled" : a.nextAuditDate < today ? "Overdue" : "Upcoming";
      return [a.assetTag, a.name, a.category, a.nextAuditDate, status];
    });

    return new NextResponse(buildCsv(headers, csvRows), { headers: csvResponseHeaders("audit_compliance_report") });
  } catch (error) {
    console.error("Failed to export audit compliance report:", error);
    return NextResponse.json({ error: "Failed to export audit compliance report" }, { status: 500 });
  }
}
