"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ClipboardCheck,
  FileBarChart,
  FolderKanban,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  Network,
  PanelLeftClose,
  RefreshCcw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { useMobileNav } from "@/lib/mobile-nav-context";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Risk & Alerts", icon: AlertTriangle, href: "/dashboard/risk-alerts" },
  { label: "ML Evidence & Review", icon: SearchCheck, href: "/dashboard/ml-report" },
  { label: "Projects", icon: FolderKanban, href: "/dashboard/projects" },
  { label: "Financials", icon: WalletCards, href: "/dashboard/financials" },
  { label: "Geographical Analysis", icon: MapPinned, href: "/dashboard/geographic" },
  { label: "Contractor Intelligence", icon: Network, href: "/dashboard/contractors" },
  { label: "Pattern Intelligence", icon: Activity, href: "/dashboard/patterns" },
  { label: "Investigations", icon: BriefcaseBusiness, href: "/dashboard/investigations" },
  { label: "Citizen Complaints", icon: MessageSquareWarning, href: "/dashboard/complaints" },
  { label: "AI Assistant", icon: Bot, href: "/dashboard/assistant" },
  { label: "Data Quality", icon: ClipboardCheck, href: "/dashboard/data-quality" },
  { label: "Reports", icon: FileBarChart, href: "/dashboard/reports" },
  { label: "Users", icon: Users, href: "/dashboard/users", ministryOnly: true },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { open, close } = useMobileNav();
  const { user } = useAuth();
  const visibleNavigation = navigation.filter((item) => !item.ministryOnly || user?.role === "MINISTRY");

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
        className={`fixed inset-y-0 left-0 z-30 flex w-[286px] -translate-x-full flex-col justify-between overflow-hidden bg-[#071b31] text-white shadow-2xl shadow-slate-950/30 transition-transform duration-200 lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div>
          <div className="flex h-[76px] items-center justify-between gap-3 border-b border-white/10 bg-dashboard-deep/80 px-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl border border-dashboard-lime/30 bg-dashboard-lime/10 text-dashboard-lime shadow-[0_0_24px_rgba(141,252,117,0.12)]">
                <ShieldCheck size={21} strokeWidth={2.2} />
              </div>
              <div>
                <div className="font-display text-sm font-bold tracking-tight">MPLADS</div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-dashboard-lime">Intelligence Core</div>
              </div>
            </div>
            <button
              onClick={close}
              className="grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="px-5 pb-3 pt-6">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-dashboard-muted">
              <span>Workspace</span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] tracking-normal text-white/40">FY 25–26</span>
            </div>
          </div>
          <nav className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto px-3" aria-label="Dashboard navigation">
            {visibleNavigation.map(({ label, icon: Icon, href }) => {
              const isActive = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                    isActive
                      ? "bg-dashboard-lime/12 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(141,252,117,0.12)]"
                      : "text-dashboard-muted hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {isActive && <span className="absolute left-0 h-5 w-0.5 rounded-full bg-dashboard-lime" aria-hidden="true" />}
                  <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? "text-dashboard-lime" : "text-white/45 group-hover:text-white/80"} />
                  <span className="flex-1">{label}</span>
                  {isActive && <span className="size-1.5 rounded-full bg-dashboard-lime shadow-[0_0_0_3px_rgba(141,252,117,0.12)]" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="space-y-3 border-t border-white/10 bg-dashboard-deep/60 p-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-dashboard-lime/10 text-dashboard-lime">
              <Settings2 size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-white/80">System status</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-dashboard-muted">
                <span className="size-1.5 rounded-full bg-dashboard-lime" /> All services operational
              </div>
            </div>
            <RefreshCcw size={13} className="text-white/30" />
          </div>
          <Link
            href="/"
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-dashboard-blue/80 px-3 py-2.5 text-left transition hover:bg-dashboard-blue"
          >
            <span>
              <span className="block text-[10px] text-dashboard-muted">Central authority portal</span>
              <span className="mt-0.5 block text-[10px] font-bold text-dashboard-lime">Back to sign-in</span>
            </span>
            <BarChart3 size={16} className="text-dashboard-lime" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </>
  );
}
