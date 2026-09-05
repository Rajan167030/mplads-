"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiError,
  createInvestigation,
  listInvestigations,
  updateInvestigation,
  type Investigation,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function InvestigationsPage() {
  const { user, token } = useAuth();
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("HIGH");
  const [notes, setNotes] = useState("");
  const canManage = user?.role === "ADMIN" || user?.role === "OFFICER";

  async function refresh() {
    setLoading(true);
    try {
      const data = await listInvestigations(statusFilter ? { status: statusFilter } : {});
      setInvestigations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // `refresh` is also called directly from the create/update handlers below
    // to reload after a mutation — reusing it here (rather than duplicating
    // the fetch) is why this doesn't fit the "effect only synchronizes" shape
    // the newer lint rule expects. Genuine fetch-on-mount-and-on-filter-change,
    // not a smell. Deliberately excluding `refresh` from deps: it's redefined
    // every render and only ever needs re-running when the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !projectId.trim()) return;
    try {
      await createInvestigation(token, { project_id: projectId.trim(), priority, notes: notes.trim() || undefined });
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

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Investigations</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Human-in-the-loop review of flagged projects. Creating and updating investigations requires signing in as
          ADMIN or OFFICER — {canManage ? "you're signed in with access." : "sign in to manage them."}
        </p>

        {!user && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Link href="/" className="font-semibold underline">
              Sign in
            </Link>{" "}
            as an OFFICER or ADMIN to create or update investigations. You can still browse existing ones below.
          </div>
        )}

        {canManage && (
          <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
            <label className="text-xs font-semibold">
              Project ID
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Paste a project ID from its detail page"
                className="mt-1 block w-72 rounded border border-dashboard-line px-2 py-1.5 text-sm"
                required
              />
            </label>
            <label className="text-xs font-semibold">
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block rounded border border-dashboard-line px-2 py-1.5 text-sm">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </label>
            <label className="flex-1 text-xs font-semibold">
              Notes
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is this being flagged?"
                className="mt-1 block w-full rounded border border-dashboard-line px-2 py-1.5 text-sm"
              />
            </label>
            <button type="submit" className="rounded bg-dashboard-navy px-4 py-2 text-sm font-semibold text-white hover:bg-dashboard-deep">
              Create
            </button>
          </form>
        )}

        <div className="mt-4 flex gap-2">
          {["", "OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded border px-3 py-1.5 text-xs font-bold ${statusFilter === s ? "ring-2 ring-dashboard-navy" : ""} ${
                s ? STATUS_STYLES[s] : "border-dashboard-line text-dashboard-muted"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && investigations.length === 0 && !error && (
          <p className="mt-6 text-sm text-dashboard-muted">No investigations{statusFilter ? ` with status ${statusFilter}` : ""} yet.</p>
        )}

        {investigations.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-lg bg-white shadow-sm">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {investigations.map((inv) => (
                  <tr key={inv.id} className="border-b border-dashboard-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/projects/${inv.project_id}`} className="font-semibold text-dashboard-navy hover:underline">
                        {inv.project_name}
                      </Link>
                      <div className="text-[11px] text-dashboard-muted">{inv.project_external_id}</div>
                    </td>
                    <td className="px-4 py-3">{inv.priority}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-dashboard-muted">{inv.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select
                          value={inv.status}
                          onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                          className={`rounded border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[inv.status] ?? ""}`}
                        >
                          <option value="OPEN">OPEN</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                      ) : (
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[inv.status] ?? ""}`}>
                          {inv.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dashboard-muted">{new Date(inv.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
