import { listComponents, listComponentCategories } from "@/lib/actions/components";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listAssetsForPicker } from "@/lib/actions/assets";
import { ComponentDialog } from "./component-dialog";
import { ComponentsTable } from "./components-table";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function ComponentsPage({
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

  const [componentResult, categories, manufacturers, assets] = await Promise.all([
    listComponents(search, {
      page: Number(page || "1"),
      categoryIds,
      manufacturerIds,
      sort,
      dir: dir === "desc" ? "desc" : "asc",
    }),
    listComponentCategories(),
    listManufacturers(),
    listAssetsForPicker(),
  ]);

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (categoryId) exportParams.set("categoryId", categoryId);
  if (manufacturerId) exportParams.set("manufacturerId", manufacturerId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Inventory"
        title="Components"
        description={`${componentResult.totalCount} total`}
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/components?${exportParams.toString()}`} />
            <ComponentDialog categories={categories} manufacturers={manufacturers} />
          </div>
        }
      />

      <ListFilterBar
        placeholder="Search components..."
        persistKey="itam_components_filters"
        multiFilters={[
          { key: "categoryId", label: "Category", options: categories },
          { key: "manufacturerId", label: "Manufacturer", options: manufacturers },
        ]}
      />

      <ComponentsTable
        components={componentResult.data}
        categories={categories}
        manufacturers={manufacturers}
        assets={assets}
      />

      <ListPagination
        basePath="/components"
        page={componentResult.page}
        totalPages={componentResult.totalPages}
        totalCount={componentResult.totalCount}
        limit={componentResult.limit}
        itemLabel="components"
      />
    </div>
  );
}
