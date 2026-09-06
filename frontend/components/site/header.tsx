import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-console-border-soft px-5 py-4 sm:px-8 lg:px-12">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 place-items-center rounded-full border border-console-border bg-console-surface"
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#7C6FEE" strokeWidth="1.1" />
            <circle cx="7" cy="7" r="1.6" fill="#7C6FEE" />
          </svg>
        </span>
        <span className="font-display text-sm font-semibold text-console-ink">MPLADS Intelligence</span>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/public"
          className="text-xs font-medium text-console-ink-muted underline-offset-4 hover:text-console-ink hover:underline"
        >
          Public transparency portal
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-console-border bg-console-surface px-3 py-1.5 text-xs text-console-ink-muted sm:flex">
          <span className="size-1.5 rounded-full bg-console-green shadow-[0_0_0_3px_rgba(62,213,152,0.18)]" aria-hidden="true" />
          All systems operational
        </div>
      </div>
    </header>
  );
}
