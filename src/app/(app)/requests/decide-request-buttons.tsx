"use client";

import * as React from "react";
import { useActionState, startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decideRequestInAppAction, type RequestActionState } from "@/lib/actions/requests";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export function DecideRequestButtons({ requestId }: { requestId: string }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const [approveState, approveAction, approvePending] = useActionState<RequestActionState, FormData>(
    decideRequestInAppAction,
    undefined
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<RequestActionState, FormData>(
    decideRequestInAppAction,
    undefined
  );

  useEffect(() => {
    if (approveState?.success) {
      toast.success("Request approved");
    } else if (approveState?.error) {
      toast.error(approveState.error);
    }
  }, [approveState]);

  useEffect(() => {
    if (rejectState?.success) {
      toast.success("Request rejected");
      setTimeout(() => setRejectOpen(false), 0);
    } else if (rejectState?.error) {
      toast.error(rejectState.error);
    }
  }, [rejectState]);

  const handleApprove = () => {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("status", "approved");
    startTransition(() => approveAction(formData));
  };

  const handleReject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("requestId", requestId);
    formData.set("status", "rejected");
    startTransition(() => rejectAction(formData));
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button
        size="xs"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 h-7 px-2.5"
        onClick={() => setRejectOpen(true)}
        disabled={approvePending}
      >
        <X className="size-3 mr-1" /> Reject
      </Button>
      <Button size="xs" className="h-7 px-2.5" onClick={handleApprove} disabled={approvePending}>
        <Check className="size-3 mr-1" /> {approvePending ? "Approving..." : "Approve"}
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleReject} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Reject Request</DialogTitle>
              <DialogDescription>Provide a reason so the requester understands why.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`rejectionReason-${requestId}`}>Reason</Label>
              <Textarea
                id={`rejectionReason-${requestId}`}
                name="rejectionReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectPending}>
                {rejectPending ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
