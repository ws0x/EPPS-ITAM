import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getAssetWithDetails } from "@/lib/actions/assets";
import { listModels } from "@/lib/actions/models";
import { listStatusLabels } from "@/lib/actions/status-labels";
import { listLocations } from "@/lib/actions/locations";
import { listDepartments } from "@/lib/actions/departments";
import { listUsers } from "@/lib/actions/users";
import { listDepreciationSchedules } from "@/lib/actions/depreciations";
import { AssetForm } from "../asset-form";
import { PageHeader } from "@/components/page-header";
import { CheckoutAssetDialog } from "./checkout-dialog";
import { CheckinAssetDialog } from "./checkin-dialog";
import { RunAuditDialog } from "./run-audit-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  Calendar,
  DollarSign,
  Info,
  MapPin,
  Pencil,
  ShieldCheck,
  User,
  ArrowLeft,
  QrCode,
} from "lucide-react";

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; requestId?: string; checkoutTo?: string }>;
}) {
  const { id } = await params;
  const { edit, requestId, checkoutTo } = await searchParams;
  const isEditing = edit === "true";

  const currentUser = await requireUser();
  const [asset, models, statusLabels, locations, departments, users, depreciationSchedules] = await Promise.all([
    getAssetWithDetails(id),
    listModels(),
    listStatusLabels(),
    listLocations(),
    listDepartments(),
    listUsers(),
    listDepreciationSchedules(),
  ]);

  if (!asset) notFound();

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const purchaseCostNum = asset.purchaseCost ? Number(asset.purchaseCost) : 0;
  const statusColor = asset.statusColor || "#64748b";

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Assets"
        title={asset.name ? `${asset.assetTag} - ${asset.name}` : asset.assetTag}
        description={`${asset.modelName} (${asset.categoryName})`}
        actions={
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/assets/${id}`} />}>
                <ArrowLeft /> Back to Details
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/assets/${id}?edit=true`} />}>
                  <Pencil /> Edit Asset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={<a href={`/api/assets/labels?ids=${asset.id}`} target="_blank" rel="noopener noreferrer" />}
                >
                  <QrCode /> Print Label
                </Button>
                <RunAuditDialog assetId={asset.id} />
                {asset.assignedToUserId ? (
                  <CheckinAssetDialog assetId={asset.id} />
                ) : (
                  <CheckoutAssetDialog
                    assetId={asset.id}
                    users={formattedUsers}
                    defaultUserId={checkoutTo}
                    requestId={requestId}
                  />
                )}
              </>
            )}
          </div>
        }
      />

      {isEditing ? (
        <div className="max-w-3xl">
          <AssetForm
            models={models}
            statusLabels={statusLabels}
            locations={locations}
            departments={departments}
            depreciationSchedules={depreciationSchedules}
            editing={{
              id: asset.id,
              assetTag: asset.assetTag,
              name: asset.name,
              serial: asset.serial,
              modelId: asset.modelId,
              statusId: asset.statusId,
              locationId: asset.locationId,
              departmentId: asset.departmentId,
              assignedToUserId: asset.assignedToUserId,
              purchaseDate: asset.purchaseDate,
              purchaseCost: asset.purchaseCost,
              warrantyMonths: asset.warrantyMonths,
              depreciationId: asset.depreciationId,
              notes: asset.notes,
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main info card */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Asset Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Asset Tag
                  </span>
                  <span className="font-mono text-sm font-semibold">{asset.assetTag}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Serial Number
                  </span>
                  <span className="font-mono text-sm">{asset.serial ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Category & Model
                  </span>
                  <span className="text-sm font-medium">
                    {asset.modelName} <span className="text-muted-foreground">({asset.categoryName})</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </span>
                  <div>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: statusColor,
                        color: statusColor,
                        backgroundColor: `${statusColor}10`,
                      }}
                    >
                      {asset.statusName}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Current Location
                  </span>
                  <span className="text-sm flex items-center gap-1">
                    <MapPin className="size-3 text-muted-foreground" />
                    {asset.locationName ?? "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Default Return Location
                  </span>
                  <span className="text-sm">
                    {locations.find((l) => l.id === asset.rtdLocationId)?.name ?? "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Last Audited
                  </span>
                  <span className="text-sm">
                    {asset.lastAuditAt ? new Date(asset.lastAuditAt).toLocaleDateString() : "Never"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Next Audit Due
                  </span>
                  {asset.nextAuditDate ? (
                    <Badge
                      variant="outline"
                      className={
                        asset.nextAuditDate < new Date().toISOString().slice(0, 10)
                          ? "border-destructive text-destructive bg-destructive/10 w-fit"
                          : "w-fit"
                      }
                    >
                      {asset.nextAuditDate}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not scheduled</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Financials card */}
            <Card>
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Financials & Purchase Info
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <DollarSign className="size-3" /> Original Cost
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {purchaseCostNum > 0
                      ? purchaseCostNum.toLocaleString("en-US", {
                          style: "currency",
                          currency: "EGP",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Calendar className="size-3" /> Purchase Date
                  </span>
                  <span className="text-sm">{asset.purchaseDate ?? "-"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Warranty
                  </span>
                  <span className="text-sm">
                    {asset.warrantyMonths ? `${asset.warrantyMonths} months` : "-"}
                  </span>
                </div>
                {asset.depreciationScheduleName && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <DollarSign className="size-3" /> Current Book Value
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      {asset.currentValue != null
                        ? asset.currentValue.toLocaleString("en-US", { style: "currency", currency: "EGP" })
                        : "-"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{asset.depreciationScheduleName}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes card */}
            {asset.notes && (
              <Card>
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Info className="size-3" /> Asset Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/30 p-3 rounded-lg border">
                    {asset.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Assignment Info */}
          <div>
            <Card className="h-full border-primary/20">
              <CardHeader className="pb-2 border-b bg-primary/[0.02]">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Assignment Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {asset.assignedToUserId ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                        {asset.assignedToFirstName
                          ? asset.assignedToFirstName[0].toUpperCase()
                          : <User className="size-5" />}
                      </div>
                      <div className="flex flex-col leading-none">
                        <span className="font-semibold text-sm">
                          {asset.assignedToFirstName
                            ? `${asset.assignedToFirstName} ${asset.assignedToLastName ?? ""}`.trim()
                            : asset.assignedToEmail}
                        </span>
                        <span className="text-xs text-muted-foreground mt-0.5">
                          {asset.assignedToEmail}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between text-xs py-1 border-b">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                          Checked Out
                        </Badge>
                      </div>
                      <div className="flex justify-between text-xs py-1 border-b">
                        <span className="text-muted-foreground">Department</span>
                        <span className="font-medium">
                          {departments.find((d) => d.id === asset.departmentId)?.name ?? "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <Boxes className="size-12 text-muted-foreground opacity-30 animate-pulse" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">Available in Inventory</span>
                      <span className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                        This asset is currently in depot and can be checked out to any employee.
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isEditing && (
        <div className="mt-6">
          <RecordHistory
            companyId={currentUser.companyId}
            targetType="asset"
            targetId={asset.id}
            checkoutable={{ type: "asset", id: asset.id }}
          />
        </div>
      )}
    </div>
  );
}
