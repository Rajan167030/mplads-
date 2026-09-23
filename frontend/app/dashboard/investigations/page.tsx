"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  ScrollText,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiError,
  createInvestigation,
  escalateInvestigation,
  getInvestigationAuditLog,
  listInvestigations,
  updateInvestigation,
  type AuditLogEntry,
  type Investigation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800 border border-rose-200",
  HIGH: "bg-orange-100 text-orange-800 border border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border border-amber-200",
  LOW: "bg-slate-100 text-slate-600 border border-slate-200",
};

const LEVEL_STYLES: Record<string, string> = {
  DISTRICT: "bg-violet-50 text-violet-700",
  STATE: "bg-blue-50 text-blue-700",
  MINISTRY: "bg-indigo-50 text-indigo-700",
};

const ROLE_LABELS: Record<string, string> = {
  DISTRICT_AUTHORITY: "District Authority",
  STATE_NODAL: "State Nodal Officer",
  MINISTRY: "Ministry (MoSPI)",
  OFFICER: "MPLADS Officer",
  ANALYST: "Data Analyst",
  VIEWER: "Read-only Viewer",
  ADMIN: "System Admin",
};

const ACTION_LABELS: Record<string, { label: string; color: string; icon: "create" | "update" | "escalate" }> = {
  CREATE_INVESTIGATION: { label: "Case Created", color: "bg-emerald-500", icon: "create" },
  UPDATE_INVESTIGATION: { label: "Case Updated", color: "bg-blue-500", icon: "update" },
  ESCALATE_INVESTIGATION: { label: "Escalated to Higher Authority", color: "bg-orange-500", icon: "escalate" },
};

const MANAGER_ROLES = ["DISTRICT_AUTHORITY", "STATE_NODAL", "MINISTRY"];
const NEXT_LEVEL: Record<string, string> = { DISTRICT: "STATE", STATE: "MINISTRY" };

// ─── Audit Log Timeline ─────────────────────────────────────────────────────────

function AuditTimeline({
  investigationId,
  token,
  onClose,
}: {
  investigationId: string;
  token: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvestigationAuditLog(investigationId, token)
      .then(setLogs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load audit log."));
  }, [investigationId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-dashboard-deep/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-dashboard-line bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dashboard-line px-5 py-4">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="text-dashboard-navy" />
            <h3 className="font-display text-base font-bold">Case Audit Trail</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-dashboard-muted hover:bg-dashboard-surface"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {!logs && !error && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-dashboard-muted">
              <Loader2 size={16} className="animate-spin" /> Loading audit trail…
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {logs && logs.length === 0 && (
            <p className="py-8 text-center text-sm text-dashboard-muted">
              No audit events recorded yet for this case.
            </p>
          )}
          {logs && logs.length > 0 && (
            <ol className="relative space-y-0 border-l border-dashboard-line ml-2">
              {logs.map((log, i) => {
                const meta = ACTION_LABELS[log.action] ?? {
                  label: log.action.replace(/_/g, " "),
                  color: "bg-slate-500",
                  icon: "update" as const,
                };
                return (
                  <li key={log.id} className="mb-6 ml-5">
                    <span
                      className={`absolute -left-1.5 flex size-3 items-center justify-center rounded-full ring-4 ring-white ${meta.color}`}
                    />
                    <div className="rounded-lg border border-dashboard-line/60 bg-dashboard-surface/60 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-dashboard-ink">{meta.label}</span>
                        <time className="font-mono text-[10px] text-dashboard-muted">
                          {new Date(log.timestamp).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <div className="mt-1 text-[11px] text-dashboard-muted">
                        By{" "}
                        <span className="font-semibold text-dashboard-ink">
                          {log.user_name}
                        </span>
                        {log.user_role && (
                          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                            {ROLE_LABELS[log.user_role] ?? log.user_role}
                          </span>
                        )}
                      </div>
                      {Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 rounded bg-white px-2 py-1.5 text-[10px] font-mono text-dashboard-muted border border-dashboard-line/50">
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
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function InvestigationsPage() {
  const { user, token } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("HIGH");
  const [notes, setNotes] = useState("");
  const [auditTarget, setAuditTarget] = useState<string | null>(null);
  const canManage = !!user && MANAGER_ROLES.includes(user.role);

  const canActOn = (inv: Investigation) =>
    !!user &&
    (user.role === "MINISTRY" ||
      (user.role === "DISTRICT_AUTHORITY" && inv.current_level === "DISTRICT") ||
      (user.role === "STATE_NODAL" && inv.current_level === "STATE"));

  const canEscalate = (inv: Investigation) =>
    !!user &&
    ["DISTRICT_AUTHORITY", "STATE_NODAL"].includes(user.role) &&
    canActOn(inv) &&
    inv.current_level !== "MINISTRY";

  async function refresh() {
    setLoading(true);
    try {
      const data = await listInvestigations(
        statusFilter ? { status: statusFilter } : {},
        token ?? undefined
      );
      setInvestigations(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong loading this page."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !projectId.trim()) return;
    try {
      await createInvestigation(token, {
        project_id: projectId.trim(),
        priority,
        notes: notes.trim() || undefined,
      });
      setProjectId("");
      setNotes("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create investigation.");
    }
  }

  async function handleStatusChange(id: string, status: string) {
    if (!token) return;
    try {
      await updateInvestigation(token, id, { status });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update investigation.");
    }
  }

  async function handleEscalate(id: string) {
    if (!token) return;
    try {
      await escalateInvestigation(token, id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not escalate investigation.");
    }
  }

  // Role-based capability badge
  const roleCapabilityBadge = () => {
    if (!user) return null;
    if (user.role === "MINISTRY") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
          <Shield size={12} /> Full Ministry Override Access
        </span>
      );
    }
    if (user.role === "STATE_NODAL") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
          <Shield size={12} /> State-Level Case Management
        </span>
      );
    }
    if (user.role === "DISTRICT_AUTHORITY") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
          <Shield size={12} /> District-Level Case Management
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
        <ShieldAlert size={12} /> Read-only View ({ROLE_LABELS[user.role] ?? user.role})
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Investigations Workflow
            </h1>
            <p className="mt-1 text-sm text-dashboard-muted">
              Human-in-the-loop case management. All escalations are logged with a tamper-evident
              audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roleCapabilityBadge()}
          </div>
        </div>

        {/* Quick-link to create from Duplicate Pairs */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/patterns/duplicates"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-semibold text-dashboard-ink hover:bg-dashboard-surface shadow-sm"
          >
            <FileText size={13} /> Create from Duplicate Pairs <ChevronRight size={12} />
          </Link>
          <Link
            href="/dashboard/risk-alerts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashboard-line bg-white px-3 py-1.5 text-xs font-semibold text-dashboard-ink hover:bg-dashboard-surface shadow-sm"
          >
            <AlertTriangle size={13} /> Create from Risk Alerts <ChevronRight size={12} />
          </Link>
        </div>

        {/* Create Form */}
        {!user && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Link href="/" className="font-semibold underline">Sign in</Link>{" "}
            as District Authority, State Nodal, or Ministry official to create or manage investigations.
            Read-only browsing is available below.
          </div>
        )}

        {canManage && (
          <form
            onSubmit={handleCreate}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-dashboard-line bg-white p-4 shadow-sm"
          >
            <label className="text-xs font-semibold">
              Project ID
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Paste project ID from detail page or Duplicate Pairs"
                className="mt-1 block w-72 rounded-lg border border-dashboard-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-dashboard-navy/30"
                required
              />
            </label>
            <label className="text-xs font-semibold">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 block rounded-lg border border-dashboard-line px-2.5 py-1.5 text-sm"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </label>
            <label className="flex-1 text-xs font-semibold">
              Investigator Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this being flagged? What anomaly pattern?"
                className="mt-1 block w-full rounded-lg border border-dashboard-line px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-dashboard-navy px-4 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep shadow-sm"
            >
              Open Case
            </button>
          </form>
        )}

        {/* Status Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {["", "OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === s
                  ? "border-dashboard-navy bg-dashboard-navy text-white"
                  : s
                    ? `${STATUS_STYLES[s]} hover:shadow-sm`
                    : "border-dashboard-line bg-white text-dashboard-muted hover:bg-dashboard-surface"
              }`}
            >
              {s || "All Cases"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-dashboard-muted">
            <Loader2 size={18} className="animate-spin" /> Loading cases…
          </div>
        )}

        {!loading && investigations.length === 0 && !error && (
          <div className="mt-8 rounded-xl border border-dashboard-line bg-white p-10 text-center shadow-sm">
            <CheckCircle2 size={38} className="mx-auto text-dashboard-muted/50" />
            <p className="mt-4 text-sm font-semibold text-dashboard-ink">
              No cases{statusFilter ? ` with status ${statusFilter}` : ""} yet.
            </p>
            <p className="mt-1 text-xs text-dashboard-muted">
              Cases are created from risk signals, duplicate pairs, or manually by authorized officers.
            </p>
          </div>
        )}

        {/* Investigations Table */}
        {investigations.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-dashboard-line bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv) => (
                  <tr key={inv.id} className="border-b border-dashboard-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/projects/${inv.project_id}`}
                        className="flex items-center gap-1 font-semibold text-dashboard-navy hover:underline"
                      >
                        {inv.project_name}
                        <ArrowUpRight size={12} className="shrink-0 opacity-60" />
                      </Link>
                      <div className="text-[11px] text-dashboard-muted">{inv.project_external_id}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                          PRIORITY_STYLES[inv.priority] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.priority}
                      </span>
                    </td>

                    <td className="max-w-xs truncate px-4 py-3 text-dashboard-muted text-xs">
                      {inv.notes ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {canActOn(inv) ? (
                        <select
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                          className={`rounded border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[inv.status] ?? ""}`}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                      ) : (
                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[inv.status] ?? ""}`}
                        >
                          {inv.status}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            LEVEL_STYLES[inv.current_level] ?? "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {inv.current_level}
                        </span>
                        {inv.overdue_for_escalation && (
                          <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            ⚠ Overdue
                          </span>
                        )}
                      </div>
                      {canEscalate(inv) && (
                        <button
                          onClick={() => handleEscalate(inv.id)}
                          className="mt-1.5 rounded border border-orange-300 px-2 py-1 text-[10px] font-bold text-orange-700 hover:bg-orange-50 transition"
                        >
                          Escalate → {NEXT_LEVEL[inv.current_level]}
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-dashboard-muted">
                      <div className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(inv.updated_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {token && (
                        <button
                          onClick={() => setAuditTarget(inv.id)}
                          className="inline-flex items-center gap-1 rounded border border-dashboard-line px-2 py-1 text-[10px] font-semibold text-dashboard-muted hover:border-dashboard-navy hover:text-dashboard-navy transition"
                          title="View audit trail"
                        >
                          <ScrollText size={12} /> Audit Log
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashboard-line px-4 py-2.5 text-[11px] text-dashboard-muted">
              {investigations.length} case{investigations.length !== 1 ? "s" : ""} shown ·
              All status changes are logged in the tamper-evident audit trail (click &quot;Audit Log&quot; on any row)
            </div>
          </div>
        )}
      </div>

      {/* Audit Trail Modal */}
      {auditTarget && token && (
        <AuditTimeline
          investigationId={auditTarget}
          token={token}
          onClose={() => setAuditTarget(null)}
        />
      )}
    </main>
  );
}
