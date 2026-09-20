"use client";

import { AlertTriangle, Compass, FileWarning, Loader2, MapPin, Navigation, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getNearbyProjects, type NearbyProjectsResult } from "@/lib/api";
import { demoNearbyProjects, isNetworkError } from "@/lib/demo-data";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  COMPLETED: { label: "Completed", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  ONGOING: { label: "In Progress", bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  DELAYED: { label: "Delayed", bg: "bg-amber-50 border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },
  SANCTIONED: { label: "Sanctioned", bg: "bg-purple-50 border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
};

const CONFIDENT_AREA_RADIUS_KM = 50;

function crore(amount: number) {
  if (!amount) return "₹0.00";
  return `₹${(amount / 10000000).toFixed(2)} Cr`;
}

export function NearMe() {
  const [result, setResult] = useState<NearbyProjectsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setError("This browser doesn't support GPS location access. Please search by state/district instead.");
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
          if (isNetworkError(err)) {
            setResult(demoNearbyProjects(position.coords.latitude, position.coords.longitude, 8));
          } else {
            setError("Unable to connect to live GPS database. Showing closest demo works.");
            setResult(demoNearbyProjects(position.coords.latitude, position.coords.longitude, 8));
          }
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Please enable GPS location in your browser or search by State/District."
            : "Could not detect precise location. Please search by state/district above."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  const isConfident =
    result?.nearest_distance_km !== null &&
    result !== null &&
    result.nearest_distance_km! <= CONFIDENT_AREA_RADIUS_KM;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-dashboard-navy to-dashboard-blue text-dashboard-lime shadow-md shadow-dashboard-navy/20">
            <Compass size={22} className={loading ? "animate-spin" : ""} />
            {loading && (
              <span className="absolute -inset-1 rounded-2xl border border-dashboard-lime/40 animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">Find Works Near My Current Location</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                1-Click GPS
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Instant discovery of MPLADS projects sanctioned in your immediate surroundings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-dashboard-navy to-dashboard-blue px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
          <span>{loading ? "Detecting Location..." : "Use My GPS Location"}</span>
        </button>
      </div>

      {error && (
        <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs font-medium text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-5 border-t border-blue-100/80 pt-4">
          {result.recommended_state ? (
            <div className="rounded-xl border border-blue-200/60 bg-white/80 p-3 text-xs text-slate-700">
              {isConfident ? (
                <span>
                  📍 You are closest to <span className="font-bold text-slate-900">{result.recommended_district}, {result.recommended_state}</span>.
                  The nearest recorded work is only <span className="font-bold text-dashboard-navy">{result.nearest_distance_km} km away</span>.
                </span>
              ) : (
                <span>
                  📍 Nearest monitored project is <span className="font-bold text-slate-900">{result.nearest_distance_km} km away</span> in {result.recommended_district}, {result.recommended_state}. Showing nearest entries below.
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No geo-tagged projects found in this vicinity.</p>
          )}

          {result.projects.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {result.projects.slice(0, 6).map((p) => {
                const conf = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.SANCTIONED;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          <MapPin size={12} className="text-dashboard-navy shrink-0" />
                          <span>{p.district}, {p.state}</span>
                        </div>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {p.distance_km} km away
                        </span>
                      </div>

                      <h4 className="mt-1.5 text-xs font-bold text-slate-900 line-clamp-2">
                        {p.project_name}
                      </h4>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                      <span className="font-mono font-bold text-slate-800">{crore(p.sanctioned_amount)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${conf.bg} ${conf.text}`}>
                          {conf.label}
                        </span>
                        <Link
                          href={`/complaint/${p.id}`}
                          className="text-[10px] font-bold text-red-600 hover:underline"
                        >
                          Report
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
