import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getAccessoryWithDetails, listAccessoryAssignments, listAccessoryCategories } from "@/lib/actions/accessories";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { AccessoryDialog } from "../accessory-dialog";
import { CheckoutAccessoryDialog } from "../checkout-dialog";
import { CheckinAccessoryDialog } from "../checkin-dialog";
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
import { ArrowLeft, Pencil, DollarSign, Headphones } from "lucide-react";

export default async function AccessoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();

  const [accessory, assignments, categories, manufacturers, users] = await Promise.all([
    getAccessoryWithDetails(id),
    listAccessoryAssignments(id),
    listAccessoryCategories(),
    listManufacturers(),
    listUsers(),
  ]);

  if (!accessory) notFound();

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const isLow = accessory.qtyAvailable <= accessory.minQty;
  const purchaseCostNum = accessory.purchaseCost ? Number(accessory.purchaseCost) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Accessories"
        title={accessory.name}
        description={accessory.modelNumber ? `Model: ${accessory.modelNumber}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/accessories" />}>
              <ArrowLeft /> Back to List
            </Button>
            <CheckoutAccessoryDialog
              accessoryId={accessory.id}
              accessoryName={accessory.name}
              maxQuantity={accessory.qtyAvailable}
              users={formattedUsers}
            />
            <AccessoryDialog
              categories={categories}
              manufacturers={manufacturers}
              editing={accessory}
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
                Accessory Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
                <span className="text-sm">{accessory.categoryName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manufacturer</span>
                <span className="text-sm">{accessory.manufacturerName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model Number</span>
                <span className="text-sm">{accessory.modelNumber ?? "-"}</span>
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
              {accessory.notes && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</span>
                  <span className="text-sm text-muted-foreground">{accessory.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full border-primary/20">
            <CardHeader className="pb-2 border-b bg-primary/[0.02]">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Availability</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-8">
              <span className="text-4xl font-extrabold font-mono text-primary mb-1">{accessory.qtyAvailable}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Available of {accessory.qtyTotal}
              </span>
              {isLow && (
                <Badge variant="outline" className="mt-4 border-amber-500 text-amber-600 bg-amber-500/10">
                  Below minimum ({accessory.minQty})
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
                <TableHead>Checked Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Headphones className="size-8 opacity-40" />
                      <p className="text-sm">Never distributed.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => {
                const assigneeLabel = a.assignedToFirstName
                  ? `${a.assignedToFirstName} ${a.assignedToLastName ?? ""}`.trim()
                  : (a.assignedToEmail ?? "-");
                return (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium text-sm">{assigneeLabel}</TableCell>
                    <TableCell className="font-mono text-sm">{a.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.checkedOutAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {a.checkedInAt ? (
                        <span className="text-xs text-muted-foreground">
                          Returned {new Date(a.checkedInAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <Badge variant="outline" className="border-teal-500 text-teal-600 bg-teal-500/10">
                          Still out
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      {!a.checkedInAt && <CheckinAccessoryDialog assignmentId={a.id} assigneeLabel={assigneeLabel} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordHistory companyId={currentUser.companyId} targetType="accessory" targetId={accessory.id} />
    </div>
  );
}
