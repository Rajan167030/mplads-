import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ApiError, getContractor } from "@/lib/api";

export default async function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    detail = await getContractor(id, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 401) {
      return (
        <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1400px]">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Link href="/" className="font-semibold underline">
                Sign in
              </Link>{" "}
              to view contractor intelligence — this view requires an authenticated official account.
            </div>
          </div>
        </main>
      );
    }
    throw err;
  }

  const { contractor, projects } = detail;

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Link href="/dashboard/contractors" className="text-xs font-semibold text-dashboard-navy hover:underline">
          ← Back to Contractors
        </Link>

        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">{contractor.name}</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          {contractor.district ? `${contractor.district}, ${contractor.state}` : "Location unknown"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg bg-white p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">Total Projects</div>
            <div className="text-lg font-bold">{contractor.total_projects}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">Completed</div>
            <div className="text-lg font-bold">{contractor.completed_projects}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">Delayed</div>
            <div className="text-lg font-bold">{contractor.delayed_projects}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">High Risk</div>
            <div className="text-lg font-bold">{contractor.high_risk_projects}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">Avg. Cost Overrun</div>
            <div className="text-lg font-bold">
              {contractor.average_cost_overrun !== null ? `${(contractor.average_cost_overrun * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-dashboard-muted">Risk Score</div>
            <div className="text-lg font-bold">{contractor.risk_score?.toFixed(0) ?? "—"}</div>
          </div>
        </div>

        <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Project Portfolio</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase text-dashboard-muted">
                  <th className="py-1.5">Project</th>
                  <th className="py-1.5">Location</th>
                  <th className="py-1.5">Status</th>
                  <th className="py-1.5">Sanctioned</th>
                  <th className="py-1.5">Risk</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-dashboard-line/60">
                    <td className="py-1.5">
                      <Link href={`/dashboard/projects/${p.id}`} className="font-semibold text-dashboard-navy hover:underline">
                        {p.project_name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-dashboard-muted">
                      {p.district}, {p.state}
                    </td>
                    <td className="py-1.5 text-dashboard-muted">{p.status}</td>
                    <td className="py-1.5 text-dashboard-muted">₹{(p.sanctioned_amount / 100000).toFixed(1)}L</td>
                    <td className="py-1.5">
                      {p.risk_band ? (
                        <span className="rounded bg-dashboard-surface px-2 py-0.5 text-[10px] font-bold">
                          {p.risk_band} · {p.risk_score?.toFixed(0)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
