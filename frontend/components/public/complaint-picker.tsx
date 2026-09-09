"use client";

import { AlertTriangle, Loader2, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getNearbyProjects, listProjects, type NearbyProjectItem, type ProjectListItem } from "@/lib/api";

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export function ComplaintPicker() {
  const [nearby, setNearby] = useState<NearbyProjectItem[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectListItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("This browser doesn't support location access — search for your project below instead.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await getNearbyProjects(position.coords.latitude, position.coords.longitude, 6);
          setNearby(res.projects);
        } catch {
          setLocationError("Could not reach the backend API right now — try again shortly.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — search for your project below instead."
            : "Could not get your location — search for your project below instead."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await listProjects({ search: query.trim(), limit: 8, sort_by: "sanctioned_amount" });
      setSearchResults(res.items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs text-slate-500">
          First, tell us which project you&apos;re reporting a concern about. If you&apos;re standing near the site,
          use your location to find it instantly.
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-dashboard-navy px-4 py-2.5 text-xs font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-60"
        >
          {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          {locating ? "Locating…" : "Find Projects Near Me"}
        </button>
        {locationError && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] font-medium text-red-600">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {locationError}
          </p>
        )}

        {nearby && (
          <div className="mt-4 space-y-2">
            {nearby.length === 0 && <p className="text-xs text-slate-500">No monitored projects found near you.</p>}
            {nearby.map((p) => (
              <Link
                key={p.id}
                href={`/complaint/${p.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-dashboard-navy hover:bg-dashboard-blue-soft/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900">{p.project_name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {p.district}, {p.state} · {p.distance_km} km away · {crore(p.sanctioned_amount)}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-dashboard-navy">Select →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold text-slate-700">Or search by project name / reference ID</p>
        <form onSubmit={handleSearch} className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. road construction, ref ID…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-dashboard-navy focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-lg bg-dashboard-navy px-4 py-2.5 text-xs font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-60"
          >
            <Search size={15} />
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {searchResults && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 && <p className="text-xs text-slate-500">No projects match that search.</p>}
            {searchResults.map((p) => (
              <Link
                key={p.id}
                href={`/complaint/${p.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:border-dashboard-navy hover:bg-dashboard-blue-soft/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-slate-900">{p.project_name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {p.district}, {p.state} · {crore(p.sanctioned_amount)}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-dashboard-navy">Select →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
