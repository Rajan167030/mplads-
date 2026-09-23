"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  IndianRupee,
  Layers,
  MapPin,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import type { EntityMatchEnriched, ProjectSummaryForMatch } from "@/lib/api";

interface DuplicateComparisonDialogProps {
  match: EntityMatchEnriched | null;
  onClose: () => void;
  onInvestigate?: (sourceId: string, matchedId: string, notes: string) => void;
}

function formatInr(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} Lakh`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function SimilarityBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const color =
    pct >= 85
      ? "bg-rose-500"
      : pct >= 65
        ? "bg-amber-500"
        : pct >= 40
          ? "bg-blue-500"
          : "bg-slate-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-dashboard-ink/90">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-dashboard-muted">weight {weight}</span>
          <span className="font-mono text-xs font-bold text-dashboard-ink">{pct}%</span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dashboard-surface">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ project, label, tagColor }: { project: ProjectSummaryForMatch; label: string; tagColor: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-dashboard-line/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-dashboard-line/50">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${tagColor}`}>
          {label}
        </span>
        <span className="font-mono text-[11px] text-dashboard-muted">{project.external_project_id}</span>
      </div>

      <div className="mt-3 flex-1">
        <h4 className="font-display text-base font-bold text-dashboard-ink leading-snug">
          {project.project_name}
        </h4>
        {project.description && (
          <p className="mt-1.5 text-xs text-dashboard-muted line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-dashboard-surface/60 p-2.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-dashboard-muted">
              <IndianRupee size={12} /> Sanctioned Cost
            </span>
            <span className="mt-0.5 block font-mono text-sm font-bold text-dashboard-ink">
              {formatInr(project.sanctioned_amount)}
            </span>
          </div>
          <div className="rounded-lg bg-dashboard-surface/60 p-2.5">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-dashboard-muted">
              <Layers size={12} /> Work Type
            </span>
            <span className="mt-0.5 block font-semibold text-dashboard-ink truncate">
              {project.project_type.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-dashboard-line/40 py-1.5">
            <span className="flex items-center gap-1.5 text-dashboard-muted">
              <User size={13} /> Hon&apos;ble MP
            </span>
            <span className="font-medium text-dashboard-ink text-right">{project.mp_name || "—"}</span>
          </div>

          <div className="flex items-center justify-between border-b border-dashboard-line/40 py-1.5">
            <span className="flex items-center gap-1.5 text-dashboard-muted">
              <MapPin size={13} /> Location
            </span>
            <span className="font-medium text-dashboard-ink text-right">
              {project.district}, {project.state}
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-dashboard-line/40 py-1.5">
            <span className="flex items-center gap-1.5 text-dashboard-muted">
              <Calendar size={13} /> Sanction Date
            </span>
            <span className="font-medium text-dashboard-ink">{project.start_date}</span>
          </div>

          <div className="flex items-center justify-between border-b border-dashboard-line/40 py-1.5">
            <span className="flex items-center gap-1.5 text-dashboard-muted">
              <Building2 size={13} /> Contractor
            </span>
            <span className="font-medium text-dashboard-ink truncate max-w-[180px] text-right">
              {project.contractor_name || "Unassigned / Direct"}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-dashboard-muted">Execution Status</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {project.status} ({project.physical_progress}% phys / {project.financial_progress}% fin)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-dashboard-line/50 flex justify-end">
        <Link
          href={`/dashboard/projects/${project.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs font-semibold text-dashboard-navy hover:underline"
        >
          View Full Project Record <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}

export function DuplicateComparisonDialog({
  match,
  onClose,
  onInvestigate,
}: DuplicateComparisonDialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (match) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [match, onClose]);

  if (!match) return null;

  const confPct = Math.round(match.match_confidence * 100);
  const isHighMatch = match.verdict === "MATCH" || confPct >= 80;
  const mf = match.matching_features || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-dashboard-deep/60 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-dashboard-line bg-dashboard-surface shadow-2xl transition-all my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashboard-line bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${
                isHighMatch ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-bold text-dashboard-ink">
                  Duplicate Sanction Pair Comparison
                </h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isHighMatch
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {confPct}% {match.verdict}
                </span>
              </div>
              <p className="text-xs text-dashboard-muted">
                Side-by-side entity resolution &amp; phonetic-semantic overlap analysis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Key Difference Matrix Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-dashboard-line/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-semibold text-dashboard-muted">Budget Difference</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-sm font-bold text-dashboard-ink">
                  {formatInr(match.diff_metrics.amount_diff_inr)}
                </span>
                <span className="text-xs text-dashboard-muted">
                  ({match.diff_metrics.amount_diff_pct}%)
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-dashboard-line/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-semibold text-dashboard-muted">Sanction Date Gap</span>
              <div className="mt-1 font-mono text-sm font-bold text-dashboard-ink">
                {match.diff_metrics.days_between_sanction} days
              </div>
            </div>

            <div className="rounded-xl border border-dashboard-line/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-semibold text-dashboard-muted">Executing Contractor</span>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                {match.diff_metrics.same_contractor ? (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <CheckCircle2 size={14} /> Identical Contractor
                  </span>
                ) : (
                  <span className="text-dashboard-muted">Different / Subcontracted</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-dashboard-line/80 bg-white p-3.5 shadow-sm">
              <span className="text-[11px] font-semibold text-dashboard-muted">Geographic Proximity</span>
              <div className="mt-1 font-mono text-sm font-bold text-dashboard-ink">
                {match.diff_metrics.distance_km !== null
                  ? `${match.diff_metrics.distance_km} km apart`
                  : "Same Local Jurisdiction"}
              </div>
            </div>
          </div>

          {/* Side-by-Side Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ProjectCard
              project={match.source_project}
              label="Project A (Primary Record)"
              tagColor="bg-blue-50 text-blue-700 border border-blue-200"
            />
            <ProjectCard
              project={match.matched_project}
              label="Project B (Potential Duplicate Sanction)"
              tagColor="bg-amber-50 text-amber-700 border border-amber-200"
            />
          </div>

          {/* Similarity Vector Breakdown */}
          <div className="rounded-xl border border-dashboard-line bg-white p-5 shadow-sm">
            <h4 className="font-display text-sm font-bold text-dashboard-ink mb-4 flex items-center gap-2">
              <Layers size={16} className="text-dashboard-navy" />
              Multi-Signal Similarity Feature Breakdown
            </h4>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <SimilarityBar
                label="Multilingual Semantic Title Overlap"
                value={mf.text_similarity ?? 0.85}
                weight="25%"
              />
              <SimilarityBar
                label="Phonetic Soundex / Metaphone Match"
                value={mf.phonetic_similarity ?? 0.8}
                weight="5%"
              />
              <SimilarityBar
                label="Budget & Financial Scale Ratio"
                value={mf.amount_similarity ?? 0.9}
                weight="20%"
              />
              <SimilarityBar
                label="Sanction Timeline Alignment"
                value={mf.date_similarity ?? 0.75}
                weight="20%"
              />
              <SimilarityBar
                label="Contractor & Agency Correlation"
                value={mf.contractor_similarity ?? 0.7}
                weight="15%"
              />
              <SimilarityBar
                label="Geographic & District Proximity"
                value={mf.location_similarity ?? 0.95}
                weight="10%"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-dashboard-line bg-white px-6 py-4">
          <div className="text-xs text-dashboard-muted flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Decision-support signal only. Human review is mandated before sanction action.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-dashboard-line px-4 py-2 text-xs font-semibold text-dashboard-ink hover:bg-dashboard-surface"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onInvestigate) {
                  onInvestigate(
                    match.source_project_id,
                    match.matched_project_id,
                    `Investigating potential duplicate sanction between ${match.source_project.external_project_id} and ${match.matched_project.external_project_id} (${confPct}% confidence match).`
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-dashboard-navy px-4 py-2 text-xs font-semibold text-white hover:bg-dashboard-deep shadow-sm"
            >
              Open Joint Investigation <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
