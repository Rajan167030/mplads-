import { cookies } from "next/headers";

import { RiskMap } from "@/components/dashboard/risk-map";
import { getMapFilterOptions, getRiskMap } from "@/lib/api";

const RISK_BANDS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default async function GeographicPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const state = params.state ?? "";
  const risk_band = params.risk_band ?? "";
  const project_type = params.project_type ?? "";

  let data;
  let filterOptions;
  let fetchError: string | null = null;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    [data, filterOptions] = await Promise.all([
      getRiskMap({ limit: 5000, state, risk_band, project_type }, token),
      getMapFilterOptions(token),
    ]);
  } catch {
    fetchError = "Something went wrong loading this page.";
  }

  const hasFilters = Boolean(state || risk_band || project_type);

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Geographical Analysis</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          {data ? `${data.features.length.toLocaleString()} geolocated projects` : "Loading…"} · colored by risk band ·
          click a point to open its project.
        </p>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {filterOptions && (
          <form className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm" action="/dashboard/geographic" method="get">
            <label className="text-xs font-semibold">
              State
              <select name="state" defaultValue={state} className="mt-1 block rounded border border-dashboard-line px-2 py-1.5 text-sm">
                <option value="">All states</option>
                {filterOptions.states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Risk band
              <select name="risk_band" defaultValue={risk_band} className="mt-1 block rounded border border-dashboard-line px-2 py-1.5 text-sm">
                <option value="">All bands</option>
                {RISK_BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold">
              Project type
              <select name="project_type" defaultValue={project_type} className="mt-1 block rounded border border-dashboard-line px-2 py-1.5 text-sm">
                <option value="">All types</option>
                {filterOptions.project_types.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded bg-dashboard-navy px-3 py-1.5 text-sm font-semibold text-white">
              Apply filters
            </button>
            {hasFilters && (
              <a href="/dashboard/geographic" className="text-xs font-semibold text-dashboard-muted underline">
                Clear
              </a>
            )}
          </form>
        )}

        {data && (
          <div className="mt-5 overflow-hidden rounded-lg bg-white shadow-sm">
            {data.features.length > 0 ? (
              <RiskMap data={data} />
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-dashboard-muted">
                No geolocated projects match these filters.
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-dashboard-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: "#bf1f26" }} /> Critical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: "#c96d00" }} /> High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: "#c9a800" }} /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: "#087a20" }} /> Low
          </span>
        </div>
      </div>
    </main>
  );
}
