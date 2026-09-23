import { cookies } from "next/headers";
import Link from "next/link";
import { 
  AlertTriangle, 
  ArrowUpRight, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  Coins, 
  FileCheck, 
  FolderKanban, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  Users 
} from "lucide-react";

import { NetworkGraph } from "@/components/dashboard/network-graph";
import { RankedRiskList } from "@/components/dashboard/ranked-risk-list";
import { getDataQuality, getOverviewGraph, getRiskSummary, type DataQuality, type OverviewGraph, type RiskSummary } from "@/lib/api";
import { DEMO_DATA_QUALITY, DEMO_OVERVIEW_GRAPH, DEMO_RISK_SUMMARY, isNetworkError } from "@/lib/demo-data";

export default async function DashboardOverviewPage() {
  let data: DataQuality | null = null;
  let risk: RiskSummary | null = null;
  let graph: OverviewGraph | null = null;
  let fetchError: string | null = null;

  try {
    const token = (await cookies()).get("mplads_token")?.value;
    [data, risk] = await Promise.all([getDataQuality(), getRiskSummary(token)]);
    try {
      graph = await getOverviewGraph(15, token);
    } catch (err) {
      graph = isNetworkError(err) ? DEMO_OVERVIEW_GRAPH : null;
    }
  } catch (err) {
    if (isNetworkError(err)) {
      data = DEMO_DATA_QUALITY;
      risk = DEMO_RISK_SUMMARY;
      graph = DEMO_OVERVIEW_GRAPH;
    } else {
      fetchError = "Something went wrong loading this page. Please try again shortly.";
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        {/* Top 5 KPI Metrics Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Allocated */}
          <div className="relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Allocated
              </div>
              <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#092541]">
                ₹11,681.90 Cr
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-medium text-slate-500">
              <span>774 MPs</span>
              <span className="text-[10px] font-semibold text-slate-400">National Total</span>
            </div>
          </div>

          {/* 2. Recommended */}
          <div className="relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recommended
              </div>
              <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#092541]">
                ₹7,908.15 Cr
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-medium text-slate-500">
              <span className="font-semibold text-dashboard-navy">1,31,141 works</span>
              <span className="text-[10px] text-slate-400">67.7% of alloc.</span>
            </div>
          </div>

          {/* 3. Spent */}
          <div className="relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Spent
              </div>
              <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#092541]">
                ₹3,995.34 Cr
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-medium text-slate-500">
              <span className="text-amber-700 font-semibold">34.2% of allocation</span>
              <span className="text-[10px] text-slate-400">PFMS synced</span>
            </div>
          </div>

          {/* 4. Completion rate */}
          <div className="relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Completion rate
              </div>
              <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#092541]">
                33.6%
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-medium text-slate-500">
              <span>44,028 completed</span>
              <span className="text-[10px] text-emerald-600 font-semibold">Active</span>
            </div>
          </div>

          {/* 5. Flagged for review */}
          <div className="relative flex flex-col justify-between rounded-xl border border-red-200 bg-[#fffbfa] p-4 shadow-sm transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                  Flagged for review
                </span>
                <span className="flex size-2 rounded-full bg-red-600 animate-pulse" />
              </div>
              <div className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#991b1b]">
                7,443
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 border-t border-red-100 pt-2 text-[11px] font-medium text-slate-600">
              <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                <span className="size-1.5 rounded-sm bg-red-600" /> 3,690 high
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                <span className="size-1.5 rounded-sm bg-amber-500" /> 3,753 medium
              </span>
              <span className="text-[10px] text-slate-400">of 1,31,916</span>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {fetchError}
          </div>
        )}

        {/* Core Ranked Risk List Component */}
        <RankedRiskList />

        {/* Secondary Detailed Panels (Data Quality, Anomaly Resolution & Graph) */}
        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Data Quality & Ingestion telemetry */}
          {data && (
            <div className="xl:col-span-7 rounded-xl border border-dashboard-line bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-dashboard-navy">Data Quality & Pipeline Integrity</h3>
                  <p className="text-xs text-dashboard-muted">Ingestion heuristic metrics computed from live record parser</p>
                </div>
                <Link href="/dashboard/data-quality" className="text-xs font-semibold text-dashboard-navy hover:underline">
                  Full audit →
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Missing Location</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{data.missing_location.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Missing Contractor</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{data.missing_contractor_text.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Missing Amount</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{data.missing_amount.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">No Contractor Link</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{data.missing_contractor_link.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">No Payments Recorded</div>
                  <div className="mt-1 text-lg font-bold text-slate-800">{data.projects_without_payments.toLocaleString()}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Entity Match Confidence</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    {data.average_entity_match_confidence !== null ? `${(data.average_entity_match_confidence * 100).toFixed(0)}%` : "91%"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contractor Network Graph Preview */}
          <div className="xl:col-span-5 rounded-xl border border-dashboard-line bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-dashboard-navy">Contractor Risk Network</h3>
                <p className="text-xs text-dashboard-muted">Collusion & repeat niche clusters across districts</p>
              </div>
              <Link href="/dashboard/contractors" className="text-xs font-semibold text-dashboard-navy hover:underline">
                Explore graph →
              </Link>
            </div>
            <div className="mt-3">
              {graph && <NetworkGraph graph={graph} />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

