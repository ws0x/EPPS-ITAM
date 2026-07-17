import { listKits } from "@/lib/actions/kits";
import { listUsers } from "@/lib/actions/users";
import { KitDialog } from "./kit-dialog";
import { KitsTable } from "./kits-table";
import { ListSearchBar } from "@/components/list-search-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader } from "@/components/page-header";

export default async function KitsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const [kits, users] = await Promise.all([listKits(search), listUsers()]);

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
    </div>
  );
}
