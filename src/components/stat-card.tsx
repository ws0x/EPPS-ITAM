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
    <div className="relative overflow-hidden rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", accentClasses[accent])} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-md bg-accent text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </div>
    </div>
  );
}
