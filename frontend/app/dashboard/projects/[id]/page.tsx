import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ApiError, explainRisk, getProject, getProjectTimeline, getRelatedProjects } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-amber-50 text-amber-700 border-amber-200",
  MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = (await cookies()).get("mplads_token")?.value;

  let project;
  try {
    project = await getProject(id, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [timelineResult, explanationResult, relatedResult] = await Promise.allSettled([
    getProjectTimeline(id, token),
    explainRisk(id, token),
    getRelatedProjects(id, 5, token),
  ]);

  const timeline = timelineResult.status === "fulfilled" ? timelineResult.value : null;
  const explanation = explanationResult.status === "fulfilled" ? explanationResult.value : null;
  const related = relatedResult.status === "fulfilled" ? relatedResult.value : [];

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <Link href="/dashboard/projects" className="text-xs font-semibold text-dashboard-navy hover:underline">
          ← Back to Projects
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{project.project_name}</h1>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  project.data_source === "REAL_MPLADS" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {project.data_source === "REAL_MPLADS" ? "Real government data" : "Synthetic (demo)"}
              </span>
            </div>
            <p className="mt-1 text-sm text-dashboard-muted">
              {project.external_project_id} · {project.district}, {project.state} · {project.project_type.replace(/_/g, " ")}
              {project.mp_name && <> · MP: {project.mp_name}</>}
            </p>
          </div>
          {project.risk_band && project.risk_score !== null && (
            <span className={`rounded-lg border px-4 py-2 text-center ${SEVERITY_STYLES[project.risk_band] ?? ""}`}>
              <div className="text-2xl font-bold">{project.risk_score.toFixed(0)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider">{project.risk_band}</div>
            </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg bg-white p-5 shadow-sm sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Status" value={project.status} />
          <Stat label="Sanctioned" value={`₹${(project.sanctioned_amount / 100000).toFixed(1)}L`} />
          <Stat label="Released" value={`₹${(project.released_amount / 100000).toFixed(1)}L`} />
          <Stat label="Physical Progress" value={`${project.physical_progress.toFixed(0)}%`} />
          <Stat label="Financial Progress" value={`${project.financial_progress.toFixed(0)}%`} />
          <Stat label="Contractor" value={project.contractor_name ?? "Unassigned"} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="rounded-lg bg-white p-5 shadow-sm lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">✨ Why investigate this project?</h2>
              {explanation && (explanation.narrative_reasons?.length ?? 0) > 0 && (
                <span className="rounded bg-dashboard-blue-soft px-2 py-1 text-[10px] font-bold text-dashboard-navy">
                  Confidence: {((explanation.overall_confidence ?? 0) * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-dashboard-muted">
              Not "our AI flagged this" — every reason below traces to a specific financial, execution, or spatial
              signal, each independently detected and then combined into the {project.risk_score?.toFixed(0) ?? "—"}/100 score.
            </p>

            {explanation && (explanation.narrative_reasons?.length ?? 0) > 0 ? (
              <>
                <p className="mt-4 text-sm font-semibold">This project has been prioritized because:</p>
                <ol className="mt-2 space-y-2">
                  {explanation.narrative_reasons.map((reason, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="font-bold text-dashboard-navy">{i + 1}.</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ol>

                {(explanation.recommended_verification?.length ?? 0) > 0 && (
                  <div className="mt-4 rounded border border-dashboard-line bg-dashboard-surface p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-dashboard-muted">Recommended verification</p>
                    <ul className="mt-1.5 space-y-1">
                      {explanation.recommended_verification.map((action, i) => (
                        <li key={i} className="text-xs text-dashboard-ink">
                          • {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer font-semibold text-dashboard-navy">
                    Full signal detail ({explanation.contributing_signals?.length ?? 0})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {(explanation.contributing_signals ?? []).map((s, i) => (
                      <li key={i} className="rounded border border-dashboard-line p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{s.signal_type.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-dashboard-surface px-2 py-0.5 text-[10px] font-bold text-dashboard-muted">
                              {s.source}
                            </span>
                            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${SEVERITY_STYLES[s.severity] ?? ""}`}>
                              {s.severity}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1.5 text-xs text-dashboard-muted">{s.description}</p>
                        <div className="mt-1 text-[10px] text-dashboard-muted">
                          contribution: {(s.weighted_contribution * 100).toFixed(0)}% · confidence: {(s.confidence * 100).toFixed(0)}%
                        </div>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : (explanation?.contributing_signals?.length ?? 0) > 0 ? (
              <p className="mt-4 text-sm text-amber-700">
                This project has {explanation!.contributing_signals.length} risk signal(s), but a narrative
                explanation isn&apos;t available for it yet.
              </p>
            ) : (
              <p className="mt-4 text-sm text-dashboard-muted">No risk signals recorded for this project.</p>
            )}
          </section>

          <section className="rounded-lg bg-white p-5 shadow-sm lg:col-span-5">
            <h2 className="font-display text-lg font-semibold">Related Projects</h2>
            <p className="mt-1 text-xs text-dashboard-muted">Same contractor, agency, entity match, or nearby + same type.</p>
            {related.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {related.map((r) => (
                  <li key={r.project.id} className="rounded border border-dashboard-line p-2.5">
                    <Link href={`/dashboard/projects/${r.project.id}`} className="text-sm font-semibold text-dashboard-navy hover:underline">
                      {r.project.project_name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.relationship_types.map((t) => (
                        <span key={t} className="rounded bg-dashboard-surface px-1.5 py-0.5 text-[9px] font-bold text-dashboard-muted">
                          {t.replace(/_/g, " ")}
                        </span>
                      ))}
                      {r.distance_km !== null && (
                        <span className="rounded bg-dashboard-surface px-1.5 py-0.5 text-[9px] font-bold text-dashboard-muted">
                          {r.distance_km.toFixed(1)}km
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-dashboard-muted">No related projects found.</p>
            )}
          </section>
        </div>

        {timeline && (
          <section className="mt-5 rounded-lg bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Payment Timeline</h2>
            {timeline.payments.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase text-dashboard-muted">
                      <th className="py-1.5">Date</th>
                      <th className="py-1.5">Type</th>
                      <th className="py-1.5">Amount</th>
                      <th className="py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.payments.map((p) => (
                      <tr key={p.id} className="border-t border-dashboard-line/60">
                        <td className="py-1.5 text-dashboard-muted">{p.payment_date}</td>
                        <td className="py-1.5">{p.payment_type}</td>
                        <td className="py-1.5">₹{(p.amount / 100000).toFixed(2)}L</td>
                        <td className="py-1.5 text-dashboard-muted">{p.payment_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-dashboard-muted">No payments recorded.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
