"use client";

import { MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { listProjects, type ProjectListItem } from "@/lib/api";

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ONGOING: "bg-blue-50 text-blue-700",
  DELAYED: "bg-amber-50 text-amber-700",
  SANCTIONED: "bg-slate-100 text-slate-700",
};

export function AreaSearch({ states }: { states: string[] }) {
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [results, setResults] = useState<ProjectListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!state && !district) {
      setError("Select a state or enter a district to search.");
      return;
    }
    setError(null);
    setLoading(true);
    setSearched(true);
    try {
      const res = await listProjects({ state: state || undefined, district: district || undefined, limit: 12, sort_by: "sanctioned_amount" });
      setResults(res.items);
      setTotal(res.total);
    } catch {
      setError("Could not reach the backend API right now — try again shortly.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
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
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder="District (optional)"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-dashboard-navy focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-dashboard-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-60"
        >
          <Search size={16} />
          {loading ? "Searching…" : "Find Projects"}
        </button>
      </form>

      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      {searched && !error && !loading && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500">
            {total.toLocaleString()} project{total === 1 ? "" : "s"} found
            {state ? ` in ${state}` : ""}
            {district ? `, ${district}` : ""}
          </p>
          {results && results.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {results.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-dashboard-navy" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-900">{p.project_name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {p.district}, {p.state} · {crore(p.sanctioned_amount)}
                    </div>
                    <Link href={`/complaint/${p.id}`} className="mt-1 inline-block text-[10px] font-bold text-red-600 hover:underline">
                      Report an issue
                    </Link>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLES[p.status] ?? "bg-slate-100"}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            results && <p className="mt-3 text-sm text-slate-500">No monitored projects found for this area yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
