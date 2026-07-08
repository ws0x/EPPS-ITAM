"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { addKitItem, type ActionState } from "@/lib/actions/kits";
import { Plus } from "lucide-react";

type Option = { id: string; name: string };

export function AddKitItemDialog({
  kitId,
  models,
  consumables,
  licenses,
}: {
  kitId: string;
  models: Option[];
  consumables: Option[];
  licenses: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState<"model" | "consumable" | "license">("model");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addKitItem, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  const optionsByType = { model: models, consumable: consumables, license: licenses };
  const currentOptions = optionsByType[itemType];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus /> Add Item
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add Item to Kit</DialogTitle>
            <DialogDescription>Add a model, consumable, or license to this kit.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <input type="hidden" name="kitId" value={kitId} />
            <div className="flex flex-col gap-2">
              <Label>Item type</Label>
              <Select
                name="itemType"
                value={itemType}
                onValueChange={(v) => setItemType(v as typeof itemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="model">Model (Asset)</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                  <SelectItem value="license">License</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="itemId">Item</Label>
              <Select name="itemId" key={itemType} required>
                <SelectTrigger id="itemId">
                  <SelectValue placeholder={`Select a ${itemType}`} />
                </SelectTrigger>
                <SelectContent>
                  {currentOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
