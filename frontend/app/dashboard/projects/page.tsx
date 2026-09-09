import Link from "next/link";
import { cookies } from "next/headers";

import { listProjects } from "@/lib/api";

const RISK_BAND_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function RiskBadge({ band, score }: { band: string | null; score: number | null }) {
  if (!band || score === null) return <span className="text-xs text-dashboard-muted">Not scored</span>;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold ${RISK_BAND_STYLES[band] ?? ""}`}>
      {band} · {score.toFixed(0)}
    </span>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "0");
  const limit = 25;

  let result;
  let fetchError: string | null = null;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    result = await listProjects(
      {
        state: params.state,
        district: params.district,
        project_type: params.project_type,
        status: params.status,
        risk_band: params.risk_band,
        search: params.search,
        sort_by: (params.sort_by as "risk_score" | "sanctioned_amount" | "start_date") ?? "risk_score",
        limit,
        offset: page * limit,
      },
      token
    );
  } catch {
    fetchError = "Something went wrong loading this page.";
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
            <p className="mt-1 text-sm text-dashboard-muted">
              {result ? `${result.total.toLocaleString()} projects` : "Loading…"} · sorted by risk score
            </p>
          </div>
          <form className="flex flex-wrap gap-2" action="/dashboard/projects" method="get">
            <input
              name="search"
              defaultValue={params.search}
              placeholder="Search name or ID…"
              className="rounded border border-dashboard-line bg-white px-3 py-1.5 text-sm outline-none focus:border-dashboard-navy"
            />
            <select
              name="risk_band"
              defaultValue={params.risk_band ?? ""}
              className="rounded border border-dashboard-line bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All risk bands</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded border border-dashboard-line bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All statuses</option>
              <option value="ONGOING">Ongoing</option>
              <option value="DELAYED">Delayed</option>
              <option value="COMPLETED">Completed</option>
              <option value="SANCTIONED">Sanctioned</option>
            </select>
            <button type="submit" className="rounded bg-dashboard-navy px-3 py-1.5 text-sm font-semibold text-white">
              Filter
            </button>
          </form>
        </div>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {result && (
          <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Contractor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Sanctioned</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
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
                    <td className="px-4 py-3 text-dashboard-muted">{p.contractor_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-dashboard-surface px-2 py-0.5 text-[11px] font-semibold">{p.status}</span>
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">
                      {p.physical_progress.toFixed(0)}% / {p.financial_progress.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">₹{(p.sanctioned_amount / 100000).toFixed(1)}L</td>
                    <td className="px-4 py-3">
                      <RiskBadge band={p.risk_band} score={p.risk_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && result.total > limit && (
          <div className="mt-4 flex items-center justify-between text-sm text-dashboard-muted">
            <span>
              Page {page + 1} of {Math.ceil(result.total / limit)}
            </span>
            <div className="flex gap-2">
              {page > 0 && (
                <Link
                  href={{ pathname: "/dashboard/projects", query: { ...params, page: page - 1 } }}
                  className="rounded border border-dashboard-line px-3 py-1.5 hover:bg-white"
                >
                  Previous
                </Link>
              )}
              {(page + 1) * limit < result.total && (
                <Link
                  href={{ pathname: "/dashboard/projects", query: { ...params, page: page + 1 } }}
                  className="rounded border border-dashboard-line px-3 py-1.5 hover:bg-white"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
