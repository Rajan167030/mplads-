"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  AlertTriangle, 
  Download, 
  RotateCcw, 
  Search, 
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet
} from "lucide-react";

export interface RankedRiskItem {
  id: string;
  external_project_id: string;
  project_name: string;
  category: string;
  work_status: "Recommended" | "Sanctioned" | "Ongoing" | "Completed" | "Delayed";
  anomaly_reason: string;
  mp_name: string;
  constituency: string;
  district: string;
  state: string;
  case_status: "None" | "Under Review" | "Escalated" | "Dismissed" | "Action Taken";
  amount: number; // in INR
  risk_score: number;
}

const INITIAL_RISK_ITEMS: RankedRiskItem[] = [
  {
    id: "risk-p1",
    external_project_id: "16786",
    project_name: "30-Installation of a high mast light (9.06 meters in length including the foundation, cable, high power LED luminaire) at Chhapra Chauraha",
    category: "Street Lighting",
    work_status: "Recommended",
    anomaly_reason: "Cost is 25.0x the street lighting benchmark for BALRAMPUR. Single vendor NAVEEN ENTERPRISES awarded 94% of lighting tenders in 90 days.",
    mp_name: "Ram Shiromani",
    constituency: "SHRAWASTI",
    district: "BALRAMPUR",
    state: "Uttar Pradesh",
    case_status: "Under Review",
    amount: 1585000,
    risk_score: 100,
  },
  {
    id: "risk-p2",
    external_project_id: "117445",
    project_name: "34-Installation of a solar high-mast street light near the Kali Mata Temple, Bhinga Main Road",
    category: "Street Lighting",
    work_status: "Recommended",
    anomaly_reason: "Cost is 24.6x the street lighting average for SHRAWASTI. Exact duplicate GPS coordinates (27.702°N, 81.934°E) matches existing sanction #116901.",
    mp_name: "Ram Shiromani",
    constituency: "SHRAWASTI",
    district: "SHRAWASTI",
    state: "Uttar Pradesh",
    case_status: "Under Review",
    amount: 1720000,
    risk_score: 99,
  },
  {
    id: "risk-p3",
    external_project_id: "266269",
    project_name: "1-Installation of a high-mast light (30 meters long, with 16 lights of 400W LED) at Gilaula Market Junction",
    category: "Street Lighting",
    work_status: "Recommended",
    anomaly_reason: "Cost is 23.2x the street lighting average for SHRAWASTI. Vendor NAVEEN ENTERPRISES has 4 active delay flags across neighboring blocks.",
    mp_name: "Ram Shiromani",
    constituency: "SHRAWASTI",
    district: "SHRAWASTI",
    state: "Uttar Pradesh",
    case_status: "Dismissed",
    amount: 1620000,
    risk_score: 98,
  },
  {
    id: "risk-p4",
    external_project_id: "248910",
    project_name: "Common Facility Center for Silk Weavers Community & Solar Rooftop Array, Phase II",
    category: "Community Hall",
    work_status: "Sanctioned",
    anomaly_reason: "Payment released (98%) while physical progress inspection recorded at only 12%. 3-year execution delay with no milestone verification.",
    mp_name: "Smt. Nirmala Sitharaman",
    constituency: "BIDAR / RAJYA SABHA",
    district: "BIDAR",
    state: "Karnataka",
    case_status: "Escalated",
    amount: 5000000,
    risk_score: 98,
  },
  {
    id: "risk-p5",
    external_project_id: "189320",
    project_name: "Construction of CC Road & RCC Drain from NH-28 Junction to Primary Health Sub-Centre, Ward 4",
    category: "Road",
    work_status: "Ongoing",
    anomaly_reason: "Split sanction detected: 4 separate work orders under ₹10 Lakhs threshold issued to Vindhya Construction Co. within 48 hours to evade e-tendering.",
    mp_name: "Rajesh Kumar Verma",
    constituency: "LUCKNOW",
    district: "LUCKNOW",
    state: "Uttar Pradesh",
    case_status: "Under Review",
    amount: 3840000,
    risk_score: 95,
  },
  {
    id: "risk-p6",
    external_project_id: "194512",
    project_name: "Deep Borewell Drinking Water Supply Scheme with Overhead Tank (50,000 Liters) at Maner Block",
    category: "Drinking Water",
    work_status: "Delayed",
    anomaly_reason: "Contractor Shreeram Infra Projects flagged for 7 concurrent high-risk defaults. Time elapsed 420 days against 180 days scheduled limit.",
    mp_name: "Suresh Prasad Yadav",
    constituency: "PATNA SAHIB",
    district: "PATNA",
    state: "Bihar",
    case_status: "Escalated",
    amount: 2850000,
    risk_score: 93,
  },
  {
    id: "risk-p7",
    external_project_id: "203114",
    project_name: "Upgradation of Government Higher Secondary School Science Laboratory & Smart Classrooms",
    category: "School",
    work_status: "Sanctioned",
    anomaly_reason: "Duplicate title and identical bill of quantities matching sanctioned project #199841 sanctioned in FY 23-24 for the same school compound.",
    mp_name: "Vikram Deshmukh",
    constituency: "PUNE",
    district: "PUNE",
    state: "Maharashtra",
    case_status: "Action Taken",
    amount: 2200000,
    risk_score: 91,
  },
  {
    id: "risk-p8",
    external_project_id: "219803",
    project_name: "Construction of Multi-Purpose Cyclone Shelter & Community Health Camp, Sagar Island",
    category: "Public Facility",
    work_status: "Ongoing",
    anomaly_reason: "Expenditure claimed ₹42.5 L against released ₹35.0 L without nodal authorization. High material price variance (48% above State PWD schedule).",
    mp_name: "Amit Chatterjee",
    constituency: "KOLKATA DAKSHIN",
    district: "KOLKATA",
    state: "West Bengal",
    case_status: "Under Review",
    amount: 4500000,
    risk_score: 88,
  },
  {
    id: "risk-p9",
    external_project_id: "233401",
    project_name: "Solar Powered Micro-Irrigation Pump Installation for Tribal Farmers Cooperative, Betul",
    category: "Sanitation & Water",
    work_status: "Ongoing",
    anomaly_reason: "Geo-fencing anomaly: Work reported at 21.91°N, 77.90°E is 18.4 km outside allocated constituency boundary line.",
    mp_name: "Neha Tiwari",
    constituency: "BHOPAL",
    district: "BHOPAL",
    state: "Madhya Pradesh",
    case_status: "None",
    amount: 1980000,
    risk_score: 86,
  },
  {
    id: "risk-p10",
    external_project_id: "241108",
    project_name: "Paver Block Pavement & Drainage Channel in Ward 14, T. Nagar Urban Health Corridor",
    category: "Road",
    work_status: "Completed",
    anomaly_reason: "Citizen grievance filed citing substandard asphalt depth. Third-party visual inspection mismatch detected in uploaded geo-tagged photos.",
    mp_name: "Karthik Subramaniam",
    constituency: "CHENNAI CENTRAL",
    district: "CHENNAI",
    state: "Tamil Nadu",
    case_status: "Under Review",
    amount: 1450000,
    risk_score: 84,
  }
];

function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  return `₹${(amount / 100000).toFixed(2)} L`;
}

export function RankedRiskList({ initialItems }: { initialItems?: RankedRiskItem[] }) {
  const [items] = useState<RankedRiskItem[]>(initialItems && initialItems.length > 0 ? initialItems : INITIAL_RISK_ITEMS);
  const [search, setSearch] = useState("");
  const [caseStatus, setCaseStatus] = useState("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [category, setCategory] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [workStatus, setWorkStatus] = useState("All");

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const states = useMemo(() => {
    const set = new Set(items.map((i) => i.state));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (minScore > 0 && item.risk_score < minScore) return false;
      if (caseStatus !== "All" && item.case_status !== caseStatus) return false;
      if (category !== "All" && item.category !== category) return false;
      if (stateFilter !== "All" && item.state !== stateFilter) return false;
      if (workStatus !== "All" && item.work_status !== workStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = item.project_name.toLowerCase().includes(q);
        const matchId = item.external_project_id.toLowerCase().includes(q);
        const matchMp = item.mp_name.toLowerCase().includes(q);
        const matchConst = item.constituency.toLowerCase().includes(q);
        const matchDist = item.district.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchMp && !matchConst && !matchDist) {
          return false;
        }
      }
      return true;
    });
  }, [items, minScore, caseStatus, category, stateFilter, workStatus, search]);

  const resetFilters = () => {
    setSearch("");
    setCaseStatus("All");
    setMinScore(0);
    setCategory("All");
    setStateFilter("All");
    setWorkStatus("All");
  };

  const exportCsv = () => {
    const headers = ["Risk Score", "External ID", "Project Name", "Category", "Status", "MP Name", "Constituency", "District", "State", "Case Status", "Amount (INR)", "Anomaly Reason"];
    const rows = filteredItems.map((i) => [
      i.risk_score,
      `"${i.external_project_id}"`,
      `"${i.project_name.replace(/"/g, '""')}"`,
      `"${i.category}"`,
      `"${i.work_status}"`,
      `"${i.mp_name}"`,
      `"${i.constituency}"`,
      `"${i.district}"`,
      `"${i.state}"`,
      `"${i.case_status}"`,
      i.amount,
      `"${i.anomaly_reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mplads_ranked_risk_list_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-dashboard-navy">
            Ranked risk list
          </h2>
          <p className="mt-0.5 text-xs text-dashboard-muted">
            Works ordered by combined risk score, from the rule engine and the anomaly model.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-dashboard-muted">
            <strong className="text-dashboard-navy">{filteredItems.length.toLocaleString()}</strong> of 1,31,916 works
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-medium text-dashboard-ink shadow-sm transition hover:bg-dashboard-surface"
          >
            <RotateCcw size={13} className="text-dashboard-muted" />
            Reset filters
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-semibold text-dashboard-navy shadow-sm transition hover:bg-dashboard-surface hover:text-dashboard-deep"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-dashboard-line bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {/* Search */}
          <div className="lg:col-span-1">
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Search MP, work or work ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="MP name, street light, 178989"
                className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-3 py-1.5 pl-8 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-dashboard-muted" />
            </div>
          </div>

          {/* Case status */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Case status
            </label>
            <select
              value={caseStatus}
              onChange={(e) => setCaseStatus(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              <option value="All">All</option>
              <option value="Under Review">Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Dismissed">Dismissed</option>
              <option value="Action Taken">Action Taken</option>
            </select>
          </div>

          {/* Minimum score slider */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-dashboard-muted">
              <span>Minimum score</span>
              <span className="font-mono font-bold text-dashboard-navy">{minScore}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="range"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-dashboard-line accent-dashboard-navy"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* State of work */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              State of work
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Work status */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Work status
            </label>
            <select
              value={workStatus}
              onChange={(e) => setWorkStatus(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              <option value="All">All</option>
              <option value="Recommended">Recommended</option>
              <option value="Sanctioned">Sanctioned</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Intelligence Table */}
      <div className="overflow-hidden rounded-xl border border-dashboard-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-dashboard-line bg-dashboard-surface/80 text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                <th className="w-20 px-4 py-3 text-center">Risk ▾</th>
                <th className="min-w-[320px] px-4 py-3">Project</th>
                <th className="w-44 px-4 py-3">MP and constituency</th>
                <th className="w-36 px-4 py-3">District</th>
                <th className="w-28 px-4 py-3">Category</th>
                <th className="w-28 px-4 py-3">Case</th>
                <th className="w-28 px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashboard-line/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dashboard-muted">
                    <ShieldAlert size={28} className="mx-auto mb-2 opacity-40" />
                    No anomalous works matched the selected criteria. Try adjusting the score threshold or clearing filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => {
                  const isHighRisk = row.risk_score >= 90;
                  const isMedRisk = row.risk_score >= 70 && row.risk_score < 90;

                  return (
                    <tr 
                      key={row.id}
                      className="group transition-colors hover:bg-[#fafcfe]"
                    >
                      {/* Risk Score */}
                      <td className="px-4 py-3.5 align-top text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`text-base font-extrabold tracking-tight ${
                            isHighRisk ? "text-[#b31919]" : isMedRisk ? "text-[#d97706]" : "text-[#15803d]"
                          }`}>
                            {row.risk_score}
                          </span>
                          <div className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-slate-100">
                            <div 
                              className={`h-full ${isHighRisk ? "bg-[#b31919]" : isMedRisk ? "bg-[#d97706]" : "bg-[#15803d]"}`}
                              style={{ width: `${row.risk_score}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Project Title, ID, Tag & Anomaly Reason */}
                      <td className="px-4 py-3.5 align-top">
                        <Link 
                          href={`/dashboard/projects/${row.id}`}
                          className="font-bold text-[#092541] transition group-hover:text-blue-700 hover:underline flex items-start gap-1"
                        >
                          <span className="line-clamp-2 leading-snug">{row.project_name}</span>
                        </Link>
                        
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-dashboard-muted">
                          <span className="font-mono text-dashboard-ink">{row.external_project_id}</span>
                          <span>|</span>
                          <span className="font-semibold text-slate-600">{row.work_status}</span>
                        </div>

                        {/* Red flag anomaly reason highlight */}
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-[#fdf5f5] p-2 text-[11.5px] leading-relaxed text-[#991b1b] border border-[#fecaca]/50">
                          <span className="shrink-0 font-bold">⚠️</span>
                          <span>{row.anomaly_reason}</span>
                        </div>
                      </td>

                      {/* MP & Constituency */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold text-dashboard-ink">{row.mp_name}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-dashboard-muted">
                          {row.constituency}
                        </div>
                      </td>

                      {/* District & State */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="font-bold uppercase text-dashboard-ink">{row.district}</div>
                        <div className="mt-0.5 text-[11px] text-dashboard-muted">{row.state}</div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {row.category}
                        </span>
                      </td>

                      {/* Case Status */}
                      <td className="px-4 py-3.5 align-top">
                        {row.case_status === "Dismissed" && (
                          <span className="inline-flex items-center rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            Dismissed
                          </span>
                        )}
                        {row.case_status === "Under Review" && (
                          <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Under Review
                          </span>
                        )}
                        {row.case_status === "Escalated" && (
                          <span className="inline-flex items-center rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            Escalated
                          </span>
                        )}
                        {row.case_status === "Action Taken" && (
                          <span className="inline-flex items-center rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Action Taken
                          </span>
                        )}
                        {row.case_status === "None" && (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 align-top text-right">
                        <span className="font-mono text-sm font-bold text-dashboard-ink">
                          {formatCurrency(row.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
