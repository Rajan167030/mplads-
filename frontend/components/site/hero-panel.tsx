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
    <section className="relative flex min-h-155 flex-col justify-between overflow-hidden bg-console-bg px-6 py-10 sm:px-10 lg:min-h-0 lg:w-[58%] lg:px-14 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 78% 22%, rgba(124,111,238,0.14), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 my-auto max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-console-accent-soft bg-console-accent-soft px-3 py-1 text-xs font-medium text-[#C9C3FB]">
          Live for FY 2025–26
        </span>

        <h1 className="mt-6 whitespace-normal font-display text-4xl font-semibold leading-tight tracking-tight text-console-ink sm:whitespace-nowrap sm:text-5xl">
          Public funds,
          <br />
          accounted for.
        </h1>

        <p className="mt-5 max-w-md text-sm leading-7 text-console-ink-muted sm:text-base">
          MPLADS Intelligence cross-checks the financial, execution, and spatial record of every sanctioned
          project, and surfaces the ones that warrant a closer look — before the money&apos;s already spent.
        </p>

        <div className="mt-9 flex divide-x divide-console-border-soft border-y border-console-border-soft py-6">
          <div className="flex-1 pr-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-console-ink">
              {stats ? <CountUp target={stats.totalProjects} /> : "—"}
            </div>
            <div className="mt-1 text-xs text-console-ink-faint">Projects monitored</div>
          </div>
          <div className="flex-1 px-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-console-ink">
              {stats ? <CountUp target={stats.fundsTrackedCr} suffix=" Cr" /> : "—"}
            </div>
            <div className="mt-1 text-xs text-console-ink-faint">Funds tracked (₹)</div>
          </div>
          <div className="flex-1 pl-5">
            <div className="font-console-mono text-2xl font-medium tabular-nums text-console-amber">
              {stats ? <CountUp target={stats.flaggedForReview} /> : "—"}
            </div>
            <div className="mt-1 text-xs text-console-ink-faint">Flagged for review</div>
          </div>
        </div>

        <div className="mt-8 hidden items-start gap-10 sm:flex">
          <div className="relative h-[200px] w-[200px] shrink-0" aria-hidden="true">
            <div className="absolute inset-0 overflow-hidden rounded-full border border-console-border bg-white/[0.015]">
              <div className="absolute inset-[34px] rounded-full border border-console-border-soft" />
              <div className="absolute inset-[68px] rounded-full border border-console-border-soft" />
              <div
                className="console-radar-sweep absolute inset-0"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgba(124,111,238,0.55), rgba(124,111,238,0) 26%, rgba(124,111,238,0) 100%)",
                }}
              />
            </div>
            <span className="console-signal-dot absolute left-[128px] top-[54px] size-[7px] rounded-full bg-console-accent" />
            <span
              className="console-signal-dot absolute left-[52px] top-[118px] size-[7px] rounded-full bg-console-amber"
              style={{ animationDelay: "0.6s" }}
            />
            <span className="console-signal-dot absolute left-[138px] top-[148px] size-[7px] rounded-full bg-console-accent" style={{ animationDelay: "1.3s" }} />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {signals.map((signal) => (
              <span
                key={signal.signalType}
                className="flex items-center justify-between gap-3 rounded-md border border-console-border-soft bg-console-surface px-2.5 py-1.5 font-console-mono text-[11px] text-console-ink-faint"
              >
                {signal.signalType}
                <span className="text-console-ink-muted">{signal.count.toLocaleString("en-IN")}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-9 space-y-2.5">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-lg border border-console-border-soft bg-console-surface px-3 py-2 text-sm text-console-ink-muted"
            >
              <span className="text-console-accent" aria-hidden="true">
                ◉
              </span>
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-console-ink-faint">
            Workflow process
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 overflow-hidden rounded-lg border border-console-border-soft bg-console-surface px-3 py-3 font-console-mono text-[9px] font-medium text-console-accent sm:text-[10px]">
            {workflow.map((step, index) => (
              <span key={step} className="flex min-w-0 items-center gap-2 whitespace-normal break-words">
                {step}
                {index < workflow.length - 1 && (
                  <span className="text-console-ink-faint" aria-hidden="true">
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
