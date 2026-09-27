"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ClipboardCheck,
  FileBarChart,
  FolderKanban,
  GitCompare,
  LayoutDashboard,
  MapPinned,
  MessageSquareWarning,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  SearchCheck,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
  Layers,
  ChevronsUpDown,
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
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  badge?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "ai-fraud",
    title: "AI detection",
    icon: Sparkles,
    badge: "AI",
    items: [
      {
        label: "Pre-Sanction Gatekeeper",
        icon: ShieldCheck,
        href: "/dashboard/pre-sanction",
        badge: "AI",
      },
      { label: "Risk & Alerts", icon: AlertTriangle, href: "/dashboard/risk-alerts" },
      {
        label: "Pattern Intelligence",
        icon: Activity,
        href: "/dashboard/patterns",
      },
      { label: "Contractor Intelligence", icon: Network, href: "/dashboard/contractors" },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio & Analysis",
    icon: FolderKanban,
    items: [
      { label: "Projects", icon: FolderKanban, href: "/dashboard/projects" },
      { label: "Financials", icon: WalletCards, href: "/dashboard/financials" },
      { label: "Geographical Map", icon: MapPinned, href: "/dashboard/geographic" },
    ],
  },
  {
    id: "cases",
    title: "Cases & Resolution",
    icon: BriefcaseBusiness,
    items: [
      { label: "Investigations", icon: BriefcaseBusiness, href: "/dashboard/investigations" },
      { label: "Citizen Complaints", icon: MessageSquareWarning, href: "/dashboard/complaints" },
    ],
  },
  {
    id: "governance",
    title: "System & Governance",
    icon: Settings2,
    items: [
      
      { label: "Data Quality", icon: ClipboardCheck, href: "/dashboard/data-quality" },
      { label: "User Management", icon: Users, href: "/dashboard/users", ministryOnly: true },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { open, close, isCollapsed, toggleCollapse } = useMobileNav();
  const { user } = useAuth();

  // Helper to find which section contains the active route
  const getActiveSectionId = (path: string): string | null => {
    for (const section of navSections) {
      for (const item of section.items) {
        if (path === item.href || (item.href !== "/dashboard" && path.startsWith(item.href))) {
          return section.id;
        }
        if (item.children?.some((c) => path === c.href || path.startsWith(c.href))) {
          return section.id;
        }
      }
    }
    return null;
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initialActive = getActiveSectionId(pathname);
    return {
      "ai-fraud": initialActive === "ai-fraud" || !initialActive,
      portfolio: initialActive === "portfolio",
      cases: initialActive === "cases",
      governance: initialActive === "governance",
    };
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    "/dashboard/patterns": true,
  });

  const [auditChainOpen, setAuditChainOpen] = useState(false);

  // Auto-expand section containing current path
  useEffect(() => {
    const activeSec = getActiveSectionId(pathname);
    if (activeSec) {
      setOpenSections((prev) => ({ ...prev, [activeSec]: true }));
    }

    navSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => pathname === child.href || pathname.startsWith(child.href))) {
          setExpandedItems((prev) => ({ ...prev, [item.href]: true }));
        }
      });
    });
  }, [pathname]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleExpandItem = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const isOverviewActive = pathname === "/dashboard";

  const allExpanded = useMemo(() => {
    return navSections.every((s) => openSections[s.id]);
  }, [openSections]);

  const toggleAllSections = () => {
    const nextState = !allExpanded;
    const updated: Record<string, boolean> = {};
    navSections.forEach((s) => {
      updated[s.id] = nextState;
    });
    setOpenSections(updated);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Aside */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col justify-between overflow-hidden bg-[#071b31] text-white shadow-2xl shadow-slate-950/40 transition-all duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-[72px]" : "w-[286px]"}`}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex h-[74px] items-center justify-between border-b border-white/10 bg-[#06172a]/95 px-4 shrink-0">
            <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? "lg:justify-center lg:w-full" : ""}`}>
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-dashboard-lime/30 bg-dashboard-lime/10 text-dashboard-lime shadow-[0_0_20px_rgba(141,252,117,0.15)]">
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              
              {!isCollapsed && (
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
                    MPLADS
                    <span className="rounded bg-dashboard-lime/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-dashboard-lime">
                      v2.4
                    </span>
                  </div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-dashboard-lime truncate">
                    Intelligence Core
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Minimize/Expand Toggle Button */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={toggleCollapse}
                className="hidden lg:grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Minimize sidebar"
                aria-label="Minimize sidebar"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={close}
              className="grid size-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          {/* Subheader / Viewing Scope (Only when expanded) */}
          {!isCollapsed && (
            <div className="px-4 pb-2 pt-3 shrink-0 space-y-2 animate-in fade-in duration-200">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/40">Viewing Scope</div>
                  <div className="mt-0.5 font-display text-xs font-bold text-white">National Authority</div>
                </div>
                <span className="rounded-md border border-dashboard-lime/25 bg-dashboard-lime/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-lime">
                  {user?.role ?? "MINISTRY"}
                </span>
              </div>

              {/* Navigation Header & Expand/Collapse All Button */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/40 flex items-center gap-1.5">
                  <Layers size={11} className="text-white/40" /> Navigation
                </span>
                <button
                  type="button"
                  onClick={toggleAllSections}
                  className="group flex items-center gap-1 text-[10px] font-medium text-white/45 hover:text-dashboard-lime transition py-0.5 px-1.5 rounded hover:bg-white/[0.05]"
                  title={allExpanded ? "Collapse all dropdowns" : "Expand all dropdowns"}
                >
                  <ChevronsUpDown size={11} className="group-hover:text-dashboard-lime transition-colors" />
                  <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Minimized Icon Bar Expand Trigger (Top of list when collapsed) */}
          {isCollapsed && (
            <div className="hidden lg:flex justify-center py-2.5 border-b border-white/5">
              <button
                type="button"
                onClick={toggleCollapse}
                className="grid size-9 place-items-center rounded-xl bg-white/[0.05] text-dashboard-lime hover:bg-dashboard-lime hover:text-dashboard-navy transition-all shadow-sm"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          )}

          {/* Navigation Links Area */}
          <nav
            className={`flex-1 space-y-2 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-white/10 ${
              isCollapsed ? "px-2" : "px-3"
            }`}
            aria-label="Dashboard navigation"
          >
            {/* 1. Overview Link */}
            <div className="space-y-0.5">
              <Link
                href="/dashboard"
                onClick={() => {
                  if (window.innerWidth < 1024) close();
                }}
                title={isCollapsed ? "Overview Dashboard" : undefined}
                className={`group relative flex items-center rounded-xl text-left text-[12.5px] transition ${
                  isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2"
                } ${
                  isOverviewActive
                    ? "bg-dashboard-lime/15 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(141,252,117,0.2)]"
                    : "text-dashboard-muted hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {isOverviewActive && !isCollapsed && (
                  <span className="absolute left-0 h-4.5 w-0.5 rounded-full bg-dashboard-lime shadow-[0_0_8px_rgba(141,252,117,0.8)]" aria-hidden="true" />
                )}
                <LayoutDashboard
                  size={18}
                  strokeWidth={isOverviewActive ? 2.2 : 1.8}
                  className={isOverviewActive ? "text-dashboard-lime" : "text-white/45 group-hover:text-white/80"}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 font-medium truncate">Overview Dashboard</span>
                    {isOverviewActive && (
                      <span className="size-1.5 rounded-full bg-dashboard-lime shadow-[0_0_0_3px_rgba(141,252,117,0.15)]" />
                    )}
                  </>
                )}
              </Link>
            </div>

            {/* 2. Collapsible / Dropdown Nav Sections */}
            {navSections.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !item.ministryOnly || user?.role === "MINISTRY"
              );

              if (visibleItems.length === 0) return null;

              const isSectionOpen = Boolean(openSections[section.id]);
              const SectionIcon = section.icon;

              const hasActiveChild = visibleItems.some((item) => {
                const isExact = pathname === item.href;
                const isSub = item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href));
                const isNested = item.href !== "/dashboard" && pathname.startsWith(item.href);
                return isExact || isSub || isNested;
              });

              // When collapsed on desktop, render clean icon stack
              if (isCollapsed) {
                return (
                  <div key={section.id} className="space-y-1.5 pt-1.5 border-t border-white/5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isExact = pathname === item.href;
                      const isChild = item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href));
                      const isActive = isExact || isChild || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={`${item.label} (${section.title})`}
                          onClick={() => {
                            if (window.innerWidth < 1024) close();
                          }}
                          className={`group relative flex items-center justify-center rounded-xl p-2.5 transition ${
                            isActive
                              ? "bg-dashboard-lime/15 text-dashboard-lime shadow-[inset_0_0_0_1px_rgba(141,252,117,0.25)]"
                              : "text-white/45 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                          {isActive && (
                            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-dashboard-lime shadow-[0_0_6px_rgba(141,252,117,0.8)]" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                );
              }

              // Full expanded accordion section
              return (
                <div
                  key={section.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 transition-colors"
                >
                  {/* Dropdown Section Header */}
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isSectionOpen}
                    className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-wide transition ${
                      hasActiveChild
                        ? "text-white bg-white/[0.04]"
                        : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <SectionIcon
                        size={14}
                        strokeWidth={hasActiveChild ? 2.2 : 1.8}
                        className={
                          hasActiveChild
                            ? "text-dashboard-lime"
                            : "text-white/40 group-hover:text-white/70"
                        }
                      />
                      <span className="truncate uppercase text-[10px] tracking-[0.12em]">
                        {section.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isSectionOpen && hasActiveChild && (
                        <span className="size-1.5 rounded-full bg-dashboard-lime animate-pulse shadow-[0_0_6px_rgba(141,252,117,0.8)]" />
                      )}

                      {section.badge && (
                        <span className="rounded bg-dashboard-lime/15 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-dashboard-lime">
                          {section.badge}
                        </span>
                      )}



                      <ChevronDown
                        size={13}
                        className={`text-white/40 transition-transform duration-200 group-hover:text-white ${
                          isSectionOpen ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </div>
                  </button>

                  {/* Dropdown Section Items */}
                  <div
                    className={`space-y-0.5 pt-1 transition-all duration-200 ease-in-out ${
                      isSectionOpen ? "block" : "hidden"
                    }`}
                  >
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const hasChildren = Boolean(item.children && item.children.length > 0);
                      const isExpanded = Boolean(expandedItems[item.href]);
                      const isExactActive = pathname === item.href;
                      const isChildActive = Boolean(
                        item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href))
                      );
                      const isActive = isExactActive || (!hasChildren && pathname.startsWith(item.href) && item.href !== "/dashboard");

                      return (
                        <div key={item.href} className="space-y-0.5">
                          <div className="relative flex items-center">
                            <Link
                              href={item.href}
                              onClick={() => {
                                if (window.innerWidth < 1024) close();
                              }}
                              className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ${
                                isActive
                                  ? "bg-dashboard-lime/12 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(141,252,117,0.15)]"
                                  : isChildActive
                                  ? "bg-white/[0.04] text-white"
                                  : "text-dashboard-muted hover:bg-white/[0.06] hover:text-white"
                              }`}
                            >
                              {isActive && (
                                <span className="absolute left-0 h-4 w-0.5 rounded-full bg-dashboard-lime shadow-[0_0_6px_rgba(141,252,117,0.8)]" aria-hidden="true" />
                              )}
                              <Icon
                                size={15}
                                strokeWidth={isActive ? 2.2 : 1.8}
                                className={
                                  isActive
                                    ? "text-dashboard-lime"
                                    : isChildActive
                                    ? "text-dashboard-lime/80"
                                    : "text-white/40 group-hover:text-white/80"
                                }
                              />
                              <span className="flex-1 truncate">{item.label}</span>

                              {item.badge && (
                                <span className="rounded bg-dashboard-lime/15 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-dashboard-lime">
                                  {item.badge}
                                </span>
                              )}

                              {isActive && !item.badge && !hasChildren && (
                                <span className="size-1.5 rounded-full bg-dashboard-lime shadow-[0_0_0_3px_rgba(141,252,117,0.12)]" />
                              )}
                            </Link>

                            {/* Sub-item Dropdown Toggle */}
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => toggleExpandItem(item.href, e)}
                                className="absolute right-1 grid size-5 place-items-center rounded text-white/40 transition hover:bg-white/10 hover:text-white"
                                aria-label={isExpanded ? "Collapse subitems" : "Expand subitems"}
                              >
                                <ChevronDown
                                  size={12}
                                  className={`transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`}
                                />
                              </button>
                            )}
                          </div>

                          {/* Nested Sub-items */}
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
                                    className={`group flex items-center gap-2 rounded-lg px-2 py-1.2 text-[11px] transition ${
                                      isSubActive
                                        ? "bg-dashboard-lime/10 font-semibold text-dashboard-lime shadow-[inset_0_0_0_1px_rgba(141,252,117,0.1)]"
                                        : "text-white/50 hover:bg-white/[0.05] hover:text-white/90"
                                    }`}
                                  >
                                    {ChildIcon && (
                                      <ChildIcon
                                        size={12}
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

            {/* Audit Chain Collapsible Section (Only when expanded) */}
            {!isCollapsed && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                <button
                  type="button"
                  onClick={() => setAuditChainOpen((prev) => !prev)}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold tracking-wide text-white/60 hover:bg-white/[0.05] hover:text-white transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-dashboard-lime animate-pulse" />
                    <span className="uppercase text-[10px] tracking-[0.12em]">Audit Chain</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[8.5px] text-dashboard-lime">ht 10,55,410</span>
                    <ChevronDown
                      size={13}
                      className={`text-white/40 transition-transform duration-200 group-hover:text-white ${
                        auditChainOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                  </div>
                </button>

                {auditChainOpen && (
                  <div className="mt-1 space-y-1 rounded-lg border border-white/10 bg-black/30 p-2 text-[10px]">
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
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        {/* Footer / System Status */}
        <div className={`border-t border-white/10 bg-[#06172a]/90 p-2.5 shrink-0 ${isCollapsed ? "text-center" : "space-y-1.5"}`}>
          {isCollapsed ? (
            <Link
              href="/"
              title="Back to Sign In"
              className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-dashboard-lime hover:bg-white/15 transition mx-auto"
            >
              <BarChart3 size={16} />
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </aside>
    </>
  );
}
