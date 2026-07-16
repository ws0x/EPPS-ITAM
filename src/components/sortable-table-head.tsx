"use client";

import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableTableHead({
  column,
  label,
  sort,
  dir,
  onSort,
  className,
}: {
  column: string;
  label: string;
  sort: string;
  dir: "asc" | "desc";
  onSort: (column: string) => void;
  className?: string;
}) {
  const active = sort === column;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "flex items-center gap-1 hover:text-foreground transition-colors",
          active ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  );
}
