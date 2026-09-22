"use client";

import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Coins,
  FileCheck2,
  FileSearch,
  HelpCircle,
  IndianRupee,
  Layers,
  MapPin,
  Printer,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { PreSanctionPayload, PreSanctionResult, validatePreSanctionProposal } from "@/lib/api";

const PRESET_TEMPLATES = [
  {
    name: "✅ Permissible: Solar Drinking Water RO Plant",
    data: {
      project_name: "Installation of Solar-Powered Community RO Drinking Water Plant in Rampur Gram Panchayat",
      description: "Construction of 1000 LPH solar dual-pump water purification system for rural habitations lacking piped supply.",
      project_type: "DRINKING_WATER",
      state: "Uttar Pradesh",
      district: "Varanasi",
      estimated_cost: 1250000,
      latitude: 25.3176,
      longitude: 82.9739,
      target_beneficiary: "SC_HABITATION",
      implementing_agency: "District Rural Development Agency (DRDA)",
    },
  },
  {
    name: "⚠️ Conflict: Duplicate Road Overlay (<500m)",
    data: {
      project_name: "Construction of CC Road and side drain from Main Chowk to Panchayat Bhawan",
      description: "Concrete paving and drainage works for village link road.",
      project_type: "ROADS_BRIDGES",
      state: "Uttar Pradesh",
      district: "Varanasi",
      estimated_cost: 3800000,
      latitude: 25.3190,
      longitude: 82.9750,
      target_beneficiary: "GENERAL",
      implementing_agency: "Public Works Department (PWD)",
    },
  },
  {
    name: "❌ Prohibited: Religious Temple Mandir Renovation",
    data: {
      project_name: "Renovation and Marble Flooring of Ancient Shiva Temple Mandir Complex & Ashram",
      description: "Civil repair works, boundary wall and lighting for temple compound.",
      project_type: "COMMUNITY_INFRASTRUCTURE",
      state: "Uttar Pradesh",
      district: "Varanasi",
      estimated_cost: 1800000,
      latitude: 25.3100,
      longitude: 82.9800,
      target_beneficiary: "GENERAL",
      implementing_agency: "Zila Parishad",
    },
  },
  {
    name: "⚠️ Cost Anomaly: Inflated Community Shed (+180% SoR)",
    data: {
      project_name: "Construction of Multi-Purpose Open Community Shed and Paver Block Work",
      description: "Single-storey shed structure for public meetings.",
      project_type: "COMMUNITY_INFRASTRUCTURE",
      state: "Uttar Pradesh",
      district: "Varanasi",
      estimated_cost: 14500000,
      latitude: 25.3250,
      longitude: 82.9600,
      target_beneficiary: "ST_HABITATION",
      implementing_agency: "Municipal Corporation",
    },
  },
];

export default function PreSanctionPage() {
  const [formData, setFormData] = useState<PreSanctionPayload>({
    project_name: PRESET_TEMPLATES[0].data.project_name,
    description: PRESET_TEMPLATES[0].data.description,
    project_type: PRESET_TEMPLATES[0].data.project_type,
    state: PRESET_TEMPLATES[0].data.state,
    district: PRESET_TEMPLATES[0].data.district,
    estimated_cost: PRESET_TEMPLATES[0].data.estimated_cost,
    latitude: PRESET_TEMPLATES[0].data.latitude,
    longitude: PRESET_TEMPLATES[0].data.longitude,
    target_beneficiary: PRESET_TEMPLATES[0].data.target_beneficiary,
    implementing_agency: PRESET_TEMPLATES[0].data.implementing_agency,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreSanctionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleValidate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await validatePreSanctionProposal(formData);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to validate proposal");
    } finally {
      setLoading(false);
    }
  }

  function handlePrintCertificate() {
    window.print();
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashboard-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={22} />
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Pre-Sanction AI Gatekeeper
              </h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Proactive Oversight
              </span>
            </div>
            <p className="mt-1.5 text-sm text-dashboard-muted">
              Statutory compliance screener for District Magistrates (DM) and DPOs before committing administrative sanction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={handlePrintCertificate}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Printer size={15} />
                Print Clearance Slip
              </button>
            )}
          </div>
        </div>

        {/* Quick Scenario Picker */}
        <div className="rounded-xl border border-dashboard-border/80 bg-white p-4 shadow-sm dark:bg-slate-900/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-dashboard-muted">
            <Sparkles size={14} className="text-amber-500" />
            <span>Simulate Real-World Audit Test Scenarios:</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.name}
                onClick={() => {
                  setFormData(tmpl.data);
                  setResult(null);
                }}
                className="rounded-lg border border-dashboard-border bg-slate-50/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-800 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {tmpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid: Input Form + Result Card */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Form */}
          <div className="space-y-4 lg:col-span-6">
            <form
              onSubmit={handleValidate}
              className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80"
            >
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                <FileSearch size={18} className="text-blue-500" />
                Work Proposal Parameters
              </h2>
              <p className="mt-0.5 text-xs text-dashboard-muted">
                Enter proposed project metadata to run multi-factor automated verification.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Project Title / Scope of Work *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    placeholder="e.g. Construction of Community Hall at Village X"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Technical Description / Justification
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    placeholder="Detailed scope, durability specs, or village context..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Sector / Project Type *
                    </label>
                    <select
                      value={formData.project_type}
                      onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    >
                      <option value="DRINKING_WATER">Drinking Water Facility</option>
                      <option value="EDUCATION">Education / School Infrastructure</option>
                      <option value="HEALTH">Public Health / Clinic</option>
                      <option value="SANITATION">Sanitation & Drainage</option>
                      <option value="ROADS_BRIDGES">Roads, Bridges & Pathways</option>
                      <option value="COMMUNITY_INFRASTRUCTURE">Community Hall / Infrastructure</option>
                      <option value="ELECTRICITY_RENEWABLE">Solar / Renewable Energy</option>
                      <option value="OTHER">Other Permissible Asset</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Estimated Cost (INR ₹) *
                    </label>
                    <div className="relative mt-1">
                      <IndianRupee size={15} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="number"
                        required
                        min={10000}
                        value={formData.estimated_cost}
                        onChange={(e) => setFormData({ ...formData, estimated_cost: Number(e.target.value) })}
                        className="w-full rounded-lg border border-dashboard-border bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Target State *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Target District *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Beneficiary Quota Focus
                    </label>
                    <select
                      value={formData.target_beneficiary}
                      onChange={(e) => setFormData({ ...formData, target_beneficiary: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    >
                      <option value="GENERAL">General Public Asset</option>
                      <option value="SC_HABITATION">SC Habitation (15% Mandatory Quota)</option>
                      <option value="ST_HABITATION">ST Habitation (7.5% Mandatory Quota)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Implementing Agency
                    </label>
                    <input
                      type="text"
                      value={formData.implementing_agency || ""}
                      onChange={(e) => setFormData({ ...formData, implementing_agency: e.target.value })}
                      placeholder="e.g. DRDA / PWD / Zila Parishad"
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Proposed Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? Number(e.target.value) : undefined })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Proposed Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude ?? ""}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? Number(e.target.value) : undefined })}
                      className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={17} className="animate-spin" />
                      Running Multi-Vector AI Verification...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Verify Statutory Clearance & Sanction Eligibility
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Verification Results Panel */}
          <div className="space-y-4 lg:col-span-6">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <div className="font-bold">Validation Error</div>
                <div>{error}</div>
              </div>
            )}

            {!result && !loading && (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-dashboard-border bg-white/50 p-8 text-center dark:bg-slate-900/30">
                <div className="grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileCheck2 size={32} />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
                  Awaiting Proposal Verification
                </h3>
                <p className="mt-1 max-w-sm text-xs text-dashboard-muted">
                  Click <strong>&quot;Verify Statutory Clearance&quot;</strong> or pick a simulation preset above to evaluate against official MPLADS 2023 Guidelines.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Decision Banner */}
                <div
                  className={`rounded-2xl border p-5 shadow-sm ${
                    result.clearance_color === "green"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100"
                      : result.clearance_color === "amber"
                      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {result.clearance_color === "green" && <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />}
                      {result.clearance_color === "amber" && <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />}
                      {result.clearance_color === "red" && <AlertOctagon size={24} className="text-red-600 dark:text-red-400" />}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider opacity-80">Clearance Status</div>
                        <div className="font-display text-lg font-bold">
                          {result.clearance_status.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-white/60 px-3 py-1 font-mono text-xs font-bold text-slate-800 shadow-sm dark:bg-black/40 dark:text-slate-200">
                      {result.clearance_token}
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed font-medium">
                    {result.recommendation}
                  </p>
                </div>

                {/* Statutory Guideline Rule Checks */}
                <div className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80">
                  <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                    <Scale size={16} className="text-indigo-500" />
                    MPLADS 2023 Guidelines Verification Matrix
                  </h3>
                  <div className="mt-3 space-y-2">
                    {result.guideline_checks.map((gc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-dashboard-border/60 bg-slate-50/50 p-2.5 text-xs dark:bg-slate-800/50"
                      >
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{gc.check}</div>
                          <div className="text-[11px] text-dashboard-muted">{gc.details}</div>
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 font-bold ${
                            gc.status === "PASS"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {gc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Violations & Conflicts (if any) */}
                {result.violations.length > 0 && (
                  <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm dark:border-red-900/60 dark:bg-slate-900/80">
                    <h3 className="flex items-center gap-2 font-display text-sm font-bold text-red-600 dark:text-red-400">
                      <ShieldAlert size={16} />
                      Statutory Violations & Duplicate Conflicts ({result.violations.length})
                    </h3>
                    <div className="mt-3 space-y-3">
                      {result.violations.map((v, i) => (
                        <div key={i} className="rounded-lg border border-red-100 bg-red-50/60 p-3 text-xs dark:border-red-900/40 dark:bg-red-950/20">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-red-900 dark:text-red-300">{v.rule}</span>
                            <span className="rounded bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-900 dark:bg-red-900 dark:text-red-200">{v.clause}</span>
                          </div>
                          <p className="mt-1 text-slate-700 dark:text-slate-300">{v.explanation}</p>
                          {v.conflicts && (
                            <div className="mt-2 space-y-1.5 border-t border-red-200/60 pt-2">
                              {v.conflicts.map((c: any, ci: number) => (
                                <div key={ci} className="flex items-center justify-between rounded bg-white/80 p-1.5 text-[11px] font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-200">
                                  <span>#{c.existing_project_id}: {c.existing_project_name}</span>
                                  <span className="font-bold text-amber-700 dark:text-amber-400">{c.reason}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cost Analysis & PWD SoR Benchmarks */}
                <div className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80">
                  <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                    <Coins size={16} className="text-amber-500" />
                    PWD Schedule of Rates (SoR) & Cost Benchmark
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div className="rounded-lg border border-dashboard-border bg-slate-50 p-3 dark:bg-slate-800">
                      <div className="text-dashboard-muted">Proposed Estimate</div>
                      <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                        ₹{result.cost_analysis.proposed_cost.toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashboard-border bg-slate-50 p-3 dark:bg-slate-800">
                      <div className="text-dashboard-muted">District Historical Avg</div>
                      <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                        ₹{Math.round(result.cost_analysis.district_historical_avg).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashboard-border bg-slate-50 p-3 dark:bg-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-dashboard-muted">Variance Ratio</div>
                      <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                        {result.cost_analysis.cost_variance_ratio}x Median
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
