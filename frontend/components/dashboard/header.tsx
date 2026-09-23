"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useMobileNav } from "@/lib/mobile-nav-context";

export function DashboardHeader() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-dashboard-line bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggle}
          className="mr-1 grid size-8 place-items-center rounded border border-dashboard-line text-dashboard-ink lg:hidden"
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-[#092541] sm:text-base">
              MPLAD Anomaly and Fraud Detection
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="hidden text-xs font-medium text-dashboard-muted md:inline">
              Ministry of Statistics and Programme Implementation
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {/* Verified Audit Trail Pill */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-200/80 shadow-xs">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Audit trail verified</span>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="font-semibold text-dashboard-ink">{user.email.split("@")[0]}</div>
              <div className="text-[10px] text-dashboard-muted uppercase tracking-wider">{user.role}</div>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="rounded-lg border border-dashboard-line bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-xs hover:bg-slate-50 hover:text-dashboard-ink"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="rounded bg-dashboard-navy px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-dashboard-deep"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
