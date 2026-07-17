import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { RecordHistory } from "@/components/record-history";
import {
  getUserWithDetails,
  getUserHoldings,
  getUserCheckoutHistory,
  listRoles,
} from "@/lib/actions/users";
import { listDepartments } from "@/lib/actions/departments";
import { listLocations } from "@/lib/actions/locations";
import { listUsers } from "@/lib/actions/users";
import { UserDialog } from "../user-dialog";
import { CheckInEverythingDialog } from "./check-in-everything-dialog";
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
import { ArrowLeft, Pencil, Laptop, KeyRound, PackageOpen, Package, History, Headphones } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  asset: "Asset",
  license_seat: "License",
  kit: "Kit",
  consumable_assignment: "Consumable",
  accessory_assignment: "Accessory",
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentUser = await requireUser();

  const [profile, holdings, history, roles, departments, locations, managers] = await Promise.all([
    getUserWithDetails(id),
    getUserHoldings(id),
    getUserCheckoutHistory(id),
    listRoles(),
    listDepartments(),
    listLocations(),
    listUsers(),
  ]);

  if (!profile) notFound();

  const fullName = profile.firstName ? `${profile.firstName} ${profile.lastName ?? ""}`.trim() : profile.username;
  const managerName = profile.managerFirstName
    ? `${profile.managerFirstName} ${profile.managerLastName ?? ""}`.trim()
    : profile.managerEmail;

  const totalHoldings =
    holdings.assets.length + holdings.licenseSeats.length + holdings.kits.length + holdings.accessories.length;

  return (
    <div>
      <PageHeader
        eyebrow="People / Users"
        title={fullName}
        description={profile.jobTitle ?? profile.email}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/users" />}>
              <ArrowLeft /> Back to List
            </Button>
            {totalHoldings > 0 && (
              <CheckInEverythingDialog userId={profile.id} userName={fullName} holdings={holdings} />
            )}
            <UserDialog
              roles={roles}
              departments={departments}
              locations={locations}
              managers={managers}
              editing={profile}
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
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</span>
                <span className="text-sm">{profile.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</span>
                <Badge variant="outline" className="capitalize w-fit">{profile.roleName.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Department</span>
                <span className="text-sm">{profile.departmentName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
                <span className="text-sm">{profile.locationName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manager</span>
                <span className="text-sm">{managerName ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</span>
                <span className="text-sm">{profile.phone ?? "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Employee Number</span>
                <span className="text-sm">{profile.employeeNumber ?? "-"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="h-full border-primary/20">
            <CardHeader className="pb-2 border-b bg-primary/[0.02]">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-primary">Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center py-8">
              {profile.loginEnabled ? (
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10 mb-4">
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 mb-4">
                  Disabled
                </Badge>
              )}
              <span className="text-3xl font-extrabold font-mono text-primary mb-1">{totalHoldings}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Items Held</span>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <PackageOpen className="size-4" /> Currently Holding
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="pl-6 w-10" />
                <TableHead>Item</TableHead>
                <TableHead className="pr-6">Checked Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totalHoldings === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <PackageOpen className="size-8 opacity-40" />
                      <p className="text-sm">Not currently holding anything.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {holdings.assets.map((a) => (
                <TableRow key={`asset-${a.id}`}>
                  <TableCell className="pl-6"><Laptop className="size-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <Link href={`/assets/${a.id}`} className="font-medium text-sm hover:text-primary hover:underline">
                      {a.assetTag} - {a.modelName}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground">
                    {a.checkedOutAt ? new Date(a.checkedOutAt).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {holdings.licenseSeats.map((s) => (
                <TableRow key={`seat-${s.id}`}>
                  <TableCell className="pl-6"><KeyRound className="size-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <Link href={`/licenses/${s.licenseId}`} className="font-medium text-sm hover:text-primary hover:underline">
                      {s.licenseName}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground">
                    {s.checkedOutAt ? new Date(s.checkedOutAt).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
              {holdings.kits.map((k) => (
                <TableRow key={`kit-${k.id}`}>
                  <TableCell className="pl-6"><PackageOpen className="size-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <Link href={`/kits/${k.id}`} className="font-medium text-sm hover:text-primary hover:underline">
                      {k.kitName}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground">{new Date(k.checkedOutAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {holdings.accessories.map((a) => (
                <TableRow key={`accessory-${a.id}`}>
                  <TableCell className="pl-6"><Headphones className="size-4 text-muted-foreground" /></TableCell>
                  <TableCell>
                    <Link href={`/accessories/${a.accessoryId}`} className="font-medium text-sm hover:text-primary hover:underline">
                      {a.accessoryName} {a.quantity > 1 ? `(x${a.quantity})` : ""}
                    </Link>
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground">
                    {a.checkedOutAt ? new Date(a.checkedOutAt).toLocaleDateString() : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {holdings.consumables.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="size-4" /> Consumables Received
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-6">Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="pr-6">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.consumables.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6 font-medium text-sm">{c.consumableName}</TableCell>
                    <TableCell className="font-mono text-sm">{c.quantity}</TableCell>
                    <TableCell className="pr-6 text-xs text-muted-foreground">{new Date(c.assignedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <History className="size-4" /> Full Checkout History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="pl-6">Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Checked Out</TableHead>
                <TableHead>Checked In</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="pr-6">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <History className="size-8 opacity-40" />
                      <p className="text-sm">No checkout history yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="pl-6">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[h.checkoutableType]}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{h.itemName}</TableCell>
                  <TableCell className="text-xs font-mono">{new Date(h.checkedOutAt).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {h.checkedInAt ? (
                      new Date(h.checkedInAt).toLocaleString()
                    ) : (
                      <Badge variant="outline" className="border-teal-500 text-teal-600 bg-teal-500/10">Still out</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {h.checkedOutByFirstName ? `${h.checkedOutByFirstName} ${h.checkedOutByLastName ?? ""}`.trim() : h.checkedOutByEmail}
                  </TableCell>
                  <TableCell className="pr-6 text-xs text-muted-foreground max-w-[200px] truncate">{h.notes ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RecordHistory companyId={currentUser.companyId} targetType="user" targetId={profile.id} />
    </div>
  );
}
