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
import { Button } from "@/components/ui/button";
import { ComponentDialog, type ComponentRow } from "./component-dialog";
import { CheckoutComponentDialog } from "./checkout-dialog";
import { SortableTableHead } from "@/components/sortable-table-head";
import { useListFilters } from "@/hooks/use-list-filters";
import { Cpu, Pencil } from "lucide-react";

type Option = { id: string; name: string };
type AssetOption = { id: string; assetTag: string; name: string | null };
type ComponentListRow = ComponentRow & { qtyAssigned: number; qtyAvailable: number };

export function ComponentsTable({
  components,
  categories,
  manufacturers,
  assets,
}: {
  components: ComponentListRow[];
  categories: Option[];
  manufacturers: Option[];
  assets: AssetOption[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));
  const { getSort, toggleSort } = useListFilters({ persistKey: "itam_components_filters" });
  const { sort, dir } = getSort();

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <SortableTableHead column="name" label="Name" sort={sort} dir={dir} onSort={toggleSort} />
            <TableHead>Category</TableHead>
            <TableHead>Manufacturer</TableHead>
            <SortableTableHead column="quantity" label="Available" sort={sort} dir={dir} onSort={toggleSort} />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {components.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Cpu className="size-8 opacity-40" />
                  <p className="text-sm">No components yet.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
          {components.map((c) => {
            const isLow = c.qtyAvailable <= c.minQty;
            return (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/components/${c.id}`} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{categoryById.get(c.categoryId)?.name ?? "-"}</TableCell>
                <TableCell>{c.manufacturerId ? (manufacturerById.get(c.manufacturerId)?.name ?? "-") : "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={isLow ? "border-amber-500 text-amber-600 bg-amber-500/10" : ""}
                  >
                    {c.qtyAvailable} / {c.qtyTotal} available
                  </Badge>
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  <CheckoutComponentDialog
                    componentId={c.id}
                    componentName={c.name}
                    maxQuantity={c.qtyAvailable}
                    assets={assets}
                  />
                  <ComponentDialog
                    categories={categories.map((cat) => ({ id: cat.id, name: cat.name }))}
                    manufacturers={manufacturers}
                    editing={c}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${c.name}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
