"use client";

import { useEffect, useState } from "react";

import { getPatternSummary } from "@/lib/api";

const POLL_INTERVAL_MS = 20_000;

const features = [
  "Financial, execution & spatial signals combined",
  "Multilingual entity resolution across records",
  "Explainable risk assessment & audit trails",
];

const workflow = ["MPLADS DATA", "FINANCIAL · EXECUTION · SPATIAL SIGNALS", "RISK SCORE", "INVESTIGATION", "ACTION"];

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

function useLiveSignals(initial: LiveSignal[]) {
  const [signals, setSignals] = useState(initial);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const result = await getPatternSummary();
        const top = result.patterns
          .slice()
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((p) => ({ signalType: p.signal_type, count: p.count }));
        if (!cancelled && top.length > 0) setSignals(top);
      } catch {
        // Keep showing the last-known-good signals rather than clearing them
        // on a transient network blip — this is a live indicator, not a form.
      }
    }

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return signals;
}

export function HeroPanel({ stats, initialSignals }: { stats: HeroStats | null; initialSignals: LiveSignal[] }) {
  const signals = useLiveSignals(initialSignals);
  return (
    <section className="relative flex min-h-155 flex-col justify-between overflow-hidden bg-dashboard-navy px-6 py-10 sm:px-10 lg:min-h-0 lg:w-[58%] lg:px-14 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 78% 22%, rgba(141,252,117,0.10), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 my-auto max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-dashboard-lime/25 bg-dashboard-lime/10 px-3 py-1 text-xs font-medium text-dashboard-lime">
          Live for FY 2025–26
        </span>

        <h1 className="mt-6 whitespace-normal font-display text-4xl font-semibold leading-tight tracking-tight text-white sm:whitespace-nowrap sm:text-5xl">
          Public funds,
          <br />
          accounted for.
        </h1>

        <p className="mt-5 max-w-md text-sm leading-7 text-white/65 sm:text-base">
          MPLADS Intelligence cross-checks the financial, execution, and spatial record of every sanctioned
          project, and surfaces the ones that warrant a closer look — before the money&apos;s already spent.
        </p>

        <div className="mt-9 flex divide-x divide-white/10 border-y border-white/10 py-6">
          <div className="flex-1 pr-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-white">
              {stats ? <CountUp target={stats.totalProjects} /> : "—"}
            </div>
            <div className="mt-1 text-xs text-white/45">Projects monitored</div>
          </div>
          <div className="flex-1 px-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-white">
              {stats ? <CountUp target={stats.fundsTrackedCr} suffix=" Cr" /> : "—"}
            </div>
            <div className="mt-1 text-xs text-white/45">Funds tracked (₹)</div>
          </div>
          <div className="flex-1 pl-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-dashboard-orange">
              {stats ? <CountUp target={stats.flaggedForReview} /> : "—"}
            </div>
            <div className="mt-1 text-xs text-white/45">Flagged for review</div>
          </div>
        </div>

        <div className="mt-8 hidden items-start gap-10 sm:flex">
          <div className="relative h-[200px] w-[200px] shrink-0" aria-hidden="true">
            <div className="absolute inset-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.02]">
              <div className="absolute inset-[34px] rounded-full border border-white/10" />
              <div className="absolute inset-[68px] rounded-full border border-white/10" />
              <div
                className="console-radar-sweep absolute inset-0"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(141,252,117,0.5), rgba(141,252,117,0) 26%, rgba(141,252,117,0) 100%)",
                }}
              />
            </div>
            <span className="console-signal-dot absolute left-[128px] top-[54px] size-[7px] rounded-full bg-dashboard-lime" />
            <span
              className="console-signal-dot absolute left-[52px] top-[118px] size-[7px] rounded-full bg-dashboard-orange"
              style={{ animationDelay: "0.6s" }}
            />
            <span className="console-signal-dot absolute left-[138px] top-[148px] size-[7px] rounded-full bg-dashboard-lime" style={{ animationDelay: "1.3s" }} />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {signals.map((signal) => (
              <span
                key={signal.signalType}
                className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-console-mono text-[11px] text-white/55"
              >
                {signal.signalType}
                <span className="text-white/75">{signal.count.toLocaleString("en-IN")}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-9 space-y-2.5">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70"
            >
              <span className="text-dashboard-lime" aria-hidden="true">
                ◉
              </span>
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Workflow process
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 font-console-mono text-[9px] font-medium text-dashboard-lime sm:text-[10px]">
            {workflow.map((step, index) => (
              <span key={step} className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                {step}
                {index < workflow.length - 1 && (
                  <span className="text-white/35" aria-hidden="true">
                    →
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
