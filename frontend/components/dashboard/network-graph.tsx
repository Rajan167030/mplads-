"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { GraphNode, OverviewGraph } from "@/lib/api";

const BAND_COLORS: Record<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW", string> = {
  CRITICAL: "#bf1f26",
  HIGH: "#c96d00",
  MEDIUM: "#c9a800",
  LOW: "#087a20",
};

function bandFor(score: number | null): keyof typeof BAND_COLORS {
  if (score === null) return "LOW";
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

const WIDTH = 720;
const HEIGHT = 260;
const MIN_GAP = 52; // node radius + label width headroom, enforced post-layout so text never overlaps

interface LaidOutNode {
  id: string;
  label: string;
  riskScore: number | null;
  totalProjects: number;
  x: number;
  y: number;
  r: number;
}

// A small force-directed layout (Fruchterman-Reingold style: repulsion between
// every pair + spring attraction along edges + mild centering), run only over
// nodes that actually share an edge — isolated nodes are rendered separately
// below as a plain badge grid instead of being flung around empty canvas by
// pure repulsion, which is what made the previous version look scattered.
function layout(nodes: GraphNode[], edges: OverviewGraph["edges"], radiusFor: (total: number) => number) {
  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / Math.max(nodes.length, 1)) * 0.85;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  const pos = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    const r = Math.min(WIDTH, HEIGHT) / 3;
    pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 });
  });

  const ids = nodes.map((n) => n.id);
  for (let iter = 0; iter < 300; iter++) {
    const temp = 1 - iter / 300;

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx += dx;
        a.vy += dy;
        b.vx -= dx;
        b.vy -= dy;
      }
    }

    for (const edge of edges) {
      const a = pos.get(edge.source);
      const b = pos.get(edge.target);
      if (!a || !b) continue;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      a.vx -= dx;
      a.vy -= dy;
      b.vx += dx;
      b.vy += dy;
    }

    for (const id of ids) {
      const p = pos.get(id)!;
      p.vx += (cx - p.x) * 0.015;
      p.vy += (cy - p.y) * 0.015;

      const disp = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 0.01;
      const capped = Math.min(disp, 10 * temp + 0.5);
      p.x += (p.vx / disp) * capped;
      p.y += (p.vy / disp) * capped;
      p.x = Math.max(50, Math.min(WIDTH - 50, p.x));
      p.y = Math.max(35, Math.min(HEIGHT - 35, p.y));
      p.vx = 0;
      p.vy = 0;
    }
  }

  // Final declutter pass: force-layout can still leave close pairs whose
  // labels would collide. Directly separate any pair nearer than the label
  // footprint requires, independent of the physics constants above.
  for (let pass = 0; pass < 60; pass++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < MIN_GAP) {
          const push = (MIN_GAP - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }
  for (const id of ids) {
    const p = pos.get(id)!;
    p.x = Math.max(50, Math.min(WIDTH - 50, p.x));
    p.y = Math.max(35, Math.min(HEIGHT - 35, p.y));
  }

  return nodes.map((n) => {
    const p = pos.get(n.id)!;
    return { id: n.id, label: n.label, riskScore: n.risk_score, totalProjects: n.total_projects, x: p.x, y: p.y, r: radiusFor(n.total_projects) };
  }) as LaidOutNode[];
}

function ContractorBadge({ node, onClick }: { node: GraphNode; onClick: () => void }) {
  const band = bandFor(node.risk_score);
  return (
    <button
      onClick={onClick}
      title={`${node.label} — risk ${node.risk_score?.toFixed(0) ?? "—"}, ${node.total_projects} project(s)`}
      className="flex items-center gap-1.5 rounded-full border border-dashboard-line bg-dashboard-surface px-2.5 py-1 text-[11px] hover:bg-white hover:shadow-sm"
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: BAND_COLORS[band] }} />
      <span className="max-w-[140px] truncate">{node.label}</span>
    </button>
  );
}

export function NetworkGraph({ graph }: { graph: OverviewGraph }) {
  const router = useRouter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    graph.edges.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    return ids;
  }, [graph.edges]);

  const connectedNodes = graph.nodes.filter((n) => connectedIds.has(n.id));
  const isolatedNodes = graph.nodes.filter((n) => !connectedIds.has(n.id));
  const maxProjects = Math.max(...graph.nodes.map((n) => n.total_projects), 1);
  const radiusFor = (total: number) => 9 + (total / maxProjects) * 12;

  const laidOut = useMemo(
    () => (connectedNodes.length > 0 ? layout(connectedNodes, graph.edges, radiusFor) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectedNodes, graph.edges]
  );
  const positions = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);

  if (graph.nodes.length === 0) {
    return <p className="text-sm text-dashboard-muted">No scored contractors yet — run risk scoring first.</p>;
  }

  return (
    <div>
      {laidOut.length > 0 ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}>
          {graph.edges.map((edge, i) => {
            const a = positions.get(edge.source);
            const b = positions.get(edge.target);
            if (!a || !b) return null;
            const dimmed = hoveredId !== null && hoveredId !== edge.source && hoveredId !== edge.target;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#9fb3c8"
                strokeWidth={Math.min(1 + edge.weight * 0.7, 4)}
                opacity={dimmed ? 0.08 : 0.55}
              />
            );
          })}
          {laidOut.map((n) => {
            const band = bandFor(n.riskScore);
            const dimmed = hoveredId !== null && hoveredId !== n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => router.push(`/dashboard/contractors/${n.id}`)}
                opacity={dimmed ? 0.3 : 1}
              >
                <circle r={n.r} fill={BAND_COLORS[band]} stroke="#fff" strokeWidth={1.5} />
                <text
                  y={n.r + 12}
                  textAnchor="middle"
                  className="fill-dashboard-ink"
                  fontSize={10}
                  fontWeight={hoveredId === n.id ? 700 : 500}
                >
                  {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="text-sm text-dashboard-muted">
          None of the top-risk contractors currently share a district + project-type niche with each other.
        </p>
      )}

      {isolatedNodes.length > 0 && (
        <div className="mt-4 border-t border-dashboard-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dashboard-muted">
            Other high-risk contractors — no shared niche detected
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {isolatedNodes.map((n) => (
              <ContractorBadge key={n.id} node={n} onClick={() => router.push(`/dashboard/contractors/${n.id}`)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-dashboard-muted">
        <span className="font-semibold text-dashboard-ink">Risk band:</span>
        {(Object.keys(BAND_COLORS) as (keyof typeof BAND_COLORS)[]).map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLORS[b] }} />
            {b}
          </span>
        ))}
        <span className="ml-auto">Node size = project count · Line = shares a district + project-type niche</span>
      </div>
    </div>
  );
}
