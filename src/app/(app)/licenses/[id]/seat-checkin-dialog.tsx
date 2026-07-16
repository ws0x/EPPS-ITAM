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
import { checkinLicenseSeatAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

export function SeatCheckinDialog({
  seatId,
  seatIndex,
}: {
  seatId: string;
  seatIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkinLicenseSeatAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Seat #${seatIndex} checked in successfully`);
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, seatIndex]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">Unassign</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Unassign License Seat #{seatIndex}</DialogTitle>
            <DialogDescription>
              Return this license seat back to the pool.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="seatId" value={seatId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Check-in Notes (Optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Describe return details..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Unassigning..." : "Confirm Unassign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
