"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createComponent, updateComponent, type ActionState } from "@/lib/actions/components";
import { Plus } from "lucide-react";

export type ComponentRow = {
  id: string;
  name: string;
  categoryId: string;
  manufacturerId: string | null;
  modelNumber: string | null;
  qtyTotal: number;
  minQty: number;
  purchaseCost: string | null;
  notes: string | null;
};

export function ComponentDialog({
  categories,
  manufacturers,
  editing,
  trigger,
}: {
  categories: { id: string; name: string }[];
  manufacturers: { id: string; name: string }[];
  editing?: ComponentRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateComponent : createComponent;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus /> Add Component
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Component" : "Add Component"}</DialogTitle>
            <DialogDescription>e.g. RAM Stick, SSD, Power Supply.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="categoryId">Category</Label>
                <Select name="categoryId" defaultValue={editing?.categoryId} required>
                  <SelectTrigger id="categoryId">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manufacturerId">Manufacturer</Label>
                <Select name="manufacturerId" defaultValue={editing?.manufacturerId ?? undefined}>
                  <SelectTrigger id="manufacturerId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {manufacturers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="modelNumber">Model number</Label>
              <Input id="modelNumber" name="modelNumber" defaultValue={editing?.modelNumber ?? ""} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qtyTotal">Quantity</Label>
                <Input id="qtyTotal" name="qtyTotal" type="number" min={0} defaultValue={editing?.qtyTotal ?? 0} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="minQty">Min quantity</Label>
                <Input id="minQty" name="minQty" type="number" min={0} defaultValue={editing?.minQty ?? 0} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchaseCost">Cost (EGP)</Label>
                <Input id="purchaseCost" name="purchaseCost" type="number" step="0.01" defaultValue={editing?.purchaseCost ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
