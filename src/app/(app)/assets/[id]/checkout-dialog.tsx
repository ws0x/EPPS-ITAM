"use client";

import * as React from "react";
import { useActionState, startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { checkoutAssetAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

type Option = { id: string; name: string };

export function CheckoutAssetDialog({
  assetId,
  users,
}: {
  assetId: string;
  users: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutAssetAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Asset checked out successfully");
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
      <DialogTrigger render={<Button size="sm">Check Out</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Check Out Asset</DialogTitle>
            <DialogDescription>
              Assign this asset to a company employee.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assetId" value={assetId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="assignedToUserId">Assignee</Label>
            <Select name="assignedToUserId" required>
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="expectedCheckinAt">Expected Return Date (Optional)</Label>
            <Input id="expectedCheckinAt" name="expectedCheckinAt" type="date" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Provide context or deployment details..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Checking out..." : "Confirm Checkout"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
