"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SortableTableHead } from "@/components/sortable-table-head";
import { useListFilters } from "@/hooks/use-list-filters";
import { Receipt } from "lucide-react";

type PoRow = {
  id: string;
  poNumber: string;
  date: string;
  supplierName: string;
  status: string;
  preparedByFirstName: string | null;
  preparedByLastName: string | null;
  preparedByEmail: string;
};

export function PurchaseOrdersTable({ orders }: { orders: PoRow[] }) {
  const { getSort, toggleSort } = useListFilters({ persistKey: "itam_po_filters" });
  const { sort, dir } = getSort();

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableTableHead column="poNumber" label="PO Number" sort={sort} dir={dir} onSort={toggleSort} />
            <SortableTableHead column="date" label="Date" sort={sort} dir={dir} onSort={toggleSort} />
            <SortableTableHead column="supplier" label="Supplier" sort={sort} dir={dir} onSort={toggleSort} />
            <TableHead>Prepared By</TableHead>
            <SortableTableHead column="status" label="Status" sort={sort} dir={dir} onSort={toggleSort} />
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
  );
}
