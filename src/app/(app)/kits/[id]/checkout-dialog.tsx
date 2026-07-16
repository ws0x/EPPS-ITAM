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
import { checkoutKitAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { toast } from "sonner";

type Option = { id: string; name: string };

export function CheckoutKitDialog({
  kitId,
  kitName,
  users,
  hasItems,
}: {
  kitId: string;
  kitName: string;
  users: Option[];
  hasItems: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutKitAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Kit "${kitName}" checked out successfully`);
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, kitName]);

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
          <Button size="sm" disabled={!hasItems}>
            Check Out Kit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Check Out Kit</DialogTitle>
            <DialogDescription>
              Assign the bundle "{kitName}" and all its sub-items to an employee.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="kitId" value={kitId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="assignedToUserId">Employee</Label>
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
