export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line bg-panel px-5 py-3 sm:px-8 lg:px-12">
      <div className="flex items-center gap-2.5 text-navy">
        <span className="grid size-7 place-items-center rounded-md bg-navy text-sm text-lime" aria-hidden="true">
          ✦
        </span>
        <span className="font-display text-xs font-bold uppercase tracking-[0.13em] sm:text-sm">
          MPLADS Intelligence Platform
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        Secure Access
      </div>
    </header>
  );
}
