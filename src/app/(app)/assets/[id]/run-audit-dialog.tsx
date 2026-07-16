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
import { runAssetAuditAction, type AuditActionState } from "@/lib/actions/audits";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";

export function RunAuditDialog({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AuditActionState, FormData>(runAssetAuditAction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success("Audit recorded - physical presence confirmed");
      setTimeout(() => setOpen(false), 0);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline"><ScanLine /> Run Audit</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Run Audit</DialogTitle>
            <DialogDescription>
              Confirm you&apos;ve physically located this asset. This updates the last-audited timestamp and
              schedules the next audit - it doesn&apos;t change location, status, or assignment.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="assetId" value={assetId} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="intervalMonths">Next audit due in (months)</Label>
            <Input id="intervalMonths" name="intervalMonths" type="number" min={1} step={1} defaultValue={12} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" placeholder="Condition, location confirmation, discrepancies..." rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Recording..." : "Confirm Audit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
