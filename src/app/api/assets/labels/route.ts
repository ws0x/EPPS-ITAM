import { renderToBuffer } from "@react-pdf/renderer";
import { inArray, and, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { assets, models, manufacturers } from "@/db/schema";
import { assetQrDataUrl } from "@/lib/qr";
import { AssetLabelPdf, type AssetLabelData } from "@/lib/pdf/asset-label-pdf";

export async function GET(request: Request) {
  const user = await requireUser();

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return new Response("At least one asset id is required (?ids=...)", { status: 400 });
  }

  const rows = await db
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      name: assets.name,
      modelName: sql<string>`concat(${manufacturers.name}, ' ', ${models.name})`,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(manufacturers, eq(models.manufacturerId, manufacturers.id))
    .where(and(inArray(assets.id, ids), eq(assets.companyId, user.companyId)));

  if (rows.length === 0) {
    return new Response("No matching assets found", { status: 404 });
  }

  const labels: AssetLabelData[] = await Promise.all(
    rows.map(async (r) => ({
      assetTag: r.assetTag,
      name: r.name,
      modelName: r.modelName,
      qrDataUrl: await assetQrDataUrl(r.id),
    }))
  );

  const buffer = await renderToBuffer(AssetLabelPdf({ labels }));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="asset_labels.pdf"`,
    },
  });
}
