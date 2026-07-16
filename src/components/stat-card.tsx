import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const accentClasses = {
  teal: "bg-primary",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "teal",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: keyof typeof accentClasses;
}) {
  return (
    <div
      data-slot="card"
      className="group/card relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs"
    >
      <div className={cn("absolute inset-y-0 left-0 w-[4px]", accentClasses[accent])} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/15 transition-transform group-hover/card:scale-110 duration-200">
            <Icon className="size-4.5" />
          </div>
        )}
      </div>
    </div>
  );
}
