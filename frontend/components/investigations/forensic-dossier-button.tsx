"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Printer, ShieldAlert, X } from "lucide-react";
import { getProjectDossier, ProjectDossier } from "@/lib/api";

export function ForensicDossierButton({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<ProjectDossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setIsOpen(true);
    if (!dossier) {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectDossier(projectId);
        setDossier(data);
      } catch (err: any) {
        setError(err?.message || "Failed to generate forensic dossier");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50/80 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/80"
      >
        <FileText size={15} />
        Generate Statutory Forensic Dossier
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:p-0">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 print:max-h-none print:w-full print:rounded-none print:border-none print:p-8">
            {/* Header controls */}
            <div className="flex items-center justify-between border-b border-dashboard-border pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-red-600" size={20} />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Statutory Audit & Forensic Dossier
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {dossier && (
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Printer size={14} />
                    Print Case Brief
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {loading && (
              <div className="flex h-64 flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-red-600" />
                <span className="text-xs font-semibold text-dashboard-muted">
                  Synthesizing audit evidence & statutory clauses...
                </span>
              </div>
            )}

            {error && (
              <div className="my-6 rounded-lg bg-red-50 p-4 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}

            {dossier && (
              <div className="mt-4 space-y-6 text-slate-900 dark:text-slate-100">
                {/* Printable Official Letterhead */}
                <div className="border-b-2 border-slate-800 pb-4 dark:border-slate-600">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>CONFIDENTIAL // FOR OFFICIAL USE ONLY</span>
                    <span>Ref: {dossier.dossier_id}</span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                    MPLADS STATUTORY INVESTIGATION & AUDIT BRIEF
                  </h2>
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Prepared under Ministry of Statistics and Programme Implementation (MoSPI) Oversight Protocol
                  </div>
                </div>

                {/* Section 1: Project Metadata & Discrepancy Matrix */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Target Work & Execution Overview
                  </h4>
                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-800/60">
                    <div>
                      <div className="text-slate-500">Work ID:</div>
                      <div className="font-bold">{dossier.project.external_id}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">District / State:</div>
                      <div className="font-bold">{dossier.project.district}, {dossier.project.state}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Sanctioned Cost:</div>
                      <div className="font-bold">₹{dossier.project.sanctioned_amount.toLocaleString("en-IN")}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Physical vs Financial:</div>
                      <div className="font-bold text-red-600 dark:text-red-400">
                        {dossier.project.physical_progress}% Phys. / {dossier.project.financial_progress}% Fin.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Statutory Findings */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Specific Statutory Findings & Regulatory Breaches
                  </h4>
                  <div className="mt-2 space-y-2">
                    {dossier.statutory_findings.map((f, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {f.statutory_reference}
                          </span>
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
                            {f.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{f.observation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3: Contractor Profile */}
                {dossier.contractor && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      3. Contractor Entity Intelligence & Performance Record
                    </h4>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                      <div className="font-bold text-sm">{dossier.contractor.name}</div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300 sm:grid-cols-4">
                        <div>Total Works: {dossier.contractor.total_assigned_projects}</div>
                        <div>Delayed Works: {dossier.contractor.delayed_projects_count}</div>
                        <div>Risk Index: {dossier.contractor.risk_score}/100</div>
                        <div>
                          Nexus Status:{" "}
                          <span className={dossier.contractor.cartel_warning ? "font-bold text-red-600" : "text-emerald-600"}>
                            {dossier.contractor.cartel_warning ? "High Cartel Risk" : "Normal"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Recommended Administrative Actions */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    4. Directives for District Magistrate / Vigilance Cell
                  </h4>
                  <ul className="mt-2 list-inside list-disc space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100">
                    {dossier.recommended_actions.map((act, i) => (
                      <li key={i} className="leading-relaxed font-medium">
                        {act}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Signature Block */}
                <div className="mt-8 pt-8 border-t border-dashed border-slate-300 text-xs flex justify-between">
                  <div>
                    <div className="font-semibold">Prepared By:</div>
                    <div className="mt-4 text-slate-500">Automated Vigilance Analytics Module</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">Reviewing Officer (DM / DDO):</div>
                    <div className="mt-8 text-slate-400">Signature & Official Seal</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
