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
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { bulkCheckoutAssetAction, bulkCheckinAssetAction } from "@/lib/actions/checkout";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useListFilters } from "@/hooks/use-list-filters";
import { Boxes, X, Search, ChevronLeft, ChevronRight } from "lucide-react";

type AssetType = {
  id: string;
  assetTag: string;
  name: string | null;
  serial: string | null;
  modelName: string;
  categoryName: string;
  statusName: string;
  statusColor: string | null;
  locationName: string | null;
  assignedToFirstName: string | null;
  assignedToLastName: string | null;
  assignedToEmail: string | null;
};

type Option = { id: string; name: string };

export function AssetsTable({
  assets,
  users,
  statuses,
  categories,
  locations,
  pagination,
}: {
  assets: AssetType[];
  users: Option[];
  statuses: Option[];
  categories: Option[];
  locations: Option[];
  pagination: {
    page: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    statusId?: string;
    categoryId?: string;
    locationId?: string;
  };
}) {
  const router = useRouter();
  const { searchVal, setSearchVal, getMultiFilter, setMultiFilter, searchParams } = useListFilters({
    persistKey: "itam_assets_filters",
  });
  const selectedStatusIds = getMultiFilter("statusId");
  const selectedCategoryIds = getMultiFilter("categoryId");
  const selectedLocationIds = getMultiFilter("locationId");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  // Form states
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);

  // Reset selection on assets change (e.g. reload)
  useEffect(() => {
    setTimeout(() => setSelectedIds(new Set()), 0);
  }, [assets]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const selectedAssets = assets.filter((a) => selectedIds.has(a.id));
  const selectedCount = selectedIds.size;
  const anyCheckedOut = selectedAssets.some((a) => a.assignedToEmail);
  const anyAvailable = selectedAssets.some((a) => !a.assignedToEmail);

  const handleBulkCheckoutSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assignedToUserId) {
      toast.error("Please select an employee.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.append("assetIds", Array.from(selectedIds).join(","));

    startTransition(async () => {
      const res = await bulkCheckoutAssetAction(undefined, formData);
      if (res?.success) {
        if (res.pendingApproval) {
          toast.success("Bulk checkout requests submitted for IT Manager approval");
        } else {
          toast.success("Assets checked out successfully");
        }
        setSelectedIds(new Set());
        setCheckoutOpen(false);
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  };

  const handleBulkCheckinSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("assetIds", Array.from(selectedIds).join(","));

    startTransition(async () => {
      const res = await bulkCheckinAssetAction(undefined, formData);
      if (res?.success) {
        toast.success("Assets checked in successfully");
        setSelectedIds(new Set());
        setCheckinOpen(false);
      } else if (res?.error) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="relative flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <div className="relative w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg"
            />
            {searchVal && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setSearchVal("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          
          <MultiSelectFilter
            label="Status"
            options={statuses}
            selected={selectedStatusIds}
            onChange={(ids) => setMultiFilter("statusId", ids)}
          />

          <MultiSelectFilter
            label="Category"
            options={categories}
            selected={selectedCategoryIds}
            onChange={(ids) => setMultiFilter("categoryId", ids)}
          />

          <MultiSelectFilter
            label="Location"
            options={locations}
            selected={selectedLocationIds}
            onChange={(ids) => setMultiFilter("locationId", ids)}
          />
        </div>
      </div>

      <div className="rounded-xl border shadow-xs overflow-hidden bg-card transition-all duration-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
              <TableHead className="w-12 px-4 text-center">
                <Checkbox
                  checked={selectedCount > 0 && selectedCount === assets.length}
                  onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead>Asset Tag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Assigned To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Boxes className="size-8 opacity-40" />
                    <p className="text-sm">No assets yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {assets.map((asset) => {
              const isSelected = selectedIds.has(asset.id);
              return (
                <TableRow
                  key={asset.id}
                  className={`hover:bg-muted/30 transition-colors border-b duration-150 ${
                    isSelected ? "bg-primary/[0.02]" : ""
                  }`}
                >
                  <TableCell className="px-4 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleSelect(asset.id, !!checked)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {asset.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell>{asset.name ?? "-"}</TableCell>
                  <TableCell>{asset.categoryName}</TableCell>
                  <TableCell>{asset.modelName}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={
                        asset.statusColor
                          ? {
                              borderColor: asset.statusColor,
                              color: asset.statusColor,
                              backgroundColor: `${asset.statusColor}14`,
                            }
                          : undefined
                      }
                      className="px-2.5 py-0.5 font-medium rounded-full"
                    >
                      {asset.statusName}
                    </Badge>
                  </TableCell>
                  <TableCell>{asset.locationName ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {asset.assignedToEmail
                      ? asset.assignedToFirstName
                        ? `${asset.assignedToFirstName} ${asset.assignedToLastName ?? ""}`.trim()
                        : asset.assignedToEmail
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-2 py-3 border-t">
          <span className="text-xs text-muted-foreground font-medium">
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalCount)} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} assets
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page - 1));
                router.push(`/assets?${params.toString()}`);
              }}
              className="h-8 px-3 text-xs"
            >
              <ChevronLeft className="size-3.5 mr-1" /> Previous
            </Button>
            <span className="text-xs font-semibold px-3 py-1 bg-muted rounded-md border text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page + 1));
                router.push(`/assets?${params.toString()}`);
              }}
              className="h-8 px-3 text-xs"
            >
              Next <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Sticky Bottom Multi-Select Action Toolbar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-sidebar/90 backdrop-blur-md border border-white/10 px-5 py-3.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <Badge className="bg-primary/20 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full">
              {selectedCount}
            </Badge>
            <span className="text-xs text-sidebar-foreground font-medium">
              {selectedCount === 1 ? "item" : "items"} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {anyAvailable && (
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 rounded-full"
                onClick={() => setCheckoutOpen(true)}
              >
                Bulk Checkout
              </Button>
            )}
            {anyCheckedOut && (
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 hover:bg-white/5 text-sidebar-foreground text-xs font-semibold px-4 rounded-full"
                onClick={() => setCheckinOpen(true)}
              >
                Bulk Check-in
              </Button>
            )}
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
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleBulkCheckoutSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Bulk Checkout Assets</DialogTitle>
              <DialogDescription>
                Assign {selectedCount} selected assets to an employee in a single action.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="assignedToUserId">Assignee</Label>
              <Select
                name="assignedToUserId"
                value={assignedToUserId}
                onValueChange={setAssignedToUserId}
                required
              >
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
              <Label htmlFor="expectedCheckinAt">Expected Return Date (Optional)</Label>
              <Input id="expectedCheckinAt" name="expectedCheckinAt" type="date" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Details of the checkout..."
                rows={3}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setCheckoutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Processing..." : "Complete Checkout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Check-in Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleBulkCheckinSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Bulk Check-in Assets</DialogTitle>
              <DialogDescription>
                Return {selectedCount} selected assets back to the warehouse inventory.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Reason for return, condition updates..."
                rows={3}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setCheckinOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Checking in..." : "Check In"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
