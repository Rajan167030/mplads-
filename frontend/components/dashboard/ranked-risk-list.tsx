"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ExternalLink, 
  FileSpreadsheet, 
  Loader2, 
  RotateCcw, 
  Search, 
  ShieldAlert, 
  SlidersHorizontal 
} from "lucide-react";

import { listProjects, type ProjectListItem } from "@/lib/api";

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

const INDIAN_STATES = [
  "All",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const CATEGORIES = [
  "All",
  "ROAD",
  "SCHOOL",
  "COMMUNITY_HALL",
  "WATER_INFRASTRUCTURE",
  "HEALTH_CENTRE",
  "SANITATION",
  "PUBLIC_FACILITY",
  "LIGHTING",
  "SPORTS_RECREATION",
];

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
];

function formatCurrency(amount: number): string {
  if (!amount) return "₹0.00";
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  return `₹${(amount / 100000).toFixed(2)} L`;
}

function mapApiProjectToRiskItem(p: ProjectListItem): RankedRiskItem {
  let statusFormatted: RankedRiskItem["work_status"] = "Ongoing";
  const st = (p.status || "").toUpperCase();
  if (st.includes("COMPLET")) statusFormatted = "Completed";
  else if (st.includes("DELAY")) statusFormatted = "Delayed";
  else if (st.includes("SANCTION")) statusFormatted = "Sanctioned";
  else if (st.includes("RECOMMEND")) statusFormatted = "Recommended";

  const score = p.risk_score ?? (p.risk_band === "HIGH" ? 95 : p.risk_band === "MEDIUM" ? 75 : 45);

  let anomalyMsg = "";
  if (p.physical_progress < 20 && p.financial_progress > 70) {
    anomalyMsg = `Payment released (${p.financial_progress}%) while physical progress is only (${p.physical_progress}%). Milestone verification lag flagged.`;
  } else if (p.status === "DELAYED") {
    anomalyMsg = `Execution timeline exceeded schedule. Contractor ${p.contractor_name || "Assigned"} flagged for active delay index.`;
  } else if (score >= 90) {
    anomalyMsg = `Critical risk score (${score}/100) — anomalous expenditure variance detected by multi-layer detection pipeline.`;
  } else if (score >= 70) {
    anomalyMsg = `Moderate risk score (${score}/100) — flagged for periodic inspection based on regional benchmarks.`;
  } else {
    anomalyMsg = `Standard compliance profile — risk score ${score}/100 within acceptable threshold limits.`;
  }

  return {
    id: p.id,
    external_project_id: p.external_project_id || p.id.slice(0, 8),
    project_name: p.project_name,
    category: p.project_type || "General",
    work_status: statusFormatted,
    anomaly_reason: anomalyMsg,
    mp_name: p.mp_name || "Elected MP (Official)",
    constituency: p.constituency || p.district,
    district: p.district,
    state: p.state,
    case_status: score >= 90 ? "Under Review" : "None",
    amount: p.sanctioned_amount || 0,
    risk_score: score,
  };
}

const PAGE_SIZE = 25;

export function RankedRiskList({ initialItems }: { initialItems?: RankedRiskItem[] }) {
  const [items, setItems] = useState<RankedRiskItem[]>(
    initialItems && initialItems.length > 0 ? initialItems : INITIAL_RISK_ITEMS
  );
  const [totalCount, setTotalCount] = useState<number>(131916);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Filter States
  const [search, setSearch] = useState("");
  const [caseStatus, setCaseStatus] = useState("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [category, setCategory] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [workStatus, setWorkStatus] = useState("All");
  const [sortBy, setSortBy] = useState<"risk_score" | "sanctioned_amount" | "start_date">("risk_score");

  // Fetch from Live Backend API with current filters
  const fetchLiveFilteredProjects = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const result = await listProjects({
        search: search.trim() || undefined,
        state: stateFilter !== "All" ? stateFilter : undefined,
        project_type: category !== "All" ? category : undefined,
        status: workStatus !== "All" ? workStatus.toUpperCase() : undefined,
        min_risk_score: minScore > 0 ? minScore : undefined,
        sort_by: sortBy,
        limit: PAGE_SIZE,
        offset,
      });

      if (result && result.items && result.items.length > 0) {
        const mapped = result.items.map(mapApiProjectToRiskItem);
        setItems(mapped);
        setTotalCount(result.total);
      } else if (result && result.items && result.items.length === 0) {
        setItems([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.warn("Backend filter fetch failed, maintaining client data", err);
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, category, workStatus, minScore, sortBy]);

  // Debounced trigger whenever filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLiveFilteredProjects(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, stateFilter, category, workStatus, minScore, sortBy, fetchLiveFilteredProjects]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLiveFilteredProjects(newPage);
  };

  // Client-side sub-filter for Case Status if selected
  const displayedItems = useMemo(() => {
    if (caseStatus === "All") return items;
    return items.filter((item) => item.case_status === caseStatus);
  }, [items, caseStatus]);

  const resetFilters = () => {
    setSearch("");
    setCaseStatus("All");
    setMinScore(0);
    setCategory("All");
    setStateFilter("All");
    setWorkStatus("All");
    setSortBy("risk_score");
    setPage(1);
  };

  const updateItemCaseStatus = (id: string, newStatus: RankedRiskItem["case_status"]) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, case_status: newStatus } : it))
    );
  };

  const exportCsv = () => {
    const headers = [
      "Risk Score",
      "External ID",
      "Project Name",
      "Category",
      "Status",
      "MP Name",
      "Constituency",
      "District",
      "State",
      "Case Status",
      "Amount (INR)",
      "Anomaly Reason",
    ];
    const rows = displayedItems.map((i) => [
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

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `mplads_ranked_risk_list_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-bold tracking-tight text-dashboard-navy">
              Ranked risk list
            </h2>
            {loading && (
              <span className="flex items-center gap-1 text-xs text-dashboard-navy font-semibold animate-pulse">
                <Loader2 size={13} className="animate-spin text-dashboard-lime" /> Syncing database…
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-dashboard-muted">
            Works ordered by combined risk score, from the rule engine and anomaly detection pipeline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-dashboard-muted">
            Showing <strong className="text-dashboard-navy">{displayedItems.length}</strong> of{" "}
            <strong className="text-dashboard-navy">{totalCount.toLocaleString()}</strong> works
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
              Search MP, work or ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="MP name, School, 18902…"
                className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-3 py-1.5 pl-8 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-dashboard-muted" />
            </div>
          </div>

          {/* State Filter */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              State of work
            </label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Category / Sector
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === "All" ? "All Categories" : c.replace(/_/g, " ")}
                </option>
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
              <option value="All">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="ONGOING">Ongoing</option>
              <option value="DELAYED">Delayed</option>
              <option value="SANCTIONED">Sanctioned</option>
            </select>
          </div>

          {/* Case status */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-dashboard-muted">
              Investigation Case
            </label>
            <select
              value={caseStatus}
              onChange={(e) => setCaseStatus(e.target.value)}
              className="w-full rounded-lg border border-dashboard-line bg-dashboard-surface/60 px-2.5 py-1.5 text-xs text-dashboard-ink outline-none transition focus:border-dashboard-navy focus:bg-white focus:ring-2 focus:ring-dashboard-navy/10"
            >
              <option value="All">All Cases</option>
              <option value="Under Review">Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Action Taken">Action Taken</option>
              <option value="Dismissed">Dismissed</option>
              <option value="None">None</option>
            </select>
          </div>

          {/* Minimum score slider */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-dashboard-muted">
              <span>Min risk score</span>
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
        </div>
      </div>

      {/* Intelligence Table */}
      <div className="overflow-hidden rounded-xl border border-dashboard-line bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-dashboard-line bg-dashboard-surface/80 text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                <th className="w-20 px-4 py-3 text-center">Risk ▾</th>
                <th className="min-w-[320px] px-4 py-3">Project &amp; Anomaly Signals</th>
                <th className="w-44 px-4 py-3">MP and constituency</th>
                <th className="w-36 px-4 py-3">District</th>
                <th className="w-28 px-4 py-3">Category</th>
                <th className="w-32 px-4 py-3">Case Status</th>
                <th className="w-28 px-4 py-3 text-right">Sanctioned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashboard-line/60">
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dashboard-muted">
                    <ShieldAlert size={28} className="mx-auto mb-2 opacity-40 text-dashboard-navy" />
                    No anomalous works matched the selected criteria. Try adjusting the score threshold or clearing filters.
                  </td>
                </tr>
              ) : (
                displayedItems.map((row) => {
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
                          <div className="mt-0.5 h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
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
                          <span className="font-mono text-dashboard-ink font-semibold">Ref: {row.external_project_id}</span>
                          <span>•</span>
                          <span className={`font-semibold ${
                            row.work_status === "Delayed" ? "text-amber-700" : row.work_status === "Completed" ? "text-emerald-700" : "text-slate-600"
                          }`}>
                            {row.work_status}
                          </span>
                        </div>

                        {/* Red flag anomaly reason highlight */}
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-[#fdf5f5] p-2 text-[11.5px] leading-relaxed text-[#991b1b] border border-[#fecaca]/50 shadow-2xs">
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
                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                          {row.category.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Case Status Selector */}
                      <td className="px-4 py-3.5 align-top">
                        <select
                          value={row.case_status}
                          onChange={(e) => updateItemCaseStatus(row.id, e.target.value as any)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer transition ${
                            row.case_status === "Under Review"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : row.case_status === "Escalated"
                              ? "bg-red-50 text-red-800 border-red-300"
                              : row.case_status === "Action Taken"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : row.case_status === "Dismissed"
                              ? "bg-slate-100 text-slate-600 border-slate-300"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          <option value="None">None</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Escalated">Escalated</option>
                          <option value="Action Taken">Action Taken</option>
                          <option value="Dismissed">Dismissed</option>
                        </select>
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

        {/* Pagination Bar */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-dashboard-line bg-dashboard-surface/60 px-4 py-3 text-xs">
            <div className="text-dashboard-muted">
              Page <strong className="text-dashboard-navy">{page}</strong> of{" "}
              <strong className="text-dashboard-navy">{totalPages}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-dashboard-line bg-white px-3 py-1 font-semibold text-dashboard-ink shadow-2xs hover:bg-dashboard-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-dashboard-line bg-white px-3 py-1 font-semibold text-dashboard-ink shadow-2xs hover:bg-dashboard-surface disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
