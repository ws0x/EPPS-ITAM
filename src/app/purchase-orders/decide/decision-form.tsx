"use client";

import * as React from "react";
import { useActionState, startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { decidePurchaseOrder, type ActionState } from "@/lib/actions/purchase-orders";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

function formatEgp(n: number) {
  return `EGP ${n.toLocaleString("en-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DecisionForm({
  poId,
  token,
  poNumber,
  preparerName,
  supplierName,
  lineCount,
  totalAmount,
}: {
  poId: string;
  token: string;
  poNumber: string;
  preparerName: string;
  supplierName: string;
  lineCount: number;
  totalAmount: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(decidePurchaseOrder, undefined);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (state?.success) {
      toast.success(`Purchase order successfully ${decision}`);
      setCompleted(true);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, decision]);

  const handleSubmit = (status: "approved" | "rejected") => {
    if (status === "rejected" && !rejectionReason.trim()) {
      toast.error("Please enter a reason for rejection.");
      return;
    }

    setDecision(status);
    const formData = new FormData();
    formData.append("id", poId);
    formData.append("token", token);
    formData.append("status", status);
    if (status === "rejected") {
      formData.append("rejectionReason", rejectionReason);
    }

    startTransition(() => {
      formAction(formData);
    });
  };

  if (completed) {
    return (
      <Card className="w-full max-w-lg border-teal-500/20 bg-teal-500/[0.01]">
        <CardContent className="pt-8 flex flex-col items-center text-center gap-4">
          {decision === "approved" ? (
            <CheckCircle2 className="size-16 text-teal-600" />
          ) : (
            <XCircle className="size-16 text-destructive" />
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">Purchase Order {decision === "approved" ? "Approved" : "Rejected"}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Your decision has been logged. You can now close this window.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg border-primary/20">
      <CardHeader className="bg-primary/[0.01] border-b pb-4">
        <CardTitle className="text-lg text-primary">Review Purchase Order</CardTitle>
        <CardDescription>Verify details before choosing action.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-y-3 text-sm">
          <span className="text-muted-foreground font-semibold">PO Number</span>
          <span className="col-span-2 font-mono font-medium">{poNumber}</span>

          <span className="text-muted-foreground font-semibold">Prepared By</span>
          <span className="col-span-2 font-medium">{preparerName}</span>

          <span className="text-muted-foreground font-semibold">Supplier</span>
          <span className="col-span-2 font-medium">{supplierName}</span>

          <span className="text-muted-foreground font-semibold">Line Items</span>
          <span className="col-span-2 font-mono">{lineCount}</span>

          <span className="text-muted-foreground font-semibold">Total</span>
          <span className="col-span-2 font-mono font-bold">{formatEgp(totalAmount)}</span>
        </div>

        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rejectionReason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Reason for Rejection (Required only if rejecting)
            </Label>
            <Textarea
              id="rejectionReason"
              placeholder="Provide a brief explanation if you plan to reject this purchase order..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {state?.error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10 flex-1"
              disabled={pending}
              onClick={() => handleSubmit("rejected")}
            >
              Reject
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={pending}
              onClick={() => handleSubmit("approved")}
            >
              {pending && decision === "approved" ? "Approving..." : "Approve"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
