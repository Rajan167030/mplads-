"use client";

import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

// Same Turbopack worker-resolution fix as the dashboard's risk map — see
// docs/decisions.md ADR-011. Must run before any Map is constructed.
setWorkerUrl("/maplibre-gl-worker.mjs");

import type { RiskMapResult } from "@/lib/api";

export function PublicHeatmap({ data }: { data: RiskMapResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [78.9, 22.6],
      zoom: 3.6,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl(), "top-right");

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
          "circle-color": "#092541",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.8,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl" />;
}
