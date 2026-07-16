"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
// AlertDialogAction is a plain Button re-export — no Base UI Close wiring —
// so it needs to actually be the <form>'s submit button, not a render target.
import { checkInEverythingForUserAction, type CheckoutActionState } from "@/lib/actions/checkout";
import { LogOut } from "lucide-react";

type Holdings = {
  assets: Array<{ id: string; assetTag: string; modelName: string }>;
  licenseSeats: Array<{ id: string; licenseName: string }>;
  kits: Array<{ id: string; kitName: string }>;
};

export function CheckInEverythingDialog({
  userId,
  userName,
  holdings,
}: {
  userId: string;
  userName: string;
  holdings: Holdings;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CheckoutActionState, FormData>(
    checkInEverythingForUserAction,
    undefined,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success) {
      toast.success(`Checked in everything for ${userName}.`);
      setOpen(false);
    }
  }, [state, userName]);

  const items = [
    ...holdings.assets.map((a) => `${a.assetTag} — ${a.modelName}`),
    ...holdings.licenseSeats.map((s) => s.licenseName),
    ...holdings.kits.map((k) => `Kit: ${k.kitName}`),
  ];

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
            <LogOut /> Check In Everything
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Check in everything for {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This returns all {items.length} item{items.length === 1 ? "" : "s"} below to inventory in one action. This
            is typically used when offboarding a user. Consumables already received are not affected — they aren&apos;t
            returnable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-48 overflow-y-auto rounded-lg border p-3 text-sm flex flex-col gap-1">
          {items.map((label, i) => (
            <li key={i} className="text-muted-foreground">{label}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              {pending ? "Checking in..." : "Check In Everything"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
