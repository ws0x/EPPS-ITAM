import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getComponentWithDetails, listComponentAssignments, listComponentCategories } from "@/lib/actions/components";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listAssetsForPicker } from "@/lib/actions/assets";
import { ComponentDialog } from "../component-dialog";
import { CheckoutComponentDialog } from "../checkout-dialog";
import { CheckinComponentDialog } from "../checkin-dialog";
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
import { ArrowLeft, Pencil, DollarSign, Cpu } from "lucide-react";

export default async function ComponentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();

  const [component, assignments, categories, manufacturers, assets] = await Promise.all([
    getComponentWithDetails(id),
    listComponentAssignments(id),
    listComponentCategories(),
    listManufacturers(),
    listAssetsForPicker(),
  ]);

  if (!component) notFound();

  const isLow = component.qtyAvailable <= component.minQty;
  const purchaseCostNum = component.purchaseCost ? Number(component.purchaseCost) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Components"
        title={component.name}
        description={component.modelNumber ? `Model: ${component.modelNumber}` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/components" />}>
              <ArrowLeft /> Back to List
            </Button>
            <CheckoutComponentDialog
              componentId={component.id}
              componentName={component.name}
              maxQuantity={component.qtyAvailable}
              assets={assets}
            />
            <ComponentDialog
              categories={categories}
              manufacturers={manufacturers}
              editing={component}
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
                Component Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
                <span className="text-sm">{component.categoryName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manufacturer</span>
                <span className="text-sm">{component.manufacturerName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model Number</span>
                <span className="text-sm">{component.modelNumber ?? "-"}</span>
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
              {component.notes && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</span>
                  <span className="text-sm text-muted-foreground">{component.notes}</span>
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
              <span className="text-4xl font-extrabold font-mono text-primary mb-1">{component.qtyAvailable}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Available of {component.qtyTotal}
              </span>
              {isLow && (
                <Badge variant="outline" className="mt-4 border-amber-500 text-amber-600 bg-amber-500/10">
                  Below minimum ({component.minQty})
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Installation History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="pl-6">Installed On</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Cpu className="size-8 opacity-40" />
                      <p className="text-sm">Never installed.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((a) => {
                const assetLabel = `${a.assignedToAssetTag} — ${a.assignedToAssetName}`;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6 font-medium text-sm">
                      <Link href={`/assets/${a.assignedToAssetId}`} className="hover:text-primary hover:underline">
                        {assetLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{a.quantity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.checkedOutAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {a.checkedInAt ? (
                        <span className="text-xs text-muted-foreground">
                          Removed {new Date(a.checkedInAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <Badge variant="outline" className="border-teal-500 text-teal-600 bg-teal-500/10">
                          Installed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-6">
                      {!a.checkedInAt && <CheckinComponentDialog assignmentId={a.id} assetLabel={assetLabel} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordHistory companyId={currentUser.companyId} targetType="component" targetId={component.id} />
    </div>
  );
}
