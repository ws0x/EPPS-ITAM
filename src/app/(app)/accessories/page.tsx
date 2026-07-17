import { listAccessories, listAccessoryCategories } from "@/lib/actions/accessories";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { AccessoryDialog } from "./accessory-dialog";
import { AccessoriesTable } from "./accessories-table";
import { ListSearchBar } from "@/components/list-search-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = await searchParams;
  const [accessoryResult, categories, manufacturers, users] = await Promise.all([
    listAccessories(search, { page: Number(page || "1") }),
    listAccessoryCategories(),
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
        title="Accessories"
        description={`${accessoryResult.totalCount} total`}
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/accessories?${exportParams.toString()}`} />
            <AccessoryDialog categories={categories} manufacturers={manufacturers} />
          </div>
        }
      />

      <ListSearchBar placeholder="Search accessories..." persistKey="itam_accessories_filters" />

      <AccessoriesTable
        accessories={accessoryResult.data}
        categories={categories}
        manufacturers={manufacturers}
        users={formattedUsers}
      />

      <ListPagination
        basePath="/accessories"
        page={accessoryResult.page}
        totalPages={accessoryResult.totalPages}
        totalCount={accessoryResult.totalCount}
        limit={accessoryResult.limit}
        itemLabel="accessories"
      />
    </div>
  );
}
