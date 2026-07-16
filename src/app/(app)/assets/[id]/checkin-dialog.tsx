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
  DialogTrigger,
} from "@/components/ui/dialog";
import { checkinAssetAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

export function CheckinAssetDialog({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkinAssetAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Asset checked in successfully");
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Check In</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Check In Asset</DialogTitle>
            <DialogDescription>
              Return this asset back to inventory. It will be marked as "Ready to Deploy".
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assetId" value={assetId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Check-in Notes (Optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Describe the condition of the asset or return details..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Checking in..." : "Confirm Check In"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
