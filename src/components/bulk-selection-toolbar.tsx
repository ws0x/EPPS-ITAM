"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * Sticky bottom action bar shown when one or more rows are selected in a
 * list table. Shell only (positioning, count badge, close button) - the
 * calling table supplies its own action buttons as children, since those
 * differ per module (bulk checkout, bulk check-in, run audit, ...).
 * Extracted after the same ~20-line shell was copy-pasted verbatim across
 * assets-table.tsx, consumables-table.tsx, and kits-table.tsx.
 */
export function BulkSelectionToolbar({
  count,
  itemLabel = "item",
  itemLabelPlural,
  onClear,
  children,
}: {
  count: number;
  itemLabel?: string;
  itemLabelPlural?: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-4 overflow-x-auto bg-sidebar/90 backdrop-blur-md border border-white/10 px-5 py-3.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex shrink-0 items-center gap-2 pr-3 border-r border-white/10">
        <Badge className="bg-primary/20 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full">
          {count}
        </Badge>
        <span className="text-xs text-sidebar-foreground font-medium whitespace-nowrap">
          {count === 1 ? itemLabel : (itemLabelPlural ?? `${itemLabel}s`)} selected
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <Button
          size="icon"
          variant="ghost"
          className="text-sidebar-foreground/60 hover:text-sidebar-foreground size-8 hover:bg-white/5 rounded-full"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
