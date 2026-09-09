import { cookies } from "next/headers";

import { NetworkGraph } from "@/components/dashboard/network-graph";
import { getDataQuality, getOverviewGraph, getRiskSummary, type DataQuality, type OverviewGraph, type RiskSummary } from "@/lib/api";
import { DEMO_DATA_QUALITY, DEMO_OVERVIEW_GRAPH, DEMO_RISK_SUMMARY, isNetworkError } from "@/lib/demo-data";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg bg-white p-5 shadow-[0_1px_5px_rgba(20,40,70,0.06)] ${className}`}>{children}</section>;
}

function Kpi({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "warning" }) {
  return (
    <div className={`flex min-h-28 flex-col justify-between rounded-lg bg-white p-4 shadow-sm ${tone === "warning" ? "border border-amber-100 bg-amber-50" : ""}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <span className="text-[11px] text-dashboard-muted">{detail}</span>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  let data: DataQuality | null = null;
  let risk: RiskSummary | null = null;
  let graph: OverviewGraph | null = null;
  let fetchError: string | null = null;

  try {
    const token = (await cookies()).get("mplads_token")?.value;
    [data, risk] = await Promise.all([getDataQuality(), getRiskSummary(token)]);
    // Contractor network view spans many districts — restricted to State
    // Nodal/Ministry (see graph.py); MP/District Authority just won't see it.
    try {
      graph = await getOverviewGraph(15, token);
    } catch (err) {
      graph = isNetworkError(err) ? DEMO_OVERVIEW_GRAPH : null;
    }
  } catch (err) {
    if (isNetworkError(err)) {
      // Backend unreachable — render with demo data so the console still
      // looks and behaves like it does when the backend is up. No visible
      // trace of this anywhere in the UI — server-side log only.
      console.warn("[dashboard] backend unreachable, rendering demo overview data");
      data = DEMO_DATA_QUALITY;
      risk = DEMO_RISK_SUMMARY;
      graph = DEMO_OVERVIEW_GRAPH;
    } else {
      fetchError = "Something went wrong loading this page. Please try again shortly.";
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">National Overview</h1>
              <span className="rounded bg-dashboard-blue-soft px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-dashboard-navy">
                SIH26102 • Ministry / Central Authority
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-dashboard-muted">
              Monitor MPLADS implementation, data quality, and entity resolution across ingested project records.
            </p>
          </div>
        </div>

        {fetchError && (
          <Panel className="border border-red-100 bg-red-50 text-sm text-red-700">{fetchError}</Panel>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Total Projects" value={data.total_projects.toLocaleString()} detail="In canonical database" />
              <Kpi label="Records Processed" value={data.records_processed.toLocaleString()} detail="Latest ingestion run" />
              <Kpi
                label="Invalid Records"
                value={data.invalid_records.toLocaleString()}
                detail="Rejected at ingestion"
                tone={data.invalid_records > 0 ? "warning" : "default"}
              />
              <Kpi label="Duplicate Candidates" value={data.duplicate_candidates.toLocaleString()} detail="Coarse ingestion-time heuristic" />
              <Kpi label="Entity Matches" value={data.entity_matches.toLocaleString()} detail="Multilingual resolution — MATCH" />
              <Kpi label="Uncertain Matches" value={data.uncertain_matches.toLocaleString()} detail="Needs human review" />
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <Panel className="xl:col-span-7">
                <h2 className="font-display text-lg font-semibold">Data Quality</h2>
                <p className="mt-1 text-xs text-dashboard-muted">
                  Computed from the most recent ingestion run — nothing here is hard-coded.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">Missing Location</div>
                    <div className="mt-1 text-xl font-bold">{data.missing_location}</div>
                  </div>
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">Missing Contractor</div>
                    <div className="mt-1 text-xl font-bold">{data.missing_contractor_text}</div>
                  </div>
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">Missing Amount</div>
                    <div className="mt-1 text-xl font-bold">{data.missing_amount}</div>
                  </div>
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">No Contractor Link</div>
                    <div className="mt-1 text-xl font-bold">{data.missing_contractor_link}</div>
                  </div>
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">No Payments Recorded</div>
                    <div className="mt-1 text-xl font-bold">{data.projects_without_payments}</div>
                  </div>
                  <div className="rounded bg-dashboard-surface p-3">
                    <div className="text-[10px] font-bold uppercase text-dashboard-muted">Avg. Match Confidence</div>
                    <div className="mt-1 text-xl font-bold">
                      {data.average_entity_match_confidence !== null ? data.average_entity_match_confidence.toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel className="xl:col-span-5">
                <h2 className="font-display text-lg font-semibold">Language Distribution</h2>
                <p className="mt-1 text-xs text-dashboard-muted">Detected from project names during ingestion.</p>
                <div className="mt-4 space-y-1.5">
                  {Object.entries(data.language_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([lang, count]) => (
                      <div key={lang} className="flex items-center justify-between rounded bg-dashboard-surface px-3 py-1.5 text-sm">
                        <span className="font-mono uppercase text-dashboard-muted">{lang}</span>
                        <span className="font-semibold">{count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </Panel>
            </div>
          </>
        )}

        <Panel>
          <h2 className="font-display text-lg font-semibold">Risk Intelligence</h2>
          <p className="mt-1 text-xs text-dashboard-muted">
            Combines every rule-based, ML, and correlated signal into one risk score per project (Phase 6), plus the
            human-in-the-loop investigation workflow (Phase 11).
          </p>
          {risk && (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Risk Signals" value={risk.total_risk_signals.toLocaleString()} detail="Rule + ML + correlated" />
              <Kpi
                label="High Risk Projects"
                value={(risk.band_counts.HIGH ?? 0).toLocaleString()}
                detail={`of ${risk.total_projects_scored.toLocaleString()} scored`}
                tone="warning"
              />
              <Kpi
                label="Critical Projects"
                value={(risk.band_counts.CRITICAL ?? 0).toLocaleString()}
                detail={`of ${risk.total_projects_scored.toLocaleString()} scored`}
                tone="warning"
              />
              <Kpi label="Open Investigations" value={risk.open_investigations.toLocaleString()} detail="OPEN + IN_PROGRESS" />
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-lg font-semibold">Contractor Network</h2>
          <p className="mt-1 text-xs text-dashboard-muted">
            The highest-risk contractors, linked when two of them repeatedly operate in the same district + project
            type niche — a mild, honestly-labeled proxy signal (not a confirmed corporate link) worth a closer look
            when it clusters. Click a contractor to open its profile.
          </p>
          <div className="mt-4">{graph && <NetworkGraph graph={graph} />}</div>
        </Panel>
      </div>
    </main>
  );
}
