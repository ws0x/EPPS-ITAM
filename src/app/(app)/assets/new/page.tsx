import { listModels } from "@/lib/actions/models";
import { listStatusLabels } from "@/lib/actions/status-labels";
import { listLocations } from "@/lib/actions/locations";
import { listDepartments } from "@/lib/actions/departments";
import { listDepreciationSchedules } from "@/lib/actions/depreciations";
import { AssetForm } from "../asset-form";

export default async function NewAssetPage() {
  const [models, statusLabels, locations, departments, depreciationSchedules] = await Promise.all([
    listModels(),
    listStatusLabels(),
    listLocations(),
    listDepartments(),
    listDepreciationSchedules(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Add Asset</h1>
      <AssetForm
        models={models}
        statusLabels={statusLabels}
        locations={locations}
        departments={departments}
        depreciationSchedules={depreciationSchedules}
      />
    </div>
  );
}
