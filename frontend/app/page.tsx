import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { HeroPanel, type HeroStats, type LiveSignal } from "@/components/site/hero-panel";
import { LoginPanel } from "@/components/site/login-panel";
import { getDataQuality, getFinancialsSummary, getPatternSummary, getRiskSummary } from "@/lib/api";
import { DEMO_DATA_QUALITY, DEMO_FINANCIALS_SUMMARY, DEMO_PATTERN_SUMMARY, DEMO_RISK_SUMMARY, isNetworkError } from "@/lib/demo-data";

function statsFrom(
  dataQuality: { total_projects: number },
  risk: { band_counts: Record<string, number> },
  financials: { total_sanctioned: number },
  patterns: { patterns: { signal_type: string; count: number }[] }
): { stats: HeroStats; initialSignals: LiveSignal[] } {
  return {
    stats: {
      totalProjects: dataQuality.total_projects,
      fundsTrackedCr: Math.round(financials.total_sanctioned / 10000000),
      flaggedForReview: risk.band_counts.CRITICAL ?? 0,
    },
    initialSignals: patterns.patterns
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((p) => ({ signalType: p.signal_type, count: p.count })),
  };
}

export default async function Home() {
  let stats: HeroStats | null = null;
  let initialSignals: LiveSignal[] = [];
  try {
    const [dataQuality, risk, financials, patterns] = await Promise.all([
      getDataQuality(),
      getRiskSummary(),
      getFinancialsSummary(),
      getPatternSummary(),
    ]);
    ({ stats, initialSignals } = statsFrom(dataQuality, risk, financials, patterns));
  } catch (err) {
    if (isNetworkError(err)) {
      // Backend unreachable — show the same demo numbers the dashboard falls
      // back to, rather than "—" placeholders, so the pitch/demo still looks live.
      console.warn("[landing] backend unreachable, rendering demo hero stats");
      ({ stats, initialSignals } = statsFrom(DEMO_DATA_QUALITY, DEMO_RISK_SUMMARY, DEMO_FINANCIALS_SUMMARY, DEMO_PATTERN_SUMMARY));
    }
    // A reachable-but-erroring backend still leaves stats null — the hero
    // shows "—" rather than silently mixing real errors with fake numbers.
  }

  return (
    <div className="flex min-h-screen flex-col bg-dashboard-surface text-dashboard-ink">
      <SiteHeader />
      <main className="flex flex-1 flex-col lg:min-h-[calc(100vh-110px)] lg:flex-row">
        <HeroPanel stats={stats} initialSignals={initialSignals} />
        <LoginPanel />
      </main>
      <SiteFooter />
    </div>
  );
}
