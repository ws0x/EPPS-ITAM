import { listLicenses, listLicenseCategories } from "@/lib/actions/licenses";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { LicenseDialog } from "./license-dialog";
import { LicenseFilterBar } from "./license-filter-bar";
import { LicensesTable } from "./licenses-table";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    expiresFrom?: string;
    expiresTo?: string;
    page?: string;
    categoryId?: string;
    manufacturerId?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { search, expiresFrom, expiresTo, page, categoryId, manufacturerId, sort, dir } = await searchParams;
  const categoryIds = categoryId ? categoryId.split(",").filter(Boolean) : [];
  const manufacturerIds = manufacturerId ? manufacturerId.split(",").filter(Boolean) : [];

  const [licenseResult, categories, manufacturers] = await Promise.all([
    listLicenses({
      search,
      expiresFrom,
      expiresTo,
      page: Number(page || "1"),
      categoryIds,
      manufacturerIds,
      sort,
      dir: dir === "desc" ? "desc" : "asc",
    }),
    listLicenseCategories(),
    listManufacturers(),
  ]);
  const licenseList = licenseResult.data;

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (expiresFrom) exportParams.set("expiresFrom", expiresFrom);
  if (expiresTo) exportParams.set("expiresTo", expiresTo);
  if (categoryId) exportParams.set("categoryId", categoryId);
  if (manufacturerId) exportParams.set("manufacturerId", manufacturerId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Inventory"
        title="Licenses"
        description={`${licenseResult.totalCount} total`}
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/licenses?${exportParams.toString()}`} />
            <LicenseDialog categories={categories} manufacturers={manufacturers} />
          </div>
        }
      />

      <LicenseFilterBar categories={categories} manufacturers={manufacturers} />

      <LicensesTable licenses={licenseList} categories={categories} manufacturers={manufacturers} />

      <ListPagination
        basePath="/licenses"
        page={licenseResult.page}
        totalPages={licenseResult.totalPages}
        totalCount={licenseResult.totalCount}
        limit={licenseResult.limit}
        itemLabel="licenses"
      />
    </div>
  );
}
