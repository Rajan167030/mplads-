"use client";

import { type GeoJSONSource, Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Same Turbopack worker-resolution fix as the dashboard's risk map — see
// docs/decisions.md ADR-011. Must run before any Map is constructed.
setWorkerUrl("/maplibre-gl-worker.mjs");

import { getRiskMap, type RiskMapResult } from "@/lib/api";
import { filterDemoRiskMap, isNetworkError } from "@/lib/demo-data";

const SECTOR_LABELS: Record<string, string> = {
  ROAD: "Roads",
  SCHOOL: "Schools",
  COMMUNITY_HALL: "Community Halls",
  WATER_INFRASTRUCTURE: "Water Infrastructure",
  HEALTH_CENTRE: "Health Centres",
  SANITATION: "Sanitation",
  PUBLIC_FACILITY: "Public Facilities",
  LIGHTING: "Lighting",
  SPORTS_RECREATION: "Sports & Recreation",
};

const MAP_LIMIT = 5000;

// Keep the camera locked to India's extent so the heatmap never drifts out
// to show unrelated neighbouring countries when panned or zoomed out.
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [66.5, 5.5],
  [99.5, 36.5],
];

export function PublicHeatmap({
  initialData,
  states,
  projectTypes,
  initialSector,
}: {
  initialData: RiskMapResult;
  states: string[];
  projectTypes: string[];
  initialSector?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapReadyRef = useRef(false);

  const [state, setState] = useState("");
  const [sector, setSector] = useState(initialSector ?? "");
  const [data, setData] = useState<RiskMapResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mount the map exactly once — re-filtering updates the source's data
  // in place below, it never tears down and recreates the map instance.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [82.8, 22.6],
      zoom: 4,
      minZoom: 3.8,
      maxBounds: INDIA_BOUNDS,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "bottom-right");

    map.on("load", () => {
      map.addSource("projects", { type: "geojson", data: data as unknown as GeoJSON.FeatureCollection });

      map.addLayer({
        id: "project-heat",
        type: "heatmap",
        source: "projects",
        maxzoom: 9,
        paint: {
          // Brand navy-to-lime ramp, deliberately not the red/orange "hot"
          // palette a generic heatmap defaults to — this page explicitly
          // promises no risk-coded visuals, and red-hot blobs across the map
          // read as "danger zones" to a citizen even when the caption says
          // otherwise. Peak density highlights in the brand's own lime, which
          // reads as "notable" rather than "critical."
          "heatmap-weight": 0.5,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 9, 2.2],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(9,37,65,0)",
            0.2, "rgba(79,142,247,0.45)",
            0.45, "#4f8ef7",
            0.7, "#1c4f8f",
            0.9, "#092541",
            1, "#8dfc75",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 9, 16],
          "heatmap-opacity": 0.8,
        },
      });

      // Below maxzoom's cutoff, fall back to discrete points so individual
      // clusters stay legible once the density blur would otherwise hide them.
      map.addLayer({
        id: "project-points",
        type: "circle",
        source: "projects",
        minzoom: 7,
        paint: {
          "circle-radius": 4,
          "circle-color": "#8dfc75",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#092541",
          "circle-opacity": 0.9,
        },
      });

      mapReadyRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new filtered data into the already-mounted map whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource("projects") as GeoJSONSource | undefined;
    source?.setData(data as unknown as GeoJSON.FeatureCollection);
  }, [data]);

  async function applyFilters(nextState: string, nextSector: string) {
    setState(nextState);
    setSector(nextSector);
    setLoading(true);
    setError(null);
    try {
      const result = await getRiskMap({
        state: nextState || undefined,
        project_type: nextSector || undefined,
        limit: MAP_LIMIT,
      });
      setData(result);
    } catch (err) {
      if (isNetworkError(err)) setData(filterDemoRiskMap({ state: nextState || undefined, project_type: nextSector || undefined }));
      else setError("Could not refresh the map — try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  const hasFilters = state !== "" || sector !== "";

  return (
    <div>
      {error && <p className="mb-2 text-xs font-medium text-red-600">{error}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <Layers size={13} /> Filter map
        </span>
        <select
          value={state}
          onChange={(e) => applyFilters(e.target.value, sector)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-dashboard-navy focus:outline-none"
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sector}
          onChange={(e) => applyFilters(state, e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-dashboard-navy focus:outline-none"
        >
          <option value="">All sectors</option>
          {projectTypes.map((t) => (
            <option key={t} value={t}>
              {SECTOR_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => applyFilters("", "")}
            className="text-xs font-semibold text-dashboard-navy underline underline-offset-2"
          >
            Reset
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
          {loading ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Updating…
            </>
          ) : (
            `${data.features.length.toLocaleString()} project${data.features.length === 1 ? "" : "s"} shown`
          )}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-900/10">
        <div ref={containerRef} className="h-[460px] w-full sm:h-[500px]" />

        {loading && (
          <div className="pointer-events-none absolute inset-0 z-20 bg-dashboard-deep/20 backdrop-blur-[1px]" />
        )}

        <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />

        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-dashboard-deep/80 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <span className="text-[10px] font-medium text-slate-300">Fewer</span>
          <span
            className="h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(to right, rgba(79,142,247,0.45), #4f8ef7, #1c4f8f, #092541, #8dfc75)",
            }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-medium text-slate-300">More projects</span>
        </div>
      </div>
    </div>
  );
}
