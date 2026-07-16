import { listManufacturers } from "@/lib/actions/manufacturers";
import { ManufacturerDialog } from "./manufacturer-dialog";
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
import { Pencil, Factory } from "lucide-react";

export default async function ManufacturersPage() {
  const manufacturers = await listManufacturers();

  return (
    <div>
      <PageHeader
        eyebrow="Reference Data"
        title="Manufacturers"
        description="Device and hardware manufacturers."
        actions={<ManufacturerDialog />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Support URL</TableHead>
              <TableHead>Support Phone</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {manufacturers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Factory className="size-8 opacity-40" />
                    <p className="text-sm">No manufacturers yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {manufacturers.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.supportUrl ?? "-"}</TableCell>
                <TableCell>{m.supportPhone ?? "-"}</TableCell>
                <TableCell>
                  <ManufacturerDialog
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
