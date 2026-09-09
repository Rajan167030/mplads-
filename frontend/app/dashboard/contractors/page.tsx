import Link from "next/link";
import { cookies } from "next/headers";

import { listContractors } from "@/lib/api";

export default async function ContractorsPage({
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
    result = await listContractors({ sort_by: "risk_score", limit, offset: page * limit, min_total_projects: 1 }, token);
  } catch {
    fetchError = "Something went wrong loading this page.";
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Contractor Intelligence</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          {result ? `${result.total.toLocaleString()} contractors` : "Loading…"} · aggregate stats computed from actual
          project and risk-signal data (see app.risk.contractor_intelligence)
        </p>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {result && (
          <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Contractor</th>
                  <th className="px-4 py-3">Total Projects</th>
                  <th className="px-4 py-3">Delayed</th>
                  <th className="px-4 py-3">High Risk</th>
                  <th className="px-4 py-3">Avg. Cost Overrun</th>
                  <th className="px-4 py-3">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((c) => (
                  <tr key={c.id} className="border-b border-dashboard-line/60 last:border-0 hover:bg-dashboard-surface">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/contractors/${c.id}`} className="font-semibold text-dashboard-navy hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-[11px] text-dashboard-muted">
                        {c.district ? `${c.district}, ${c.state}` : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.total_projects}</td>
                    <td className="px-4 py-3 text-dashboard-muted">
                      {c.delayed_projects} ({c.total_projects ? ((c.delayed_projects / c.total_projects) * 100).toFixed(0) : 0}%)
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">{c.high_risk_projects}</td>
                    <td className="px-4 py-3 text-dashboard-muted">
                      {c.average_cost_overrun !== null ? `${(c.average_cost_overrun * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-dashboard-surface px-2 py-0.5 text-[11px] font-bold">
                        {c.risk_score?.toFixed(0) ?? "—"}
                      </span>
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
                <Link href={`/dashboard/contractors?page=${page - 1}`} className="rounded border border-dashboard-line px-3 py-1.5 hover:bg-white">
                  Previous
                </Link>
              )}
              {(page + 1) * limit < result.total && (
                <Link href={`/dashboard/contractors?page=${page + 1}`} className="rounded border border-dashboard-line px-3 py-1.5 hover:bg-white">
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
