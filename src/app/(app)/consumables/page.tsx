import { listConsumables, listConsumableCategories } from "@/lib/actions/consumables";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { ConsumableDialog } from "./consumable-dialog";
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
import { PageHeader } from "@/components/page-header";
import { Pencil, Package } from "lucide-react";

export default async function ConsumablesPage() {
  const [consumableList, categories, manufacturers] = await Promise.all([
    listConsumables(),
    listConsumableCategories(),
    listManufacturers(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Consumables"
        description={`${consumableList.length} total`}
        actions={<ConsumableDialog categories={categories} manufacturers={manufacturers} />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {consumableList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="size-8 opacity-40" />
                    <p className="text-sm">No consumables yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {consumableList.map((c) => {
              const isLow = c.qtyTotal <= c.minQty;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{categoryById.get(c.categoryId)?.name ?? "—"}</TableCell>
                  <TableCell>{c.manufacturerId ? (manufacturerById.get(c.manufacturerId)?.name ?? "—") : "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={isLow ? "border-amber-500 text-amber-600 bg-amber-500/10" : ""}
                    >
                      {c.qtyTotal} in stock
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ConsumableDialog
                      categories={categories}
                      manufacturers={manufacturers}
                      editing={c}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-8">
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
    </div>
  );
}
