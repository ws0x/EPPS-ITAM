import Link from "next/link";
import { listAssets } from "@/lib/actions/assets";
import { listUsers } from "@/lib/actions/users";
import { AssetsTable } from "./assets-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { statusLabels, categories as categoriesTable, locations as locationsTable } from "@/db/schema";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    statusId?: string;
    categoryId?: string;
    locationId?: string;
    purchaseDateFrom?: string;
    purchaseDateTo?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page || "1");
  const search = resolvedSearchParams.search || "";
  const statusId = resolvedSearchParams.statusId || "";
  const categoryId = resolvedSearchParams.categoryId || "";
  const locationId = resolvedSearchParams.locationId || "";
  const purchaseDateFrom = resolvedSearchParams.purchaseDateFrom || "";
  const purchaseDateTo = resolvedSearchParams.purchaseDateTo || "";
  const sort = resolvedSearchParams.sort || "";
  const dir = resolvedSearchParams.dir === "desc" ? "desc" : "asc";

  const [assetsResult, users, statuses, categories, locations] = await Promise.all([
    listAssets({ page, limit: 50, search, statusId, categoryId, locationId, purchaseDateFrom, purchaseDateTo, sort, dir }),
    listUsers(),
    db.select({ id: statusLabels.id, name: statusLabels.name }).from(statusLabels).orderBy(statusLabels.name),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).orderBy(categoriesTable.name),
    db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).orderBy(locationsTable.name),
  ]);

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const exportSearchParams = new URLSearchParams();
  if (search) exportSearchParams.set("search", search);
  if (statusId) exportSearchParams.set("statusId", statusId);
  if (categoryId) exportSearchParams.set("categoryId", categoryId);
  if (locationId) exportSearchParams.set("locationId", locationId);
  if (purchaseDateFrom) exportSearchParams.set("purchaseDateFrom", purchaseDateFrom);
  if (purchaseDateTo) exportSearchParams.set("purchaseDateTo", purchaseDateTo);
  const exportHref = `/api/export/assets?${exportSearchParams.toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inventory"
        title="Assets"
        description={`${assetsResult.totalCount} total`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" nativeButton={false} render={<a href={exportHref} download />}>
              Export CSV
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/assets/new" />}>
              <Plus /> Add Asset
            </Button>
          </div>
        }
      />

      <AssetsTable
        assets={assetsResult.data}
        users={formattedUsers}
        statuses={statuses}
        categories={categories}
        locations={locations}
        pagination={{
          page: assetsResult.page,
          totalPages: assetsResult.totalPages,
          totalCount: assetsResult.totalCount,
          limit: assetsResult.limit,
          search,
          statusId,
          categoryId,
          locationId,
        }}
      />
    </div>
  );
}
