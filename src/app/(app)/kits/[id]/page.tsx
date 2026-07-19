import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getKit, listKitItems, removeKitItem } from "@/lib/actions/kits";
import { listModels } from "@/lib/actions/models";
import { listConsumablesForExport } from "@/lib/actions/consumables";
import { listLicenses } from "@/lib/actions/licenses";
import { listUsers } from "@/lib/actions/users";
import { AddKitItemDialog } from "./add-kit-item-dialog";
import { CheckoutKitDialog } from "./checkout-dialog";
import { PageHeader } from "@/components/page-header";
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
import { Trash2, PackageOpen } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  model: "Model",
  consumable: "Consumable",
  license: "License",
};

export default async function KitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();
  const [kit, items, models, consumableList, licenseList, users] = await Promise.all([
    getKit(id),
    listKitItems(id),
    listModels(),
    listConsumablesForExport(),
    listLicenses(),
    listUsers(),
  ]);

  if (!kit) notFound();

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Kits"
        title={kit.name}
        description={kit.notes ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <CheckoutKitDialog
              kitId={kit.id}
              kitName={kit.name}
              users={formattedUsers}
              hasItems={items.length > 0}
            />
            <AddKitItemDialog
              kitId={kit.id}
              models={models.map((m) => ({ id: m.id, name: m.name }))}
              consumables={consumableList.map((c) => ({ id: c.id, name: c.name }))}
              licenses={licenseList.map((l) => ({ id: l.id, name: l.name }))}
            />
          </div>
        }
      />

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Type</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageOpen className="size-8 opacity-40" />
                    <p className="text-sm">No items in this kit yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[item.itemType]}</Badge>
                </TableCell>
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell className="font-mono text-sm">{item.quantity}</TableCell>
                <TableCell>
                  <form action={removeKitItem}>
                    <input type="hidden" name="kitId" value={kit.id} />
                    <input type="hidden" name="kitItemId" value={item.id} />
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" type="submit">
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6">
        <RecordHistory
          companyId={currentUser.companyId}
          targetType="kit"
          targetId={kit.id}
          checkoutable={{ type: "kit", id: kit.id }}
        />
      </div>
    </div>
  );
}
