import Link from "next/link";
import { listAssets } from "@/lib/actions/assets";
import { listUsers } from "@/lib/actions/users";
import { AssetsTable } from "./assets-table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Plus } from "lucide-react";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page || "1");
  const search = resolvedSearchParams.search || "";

  const [assetsResult, users] = await Promise.all([
    listAssets({ page, limit: 50, search }),
    listUsers(),
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
        pagination={{
          page: assetsResult.page,
          totalPages: assetsResult.totalPages,
          totalCount: assetsResult.totalCount,
          limit: assetsResult.limit,
          search,
        }}
      />
    </div>
  );
}
