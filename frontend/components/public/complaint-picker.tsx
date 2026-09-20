"use client";

import { AlertTriangle, ChevronRight, Compass, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getNearbyProjects, listProjects, type NearbyProjectItem, type ProjectListItem } from "@/lib/api";
import { demoNearbyProjects, filterDemoProjects, isNetworkError } from "@/lib/demo-data";

function crore(amount: number) {
  if (!amount) return "₹0.00";
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
      setLocationError("This device/browser does not support geolocation. Please search by name below.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await getNearbyProjects(position.coords.latitude, position.coords.longitude, 6);
          setNearby(res.projects);
        } catch (err) {
          if (isNetworkError(err)) {
            setNearby(demoNearbyProjects(position.coords.latitude, position.coords.longitude, 6).projects);
          } else {
            setNearby(demoNearbyProjects(position.coords.latitude, position.coords.longitude, 6).projects);
          }
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Please search by project name or district below."
            : "Could not fetch GPS coordinates. Please search by name below."
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
    } catch (err) {
      setSearchResults(isNetworkError(err) ? filterDemoProjects({ search: query.trim(), limit: 8 }).items : []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Method 1: GPS Auto-Detect */}
      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-dashboard-navy text-dashboard-lime shadow-sm">
              <Compass size={20} className={locating ? "animate-spin" : ""} />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Are you at or near the project site?</div>
              <div className="text-xs text-slate-500">Auto-detect the project using your device location.</div>
            </div>
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-xl bg-dashboard-navy px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-dashboard-blue disabled:opacity-60"
          >
            {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
            <span>{locating ? "Locating Works..." : "Detect Works Near Me"}</span>
          </button>
        </div>

        {locationError && (
          <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <span>{locationError}</span>
          </div>
        )}

        {nearby && (
          <div className="mt-4 border-t border-blue-100 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Projects Found Nearby:
            </div>
            {nearby.length === 0 ? (
              <p className="text-xs text-slate-500">No geo-tagged projects detected in this immediate area.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {nearby.map((p) => (
                  <Link
                    key={p.id}
                    href={`/complaint/${p.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-dashboard-navy hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>{p.district}, {p.state}</span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                          {p.distance_km} km away
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-900 group-hover:text-dashboard-navy line-clamp-2">
                        {p.project_name}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                      <span className="font-mono font-bold text-slate-700">{crore(p.sanctioned_amount)}</span>
                      <span className="flex items-center gap-0.5 font-bold text-red-600 group-hover:underline">
                        Select Project <ChevronRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Method 2: Search by Name/District */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="text-sm font-bold text-slate-900 mb-1">Search by Project Name or Keywords</div>
        <p className="text-xs text-slate-500 mb-3">
          Type the road name, village name, school, hospital, or work description.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. CC Road, Panchayat Bhawan, Solar Pump, Primary School..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-dashboard-navy focus:outline-none focus:ring-2 focus:ring-dashboard-navy/10"
            />
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center gap-2 rounded-xl bg-dashboard-navy px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-dashboard-blue disabled:opacity-60"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>{searching ? "Searching..." : "Search"}</span>
          </button>
        </form>

        {searchResults && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {searchResults.length} Results Found:
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500">No projects found matching that search term.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {searchResults.map((p) => (
                  <Link
                    key={p.id}
                    href={`/complaint/${p.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition-all hover:border-dashboard-navy hover:bg-white hover:shadow-md"
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        {p.district}, {p.state}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-900 group-hover:text-dashboard-navy line-clamp-2">
                        {p.project_name}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px]">
                      <span className="font-mono font-bold text-slate-700">{crore(p.sanctioned_amount)}</span>
                      <span className="flex items-center gap-0.5 font-bold text-red-600 group-hover:underline">
                        File Complaint <ChevronRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
