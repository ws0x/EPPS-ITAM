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
import { checkinAccessoryAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

export function CheckinAccessoryDialog({
  assignmentId,
  assigneeLabel,
}: {
  assignmentId: string;
  assigneeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkinAccessoryAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Returned successfully`);
      setTimeout(() => setOpen(false), 0);
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
      <DialogTrigger
        render={
          <Button size="xs" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
            Return
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Return Accessory</DialogTitle>
            <DialogDescription>Check in this assignment from {assigneeLabel} back to stock.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assignmentId" value={assignmentId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Check-in Notes (Optional)</Label>
            <Textarea id="notes" name="notes" placeholder="Describe return details..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Returning..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
