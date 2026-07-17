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
import { checkoutComponentAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type ComponentOption = { id: string; name: string; qtyAvailable: number };

export function InstallComponentDialog({
  assetId,
  components,
}: {
  assetId: string;
  components: ComponentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [componentId, setComponentId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutComponentAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success("Component installed successfully");
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

  const selected = components.find((c) => c.id === componentId);
  const maxQuantity = selected?.qtyAvailable ?? 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus /> Install Component
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Install Component</DialogTitle>
            <DialogDescription>Assign a component to this asset. It can be removed later.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assignedToAssetId" value={assetId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="componentId">Component</Label>
            <Select name="componentId" value={componentId} onValueChange={setComponentId} required>
              <SelectTrigger id="componentId" className="w-full">
                <SelectValue placeholder="Select a component" />
              </SelectTrigger>
              <SelectContent>
                {components.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.qtyAvailable} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantity (Max: {maxQuantity})</Label>
            <Input id="quantity" name="quantity" type="number" min={1} max={maxQuantity} defaultValue={1} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Provide installation notes..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || components.length === 0}>
              {components.length === 0 ? "No Components Available" : pending ? "Installing..." : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
