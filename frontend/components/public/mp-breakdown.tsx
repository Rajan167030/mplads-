"use client";

import { Award, ChevronDown, Landmark, MapPin, Search, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getFinancialsByMp, type FinancialsByMp, type FinancialsByMpResult } from "@/lib/api";
import { demoFinancialsByMp, isNetworkError } from "@/lib/demo-data";

function crore(amount: number) {
  if (!amount) return "₹0.00";
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export function MpBreakdown({ states, initial }: { states: string[]; initial: FinancialsByMpResult | null }) {
  const [state, setState] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
        else setError("Unable to fetch live MP data. Showing cached overview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const rawRows: FinancialsByMp[] = result?.by_mp ?? [];

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rawRows;
    const q = searchQuery.toLowerCase();
    return rawRows.filter(
      (r) =>
        r.mp_name.toLowerCase().includes(q) ||
        (r.constituency && r.constituency.toLowerCase().includes(q)) ||
        r.state.toLowerCase().includes(q)
    );
  }, [rawRows, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search & State Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4">
        <div className="relative flex-1">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MP Name or Constituency (e.g. Jaunpur, Varanasi)..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-dashboard-navy focus:outline-none focus:ring-2 focus:ring-dashboard-navy/10"
          />
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        </div>

        <div className="flex items-center gap-2 sm:w-64">
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all focus:border-dashboard-navy focus:outline-none focus:ring-2 focus:ring-dashboard-navy/10"
          >
            <option value="">All States &amp; UTs</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          {error}
        </div>
      )}

      {/* Coverage Banner */}
      {result && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <UserCheck size={15} className="text-dashboard-navy" />
            <span>
              Tracking{" "}
              <strong className="text-slate-900">{result.attributed_projects.toLocaleString()}</strong> MP-attributed works ({result.attribution_coverage_pct}% coverage)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Ranked by total works recommended &amp; approved
          </span>
        </div>
      )}

      {/* MP Table / Grid */}
      <div
        className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-opacity ${
          loading ? "opacity-50" : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Rank &amp; MP Details</th>
                <th className="px-4 py-3">Constituency</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Works Sanctioned</th>
                <th className="px-4 py-3 text-right">Total Sanctioned Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.slice(0, 40).map((row, idx) => {
                const isTop3 = idx < 3 && !searchQuery;
                return (
                  <tr
                    key={`${row.state}-${row.constituency}-${row.mp_name}`}
                    className="group transition-colors hover:bg-blue-50/30"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isTop3
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-dashboard-navy">
                            {row.mp_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            Member of Parliament
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {row.constituency ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-600">
                      {row.state}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">
                        {row.project_count.toLocaleString()} works
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-dashboard-navy">
                      <span className="text-sm">{crore(row.sanctioned_amount)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && filteredRows.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500">
            <Landmark size={28} className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm font-bold text-slate-700">No matching Members of Parliament found</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search query or state selector.</p>
          </div>
        )}

        {filteredRows.length > 40 && (
          <div className="border-t border-slate-100 bg-slate-50/50 py-3 text-center text-xs text-slate-500">
            Showing top 40 results. Use the search bar above to find a specific MP or Constituency.
          </div>
        )}
      </div>
    </div>
  );
}
