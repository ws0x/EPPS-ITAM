import { listModels } from "@/lib/actions/models";
import { listStatusLabels } from "@/lib/actions/status-labels";
import { listLocations } from "@/lib/actions/locations";
import { listDepartments } from "@/lib/actions/departments";
import { listUsers } from "@/lib/actions/users";
import { AssetForm } from "../asset-form";

export default async function NewAssetPage() {
  const [models, statusLabels, locations, departments, users] = await Promise.all([
    listModels(),
    listStatusLabels(),
    listLocations(),
    listDepartments(),
    listUsers(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Add Asset</h1>
      <AssetForm
        models={models}
        statusLabels={statusLabels}
        locations={locations}
        departments={departments}
        users={users}
      />
    </div>
  );
}
