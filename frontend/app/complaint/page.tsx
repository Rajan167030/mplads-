import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ComplaintPicker } from "@/components/public/complaint-picker";

export default function ComplaintEntryPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-dashboard-navy text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <ShieldCheck size={22} className="text-dashboard-lime" />
          <div>
            <div className="text-[10px] font-medium text-slate-300">Government of India · MPLADS</div>
            <div className="text-sm font-bold">Report a Concern</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/public" className="text-xs font-semibold text-dashboard-navy hover:underline">
          ← Back to public portal
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight">Which project is this about?</h1>
        <p className="mt-1 text-xs text-slate-500">
          Already checking status on a complaint you filed?{" "}
          <Link href="/complaint/status" className="font-semibold text-dashboard-navy underline">
            Track it here
          </Link>
          .
        </p>

        <div className="mt-6">
          <ComplaintPicker />
        </div>
      </main>
    </div>
  );
}
