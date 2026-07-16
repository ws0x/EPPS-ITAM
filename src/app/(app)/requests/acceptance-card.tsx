"use client";

import * as React from "react";
import { useActionState, startTransition, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { acceptCheckoutAction, declineCheckoutAction, type AcceptanceActionState } from "@/lib/actions/acceptances";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Calendar } from "lucide-react";

export function AcceptanceCard({
  acceptance,
}: {
  acceptance: {
    id: string;
    status: string;
    createdAt: Date;
    eulaSnapshot: string | null;
    assetTag: string | null;
    serial: string | null;
    modelName: string | null;
    checkoutNotes: string | null;
  };
}) {
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [declineNote, setDeclineNote] = useState("");

  const [acceptState, acceptAction, acceptPending] = useActionState<AcceptanceActionState, FormData>(
    acceptCheckoutAction,
    undefined
  );

  const [declineState, declineAction, declinePending] = useActionState<AcceptanceActionState, FormData>(
    declineCheckoutAction,
    undefined
  );

  useEffect(() => {
    if (acceptState?.success) {
      toast.success("Assignment accepted successfully");
      setAcceptOpen(false);
    } else if (acceptState?.error) {
      toast.error(acceptState.error);
    }
  }, [acceptState]);

  useEffect(() => {
    if (declineState?.success) {
      toast.success("Assignment declined and returned to inventory");
      setDeclineOpen(false);
    } else if (declineState?.error) {
      toast.error(declineState.error);
    }
  }, [declineState]);

  const handleAcceptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      acceptAction(formData);
    });
  };

  const handleDeclineSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      declineAction(formData);
    });
  };

  return (
    <Card className="border-teal-500/20 bg-teal-500/[0.01]">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-bold text-teal-600">Action Required: Custody Sign-Off</CardTitle>
            <CardDescription className="text-xs mt-1">
              Please review the EULA and accept responsibility for the checked out asset.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md font-medium border border-border/40">
            <Calendar className="size-3.5" />
            <span>Assigned {new Date(acceptance.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-4">
        {/* Asset Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-muted/20 p-3 rounded-lg border text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-semibold">Asset Model</span>
            <span className="font-semibold text-foreground">{acceptance.modelName || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-semibold">Asset Tag</span>
            <span className="font-mono font-semibold text-foreground">{acceptance.assetTag || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-semibold">Serial Number</span>
            <span className="font-mono font-semibold text-foreground">{acceptance.serial || "N/A"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground font-semibold">Checkout Notes</span>
            <span className="text-muted-foreground italic font-medium">{acceptance.checkoutNotes || "None"}</span>
          </div>
        </div>

        {/* EULA Scrollable Box */}
        {acceptance.eulaSnapshot ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">End User License Agreement (EULA)</Label>
            <ScrollArea className="h-[120px] w-full rounded-md border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
              {acceptance.eulaSnapshot}
            </ScrollArea>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground bg-muted/10 p-3 rounded-md border border-dashed text-center">
            No specific EULA provided. By signing, you accept standard company custody terms.
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-3 border-t border-border/40 pt-3">
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10 text-xs h-9 px-4"
          onClick={() => setDeclineOpen(true)}
        >
          Decline Assignment
        </Button>
        <Button
          className="text-xs h-9 px-4"
          onClick={() => setAcceptOpen(true)}
        >
          Sign Off & Accept
        </Button>
      </CardFooter>

      {/* Accept E-Sign Dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAcceptSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="acceptanceId" value={acceptance.id} />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-teal-600">
                <ShieldCheck className="size-5" />
                Sign Off & Accept Asset
              </DialogTitle>
              <DialogDescription>
                By signing, you confirm receipt and accept full responsibility for this asset.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signatureText">Type your full name as signature</Label>
              <Input
                id="signatureText"
                name="signatureText"
                placeholder="e.g. John Doe"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground leading-normal mt-1">
                This signature will be digitally logged with your email address and timestamps.
              </p>
            </div>

            <DialogFooter className="mt-2">
              <Button type="submit" disabled={acceptPending}>
                {acceptPending ? "Signing..." : "Confirm Acceptance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleDeclineSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="acceptanceId" value={acceptance.id} />
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="size-5" />
                Decline Asset Assignment
              </DialogTitle>
              <DialogDescription>
                Provide a reason for declining. This asset will be automatically returned to inventory.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="note">Reason for declining</Label>
              <Textarea
                id="note"
                name="note"
                placeholder="Explain why you are declining custody of this asset..."
                className="min-h-[80px]"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="submit"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                disabled={declinePending}
              >
                {declinePending ? "Declining..." : "Decline & Return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
