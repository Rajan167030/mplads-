const features = [
  "Financial, execution & spatial signals combined",
  "Multilingual entity resolution across records",
  "Explainable risk assessment & audit trails",
];

const workflow = ["MPLADS DATA", "FINANCIAL · EXECUTION · SPATIAL SIGNALS", "RISK SCORE", "INVESTIGATION", "ACTION"];

export function HeroPanel() {
  return (
    <section className="dot-grid relative flex min-h-155 flex-col justify-between overflow-hidden bg-navy px-6 py-10 text-white sm:px-10 lg:min-h-0 lg:w-[44%] lg:px-12 lg:py-6">
      <div className="relative z-10 my-auto max-w-xl">
        <div className="mb-10 flex items-center gap-3">
          <div
            className="grid size-14 place-items-center rounded-xl border border-lime/30 bg-navy-deep text-2xl text-lime shadow-lg"
            aria-hidden="true"
          >
            ◉
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime">Government of India</div>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">MPLADS Intelligence</h1>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="font-display text-lg font-medium text-lime sm:text-xl">
            Multi-Signal Public Fund Monitoring &amp; Accountability
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
            We combine multiple independent signals — financial, execution, and spatial — to prioritize MPLADS
            projects for verification, with every score traceable back to the specific evidence behind it.
          </p>
        </div>

        <div className="mt-8 space-y-2.5">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-navy-deep/60 px-3 py-2 text-sm font-medium text-slate-100"
            >
              <span className="text-lime" aria-hidden="true">
                ◉
              </span>
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-9">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">Workflow Process</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-white/10 bg-navy-deep/50 px-3 py-3 font-mono text-[9px] font-bold text-lime sm:text-[10px]">
            {workflow.map((step, index) => (
              <span key={step} className="flex items-center gap-2">
                {step}
                {index < workflow.length - 1 && (
                  <span className="text-slate-500" aria-hidden="true">
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
