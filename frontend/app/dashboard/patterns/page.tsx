import { cookies } from "next/headers";

import { PatternExplorer } from "@/components/patterns/pattern-explorer";
import { getPatternSummary } from "@/lib/api";

export default async function PatternsPage() {
  let data;
  let fetchError: string | null = null;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    data = await getPatternSummary(token);
  } catch {
    fetchError = "Something went wrong loading this page.";
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

        {data && <PatternExplorer patterns={data.patterns} />}
      </div>
    </main>
  );
}
