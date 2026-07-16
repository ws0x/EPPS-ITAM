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
  searchParams: Promise<{ page?: string; search?: string; statusId?: string; categoryId?: string; locationId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page || "1");
  const search = resolvedSearchParams.search || "";
  const statusId = resolvedSearchParams.statusId || "";
  const categoryId = resolvedSearchParams.categoryId || "";
  const locationId = resolvedSearchParams.locationId || "";

  const [assetsResult, users, statuses, categories, locations] = await Promise.all([
    listAssets({ page, limit: 50, search, statusId, categoryId, locationId }),
    listUsers(),
    db.select({ id: statusLabels.id, name: statusLabels.name }).from(statusLabels).orderBy(statusLabels.name),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).orderBy(categoriesTable.name),
    db.select({ id: locationsTable.id, name: locationsTable.name }).from(locationsTable).orderBy(locationsTable.name),
  ]);

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inventory"
        title="Assets"
        description={`${assetsResult.totalCount} total`}
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/assets/new" />}>
            <Plus /> Add Asset
          </Button>
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
