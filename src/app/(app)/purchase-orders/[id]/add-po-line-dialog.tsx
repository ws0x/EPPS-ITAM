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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPoLine, type ActionState } from "@/lib/actions/purchase-orders";
import { Plus } from "lucide-react";

type Option = { id: string; name: string };

export function AddPoLineDialog({
  poId,
  beneficiaryCompanies,
  beneficiaryDepartments,
}: {
  poId: string;
  beneficiaryCompanies: Option[];
  beneficiaryDepartments: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addPoLine, undefined);
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
          <Button size="sm">
            <Plus /> Add Line Item
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>Add an item to this purchase order.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <input type="hidden" name="poId" value={poId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="itemCode">Item code (optional)</Label>
                <Input id="itemCode" name="itemCode" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="unit">Unit (optional)</Label>
                <Input id="unit" name="unit" placeholder="e.g. pcs, box" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="unitPrice">Unit price (EGP)</Label>
                <Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" step="0.01" min="0.01" defaultValue={1} required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="beneficiaryCompany">Beneficiary company</Label>
              <Select name="beneficiaryCompany" required>
                <SelectTrigger id="beneficiaryCompany">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {beneficiaryCompanies.map((o) => (
                    <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="beneficiaryDepartment">Beneficiary department</Label>
              <Select name="beneficiaryDepartment" required>
                <SelectTrigger id="beneficiaryDepartment">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {beneficiaryDepartments.map((o) => (
                    <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="beneficiaryEmployee">Beneficiary employee (optional)</Label>
              <Input id="beneficiaryEmployee" name="beneficiaryEmployee" />
            </div>
            {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
