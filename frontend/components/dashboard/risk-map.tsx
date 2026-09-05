"use client";

import { Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// Turbopack doesn't resolve maplibre-gl's internal `import.meta.url`-relative
// worker script correctly — the Worker ends up constructed against the
// current page URL instead of the worker bundle, so it fails immediately and
// the map never leaves "styledata" (no tile requests are ever issued, "load"
// never fires). Serving the library's own worker bundle as a static asset and
// pointing setWorkerUrl at it directly sidesteps the bundler entirely.
// See docs/decisions.md ADR-011.
setWorkerUrl("/maplibre-gl-worker.mjs");

import type { RiskMapResult } from "@/lib/api";

const BAND_COLORS: Record<string, string> = {
  CRITICAL: "#bf1f26",
  HIGH: "#c96d00",
  MEDIUM: "#c9a800",
  LOW: "#087a20",
};

export function RiskMap({ data }: { data: RiskMapResult }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [78.9, 22.6],
      zoom: 4,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("projects", { type: "geojson", data: data as unknown as GeoJSON.FeatureCollection });

      map.addLayer({
        id: "project-points",
        type: "circle",
        source: "projects",
        paint: {
          "circle-radius": 5,
          "circle-color": [
            "match",
            ["get", "risk_band"],
            "CRITICAL", BAND_COLORS.CRITICAL,
            "HIGH", BAND_COLORS.HIGH,
            "MEDIUM", BAND_COLORS.MEDIUM,
            "LOW", BAND_COLORS.LOW,
            "#94a3b8",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });

      const popup = new Popup({ closeButton: false, closeOnClick: false });

      map.on("mouseenter", "project-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features?.[0];
        if (!feature) return;
        const props = feature.properties as Record<string, string | number | null>;
        popup
          .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(
            `<div style="font-family:sans-serif;font-size:12px;max-width:220px">
              <strong>${props.project_name}</strong><br/>
              ${props.district}, ${props.state}<br/>
              Risk: ${props.risk_band ?? "not scored"} (${props.risk_score ?? "—"})
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "project-points", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", "project-points", (e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id;
        if (id) router.push(`/dashboard/projects/${id}`);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // router is stable across renders (Next's useRouter), and re-running this
    // effect on every render would tear down and rebuild the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return <div ref={containerRef} className="h-[600px] w-full rounded-lg" />;
}
