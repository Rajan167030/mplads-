"use client";

import { Building2, CheckCircle2, ChevronRight, Clock, FileWarning, Landmark, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { listProjects, type ProjectListItem } from "@/lib/api";
import { filterDemoProjects, isNetworkError } from "@/lib/demo-data";

function crore(amount: number) {
  if (!amount) return "₹0.00";
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  COMPLETED: { label: "Completed", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  ONGOING: { label: "In Progress", bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  DELAYED: { label: "Delayed", bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  SANCTIONED: { label: "Sanctioned", bg: "bg-purple-50 border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
};

export function AreaSearch({ states }: { states: string[] }) {
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [results, setResults] = useState<ProjectListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!state && !district) {
      setError("Please select a state or enter a district name to search.");
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const res = await listProjects({
        state: state || undefined,
        district: district || undefined,
        limit: 16,
        sort_by: "sanctioned_amount",
      });
      setResults(res.items);
      setTotal(res.total);
    } catch (err) {
      if (isNetworkError(err)) {
        const res = filterDemoProjects({
          state: state || undefined,
          district: district || undefined,
          limit: 16,
        });
        setResults(res.items);
        setTotal(res.total);
      } else {
        setError("Unable to connect to the database. Showing offline preview.");
        const res = filterDemoProjects({
          state: state || undefined,
          district: district || undefined,
          limit: 16,
        });
        setResults(res.items);
        setTotal(res.total);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredResults = results?.filter((p) => {
    if (statusFilter === "ALL") return true;
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          <div className="relative sm:col-span-4">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">State / UT</label>
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

          <div className="relative sm:col-span-5">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">District / City</label>
            <div className="relative">
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Jaunpur, Varanasi, Pune..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-dashboard-navy focus:outline-none focus:ring-2 focus:ring-dashboard-navy/10"
              />
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
            </div>
          </div>

          <div className="sm:col-span-3 sm:self-end">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-dashboard-navy to-dashboard-blue px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-dashboard-navy/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            >
              <Search size={16} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Searching..." : "Search Area"}</span>
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-3 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">Quick search:</span>
          {["Uttar Pradesh", "Maharashtra", "Tamil Nadu", "Bihar", "Rajasthan"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setState(s);
                setTimeout(() => handleSearch(), 50);
              }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-medium text-slate-700 transition hover:border-dashboard-navy/40 hover:bg-slate-100"
            >
              {s}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {searched && !loading && (
        <div>
          {/* Result Filter Tabs & Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {total.toLocaleString()} Monitored Works Found
              </h3>
              <p className="text-xs text-slate-500">
                {state ? `in ${state}` : "across India"} {district ? `• District: ${district}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
              {[
                { id: "ALL", label: "All" },
                { id: "COMPLETED", label: "Completed" },
                { id: "ONGOING", label: "In Progress" },
                { id: "DELAYED", label: "Delayed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    statusFilter === tab.id
                      ? "bg-white text-dashboard-navy shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {filteredResults && filteredResults.length > 0 ? (
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              {filteredResults.map((p) => {
                const conf = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.SANCTIONED;
                const progressPct = Math.min(Math.max(p.physical_progress ?? 0, 0), 100);

                return (
                  <div
                    key={p.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      {/* Top bar with location & status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <MapPin size={13} className="shrink-0 text-dashboard-navy" />
                          <span>{p.district}, {p.state}</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${conf.bg} ${conf.text}`}
                        >
                          <span className={`size-1.5 rounded-full ${conf.dot}`} />
                          {conf.label}
                        </span>
                      </div>

                      {/* Project Name */}
                      <h4 className="mt-2 text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-dashboard-navy">
                        {p.project_name}
                      </h4>

                      {/* Reference code */}
                      <div className="mt-1 font-mono text-[10px] text-slate-400">
                        ID: {p.external_project_id || p.id.slice(0, 12)}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      {/* Financials & Progress bar */}
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-500">Sanctioned:</span>
                        <span className="font-mono font-bold text-slate-900">{crore(p.sanctioned_amount)}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Physical Progress:</span>
                          <span className="font-bold text-slate-800">{progressPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPct >= 100
                                ? "bg-emerald-500"
                                : progressPct > 50
                                ? "bg-blue-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Links */}
                      <div className="mt-3.5 flex items-center justify-between pt-1 text-xs">
                        <Link
                          href={`/complaint/${p.id}`}
                          className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 hover:underline"
                        >
                          <FileWarning size={13} />
                          Report Concern
                        </Link>

                        <span className="text-[11px] font-medium text-slate-400">
                          {p.project_type?.replace(/_/g, " ") || "Public Infrastructure"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-10 text-center">
              <Building2 size={32} className="mx-auto text-slate-400" />
              <p className="mt-2 text-sm font-bold text-slate-700">No works matching &quot;{statusFilter}&quot; in this area</p>
              <p className="mt-1 text-xs text-slate-500">Try switching to &quot;All&quot; status or searching another district.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
