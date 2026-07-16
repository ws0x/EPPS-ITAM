"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import {
  sendLicenseExpiryDigestAction,
  sendWarrantyExpiryDigestAction,
  sendPendingApprovalReminderAction,
  sendOverdueCheckoutReminderAction,
  sendLowStockConsumableAlertAction,
} from "@/lib/notifications";

type DigestKey = "license" | "warranty" | "approval" | "checkout" | "lowstock";

const DIGESTS: { key: DigestKey; title: string; description: string; action: () => Promise<{ success: boolean; message: string }> }[] = [
  {
    key: "license",
    title: "License Expiry Digest",
    description: "Licenses expiring within 90 days, to all admins/IT managers.",
    action: sendLicenseExpiryDigestAction,
  },
  {
    key: "warranty",
    title: "Warranty Expiry Digest",
    description: "Asset warranties expiring within 90 days, to all admins/IT managers.",
    action: sendWarrantyExpiryDigestAction,
  },
  {
    key: "approval",
    title: "Pending Approval Reminder",
    description: "Nudges each approver whose request/PO has sat pending for 2+ days.",
    action: sendPendingApprovalReminderAction,
  },
  {
    key: "checkout",
    title: "Overdue Checkout Reminder",
    description: "Checkouts past their expected check-in date, to all admins/IT managers.",
    action: sendOverdueCheckoutReminderAction,
  },
  {
    key: "lowstock",
    title: "Low-Stock Consumable Alert",
    description: "Consumables at or below their minimum quantity, to all admins/IT managers.",
    action: sendLowStockConsumableAlertAction,
  },
];

export function DigestButtons() {
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<DigestKey | null>(null);

  function handleSend(digest: (typeof DIGESTS)[number]) {
    setPendingKey(digest.key);
    startTransition(async () => {
      try {
        const result = await digest.action();
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send digest.");
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {DIGESTS.map((digest) => (
        <div key={digest.key} className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div>
            <h3 className="text-sm font-semibold">{digest.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{digest.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending && pendingKey === digest.key}
            onClick={() => handleSend(digest)}
          >
            {isPending && pendingKey === digest.key ? <Loader2 className="animate-spin" /> : <Send />}
            Send now
          </Button>
        </div>
      ))}
    </div>
  );
}
