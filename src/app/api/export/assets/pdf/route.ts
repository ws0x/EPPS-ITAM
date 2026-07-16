import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { requirePermission } from "@/lib/auth/permissions";
import { listAssetsForExport } from "@/lib/actions/assets";
import { AssetRegisterPdf } from "@/lib/pdf/asset-register-pdf";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    requirePermission(user, "assets:read");

    const searchParams = request.nextUrl.searchParams;
    const [data, company] = await Promise.all([
      listAssetsForExport({
        search: searchParams.get("search")?.trim() ?? undefined,
        statusId: searchParams.get("statusId") ?? undefined,
        categoryId: searchParams.get("categoryId") ?? undefined,
        locationId: searchParams.get("locationId") ?? undefined,
        purchaseDateFrom: searchParams.get("purchaseDateFrom") ?? undefined,
        purchaseDateTo: searchParams.get("purchaseDateTo") ?? undefined,
      }),
      db.select().from(companies).where(eq(companies.id, user.companyId)).limit(1).then((r) => r[0]),
    ]);

    const generatedByName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email;

    const buffer = await renderToBuffer(
      AssetRegisterPdf({
        data: {
          assets: data.map((row) => ({
            assetTag: row.assetTag,
            name: row.name,
            category: row.category,
            status: row.status,
            location: row.location,
            assignedTo: row.assignedToEmail
              ? row.assignedToFirstName
                ? `${row.assignedToFirstName} ${row.assignedToLastName ?? ""}`.trim()
                : row.assignedToEmail
              : "",
          })),
          letterhead: {
            logoUrl: company?.letterheadLogoUrl ?? null,
            nameLine1: company?.letterheadNameLine1 ?? null,
            nameLine2: company?.letterheadNameLine2 ?? null,
            tagline: company?.letterheadTagline ?? null,
            officePhone: company?.letterheadOfficePhone ?? null,
            mobilePhone: company?.letterheadMobilePhone ?? null,
            fax: company?.letterheadFax ?? null,
            emails: company?.letterheadEmails ?? null,
            website: company?.letterheadWebsite ?? null,
            address: company?.letterheadAddress ?? null,
          },
          generatedAt: new Date().toLocaleDateString("en-GB"),
          generatedBy: generatedByName,
        },
      }),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="asset_register_${new Date().toISOString().split("T")[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to export asset register PDF:", error);
    return NextResponse.json({ error: "Failed to export asset register PDF" }, { status: 500 });
  }
}
