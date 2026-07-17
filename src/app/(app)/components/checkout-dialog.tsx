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
import { PlugZap } from "lucide-react";
import { toast } from "sonner";

type AssetOption = { id: string; assetTag: string; name: string | null };

export function CheckoutComponentDialog({
  componentId,
  componentName,
  maxQuantity,
  assets,
}: {
  componentId: string;
  componentName: string;
  maxQuantity: number;
  assets: AssetOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkoutComponentAction,
    undefined
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(`Component installed successfully`);
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
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-primary hover:text-primary hover:bg-primary/10"
            aria-label={`Install ${componentName}`}
          >
            <PlugZap className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Install Component</DialogTitle>
            <DialogDescription>
              Assign units of &quot;{componentName}&quot; to an asset. They can be removed later.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="componentId" value={componentId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="assignedToAssetId">Asset</Label>
            <Select name="assignedToAssetId" required>
              <SelectTrigger id="assignedToAssetId" className="w-full">
                <SelectValue placeholder="Select an asset" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.assetTag} — {a.name}
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
              placeholder="Provide installation notes..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || maxQuantity <= 0}>
              {maxQuantity <= 0 ? "Out of Stock" : pending ? "Installing..." : "Install"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
