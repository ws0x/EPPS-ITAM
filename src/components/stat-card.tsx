import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const accentMap = {
  indigo: {
    bar: "bg-primary",
    icon: "bg-primary/10 text-primary border-primary/20",
    glow: "from-primary/8 to-transparent",
  },
  green: {
    bar: "bg-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    glow: "from-emerald-500/8 to-transparent",
  },
  amber: {
    bar: "bg-amber-500",
    icon: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    glow: "from-amber-500/8 to-transparent",
  },
  red: {
    bar: "bg-red-500",
    icon: "bg-red-500/10 text-red-600 border-red-500/20",
    glow: "from-red-500/8 to-transparent",
  },
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "indigo",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: keyof typeof accentMap;
}) {
  const colors = accentMap[accent];
  return (
    <div
      data-slot="card"
      className="group/card relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs cursor-default"
    >
      {/* Left accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px] rounded-r-full", colors.bar)} />
      {/* Subtle top gradient glow */}
      <div className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-b opacity-0 group-hover/card:opacity-100 transition-opacity duration-300", colors.glow)} />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/80">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint && (
            <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              "transition-all duration-250 group-hover/card:scale-110 group-hover/card:shadow-md",
              colors.icon
            )}
          >
            <Icon className="size-[18px]" />
          </div>
        )}
      </div>
    </div>
  );
}
