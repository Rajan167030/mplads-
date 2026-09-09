"use client";

import { AlertTriangle, Compass, Loader2, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getNearbyProjects, type NearbyProjectsResult } from "@/lib/api";
import { demoNearbyProjects, isNetworkError } from "@/lib/demo-data";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ONGOING: "bg-blue-50 text-blue-700",
  DELAYED: "bg-amber-50 text-amber-700",
  SANCTIONED: "bg-slate-100 text-slate-700",
};

// Beyond this, the nearest known project is too far to confidently call it
// "your area" — still useful as "closest monitored projects", just framed
// honestly instead of guessing a citizen's district from a distant match.
const CONFIDENT_AREA_RADIUS_KM = 50;

function crore(amount: number) {
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export function NearMe() {
  const [result, setResult] = useState<NearbyProjectsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("This browser doesn't support location access — try searching by state/district instead.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await getNearbyProjects(position.coords.latitude, position.coords.longitude, 8);
          setResult(res);
        } catch (err) {
          if (isNetworkError(err)) setResult(demoNearbyProjects(position.coords.latitude, position.coords.longitude, 8));
          else setError("Something went wrong. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location access, or search by state/district instead."
            : "Could not get your location. Try again, or search by state/district instead."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const isConfident = result?.nearest_distance_km !== null && result !== null && result.nearest_distance_km! <= CONFIDENT_AREA_RADIUS_KM;

  return (
    <div className="mb-5 rounded-xl border border-dashed border-dashboard-navy/25 bg-dashboard-blue-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-dashboard-navy shadow-sm">
            <Compass size={17} />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">Not sure of your state or district?</div>
            <div className="text-[11px] text-slate-500">Use your device location to find monitored projects near you.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-dashboard-navy px-4 py-2.5 text-xs font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          {loading ? "Locating…" : "Use My Location"}
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] font-medium text-red-600">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {result && (
        <div className="mt-4">
          {result.recommended_state ? (
            <p className="text-xs text-slate-600">
              {isConfident ? (
                <>
                  You&apos;re closest to <span className="font-bold text-slate-900">{result.recommended_district}, {result.recommended_state}</span> —
                  nearest monitored project is {result.nearest_distance_km} km away.
                </>
              ) : (
                <>
                  No monitored projects nearby — the closest one is{" "}
                  <span className="font-bold text-slate-900">{result.nearest_distance_km} km away</span> in {result.recommended_district},{" "}
                  {result.recommended_state}. Showing the nearest known projects below.
                </>
              )}
            </p>
          ) : (
            <p className="text-xs text-slate-500">No monitored projects with location data were found.</p>
          )}

          {result.projects.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.projects.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-dashboard-navy" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-slate-900">{p.project_name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {p.district}, {p.state} · {p.distance_km} km away · {crore(p.sanctioned_amount)}
                    </div>
                    <Link href={`/complaint/${p.id}`} className="mt-1 inline-block text-[10px] font-bold text-red-600 hover:underline">
                      Report issue
                    </Link>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${STATUS_STYLES[p.status] ?? "bg-slate-100"}`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
