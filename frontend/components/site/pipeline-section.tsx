import { AlertOctagon, Database, GitMerge, LayoutDashboard, ShieldCheck, SlidersHorizontal } from "lucide-react";

const stages = [
  {
    icon: Database,
    title: "Government data",
    description: "eSAKSHI portal exports — works completed & expenditure records, as officially reported.",
  },
  {
    icon: ShieldCheck,
    title: "Validation",
    description: "Schema checks, completeness scoring, and source-limitation gaps surfaced, not hidden.",
  },
  {
    icon: GitMerge,
    title: "Entity resolution",
    description: "Multilingual matching finds duplicate facilities across English, Hindi & regional-language records.",
  },
  {
    icon: SlidersHorizontal,
    title: "Rules + ML",
    description: "Deterministic rule checks combined with an Isolation Forest model trained on peer-group behavior.",
  },
  {
    icon: AlertOctagon,
    title: "Explainable risk score",
    description: "Every flag ships with the specific signals behind it — never a black-box number.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard & portal",
    description: "District authorities verify, dismiss, or confirm — human judgment stays the final call.",
  },
] as const;

export function PipelineSection() {
  return (
    <section id="how-it-works" className="border-t border-dashboard-line bg-white px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1400px]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dashboard-muted">
          How it works
        </span>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-dashboard-ink sm:text-3xl">
          From official records to an explainable risk flag
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-dashboard-muted">
          One pipeline, six stages — real government data in, a reasoned signal for human review out.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {stages.map((stage, index) => (
            <div key={stage.title} className="relative">
              <div className="flex h-full flex-col rounded-lg border border-dashboard-line bg-dashboard-surface p-4">
                <span className="grid size-9 place-items-center rounded-lg border border-dashboard-lime/30 bg-dashboard-navy text-dashboard-lime">
                  <stage.icon size={17} strokeWidth={2.2} />
                </span>
                <div className="mt-3 text-sm font-semibold text-dashboard-ink">
                  {String(index + 1).padStart(2, "0")} · {stage.title}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-dashboard-muted">{stage.description}</p>
              </div>
              {index < stages.length - 1 && (
                <span
                  className="absolute top-8.5 -right-3 hidden text-dashboard-line lg:block"
                  aria-hidden="true"
                >
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
