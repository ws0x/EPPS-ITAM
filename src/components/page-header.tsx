export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative flex items-start justify-between gap-4 pb-5 mb-6 overflow-hidden">
      {/* Soft ambient glow, purely decorative */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -left-10 h-40 w-[28rem] rounded-full bg-gradient-to-br from-primary/12 via-primary/4 to-transparent blur-2xl"
      />
      <div className="relative flex flex-col gap-0.5">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/70 mb-0.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="relative flex items-center gap-2 shrink-0 mt-1">{actions}</div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-border via-border to-transparent" />
    </div>
  );
}
