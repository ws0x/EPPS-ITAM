"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePurchaseOrder, type ActionState } from "@/lib/actions/purchase-orders";

const MISC_TYPES = ["Shipping Cost", "Installation Fees", "Repairing Fees", "Transportations"];

export type PoHeader = {
  id: string;
  date: string;
  prNumber: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierTel: string | null;
  supplierFax: string | null;
  supplierEmail: string | null;
  vatRegistered: boolean;
  advancePaymentRegistered: boolean;
  eInvoiced: boolean;
  miscAmount: string | null;
  miscType: string | null;
  paymentTerm: string | null;
  deliveryDate: string | null;
  note: string | null;
};

export function PoHeaderForm({ po, editable }: { po: PoHeader; editable: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updatePurchaseOrder, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.success !== undefined) toast.success("Purchase order updated.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6 rounded-lg border p-6 shadow-sm">
      <input type="hidden" name="id" value={po.id} />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierName">Supplier name</Label>
          <Input id="supplierName" name="supplierName" defaultValue={po.supplierName} disabled={!editable} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="prNumber">PR number</Label>
          <Input id="prNumber" name="prNumber" defaultValue={po.prNumber ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={po.date} disabled={!editable} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierAddress">Supplier address</Label>
          <Input id="supplierAddress" name="supplierAddress" defaultValue={po.supplierAddress ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierEmail">Supplier email</Label>
          <Input id="supplierEmail" name="supplierEmail" type="email" defaultValue={po.supplierEmail ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierTel">Supplier tel</Label>
          <Input id="supplierTel" name="supplierTel" defaultValue={po.supplierTel ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="supplierFax">Supplier fax</Label>
          <Input id="supplierFax" name="supplierFax" defaultValue={po.supplierFax ?? ""} disabled={!editable} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tax &amp; Payment Flags</Label>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id="vatRegistered" name="vatRegistered" defaultChecked={po.vatRegistered} disabled={!editable} />
            <Label htmlFor="vatRegistered" className="font-normal">VAT registered (+14%)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="advancePaymentRegistered" name="advancePaymentRegistered" defaultChecked={po.advancePaymentRegistered} disabled={!editable} />
            <Label htmlFor="advancePaymentRegistered" className="font-normal">Advance payment registered (waives 1% WHT)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="eInvoiced" name="eInvoiced" defaultChecked={po.eInvoiced} disabled={!editable} />
            <Label htmlFor="eInvoiced" className="font-normal">E-invoiced (misc. charge +14%)</Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="miscAmount">Misc. charge amount (EGP)</Label>
          <Input id="miscAmount" name="miscAmount" type="number" step="0.01" defaultValue={po.miscAmount ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="miscType">Misc. charge type</Label>
          <Select name="miscType" defaultValue={po.miscType ?? undefined} disabled={!editable}>
            <SelectTrigger id="miscType">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {MISC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="paymentTerm">Payment term</Label>
          <Input id="paymentTerm" name="paymentTerm" defaultValue={po.paymentTerm ?? ""} disabled={!editable} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deliveryDate">Delivery date</Label>
          <Input id="deliveryDate" name="deliveryDate" type="date" defaultValue={po.deliveryDate ?? ""} disabled={!editable} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" defaultValue={po.note ?? ""} disabled={!editable} />
      </div>

      {editable && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
