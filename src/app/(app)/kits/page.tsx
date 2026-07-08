import Link from "next/link";
import { listKits } from "@/lib/actions/kits";
import { KitDialog } from "./kit-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { PackageOpen } from "lucide-react";

export default async function KitsPage() {
  const kits = await listKits();

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Kits"
        description="Bundles of items checked out together, e.g. a new-hire kit."
        actions={<KitDialog />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kits.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageOpen className="size-8 opacity-40" />
                    <p className="text-sm">No kits yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {kits.map((kit) => (
              <TableRow key={kit.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/kits/${kit.id}`} className="hover:text-primary hover:underline">
                    {kit.name}
                  </Link>
                </TableCell>
                <TableCell>{kit.itemCount} item{kit.itemCount === 1 ? "" : "s"}</TableCell>
                <TableCell className="text-muted-foreground">{kit.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
