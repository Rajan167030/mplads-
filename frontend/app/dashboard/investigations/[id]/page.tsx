"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronUp,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  MessageSquare,
  ScrollText,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ApiError,
  createInvestigationReview,
  escalateInvestigation,
  getInvestigation,
  getInvestigationAuditLog,
  listInvestigationReviews,
  updateInvestigation,
  type AuditLogEntry,
  type Investigation,
  type InvestigationReview,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ─── Style Maps ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  OPEN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Open" },
  IN_PROGRESS: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "In Progress" },
  RESOLVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Resolved" },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  CRITICAL: { bg: "bg-rose-100", text: "text-rose-800", icon: "🔴" },
  HIGH: { bg: "bg-orange-100", text: "text-orange-800", icon: "🟠" },
  MEDIUM: { bg: "bg-amber-100", text: "text-amber-700", icon: "🟡" },
  LOW: { bg: "bg-slate-100", text: "text-slate-600", icon: "🟢" },
};

const LEVEL_STYLES: Record<string, { bg: string; text: string }> = {
  DISTRICT: { bg: "bg-violet-50", text: "text-violet-700" },
  STATE: { bg: "bg-blue-50", text: "text-blue-700" },
  MINISTRY: { bg: "bg-indigo-50", text: "text-indigo-700" },
};

const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  APPROVE: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ThumbsUp size={14} />, label: "Approved" },
  REJECT: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: <ThumbsDown size={14} />, label: "Rejected" },
  NEEDS_MORE_INFO: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: <MessageSquare size={14} />, label: "Needs More Info" },
  ESCALATE: { color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", icon: <ChevronUp size={14} />, label: "Escalate" },
};

const ROLE_LABELS: Record<string, string> = {
  DISTRICT_AUTHORITY: "District Authority",
  STATE_NODAL: "State Nodal Officer",
  MINISTRY: "Ministry (MoSPI)",
  OFFICER: "MPLADS Officer",
  ANALYST: "Data Analyst",
  VIEWER: "Read-only Viewer",
  ADMIN: "System Admin",
  MP: "Member of Parliament",
};

const MANAGER_ROLES = ["DISTRICT_AUTHORITY", "STATE_NODAL", "MINISTRY"];
const NEXT_LEVEL: Record<string, string> = { DISTRICT: "STATE", STATE: "MINISTRY" };

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE_INVESTIGATION: { label: "Case Created", color: "bg-emerald-500" },
  UPDATE_INVESTIGATION: { label: "Case Updated", color: "bg-blue-500" },
  ESCALATE_INVESTIGATION: { label: "Escalated", color: "bg-orange-500" },
  ADD_REVIEW: { label: "Review Added", color: "bg-purple-500" },
};

// ─── Tab Navigation ─────────────────────────────────────────────────────────────

type TabId = "overview" | "reviews" | "audit";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Case Overview", icon: <FileText size={15} /> },
  { id: "reviews", label: "Reviews & Findings", icon: <FileCheck size={15} /> },
  { id: "audit", label: "Audit Trail", icon: <ScrollText size={15} /> },
];

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function InvestigationCenterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();

  const [inv, setInv] = useState<Investigation | null>(null);
  const [reviews, setReviews] = useState<InvestigationReview[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [verdict, setVerdict] = useState("APPROVE");
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [evidenceRefs, setEvidenceRefs] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canManage = !!user && MANAGER_ROLES.includes(user.role);
  const canActOn =
    !!user &&
    !!inv &&
    (user.role === "MINISTRY" ||
      (user.role === "DISTRICT_AUTHORITY" && inv.current_level === "DISTRICT") ||
      (user.role === "STATE_NODAL" && inv.current_level === "STATE"));
  const canEscalate =
    !!user &&
    !!inv &&
    ["DISTRICT_AUTHORITY", "STATE_NODAL"].includes(user.role) &&
    canActOn &&
    inv.current_level !== "MINISTRY";

  // ─── Data Loading ─────────────────────────────────────────────────────────────

  async function loadInvestigation() {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await getInvestigation(id, token);
      setInv(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load investigation.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews() {
    if (!token || !id) return;
    setReviewsLoading(true);
    try {
      const data = await listInvestigationReviews(id, token);
      setReviews(data);
    } catch {
      // Silently handle, reviews panel will show empty
    } finally {
      setReviewsLoading(false);
    }
  }

  async function loadAuditLogs() {
    if (!token || !id) return;
    setAuditLoading(true);
    try {
      const data = await getInvestigationAuditLog(id, token);
      setAuditLogs(data);
    } catch {
      // Silently handle
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    loadInvestigation();
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  useEffect(() => {
    if (activeTab === "audit" && auditLogs.length === 0) {
      loadAuditLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async function handleStatusChange(status: string) {
    if (!token || !inv) return;
    try {
      await updateInvestigation(token, inv.id, { status });
      loadInvestigation();
      loadAuditLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function handleEscalate() {
    if (!token || !inv) return;
    try {
      await escalateInvestigation(token, inv.id);
      loadInvestigation();
      loadAuditLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not escalate.");
    }
  }

  async function handleResolution(resolution: string) {
    if (!token || !inv) return;
    try {
      await updateInvestigation(token, inv.id, { resolution });
      loadInvestigation();
      loadAuditLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not set resolution.");
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !id || !findings.trim()) return;
    setSubmitting(true);
    try {
      await createInvestigationReview(id, token, {
        verdict,
        findings: findings.trim(),
        recommendation: recommendation.trim() || undefined,
        evidence_references: evidenceRefs.trim() || undefined,
      });
      setFindings("");
      setRecommendation("");
      setEvidenceRefs("");
      setShowReviewForm(false);
      loadReviews();
      loadAuditLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading / Error States ───────────────────────────────────────────────────

  if (!token) {
    return (
      <main className="min-h-screen bg-dashboard-surface px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <ShieldAlert size={40} className="mx-auto text-amber-500" />
          <h2 className="mt-4 text-lg font-bold">Authentication Required</h2>
          <p className="mt-2 text-sm text-dashboard-muted">
            <Link href="/" className="font-semibold text-dashboard-navy underline">Sign in</Link> to access the Investigation Center.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-dashboard-surface flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-dashboard-muted">
          <Loader2 size={18} className="animate-spin" /> Loading investigation…
        </div>
      </main>
    );
  }

  if (error && !inv) {
    return (
      <main className="min-h-screen bg-dashboard-surface px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard/investigations" className="text-xs font-semibold text-dashboard-navy hover:underline">← Back to Investigations</Link>
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!inv) return null;

  const statusStyle = STATUS_STYLES[inv.status] ?? STATUS_STYLES.OPEN;
  const priorityStyle = PRIORITY_STYLES[inv.priority] ?? PRIORITY_STYLES.MEDIUM;
  const levelStyle = LEVEL_STYLES[inv.current_level] ?? LEVEL_STYLES.DISTRICT;

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* ─── Breadcrumb ──────────────────────────────────────────────────────── */}
        <Link
          href="/dashboard/investigations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-dashboard-navy hover:underline"
        >
          <ArrowLeft size={13} /> Back to Investigations
        </Link>

        {/* ─── Top Header Card ─────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border border-dashboard-line bg-white shadow-sm overflow-hidden">
          {/* Gradient accent bar */}
          <div className={`h-1.5 ${
            inv.priority === "CRITICAL" ? "bg-gradient-to-r from-rose-500 via-rose-400 to-orange-400" :
            inv.priority === "HIGH" ? "bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400" :
            inv.priority === "MEDIUM" ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-lime-400" :
            "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300"
          }`} />

          <div className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {/* Left: Title & meta */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl truncate">
                    {inv.project_name}
                  </h1>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                    {statusStyle.label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-dashboard-muted">
                  <span className="font-mono">{inv.project_external_id}</span>
                  <span className="text-dashboard-line">|</span>
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityStyle.bg} ${priorityStyle.text}`}>
                    {priorityStyle.icon} {inv.priority}
                  </span>
                  <span className="text-dashboard-line">|</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${levelStyle.bg} ${levelStyle.text}`}>
                    {inv.current_level} Level
                  </span>
                  {inv.overdue_for_escalation && (
                    <>
                      <span className="text-dashboard-line">|</span>
                      <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                        ⚠ Overdue for Escalation
                      </span>
                    </>
                  )}
                </div>

                {inv.notes && (
                  <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-dashboard-muted/90 italic">
                    &ldquo;{inv.notes}&rdquo;
                  </p>
                )}
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/dashboard/projects/${inv.project_id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-semibold text-dashboard-navy hover:bg-dashboard-surface shadow-sm transition"
                >
                  View Project <ArrowUpRight size={12} />
                </Link>
                {inv.assigned_to_name && (
                  <div className="text-[11px] text-dashboard-muted">
                    Assigned to: <span className="font-semibold text-dashboard-ink">{inv.assigned_to_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-[10px] text-dashboard-muted">
                  <Clock size={10} />
                  Created {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Quick Action Bar ────────────────────────────────────────────────── */}
        {canManage && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashboard-line bg-white px-5 py-3 shadow-sm">
            <span className="text-xs font-bold text-dashboard-muted uppercase tracking-wider mr-2">Actions:</span>

            {/* Status change */}
            {canActOn && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-dashboard-muted">Status:</span>
                {["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={inv.status === s}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                      inv.status === s
                        ? `${STATUS_STYLES[s]?.bg} ${STATUS_STYLES[s]?.text} ${STATUS_STYLES[s]?.border} opacity-60 cursor-default`
                        : `border-dashboard-line bg-dashboard-surface text-dashboard-muted hover:border-dashboard-navy hover:text-dashboard-navy`
                    }`}
                  >
                    {STATUS_STYLES[s]?.label ?? s}
                  </button>
                ))}
              </div>
            )}

            {/* Resolution */}
            {canActOn && inv.status === "RESOLVED" && (
              <div className="flex items-center gap-2 border-l border-dashboard-line pl-3 ml-1">
                <span className="text-xs text-dashboard-muted">Resolution:</span>
                <select
                  value={inv.resolution ?? ""}
                  onChange={(e) => handleResolution(e.target.value)}
                  className="rounded-lg border border-dashboard-line px-2 py-1 text-xs"
                >
                  <option value="">Select…</option>
                  <option value="LEGITIMATE">Legitimate</option>
                  <option value="ISSUE_CONFIRMED">Issue Confirmed</option>
                  <option value="NEEDS_FURTHER_INVESTIGATION">Needs Further Investigation</option>
                  <option value="INSUFFICIENT_DATA">Insufficient Data</option>
                </select>
              </div>
            )}

            {/* Escalate */}
            {canEscalate && (
              <button
                onClick={handleEscalate}
                className="ml-auto rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition"
              >
                <ChevronUp size={13} className="inline -mt-0.5 mr-1" />
                Escalate → {NEXT_LEVEL[inv.current_level]}
              </button>
            )}
          </div>
        )}

        {/* ─── Error Banner ────────────────────────────────────────────────────── */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* ─── Tab Navigation ──────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-1 border-b border-dashboard-line">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "border-dashboard-navy text-dashboard-navy"
                  : "border-transparent text-dashboard-muted hover:text-dashboard-ink hover:border-dashboard-line"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "reviews" && reviews.length > 0 && (
                <span className="ml-1 rounded-full bg-dashboard-navy px-1.5 py-0.5 text-[9px] text-white font-bold">
                  {reviews.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tab Content ─────────────────────────────────────────────────────── */}
        <div className="mt-5">
          {/* ── OVERVIEW TAB ───────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              {/* Case Summary Card */}
              <div className="rounded-xl border border-dashboard-line bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-dashboard-ink">
                  <Shield size={16} className="text-dashboard-navy" /> Case Summary
                </h3>
                <div className="mt-4 space-y-3">
                  <InfoRow label="Case ID" value={inv.id.slice(0, 8).toUpperCase()} mono />
                  <InfoRow label="Project" value={inv.project_name} />
                  <InfoRow label="External ID" value={inv.project_external_id} mono />
                  <InfoRow label="Priority" value={`${priorityStyle.icon} ${inv.priority}`} />
                  <InfoRow label="Status" value={statusStyle.label} />
                  <InfoRow label="Current Level" value={inv.current_level} />
                  {inv.resolution && <InfoRow label="Resolution" value={inv.resolution.replace(/_/g, " ")} />}
                  <InfoRow label="Assigned To" value={inv.assigned_to_name ?? "Unassigned"} />
                  <InfoRow
                    label="Created"
                    value={new Date(inv.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  />
                  <InfoRow
                    label="Last Updated"
                    value={new Date(inv.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  />
                </div>
              </div>

              {/* Review Summary Card */}
              <div className="rounded-xl border border-dashboard-line bg-white p-5 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-dashboard-ink">
                  <Star size={16} className="text-amber-500" /> Review Summary
                </h3>
                {reviews.length === 0 ? (
                  <div className="mt-6 text-center">
                    <MessageSquare size={32} className="mx-auto text-dashboard-muted/40" />
                    <p className="mt-3 text-xs text-dashboard-muted">No reviews submitted yet.</p>
                    {canManage && (
                      <button
                        onClick={() => { setActiveTab("reviews"); setShowReviewForm(true); }}
                        className="mt-3 rounded-lg bg-dashboard-navy px-4 py-2 text-xs font-semibold text-white hover:bg-dashboard-deep transition"
                      >
                        Add First Review
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {/* Verdict breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                      {(["APPROVE", "REJECT", "NEEDS_MORE_INFO", "ESCALATE"] as const).map((v) => {
                        const count = reviews.filter((r) => r.verdict === v).length;
                        const cfg = VERDICT_CONFIG[v];
                        return (
                          <div key={v} className={`rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2`}>
                            <div className={`flex items-center gap-1.5 text-[10px] font-bold ${cfg.color}`}>
                              {cfg.icon} {cfg.label}
                            </div>
                            <div className={`mt-1 text-lg font-bold ${cfg.color}`}>{count}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Latest review snippet */}
                    <div className="mt-3 rounded-lg border border-dashboard-line/60 bg-dashboard-surface/60 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">Latest Review</div>
                      <div className="mt-1 text-xs text-dashboard-ink">
                        <span className="font-semibold">{reviews[0].reviewer_name}</span>
                        <span className="mx-1.5 text-dashboard-muted">·</span>
                        <span className={`font-bold ${VERDICT_CONFIG[reviews[0].verdict]?.color ?? "text-slate-600"}`}>
                          {VERDICT_CONFIG[reviews[0].verdict]?.label ?? reviews[0].verdict}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-dashboard-muted line-clamp-2">{reviews[0].findings}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── REVIEWS TAB ────────────────────────────────────────────────────── */}
          {activeTab === "reviews" && (
            <div>
              {/* Add Review Button */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-dashboard-ink">
                  All Reviews ({reviews.length})
                </h3>
                {canManage && (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-dashboard-navy px-4 py-2 text-xs font-semibold text-white hover:bg-dashboard-deep transition shadow-sm"
                  >
                    {showReviewForm ? <X size={13} /> : <FileCheck size={13} />}
                    {showReviewForm ? "Cancel" : "Add Review"}
                  </button>
                )}
              </div>

              {/* Review Form */}
              {showReviewForm && canManage && (
                <form
                  onSubmit={handleSubmitReview}
                  className="mt-4 rounded-xl border border-dashboard-lime/30 bg-white p-5 shadow-md animate-in slide-in-from-top-2"
                >
                  <h4 className="text-sm font-bold text-dashboard-ink flex items-center gap-2">
                    <FileCheck size={15} className="text-dashboard-navy" /> Submit Review Finding
                  </h4>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {/* Verdict */}
                    <div>
                      <label className="block text-xs font-bold text-dashboard-muted mb-1.5">Verdict *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["APPROVE", "REJECT", "NEEDS_MORE_INFO", "ESCALATE"] as const).map((v) => {
                          const cfg = VERDICT_CONFIG[v];
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setVerdict(v)}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                                verdict === v
                                  ? `${cfg.border} ${cfg.bg} ${cfg.color} ring-2 ring-offset-1 ring-current/20`
                                  : "border-dashboard-line bg-dashboard-surface text-dashboard-muted hover:border-dashboard-navy/30"
                              }`}
                            >
                              {cfg.icon} {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Evidence References */}
                    <div>
                      <label className="block text-xs font-bold text-dashboard-muted mb-1.5">Evidence References</label>
                      <input
                        value={evidenceRefs}
                        onChange={(e) => setEvidenceRefs(e.target.value)}
                        placeholder="Document IDs, file references, photo evidence…"
                        className="w-full rounded-lg border border-dashboard-line px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-dashboard-navy/30"
                      />
                    </div>
                  </div>

                  {/* Findings */}
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-dashboard-muted mb-1.5">Findings *</label>
                    <textarea
                      value={findings}
                      onChange={(e) => setFindings(e.target.value)}
                      placeholder="Describe your investigation findings, observations, and analysis…"
                      rows={4}
                      required
                      className="w-full rounded-lg border border-dashboard-line px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-dashboard-navy/30 resize-none"
                    />
                  </div>

                  {/* Recommendation */}
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-dashboard-muted mb-1.5">Recommendation</label>
                    <textarea
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      placeholder="Suggest next steps, actions to be taken, or specific follow-ups…"
                      rows={2}
                      className="w-full rounded-lg border border-dashboard-line px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-dashboard-navy/30 resize-none"
                    />
                  </div>

                  {/* Submit */}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || !findings.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-dashboard-navy px-5 py-2 text-xs font-semibold text-white hover:bg-dashboard-deep disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                    >
                      {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      Submit Review
                    </button>
                  </div>
                </form>
              )}

              {/* Reviews List */}
              {reviewsLoading && (
                <div className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-dashboard-muted">
                  <Loader2 size={16} className="animate-spin" /> Loading reviews…
                </div>
              )}

              {!reviewsLoading && reviews.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashboard-line bg-white p-10 text-center shadow-sm">
                  <MessageSquare size={36} className="mx-auto text-dashboard-muted/40" />
                  <p className="mt-4 text-sm font-semibold text-dashboard-ink">No reviews yet</p>
                  <p className="mt-1 text-xs text-dashboard-muted">
                    Reviews document findings, verdicts, and recommendations from officers at each level.
                  </p>
                </div>
              )}

              {reviews.length > 0 && (
                <div className="mt-4 space-y-3">
                  {reviews.map((review) => {
                    const vcfg = VERDICT_CONFIG[review.verdict] ?? VERDICT_CONFIG.APPROVE;
                    return (
                      <div
                        key={review.id}
                        className="rounded-xl border border-dashboard-line bg-white shadow-sm overflow-hidden hover:shadow-md transition"
                      >
                        {/* Verdict stripe */}
                        <div className={`h-1 ${
                          review.verdict === "APPROVE" ? "bg-emerald-400" :
                          review.verdict === "REJECT" ? "bg-red-400" :
                          review.verdict === "NEEDS_MORE_INFO" ? "bg-amber-400" :
                          "bg-indigo-400"
                        }`} />

                        <div className="px-5 py-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${vcfg.border} ${vcfg.bg} ${vcfg.color}`}>
                                {vcfg.icon} {vcfg.label}
                              </div>
                              <span className="text-xs font-semibold text-dashboard-ink">{review.reviewer_name}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {ROLE_LABELS[review.reviewer_role] ?? review.reviewer_role}
                              </span>
                            </div>
                            <time className="font-mono text-[10px] text-dashboard-muted">
                              {new Date(review.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </time>
                          </div>

                          {/* Findings */}
                          <div className="mt-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">Findings</div>
                            <p className="mt-1 text-xs leading-relaxed text-dashboard-ink/90 whitespace-pre-wrap">{review.findings}</p>
                          </div>

                          {/* Recommendation */}
                          {review.recommendation && (
                            <div className="mt-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">Recommendation</div>
                              <p className="mt-1 text-xs leading-relaxed text-dashboard-ink/80 whitespace-pre-wrap">{review.recommendation}</p>
                            </div>
                          )}

                          {/* Evidence */}
                          {review.evidence_references && (
                            <div className="mt-3 rounded-lg border border-dashboard-line/50 bg-dashboard-surface/50 px-3 py-2">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">Evidence References</div>
                              <p className="mt-0.5 font-mono text-[11px] text-dashboard-muted">{review.evidence_references}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── AUDIT TAB ──────────────────────────────────────────────────────── */}
          {activeTab === "audit" && (
            <div>
              <h3 className="text-sm font-bold text-dashboard-ink">
                Audit Trail ({auditLogs.length} events)
              </h3>
              <p className="mt-1 text-xs text-dashboard-muted">
                Complete tamper-evident chronological log of all actions on this investigation.
              </p>

              {auditLoading && (
                <div className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-dashboard-muted">
                  <Loader2 size={16} className="animate-spin" /> Loading audit trail…
                </div>
              )}

              {!auditLoading && auditLogs.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashboard-line bg-white p-10 text-center shadow-sm">
                  <ScrollText size={36} className="mx-auto text-dashboard-muted/40" />
                  <p className="mt-4 text-sm font-semibold text-dashboard-ink">No audit events</p>
                </div>
              )}

              {auditLogs.length > 0 && (
                <ol className="relative mt-5 ml-3 space-y-0 border-l-2 border-dashboard-line">
                  {auditLogs.map((log) => {
                    const meta = ACTION_LABELS[log.action] ?? { label: log.action.replace(/_/g, " "), color: "bg-slate-400" };
                    return (
                      <li key={log.id} className="mb-6 ml-6">
                        <span className={`absolute -left-[7px] flex size-3 items-center justify-center rounded-full ring-4 ring-white ${meta.color}`} />
                        <div className="rounded-lg border border-dashboard-line/60 bg-white px-4 py-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-dashboard-ink">{meta.label}</span>
                            <time className="font-mono text-[10px] text-dashboard-muted">
                              {new Date(log.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </time>
                          </div>
                          <div className="mt-1 text-[11px] text-dashboard-muted">
                            By <span className="font-semibold text-dashboard-ink">{log.user_name}</span>
                            {log.user_role && (
                              <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                                {ROLE_LABELS[log.user_role] ?? log.user_role}
                              </span>
                            )}
                          </div>
                          {Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 rounded bg-dashboard-surface px-2 py-1.5 text-[10px] font-mono text-dashboard-muted border border-dashboard-line/50">
                              {Object.entries(log.metadata)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Helper Component ──────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashboard-line/40 pb-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-dashboard-muted">{label}</span>
      <span className={`text-xs font-semibold text-dashboard-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
