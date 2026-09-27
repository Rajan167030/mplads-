"use client";

import { useState, useEffect } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Coins,
  Copy,
  Check,
  Download,
  FileCheck2,
  FileSearch,
  HelpCircle,
  IndianRupee,
  Info,
  Layers,
  MapPin,
  Printer,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
  BookOpen,
  BarChart3,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import {
  PreSanctionPayload,
  PreSanctionResult,
  validatePreSanctionProposal,
  getPreSanctionGuidelines,
} from "@/lib/api";

interface PresetTemplate {
  name: string;
  badge: string;
  badgeColor: string;
  data: PreSanctionPayload;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    name: "Solar Drinking Water RO Plant",
    badge: "✅ Permissible",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
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
    name: "Duplicate Road Overlay (<500m)",
    badge: "⚠️ Proximity Conflict",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
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
    name: "Religious Mandir Renovation",
    badge: "❌ Prohibited",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    data: {
      project_name: "Renovation and Marble Flooring of Ancient Shiva Temple Mandir Complex & Ashram",
      description: "Civil repair works, boundary wall and decorative lighting for temple compound.",
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
    name: "Inflated Community Shed (+180% SoR)",
    badge: "⚠️ Cost Anomaly",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    data: {
      project_name: "Construction of Multi-Purpose Open Community Shed and Paver Block Work",
      description: "Single-storey shed structure for public meetings and cultural gatherings.",
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
  {
    name: "PHC Diagnostic Wing & Solar Backup",
    badge: "✅ Critical Health",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    data: {
      project_name: "Establishment of Modern Diagnostic Lab and 10kVA Solar Microgrid at Block PHC",
      description: "Diagnostic equipment room, pathology lab, cold-chain immunization backup power.",
      project_type: "HEALTH",
      state: "Uttar Pradesh",
      district: "Gorakhpur",
      estimated_cost: 4200000,
      latitude: 26.7606,
      longitude: 83.3732,
      target_beneficiary: "GENERAL",
      implementing_agency: "Chief Medical Officer (CMO) Health Dept",
    },
  },
  {
    name: "Office Furniture & SUV Purchase",
    badge: "❌ Consumable Violation",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    data: {
      project_name: "Procurement of Luxury SUV Vehicle, Fuel Allowance and Office Executive Furniture",
      description: "Inspection vehicle purchase, driver honorarium, and executive leather chairs for zonal camp office.",
      project_type: "OTHER",
      state: "Uttar Pradesh",
      district: "Lucknow",
      estimated_cost: 3200000,
      latitude: 26.8467,
      longitude: 80.9462,
      target_beneficiary: "GENERAL",
      implementing_agency: "Special Area Development Authority",
    },
  },
];

const POPULAR_DISTRICTS: Record<string, { lat: number; lng: number; state: string }> = {
  Varanasi: { lat: 25.3176, lng: 82.9739, state: "Uttar Pradesh" },
  Gorakhpur: { lat: 26.7606, lng: 83.3732, state: "Uttar Pradesh" },
  Prayagraj: { lat: 25.4358, lng: 81.8463, state: "Uttar Pradesh" },
  Lucknow: { lat: 26.8467, lng: 80.9462, state: "Uttar Pradesh" },
  Patna: { lat: 25.5941, lng: 85.1376, state: "Bihar" },
  Bhopal: { lat: 23.2599, lng: 77.4126, state: "Madhya Pradesh" },
};

function formatINR(val: number) {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} Lakh`;
  }
  return `₹${val.toLocaleString("en-IN")}`;
}

export default function PreSanctionPage() {
  const [formData, setFormData] = useState<PreSanctionPayload>(PRESET_TEMPLATES[0].data);
  const [activeTab, setActiveTab] = useState<"screener" | "guidelines" | "benchmarks" | "certificate">("screener");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreSanctionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Guidelines DB cache
  const [guidelinesData, setGuidelinesData] = useState<any>(null);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);

  useEffect(() => {
    async function fetchGuidelines() {
      setGuidelinesLoading(true);
      try {
        const data = await getPreSanctionGuidelines();
        setGuidelinesData(data);
      } catch {
        // Fallback safely
      } finally {
        setGuidelinesLoading(false);
      }
    }
    fetchGuidelines();
  }, []);

  async function handleValidate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await validatePreSanctionProposal(formData);
      setResult(res);
      setActiveTab("screener");
    } catch (err: any) {
      setError(err?.message || "Failed to validate proposal");
    } finally {
      setLoading(false);
    }
  }

  function handleDistrictQuickSelect(districtName: string) {
    const d = POPULAR_DISTRICTS[districtName];
    if (d) {
      setFormData((prev) => ({
        ...prev,
        district: districtName,
        state: d.state,
        latitude: d.lat,
        longitude: d.lng,
      }));
    }
  }

  function handleCopyToken() {
    if (!result?.clearance_token) return;
    navigator.clipboard.writeText(result.clearance_token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  }

  function handlePrintCertificate() {
    window.print();
  }

  function handleDownloadJSON() {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ proposal: formData, audit_evaluation: result }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MPLADS_Clearance_${result.clearance_token || "Report"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Calculate score index (0 to 100)
  const readinessScore = result
    ? result.clearance_color === "green"
      ? 96
      : result.clearance_color === "amber"
      ? 48
      : 12
    : null;

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      {/* Print-only CSS style */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-clearance-dossier,
          #print-clearance-dossier * {
            visibility: visible;
          }
          #print-clearance-dossier {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 24px;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashboard-border/70 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-sm ring-1 ring-emerald-500/20 dark:text-emerald-400">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                    Pre-Sanction AI Gatekeeper
                  </h1>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    MPLADS 2023 Statutory Screener
                  </span>
                </div>
                <p className="mt-1 text-xs text-dashboard-muted sm:text-sm">
                  Proactive decision support for District Authorities (DM/DC/DPO) to block duplicate, prohibited, or inflated works before administrative sanction.
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2.5">
            {result && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadJSON}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title="Download JSON dossier"
                >
                  <Download size={14} />
                  Export Dossier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("certificate");
                    setTimeout(() => window.print(), 150);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <Printer size={14} />
                  Print Clearance Slip
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-dashboard-border/60 pb-2">
          <button
            onClick={() => setActiveTab("screener")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "screener"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <ShieldCheck size={16} />
            Proposal Evaluation & Screener
            {result && (
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  result.clearance_color === "green"
                    ? "bg-emerald-100 text-emerald-800"
                    : result.clearance_color === "amber"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {result.clearance_color.toUpperCase()}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("guidelines")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "guidelines"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <BookOpen size={16} />
            2023 Statutory Guidelines Explorer
          </button>

          <button
            onClick={() => setActiveTab("benchmarks")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              activeTab === "benchmarks"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <BarChart3 size={16} />
            PWD Rate Benchmarks (SoR)
          </button>

          {result && (
            <button
              onClick={() => setActiveTab("certificate")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "certificate"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <FileCheck2 size={16} />
              Clearance Certificate Slip
            </button>
          )}
        </div>

        {/* ──────────── TAB 1: SCREENER & EVALUATION ──────────── */}
        {activeTab === "screener" && (
          <div className="space-y-6">
            {/* Quick Simulation Presets */}
            <div className="rounded-2xl border border-dashboard-border bg-white p-4 shadow-sm dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <Sparkles size={15} className="text-amber-500" />
                  <span>Interactive Audit Presets (Click to Simulate):</span>
                </div>
                <span className="text-[11px] text-dashboard-muted">
                  6 Real-world scenarios pre-calibrated with GPS coordinates
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {PRESET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => {
                      setFormData(tmpl.data);
                      setResult(null);
                      setError(null);
                    }}
                    className="group flex flex-col items-start rounded-xl border border-dashboard-border bg-slate-50/70 p-3 text-left transition hover:border-emerald-500 hover:bg-emerald-50/40 dark:bg-slate-800/60 dark:hover:border-emerald-500/50 dark:hover:bg-slate-800"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${tmpl.badgeColor}`}>
                        {tmpl.badge}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {formatINR(tmpl.data.estimated_cost)}
                      </span>
                    </div>
                    <div className="mt-1.5 font-display text-xs font-bold text-slate-900 transition group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                      {tmpl.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-dashboard-muted line-clamp-1">
                      {tmpl.data.district}, {tmpl.data.state} • {tmpl.data.project_type.replace(/_/g, " ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Grid: Form + Verification Results */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Proposal Input Form */}
              <div className="space-y-4 lg:col-span-6">
                <form
                  onSubmit={handleValidate}
                  className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80"
                >
                  <div className="flex items-center justify-between border-b border-dashboard-border/60 pb-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                        <FileSearch size={18} className="text-emerald-600 dark:text-emerald-400" />
                        Proposal Dossier Parameters
                      </h2>
                      <p className="mt-0.5 text-xs text-dashboard-muted">
                        Statutory fields mandated under MPLADS Guidelines Section 3 & 4.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          project_name: "",
                          description: "",
                          project_type: "DRINKING_WATER",
                          state: "Uttar Pradesh",
                          district: "Varanasi",
                          estimated_cost: 1000000,
                          latitude: 25.3176,
                          longitude: 82.9739,
                          target_beneficiary: "GENERAL",
                          implementing_agency: "",
                        });
                        setResult(null);
                      }}
                      className="text-xs text-dashboard-muted hover:text-slate-900 dark:hover:text-white"
                    >
                      Reset Form
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {/* Project Title */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Work Title / Proposed Asset *
                        </label>
                        <span className="text-[10px] text-dashboard-muted">
                          {formData.project_name.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        required
                        value={formData.project_name}
                        onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                        placeholder="e.g. Construction of Community RO Drinking Water Plant in Village X"
                      />
                    </div>

                    {/* Technical Description */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Technical Scope & Justification
                      </label>
                      <textarea
                        rows={2}
                        value={formData.description || ""}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                        placeholder="Capacity specs, civil dimensions, durability standard..."
                      />
                    </div>

                    {/* Sector & Estimated Cost */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Asset Sector *
                        </label>
                        <select
                          value={formData.project_type}
                          onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                        >
                          <option value="DRINKING_WATER">Drinking Water Facility (Priority)</option>
                          <option value="EDUCATION">Education / School Infrastructure</option>
                          <option value="HEALTH">Public Health & Clinics (Priority)</option>
                          <option value="SANITATION">Sanitation & Solid Waste</option>
                          <option value="ROADS_BRIDGES">Roads, Bridges & Pathways</option>
                          <option value="COMMUNITY_INFRASTRUCTURE">Community Hall / Infrastructure</option>
                          <option value="ELECTRICITY_RENEWABLE">Solar & Renewable Energy</option>
                          <option value="OTHER">Other Permissible Asset</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Estimated Cost (INR) *
                          </label>
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {formatINR(Number(formData.estimated_cost) || 0)}
                          </span>
                        </div>
                        <div className="relative mt-1">
                          <IndianRupee size={15} className="absolute left-3 top-3 text-slate-400" />
                          <input
                            type="number"
                            required
                            min={10000}
                            step={5000}
                            value={formData.estimated_cost}
                            onChange={(e) =>
                              setFormData({ ...formData, estimated_cost: Number(e.target.value) })
                            }
                            className="w-full rounded-xl border border-dashboard-border bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* District & State + Quick Select */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Target District *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.district}
                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            State *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* District Quick Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-dashboard-muted">Quick location:</span>
                        {Object.keys(POPULAR_DISTRICTS).map((dName) => (
                          <button
                            key={dName}
                            type="button"
                            onClick={() => handleDistrictQuickSelect(dName)}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${
                              formData.district.toLowerCase() === dName.toLowerCase()
                                ? "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-300"
                                : "border-dashboard-border bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {dName}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Beneficiary Quota & Implementing Agency */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Mandatory Quota Focus
                        </label>
                        <select
                          value={formData.target_beneficiary}
                          onChange={(e) => setFormData({ ...formData, target_beneficiary: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
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
                          className="mt-1 w-full rounded-xl border border-dashboard-border bg-white p-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Proposed GPS Coordinates */}
                    <div className="rounded-xl border border-dashboard-border/80 bg-slate-50/70 p-3 dark:bg-slate-800/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <MapPin size={14} className="text-emerald-500" />
                          Geospatial Site Coordinates (Anti-Duplication)
                        </div>
                        <span className="text-[10px] text-dashboard-muted">
                          Scans 800m radial perimeter
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-dashboard-muted">
                            Latitude (°N)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={formData.latitude ?? ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                latitude: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-xs font-mono font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                            placeholder="25.3176"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-dashboard-muted">
                            Longitude (°E)
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={formData.longitude ?? ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                longitude: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-dashboard-border bg-white p-2 text-xs font-mono font-medium text-slate-900 focus:border-emerald-500 focus:outline-none dark:bg-slate-800 dark:text-white"
                            placeholder="82.9739"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw size={18} className="animate-spin" />
                          Running Multi-Vector AI Gatekeeper Screener...
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={19} />
                          Evaluate Statutory Clearance & Eligibility
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Verification Results Panel */}
              <div className="space-y-4 lg:col-span-6">
                {error && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
                    <div className="flex items-center gap-2 font-bold">
                      <XCircle size={18} />
                      Validation Failed
                    </div>
                    <div className="mt-1 text-xs">{error}</div>
                  </div>
                )}

                {/* Empty State / Awaiting Evaluation */}
                {!result && !loading && (
                  <div className="flex h-full min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-dashboard-border bg-white/60 p-8 text-center shadow-sm dark:bg-slate-900/40">
                    <div className="grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-inner dark:text-emerald-400">
                      <FileCheck2 size={36} />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
                      Statutory Clearance Engine Ready
                    </h3>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-dashboard-muted">
                      Select any simulation preset above or enter custom project parameters. The Gatekeeper will verify compliance with <strong>MPLADS 2023 Guidelines</strong>, check against existing projects within 800m, and benchmark rates against District PWD Schedule of Rates.
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-500" /> Prohibited Works Screening
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <MapPin size={13} className="text-blue-500" /> Proximity & Duplicate Radar
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Scale size={13} className="text-amber-500" /> PWD SoR Variance Benchmark
                      </span>
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {loading && (
                  <div className="flex h-full min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashboard-border bg-white p-8 text-center shadow-sm dark:bg-slate-900/50">
                    <div className="relative">
                      <div className="size-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                      <ShieldCheck size={28} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600" />
                    </div>
                    <h3 className="mt-5 font-display text-base font-bold text-slate-900 dark:text-white">
                      Screening Proposal Across 3 Defense Vectors
                    </h3>
                    <p className="mt-1 text-xs text-dashboard-muted">
                      Checking prohibited terms • Scanning nearby GPS coordinates • Evaluating SoR cost ratios...
                    </p>
                  </div>
                )}

                {/* Populated Result Card */}
                {result && !loading && (
                  <div className="space-y-4">
                    {/* Primary Decision Banner */}
                    <div
                      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition ${
                        result.clearance_color === "green"
                          ? "border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 text-emerald-950 dark:border-emerald-800/80 dark:from-emerald-950/50 dark:via-slate-900 dark:to-emerald-950/20 dark:text-emerald-100"
                          : result.clearance_color === "amber"
                          ? "border-amber-300 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 text-amber-950 dark:border-amber-800/80 dark:from-amber-950/50 dark:via-slate-900 dark:to-amber-950/20 dark:text-amber-100"
                          : "border-rose-300 bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40 text-rose-950 dark:border-rose-800/80 dark:from-rose-950/50 dark:via-slate-900 dark:to-rose-950/20 dark:text-rose-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid size-12 place-items-center rounded-xl shadow-sm ${
                              result.clearance_color === "green"
                                ? "bg-emerald-600 text-white shadow-emerald-500/30"
                                : result.clearance_color === "amber"
                                ? "bg-amber-500 text-white shadow-amber-500/30"
                                : "bg-rose-600 text-white shadow-rose-500/30"
                            }`}
                          >
                            {result.clearance_color === "green" && <CheckCircle2 size={28} />}
                            {result.clearance_color === "amber" && <AlertTriangle size={28} />}
                            {result.clearance_color === "red" && <AlertOctagon size={28} />}
                          </div>

                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                              Pre-Sanction Clearance Verdict
                            </div>
                            <div className="font-display text-xl font-bold tracking-tight">
                              {result.clearance_status === "APPROVED_FOR_SANCTION"
                                ? "Approved for Administrative Sanction"
                                : result.clearance_status === "CONDITIONAL_REVIEW_REQUIRED"
                                ? "Conditional Review / Inspection Required"
                                : "Prohibited — Sanction Rejected"}
                            </div>
                          </div>
                        </div>

                        {/* Clearance Token Badge with Copy */}
                        <div className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white/80 px-2.5 py-1.5 shadow-sm dark:bg-black/40">
                          <div className="text-right">
                            <div className="text-[9px] font-bold uppercase text-dashboard-muted">Token ID</div>
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                              {result.clearance_token}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyToken}
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700"
                            title="Copy Clearance Token"
                          >
                            {copiedToken ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Recommendation text */}
                      <p className="mt-3.5 text-xs font-medium leading-relaxed">
                        {result.recommendation}
                      </p>

                      {/* Readiness Score Bar */}
                      <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold opacity-80">Statutory Compliance Index</span>
                          <span className="font-display font-bold">
                            {readinessScore} / 100
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              result.clearance_color === "green"
                                ? "bg-emerald-500"
                                : result.clearance_color === "amber"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${readinessScore}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Guideline Checks Matrix */}
                    <div className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                          <Scale size={16} className="text-indigo-500" />
                          MPLADS 2023 Guidelines Verification Matrix
                        </h3>
                        <span className="text-[11px] text-dashboard-muted">Section 2 & 5 Screening</span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {result.guideline_checks.map((gc, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between gap-3 rounded-xl border border-dashboard-border/70 bg-slate-50/60 p-2.5 text-xs dark:bg-slate-800/50"
                          >
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {gc.check}
                              </div>
                              <div className="text-[11px] text-dashboard-muted leading-tight">
                                {gc.details}
                              </div>
                            </div>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                                gc.status === "PASS"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {gc.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Violations / Prohibitions / Conflicts */}
                    {result.violations.length > 0 && (
                      <div className="rounded-2xl border border-rose-300 bg-white p-5 shadow-sm dark:border-rose-900/60 dark:bg-slate-900/80">
                        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-rose-600 dark:text-rose-400">
                          <ShieldAlert size={17} />
                          Statutory Violations & Duplicate Conflicts ({result.violations.length})
                        </h3>

                        <div className="mt-3 space-y-3">
                          {result.violations.map((v, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-3.5 text-xs dark:border-rose-900/40 dark:bg-rose-950/20"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-rose-900 dark:text-rose-200">{v.rule}</span>
                                <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:bg-rose-900 dark:text-rose-200">
                                  {v.clause}
                                </span>
                              </div>

                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                                {v.explanation}
                              </p>

                              {v.matched_terms && v.matched_terms.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">
                                    Flagged Terms:
                                  </span>
                                  {v.matched_terms.map((term: string, ti: number) => (
                                    <span
                                      key={ti}
                                      className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                                    >
                                      {term}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {v.conflicts && v.conflicts.length > 0 && (
                                <div className="mt-2.5 space-y-1.5 border-t border-rose-200/60 pt-2.5 dark:border-rose-900/40">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    Conflicting Sanction Records Nearby:
                                  </div>
                                  {v.conflicts.map((c: any, ci: number) => (
                                    <div
                                      key={ci}
                                      className="flex flex-wrap items-center justify-between rounded-lg bg-white/90 p-2 text-[11px] font-medium text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      <div>
                                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                          #{c.existing_project_id}
                                        </span>{" "}
                                        - {c.existing_project_name}
                                        {c.distance_km !== null && (
                                          <span className="ml-1 text-slate-500">
                                            ({Math.round(c.distance_km * 1000)}m away)
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {c.reason}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings (if any) */}
                    {result.warnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/60 dark:bg-slate-900/80">
                        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={16} />
                          Advisory Warnings ({result.warnings.length})
                        </h3>
                        <div className="mt-3 space-y-2">
                          {result.warnings.map((w, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/20"
                            >
                              <div className="font-bold text-amber-900 dark:text-amber-300">
                                {w.type.replace(/_/g, " ")}
                              </div>
                              <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                                {w.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cost Analysis & PWD SoR Benchmarks */}
                    <div className="rounded-2xl border border-dashboard-border bg-white p-5 shadow-sm dark:bg-slate-900/80">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                          <Coins size={16} className="text-amber-500" />
                          PWD Schedule of Rates (SoR) & Cost Benchmark
                        </h3>
                        <span className="text-[11px] text-dashboard-muted">
                          Ratio: {result.cost_analysis.cost_variance_ratio}x District Median
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                        <div className="rounded-xl border border-dashboard-border bg-slate-50/70 p-3 dark:bg-slate-800/60">
                          <div className="text-dashboard-muted">Proposed Estimate</div>
                          <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                            {formatINR(result.cost_analysis.proposed_cost)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-dashboard-border bg-slate-50/70 p-3 dark:bg-slate-800/60">
                          <div className="text-dashboard-muted">District Historical Avg</div>
                          <div className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                            {formatINR(Math.round(result.cost_analysis.district_historical_avg))}
                          </div>
                        </div>

                        <div className="col-span-2 rounded-xl border border-dashboard-border bg-slate-50/70 p-3 sm:col-span-1 dark:bg-slate-800/60">
                          <div className="text-dashboard-muted">Cost Status</div>
                          <div
                            className={`mt-1 font-display text-sm font-bold ${
                              result.cost_analysis.status === "NORMAL"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {result.cost_analysis.status.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>

                      {/* Benchmark Range Slider */}
                      <div className="mt-3 rounded-xl border border-dashboard-border/60 bg-slate-50/40 p-3 text-[11px] dark:bg-slate-800/40">
                        <div className="flex items-center justify-between text-dashboard-muted">
                          <span>
                            Sector Floor: {formatINR(result.cost_analysis.sector_standard_range.min)}
                          </span>
                          <span>
                            Sector Ceiling: {formatINR(result.cost_analysis.sector_standard_range.max)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────────── TAB 2: GUIDELINES EXPLORER ──────────── */}
        {activeTab === "guidelines" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-dashboard-border bg-white p-6 shadow-sm dark:bg-slate-900/80">
              <div className="max-w-3xl">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Statutory Compendium
                </span>
                <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                  Official MPLADS Guidelines 2023 — Permissible & Prohibited Framework
                </h2>
                <p className="mt-1 text-xs text-dashboard-muted sm:text-sm">
                  Issued by the Ministry of Statistics and Programme Implementation (MoSPI). Works must strictly adhere to the durable community asset criteria below.
                </p>
              </div>

              {/* Statutory Quotas Banner */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-indigo-900 dark:text-indigo-200">
                    <Users size={16} />
                    Mandatory 15% SC Habitation Quota (Section 2.5)
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    At least 15% of annual MPLADS allocation must be earmarked for works in Scheduled Caste inhabited areas.
                  </p>
                </div>

                <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-xs dark:border-teal-900/60 dark:bg-teal-950/30">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-teal-900 dark:text-teal-200">
                    <Users size={16} />
                    Mandatory 7.5% ST Habitation Quota (Section 2.5)
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">
                    At least 7.5% of annual MPLADS funds must be utilized for asset creation in Scheduled Tribe inhabited habitations.
                  </p>
                </div>
              </div>

              {/* Permissible Sectors Table */}
              <div className="mt-8 space-y-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  Permissible Sectors & Standard Benchmark Limits
                </h3>

                <div className="overflow-x-auto rounded-xl border border-dashboard-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="p-3">Sector</th>
                        <th className="p-3">Priority Tier</th>
                        <th className="p-3">Cost Ceiling / Benchmark Band</th>
                        <th className="p-3">Statutory Clause Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashboard-border/60">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Drinking Water Supply</td>
                        <td className="p-3">
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            CRITICAL
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹50,000 - ₹25,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.1 - Core Civic Infrastructure</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Education & Digital Classrooms</td>
                        <td className="p-3">
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            HIGH
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹2,00,000 - ₹50,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.2 - Durable Educational Assets</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Public Health & Diagnostic Care</td>
                        <td className="p-3">
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            CRITICAL
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹3,00,000 - ₹80,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.3 - Public Health Infrastructure</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Sanitation & Solid Waste Management</td>
                        <td className="p-3">
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            HIGH
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹1,00,000 - ₹30,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.4 - Public Sanitation & Waste</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Roads, Bridges & Pathways</td>
                        <td className="p-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                            STANDARD
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹5,00,000 - ₹1,50,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.6 - Rural / Urban Connectivity</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">Solar & Renewable Microgrids</td>
                        <td className="p-3">
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            HIGH
                          </span>
                        </td>
                        <td className="p-3 font-mono font-medium">₹1,50,000 - ₹40,00,000</td>
                        <td className="p-3 text-dashboard-muted">Clause 2.8 - Solar & Renewable</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strictly Prohibited Categories */}
              <div className="mt-8 space-y-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-rose-600 dark:text-rose-400">
                  <XCircle size={18} />
                  Strictly Prohibited Items (Clause 5.1 - 5.3)
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                    <div className="font-bold text-rose-900 dark:text-rose-200">
                      1. Places of Worship / Religious Sites
                    </div>
                    <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                      Clause 5.1 (Statutory Ban)
                    </div>
                    <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                      Temples, mosques, churches, gurudwaras, ashrams, mutts, kabristans, memorials, or any faith-based religious infrastructure.
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                    <div className="font-bold text-rose-900 dark:text-rose-200">
                      2. Commercial & Private Property
                    </div>
                    <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                      Clause 5.2 (Public Asset Rule)
                    </div>
                    <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                      Shopping malls, hotels, private clubs, corporate offices, political party offices, or assets on privately held land without deed transfer.
                    </p>
                  </div>

                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20">
                    <div className="font-bold text-rose-900 dark:text-rose-200">
                      3. Non-Durable & Consumable Expenses
                    </div>
                    <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">
                      Clause 5.3 (Durable Asset Only)
                    </div>
                    <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
                      Salaries, honorariums, fuel, stationery, vehicle purchases (cars, SUVs), inventory, or repair of private vehicles.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────── TAB 3: PWD RATE BENCHMARKS (SoR) ──────────── */}
        {activeTab === "benchmarks" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-dashboard-border bg-white p-6 shadow-sm dark:bg-slate-900/80">
              <div className="max-w-2xl">
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  PWD Schedule of Rates
                </span>
                <h2 className="mt-2 font-display text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                  District Engineering Benchmark Engine
                </h2>
                <p className="mt-1 text-xs text-dashboard-muted sm:text-sm">
                  Historical sanction distributions and statistical ceilings to identify over-invoicing and unrealistic low bids.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-dashboard-border bg-slate-50 p-4 dark:bg-slate-800">
                  <div className="text-xs text-dashboard-muted">Current Focus District</div>
                  <div className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                    {formData.district}, {formData.state}
                  </div>
                </div>

                <div className="rounded-xl border border-dashboard-border bg-slate-50 p-4 dark:bg-slate-800">
                  <div className="text-xs text-dashboard-muted">Sanction Outlier Threshold</div>
                  <div className="mt-1 font-display text-lg font-bold text-amber-600 dark:text-amber-400">
                    &gt; 1.50x SoR Ceiling
                  </div>
                  <span className="text-[10px] text-dashboard-muted">Requires technical re-sanction</span>
                </div>

                <div className="rounded-xl border border-dashboard-border bg-slate-50 p-4 dark:bg-slate-800">
                  <div className="text-xs text-dashboard-muted">Under-Invoicing Risk Floor</div>
                  <div className="mt-1 font-display text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    &lt; 0.40x Minimum
                  </div>
                  <span className="text-[10px] text-dashboard-muted">Sub-standard work risk</span>
                </div>
              </div>

              {/* Rate Analysis Steps */}
              <div className="mt-6 rounded-xl border border-dashboard-border/80 bg-slate-50/50 p-4 text-xs dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  Statutory Rate Vetting Workflow:
                </h4>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-slate-600 dark:text-slate-400 leading-relaxed">
                  <li><strong>Preliminary Screening:</strong> Verify whether proposed cost falls within sector permissible band.</li>
                  <li><strong>Detailed Engineering Estimate (DEE):</strong> For works &gt; ₹25 Lakhs, an approved measurement sheet signed by Executive Engineer is mandatory.</li>
                  <li><strong>Anti-Split Tender Verification:</strong> Ensure work is not divided into multiple sub-₹10 Lakh tenders to circumvent e-procurement rules.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* ──────────── TAB 4: OFFICIAL PRINTABLE CLEARANCE SLIP ──────────── */}
        {(activeTab === "certificate" || result) && (
          <div
            id="print-clearance-dossier"
            className={`${
              activeTab === "certificate" ? "block" : "hidden print:block"
            } rounded-2xl border-2 border-slate-300 bg-white p-8 text-slate-900 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-white`}
          >
            {/* MoSPI Emblem Header */}
            <div className="border-b-2 border-slate-900/80 pb-5 text-center dark:border-white/80">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                GOVERNMENT OF INDIA • MINISTRY OF STATISTICS & PROGRAMME IMPLEMENTATION
              </div>
              <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Pre-Sanction Statutory Clearance Certificate
              </h2>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Members of Parliament Local Area Development Scheme (MPLADS Division)
              </div>
            </div>

            {/* Certificate Metadata */}
            <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-200 pb-4 text-xs dark:border-slate-800 sm:grid-cols-4">
              <div>
                <span className="text-slate-500 font-semibold">CLEARANCE TOKEN:</span>
                <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {result?.clearance_token || "MPLADS-VAL-PENDING"}
                </div>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">DATE & TIME:</span>
                <div className="font-medium">{new Date().toLocaleString("en-IN")}</div>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">DISTRICT JURISDICTION:</span>
                <div className="font-bold">{formData.district}, {formData.state}</div>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">STATUTORY STATUS:</span>
                <div className="font-bold">
                  {result?.clearance_status || "PENDING EVALUATION"}
                </div>
              </div>
            </div>

            {/* Proposal Details Table */}
            <div className="mt-6 space-y-2">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Proposed Work Specifications:
              </h4>
              <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold w-1/4 dark:bg-slate-800">Project Title:</td>
                      <td className="p-2.5">{formData.project_name}</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold dark:bg-slate-800">Asset Sector:</td>
                      <td className="p-2.5">{formData.project_type.replace(/_/g, " ")}</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold dark:bg-slate-800">Estimated Cost:</td>
                      <td className="p-2.5 font-mono font-bold">
                        ₹{Number(formData.estimated_cost).toLocaleString("en-IN")} ({formatINR(Number(formData.estimated_cost))})
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold dark:bg-slate-800">Target Beneficiary:</td>
                      <td className="p-2.5">{formData.target_beneficiary}</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold dark:bg-slate-800">GPS Coordinates:</td>
                      <td className="p-2.5 font-mono">
                        {formData.latitude}°N, {formData.longitude}°E
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold dark:bg-slate-800">Implementing Agency:</td>
                      <td className="p-2.5">{formData.implementing_agency || "To be allocated by DDO"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Checklist Results */}
            {result && (
              <div className="mt-6 space-y-2">
                <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Statutory Automated Screening Checklist:
                </h4>
                <div className="space-y-1.5 text-xs">
                  {result.guideline_checks.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded border border-slate-200 p-2 dark:border-slate-800">
                      <div>
                        <span className="font-bold">{c.check}:</span> {c.details}
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        [{c.status}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendation & Signature Endorsement Box */}
            <div className="mt-8 grid grid-cols-1 gap-6 border-t-2 border-slate-900/80 pt-6 dark:border-white/80 sm:grid-cols-2">
              <div className="space-y-1 text-xs">
                <div className="font-bold uppercase text-slate-700 dark:text-slate-300">
                  AI Screening Recommendation:
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {result?.recommendation || "Pending screening evaluation."}
                </p>
                <div className="mt-3 font-mono text-[10px] text-slate-500">
                  DIGITAL HASH: SHA256-MPLADS-{result?.clearance_token || "VERIFY"}
                </div>
              </div>

              <div className="flex flex-col justify-end text-right text-xs">
                <div className="h-14" />
                <div className="font-bold uppercase">District Magistrate / Collector / DPO</div>
                <div className="text-[11px] text-slate-500">Authorized Sanctioning Authority • Office Seal</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
