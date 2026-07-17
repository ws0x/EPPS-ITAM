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
import { PageHeader } from "@/components/page-header";
import { Pencil, Layers } from "lucide-react";

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
      <PageHeader
        eyebrow="Reference Data"
        title="Models"
        description={'Purchasable device models, e.g. "Lenovo ThinkPad T14".'}
        actions={<ModelDialog categories={categories} manufacturers={manufacturers} />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Layers className="size-8 opacity-40" />
                    <p className="text-sm">No models yet. Add one to start creating assets.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{categoryById.get(m.categoryId)?.name ?? "-"}</TableCell>
                <TableCell>{m.manufacturerId ? (manufacturerById.get(m.manufacturerId)?.name ?? "-") : "-"}</TableCell>
                <TableCell className="font-mono text-sm">{m.modelNumber ?? "-"}</TableCell>
                <TableCell>
                  <ModelDialog
                    categories={categories}
                    manufacturers={manufacturers}
                    editing={m}
                    trigger={
                      <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${m.name}`}>
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
