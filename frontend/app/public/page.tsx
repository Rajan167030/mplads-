import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Droplets,
  FileText,
  GraduationCap,
  HeartPulse,
  Landmark,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import Link from "next/link";

import { PublicHeatmap } from "@/components/public/public-heatmap";
import { getDataQuality, getFinancialsSummary, getRiskMap, listProjects, type ProjectListItem, type RiskMapResult } from "@/lib/api";

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
  let fetchError: string | null = null;

  try {
    const [dq, fin, completedRes, ongoingRes, delayedRes, projectsRes, mapRes] = await Promise.all([
      getDataQuality(),
      getFinancialsSummary(),
      listProjects({ status: "COMPLETED", limit: 1 }),
      listProjects({ status: "ONGOING", limit: 1 }),
      listProjects({ status: "DELAYED", limit: 1 }),
      listProjects({ project_type: sector, limit: 8, sort_by: "sanctioned_amount" }),
      getRiskMap({ project_type: sector, limit: 5000 }),
    ]);
    dataQuality = dq;
    financials = fin;
    completed = completedRes.total;
    ongoing = ongoingRes.total;
    delayed = delayedRes.total;
    projects = projectsRes.items;
    heatmapData = mapRes;
  } catch {
    fetchError = "Could not reach the backend API. Is it running at NEXT_PUBLIC_API_URL?";
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header id="top" className="relative z-30 border-b border-white/10 bg-dashboard-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
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
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Public site navigation">
            {[
              ["Home", "#top"],
              ["About the Scheme", "#about"],
              ["Dashboard", "/"],
              ["Citizen Request", "#my-area"],
            ].map(([label, href], i) => (
              <a
                key={label}
                href={href}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  i === 0 ? "text-dashboard-lime" : "text-slate-200 hover:text-white"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-dashboard-navy hover:bg-slate-100"
          >
            Login
          </Link>
        </div>
      </header>

      <section
        id="about"
        className="relative isolate overflow-hidden bg-gradient-to-br from-dashboard-navy via-dashboard-deep to-black text-white"
      >
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-dashboard-lime/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-dashboard-lime/25 bg-dashboard-lime/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-dashboard-lime">
              <Sparkles size={13} /> Public Project Transparency
            </div>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
              MPLADS: From Local Priorities to{" "}
              <span className="text-dashboard-lime">National Development</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              See where local infrastructure funds are being spent, how far each project has progressed, and where
              the money currently sits in the funding pipeline — computed live, not a static report.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#explore"
                className="inline-flex items-center gap-2 rounded-lg bg-dashboard-lime px-5 py-2.5 text-xs font-bold text-dashboard-navy shadow-md hover:brightness-95"
              >
                Explore All Projects <ArrowRight size={15} />
              </a>
              <a
                href="#summary"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                View National Summary
              </a>
            </div>
            <p className="mt-5 text-[11px] font-medium text-slate-400">
              <span className="mr-2 inline-block size-1.5 rounded-full bg-dashboard-lime align-middle" />
              Public access • No login required • Every number below is live, computed from the current database
            </p>
          </div>

          <div className="mt-10 flex gap-6 lg:absolute lg:bottom-10 lg:right-8 lg:mt-0">
            <a
              href="#documents"
              className="flex flex-col items-center gap-2 text-[11px] font-medium text-slate-200 hover:text-white"
            >
              <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/5 text-dashboard-lime">
                <FileText size={22} />
              </span>
              Documents
            </a>
            <a
              href="#videos"
              className="flex flex-col items-center gap-2 text-[11px] font-medium text-slate-200 hover:text-white"
            >
              <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/5 text-dashboard-lime">
                <PlayCircle size={22} />
              </span>
              Videos
            </a>
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

      <main className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8">
        {fetchError && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
        )}

        {dataQuality && financials && (
          <>
            <section id="summary">
              <h2 className="mb-3 font-display text-lg font-bold text-slate-900">National Transparency Summary</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 border-b border-slate-100 pb-4">
                <h2 className="font-display text-lg font-bold text-slate-900">Where Are the Funds?</h2>
                <p className="mt-1 text-xs text-slate-500">
                  The real three-stage pipeline this system tracks — sanctioned amounts don&apos;t always translate
                  to money on the ground.
                </p>
              </div>
              {[
                ["1. Sanctioned", financials.total_sanctioned, 100],
                ["2. Released to Implementing Agencies", financials.total_released, financials.release_utilization_pct],
                ["3. Utilized on Ground", financials.total_expenditure, financials.expenditure_utilization_pct],
              ].map(([stage, amount, pct], i) => (
                <div
                  key={stage as string}
                  className={`mt-3 flex items-center justify-between gap-3 rounded-lg p-2.5 text-xs ${
                    i === 2 ? "border border-emerald-100 bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-800"
                  }`}
                >
                  <span className="font-medium">{stage}</span>
                  <span className="font-mono font-bold">
                    {crore(amount as number)} <span className="font-normal opacity-60">({pct}%)</span>
                  </span>
                </div>
              ))}
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div>
                  <div className="text-xs font-bold text-amber-900">
                    {crore(financials.total_released - financials.total_expenditure)} Pipeline Gap
                  </div>
                  <div className="text-[10px] text-amber-800">Released to agencies but not yet shown as utilized.</div>
                </div>
                <BadgeCheck size={19} className="shrink-0 text-amber-600" />
              </div>
            </section>

            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">What Are MPLADS Funds Being Used For?</h2>
                  <p className="text-xs text-slate-500">Click a category to filter the projects below</p>
                </div>
                {sector && (
                  <Link href="/public" className="text-xs font-semibold text-dashboard-navy underline">
                    Clear filter
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
                {financials.by_type.map((t) => {
                  const meta = SECTOR_META[t.project_type] ?? { label: t.project_type, icon: Building2, color: "bg-slate-50 text-slate-600" };
                  const Icon = meta.icon;
                  const active = sector === t.project_type;
                  return (
                    <Link
                      key={t.project_type}
                      href={active ? "/public" : `/public?sector=${t.project_type}`}
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
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 border-b border-slate-100 pb-4">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {sector ? `Where Are ${SECTOR_META[sector]?.label ?? sector} Projects Located?` : "Where Are These Projects Located?"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Project density across India — brighter areas have more monitored projects. This shows location
                  only; no risk analysis is part of this public view.
                </p>
              </div>
              {heatmapData && <PublicHeatmap data={heatmapData} />}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {sector ? `${SECTOR_META[sector]?.label ?? sector} Projects` : "Representative Civic Works"}
                  </h2>
                  <p className="text-xs text-slate-500">Live records — no risk analysis is shown on this public view</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                    <tr>
                      {["Project", "Location", "Sanctioned", "Status", "Physical Progress"].map((h) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
                {projects.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-500">No projects match this category yet.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white px-4 py-7 text-xs text-slate-600 sm:px-6 lg:px-8">
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
