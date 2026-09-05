"use client";

import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth-context";
import { useMobileNav } from "@/lib/mobile-nav-context";

export function DashboardHeader() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { toggle } = useMobileNav();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-dashboard-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="mr-1 grid size-8 place-items-center rounded border border-dashboard-line text-dashboard-ink lg:hidden"
          aria-label="Toggle navigation menu"
        >
          ☰
        </button>
        <span className="font-display text-lg font-semibold">MPLADS Intelligence</span>
        <span className="hidden text-dashboard-muted sm:inline">•</span>
        <span className="hidden text-sm text-dashboard-muted sm:inline">National Monitoring Dashboard</span>
        {!loading && !user && (
          <span className="rounded bg-dashboard-blue-soft px-2 py-1 text-[9px] font-bold text-dashboard-navy">
            VIEWING UNAUTHENTICATED
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="hidden text-dashboard-muted xl:inline">
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
        {user ? (
          <>
            <div className="hidden text-right sm:block">
              <div className="max-w-40 truncate font-semibold">{user.full_name}</div>
              <div className="text-[10px] text-dashboard-muted">{user.role}</div>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/");
              }}
              className="rounded border border-dashboard-line px-2 py-1 text-[10px] font-semibold text-dashboard-muted hover:bg-dashboard-surface"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="rounded bg-dashboard-navy px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-dashboard-deep"
          >
            Sign in
          </button>
        )}
        <div className="grid size-8 place-items-center rounded-full bg-dashboard-navy text-white">♙</div>
      </div>
    </header>
  );
}
