import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-dashboard-line bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8 lg:px-12">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 place-items-center rounded-xl border border-dashboard-lime/30 bg-dashboard-navy text-dashboard-lime"
          aria-hidden="true"
        >
          <ShieldCheck size={18} strokeWidth={2.2} />
        </span>
        <div>
          <div className="font-display text-sm font-semibold text-dashboard-ink">MPLADS Intelligence</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dashboard-muted">Intelligence Core</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/public"
          className="text-xs font-medium text-dashboard-muted underline-offset-4 hover:text-dashboard-ink hover:underline"
        >
          Public transparency portal
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-dashboard-line bg-dashboard-surface px-3 py-1.5 text-xs text-dashboard-muted sm:flex">
          <span className="size-1.5 rounded-full bg-dashboard-green shadow-[0_0_0_3px_rgba(8,122,32,0.14)]" aria-hidden="true" />
          All systems operational
        </div>
      </div>
    </header>
  );
}
