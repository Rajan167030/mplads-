import Link from "next/link";
import { ArrowUpRight, FileWarning, ShieldCheck, CheckCircle2 } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="relative flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-5 py-3.5 shadow-sm backdrop-blur sm:px-8 lg:px-12">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-[#0a2540] text-emerald-400 shadow-sm">
          <ShieldCheck size={18} strokeWidth={2.4} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold tracking-wider text-slate-900 uppercase sm:text-base">
            MPLADS Intelligence Platform
          </span>
          <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 sm:inline-block">
            MoSPI
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/public"
          className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
        >
          <span>Citizen Public Portal</span>
          <ArrowUpRight size={13} strokeWidth={2.2} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>

        <Link
          href="/complaint"
          className="hidden items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:inline-flex"
        >
          <FileWarning size={13} />
          <span>Report Grievance</span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
          </span>
          <span>Secure Access</span>
        </div>
      </div>
    </header>
  );
}
