import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getConsumableWithDetails, listConsumableAssignments, listConsumableCategories } from "@/lib/actions/consumables";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { ConsumableDialog } from "../consumable-dialog";
import { CheckoutConsumableDialog } from "../checkout-dialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Pencil, DollarSign, Package } from "lucide-react";

export default async function ConsumableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();

  const [consumable, assignments, categories, manufacturers, users] = await Promise.all([
    getConsumableWithDetails(id),
    listConsumableAssignments(id),
    listConsumableCategories(),
    listManufacturers(),
    listUsers(),
  ]);

  if (!consumable) notFound();

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const isLow = consumable.qtyTotal <= consumable.minQty;
  const purchaseCostNum = consumable.purchaseCost ? Number(consumable.purchaseCost) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Consumables"
        title={consumable.name}
        description={consumable.modelNumber ? `Model: ${consumable.modelNumber}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/consumables" />}>
              <ArrowLeft /> Back to List
            </Button>
            <CheckoutConsumableDialog
              consumableId={consumable.id}
              consumableName={consumable.name}
              maxQuantity={consumable.qtyTotal}
              users={formattedUsers}
            />
            <ConsumableDialog
              categories={categories}
              manufacturers={manufacturers}
              editing={consumable}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil /> Edit
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Consumable Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
                <span className="text-sm">{consumable.categoryName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manufacturer</span>
                <span className="text-sm">{consumable.manufacturerName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model Number</span>
                <span className="text-sm">{consumable.modelNumber ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DollarSign className="size-3" /> Unit Cost
                </span>
                <span className="font-mono text-sm font-semibold">
                  {purchaseCostNum > 0
                    ? purchaseCostNum.toLocaleString("en-US", { style: "currency", currency: "EGP" })
                    : "-"}
                </span>
              </div>
              {consumable.notes && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</span>
                  <span className="text-sm text-muted-foreground">{consumable.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full border-primary/20">
            <CardHeader className="pb-2 border-b bg-primary/[0.02]">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Stock Level</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-8">
              <span className="text-4xl font-extrabold font-mono text-primary mb-1">{consumable.qtyTotal}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Stock</span>
              {isLow && (
                <Badge variant="outline" className="mt-4 border-amber-500 text-amber-600 bg-amber-500/10">
                  Below minimum ({consumable.minQty})
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Distribution History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="pl-6">Assigned To</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead className="pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="size-8 opacity-40" />
                      <p className="text-sm">Never distributed.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="pl-6 font-medium text-sm">
                    {a.assignedToFirstName ? `${a.assignedToFirstName} ${a.assignedToLastName ?? ""}`.trim() : a.assignedToEmail}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{a.quantity}</TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordHistory companyId={currentUser.companyId} targetType="consumable" targetId={consumable.id} />
    </div>
  );
}
