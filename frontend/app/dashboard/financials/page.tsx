import { cookies } from "next/headers";

import { getFinancialsSummary } from "@/lib/api";

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export default async function FinancialsPage() {
  let data;
  let fetchError: string | null = null;
  try {
    const token = (await cookies()).get("mplads_token")?.value;
    data = await getFinancialsSummary(token);
  } catch {
    fetchError = "Something went wrong loading this page.";
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Financials</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Fund utilization pipeline: sanctioned → released → spent, computed live from every project record.
        </p>

        {fetchError && <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

        {data && (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-dashboard-muted">Total Sanctioned</div>
                <div className="text-2xl font-bold">{crore(data.total_sanctioned)}</div>
              </div>
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-dashboard-muted">Total Released</div>
                <div className="text-2xl font-bold">{crore(data.total_released)}</div>
                <div className="mt-1 text-xs text-dashboard-muted">{data.release_utilization_pct}% of sanctioned</div>
              </div>
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-dashboard-muted">Total Expenditure</div>
                <div className="text-2xl font-bold">{crore(data.total_expenditure)}</div>
                <div className="mt-1 text-xs text-dashboard-muted">{data.expenditure_utilization_pct}% of released</div>
              </div>
            </div>

            <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">By Project Type</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase text-dashboard-muted">
                      <th className="py-1.5">Type</th>
                      <th className="py-1.5">Projects</th>
                      <th className="py-1.5">Sanctioned</th>
                      <th className="py-1.5">Released</th>
                      <th className="py-1.5">Expenditure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_type.map((t) => (
                      <tr key={t.project_type} className="border-t border-dashboard-line/60">
                        <td className="py-1.5 font-semibold">{t.project_type.replace(/_/g, " ")}</td>
                        <td className="py-1.5 text-dashboard-muted">{t.project_count.toLocaleString()}</td>
                        <td className="py-1.5 text-dashboard-muted">{crore(t.sanctioned_amount)}</td>
                        <td className="py-1.5 text-dashboard-muted">{crore(t.released_amount)}</td>
                        <td className="py-1.5 text-dashboard-muted">{crore(t.expenditure_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
