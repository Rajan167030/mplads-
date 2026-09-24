"use client";

import { type GeoJSONSource, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { 
  Building2, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Compass, 
  ExternalLink, 
  Eye, 
  FileWarning, 
  Fullscreen, 
  GraduationCap, 
  HeartPulse, 
  Landmark, 
  Layers, 
  Loader2, 
  LocateFixed, 
  MapPin, 
  Maximize2, 
  Navigation, 
  RotateCcw, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  SlidersHorizontal, 
  Sparkles, 
  TrendingUp, 
  Waves, 
  X 
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

// Turbopack worker resolution fix
setWorkerUrl("/maplibre-gl-worker.mjs");

import { getRiskMap, type RiskMapResult } from "@/lib/api";
import { filterDemoRiskMap, isNetworkError } from "@/lib/demo-data";

const SECTORS: Record<string, { label: string; icon: typeof Building2; color: string; badgeBg: string }> = {
  ROAD: { label: "Roads & Bridges", icon: Landmark, color: "text-amber-500", badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  SCHOOL: { label: "Schools & Education", icon: GraduationCap, color: "text-blue-400", badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  COMMUNITY_HALL: { label: "Community Halls", icon: Building2, color: "text-purple-400", badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
  WATER_INFRASTRUCTURE: { label: "Drinking Water", icon: Waves, color: "text-sky-400", badgeBg: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  HEALTH_CENTRE: { label: "Health Clinics", icon: HeartPulse, color: "text-rose-400", badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
  SANITATION: { label: "Sanitation", icon: Waves, color: "text-cyan-400", badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
  PUBLIC_FACILITY: { label: "Public Facilities", icon: Sparkles, color: "text-emerald-400", badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
};

const BASEMAP_STYLES = {
  dark: { name: "Cyber Dark", url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  positron: { name: "Clean Light", url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  voyager: { name: "Vibrant", url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json" },
};

const POPULAR_STATES = [
  { name: "Uttar Pradesh", coords: [80.9, 26.8, 6.2] },
  { name: "Maharashtra", coords: [75.7, 19.7, 6.0] },
  { name: "Bihar", coords: [85.3, 25.6, 6.8] },
  { name: "Karnataka", coords: [75.7, 15.3, 6.2] },
  { name: "Tamil Nadu", coords: [78.6, 11.1, 6.4] },
  { name: "West Bengal", coords: [87.8, 22.9, 6.5] },
  { name: "Rajasthan", coords: [74.2, 27.0, 5.8] },
  { name: "Delhi", coords: [77.1, 28.7, 9.5] },
] as const;

const MAP_LIMIT = 5000;
const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [66.5, 5.5],
  [99.5, 36.5],
];

function formatCurrency(amount: number) {
  if (!amount) return "₹0.00";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  return `₹${(amount / 100000).toFixed(2)} L`;
}

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
  const popupRef = useRef<Popup | null>(null);

  const [state, setState] = useState("");
  const [sector, setSector] = useState(initialSector ?? "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMapStyle, setSelectedMapStyle] = useState<keyof typeof BASEMAP_STYLES>("dark");
  const [layerMode, setLayerMode] = useState<"both" | "heatmap" | "pins">("both");
  
  const [data, setData] = useState<RiskMapResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLES[selectedMapStyle].url,
      center: [78.9629, 22.5937],
      zoom: 4.3,
      minZoom: 3.8,
      maxBounds: INDIA_BOUNDS,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");

    map.on("load", () => {
      map.addSource("projects", {
        type: "geojson",
        data: data as unknown as GeoJSON.FeatureCollection,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      // 1. Heatmap layer
      map.addLayer({
        id: "project-heat",
        type: "heatmap",
        source: "projects",
        maxzoom: 10,
        paint: {
          "heatmap-weight": 0.6,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 9, 2.6],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(9,37,65,0)",
            0.15, "rgba(79,142,247,0.5)",
            0.38, "#38bdf8",
            0.62, "#0284c7",
            0.82, "#092541",
            1, "#8dfc75",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 5, 9, 24],
          "heatmap-opacity": 0.85,
        },
      });

      // 2. Clusters layer
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "projects",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#0284c7",
            15,
            "#059669",
            50,
            "#d97706",
            150,
            "#092541",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16,
            15,
            20,
            50,
            25,
            150,
            30,
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#8dfc75",
          "circle-opacity": 0.92,
        },
      });

      // 3. Cluster count labels
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "projects",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold"],
          "text-size": 11.5,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // 4. Individual project points
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "projects",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#8dfc75",
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#071c33",
        },
      });

      // Cluster click zoom
      map.on("click", "clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("projects") as any;
        if (source && clusterId !== undefined) {
          source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) return;
            map.easeTo({
              center: (features[0].geometry as any).coordinates,
              zoom: Math.min(zoom + 0.5, 14),
            });
          });
        }
      });

      // Point click handler
      map.on("click", "unclustered-point", (e) => {
        if (!e.features || !e.features[0]) return;
        const feature = e.features[0];
        const coordinates = (feature.geometry as any).coordinates.slice();
        const props = feature.properties as any;

        setSelectedProject(props);

        if (popupRef.current) popupRef.current.remove();

        const popup = new Popup({ offset: 14, closeButton: true, className: "custom-maplibre-popup" })
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 2px; color: #092541; min-width: 200px;">
              <div style="display: inline-block; font-size: 9px; font-weight: 800; text-transform: uppercase; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; margin-bottom: 4px;">
                ${props.project_type || "Infrastructure"}
              </div>
              <div style="font-size: 12px; font-weight: 700; line-height: 1.35; color: #0f172a;">
                ${props.project_name}
              </div>
              <div style="margin-top: 6px; font-size: 11px; color: #64748b;">
                📍 ${props.district || ""}, ${props.state || ""}
              </div>
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: 700; color: #15803d;">
                  ${props.status || "Active"}
                </span>
                <a href="/complaint/${props.id}" style="font-size: 10px; font-weight: 700; color: #dc2626; text-decoration: none;">
                  File Grievance →
                </a>
              </div>
            </div>
          `)
          .addTo(map);

        popupRef.current = popup;
      });

      map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
      map.on("mouseenter", "unclustered-point", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered-point", () => (map.getCanvas().style.cursor = ""));

      mapReadyRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []);

  // Update Data Source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    const source = map.getSource("projects") as GeoJSONSource | undefined;
    source?.setData(data as unknown as GeoJSON.FeatureCollection);
  }, [data]);

  // Update Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (map.getLayer("project-heat")) {
      map.setLayoutProperty(
        "project-heat",
        "visibility",
        layerMode === "both" || layerMode === "heatmap" ? "visible" : "none"
      );
    }
    if (map.getLayer("clusters")) {
      map.setLayoutProperty(
        "clusters",
        "visibility",
        layerMode === "both" || layerMode === "pins" ? "visible" : "none"
      );
    }
    if (map.getLayer("cluster-count")) {
      map.setLayoutProperty(
        "cluster-count",
        "visibility",
        layerMode === "both" || layerMode === "pins" ? "visible" : "none"
      );
    }
    if (map.getLayer("unclustered-point")) {
      map.setLayoutProperty(
        "unclustered-point",
        "visibility",
        layerMode === "both" || layerMode === "pins" ? "visible" : "none"
      );
    }
  }, [layerMode]);

  // Handle Basemap Switch
  const switchBasemap = (styleKey: keyof typeof BASEMAP_STYLES) => {
    setSelectedMapStyle(styleKey);
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(BASEMAP_STYLES[styleKey].url);
  };

  // Filter Data Function
  async function applyFilters(
    nextState: string,
    nextSector: string,
    nextStatus: string = statusFilter
  ) {
    setState(nextState);
    setSector(nextSector);
    setStatusFilter(nextStatus);
    setLoading(true);
    setError(null);

    const foundState = POPULAR_STATES.find((s) => s.name === nextState);
    if (foundState && mapRef.current) {
      const [lng, lat, zoom] = foundState.coords;
      mapRef.current.flyTo({ center: [lng, lat], zoom, speed: 1.2 });
    } else if (!nextState && mapRef.current) {
      mapRef.current.flyTo({ center: [78.9629, 22.5937], zoom: 4.3, speed: 1.2 });
    }

    try {
      const result = await getRiskMap({
        state: nextState || undefined,
        project_type: nextSector || undefined,
        limit: MAP_LIMIT,
      });

      let filteredFeatures = result.features;
      if (nextStatus !== "ALL") {
        filteredFeatures = filteredFeatures.filter((f) => f.properties.status === nextStatus);
      }

      setData({ ...result, features: filteredFeatures });
    } catch (err) {
      if (isNetworkError(err)) {
        const demoRes = filterDemoRiskMap({ state: nextState || undefined, project_type: nextSector || undefined });
        setData(demoRes);
      } else {
        setError("Could not refresh the map — try again shortly.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Filter projects by search query in the sidebar
  const visibleProjects = useMemo(() => {
    if (!searchQuery.trim()) return data.features.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return data.features
      .filter((f) => {
        const p = f.properties;
        return (
          p.project_name?.toLowerCase().includes(q) ||
          p.district?.toLowerCase().includes(q) ||
          p.state?.toLowerCase().includes(q) ||
          p.external_project_id?.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [data, searchQuery]);

  const selectProjectFromList = (feature: any) => {
    setSelectedProject(feature.properties);
    const coords = feature.geometry.coordinates;
    if (mapRef.current && coords) {
      mapRef.current.flyTo({ center: coords, zoom: 12, speed: 1.4 });
    }
  };

  const resetAll = () => {
    setSearchQuery("");
    applyFilters("", "", "ALL");
  };

  const hasActiveFilters = state !== "" || sector !== "" || statusFilter !== "ALL" || searchQuery !== "";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-[#071728] text-white shadow-2xl">
      {/* -------------------------------------------------------------- */}
      {/* 1. TOP COMMAND BAR: STATS & RAPID STATE NAVIGATION CHIPS        */}
      {/* -------------------------------------------------------------- */}
      <div className="border-b border-white/10 bg-[#051322]/95 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Header & Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-dashboard-lime/15 text-dashboard-lime border border-dashboard-lime/30 shadow-[0_0_20px_rgba(141,252,117,0.15)]">
              <Compass size={22} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-extrabold tracking-tight text-white sm:text-lg">
                  National Geospatial Oversight Engine
                </h3>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Live PostGIS
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Explore geo-tagged infrastructure projects across 543 Parliamentary constituencies
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md">
              <span className="size-2 rounded-full bg-dashboard-lime animate-pulse" />
              <span className="text-[11px] text-slate-400">Mapped Works:</span>
              <span className="font-mono text-xs font-bold text-white">
                {data.features.length.toLocaleString()}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md">
              <Sparkles size={13} className="text-dashboard-lime" />
              <span className="text-[11px] text-slate-400">Layer Mode:</span>
              <span className="text-xs font-bold text-dashboard-lime capitalize">
                {layerMode}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Click State Travel Navigator Chips */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <MapPin size={11} className="text-dashboard-lime" /> Jump to:
          </span>
          <button
            type="button"
            onClick={() => applyFilters("", sector, statusFilter)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition shrink-0 ${
              state === ""
                ? "bg-dashboard-lime text-dashboard-navy font-bold shadow-md shadow-dashboard-lime/20"
                : "bg-white/[0.06] text-slate-300 hover:bg-white/15"
            }`}
          >
            All India
          </button>
          {POPULAR_STATES.map((st) => (
            <button
              key={st.name}
              type="button"
              onClick={() => applyFilters(st.name, sector, statusFilter)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition shrink-0 ${
                state === st.name
                  ? "bg-dashboard-lime text-dashboard-navy font-bold shadow-md shadow-dashboard-lime/20"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/15"
              }`}
            >
              {st.name}
            </button>
          ))}
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* 2. SECONDARY CONTROLS: FILTERS, SEARCH & BASEMAP SELECTOR       */}
      {/* -------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#06182c]/80 px-4 py-2.5 sm:px-6 backdrop-blur-md">
        {/* Left Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sector Filter */}
          <select
            value={sector}
            onChange={(e) => applyFilters(state, e.target.value, statusFilter)}
            className="rounded-xl border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white focus:border-dashboard-lime focus:outline-none"
          >
            <option value="" className="bg-[#071c33] text-white">All Infrastructure Sectors</option>
            {projectTypes.map((t) => (
              <option key={t} value={t} className="bg-[#071c33] text-white">
                {SECTORS[t]?.label ?? t}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => applyFilters(state, sector, e.target.value)}
            className="rounded-xl border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white focus:border-dashboard-lime focus:outline-none"
          >
            <option value="ALL" className="bg-[#071c33] text-white">All Project Statuses</option>
            <option value="COMPLETED" className="bg-[#071c33] text-white">Completed Only</option>
            <option value="ONGOING" className="bg-[#071c33] text-white">In-Progress</option>
            <option value="DELAYED" className="bg-[#071c33] text-white">Delayed Works</option>
            <option value="SANCTIONED" className="bg-[#071c33] text-white">Sanctioned</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-bold text-dashboard-lime hover:bg-white/20 transition"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>

        {/* Right Map View Options */}
        <div className="flex items-center gap-2">
          {/* Layer View Mode */}
          <div className="flex rounded-xl border border-white/15 bg-white/[0.05] p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setLayerMode("both")}
              className={`rounded-lg px-2 py-1 transition ${
                layerMode === "both" ? "bg-dashboard-lime text-dashboard-navy font-bold shadow" : "text-slate-300 hover:text-white"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setLayerMode("heatmap")}
              className={`rounded-lg px-2 py-1 transition ${
                layerMode === "heatmap" ? "bg-dashboard-lime text-dashboard-navy font-bold shadow" : "text-slate-300 hover:text-white"
              }`}
            >
              Heatmap
            </button>
            <button
              type="button"
              onClick={() => setLayerMode("pins")}
              className={`rounded-lg px-2 py-1 transition ${
                layerMode === "pins" ? "bg-dashboard-lime text-dashboard-navy font-bold shadow" : "text-slate-300 hover:text-white"
              }`}
            >
              Clusters
            </button>
          </div>

          {/* Basemap Style Dropdown */}
          <select
            value={selectedMapStyle}
            onChange={(e) => switchBasemap(e.target.value as any)}
            className="rounded-xl border border-white/15 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-slate-200 focus:border-dashboard-lime focus:outline-none"
          >
            <option value="dark" className="bg-[#071c33]">Cyber Dark</option>
            <option value="positron" className="bg-[#071c33]">Clean Light</option>
            <option value="voyager" className="bg-[#071c33]">Voyager</option>
          </select>

          {/* Toggle Explorer Sidebar */}
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`hidden md:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition ${
              sidebarOpen
                ? "border-dashboard-lime/40 bg-dashboard-lime/10 text-dashboard-lime"
                : "border-white/15 bg-white/[0.05] text-slate-300 hover:bg-white/10"
            }`}
          >
            <Layers size={13} />
            <span>{sidebarOpen ? "Hide List" : "Show List"}</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/* 3. MAIN SPLIT CANVAS: MAP VIEWPORT + LIVE INTERACTIVE LIST      */}
      {/* -------------------------------------------------------------- */}
      <div className="relative flex h-[540px] sm:h-[620px] w-full overflow-hidden">
        {/* Map Canvas */}
        <div ref={containerRef} className="h-full w-full flex-1" />

        {/* Loading Overlay */}
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-2xl border border-dashboard-lime/30 bg-[#071c33]/90 px-5 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md">
              <Loader2 size={18} className="animate-spin text-dashboard-lime" />
              <span>Querying PostGIS spatial coordinates…</span>
            </div>
          </div>
        )}

        {/* Collapsible Interactive Live Project Explorer Sidebar */}
        {sidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 z-20 hidden md:flex w-84 flex-col border-l border-white/10 bg-[#06172a]/95 backdrop-blur-xl shadow-2xl transition-all">
            {/* Sidebar Search */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by work or district…"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 pl-8 text-xs text-white placeholder:text-slate-400 focus:border-dashboard-lime focus:outline-none"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold px-1">
                <span>Showing top {visibleProjects.length} visible works</span>
                <span className="text-dashboard-lime">Click card to zoom</span>
              </div>
            </div>

            {/* Scrollable Project Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
              {visibleProjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  <ShieldAlert size={28} className="mx-auto mb-2 opacity-30 text-dashboard-lime" />
                  No matching projects found for this filter. Try clearing your search query.
                </div>
              ) : (
                visibleProjects.map((feature, idx) => {
                  const p = feature.properties;
                  const isSelected = selectedProject?.id === p.id;
                  const sectorMeta = SECTORS[p.project_type] ?? {
                    label: p.project_type || "Infrastructure",
                    icon: Building2,
                    badgeBg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
                  };
                  const SectorIcon = sectorMeta.icon;

                  return (
                    <div
                      key={p.id || idx}
                      onClick={() => selectProjectFromList(feature)}
                      className={`group cursor-pointer rounded-2xl border p-3 transition-all ${
                        isSelected
                          ? "border-dashboard-lime bg-dashboard-lime/10 shadow-lg shadow-dashboard-lime/10 ring-1 ring-dashboard-lime"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sectorMeta.badgeBg}`}>
                          <SectorIcon size={10} />
                          <span className="truncate max-w-[120px]">{sectorMeta.label}</span>
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          p.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : p.status === "DELAYED"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          {p.status || "Ongoing"}
                        </span>
                      </div>

                      <h4 className="mt-1.5 text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-dashboard-lime transition-colors">
                        {p.project_name}
                      </h4>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate font-medium">📍 {p.district}, {p.state}</span>
                        <ChevronRight size={14} className="text-white/40 group-hover:translate-x-1 group-hover:text-dashboard-lime transition-transform" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Selected Project Full Detail Drawer Overlay */}
        {selectedProject && (
          <div className="absolute bottom-4 left-4 right-4 md:right-92 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="rounded-3xl border border-dashboard-lime/40 bg-[#06172a]/95 p-4 sm:p-5 text-white shadow-2xl backdrop-blur-2xl ring-1 ring-dashboard-lime/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-dashboard-lime/20 border border-dashboard-lime/40 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-dashboard-lime">
                      {selectedProject.project_type || "Public Infrastructure"}
                    </span>
                    <span className="rounded bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[9.5px] font-bold text-emerald-300">
                      {selectedProject.status || "Active Status"}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      ID: {selectedProject.external_project_id || selectedProject.id?.slice(0, 8)}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-display text-sm sm:text-base font-bold text-white leading-snug">
                    {selectedProject.project_name}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span><strong>District:</strong> {selectedProject.district}</span>
                    <span><strong>State:</strong> {selectedProject.state}</span>
                    {selectedProject.risk_score && (
                      <span className="text-dashboard-lime">
                        <strong>Confidence Score:</strong> {selectedProject.risk_score}/100
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="grid size-7 place-items-center rounded-xl bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition"
                    aria-label="Close project detail card"
                  >
                    <X size={15} />
                  </button>
                  <Link
                    href={`/complaint/${selectedProject.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-red-600/30 hover:bg-red-500 active:scale-95 transition-all"
                  >
                    <FileWarning size={13} />
                    <span>Report Concern</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Left Heatmap Density Scale Guide */}
        <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-2.5 rounded-2xl border border-white/15 bg-black/75 px-3.5 py-2 shadow-xl backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Density</span>
          <span
            className="h-2 w-24 rounded-full"
            style={{
              background: "linear-gradient(to right, rgba(79,142,247,0.5), #38bdf8, #0284c7, #092541, #8dfc75)",
            }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-bold text-dashboard-lime">High Cluster</span>
        </div>
      </div>
    </div>
  );
}
