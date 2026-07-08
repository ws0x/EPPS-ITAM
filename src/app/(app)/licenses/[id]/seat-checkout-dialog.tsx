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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkoutLicenseSeatAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

type Option = { id: string; name: string };

export function SeatCheckoutDialog({
  seatId,
  users,
  assets,
  seatIndex,
}: {
  seatId: string;
  users: Option[];
  assets: Option[];
  seatIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [assignType, setAssignType] = useState<"user" | "asset">("user");
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutLicenseSeatAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Seat #${seatIndex} checked out successfully`);
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
      <DialogTrigger render={<Button size="xs" variant="outline">Assign Seat</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Assign License Seat #{seatIndex}</DialogTitle>
            <DialogDescription>
              Assign this seat to an employee or a physical asset.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="seatId" value={seatId} />

          {/* Toggle Type */}
          <div className="flex flex-col gap-2">
            <Label>Assignment Target</Label>
            <div className="flex gap-2 bg-muted p-1 rounded-lg">
              <Button
                type="button"
                variant={assignType === "user" ? "secondary" : "ghost"}
                className="flex-1 size-7 text-xs font-semibold"
                onClick={() => setAssignType("user")}
              >
                User
              </Button>
              <Button
                type="button"
                variant={assignType === "asset" ? "secondary" : "ghost"}
                className="flex-1 size-7 text-xs font-semibold"
                onClick={() => setAssignType("asset")}
              >
                Asset
              </Button>
            </div>
          </div>

          {assignType === "user" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="assignedToUserId">Employee</Label>
              <Select name="assignedToUserId" required={assignType === "user"}>
                <SelectTrigger id="assignedToUserId" className="w-full">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="assignedToAssetId">Asset</Label>
              <Select name="assignedToAssetId" required={assignType === "asset"}>
                <SelectTrigger id="assignedToAssetId" className="w-full">
                  <SelectValue placeholder="Select an asset tag / name" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Provide allocation notes (e.g. workspace, project name)..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
