"use client";

import { AlertTriangle, ArrowUpRight, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getRiskSignals, type PatternSummary, type RiskSignalListItem } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  RULE: "Rule-based",
  ML: "ML-discovered",
  CORRELATED: "Multi-signal correlated",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#bf1f26",
  HIGH: "#c96d00",
  MEDIUM: "#c9a800",
  LOW: "#087a20",
};

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const DRILLDOWN_LIMIT = 50;

function severityCounts(signals: RiskSignalListItem[]) {
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const s of signals) counts[s.severity] = (counts[s.severity] ?? 0) + 1;
  return counts;
}

function SignalCard({ signal }: { signal: RiskSignalListItem }) {
  return (
    <a
      href={`/dashboard/projects/${signal.project_id}`}
      className="group block rounded-lg border border-dashboard-line bg-white p-3.5 transition hover:border-dashboard-navy hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: SEVERITY_COLORS[signal.severity] ?? "#68768a" }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wide text-dashboard-muted">{signal.severity}</span>
        </div>
        <span className="shrink-0 font-mono text-xs font-bold text-dashboard-ink">{signal.score.toFixed(0)}/100</span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-dashboard-ink group-hover:text-dashboard-navy">
        {signal.project.project_name}
        <ArrowUpRight size={13} className="shrink-0 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="text-[11px] text-dashboard-muted">
        {signal.project.district}, {signal.project.state} · {signal.project.external_project_id}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-dashboard-ink/80">{signal.description}</p>
    </a>
  );
}

function DrawerBody({ pattern }: { pattern: PatternSummary }) {
  const [signals, setSignals] = useState<RiskSignalListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSignals(null);
    setError(null);
    getRiskSignals({ signal_type: pattern.signal_type, source: pattern.source, limit: DRILLDOWN_LIMIT })
      .then((res) => {
        if (!cancelled) setSignals(res);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load signals for this pattern.");
      });
    return () => {
      cancelled = true;
    };
  }, [pattern.signal_type, pattern.source]);

  if (error) return <p className="p-5 text-sm text-red-600">{error}</p>;

  if (!signals) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-dashboard-muted">
        <Loader2 size={16} className="animate-spin" /> Loading signals…
      </div>
    );
  }

  const counts = severityCounts(signals);
  const shownOfTotal = pattern.count > signals.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-1.5 border-b border-dashboard-line px-5 py-3.5">
        {SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((sev) => (
          <span
            key={sev}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: `${SEVERITY_COLORS[sev]}18`, color: SEVERITY_COLORS[sev] }}
          >
            {counts[sev]} {sev}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {signals.length === 0 ? (
          <p className="py-10 text-center text-sm text-dashboard-muted">No signals found.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </div>

      {shownOfTotal && (
        <div className="shrink-0 border-t border-dashboard-line px-5 py-2.5 text-center text-[11px] text-dashboard-muted">
          Showing the {signals.length} highest-scored of {pattern.count.toLocaleString()} total — refine with filters on
          the Risk &amp; Alerts page for the full set.
        </div>
      )}
    </div>
  );
}

export function PatternExplorer({ patterns }: { patterns: PatternSummary[] }) {
  const [selected, setSelected] = useState<PatternSummary | null>(null);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {patterns.map((p) => (
          <button
            key={`${p.signal_type}-${p.source}`}
            onClick={() => setSelected(p)}
            className="group rounded-lg bg-white p-5 text-left shadow-sm ring-dashboard-navy transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-dashboard-blue-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-navy">
                {SOURCE_LABELS[p.source] ?? p.source}
              </span>
              <span className="text-2xl font-bold">{p.count.toLocaleString()}</span>
            </div>
            <h2 className="mt-3 flex items-center gap-1.5 font-display text-base font-semibold">
              {p.signal_type.replace(/_/g, " ")}
              <ArrowUpRight size={14} className="shrink-0 text-dashboard-muted opacity-0 transition group-hover:opacity-100" />
            </h2>
            <p className="mt-1 text-xs text-dashboard-muted">Average score: {p.average_score.toFixed(1)}/100</p>
            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase text-dashboard-muted">Top affected states</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {p.top_states.map((s) => (
                  <span key={s} className="rounded bg-dashboard-surface px-2 py-0.5 text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 text-[10px] font-semibold text-dashboard-navy opacity-0 transition group-hover:opacity-100">
              Click to view flagged projects →
            </div>
          </button>
        ))}
      </div>

      {/* Slide-over drill-down */}
      <div
        aria-hidden={!selected}
        className={`fixed inset-0 z-50 transition ${selected ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div
          onClick={() => setSelected(null)}
          className={`absolute inset-0 bg-dashboard-deep/40 backdrop-blur-[1px] transition-opacity ${
            selected ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-dashboard-surface shadow-2xl transition-transform duration-300 ${
            selected ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {selected && (
            <>
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-dashboard-line bg-white px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-dashboard-navy" />
                    <span className="rounded bg-dashboard-blue-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-navy">
                      {SOURCE_LABELS[selected.source] ?? selected.source}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold">{selected.signal_type.replace(/_/g, " ")}</h3>
                  <p className="mt-0.5 text-xs text-dashboard-muted">
                    {selected.count.toLocaleString()} signals · avg score {selected.average_score.toFixed(1)}/100
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="shrink-0 rounded-full p-1.5 text-dashboard-muted hover:bg-dashboard-surface hover:text-dashboard-ink"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <DrawerBody pattern={selected} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
