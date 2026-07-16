import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, ilike, inArray, SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { assets, models, categories, statusLabels, locations, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "assets:read"); // Standard read access needed

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const statusId = searchParams.get("statusId");
    const categoryId = searchParams.get("categoryId");
    const locationId = searchParams.get("locationId");

    const assignedUser = users;

    let whereClause: SQL | undefined = eq(assets.companyId, user.companyId);
    if (search) {
      whereClause = and(
        whereClause,
        or(
          ilike(assets.assetTag, `%${search}%`),
          ilike(assets.name, `%${search}%`),
          ilike(assets.serial, `%${search}%`),
          ilike(models.name, `%${search}%`),
          ilike(categories.name, `%${search}%`)
        )
      );
    }
    
    const statusIds = statusId?.split(",").filter(Boolean) ?? [];
    const categoryIds = categoryId?.split(",").filter(Boolean) ?? [];
    const locationIds = locationId?.split(",").filter(Boolean) ?? [];

    if (statusIds.length === 1) {
      whereClause = and(whereClause, eq(assets.statusId, statusIds[0]));
    } else if (statusIds.length > 1) {
      whereClause = and(whereClause, inArray(assets.statusId, statusIds));
    }
    if (categoryIds.length === 1) {
      whereClause = and(whereClause, eq(models.categoryId, categoryIds[0]));
    } else if (categoryIds.length > 1) {
      whereClause = and(whereClause, inArray(models.categoryId, categoryIds));
    }
    if (locationIds.length === 1) {
      whereClause = and(whereClause, eq(assets.locationId, locationIds[0]));
    } else if (locationIds.length > 1) {
      whereClause = and(whereClause, inArray(assets.locationId, locationIds));
    }

    const data = await db
      .select({
        assetTag: assets.assetTag,
        name: assets.name,
        serial: assets.serial,
        category: categories.name,
        model: models.name,
        status: statusLabels.name,
        location: locations.name,
        assignedToFirstName: assignedUser.firstName,
        assignedToLastName: assignedUser.lastName,
        assignedToEmail: assignedUser.email,
        purchaseDate: assets.purchaseDate,
        purchaseCost: assets.purchaseCost,
      })
      .from(assets)
      .innerJoin(models, eq(assets.modelId, models.id))
      .innerJoin(categories, eq(models.categoryId, categories.id))
      .innerJoin(statusLabels, eq(assets.statusId, statusLabels.id))
      .leftJoin(locations, eq(assets.locationId, locations.id))
      .leftJoin(assignedUser, eq(assets.assignedToUserId, assignedUser.id))
      .where(whereClause);

    // Generate CSV
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
      "Purchase Cost"
    ];

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return "";
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = data.map((row) => {
      const assignedTo = row.assignedToEmail
        ? row.assignedToFirstName
          ? `${row.assignedToFirstName} ${row.assignedToLastName ?? ""}`.trim()
          : row.assignedToEmail
        : "";

      return [
        escapeCsv(row.assetTag),
        escapeCsv(row.name),
        escapeCsv(row.serial),
        escapeCsv(row.category),
        escapeCsv(row.model),
        escapeCsv(row.status),
        escapeCsv(row.location),
        escapeCsv(assignedTo),
        escapeCsv(row.purchaseDate),
        escapeCsv(row.purchaseCost?.toString()),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="assets_export_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Failed to export assets:", error);
    return NextResponse.json({ error: "Failed to export assets" }, { status: 500 });
  }
}
