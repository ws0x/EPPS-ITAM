import { listModels, listAssetCategories } from "@/lib/actions/models";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { ModelDialog } from "./model-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default async function ModelsPage() {
  const [models, categories, manufacturers] = await Promise.all([
    listModels(),
    listAssetCategories(),
    listManufacturers(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Models</h1>
          <p className="text-muted-foreground text-sm">
            Purchasable device models, e.g. &quot;Lenovo ThinkPad T14&quot;.
          </p>
        </div>
        <ModelDialog categories={categories} manufacturers={manufacturers} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Model No.</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No models yet. Add one to start creating assets.
                </TableCell>
              </TableRow>
            )}
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{categoryById.get(m.categoryId)?.name ?? "—"}</TableCell>
                <TableCell>{m.manufacturerId ? (manufacturerById.get(m.manufacturerId)?.name ?? "—") : "—"}</TableCell>
                <TableCell>{m.modelNumber ?? "—"}</TableCell>
                <TableCell>
                  <ModelDialog
                    categories={categories}
                    manufacturers={manufacturers}
                    editing={m}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
