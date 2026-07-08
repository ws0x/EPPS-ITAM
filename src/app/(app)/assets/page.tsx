import Link from "next/link";
import { listAssets } from "@/lib/actions/assets";
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
import { Plus, Boxes } from "lucide-react";

export default async function AssetsPage() {
  const assets = await listAssets();

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Assets"
        description={`${assets.length} total`}
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/assets/new" />}>
            <Plus /> Add Asset
          </Button>
        }
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Boxes className="size-8 opacity-40" />
                    <p className="text-sm">No assets yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {assets.map((asset) => (
              <TableRow key={asset.id} className="cursor-pointer">
                <TableCell className="font-mono text-sm font-medium">
                  <Link href={`/assets/${asset.id}`} className="hover:text-primary hover:underline">
                    {asset.assetTag}
                  </Link>
                </TableCell>
                <TableCell>{asset.name ?? "—"}</TableCell>
                <TableCell>{asset.categoryName}</TableCell>
                <TableCell>{asset.modelName}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={
                      asset.statusColor
                        ? { borderColor: asset.statusColor, color: asset.statusColor, backgroundColor: `${asset.statusColor}14` }
                        : undefined
                    }
                  >
                    {asset.statusName}
                  </Badge>
                </TableCell>
                <TableCell>{asset.locationName ?? "—"}</TableCell>
                <TableCell>
                  {asset.assignedToEmail
                    ? asset.assignedToFirstName
                      ? `${asset.assignedToFirstName} ${asset.assignedToLastName ?? ""}`.trim()
                      : asset.assignedToEmail
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
