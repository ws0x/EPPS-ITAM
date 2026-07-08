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
import { createLicense, updateLicense, type ActionState } from "@/lib/actions/licenses";
import { Plus } from "lucide-react";

export type LicenseRow = {
  id: string;
  name: string;
  categoryId: string;
  manufacturerId: string | null;
  licenseKey: string | null;
  seatsTotal: number;
  purchaseDate: string | null;
  purchaseCost: string | null;
  expiresAt: string | null;
  notes: string | null;
};

export function LicenseDialog({
  categories,
  manufacturers,
  editing,
  trigger,
}: {
  categories: { id: string; name: string }[];
  manufacturers: { id: string; name: string }[];
  editing?: LicenseRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateLicense : createLicense;
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
              <Plus /> Add License
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit License" : "Add License"}</DialogTitle>
            <DialogDescription>e.g. Microsoft Office 365, Windows 11 Pro.</DialogDescription>
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
              <Label htmlFor="licenseKey">License key</Label>
              <Input id="licenseKey" name="licenseKey" className="font-mono" defaultValue={editing?.licenseKey ?? ""} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="seatsTotal">Seats</Label>
                <Input id="seatsTotal" name="seatsTotal" type="number" min={1} defaultValue={editing?.seatsTotal ?? 1} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchaseDate">Purchased</Label>
                <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={editing?.purchaseDate ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="expiresAt">Expires</Label>
                <Input id="expiresAt" name="expiresAt" type="date" defaultValue={editing?.expiresAt ?? ""} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="purchaseCost">Purchase cost (EGP)</Label>
              <Input id="purchaseCost" name="purchaseCost" type="number" step="0.01" defaultValue={editing?.purchaseCost ?? ""} />
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
