"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, GitCompare, Loader2, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DuplicateComparisonDialog } from "@/components/patterns/duplicate-comparison-dialog";
import {
  ApiError,
  createInvestigation,
  getEnrichedEntityMatches,
  type EntityMatchEnriched,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const VERDICT_COLORS: Record<string, string> = {
  MATCH: "bg-rose-100 text-rose-800 border-rose-200",
  POSSIBLE_MATCH: "bg-amber-100 text-amber-800 border-amber-200",
};

function formatInr(amount: number | null | undefined) {
  const val = amount ?? 0;
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "bg-rose-500" : pct >= 65 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-dashboard-surface">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs font-bold">{pct}%</span>
    </div>
  );
}

export default function DuplicatePairsPage() {
  const { token, user } = useAuth();
  const [matches, setMatches] = useState<EntityMatchEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string>("");
  const [selected, setSelected] = useState<EntityMatchEnriched | null>(null);
  const [investigating, setInvestigating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getEnrichedEntityMatches(
        { verdict: verdict || undefined, limit: 50 },
        token ?? undefined
      );
      setMatches(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load duplicate pairs. Sign in for full access."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict, token]);

  async function handleInvestigate(sourceId: string, matchedId: string, notes: string) {
    if (!token) return;
    setInvestigating(sourceId);
    try {
      await createInvestigation(token, {
        project_id: sourceId,
        priority: "HIGH",
        notes,
      });
      setSuccessMsg(`Investigation created for duplicate pair. Check the Investigations tab.`);
      setSelected(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create investigation.");
    } finally {
      setInvestigating(null);
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Duplicate Sanction Pairs
            </h1>
            <p className="mt-1 text-sm text-dashboard-muted">
              Multilingual entity resolution flagged these project pairs as potential duplicate sanctions —
              phonetic + semantic + spatial + financial scoring. Click any row to open the side-by-side
              comparison view.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-2 text-xs font-semibold text-dashboard-ink hover:bg-dashboard-surface shadow-sm"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Verdict Filter */}
        <div className="mt-4 flex gap-2">
          {[
            { value: "", label: "All Pairs" },
            { value: "MATCH", label: "MATCH (High Confidence)" },
            { value: "POSSIBLE_MATCH", label: "POSSIBLE MATCH" },
          ].map((v) => (
            <button
              key={v.value}
              onClick={() => setVerdict(v.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                verdict === v.value
                  ? "border-dashboard-navy bg-dashboard-navy text-white"
                  : "border-dashboard-line bg-white text-dashboard-ink hover:bg-dashboard-surface"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Success Toast */}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            {successMsg}{" "}
            <Link href="/dashboard/investigations" className="font-semibold underline">
              View Investigations →
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-dashboard-muted">
            <Loader2 size={18} className="animate-spin" /> Loading duplicate pairs…
          </div>
        )}

        {/* Empty */}
        {!loading && !error && matches.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashboard-line bg-white p-10 text-center shadow-sm">
            <GitCompare size={40} className="mx-auto text-dashboard-muted/50" />
            <p className="mt-4 text-sm font-semibold text-dashboard-ink">No duplicate pairs detected yet.</p>
            <p className="mt-1 text-xs text-dashboard-muted">
              Run entity resolution from the Data Quality page to discover potential duplicate sanctions.
            </p>
          </div>
        )}

        {/* Pairs Table */}
        {!loading && matches.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-dashboard-line bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Project A</th>
                  <th className="px-4 py-3">Project B</th>
                  <th className="px-4 py-3">Budget Delta</th>
                  <th className="px-4 py-3">Date Gap</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-dashboard-line/60 last:border-0 hover:bg-dashboard-surface/60 transition cursor-pointer"
                    onClick={() => setSelected(m)}
                  >
                    <td className="px-4 py-3">
                      <ConfidenceMeter value={m.match_confidence} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${
                          VERDICT_COLORS[m.verdict] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {m.verdict.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        <span
                          className="block truncate font-semibold text-dashboard-ink hover:text-dashboard-navy"
                          title={m.source_project.project_name}
                        >
                          {m.source_project.project_name}
                        </span>
                        <span className="text-[11px] text-dashboard-muted">
                          {m.source_project.external_project_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        <span
                          className="block truncate font-semibold text-dashboard-ink"
                          title={m.matched_project.project_name}
                        >
                          {m.matched_project.project_name}
                        </span>
                        <span className="text-[11px] text-dashboard-muted">
                          {m.matched_project.external_project_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className={m.diff_metrics.amount_diff_pct > 10 ? "text-rose-700 font-bold" : ""}>
                        {formatInr(m.diff_metrics.amount_diff_inr)}
                      </span>
                      <div className="text-[11px] text-dashboard-muted">
                        {m.diff_metrics.amount_diff_pct.toFixed(1)}% variance
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {m.diff_metrics.days_between_sanction} days
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-dashboard-muted">
                        <MapPin size={12} />
                        {m.diff_metrics.distance_km !== null
                          ? `${m.diff_metrics.distance_km} km`
                          : m.source_project.district}
                      </div>
                      {m.diff_metrics.same_contractor && (
                        <span className="mt-0.5 block text-[10px] font-bold text-rose-600">
                          ⚠ Same contractor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelected(m)}
                          className="inline-flex items-center gap-1 rounded border border-dashboard-navy px-2 py-1 text-[10px] font-bold text-dashboard-navy hover:bg-dashboard-navy hover:text-white transition"
                        >
                          <GitCompare size={12} /> Compare
                        </button>
                        <Link
                          href={`/dashboard/projects/${m.source_project.id}`}
                          className="inline-flex items-center gap-1 text-[10px] text-dashboard-muted hover:text-dashboard-navy"
                        >
                          <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashboard-line px-4 py-3 text-xs text-dashboard-muted">
              Showing {matches.length} pair{matches.length !== 1 ? "s" : ""} sorted by confidence ·{" "}
              {!user && (
                <Link href="/" className="font-semibold underline">
                  Sign in
                </Link>
              )}{" "}
              {!user && "to create investigations from flagged pairs"}
            </div>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Modal */}
      <DuplicateComparisonDialog
        match={selected}
        onClose={() => setSelected(null)}
        onInvestigate={user ? handleInvestigate : undefined}
      />
    </main>
  );
}
