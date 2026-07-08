import { notFound } from "next/navigation";
import { getAsset } from "@/lib/actions/assets";
import { listModels } from "@/lib/actions/models";
import { listStatusLabels } from "@/lib/actions/status-labels";
import { listLocations } from "@/lib/actions/locations";
import { listDepartments } from "@/lib/actions/departments";
import { listUsers } from "@/lib/actions/users";
import { AssetForm } from "../asset-form";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset, models, statusLabels, locations, departments, users] = await Promise.all([
    getAsset(id),
    listModels(),
    listStatusLabels(),
    listLocations(),
    listDepartments(),
    listUsers(),
  ]);

  if (!asset) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">{asset.assetTag}</h1>
      <AssetForm
        models={models}
        statusLabels={statusLabels}
        locations={locations}
        departments={departments}
        users={users}
        editing={{
          id: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          serial: asset.serial,
          modelId: asset.modelId,
          statusId: asset.statusId,
          locationId: asset.locationId,
          departmentId: asset.departmentId,
          assignedToUserId: asset.assignedToUserId,
          purchaseDate: asset.purchaseDate,
          purchaseCost: asset.purchaseCost,
          warrantyMonths: asset.warrantyMonths,
          notes: asset.notes,
        }}
      />
    </div>
  );
}
