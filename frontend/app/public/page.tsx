import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  Droplets,
  ExternalLink,
  FileCheck2,
  FileText,
  FileWarning,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Landmark,
  Layers,
  MapPin,
  MapPinned,
  Menu,
  Navigation,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Waves,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AreaSearch } from "@/components/public/area-search";
import { MpBreakdown } from "@/components/public/mp-breakdown";
import { NearMe } from "@/components/public/near-me";
import { PublicHeatmap } from "@/components/public/public-heatmap";
import {
  getDataQuality,
  getFinancialsByMp,
  getFinancialsSummary,
  getMapFilterOptions,
  getRiskMap,
  listProjects,
  type FinancialsByMpResult,
  type ProjectListItem,
  type RiskMapResult,
} from "@/lib/api";
import {
  DEMO_DATA_QUALITY,
  DEMO_FINANCIALS_SUMMARY,
  DEMO_MAP_FILTER_OPTIONS,
  demoFinancialsByMp,
  filterDemoProjects,
  filterDemoRiskMap,
  isNetworkError,
} from "@/lib/demo-data";

const SECTOR_META: Record<string, { label: string; icon: typeof Building2; color: string; bg: string; border: string }> = {
  ROAD: { label: "Roads & Bridges", icon: Landmark, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  SCHOOL: { label: "Schools & Education", icon: GraduationCap, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  COMMUNITY_HALL: { label: "Community Halls", icon: Building2, color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  WATER_INFRASTRUCTURE: { label: "Drinking Water", icon: Waves, color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
  HEALTH_CENTRE: { label: "Healthcare & Clinics", icon: HeartPulse, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
  SANITATION: { label: "Sanitation & Drainage", icon: Droplets, color: "text-cyan-700", bg: "bg-cyan-50", border: "border-cyan-200" },
  PUBLIC_FACILITY: { label: "Public Facilities", icon: Sparkles, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  COMPLETED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", label: "Completed" },
  ONGOING: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500", label: "In Progress" },
  DELAYED: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500", label: "Delayed" },
  SANCTIONED: { bg: "bg-slate-100 border-slate-200", text: "text-slate-700", dot: "bg-slate-500", label: "Sanctioned" },
};

function crore(amount: number) {
  if (!amount) return "₹0.00 Cr";
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

const NAV_LINKS: [string, string][] = [
  ["Overview", "#top"],
  ["How it Works", "#how-it-works"],
  ["Fund Journey", "#fund-journey"],
  ["Sector Impact", "#impact"],
  ["Find My Area", "#my-area"],
  ["MP Performance", "#mp-accountability"],
  ["Map", "#map-section"],
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-dashboard-navy">
      <span className="h-1.5 w-6 rounded-full bg-dashboard-lime" />
      {children}
    </div>
  );
}

export default async function PublicPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector } = await searchParams;

  let dataQuality;
  let financials;
  let completed: number | null = null;
  let ongoing: number | null = null;
  let delayed: number | null = null;
  let projects: ProjectListItem[] = [];
  let heatmapData: RiskMapResult | null = null;
  let states: string[] = [];
  let projectTypes: string[] = [];
  let mpBreakdown: FinancialsByMpResult | null = null;
  let fetchError: string | null = null;

  try {
    const [dq, fin, completedRes, ongoingRes, delayedRes, projectsRes, mapRes, filterOptions, mpRes] = await Promise.all([
      getDataQuality(),
      getFinancialsSummary(),
      listProjects({ status: "COMPLETED", limit: 1 }),
      listProjects({ status: "ONGOING", limit: 1 }),
      listProjects({ status: "DELAYED", limit: 1 }),
      listProjects({ project_type: sector, limit: 8, sort_by: "sanctioned_amount" }),
      getRiskMap({ project_type: sector, limit: 5000 }),
      getMapFilterOptions(),
      getFinancialsByMp(),
    ]);
    dataQuality = dq;
    financials = fin;
    completed = completedRes.total;
    ongoing = ongoingRes.total;
    delayed = delayedRes.total;
    projects = projectsRes.items;
    heatmapData = mapRes;
    states = filterOptions.states;
    projectTypes = filterOptions.project_types;
    mpBreakdown = mpRes;
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn("[public] backend unreachable, rendering demo portal data");
      dataQuality = DEMO_DATA_QUALITY;
      financials = DEMO_FINANCIALS_SUMMARY;
      const completedRes = filterDemoProjects({ status: "COMPLETED" });
      const ongoingRes = filterDemoProjects({ status: "ONGOING" });
      const delayedRes = filterDemoProjects({ status: "DELAYED" });
      const projectsRes = filterDemoProjects({ project_type: sector, limit: 8 });
      completed = completedRes.total;
      ongoing = ongoingRes.total;
      delayed = delayedRes.total;
      projects = projectsRes.items;
      heatmapData = filterDemoRiskMap({ project_type: sector });
      states = DEMO_MAP_FILTER_OPTIONS.states;
      projectTypes = DEMO_MAP_FILTER_OPTIONS.project_types;
      mpBreakdown = demoFinancialsByMp();
    } else {
      fetchError = "Unable to connect to live portal data. Displaying standard public preview.";
      dataQuality = DEMO_DATA_QUALITY;
      financials = DEMO_FINANCIALS_SUMMARY;
      const completedRes = filterDemoProjects({ status: "COMPLETED" });
      const ongoingRes = filterDemoProjects({ status: "ONGOING" });
      const delayedRes = filterDemoProjects({ status: "DELAYED" });
      const projectsRes = filterDemoProjects({ project_type: sector, limit: 8 });
      completed = completedRes.total;
      ongoing = ongoingRes.total;
      delayed = delayedRes.total;
      projects = projectsRes.items;
      heatmapData = filterDemoRiskMap({ project_type: sector });
      states = DEMO_MAP_FILTER_OPTIONS.states;
      projectTypes = DEMO_MAP_FILTER_OPTIONS.project_types;
      mpBreakdown = demoFinancialsByMp();
    }
  }

  const locationVerifiedPct = dataQuality && dataQuality.total_projects
    ? Math.round(((dataQuality.total_projects - dataQuality.missing_location) / dataQuality.total_projects) * 100)
    : 98;
  const topStates = financials?.by_state.slice(0, 8) ?? [];
  const bestUtilization = topStates.length
    ? topStates.reduce((a, b) => (b.expenditure_utilization_pct > a.expenditure_utilization_pct ? b : a))
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-dashboard-navy selection:text-white">
      {/* -------------------------------------------------------------- */}
      {/* 2-TIER MODERN SPACIOUS CITIZEN HEADER                          */}
      {/* -------------------------------------------------------------- */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#128807]" />

      <header id="top" className="relative z-40 bg-white border-b border-slate-200/80 shadow-sm">
        {/* Tier 1: Main Brand & Citizen Action Bar */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
          {/* Logo & National Branding */}
          <Link href="/public" className="group flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-dashboard-navy to-dashboard-blue text-dashboard-lime shadow-md shadow-dashboard-navy/20 transition-transform group-hover:scale-105">
              <ShieldCheck size={20} className="sm:size-6" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-display text-sm font-extrabold tracking-tight text-slate-900 sm:text-lg">
                  MPLADS Transparency
                </span>
                <span className="hidden sm:inline rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Citizen Portal
                </span>
              </div>
              <div className="truncate text-[10px] sm:text-[11px] font-medium text-slate-500">
                MoSPI • Government of India
              </div>
            </div>
          </Link>

          {/* Right Actions: Status & Quick Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-600 xl:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>Live Database Sync</span>
            </div>

            <Link
              href="/complaint/status"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-white hover:border-slate-300"
            >
              <FileCheck2 size={14} className="text-slate-500" />
              <span>Track Complaint</span>
            </Link>

            <Link
              href="/complaint"
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-3 sm:px-4 py-2 text-xs font-bold text-white shadow-sm shadow-red-500/25 transition-all hover:brightness-110 active:scale-95"
            >
              <FileWarning size={13} className="sm:size-3.5" />
              <span className="text-[11px] sm:text-xs">Report</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-xl bg-dashboard-navy px-3 sm:px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-dashboard-blue"
            >
              <UserCheck size={13} className="sm:size-3.5" />
              <span className="text-[11px] sm:text-xs">Login</span>
            </Link>

            {/* Mobile Menu Dropdown Button */}
            <details className="group relative lg:hidden">
              <summary
                aria-label="Open portal navigation"
                className="grid size-9 cursor-pointer list-none place-items-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors [&::-webkit-details-marker]:hidden"
              >
                <Menu size={18} />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-60 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Navigation Menu
                </div>
                {[
                  { label: "Overview", href: "#top", icon: Building2 },
                  { label: "How it Works", href: "#how-it-works", icon: HelpCircle },
                  { label: "Fund Journey", href: "#fund-journey", icon: TrendingUp },
                  { label: "Sector Impact", href: "#impact", icon: Layers },
                  { label: "Find My Area", href: "#my-area", icon: MapPin },
                  { label: "MP Performance", href: "#mp-accountability", icon: Users },
                  { label: "Geographic Map", href: "#map-section", icon: Compass },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-dashboard-navy"
                    >
                      <Icon size={15} className="text-dashboard-navy" />
                      <span>{item.label}</span>
                    </a>
                  );
                })}
                <div className="my-1.5 border-t border-slate-100" />
                <Link
                  href="/complaint/status"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <FileCheck2 size={15} className="text-slate-500" />
                  <span>Track Existing Complaint</span>
                </Link>
                <Link
                  href="/complaint"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <FileWarning size={15} />
                  <span>Report New Issue</span>
                </Link>
              </div>
            </details>
          </div>
        </div>

        {/* Tier 2: Dedicated Navigation Ribbon (Spacious & Clean, Touch-Scrollable) */}
        <div className="border-t border-slate-100 bg-slate-50/95 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
            <nav
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2 no-scrollbar scroll-smooth"
              aria-label="Public sections navigation"
            >
              {[
                { label: "Overview", href: "#top", icon: Building2 },
                { label: "How it Works", href: "#how-it-works", icon: HelpCircle },
                { label: "Fund Journey", href: "#fund-journey", icon: TrendingUp },
                { label: "Sector Impact", href: "#impact", icon: Layers },
                { label: "Find My Area", href: "#my-area", icon: MapPin },
                { label: "MP Performance", href: "#mp-accountability", icon: Users },
                { label: "Geographic Map", href: "#map-section", icon: Compass },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className={`inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-all ${
                      idx === 0
                        ? "bg-dashboard-navy text-white shadow-sm shadow-dashboard-navy/20"
                        : "text-slate-600 hover:bg-white hover:text-dashboard-navy hover:shadow-sm"
                    }`}
                  >
                    <Icon size={13} className={idx === 0 ? "text-dashboard-lime" : "text-slate-400"} />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* HERO SECTION — HIGH IMPACT CITIZEN TRANSPARENCY                */}
      {/* -------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-dashboard-deep text-white pt-12 pb-24 sm:pt-16 sm:pb-32">
        {/* Hero Background WebP Image */}
        <Image
          src="/mplads-public-hero-2x.webp"
          alt="Aerial view of a government complex and surrounding public infrastructure"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Gradient overlays for crisp contrast and readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-3.5 py-1 text-xs font-semibold text-dashboard-lime shadow-inner backdrop-blur-md">
              <Sparkles size={13} />
              <span>Open Citizen Oversight • All 543 Lok Sabha Constituencies</span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white drop-shadow-md sm:text-5xl sm:leading-[1.15]">
              Track Every Rupee Sanctioned for Your Neighborhood
            </h1>

            <p className="mt-4 text-sm text-slate-100 drop-shadow sm:text-base leading-relaxed max-w-2xl mx-auto">
              Members of Parliament are allocated ₹5 Crore every year for local development. Discover which roads, schools, drinking water facilities, and clinics are funded in your area.
            </p>

            {/* Hero Quick-Action Buttons */}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#my-area"
                className="inline-flex items-center gap-2 rounded-xl bg-dashboard-lime px-5 py-3 text-xs font-bold text-dashboard-navy shadow-lg shadow-dashboard-lime/20 transition-all hover:bg-[#a6ff60] active:scale-95"
              >
                <MapPin size={16} />
                <span>Search My District</span>
              </a>
              <a
                href="#mp-accountability"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-black/40 px-5 py-3 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-black/60"
              >
                <Users size={16} />
                <span>Track My MP</span>
              </a>
              <Link
                href="/complaint"
                className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-600/40 px-5 py-3 text-xs font-bold text-red-100 backdrop-blur-md transition-all hover:bg-red-600/60"
              >
                <FileWarning size={16} />
                <span>File Citizen Complaint</span>
              </Link>
            </div>
          </div>

          {/* National Live Key Counters Strip */}
          {dataQuality && financials && (
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  label: "Total Projects",
                  val: dataQuality.total_projects.toLocaleString(),
                  sub: "Across all districts",
                  icon: Building2,
                  accent: "text-cyan-300",
                },
                {
                  label: "Funds Sanctioned",
                  val: crore(financials.total_sanctioned),
                  sub: "Approved budget",
                  icon: Landmark,
                  accent: "text-amber-300",
                },
                {
                  label: "Funds Released",
                  val: crore(financials.total_released),
                  sub: `${financials.release_utilization_pct}% of allocation`,
                  icon: TrendingUp,
                  accent: "text-sky-300",
                },
                {
                  label: "Funds Utilized",
                  val: crore(financials.total_expenditure),
                  sub: `${financials.expenditure_utilization_pct}% spent on ground`,
                  icon: CheckCircle2,
                  accent: "text-dashboard-lime",
                },
                {
                  label: "Completed Works",
                  val: (completed ?? 0).toLocaleString(),
                  sub: "Delivered to public",
                  icon: Award,
                  accent: "text-emerald-300",
                },
                {
                  label: "Active In-Progress",
                  val: ((ongoing ?? 0) + (delayed ?? 0)).toLocaleString(),
                  sub: "Under execution",
                  icon: Compass,
                  accent: "text-rose-300",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col justify-between rounded-2xl border border-white/20 bg-black/40 p-3.5 backdrop-blur-md transition-all hover:bg-black/50 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {item.label}
                      </span>
                      <Icon size={14} className={item.accent} />
                    </div>
                    <div className="mt-2 text-xl font-extrabold tracking-tight text-white font-mono">
                      {item.val}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-300">{item.sub}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tricolor transition curve at the bottom */}
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-10 w-full sm:h-14 pointer-events-none"
        >
          <path d="M0,40 C360,90 1080,-10 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
          <path d="M0,34 C360,84 1080,-16 1440,34" fill="none" stroke="#FF9933" strokeWidth="3" />
          <path d="M0,46 C360,96 1080,-4 1440,46" fill="none" stroke="#128807" strokeWidth="3" />
        </svg>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* MAIN CITIZEN EXPERIENCE CONTENT                                */}
      {/* -------------------------------------------------------------- */}
      <main className="mx-auto flex max-w-6xl flex-col px-4 py-10 sm:px-6 lg:px-8 space-y-16">
        {/* ------------------------------------------------------------ */}
        {/* 1. HOW MPLADS WORKS — 3 SIMPLE STEPS FOR CITIZENS             */}
        {/* ------------------------------------------------------------ */}
        <section id="how-it-works" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <SectionEyebrow>Citizen Guide</SectionEyebrow>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">How MPLADS Works in 3 Simple Steps</h2>
              <p className="mt-1 text-xs text-slate-500">
                Understanding how public taxpayer money travels from Parliament to your doorstep.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3 relative">
            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-dashboard-navy font-bold text-white shadow-sm">
                1
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">1. MP Recommends Works</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Your elected Member of Parliament recommends community projects (roads, drinking water, school classrooms, clinics) based on local citizen demand.
              </p>
              <div className="mt-4 rounded-xl bg-white border border-slate-200 p-2.5 text-[11px] font-medium text-slate-600">
                💰 Budget: ₹5 Crore per year per MP
              </div>
            </div>

            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-dashboard-blue font-bold text-white shadow-sm">
                2
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">2. District Admin Sanctions</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                The District Collector / Authority examines feasibility, issues formal sanction, hires executing agencies, and releases initial installments.
              </p>
              <div className="mt-4 rounded-xl bg-white border border-slate-200 p-2.5 text-[11px] font-medium text-slate-600">
                ⚙️ Agencies: PWD, Panchayats, Jal Nigam
              </div>
            </div>

            <div className="relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-sm">
                3
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">3. Execution &amp; Citizen Audit</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Work is constructed on ground. Citizens can inspect, check milestone progress, and file complaints if a project is delayed or abandoned.
              </p>
              <div className="mt-4 rounded-xl bg-white border border-slate-200 p-2.5 text-[11px] font-medium text-emerald-700">
                🛡️ You have the right to monitor &amp; verify
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* 2. FIND MY AREA & GPS NEAR ME                                */}
        {/* ------------------------------------------------------------ */}
        <section id="my-area" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <SectionEyebrow>Local Discovery</SectionEyebrow>
          <div className="mt-2">
            <h2 className="font-display text-2xl font-bold text-slate-900">Find Projects In Your Area</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select your state and district or use GPS location to view all live, completed, and in-progress public works.
            </p>
          </div>

          <div className="mt-6">
            <NearMe />
            <AreaSearch states={states} />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* 3. THE FUND JOURNEY PIPELINE                                 */}
        {/* ------------------------------------------------------------ */}
        {financials && (
          <section id="fund-journey" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
            <SectionEyebrow>Money Flow</SectionEyebrow>
            <div className="mt-2">
              <h2 className="font-display text-2xl font-bold text-slate-900">The 3-Stage Fund Journey</h2>
              <p className="mt-1 text-xs text-slate-500 max-w-2xl">
                Sanctioning funds does not mean money is immediately spent. See how funds move through each checkpoint until physical assets are delivered.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  stage: "1. Sanctioned Budget",
                  amount: financials.total_sanctioned,
                  pct: 100,
                  desc: "Total value of works approved by District Authorities",
                  color: "border-blue-200 bg-blue-50/40 text-blue-900",
                },
                {
                  stage: "2. Released to Agencies",
                  amount: financials.total_released,
                  pct: financials.release_utilization_pct,
                  desc: "Funds transferred to implementing contractors & departments",
                  color: "border-indigo-200 bg-indigo-50/40 text-indigo-900",
                },
                {
                  stage: "3. Utilized on Ground",
                  amount: financials.total_expenditure,
                  pct: financials.expenditure_utilization_pct,
                  desc: "Verified bills cleared for completed physical construction",
                  color: "border-emerald-200 bg-emerald-50/40 text-emerald-900",
                },
              ].map((step, idx) => (
                <div key={step.stage} className={`flex flex-col justify-between rounded-2xl border p-5 ${step.color}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">{step.stage}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold shadow-sm">
                        {step.pct}%
                      </span>
                    </div>
                    <div className="mt-3 font-mono text-2xl font-black">{crore(step.amount)}</div>
                    <p className="mt-2 text-xs text-slate-600">{step.desc}</p>
                  </div>
                  {idx > 0 && (
                    <div className="mt-4 border-t border-black/5 pt-2 text-[11px] font-semibold text-slate-700">
                      ✓ {step.pct}% converted from previous stage
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pipeline Gap Callout */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    {crore(financials.total_released - financials.total_expenditure)} Currently in Implementation Pipeline
                  </h4>
                  <p className="mt-0.5 text-xs text-amber-800">
                    This amount is already in department accounts and is actively being converted into finished construction on the ground.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ */}
        {/* 4. SECTOR IMPACT & PROJECT SHOWCASE                          */}
        {/* ------------------------------------------------------------ */}
        {financials && (
          <section id="impact" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
            <SectionEyebrow>Community Transformation</SectionEyebrow>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900">What Did MPLADS Build?</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Explore projects by public infrastructure category. Click a category to filter live records.
                </p>
              </div>
              {sector && (
                <Link
                  href="/public#impact"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-dashboard-navy hover:bg-slate-100"
                >
                  ✕ Clear Filter
                </Link>
              )}
            </div>

            {/* Sector Grid */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {financials.by_type.map((t) => {
                const meta = SECTOR_META[t.project_type] ?? {
                  label: t.project_type.replace(/_/g, " "),
                  icon: Building2,
                  color: "text-slate-700",
                  bg: "bg-slate-50",
                  border: "border-slate-200",
                };
                const Icon = meta.icon;
                const active = sector === t.project_type;

                return (
                  <Link
                    key={t.project_type}
                    href={active ? "/public#impact" : `/public?sector=${t.project_type}#impact`}
                    className={`group relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all hover:-translate-y-1 hover:shadow-md ${
                      active
                        ? "border-dashboard-navy bg-blue-50/50 ring-2 ring-dashboard-navy shadow-sm"
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className={`flex size-11 items-center justify-center rounded-2xl ${meta.bg} ${meta.color} transition-transform group-hover:scale-105`}>
                      <Icon size={22} />
                    </div>
                    <span className="mt-2.5 block text-xs font-bold text-slate-900 line-clamp-1">
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">
                      {t.project_count.toLocaleString()} works
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Representative Projects Table */}
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="font-bold text-xs text-slate-800">
                  {sector ? `${SECTOR_META[sector]?.label ?? sector} Projects` : "Representative Monitored Works"}
                </div>
                <div className="text-[11px] text-slate-500">Showing latest verified entries</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Project Name &amp; ID</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Sanctioned Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Physical Progress</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projects.map((p) => {
                      const conf = STATUS_STYLES[p.status] ?? STATUS_STYLES.SANCTIONED;
                      const progress = Math.min(Math.max(p.physical_progress ?? 0, 0), 100);
                      return (
                        <tr key={p.id} className="transition-colors hover:bg-blue-50/20">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{p.project_name}</div>
                            <div className="font-mono text-[10px] text-slate-400">
                              Ref: {p.external_project_id || p.id.slice(0, 10)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-600">
                            {p.district}, {p.state}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                            {crore(p.sanctioned_amount)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${conf.bg} ${conf.text}`}>
                              <span className={`size-1.5 rounded-full ${conf.dot}`} />
                              {conf.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="w-28 space-y-1">
                              <div className="flex justify-between text-[10px] font-semibold text-slate-600">
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    progress >= 100 ? "bg-emerald-500" : progress > 50 ? "bg-blue-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Link
                              href={`/complaint/${p.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/60 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 transition-colors"
                            >
                              <FileWarning size={12} />
                              Report
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ */}
        {/* 5. MP & REGIONAL PERFORMANCE SCORECARD                       */}
        {/* ------------------------------------------------------------ */}
        <section id="mp-accountability" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <SectionEyebrow>Elected Representatives</SectionEyebrow>
          <div className="mt-2">
            <h2 className="font-display text-2xl font-bold text-slate-900">MP-Wise Sanctions &amp; Accountability</h2>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              Every project is recommended by a Member of Parliament for their constituency. Search your MP or Constituency to see sanctioned works.
            </p>
          </div>

          <div className="mt-6">
            <MpBreakdown states={states} initial={mpBreakdown} />
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* 6. GEOGRAPHIC MAP VIEW                                       */}
        {/* ------------------------------------------------------------ */}
        <section id="map-section" className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm">
          <SectionEyebrow>Geospatial View</SectionEyebrow>
          <div className="mt-2">
            <h2 className="font-display text-2xl font-bold text-slate-900">Geographical Spread of Works</h2>
            <p className="mt-1 text-xs text-slate-500">
              Interactive map displaying project concentration across all states and districts.
            </p>
          </div>

          <div className="mt-6">
            {heatmapData && (
              <PublicHeatmap
                initialData={heatmapData}
                states={states}
                projectTypes={projectTypes}
                initialSector={sector}
              />
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* 7. CITIZEN GRIEVANCE / REPORT CONCERN CALLOUT BANNER         */}
        {/* ------------------------------------------------------------ */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 p-8 text-white shadow-lg shadow-red-600/10">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                <ShieldAlert size={14} />
                <span>Citizen Redressal Window</span>
              </div>
              <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tight">
                Found a Delayed, Substandard, or Incomplete Project?
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-red-100 leading-relaxed">
                Take a geo-tagged photo with your phone and file an official complaint. The grievance is automatically routed to District Authorities for inspection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/complaint"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold text-red-700 shadow-md transition-all hover:bg-red-50 active:scale-95"
              >
                <FileWarning size={16} />
                <span>File Complaint Now</span>
              </Link>
              <Link
                href="/complaint/status"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-xs font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <span>Check Status</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* -------------------------------------------------------------- */}
      {/* MODERN FOOTER                                                  */}
      {/* -------------------------------------------------------------- */}
      <footer className="border-t border-slate-200 bg-white px-4 py-10 text-xs text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between gap-8">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-slate-900">
              <ShieldCheck size={18} className="text-dashboard-navy" />
              <span>MPLADS Public Transparency Portal</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              An open digital public infrastructure initiative designed for transparency, public accountability, and citizen oversight in MPLADS fund allocation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 text-xs">
            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Quick Links</div>
              <ul className="mt-2.5 space-y-1.5 text-slate-500">
                <li><a href="#top" className="hover:text-dashboard-navy">Overview</a></li>
                <li><a href="#how-it-works" className="hover:text-dashboard-navy">How it Works</a></li>
                <li><a href="#my-area" className="hover:text-dashboard-navy">Find My Area</a></li>
                <li><a href="#mp-accountability" className="hover:text-dashboard-navy">MP Performance</a></li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Citizen Services</div>
              <ul className="mt-2.5 space-y-1.5 text-slate-500">
                <li><Link href="/complaint" className="hover:text-red-600">File Grievance</Link></li>
                <li><Link href="/complaint/status" className="hover:text-dashboard-navy">Track Grievance Status</Link></li>
                <li><a href="#fund-journey" className="hover:text-dashboard-navy">Fund Journey Flow</a></li>
              </ul>
            </div>

            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Administration</div>
              <ul className="mt-2.5 space-y-1.5 text-slate-500">
                <li><Link href="/" className="hover:text-dashboard-navy">Officer Sign In</Link></li>
                <li><span className="text-slate-400">MoSPI, Government of India</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-6xl border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div>© 2026 MPLADS Intelligence Platform • SIH26102 • Open Citizen Access</div>
          <div className="flex items-center gap-4">
            <span>Live Data Sync</span>
            <span>•</span>
            <span>PostGIS Geospatial Engine</span>
          </div>
        </div>
      </footer>

      {/* -------------------------------------------------------------- */}
      {/* MOBILE STICKY BOTTOM ACTION BAR (PHONE OPTIMIZED)              */}
      {/* -------------------------------------------------------------- */}
      <div className="sticky bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md px-3 py-2 sm:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-4 gap-1 text-center">
          <a
            href="#my-area"
            className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <MapPin size={16} className="text-dashboard-navy" />
            <span className="text-[10px] font-bold">My Area</span>
          </a>
          <a
            href="#mp-accountability"
            className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <Users size={16} className="text-dashboard-navy" />
            <span className="text-[10px] font-bold">Track MP</span>
          </a>
          <Link
            href="/complaint"
            className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-red-600 bg-red-50/70 active:scale-95 transition-all"
          >
            <FileWarning size={16} />
            <span className="text-[10px] font-bold">Grievance</span>
          </Link>
          <Link
            href="/complaint/status"
            className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <FileCheck2 size={16} className="text-slate-500" />
            <span className="text-[10px] font-bold">Status</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
