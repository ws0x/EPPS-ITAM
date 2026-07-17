"use client";

import * as React from "react";
import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccessoryDialog, type AccessoryRow } from "./accessory-dialog";
import { CheckoutAccessoryDialog } from "./checkout-dialog";
import { BulkSelectionToolbar } from "@/components/bulk-selection-toolbar";
import { bulkCheckoutAccessoryAction } from "@/lib/actions/checkout";
import { toast } from "sonner";
import { Headphones, Pencil, ShoppingBag } from "lucide-react";

type Option = { id: string; name: string };
type AccessoryListRow = AccessoryRow & { qtyAssigned: number; qtyAvailable: number };

export function AccessoriesTable({
  accessories,
  categories,
  manufacturers,
  users,
}: {
  accessories: AccessoryListRow[];
  categories: Option[];
  manufacturers: Option[];
  users: Option[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const manufacturerById = new Map(manufacturers.map((m) => [m.id, m]));

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTimeout(() => setSelectedIds(new Set()), 0);
  }, [accessories]);

  const selectableIds = accessories.filter((a) => a.qtyAvailable > 0).map((a) => a.id);
  const selectedCount = selectedIds.size;
  const selectedAccessories = accessories.filter((a) => selectedIds.has(a.id));

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(selectableIds) : new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const openBulkDialog = () => {
    const initialQty: Record<string, number> = {};
    for (const a of selectedAccessories) initialQty[a.id] = Math.min(1, a.qtyAvailable);
    setQuantities(initialQty);
    setBulkOpen(true);
  };

  const handleBulkSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignedToUserId) {
      toast.error("Please select an employee.");
      return;
    }
    const items = selectedAccessories.map((a) => ({ accessoryId: a.id, quantity: quantities[a.id] ?? 1 }));
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      toast.error("Every selected accessory needs a valid quantity.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const res = await bulkCheckoutAccessoryAction(undefined, formData);
      if (res?.success) {
        toast.success("Accessories checked out successfully");
        setSelectedIds(new Set());
        setBulkOpen(false);
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="relative flex flex-col gap-4">
      <div className="rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12 px-4 text-center">
                <Checkbox
                  checked={selectedCount > 0 && selectedCount === selectableIds.length && selectableIds.length > 0}
                  onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  disabled={selectableIds.length === 0}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Available</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accessories.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Headphones className="size-8 opacity-40" />
                    <p className="text-sm">No accessories yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {accessories.map((a) => {
              const isLow = a.qtyAvailable <= a.minQty;
              const isSelected = selectedIds.has(a.id);
              return (
                <TableRow key={a.id} className={isSelected ? "bg-primary/[0.02]" : ""}>
                  <TableCell className="px-4 text-center">
                    <Checkbox
                      checked={isSelected}
                      disabled={a.qtyAvailable <= 0}
                      onCheckedChange={(checked) => toggleSelect(a.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/accessories/${a.id}`} className="hover:text-primary hover:underline">
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell>{categoryById.get(a.categoryId)?.name ?? "-"}</TableCell>
                  <TableCell>{a.manufacturerId ? (manufacturerById.get(a.manufacturerId)?.name ?? "-") : "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={isLow ? "border-amber-500 text-amber-600 bg-amber-500/10" : ""}
                    >
                      {a.qtyAvailable} / {a.qtyTotal} available
                    </Badge>
                  </TableCell>
                  <TableCell className="flex items-center gap-1">
                    <CheckoutAccessoryDialog
                      accessoryId={a.id}
                      accessoryName={a.name}
                      maxQuantity={a.qtyAvailable}
                      users={users}
                    />
                    <AccessoryDialog
                      categories={categories.map((cat) => ({ id: cat.id, name: cat.name }))}
                      manufacturers={manufacturers}
                      editing={a}
                      trigger={
                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${a.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <BulkSelectionToolbar count={selectedCount} itemLabel="item" onClear={() => setSelectedIds(new Set())}>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 rounded-full"
          onClick={openBulkDialog}
        >
          <ShoppingBag className="size-3.5 mr-1" /> Bulk Checkout
        </Button>
      </BulkSelectionToolbar>

      {/* Bulk Checkout Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Bulk Checkout Accessories</DialogTitle>
              <DialogDescription>
                Assign {selectedCount} selected accessor{selectedCount === 1 ? "y" : "ies"} to one employee.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {selectedAccessories.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <span className="text-sm font-medium truncate">{a.name}</span>
                  <Input
                    type="number"
                    min={1}
                    max={a.qtyAvailable}
                    value={quantities[a.id] ?? 1}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [a.id]: Number(e.target.value) }))
                    }
                    className="w-20 h-8 text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assignedToUserId">Employee</Label>
              <Select name="assignedToUserId" value={assignedToUserId} onValueChange={setAssignedToUserId} required>
                <SelectTrigger id="assignedToUserId" className="w-full">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" placeholder="Details of the checkout..." rows={3} />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Processing..." : "Complete Checkout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
