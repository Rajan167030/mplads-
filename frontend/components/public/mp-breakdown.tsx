"use client";

import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";

import { getFinancialsByMp, type FinancialsByMp, type FinancialsByMpResult } from "@/lib/api";
import { demoFinancialsByMp, isNetworkError } from "@/lib/demo-data";

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export function MpBreakdown({ states, initial }: { states: string[]; initial: FinancialsByMpResult | null }) {
  const [state, setState] = useState("");
  const [result, setResult] = useState<FinancialsByMpResult | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFinancialsByMp(state || undefined)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNetworkError(err)) setResult(demoFinancialsByMp(state || undefined));
        else setError("Something went wrong. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const rows: FinancialsByMp[] = result?.by_mp ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {result ? (
            <>
              MP attribution is present for{" "}
              <span className="font-semibold text-slate-700">
                {result.attributed_projects.toLocaleString()} of {result.total_projects.toLocaleString()} projects
              </span>{" "}
              ({result.attribution_coverage_pct}%) {state ? "in this state" : "nationwide"} — the rest predate this
              field being captured at source. Ranked by number of works sanctioned.
            </>
          ) : (
            "Loading MP attribution coverage…"
          )}
        </p>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-dashboard-navy focus:outline-none sm:w-56"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 text-xs font-medium text-red-600">{error}</p>}

      <div className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${loading ? "opacity-50" : ""}`}>
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
            <tr>
              {["Member of Parliament", "Constituency", "State", "Works Sanctioned", "Sanctioned Amount"].map((h) => (
                <th key={h} className="px-3 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 50).map((row) => (
              <tr key={`${row.state}-${row.constituency}-${row.mp_name}`} className="hover:bg-blue-50/40">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Landmark size={13} className="shrink-0 text-dashboard-navy" />
                    {row.mp_name}
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-slate-600">{row.constituency ?? "—"}</td>
                <td className="px-3 py-3 font-medium text-slate-600">{row.state}</td>
                <td className="px-3 py-3 font-mono font-bold">{row.project_count.toLocaleString()}</td>
                <td className="px-3 py-3 font-mono font-bold">{crore(row.sanctioned_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500">No MP-attributed projects found for this selection.</div>
        )}
        {rows.length > 50 && (
          <div className="border-t border-slate-100 py-2.5 text-center text-[11px] text-slate-400">
            Showing the top 50 of {rows.length} MPs by works sanctioned{state ? "" : " — pick a state to narrow the list"}.
          </div>
        )}
      </div>
    </div>
  );
}
