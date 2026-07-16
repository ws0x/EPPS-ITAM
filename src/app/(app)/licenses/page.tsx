import Link from "next/link";
import { listLicenses, listLicenseCategories } from "@/lib/actions/licenses";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { LicenseDialog } from "./license-dialog";
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
import { Pencil, KeyRound } from "lucide-react";

export default async function LicensesPage() {
  const [licenseList, categories, manufacturers] = await Promise.all([
    listLicenses(),
    listLicenseCategories(),
    listManufacturers(),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Licenses"
        description={`${licenseList.length} total`}
        actions={<LicenseDialog categories={categories} manufacturers={manufacturers} />}
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Seats</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {licenseList.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <KeyRound className="size-8 opacity-40" />
                    <p className="text-sm">No licenses yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {licenseList.map((lic) => {
              const isExpired = lic.expiresAt !== null && lic.expiresAt < today;
              return (
                <TableRow key={lic.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/licenses/${lic.id}`} className="hover:text-primary hover:underline">
                      {lic.name}
                    </Link>
                  </TableCell>
                  <TableCell>{categoryById.get(lic.categoryId)?.name ?? "-"}</TableCell>
                  <TableCell>{lic.manufacturerId ? (manufacturerById.get(lic.manufacturerId)?.name ?? "-") : "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {lic.seatsUsed} / {lic.seatsTotal}
                  </TableCell>
                  <TableCell>
                    {lic.expiresAt ? (
                      <Badge variant="outline" className={isExpired ? "border-destructive text-destructive bg-destructive/10" : ""}>
                        {lic.expiresAt}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <LicenseDialog
                      categories={categories}
                      manufacturers={manufacturers}
                      editing={lic}
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
