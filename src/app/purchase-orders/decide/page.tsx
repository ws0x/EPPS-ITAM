import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { purchaseOrders, purchaseOrderLines, users } from "@/db/schema";
import { computePoTotals } from "@/lib/po-totals";
import { DecisionForm } from "./decision-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, KeyRound, Hourglass } from "lucide-react";
import crypto from "node:crypto";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

function isLinkExpired(expiryTime: number): boolean {
  return Date.now() > expiryTime;
}

export default async function PurchaseOrderDecidePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;

  if (!id || !token) {
    notFound();
  }

  const user = await getCurrentUser();
  if (!user) {
    const callbackUrl = encodeURIComponent(`/purchase-orders/decide?id=${id}&token=${token}`);
    redirect(`/login?redirectTo=${callbackUrl}`);
  }

  try {
    await checkRateLimit(`decide_view:po:${user.id}`, 10, 5);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return (
        <div className="flex min-h-svh items-center justify-center p-4">
          <Card className="w-full max-w-md border-amber-500/20 bg-amber-500/[0.01]">
            <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
              <Hourglass className="size-16 text-amber-500" />
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Slow down</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Too many requests. Try again in {err.retryAfterSeconds} seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    throw err;
  }

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      supplierName: purchaseOrders.supplierName,
      status: purchaseOrders.status,
      approverUserId: purchaseOrders.approverUserId,
      approvalTokenHash: purchaseOrders.approvalTokenHash,
      updatedAt: purchaseOrders.updatedAt,
      vatRegistered: purchaseOrders.vatRegistered,
      advancePaymentRegistered: purchaseOrders.advancePaymentRegistered,
      eInvoiced: purchaseOrders.eInvoiced,
      miscAmount: purchaseOrders.miscAmount,
      preparedByFirstName: users.firstName,
      preparedByLastName: users.lastName,
      preparedByEmail: users.email,
    })
    .from(purchaseOrders)
    .leftJoin(users, eq(purchaseOrders.preparedByUserId, users.id))
    .where(eq(purchaseOrders.id, id))
    .limit(1);

  if (!po) {
    notFound();
  }

  // 1. Token validation
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (po.approvalTokenHash !== tokenHash) {
    // Check if the user is an admin or IT manager, allowing override
    const isTechOrManager =
      user.role.name === "admin" ||
      user.role.name === "it_manager";

    if (!isTechOrManager) {
      return (
        <div className="flex min-h-svh items-center justify-center p-4">
          <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
            <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
              <KeyRound className="size-16 text-destructive" />
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">Invalid Approval Token</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  This link is invalid or has been revoked. If you believe this is an error, please contact IT Support.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // 2. Status validation: PO already processed
  if (po.status !== "pending_approval") {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-teal-500/20 bg-teal-500/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <CheckCircle2 className="size-16 text-teal-600" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Purchase Order Already Processed</h2>
              <p className="text-sm text-muted-foreground mt-2">
                This purchase order has already been marked as <strong className="capitalize">{po.status}</strong>. No further action is required.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiryTime = po.updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
  const isExpired = isLinkExpired(expiryTime);
  if (isExpired) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Approval Link Expired</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Approval links are only valid for 7 days. This link expired on{" "}
                {new Date(expiryTime).toLocaleDateString()}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApprover = po.approverUserId === user.id;
  const isAdmin = user.role.name === "admin";
  if (!isApprover && !isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <KeyRound className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Unauthorized Approver</h2>
              <p className="text-sm text-muted-foreground mt-2">
                You are logged in as {user.email}, but this purchase order is assigned to a different approver.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lines = await db
    .select({ unitPrice: purchaseOrderLines.unitPrice, quantity: purchaseOrderLines.quantity })
    .from(purchaseOrderLines)
    .where(eq(purchaseOrderLines.poId, po.id));

  const totals = computePoTotals({
    lines: lines.map((l) => ({ unitPrice: Number(l.unitPrice), quantity: Number(l.quantity) })),
    vatRegistered: po.vatRegistered,
    advancePaymentRegistered: po.advancePaymentRegistered,
    eInvoiced: po.eInvoiced,
    miscAmount: po.miscAmount ? Number(po.miscAmount) : null,
  });

  const preparerName = po.preparedByFirstName
    ? `${po.preparedByFirstName} ${po.preparedByLastName ?? ""}`.trim()
    : (po.preparedByEmail || "Unknown");

  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-muted/20">
      <DecisionForm
        poId={po.id}
        token={token}
        poNumber={po.poNumber}
        preparerName={preparerName}
        supplierName={po.supplierName}
        lineCount={lines.length}
        totalAmount={totals.totalAmount}
      />
    </div>
  );
}
