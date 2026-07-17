import { listComponents, listComponentCategories } from "@/lib/actions/components";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listAssetsForPicker } from "@/lib/actions/assets";
import { ComponentDialog } from "./component-dialog";
import { ComponentsTable } from "./components-table";
import { ListSearchBar } from "@/components/list-search-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { search, page } = await searchParams;
  const [componentResult, categories, manufacturers, assets] = await Promise.all([
    listComponents(search, { page: Number(page || "1") }),
    listComponentCategories(),
    listManufacturers(),
    listAssetsForPicker(),
  ]);

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);

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

      <ListSearchBar placeholder="Search components..." persistKey="itam_components_filters" />

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
