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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkCheckoutKitAction } from "@/lib/actions/checkout";
import { toast } from "sonner";
import { PackageOpen, X, ShoppingBag } from "lucide-react";

type KitRow = { id: string; name: string; notes: string | null; itemCount: number };
type Option = { id: string; name: string };

export function KitsTable({ kits, users }: { kits: KitRow[]; users: Option[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTimeout(() => setSelectedIds(new Set()), 0);
  }, [kits]);

  const selectedCount = selectedIds.size;

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(kits.map((k) => k.id)) : new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignedToUserId) {
      toast.error("Please select an employee.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    formData.append("kitIds", Array.from(selectedIds).join(","));

    startTransition(async () => {
      const res = await bulkCheckoutKitAction(undefined, formData);
      if (res?.success) {
        toast.success(res.pendingApproval ? "Bulk checkout requests submitted for IT Manager approval" : "Kits checked out successfully");
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
                  checked={selectedCount > 0 && selectedCount === kits.length && kits.length > 0}
                  onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                  disabled={kits.length === 0}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kits.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageOpen className="size-8 opacity-40" />
                    <p className="text-sm">No kits yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {kits.map((kit) => {
              const isSelected = selectedIds.has(kit.id);
              return (
                <TableRow key={kit.id} className={isSelected ? "bg-primary/[0.02]" : ""}>
                  <TableCell className="px-4 text-center">
                    <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleSelect(kit.id, !!checked)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/kits/${kit.id}`} className="hover:text-primary hover:underline">
                      {kit.name}
                    </Link>
                  </TableCell>
                  <TableCell>{kit.itemCount} item{kit.itemCount === 1 ? "" : "s"}</TableCell>
                  <TableCell className="text-muted-foreground">{kit.notes ?? "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Sticky Bottom Multi-Select Action Toolbar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-4 overflow-x-auto bg-sidebar/90 backdrop-blur-md border border-white/10 px-5 py-3.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex shrink-0 items-center gap-2 pr-3 border-r border-white/10">
            <Badge className="bg-primary/20 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full">
              {selectedCount}
            </Badge>
            <span className="text-xs text-sidebar-foreground font-medium whitespace-nowrap">
              {selectedCount === 1 ? "kit" : "kits"} selected
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 rounded-full"
              onClick={() => setBulkOpen(true)}
            >
              <ShoppingBag className="size-3.5 mr-1" /> Bulk Checkout
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground size-8 hover:bg-white/5 rounded-full"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Checkout Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleBulkSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Bulk Checkout Kits</DialogTitle>
              <DialogDescription>
                Assign {selectedCount} selected kit{selectedCount === 1 ? "" : "s"} to one employee. Each kit&apos;s
                component items are checked out individually as part of this action.
              </DialogDescription>
            </DialogHeader>

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
