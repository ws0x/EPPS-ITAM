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
import { createManufacturer, updateManufacturer, type ActionState } from "@/lib/actions/manufacturers";
import { Plus } from "lucide-react";

export type ManufacturerRow = {
  id: string;
  name: string;
  supportUrl: string | null;
  supportPhone: string | null;
};

export function ManufacturerDialog({
  editing,
  trigger,
}: {
  editing?: ManufacturerRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateManufacturer : createManufacturer;
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
              <Plus /> Add Manufacturer
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Manufacturer" : "Add Manufacturer"}</DialogTitle>
            <DialogDescription>e.g. Lenovo, HP, Dell, Cisco.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="supportUrl">Support URL</Label>
              <Input id="supportUrl" name="supportUrl" defaultValue={editing?.supportUrl ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="supportPhone">Support phone</Label>
              <Input id="supportPhone" name="supportPhone" defaultValue={editing?.supportPhone ?? ""} />
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
