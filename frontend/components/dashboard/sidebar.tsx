"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useMobileNav } from "@/lib/mobile-nav-context";

const navigation = [
  { label: "Overview", icon: "▦", href: "/dashboard" },
  { label: "Risk & Alerts", icon: "△", href: "/dashboard/risk-alerts" },
  { label: "ML Evidence & Review", icon: "◈", href: "/dashboard/ml-report" },
  { label: "Projects", icon: "▤", href: "/dashboard/projects" },
  { label: "Financials", icon: "▥", href: "/dashboard/financials" },
  { label: "Geographical Analysis", icon: "⌖", href: "/dashboard/geographic" },
  { label: "Contractor Intelligence", icon: "⛭", href: "/dashboard/contractors" },
  { label: "Pattern Intelligence", icon: "⌁", href: "/dashboard/patterns" },
  { label: "Investigations", icon: "⚑", href: "/dashboard/investigations" },
  { label: "AI Assistant", icon: "✦", href: "/dashboard/assistant" },
  { label: "Data Quality", icon: "◫", href: "/dashboard/data-quality" },
  { label: "Reports", icon: "▥", href: "/dashboard/reports" },
  { label: "Users", icon: "⚈", href: "/dashboard/users" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { open, close } = useMobileNav();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 -translate-x-full flex-col justify-between bg-dashboard-navy text-white shadow-xl transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div>
          <div className="flex h-16 items-center justify-between gap-3 bg-dashboard-deep px-6">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/10 text-dashboard-lime">
                ◆
              </div>
              <div>
                <div className="text-sm font-bold uppercase tracking-tight">MPLADS</div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-dashboard-lime">
                  Intelligence Core
                </div>
              </div>
            </div>
            <button onClick={close} className="text-white/70 hover:text-white lg:hidden" aria-label="Close menu">
              ✕
            </button>
          </div>
          <div className="px-6 pb-2 pt-7 text-[10px] font-bold uppercase tracking-[0.14em] text-dashboard-muted">
            Audit &amp; Governance
          </div>
          <nav className="max-h-[calc(100vh-9rem)] space-y-1 overflow-y-auto px-3" aria-label="Dashboard navigation">
            {navigation.map(({ label, icon, href }) => {
              const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                    isActive ? "bg-dashboard-blue font-semibold text-white" : "text-dashboard-muted hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="w-5 text-center text-base" aria-hidden="true">
                    {icon}
                  </span>
                  <span className="flex-1">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="space-y-1 bg-dashboard-deep/60 p-3">
          <Link
            href="/"
            className="flex w-full items-center justify-between rounded-md bg-dashboard-blue px-3 py-2 text-left"
          >
            <span>
              <span className="block text-[10px] text-dashboard-muted">Central Authority Portal</span>
              <span className="block text-[10px] font-bold text-dashboard-lime">Back to sign-in</span>
            </span>
            <span className="text-dashboard-lime" aria-hidden="true">
              ↩
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
