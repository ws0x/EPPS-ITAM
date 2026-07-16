import { requireUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import {
  requests,
  users,
  models,
  categories,
  acceptances,
  checkouts,
  assets,
  manufacturers,
  licenseSeats,
  licenses,
  consumableAssignments,
  consumables,
} from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { PageHeader } from "@/components/page-header";
import { RequestAssetDialog } from "./request-dialog";
import { AcceptanceCard } from "./acceptance-card";
import { DecideRequestButtons } from "./decide-request-buttons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import Link from "next/link";
import { AlertCircle, ArrowUpRight, ClipboardList, CheckCircle2, ShieldCheck, Tag } from "lucide-react";
export default async function RequestsPage() {
  const user = await requireUser();

  const isTechOrManager =
    user.role.name === "admin" ||
    user.role.name === "it_manager" ||
    user.role.name === "technician";

  // 1. Fetch Categories & Models for Request Dialog dropdowns
  const [activeCategories, activeModels] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.companyId, user.companyId), eq(categories.type, "asset")))
      .orderBy(categories.name),
    db
      .select({
        id: models.id,
        name: sql<string>`concat(${manufacturers.name}, ' ', ${models.name})`,
      })
      .from(models)
      .innerJoin(manufacturers, eq(models.manufacturerId, manufacturers.id))
      .where(eq(models.companyId, user.companyId))
      .orderBy(models.name),
  ]);

  // Helper type for select fields
  const approverFirst = sql<string | null>`approver.first_name`;
  const approverLast = sql<string | null>`approver.last_name`;
  const approverEmail = sql<string | null>`approver.email`;
  const checkoutTargetFirst = sql<string | null>`checkout_target.first_name`;
  const checkoutTargetLast = sql<string | null>`checkout_target.last_name`;
  const checkoutTargetEmail = sql<string | null>`checkout_target.email`;

  const hasDecideOverride = user.role.name === "admin" || user.role.name === "it_manager";

  // 2. Fetch requests
  const baseQuery = db
    .select({
      id: requests.id,
      quantity: requests.quantity,
      status: requests.status,
      justification: requests.justification,
      rejectionReason: requests.rejectionReason,
      createdAt: requests.createdAt,
      modelId: requests.modelId,
      categoryId: requests.categoryId,
      requesterUserId: requests.requesterUserId,
      requesterName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
      requesterEmail: users.email,
      modelName: sql<string | null>`concat(model_mfr.name, ' ', ${models.name})`,
      categoryName: categories.name,
      approverUserId: requests.approverUserId,
      approverName: sql<string | null>`concat(${approverFirst}, ' ', ${approverLast})`,
      approverEmail: approverEmail,
      checkoutAssetId: requests.checkoutAssetId,
      checkoutAssetTag: sql<string | null>`checkout_asset.asset_tag`,
      checkoutTargetName: sql<string | null>`concat(${checkoutTargetFirst}, ' ', ${checkoutTargetLast})`,
      checkoutTargetEmail: checkoutTargetEmail,
    })
    .from(requests)
    .innerJoin(users, eq(requests.requesterUserId, users.id))
    .leftJoin(models, eq(requests.modelId, models.id))
    .leftJoin(sql`${manufacturers} as model_mfr`, eq(models.manufacturerId, sql`model_mfr.id`))
    .leftJoin(categories, eq(requests.categoryId, categories.id))
    .leftJoin(sql`${users} as approver`, eq(requests.approverUserId, sql`approver.id`))
    .leftJoin(sql`${assets} as checkout_asset`, eq(requests.checkoutAssetId, sql`checkout_asset.id`))
    .leftJoin(sql`${users} as checkout_target`, eq(requests.checkoutTargetUserId, sql`checkout_target.id`));

  const list = await (isTechOrManager
    ? baseQuery.where(eq(requests.companyId, user.companyId)).orderBy(sql`${requests.createdAt} desc`)
    : baseQuery.where(eq(requests.requesterUserId, user.id)).orderBy(sql`${requests.createdAt} desc`));

  // Determine fulfillment links dynamically based on stock availability
  const requestsWithFulfillment = await Promise.all(
    list.map(async (req) => {
      let fulfillUrl: string | null = null;
      let stockAvailable = false;

      if (req.status === "approved" && isTechOrManager) {
        if (req.modelId) {
          // Find first available asset of this model
          const [asset] = await db
            .select({ id: assets.id })
            .from(assets)
            .where(and(eq(assets.modelId, req.modelId), isNull(assets.assignedToUserId)))
            .limit(1);

          if (asset) {
            stockAvailable = true;
            fulfillUrl = `/assets/${asset.id}?checkoutTo=${req.requesterUserId}&requestId=${req.id}`;
          }
        } else if (req.categoryId) {
          // Find first available asset in this category
          const [asset] = await db
            .select({ id: assets.id })
            .from(assets)
            .innerJoin(models, eq(assets.modelId, models.id))
            .where(and(eq(models.categoryId, req.categoryId), isNull(assets.assignedToUserId)))
            .limit(1);

          if (asset) {
            stockAvailable = true;
            fulfillUrl = `/assets/${asset.id}?checkoutTo=${req.requesterUserId}&requestId=${req.id}`;
          }
        }
      }

      return {
        ...req,
        fulfillUrl,
        stockAvailable,
      };
    })
  );

  // 3. Fetch pending acceptances (EULA sign-off) for current user
  const userAcceptances = await db
    .select({
      id: acceptances.id,
      status: acceptances.status,
      createdAt: acceptances.createdAt,
      eulaSnapshot: acceptances.eulaSnapshot,
      assetTag: assets.assetTag,
      serial: assets.serial,
      modelName: sql<string | null>`case when ${checkouts.checkoutableType} = 'asset' then concat(mfr.name, ' ', ${models.name}) else null end`,
      checkoutNotes: checkouts.notes,
    })
    .from(acceptances)
    .innerJoin(checkouts, eq(acceptances.checkoutId, checkouts.id))
    .leftJoin(assets, eq(checkouts.checkoutableId, assets.id))
    .leftJoin(models, eq(assets.modelId, models.id))
    .leftJoin(sql`${manufacturers} as mfr`, eq(models.manufacturerId, sql`mfr.id`))
    .where(and(eq(checkouts.assignedToUserId, user.id), eq(acceptances.status, "pending")))
    .orderBy(sql`${acceptances.createdAt} desc`);

  // 4. Fetch currently assigned items
  // Assets
  const assignedAssets = await db
    .select({
      id: assets.id,
      assetTag: assets.assetTag,
      serial: assets.serial,
      modelName: sql<string>`concat(mfr.name, ' ', ${models.name})`,
      checkoutDate: checkouts.checkedOutAt,
      notes: checkouts.notes,
    })
    .from(assets)
    .innerJoin(models, eq(assets.modelId, models.id))
    .innerJoin(sql`${manufacturers} as mfr`, eq(models.manufacturerId, sql`mfr.id`))
    .innerJoin(
      checkouts,
      and(
        eq(checkouts.checkoutableId, assets.id),
        eq(checkouts.checkoutableType, "asset"),
        isNull(checkouts.checkedInAt)
      )
    )
    .where(eq(assets.assignedToUserId, user.id))
    .orderBy(sql`${checkouts.checkedOutAt} desc`);

  // License Seats
  const assignedLicenses = await db
    .select({
      id: licenseSeats.id,
      licenseName: licenses.name,
      checkoutDate: checkouts.checkedOutAt,
    })
    .from(licenseSeats)
    .innerJoin(licenses, eq(licenseSeats.licenseId, licenses.id))
    .innerJoin(
      checkouts,
      and(
        eq(checkouts.checkoutableId, licenseSeats.id),
        eq(checkouts.checkoutableType, "license_seat"),
        isNull(checkouts.checkedInAt)
      )
    )
    .where(eq(licenseSeats.assignedToUserId, user.id))
    .orderBy(sql`${checkouts.checkedOutAt} desc`);

  // Consumables
  const assignedConsumables = await db
    .select({
      id: consumableAssignments.id,
      consumableName: consumables.name,
      quantity: consumableAssignments.quantity,
      assignedAt: consumableAssignments.createdAt,
    })
    .from(consumableAssignments)
    .innerJoin(consumables, eq(consumableAssignments.consumableId, consumables.id))
    .where(eq(consumableAssignments.assignedToUserId, user.id))
    .orderBy(sql`${consumableAssignments.createdAt} desc`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workflow Center"
        title="Requests & Acceptances"
        description="Submit item allocation requests, sign off EULAs, and view assigned inventory."
        actions={
          <RequestAssetDialog
            categories={activeCategories}
            models={activeModels}
          />
        }
      />

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            <ClipboardList className="size-4 mr-1.5" />
            {isTechOrManager ? "All Requests" : "My Requests"}
          </TabsTrigger>
          <TabsTrigger value="acceptances">
            <ShieldCheck className="size-4 mr-1.5" />
            Pending Sign-Offs
            {userAcceptances.length > 0 && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                {userAcceptances.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="assigned">
            <Tag className="size-4 mr-1.5" />
            My Items
          </TabsTrigger>
        </TabsList>

        {/* REQUESTS TAB */}
        <TabsContent value="requests" className="pt-4 flex flex-col gap-4">
          <div className="rounded-lg border bg-card text-card-foreground shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  {isTechOrManager && <TableHead>Requester</TableHead>}
                  <TableHead>Requested Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Approver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsWithFulfillment.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isTechOrManager ? 8 : 7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  requestsWithFulfillment.map((req) => (
                    <TableRow key={req.id}>
                      {isTechOrManager && (
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{req.requesterName}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {req.requesterEmail}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-semibold text-teal-600 dark:text-teal-500">
                        {req.checkoutAssetId ? (
                          <>
                            Checkout: <span className="font-mono">{req.checkoutAssetTag || "asset"}</span>{" "}
                            &rarr; {req.checkoutTargetName?.trim() || req.checkoutTargetEmail}
                            <span className="text-[10px] text-muted-foreground block font-medium font-sans">
                              IT-Staff Checkout (needs IT Manager approval)
                            </span>
                          </>
                        ) : (
                          <>
                            {req.modelName || req.categoryName || "Requested Item"}
                            <span className="text-[10px] text-muted-foreground block font-medium font-sans">
                              {req.modelId ? "Model Specific" : "Category Default"}
                            </span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{req.quantity}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={req.justification || ""}>
                        {req.justification || "None"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.approverName || req.approverEmail || "Fallback Approver"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            req.status === "pending_approval"
                              ? "outline"
                              : req.status === "approved"
                              ? "default"
                              : req.status === "fulfilled"
                              ? "secondary"
                              : "destructive"
                          }
                          className="capitalize text-[10px] px-2 py-0.5"
                        >
                          {req.status.replace("_", " ")}
                        </Badge>
                        {req.status === "rejected" && req.rejectionReason && (
                          <span className="block text-[10px] text-destructive italic mt-1 max-w-[150px] truncate" title={req.rejectionReason}>
                            Reason: {req.rejectionReason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status === "pending_approval" &&
                          (req.approverUserId === user.id || hasDecideOverride) && (
                            <DecideRequestButtons requestId={req.id} />
                          )}
                        {req.status === "approved" && isTechOrManager && (
                          req.stockAvailable && req.fulfillUrl ? (
                            <Button size="xs" render={<Link href={req.fulfillUrl} />} nativeButton={false}>
                              Fulfill <ArrowUpRight className="size-3 ml-1" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 font-medium">
                              <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                              Out of Stock
                            </span>
                          )
                        )}
                        {req.status === "pending_approval" &&
                          !(req.approverUserId === user.id || hasDecideOverride) &&
                          !isTechOrManager && (
                          <span className="text-[11px] text-muted-foreground">Awaiting Manager</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PENDING SIGN-OFFS TAB */}
        <TabsContent value="acceptances" className="pt-4 flex flex-col gap-4">
          {userAcceptances.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
              <CheckCircle2 className="size-10 text-teal-600" />
              <div className="flex flex-col gap-1">
                <p className="font-bold text-sm text-foreground">You are all set!</p>
                <p className="text-xs">No pending asset sign-offs or custody agreements require your review.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {userAcceptances.map((acc) => (
                <AcceptanceCard key={acc.id} acceptance={acc} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ASSIGNED ITEMS TAB */}
        <TabsContent value="assigned" className="pt-4 flex flex-col gap-6">
          {/* Assets Sub-Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-teal-600 uppercase tracking-wider">My Assigned Assets</h3>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Name / Model</TableHead>
                    <TableHead>Asset Tag</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Assigned Date</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-16 text-center text-muted-foreground text-xs">
                        No physical assets checked out to you.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.modelName}</TableCell>
                        <TableCell className="font-mono text-xs">{asset.assetTag}</TableCell>
                        <TableCell className="font-mono text-xs">{asset.serial || "N/A"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(asset.checkoutDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground italic text-xs max-w-[200px] truncate" title={asset.notes || ""}>
                          {asset.notes || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Licenses Sub-Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-teal-600 uppercase tracking-wider">My Licenses</h3>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>License Product</TableHead>
                    <TableHead>Assigned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedLicenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-16 text-center text-muted-foreground text-xs">
                        No software licenses assigned to you.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedLicenses.map((lic) => (
                      <TableRow key={lic.id}>
                        <TableCell className="font-medium">{lic.licenseName}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(lic.checkoutDate).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Consumables Sub-Table */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-teal-600 uppercase tracking-wider">My Consumables</h3>
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consumable Item</TableHead>
                    <TableHead>Allocated Quantity</TableHead>
                    <TableHead>Assigned Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedConsumables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-16 text-center text-muted-foreground text-xs">
                        No consumable items checked out to you.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignedConsumables.map((con) => (
                      <TableRow key={con.id}>
                        <TableCell className="font-medium">{con.consumableName}</TableCell>
                        <TableCell className="font-mono text-xs">{con.quantity}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(con.assignedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
