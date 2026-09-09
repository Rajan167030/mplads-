import Link from "next/link";
import { cookies } from "next/headers";

import { getRiskSummary, getTopRiskProjects } from "@/lib/api";

const BAND_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function RiskAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const band = params.band;

  let projects;
  let summary;
  let fetchError: string | null = null;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    [projects, summary] = await Promise.all([
      getTopRiskProjects({ band, limit: 50 }, token),
      getRiskSummary(token),
    ]);
  } catch {
    fetchError = "Could not reach the backend API, or you need to sign in to view risk alerts.";
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Risk &amp; Alerts</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Highest-priority projects by combined risk score (Phase 6) — rules, ML, and correlated signals together.
        </p>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {summary && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((b) => (
              <Link
                key={b}
                href={`/dashboard/risk-alerts?band=${b}`}
                className={`rounded border px-3 py-1.5 text-xs font-bold ${band === b ? "ring-2 ring-dashboard-navy" : ""} ${BAND_STYLES[b]}`}
              >
                {b}: {(summary.band_counts[b] ?? 0).toLocaleString()}
              </Link>
            ))}
            {band && (
              <Link href="/dashboard/risk-alerts" className="rounded border border-dashboard-line px-3 py-1.5 text-xs text-dashboard-muted">
                Clear filter
              </Link>
            )}
          </div>
        )}

        {projects && (
          <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-dashboard-line/60 last:border-0 hover:bg-dashboard-surface">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/projects/${p.id}`} className="font-semibold text-dashboard-navy hover:underline">
                        {p.project_name}
                      </Link>
                      <div className="text-[11px] text-dashboard-muted">{p.external_project_id}</div>
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">
                      {p.district}, {p.state}
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">{p.project_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-dashboard-muted">{p.status}</td>
                    <td className="px-4 py-3">
                      {p.risk_band && (
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${BAND_STYLES[p.risk_band] ?? ""}`}>
                          {p.risk_band} · {p.risk_score?.toFixed(0)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
