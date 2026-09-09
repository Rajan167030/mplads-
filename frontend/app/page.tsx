import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { HeroPanel, type HeroStats, type LiveSignal } from "@/components/site/hero-panel";
import { LoginPanel } from "@/components/site/login-panel";
import { getDataQuality, getFinancialsSummary, getPatternSummary, getRiskSummary } from "@/lib/api";

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
    stats = {
      totalProjects: dataQuality.total_projects,
      fundsTrackedCr: Math.round(financials.total_sanctioned / 10000000),
      flaggedForReview: risk.band_counts.CRITICAL ?? 0,
    };
    initialSignals = patterns.patterns
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((p) => ({ signalType: p.signal_type, count: p.count }));
  } catch {
    // Landing page must still render (and sign-in must still work) even if
    // the backend is unreachable — the hero just shows "—" instead of numbers.
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
