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
import { Plus } from "lucide-react";

export default async function AssetsPage() {
  const assets = await listAssets();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Assets</h1>
          <p className="text-muted-foreground text-sm">{assets.length} total</p>
        </div>
        <Button size="sm" nativeButton={false} render={<Link href="/assets/new" />}>
          <Plus /> Add Asset
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No assets yet.
                </TableCell>
              </TableRow>
            )}
            {assets.map((asset) => (
              <TableRow key={asset.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/assets/${asset.id}`} className="hover:underline">
                    {asset.assetTag}
                  </Link>
                </TableCell>
                <TableCell>{asset.name ?? "—"}</TableCell>
                <TableCell>{asset.categoryName}</TableCell>
                <TableCell>{asset.modelName}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={asset.statusColor ? { borderColor: asset.statusColor, color: asset.statusColor } : undefined}
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
