import { getPatternSummary } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  RULE: "Rule-based",
  ML: "ML-discovered",
  CORRELATED: "Multi-signal correlated",
};

export default async function PatternsPage() {
  let data;
  let fetchError: string | null = null;
  try {
    data = await getPatternSummary();
  } catch {
    fetchError = "Could not reach the backend API.";
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Pattern Intelligence</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          {data ? `${data.total_signals.toLocaleString()} total signals across ${data.patterns.length} pattern types` : "Loading…"} —
          the UI distinguishes rule-based signals, ML-discovered anomalies, and correlated multi-signal cases (spec §26).
        </p>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {data && (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.patterns.map((p) => (
              <div key={`${p.signal_type}-${p.source}`} className="rounded-lg bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-dashboard-blue-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dashboard-navy">
                    {SOURCE_LABELS[p.source] ?? p.source}
                  </span>
                  <span className="text-2xl font-bold">{p.count.toLocaleString()}</span>
                </div>
                <h2 className="mt-3 font-display text-base font-semibold">{p.signal_type.replace(/_/g, " ")}</h2>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
