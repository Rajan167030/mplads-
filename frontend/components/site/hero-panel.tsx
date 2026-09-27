"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, ArrowRight, Activity } from "lucide-react";
import { getPatternSummary } from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function CountUp({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const duration = 900;
    const start = performance.now();
    let frame: number;
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      {value.toLocaleString("en-IN")}
      {suffix}
    </>
  );
}

export interface HeroStats {
  totalProjects: number;
  fundsTrackedCr: number;
  flaggedForReview: number;
}

export interface LiveSignal {
  signalType: string;
  count: number;
}

const keyFeatures = [
  "AI-powered anomaly & risk detection",
  "Project progress & delay monitoring",
  "Explainable risk assessment & audit trails",
];

const workflowSteps = [
  "MPLADS DATA",
  "AI ANALYSIS",
  "RISK DETECTION",
  "INVESTIGATION",
  "ACTION",
];

export function HeroPanel({
  stats,
  initialSignals,
}: {
  stats: HeroStats | null;
  initialSignals: LiveSignal[];
}) {
  return (
    <section className="relative flex w-full flex-col justify-between overflow-hidden bg-[#0a2540] text-white p-6 sm:p-10 lg:w-[45%] lg:p-12 xl:p-14">
      {/* Subtle Dot Grid Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(#d2e4ff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />
      {/* Ambient Gradient Glow */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 my-auto flex flex-col gap-6 max-w-xl">
        {/* Government Badge & Header */}
        <div className="flex items-center gap-3.5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200/20 bg-[#0a2540] text-emerald-400 shadow-xl ring-1 ring-white/10">
            <ShieldCheck size={30} strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-200">
              Government of India
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white lg:text-3xl">
              MPLADS Intelligence
            </h1>
          </div>
        </div>

        {/* Tagline & Description */}
        <div className="space-y-2">
          <p className="font-display text-lg font-bold text-blue-100 sm:text-xl">
            AI-Powered Public Fund Monitoring &amp; Accountability
          </p>
          <p className="text-sm leading-relaxed text-slate-300">
            An AI-powered platform for monitoring MPLADS projects, detecting anomalies, identifying implementation risks, and improving transparency in public fund utilization.
          </p>
        </div>

        {/* Key Feature Badges */}
        <div className="flex flex-col gap-2.5 pt-1">
          {keyFeatures.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2.5 rounded-xl border border-blue-200/15 bg-white/[0.05] px-3.5 py-2.5 backdrop-blur-sm"
            >
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
              <span className="text-xs font-medium text-white sm:text-sm">
                {feature}
              </span>
            </div>
          ))}
        </div>

        {/* Live Counters */}
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
          <div>
            <div className="font-mono text-lg font-bold text-white sm:text-xl">
              {stats ? <CountUp target={stats.totalProjects} /> : "—"}
            </div>
            <div className="text-[10px] text-slate-400 sm:text-[11px]">Projects Tracked</div>
          </div>
          <div className="border-x border-white/10">
            <div className="font-mono text-lg font-bold text-white sm:text-xl">
              {stats ? <CountUp target={stats.fundsTrackedCr} suffix=" Cr" /> : "—"}
            </div>
            <div className="text-[10px] text-slate-400 sm:text-[11px]">Funds Tracked</div>
          </div>
          <div>
            <div className="font-mono text-lg font-bold text-amber-400 sm:text-xl">
              {stats ? <CountUp target={stats.flaggedForReview} /> : "—"}
            </div>
            <div className="text-[10px] text-slate-400 sm:text-[11px]">Flagged Anomalies</div>
          </div>
        </div>

        {/* Workflow Process Indicator */}
        <div className="pt-2">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-200">
            Workflow Process
          </div>
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-blue-200/15 bg-white/[0.04] p-2.5 font-mono text-[10px] sm:text-xs">
            {workflowSteps.map((step, idx) => (
              <span key={step} className="flex items-center gap-1.5">
                <span className="font-semibold text-emerald-400">{step}</span>
                {idx < workflowSteps.length - 1 && (
                  <span className="text-slate-500">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Footer Callout */}
      <div className="relative z-10 mt-8 border-t border-white/10 pt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
          Government Monitoring &amp; Decision Support System
        </div>
        <p className="mt-0.5 text-xs italic text-slate-400">
          &ldquo;Turning public project data into actionable insights for better monitoring and accountability.&rdquo;
        </p>
      </div>
    </section>
  );
}
