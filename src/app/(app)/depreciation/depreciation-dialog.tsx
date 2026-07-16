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
import { createDepreciationSchedule, updateDepreciationSchedule, type ActionState } from "@/lib/actions/depreciations";
import { Plus } from "lucide-react";

export type DepreciationScheduleRow = {
  id: string;
  name: string;
  months: number;
  minimumValuePct: number;
};

export function DepreciationDialog({
  editing,
  trigger,
}: {
  editing?: DepreciationScheduleRow;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const action = editing ? updateDepreciationSchedule : createDepreciationSchedule;
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
              <Plus /> Add Schedule
            </Button>
          )
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Depreciation Schedule" : "Add Depreciation Schedule"}</DialogTitle>
            <DialogDescription>
              Straight-line depreciation over a fixed useful life, down to a minimum salvage value.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={editing?.name} placeholder="e.g. Laptops - 3 Year" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="months">Useful Life (months)</Label>
              <Input
                id="months"
                name="months"
                type="number"
                min={1}
                step={1}
                defaultValue={editing?.months}
                placeholder="e.g. 36"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="minimumValuePct">Minimum Value (% of purchase cost)</Label>
              <Input
                id="minimumValuePct"
                name="minimumValuePct"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={editing?.minimumValuePct ?? 0}
                placeholder="e.g. 10"
                required
              />
              <span className="text-[10px] text-muted-foreground">
                Book value never depreciates below this floor (salvage value).
              </span>
            </div>

            {state?.error && (
              <p className="text-sm font-semibold text-destructive">{state.error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
