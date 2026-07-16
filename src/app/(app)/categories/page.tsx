import { listCategories } from "@/lib/actions/categories";
import { CategoryDialog } from "./category-dialog";
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
import { Pencil, FolderOpen } from "lucide-react";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div>
      <PageHeader
        eyebrow="Reference Data"
        title="Categories"
        description="Global groupings for asset tracking and tag prefixes."
        actions={<CategoryDialog />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Code Prefix</TableHead>
              <TableHead>Tagged {new Date().getFullYear()}</TableHead>
              <TableHead>Requires EULA</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FolderOpen className="size-8 opacity-40" />
                    <p className="text-sm">No categories yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-semibold">{cat.name}</TableCell>
                <TableCell className="capitalize">
                  <Badge variant="secondary">{cat.type}</Badge>
                </TableCell>
                <TableCell className="font-mono font-medium">{cat.codePrefix ?? "-"}</TableCell>
                <TableCell className="font-mono">{cat.taggedThisYear}</TableCell>
                <TableCell>
                  {cat.requiresAcceptance ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-500">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <CategoryDialog
                    editing={cat}
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
