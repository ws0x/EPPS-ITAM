import { listAccessories, listAccessoryCategories } from "@/lib/actions/accessories";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { AccessoryDialog } from "./accessory-dialog";
import { AccessoriesTable } from "./accessories-table";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    page?: string;
    categoryId?: string;
    manufacturerId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { search, page, categoryId, manufacturerId, sort, dir } = await searchParams;
  const categoryIds = categoryId ? categoryId.split(",").filter(Boolean) : [];
  const manufacturerIds = manufacturerId ? manufacturerId.split(",").filter(Boolean) : [];

  const [accessoryResult, categories, manufacturers, users] = await Promise.all([
    listAccessories(search, {
      page: Number(page || "1"),
      categoryIds,
      manufacturerIds,
      sort,
      dir: dir === "desc" ? "desc" : "asc",
    }),
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
  if (categoryId) exportParams.set("categoryId", categoryId);
  if (manufacturerId) exportParams.set("manufacturerId", manufacturerId);

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

      <ListFilterBar
        placeholder="Search accessories..."
        persistKey="itam_accessories_filters"
        multiFilters={[
          { key: "categoryId", label: "Category", options: categories },
          { key: "manufacturerId", label: "Manufacturer", options: manufacturers },
        ]}
      />

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
