import { listKits } from "@/lib/actions/kits";
import { listUsers } from "@/lib/actions/users";
import { KitDialog } from "./kit-dialog";
import { KitsTable } from "./kits-table";
import { ListSearchBar } from "@/components/list-search-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const { search, page, sort, dir } = await searchParams;
  const [kitResult, users] = await Promise.all([
    listKits(search, { page: Number(page || "1"), sort, dir: dir === "desc" ? "desc" : "asc" }),
    listUsers(),
  ]);
  const kits = kitResult.data;

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
        title="Kits"
        description="Bundles of items checked out together, e.g. a new-hire kit."
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/kits?${exportParams.toString()}`} />
            <KitDialog />
          </div>
        }
      />

      <ListSearchBar placeholder="Search kits..." persistKey="itam_kits_filters" />

      <KitsTable kits={kits} users={formattedUsers} />

      <ListPagination
        basePath="/kits"
        page={kitResult.page}
        totalPages={kitResult.totalPages}
        totalCount={kitResult.totalCount}
        limit={kitResult.limit}
        itemLabel="kits"
      />
    </div>
  );
}
