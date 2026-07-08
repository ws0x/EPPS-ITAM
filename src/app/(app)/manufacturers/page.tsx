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
import { Pencil } from "lucide-react";

export default async function ManufacturersPage() {
  const manufacturers = await listManufacturers();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Manufacturers</h1>
          <p className="text-muted-foreground text-sm">Device and hardware manufacturers.</p>
        </div>
        <ManufacturerDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Support URL</TableHead>
              <TableHead>Support Phone</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {manufacturers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No manufacturers yet.
                </TableCell>
              </TableRow>
            )}
            {manufacturers.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.supportUrl ?? "—"}</TableCell>
                <TableCell>{m.supportPhone ?? "—"}</TableCell>
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
