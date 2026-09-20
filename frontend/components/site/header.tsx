import Link from "next/link";
import { ArrowUpRight, FileWarning, ShieldCheck } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="relative flex items-center justify-between border-b border-dashboard-line bg-white/95 px-5 py-4 shadow-sm backdrop-blur sm:px-8 lg:px-12">
      <span
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-dashboard-lime/60 to-transparent"
        aria-hidden="true"
      />

      <div className="flex items-center gap-3">
        <span
          className="grid size-9 place-items-center rounded-xl border border-dashboard-lime/30 bg-dashboard-navy text-dashboard-lime shadow-[0_2px_10px_-2px_rgba(9,37,65,0.45)] ring-1 ring-dashboard-navy/10"
          aria-hidden="true"
        >
          <ShieldCheck size={18} strokeWidth={2.2} />
        </span>
        <div>
          <div className="font-display text-sm font-semibold leading-tight text-dashboard-ink">MPLADS Intelligence</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dashboard-muted">National Oversight Platform</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/public"
          className="group inline-flex items-center gap-1.5 rounded-full border border-dashboard-line bg-dashboard-surface px-3.5 py-1.5 text-xs font-bold text-dashboard-navy transition-all hover:border-dashboard-navy/40 hover:bg-white"
        >
          <span>Citizen Public Portal</span>
          <ArrowUpRight size={13} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <Link
          href="/complaint"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-bold text-red-700 transition-all hover:bg-red-100"
        >
          <FileWarning size={13} />
          <span>Report Grievance</span>
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-dashboard-line bg-dashboard-surface px-3 py-1.5 text-xs font-medium text-dashboard-muted md:flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-dashboard-green/60" aria-hidden="true" />
            <span className="relative size-1.5 rounded-full bg-dashboard-green" aria-hidden="true" />
          </span>
          All systems operational
        </div>
      </div>
    </header>
  );
}
