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
import { checkoutConsumableAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

type Option = { id: string; name: string };

export function CheckoutConsumableDialog({
  consumableId,
  consumableName,
  maxQuantity,
  users,
}: {
  consumableId: string;
  consumableName: string;
  maxQuantity: number;
  users: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutConsumableAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Consumable checked out successfully`);
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
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 text-primary hover:text-primary hover:bg-primary/10">
            <ShoppingBag className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Check Out Consumable</DialogTitle>
            <DialogDescription>
              Assign units of "{consumableName}" to an employee.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="consumableId" value={consumableId} />

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
            <Label htmlFor="quantity">Quantity (Max: {maxQuantity})</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              defaultValue={1}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Provide assignment notes or deployment reasons..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || maxQuantity <= 0}>
              {maxQuantity <= 0 ? "Out of Stock" : pending ? "Checking out..." : "Check Out"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
