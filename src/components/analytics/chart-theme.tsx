/**
 * Chart color tokens, adapted from the dataviz skill's default palette to
 * ITAM's teal brand (not the skill's default blue). Validated via
 * scripts/validate_palette.js — light mode against #ffffff surface (all
 * checks pass, worst adjacent CVD ΔE 31.3), dark mode against #1a2226 (all
 * checks pass, worst adjacent ΔE 33.6). Order is the CVD-safety mechanism —
 * do not reorder without re-validating.
 *
 * Status colors (good/warning/serious/critical) are the skill's fixed
 * defaults — never themed, kept distinct from the categorical slots.
 */
export function ChartThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="viz-root"
      style={
        {
          "--surface-1": "var(--card)",
          "--text-primary": "var(--foreground)",
          "--text-secondary": "var(--muted-foreground)",
          "--text-muted": "var(--muted-foreground)",
          "--gridline": "var(--border)",

          "--series-1": "#0d9488", // teal (brand)
          "--series-2": "#7c3aed", // violet
          "--series-3": "#d97706", // amber
          "--series-4": "#e11d48", // rose
          "--series-5": "#4f46e5", // indigo
          "--series-6": "#db2777", // pink

          "--status-good": "#0ca30c",
          "--status-warning": "#fab219",
          "--status-serious": "#ec835a",
          "--status-critical": "#d03b3b",
        } as React.CSSProperties
      }
    >
      <style>{`
        .dark .viz-root {
          --series-1: #14b8a6;
          --series-2: #8b5cf6;
          --series-3: #d97706;
          --series-4: #f43f5e;
          --series-5: #6366f1;
          --series-6: #ec4899;
        }
      `}</style>
      {children}
    </div>
  );
}

export const CATEGORICAL_SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

export const STATUS_COLORS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};
