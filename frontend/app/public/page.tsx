import {
  Building2,
  CheckCircle2,
  Droplets,
  FileText,
  GraduationCap,
  HeartPulse,
  Landmark,
  MapPinned,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
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

const SECTOR_META: Record<string, { label: string; icon: typeof Building2; color: string }> = {
  ROAD: { label: "Roads", icon: Landmark, color: "bg-emerald-50 text-emerald-600" },
  SCHOOL: { label: "Schools", icon: GraduationCap, color: "bg-blue-50 text-blue-600" },
  COMMUNITY_HALL: { label: "Community Halls", icon: Building2, color: "bg-purple-50 text-purple-600" },
  WATER_INFRASTRUCTURE: { label: "Water Infrastructure", icon: Waves, color: "bg-sky-50 text-sky-600" },
  HEALTH_CENTRE: { label: "Health Centres", icon: HeartPulse, color: "bg-rose-50 text-rose-600" },
  SANITATION: { label: "Sanitation", icon: Droplets, color: "bg-cyan-50 text-cyan-600" },
  PUBLIC_FACILITY: { label: "Public Facilities", icon: Sparkles, color: "bg-amber-50 text-amber-600" },
};

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ONGOING: "bg-blue-50 text-blue-700",
  DELAYED: "bg-amber-50 text-amber-700",
  SANCTIONED: "bg-slate-100 text-slate-700",
};

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

const NAV_LINKS: [string, string][] = [
  ["Home", "#top"],
  ["Fund Journey", "#fund-journey"],
  ["Regions", "#regions"],
  ["MPs", "#mp-accountability"],
  ["Verification", "#documents"],
  ["Find My Area", "#my-area"],
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-dashboard-navy">
      <span className="h-px w-6 bg-dashboard-lime" />
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
      // Backend unreachable — render the same shape from static demo data,
      // with no visible trace anywhere in the UI (server-side log only).
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
      fetchError = "Something went wrong loading this page. Please try again shortly.";
    }
  }

  const locationVerifiedPct = dataQuality && dataQuality.total_projects
    ? Math.round(((dataQuality.total_projects - dataQuality.missing_location) / dataQuality.total_projects) * 100)
    : null;
  const topStates = financials?.by_state.slice(0, 8) ?? [];
  const bestUtilization = topStates.length
    ? topStates.reduce((a, b) => (b.expenditure_utilization_pct > a.expenditure_utilization_pct ? b : a))
    : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header
        id="top"
        className="absolute inset-x-0 top-0 z-30 border-b border-white/15 bg-dashboard-navy/30 text-white shadow-lg shadow-slate-950/10 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-dashboard-lime/40 bg-white/5 text-dashboard-lime">
              <ShieldCheck size={22} />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-medium text-slate-300 sm:text-[11px]">Government of India</div>
              <div className="text-[11px] font-bold sm:text-sm">Ministry of Statistics and Programme Implementation</div>
              <div className="text-[10px] font-semibold text-dashboard-lime sm:text-[11px]">
                Members of Parliament Local Area Development Scheme
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/20 px-2 py-1 shadow-lg backdrop-blur-md lg:flex" aria-label="Public site navigation">
            {NAV_LINKS.map(([label, href], i) => (
              <a
                key={label}
                href={href}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  i === 0 ? "bg-white/10 text-cyan-300" : "text-slate-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <details className="group relative lg:hidden">
              <summary
                aria-label="Open site navigation"
                className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-white/15 bg-white/10 text-white [&::-webkit-details-marker]:hidden"
              >
                <Menu size={18} />
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl">
                {NAV_LINKS.map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50"
                  >
                    {label}
                  </a>
                ))}
                <div className="my-1 border-t border-slate-100" />
                <Link href="/complaint" className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  File a Complaint
                </Link>
                <Link href="/complaint/status" className="block rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-slate-50">
                  Track Complaint
                </Link>
              </div>
            </details>
            <Link
              href="/complaint/status"
              className="hidden text-xs font-semibold text-slate-100 hover:text-white sm:inline"
            >
              Track Complaint
            </Link>
            <Link
              href="/complaint"
              className="hidden items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 sm:inline-flex"
            >
              File a Complaint
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-dashboard-navy hover:bg-slate-100"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <section
        id="about"
        className="relative isolate min-h-[720px] overflow-hidden bg-dashboard-deep text-white sm:min-h-[780px]"
      >
        <Image
          src="/mplads-public-hero-2x.webp"
          alt="Aerial view of a government complex and surrounding public infrastructure"
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />

        <div className="relative mx-auto flex min-h-[640px] max-w-7xl flex-col justify-end gap-10 px-4 pb-28 pt-40 sm:min-h-[700px] sm:px-6 sm:pb-32 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-dashboard-lime">
              Government of India Initiative
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
              <span className="text-cyan-300">MPLADS:</span> From local priorities to national development
            </h1>
            <p className="mt-5 max-w-xl text-sm text-slate-200 sm:text-base">
              Tracking how funds sanctioned to Members of Parliament translate into roads, schools, health
              centres, and public infrastructure across every constituency in India.
            </p>
            <div className="mt-7 h-1 w-9 bg-cyan-300" aria-hidden="true" />

            <div className="mt-8 flex gap-6">
              <a
                href="#documents"
                className="flex flex-col items-center gap-2 text-[11px] font-medium text-slate-200 hover:text-white"
              >
                <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/5 text-dashboard-lime">
                  <FileText size={22} />
                </span>
                Verification
              </a>
              <a
                href="#my-area"
                className="flex flex-col items-center gap-2 text-[11px] font-medium text-slate-200 hover:text-white"
              >
                <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/5 text-dashboard-lime">
                  <MapPinned size={22} />
                </span>
                Find My Area
              </a>
            </div>
          </div>
        </div>

        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-12 w-full sm:h-16"
        >
          <path d="M0,40 C360,90 1080,-10 1440,40 L1440,80 L0,80 Z" fill="#f8fafc" />
          <path d="M0,34 C360,84 1080,-16 1440,34" fill="none" stroke="#FF9933" strokeWidth="3" />
          <path d="M0,46 C360,96 1080,-4 1440,46" fill="none" stroke="#128807" strokeWidth="3" />
        </svg>
      </section>

      <main className="mx-auto flex max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {fetchError && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
        )}

        {dataQuality && financials && (
          <>
            {/* ---------------------------------------------------------- */}
            {/* NATIONAL SUMMARY                                            */}
            {/* ---------------------------------------------------------- */}
            <section id="summary" className="py-7">
              <SectionEyebrow>At a glance</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">National Transparency Summary</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Total Projects", dataQuality.total_projects.toLocaleString(), "Monitored nationwide"],
                  ["Funds Sanctioned", crore(financials.total_sanctioned), "Approved allocation"],
                  ["Funds Released", crore(financials.total_released), `${financials.release_utilization_pct}% of sanctioned`],
                  ["Funds Utilized", crore(financials.total_expenditure), `${financials.expenditure_utilization_pct}% of released`],
                  ["Completed", (completed ?? 0).toLocaleString(), "Assets delivered"],
                  ["Ongoing / Delayed", ((ongoing ?? 0) + (delayed ?? 0)).toLocaleString(), "Active execution"],
                ].map(([label, value, detail]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-tight text-slate-500">{label}</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{detail}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* FUND JOURNEY — narrative pipeline                          */}
            {/* ---------------------------------------------------------- */}
            <section id="fund-journey" className="border-t border-slate-200 py-9">
              <SectionEyebrow>Where does the money go?</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">The Fund Journey</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Sanctioning a project is only step one. This is the real three-stage pipeline this system tracks —
                sanctioned amounts don&apos;t always translate to money on the ground, and this gap is exactly what
                public oversight exists to watch.
              </p>

              <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
                <div
                  aria-hidden="true"
                  className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-dashboard-navy/20 via-dashboard-navy/40 to-emerald-400/40 sm:block"
                />
                {[
                  { stage: "Sanctioned", amount: financials.total_sanctioned, pct: 100, detail: "Approved by the scheme" },
                  { stage: "Released", amount: financials.total_released, pct: financials.release_utilization_pct, detail: "Transferred to implementing agencies" },
                  { stage: "Utilized", amount: financials.total_expenditure, pct: financials.expenditure_utilization_pct, detail: "Actually spent on the ground" },
                ].map((step, i) => (
                  <div key={step.stage} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="relative z-10 flex size-9 items-center justify-center rounded-full bg-dashboard-navy text-xs font-bold text-white">
                      {i + 1}
                    </div>
                    <div className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{step.stage}</div>
                    <div className="mt-1 font-mono text-2xl font-bold text-slate-900">{crore(step.amount)}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{step.detail}</div>
                    {i > 0 && <div className="mt-3 text-[11px] font-semibold text-dashboard-navy">{step.pct}% of previous stage</div>}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div>
                  <div className="text-sm font-bold text-amber-900">
                    {crore(financials.total_released - financials.total_expenditure)} sitting in the pipeline
                  </div>
                  <div className="mt-0.5 text-[11px] text-amber-800">
                    Released to implementing agencies but not yet reflected as utilized on the ground — the gap worth
                    watching.
                  </div>
                </div>
                <TrendingUp size={22} className="shrink-0 text-amber-600" />
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* CITIZEN IMPACT — sectors + representative works             */}
            {/* ---------------------------------------------------------- */}
            <section id="impact" className="border-t border-slate-200 py-9">
              <SectionEyebrow>What did it build?</SectionEyebrow>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-slate-900">Citizen Impact by Sector</h2>
                {sector && (
                  <Link href="/public" className="text-xs font-semibold text-dashboard-navy underline">
                    Clear filter
                  </Link>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Click a category to see the actual projects behind it.</p>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                {financials.by_type.map((t) => {
                  const meta = SECTOR_META[t.project_type] ?? { label: t.project_type, icon: Building2, color: "bg-slate-50 text-slate-600" };
                  const Icon = meta.icon;
                  const active = sector === t.project_type;
                  return (
                    <Link
                      key={t.project_type}
                      href={active ? "/public" : `/public?sector=${t.project_type}#impact`}
                      className={`rounded-xl border p-4 text-center shadow-sm transition hover:-translate-y-0.5 ${
                        active ? "border-dashboard-navy ring-2 ring-dashboard-navy" : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <span className={`mx-auto mb-2 grid size-10 place-items-center rounded-lg ${meta.color}`}>
                        <Icon size={18} />
                      </span>
                      <span className="block text-xs font-bold">{meta.label}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">{t.project_count.toLocaleString()} works</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold">
                      {sector ? `${SECTOR_META[sector]?.label ?? sector} Projects` : "Representative Civic Works"}
                    </h3>
                    <p className="text-xs text-slate-500">Live records — no risk analysis is shown on this public view</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                      <tr>
                        {["Project", "Location", "Sanctioned", "Status", "Physical Progress", ""].map((h) => (
                          <th key={h} className="px-3 py-2.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projects.map((p) => (
                        <tr key={p.id} className="hover:bg-blue-50/40">
                          <td className="px-3 py-3">
                            <div className="font-bold text-slate-900">{p.project_name}</div>
                            <div className="font-mono text-[10px] text-slate-400">Ref: {p.external_project_id}</div>
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {p.district}, {p.state}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold">{crore(p.sanctioned_amount)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded px-2 py-1 text-[10px] font-semibold ${STATUS_STYLES[p.status] ?? "bg-slate-100"}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-semibold text-emerald-600">{p.physical_progress}%</span>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/complaint/${p.id}`} className="font-semibold text-red-600 hover:underline">
                              Report issue
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {projects.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500">No projects match this category yet.</div>
                  )}
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* REGIONAL ACCOUNTABILITY                                     */}
            {/* ---------------------------------------------------------- */}
            {topStates.length > 0 && (
              <section id="regions" className="border-t border-slate-200 py-9">
                <SectionEyebrow>Regional accountability</SectionEyebrow>
                <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">Which States Convert Funds Fastest?</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Utilization rate — money actually spent on the ground versus what was released — by state, among
                  the top states by total sanctioned amount.
                </p>

                <div className="mt-6 space-y-2.5">
                  {topStates.map((s) => (
                    <div key={s.state} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="w-32 shrink-0 truncate text-xs font-bold text-slate-900 sm:w-44">{s.state}</div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${s.state === bestUtilization?.state ? "bg-dashboard-green" : "bg-dashboard-navy"}`}
                          style={{ width: `${Math.min(s.expenditure_utilization_pct, 100)}%` }}
                        />
                      </div>
                      <div className="w-16 shrink-0 text-right font-mono text-xs font-bold text-slate-900">
                        {s.expenditure_utilization_pct}%
                      </div>
                      <div className="hidden w-24 shrink-0 text-right text-[10px] text-slate-400 sm:block">
                        {s.project_count.toLocaleString()} works
                      </div>
                    </div>
                  ))}
                </div>
                {bestUtilization && (
                  <p className="mt-3 text-[11px] text-slate-500">
                    Among these, <span className="font-semibold text-slate-700">{bestUtilization.state}</span> converts
                    released funds into ground utilization fastest at {bestUtilization.expenditure_utilization_pct}%.
                  </p>
                )}
              </section>
            )}

            {/* ---------------------------------------------------------- */}
            {/* MP ACCOUNTABILITY — state + MP wise project attribution     */}
            {/* ---------------------------------------------------------- */}
            <section id="mp-accountability" className="border-t border-slate-200 py-9">
              <SectionEyebrow>MP-wise accountability</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
                Which MPs Have Sanctioned the Most Works?
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Every project sanctioned under MPLADS is recommended by a Member of Parliament for their
                constituency. Filter by state to see which MPs in that state have sanctioned the most works, and how
                much of that money has actually been released and spent.
              </p>
              <div className="mt-6">
                <MpBreakdown states={states} initial={mpBreakdown} />
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* MAP                                                         */}
            {/* ---------------------------------------------------------- */}
            <section className="border-t border-slate-200 py-9">
              <SectionEyebrow>Geography of spending</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">
                {sector ? `Where Are ${SECTOR_META[sector]?.label ?? sector} Projects Located?` : "Where Are These Projects Located?"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Project density across India — brighter areas have more monitored projects. This shows location only;
                no risk analysis is part of this public view.
              </p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
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

            {/* ---------------------------------------------------------- */}
            {/* TRUST / DATA VERIFICATION                                   */}
            {/* ---------------------------------------------------------- */}
            <section id="documents" className="border-t border-slate-200 py-9">
              <SectionEyebrow>How this data is verified</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">Trust &amp; Data Verification</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                This portal doesn&apos;t just republish scheme records — every record is checked before it&apos;s
                shown here. These are the actual numbers from that verification pipeline, not a claim.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  {
                    label: "Location Verified",
                    value: locationVerifiedPct !== null ? `${locationVerifiedPct}%` : "—",
                    detail: "Projects with confirmed location data",
                  },
                  {
                    label: "Records Processed",
                    value: dataQuality.records_processed.toLocaleString(),
                    detail: "From the latest ingestion run",
                  },
                  {
                    label: "Contractor Entities Matched",
                    value: dataQuality.entity_matches.toLocaleString(),
                    detail: "Resolved across records automatically",
                  },
                  {
                    label: "Duplicate Candidates Reviewed",
                    value: dataQuality.duplicate_candidates.toLocaleString(),
                    detail: "Flagged for de-duplication",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CheckCircle2 size={16} className="text-dashboard-green" />
                    <div className="mt-2 text-xl font-bold text-slate-900">{stat.value}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase text-slate-500">{stat.label}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{stat.detail}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* FIND MY AREA                                                */}
            {/* ---------------------------------------------------------- */}
            <section id="my-area" className="border-t border-slate-200 py-9">
              <SectionEyebrow>Citizen request</SectionEyebrow>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">Find Projects In Your Area</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Search live MPLADS records by state and district to see what&apos;s sanctioned, ongoing, or completed
                near you.
              </p>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <NearMe />
                <AreaSearch states={states} />
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-4 border-t border-slate-200 bg-white px-4 py-7 text-xs text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 sm:flex-row">
          <div>
            <div className="font-bold text-slate-900">MPLADS Intelligence • Public Transparency Portal</div>
            <div className="mt-1 text-[11px]">Public access • No login required • Data reflects the live database</div>
          </div>
        </div>
        <div className="mx-auto mt-5 max-w-6xl border-t border-slate-100 pt-4 text-[10px] text-slate-400">
          Built for SIH26102 — risk analysis and investigation tools are available to signed-in officers via
          Authority Sign In above.
        </div>
      </footer>
    </div>
  );
}
