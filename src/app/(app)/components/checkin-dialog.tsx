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
import { checkinComponentAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

export function CheckinComponentDialog({
  assignmentId,
  assetLabel,
}: {
  assignmentId: string;
  assetLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkinComponentAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Removed successfully`);
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
            Remove
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Remove Component</DialogTitle>
            <DialogDescription>Uninstall this component from {assetLabel} and return it to stock.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assignmentId" value={assignmentId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Removal Notes (Optional)</Label>
            <Textarea id="notes" name="notes" placeholder="Describe removal details..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Removing..." : "Confirm Removal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
