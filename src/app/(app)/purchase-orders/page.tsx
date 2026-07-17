import { listPurchaseOrders } from "@/lib/actions/purchase-orders";
import { CreatePoDialog } from "./create-po-dialog";
import { PurchaseOrdersTable } from "./purchase-orders-table";
import { ListFilterBar } from "@/components/list-filter-bar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { ListPagination } from "@/components/list-pagination";
import { PageHeader } from "@/components/page-header";

const STATUS_OPTIONS = [
  { id: "draft", name: "Draft" },
  { id: "pending_approval", name: "Pending Approval" },
  { id: "approved", name: "Approved" },
  { id: "rejected", name: "Rejected" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const { search, page, status, sort, dir } = await searchParams;
  const statuses = status ? status.split(",").filter(Boolean) : [];

  const poResult = await listPurchaseOrders(search, {
    page: Number(page || "1"),
    statuses,
    sort,
    dir: dir === "desc" ? "desc" : "asc",
  });
  const orders = poResult.data;

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("search", search);
  if (status) exportParams.set("status", status);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Orders"
        description="Create, submit, and track purchase orders through Managing Director approval."
        actions={
          <div className="flex items-center gap-3">
            <ExportCsvButton href={`/api/export/purchase-orders?${exportParams.toString()}`} />
            <CreatePoDialog />
          </div>
        }
      />

      <ListFilterBar
        placeholder="Search purchase orders..."
        persistKey="itam_po_filters"
        multiFilters={[{ key: "status", label: "Status", options: STATUS_OPTIONS }]}
      />

      <PurchaseOrdersTable orders={orders} />

      <ListPagination
        basePath="/purchase-orders"
        page={poResult.page}
        totalPages={poResult.totalPages}
        totalCount={poResult.totalCount}
        limit={poResult.limit}
        itemLabel="purchase orders"
      />
    </div>
  );
}
