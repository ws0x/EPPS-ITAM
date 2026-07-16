import Link from "next/link";
import { listPurchaseOrders } from "@/lib/actions/purchase-orders";
import { CreatePoDialog } from "./create-po-dialog";
import { ListSearchBar } from "@/components/list-search-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Receipt } from "lucide-react";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const orders = await listPurchaseOrders(search);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Orders"
        description="Create, submit, and track purchase orders through Managing Director approval."
        actions={<CreatePoDialog />}
      />

      <ListSearchBar placeholder="Search purchase orders..." persistKey="itam_po_filters" />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Prepared By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Receipt className="size-8 opacity-40" />
                    <p className="text-sm">No purchase orders yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {orders.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium font-mono">
                  <Link href={`/purchase-orders/${po.id}`} className="hover:text-primary hover:underline">
                    {po.poNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{new Date(po.date).toLocaleDateString()}</TableCell>
                <TableCell>{po.supplierName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {po.preparedByFirstName ? `${po.preparedByFirstName} ${po.preparedByLastName ?? ""}`.trim() : po.preparedByEmail}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      po.status === "pending_approval"
                        ? "outline"
                        : po.status === "approved"
                        ? "default"
                        : po.status === "rejected"
                        ? "destructive"
                        : "secondary"
                    }
                    className="capitalize text-[10px] px-2 py-0.5"
                  >
                    {po.status.replace("_", " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
