import { ArrowLeft, FileText, FileWarning, HelpCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ComplaintPicker } from "@/components/public/complaint-picker";

export default function ComplaintEntryPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Tricolor Strip */}
      <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#128807]" />

      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-dashboard-navy to-dashboard-blue text-dashboard-lime shadow-sm">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Government of India · MPLADS
              </div>
              <div className="text-sm font-bold text-slate-900">Citizen Grievance &amp; Issue Portal</div>
            </div>
          </div>

          <Link
            href="/public"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            <span>Public Portal</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 p-6 text-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-red-100">
            <ShieldAlert size={16} />
            <span>Official Citizen Redressal Mechanism</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Report a Project Concern or Delay
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-red-100 leading-relaxed max-w-xl">
            Is a local MPLADS project delayed, broken, abandoned, or constructed with substandard materials? Report it here for official inspection by District Authorities.
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs font-medium text-white/90">
            <span>✓ 100% Anonymous Tracking</span>
            <span>•</span>
            <span>✓ Direct to District Collector</span>
          </div>
        </div>

        {/* Existing Tracking helper */}
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-dashboard-navy" />
            <span>Already submitted a concern earlier?</span>
          </div>
          <Link
            href="/complaint/status"
            className="font-bold text-dashboard-navy hover:underline"
          >
            Track Status with Reference ID →
          </Link>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-3">
            Step 1: Select the Target Project
          </h2>
          <ComplaintPicker />
        </div>
      </main>
    </div>
  );
}
