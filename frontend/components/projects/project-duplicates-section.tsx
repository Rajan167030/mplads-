"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCompare,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { DuplicateComparisonDialog } from "@/components/patterns/duplicate-comparison-dialog";
import {
  ApiError,
  createInvestigation,
  getProjectDuplicates,
  type EntityMatchEnriched,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  MATCH: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "MATCH (High Confidence)",
  },
  POSSIBLE_MATCH: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "POSSIBLE MATCH",
  },
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
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs font-bold text-dashboard-ink">{pct}%</span>
    </div>
  );
}

export function ProjectDuplicatesButton({
  matchesCount,
  onClick,
}: {
  matchesCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-sm transition ${
        matchesCount > 0
          ? "border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100"
          : "border-dashboard-line bg-white text-dashboard-navy hover:bg-dashboard-surface"
      }`}
      title="View duplicate sanctions and entity resolution matches for this project"
    >
      <GitCompare size={15} className={matchesCount > 0 ? "text-rose-600" : "text-dashboard-navy"} />
      <span>Duplicates</span>
      <span
        className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          matchesCount > 0 ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        {matchesCount}
      </span>
    </button>
  );
}

export function ProjectDuplicatesSection({
  projectId,
  projectName,
  initialMatches = [],
}: {
  projectId: string;
  projectName: string;
  initialMatches?: EntityMatchEnriched[];
}) {
  const { token, user } = useAuth();
  const [matches, setMatches] = useState<EntityMatchEnriched[]>(initialMatches);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<EntityMatchEnriched | null>(null);
  const [isHighlight, setIsHighlight] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectDuplicates(projectId, token ?? undefined);
      setMatches(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load duplicate matches.");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvestigate(sourceId: string, matchedId: string, notes: string) {
    if (!token) return;
    try {
      await createInvestigation(token, {
        project_id: sourceId,
        priority: "HIGH",
        notes,
      });
      setSuccessMsg("Investigation created for this duplicate pair. View in Investigations tab.");
      setSelectedMatch(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create investigation.");
    }
  }

  return (
    <section
      id="duplicates-section"
      className={`mt-6 rounded-xl border bg-white p-6 shadow-sm transition-all duration-700 ${
        isHighlight
          ? "border-rose-400 ring-4 ring-rose-100"
          : "border-dashboard-line hover:border-dashboard-line/80"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashboard-line/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <GitCompare size={18} />
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight text-dashboard-ink">
              Duplicate Sanction Pairs
            </h2>
            {matches.length > 0 ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                {matches.length} Flagged Pair{matches.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Clean (0 Flagged)
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-dashboard-muted">
            Multilingual entity resolution flagging potential duplicate sanctions for this project
            based on phonetic matching, semantic embeddings, location, budget delta, and contractor overlap.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-semibold text-dashboard-ink shadow-sm hover:bg-dashboard-surface transition disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {loading ? "Checking…" : "Re-check Duplicates"}
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          {successMsg}{" "}
          <Link href="/dashboard/investigations" className="font-semibold underline">
            View Investigations →
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle size={15} className="shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-dashboard-muted">
          <Loader2 size={16} className="animate-spin text-dashboard-navy" />
          Scanning multilingual embeddings and sanction records for duplicates…
        </div>
      )}

      {/* Empty State */}
      {!loading && matches.length === 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-dashboard-line bg-dashboard-surface/50 p-6 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
          <h3 className="mt-2 text-sm font-semibold text-dashboard-ink">
            No Duplicate Sanctions Flagged
          </h3>
          <p className="mt-1 text-xs text-dashboard-muted max-w-md mx-auto">
            This project was cross-referenced across same-district sanctions, phonetic titles,
            semantic vector embeddings, and contractor allocations. No suspicious duplication was detected.
          </p>
        </div>
      )}

      {/* Matches List */}
      {!loading && matches.length > 0 && (
        <div className="mt-4 space-y-4">
          {matches.map((m) => {
            const isSource = m.source_project.id === projectId;
            const otherProject = isSource ? m.matched_project : m.source_project;
            const verdictStyle = VERDICT_STYLES[m.verdict] ?? {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-200",
              label: m.verdict,
            };

            return (
              <div
                key={m.id}
                className="overflow-hidden rounded-lg border border-dashboard-line bg-white shadow-xs hover:border-dashboard-navy/40 transition"
              >
                {/* Top strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashboard-line/50 bg-dashboard-surface/40 px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.border}`}
                    >
                      {verdictStyle.label}
                    </span>
                    <ConfidenceMeter value={m.match_confidence} />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMatch(m)}
                      className="inline-flex items-center gap-1.5 rounded border border-dashboard-navy bg-white px-2.5 py-1 text-xs font-bold text-dashboard-navy hover:bg-dashboard-navy hover:text-white transition shadow-2xs"
                    >
                      <GitCompare size={13} />
                      Compare Side-by-Side
                    </button>
                    <Link
                      href={`/dashboard/projects/${otherProject.id}`}
                      className="inline-flex items-center gap-1 rounded border border-dashboard-line bg-white px-2 py-1 text-xs font-semibold text-dashboard-muted hover:text-dashboard-ink hover:bg-dashboard-surface transition"
                    >
                      <span>Open Matched Project</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Current Project */}
                  <div className="md:col-span-5 rounded-md border border-dashboard-line/70 bg-dashboard-surface/20 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                      This Project
                    </div>
                    <div className="mt-1 font-semibold text-sm text-dashboard-ink truncate" title={projectName}>
                      {projectName}
                    </div>
                    <div className="mt-1 text-xs text-dashboard-muted">
                      Budget: {formatInr(isSource ? m.source_project.sanctioned_amount : m.matched_project.sanctioned_amount)}
                    </div>
                  </div>

                  {/* Middle Arrow / Discrepancy Overview */}
                  <div className="md:col-span-2 text-center flex flex-col items-center justify-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-dashboard-surface text-dashboard-muted">
                      <ArrowRight size={15} />
                    </div>
                    <div className="mt-1 font-mono text-[11px] font-bold text-rose-600">
                      Δ {formatInr(m.diff_metrics.amount_diff_inr)}
                    </div>
                    <div className="text-[10px] text-dashboard-muted">
                      ({m.diff_metrics.amount_diff_pct.toFixed(1)}% variance)
                    </div>
                  </div>

                  {/* Matched Project */}
                  <div className="md:col-span-5 rounded-md border border-rose-200/80 bg-rose-50/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                        Flagged Duplicate Project
                      </span>
                      <span className="text-[11px] font-mono text-dashboard-muted">
                        {otherProject.external_project_id}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/projects/${otherProject.id}`}
                      className="mt-1 block font-semibold text-sm text-dashboard-navy hover:underline truncate"
                      title={otherProject.project_name}
                    >
                      {otherProject.project_name}
                    </Link>
                    <div className="mt-1 text-xs text-dashboard-muted flex flex-wrap gap-x-3 gap-y-1">
                      <span>Budget: {formatInr(otherProject.sanctioned_amount)}</span>
                      <span>District: {otherProject.district}</span>
                    </div>
                  </div>
                </div>

                {/* Discrepancy Badges Bar */}
                <div className="border-t border-dashboard-line/50 bg-dashboard-surface/30 px-4 py-2 flex flex-wrap items-center gap-3 text-xs text-dashboard-muted">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-dashboard-ink">Sanction Gap:</span>{" "}
                    {m.diff_metrics.days_between_sanction} days
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-dashboard-muted" />
                    <span className="font-semibold text-dashboard-ink">Distance:</span>{" "}
                    {m.diff_metrics.distance_km !== null
                      ? `${m.diff_metrics.distance_km} km`
                      : otherProject.district}
                  </div>
                  {m.diff_metrics.same_contractor && (
                    <>
                      <span>·</span>
                      <span className="rounded bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 text-[10px]">
                        ⚠ Same Contractor: {otherProject.contractor_name || "Assigned"}
                      </span>
                    </>
                  )}
                  {m.diff_metrics.same_mp && (
                    <>
                      <span>·</span>
                      <span className="rounded bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 text-[10px]">
                        Same MP
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {selectedMatch && (
        <DuplicateComparisonDialog
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onInvestigate={user ? handleInvestigate : undefined}
        />
      )}
    </section>
  );
}
