"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { submitPurchaseOrder, type ActionState } from "@/lib/actions/purchase-orders";
import { Send } from "lucide-react";

export function SubmitPoButton({ poId, disabled }: { poId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitPurchaseOrder, undefined);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
    } else if (state?.success) {
      if (state.emailError) {
        toast.warning("Submitted, but the approval email failed to send.", { description: state.emailError });
      } else {
        toast.success("Submitted for Managing Director approval.");
      }
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={poId} />
      <Button type="submit" disabled={disabled || pending}>
        <Send /> {pending ? "Submitting..." : "Submit for Approval"}
      </Button>
    </form>
  );
}
