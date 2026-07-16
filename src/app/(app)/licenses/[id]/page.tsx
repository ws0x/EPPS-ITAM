import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import { getLicenseWithDetails, listLicenseSeatsWithDetails, listLicenseCategories } from "@/lib/actions/licenses";
import { listManufacturers } from "@/lib/actions/manufacturers";
import { listUsers } from "@/lib/actions/users";
import { listAssets } from "@/lib/actions/assets";
import { LicenseDialog } from "../license-dialog";
import { SeatCheckoutDialog } from "./seat-checkout-dialog";
import { SeatCheckinDialog } from "./seat-checkin-dialog";
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
import {
  KeyRound,
  Calendar,
  DollarSign,
  Pencil,
  ArrowLeft,
  User,
  Laptop,
} from "lucide-react";

export default async function LicenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();

  const [
    license,
    seats,
    categories,
    manufacturers,
    users,
    assetsList,
  ] = await Promise.all([
    getLicenseWithDetails(id),
    listLicenseSeatsWithDetails(id),
    listLicenseCategories(),
    listManufacturers(),
    listUsers(),
    listAssets({ limit: 5000 }),
  ]);

  if (!license) notFound();

  const formattedUsers = users.map((u) => ({
    id: u.id,
    name: u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email,
  }));

  const formattedAssets = assetsList.data.map((a) => ({
    id: a.id,
    name: a.name ? `${a.assetTag} - ${a.name}` : a.assetTag,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = license.expiresAt !== null && license.expiresAt < today;
  const purchaseCostNum = license.purchaseCost ? Number(license.purchaseCost) : 0;

  const seatsUsed = seats.filter((s) => s.assignedToUserId || s.assignedToAssetId).length;
  const seatLabels = Object.fromEntries(seats.map((s, index) => [s.id, `Seat #${index + 1}`]));

  return (
    <div>
      <PageHeader
        eyebrow="Inventory / Licenses"
        title={license.name}
        description={license.licenseKey ? `Key: ${license.licenseKey}` : "No key provided"}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/licenses" />}>
              <ArrowLeft /> Back to List
            </Button>
            <LicenseDialog
              categories={categories}
              manufacturers={manufacturers}
              editing={license}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil /> Edit License
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
        {/* Main Info Card */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                License Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  License Name
                </span>
                <span className="text-sm font-medium">{license.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Category
                </span>
                <span className="text-sm">{license.categoryName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Manufacturer
                </span>
                <span className="text-sm">
                  {manufacturers.find((m) => m.id === license.manufacturerId)?.name ?? "-"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  License Key
                </span>
                <span className="font-mono text-sm break-all">{license.licenseKey ?? "-"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Financials & Expiry */}
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Financials & Expiration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <DollarSign className="size-3" /> Cost
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
                <span className="text-sm">{license.purchaseDate ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <KeyRound className="size-3" /> Expiry Date
                </span>
                <div>
                  {license.expiresAt ? (
                    <Badge variant="outline" className={isExpired ? "border-destructive text-destructive bg-destructive/10" : ""}>
                      {license.expiresAt}
                    </Badge>
                  ) : (
                    <span className="text-sm">-</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seat Utilization Summary */}
        <div>
          <Card className="h-full border-primary/20">
            <CardHeader className="pb-2 border-b bg-primary/[0.02]">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">
                Seat Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-8">
              <span className="text-4xl font-extrabold font-mono text-primary mb-1">
                {seatsUsed} / {license.seatsTotal}
              </span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Seats Assigned
              </span>

              {/* Progress visual bar */}
              <div className="w-full bg-muted rounded-full h-2 mt-6 overflow-hidden border">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (seatsUsed / license.seatsTotal) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-2">
                {license.seatsTotal - seatsUsed} seats remaining
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seats table card */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            License Seats Pool
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-20 pl-6">Seat</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="w-32 pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seats.map((seat, index) => {
                const seatNum = index + 1;
                const isAssigned = seat.assignedToUserId || seat.assignedToAssetId;

                return (
                  <TableRow key={seat.id}>
                    <TableCell className="font-mono text-sm pl-6 font-semibold">
                      #{seatNum}
                    </TableCell>
                    <TableCell>
                      {seat.assignedToUserId ? (
                        <span className="font-medium text-sm flex items-center gap-1.5">
                          <User className="size-3.5 text-muted-foreground" />
                          {seat.assignedToUserFirstName
                            ? `${seat.assignedToUserFirstName} ${seat.assignedToUserLastName ?? ""}`.trim()
                            : seat.assignedToUserEmail}
                        </span>
                      ) : seat.assignedToAssetId ? (
                        <Link
                          href={`/assets/${seat.assignedToAssetId}`}
                          className="font-medium text-sm text-primary hover:underline flex items-center gap-1.5"
                        >
                          <Laptop className="size-3.5 text-muted-foreground" />
                          {seat.assignedToAssetTag} {seat.assignedToAssetName ? `- ${seat.assignedToAssetName}` : ""}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Available</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {seat.assignedToUserId ? (
                        <Badge variant="outline" className="text-xs">User</Badge>
                      ) : seat.assignedToAssetId ? (
                        <Badge variant="outline" className="text-xs">Asset</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate text-xs">
                      {seat.notes ?? "-"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {isAssigned ? (
                        <SeatCheckinDialog seatId={seat.id} seatIndex={seatNum} />
                      ) : (
                        <SeatCheckoutDialog
                          seatId={seat.id}
                          seatIndex={seatNum}
                          users={formattedUsers}
                          assets={formattedAssets}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6">
        <RecordHistory
          companyId={currentUser.companyId}
          targetType="license"
          targetId={license.id}
          checkoutable={{ type: "license_seat", id: seats.map((s) => s.id) }}
          checkoutableLabels={seatLabels}
        />
      </div>
    </div>
  );
}
