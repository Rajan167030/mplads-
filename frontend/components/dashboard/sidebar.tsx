"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  FolderKanban,
  GitCompare,
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

interface NavSubItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  badge?: string;
  ministryOnly?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  badge?: string;
  ministryOnly?: boolean;
  children?: NavSubItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Core",
    items: [
      { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    title: "AI & Fraud Detection",
    items: [
      {
        label: "Pre-Sanction Gatekeeper",
        icon: ShieldCheck,
        href: "/dashboard/pre-sanction",
        badge: "AI",
      },
      { label: "Risk & Alerts", icon: AlertTriangle, href: "/dashboard/risk-alerts" },
      { label: "ML Evidence & Review", icon: SearchCheck, href: "/dashboard/ml-report" },
      {
        label: "Pattern Intelligence",
        icon: Activity,
        href: "/dashboard/patterns",
        children: [
          {
            label: "Duplicate Sanction Pairs",
            href: "/dashboard/patterns/duplicates",
            icon: GitCompare,
          },
        ],
      },
      { label: "Contractor Intelligence", icon: Network, href: "/dashboard/contractors" },
    ],
  },
  {
    title: "Portfolio & Analysis",
    items: [
      { label: "Projects", icon: FolderKanban, href: "/dashboard/projects" },
      { label: "Financials", icon: WalletCards, href: "/dashboard/financials" },
      { label: "Geographical Map", icon: MapPinned, href: "/dashboard/geographic" },
    ],
  },
  {
    title: "Cases & Resolution",
    items: [
      { label: "Investigations", icon: BriefcaseBusiness, href: "/dashboard/investigations" },
      { label: "Citizen Complaints", icon: MessageSquareWarning, href: "/dashboard/complaints" },
      { label: "AI Copilot Assistant", icon: Bot, href: "/dashboard/assistant", badge: "Live" },
    ],
  },
  {
    title: "System & Governance",
    items: [
      { label: "Audit Reports", icon: FileBarChart, href: "/dashboard/reports" },
      { label: "Data Quality", icon: ClipboardCheck, href: "/dashboard/data-quality" },
      { label: "User Management", icon: Users, href: "/dashboard/users", ministryOnly: true },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { open, close } = useMobileNav();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "/dashboard/patterns": true,
  });

  // Auto-expand parent item if active subpath matches
  useEffect(() => {
    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => pathname === child.href || pathname.startsWith(child.href))) {
          setExpandedItems((prev) => ({ ...prev, [item.href]: true }));
        }
      });
    });
  }, [pathname]);

  const toggleExpand = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems((prev) => ({ ...prev, [href]: !prev[href] }));
  };

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
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex h-[76px] items-center justify-between gap-3 border-b border-white/10 bg-dashboard-deep/80 px-5 shrink-0">
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

          {/* Subheader / Workspace tag & Viewing scope */}
          <div className="px-5 pb-2 pt-3 shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">Viewing Scope</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-display text-xs font-bold text-white">National</span>
                <span className="rounded bg-dashboard-lime/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-lime">
                  {user?.role ?? "MINISTRY"}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation with Category Sections */}
          <nav
            className="flex-1 space-y-3.5 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-white/10"
            aria-label="Dashboard navigation"
          >
            {navSections.map((section) => {
              // Filter out items that are ministry-only if user is not MINISTRY
              const visibleItems = section.items.filter(
                (item) => !item.ministryOnly || user?.role === "MINISTRY"
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title} className="space-y-1">
                  <div className="px-2.5 pb-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/35">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const hasChildren = Boolean(item.children && item.children.length > 0);
                      const isExpanded = Boolean(expandedItems[item.href]);
                      const isExactActive = item.href === "/dashboard" 
                        ? pathname === item.href 
                        : pathname === item.href;
                      const isChildActive = Boolean(item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href)));
                      const isActive = isExactActive || (!hasChildren && pathname.startsWith(item.href));

                      return (
                        <div key={item.href} className="space-y-0.5">
                          <div className="relative flex items-center">
                            <Link
                              href={item.href}
                              onClick={() => {
                                if (window.innerWidth < 1024) close();
                              }}
                              className={`group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] transition ${
                                isActive
                                  ? "bg-dashboard-lime/12 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(141,252,117,0.12)]"
                                  : isChildActive
                                  ? "bg-white/[0.04] text-white"
                                  : "text-dashboard-muted hover:bg-white/[0.07] hover:text-white"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute left-0 h-4.5 w-0.5 rounded-full bg-dashboard-lime" aria-hidden="true" />
                              )}
                              <Icon
                                size={16}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={
                                  isActive
                                    ? "text-dashboard-lime"
                                    : isChildActive
                                    ? "text-dashboard-lime/80"
                                    : "text-white/45 group-hover:text-white/80"
                                }
                              />
                              <span className="flex-1 truncate">{item.label}</span>

                              {item.badge && (
                                <span className="rounded bg-dashboard-lime/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-lime">
                                  {item.badge}
                                </span>
                              )}

                              {isActive && !item.badge && !hasChildren && (
                                <span className="size-1.5 rounded-full bg-dashboard-lime shadow-[0_0_0_3px_rgba(141,252,117,0.12)]" />
                              )}
                            </Link>

                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpand(item.href, e)}
                                className="absolute right-1.5 grid size-6 place-items-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white"
                                aria-label={isExpanded ? "Collapse subitems" : "Expand subitems"}
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Sub-items */}
                          {hasChildren && isExpanded && (
                            <div className="relative ml-4 space-y-0.5 border-l border-white/10 pl-2.5 pt-0.5">
                              {item.children?.map((child) => {
                                const ChildIcon = child.icon;
                                const isSubActive = pathname === child.href || pathname.startsWith(child.href);
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    onClick={() => {
                                      if (window.innerWidth < 1024) close();
                                    }}
                                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] transition ${
                                      isSubActive
                                        ? "bg-dashboard-lime/10 font-semibold text-dashboard-lime shadow-[inset_0_0_0_1px_rgba(141,252,117,0.1)]"
                                        : "text-white/50 hover:bg-white/[0.05] hover:text-white/90"
                                    }`}
                                  >
                                    {ChildIcon && (
                                      <ChildIcon
                                        size={13}
                                        strokeWidth={isSubActive ? 2.2 : 1.8}
                                        className={isSubActive ? "text-dashboard-lime" : "text-white/40 group-hover:text-white/70"}
                                      />
                                    )}
                                    <span className="truncate">{child.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Audit Chain Live Feed */}
            <div className="pt-2">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/40">Audit Chain</span>
                <span className="font-mono text-[9px] text-dashboard-lime">ht 10,55,410</span>
              </div>
              <div className="relative space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-2 text-[10px]">
                <div className="flex items-center justify-between text-white/70">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-dashboard-lime animate-pulse" />
                    <span className="font-bold text-dashboard-lime">admin</span>
                    <span className="font-mono text-[9px] text-white/50">8bfe52..62df</span>
                  </div>
                  <span className="font-mono text-[9px] text-white/40">10,55,410</span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-white/30" />
                    <span className="font-bold text-amber-300">case</span>
                    <span className="font-mono text-[9px] text-white/50">aa7e9e..65b6</span>
                  </div>
                  <span className="font-mono text-[9px] text-white/40">10,55,409</span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <div className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-white/30" />
                    <span className="font-bold text-blue-300">score</span>
                    <span className="font-mono text-[9px] text-white/50">8d0e44..5ad7</span>
                  </div>
                  <span className="font-mono text-[9px] text-white/40">10,55,345</span>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Footer / System Status */}
        <div className="space-y-2 border-t border-white/10 bg-dashboard-deep/60 p-3 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
            <span className="grid size-5 place-items-center rounded-md bg-dashboard-lime/10 text-dashboard-lime">
              <Settings2 size={12} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[9px] text-dashboard-muted">
                <span className="size-1.5 rounded-full bg-dashboard-lime" /> Services Active
              </div>
            </div>
            <RefreshCcw size={11} className="text-white/30" />
          </div>
          <Link
            href="/"
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-dashboard-blue/80 px-2.5 py-1.5 text-left transition hover:bg-dashboard-blue"
          >
            <span>
              <span className="mt-0.5 block text-[9.5px] font-bold text-dashboard-lime">Back to sign-in</span>
            </span>
            <BarChart3 size={14} className="text-dashboard-lime" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </>
  );
}

