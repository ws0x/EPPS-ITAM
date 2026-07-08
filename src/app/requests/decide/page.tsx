import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/db/client";
import { requests, users, models, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DecisionForm } from "./decision-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import crypto from "node:crypto";

export default async function RequestDecidePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;

  if (!id || !token) {
    notFound();
  }

  // 1. Auth check: requires user login
  const user = await getCurrentUser();
  if (!user) {
    // Encodes the path with token so it remains a single query param to /login
    const callbackUrl = encodeURIComponent(`/requests/decide?id=${id}&token=${token}`);
    redirect(`/login?redirectTo=${callbackUrl}`);
  }

  // 2. Fetch Request Details
  const [reqRow] = await db
    .select({
      id: requests.id,
      quantity: requests.quantity,
      status: requests.status,
      justification: requests.justification,
      createdAt: requests.createdAt,
      approvalTokenHash: requests.approvalTokenHash,
      approverUserId: requests.approverUserId,
      requesterEmail: users.email,
      requesterFirstName: users.firstName,
      requesterLastName: users.lastName,
      modelName: models.name,
      categoryName: categories.name,
    })
    .from(requests)
    .innerJoin(users, eq(requests.requesterUserId, users.id))
    .leftJoin(models, eq(requests.modelId, models.id))
    .leftJoin(categories, eq(requests.categoryId, categories.id))
    .where(eq(requests.id, id))
    .limit(1);

  if (!reqRow) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Request Not Found</h2>
              <p className="text-sm text-muted-foreground mt-2">
                This request may have been removed or does not exist.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Security check: Token verification
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (reqRow.approvalTokenHash !== tokenHash) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Invalid Security Token</h2>
              <p className="text-sm text-muted-foreground mt-2">
                The token provided in the link is invalid or has been revoked.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Status check: already decided?
  if (reqRow.status !== "pending_approval") {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-teal-500/20 bg-teal-500/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <CheckCircle2 className="size-16 text-teal-600" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Request Already Processed</h2>
              <p className="text-sm text-muted-foreground mt-2">
                This request has already been marked as <strong className="capitalize">{reqRow.status}</strong>. No further action is required.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 5. Expiration check: 7 days
  const expiryTime = reqRow.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000;
  const isExpired = Date.now() > expiryTime;
  if (isExpired) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <AlertTriangle className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Request Link Expired</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Approval links are only valid for 7 days. This request expired on{" "}
                {new Date(expiryTime).toLocaleDateString()}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 6. Authorization check: must be designated approver or override role
  const isApprover = reqRow.approverUserId === user.id;
  const isITManager = user.role.name === "it_manager" || user.role.name === "admin";
  if (!isApprover && !isITManager) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/[0.01]">
          <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
            <KeyRound className="size-16 text-destructive" />
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">Unauthorized Approver</h2>
              <p className="text-sm text-muted-foreground mt-2">
                You are logged in as {user.email}, but this request is assigned to a different manager.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requesterName = reqRow.requesterFirstName
    ? `${reqRow.requesterFirstName} ${reqRow.requesterLastName ?? ""}`.trim()
    : reqRow.requesterEmail;

  const itemName = reqRow.modelName || reqRow.categoryName || "Requested Item";

  return (
    <div className="flex min-h-svh items-center justify-center p-4 bg-muted/20">
      <DecisionForm
        requestId={reqRow.id}
        token={token}
        requesterName={requesterName}
        itemName={itemName}
        quantity={reqRow.quantity}
        justification={reqRow.justification}
      />
    </div>
  );
}
