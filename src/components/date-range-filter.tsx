"use client";

import { Input } from "@/components/ui/input";

/** A from/to native date-input pair wired to a `${key}From`/`${key}To` URL param pair. */
export function DateRangeFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <Input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ from: e.target.value, to: value.to })}
        className="h-9 w-[140px] text-xs"
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ from: value.from, to: e.target.value })}
        className="h-9 w-[140px] text-xs"
      />
    </div>
  );
}
