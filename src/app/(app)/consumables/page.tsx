import { listConsumables, listConsumableCategories } from "@/lib/actions/consumables";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { ConsumableDialog } from "./consumable-dialog";
import { ConsumablesTable } from "./consumables-table";
import { ListSearchBar } from "@/components/list-search-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";

export default async function ConsumablesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [consumableList, categories, manufacturers, users] = await Promise.all([
    listConsumables(search),
    listConsumableCategories(),
    listManufacturers(),
    listUsers(),
  ]);

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Inventory"
        title="Consumables"
        description={`${consumableList.length} total`}
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/consumables?${exportParams.toString()}`} />
            <ConsumableDialog categories={categories} manufacturers={manufacturers} />
          </div>
        }
      />

      <ListSearchBar placeholder="Search consumables..." persistKey="itam_consumables_filters" />

      <ConsumablesTable
        consumables={consumableList}
        categories={categories}
        manufacturers={manufacturers}
        users={formattedUsers}
      />
    </div>
  );
}
