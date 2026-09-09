"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiError,
  getComplaintPhotoUrl,
  listComplaints,
  updateComplaint,
  type ComplaintListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  UNDER_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DISMISSED: "bg-slate-100 text-slate-600 border-slate-200",
};

const MANAGER_ROLES = ["DISTRICT_AUTHORITY", "STATE_NODAL", "MINISTRY"];

export default function ComplaintsPage() {
  const { user, token } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const canManage = !!user && MANAGER_ROLES.includes(user.role);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listComplaints({ status: statusFilter || undefined, verified_only: verifiedOnly }, token);
      setComplaints(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the backend API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, verifiedOnly, token]);

  async function handleStatusChange(id: string, status: string) {
    if (!token) return;
    try {
      await updateComplaint(token, id, { status });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update complaint.");
    }
  }

  async function handleSaveNotes(id: string) {
    if (!token) return;
    try {
      await updateComplaint(token, id, { resolution_notes: notesDraft[id] ?? "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save notes.");
    }
  }

  async function handleViewPhoto(id: string) {
    if (!token) return;
    try {
      const url = await getComplaintPhotoUrl(token, id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load photo.");
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1400px] rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Link href="/" className="font-semibold underline">
            Sign in
          </Link>{" "}
          as an official to review citizen complaints.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Citizen Complaints</h1>
        <p className="mt-1 text-sm text-dashboard-muted">
          Anonymous, photo-backed reports from the public portal. Each submission&apos;s GPS reading was checked against
          the project&apos;s own site — &quot;Location Verified&quot; means the citizen was within 200m of it when they submitted.
          {canManage ? "" : " Reviewing status requires signing in as a District Authority, State Nodal, or Ministry official."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {["", "PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED"].map((s) => (
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
          <label className="ml-2 flex items-center gap-1.5 text-xs font-semibold text-dashboard-muted">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            Location-verified only
          </label>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && complaints.length === 0 && !error && (
          <p className="mt-6 text-sm text-dashboard-muted">No complaints{statusFilter ? ` with status ${statusFilter}` : ""} yet.</p>
        )}

        {complaints.length > 0 && (
          <div className="mt-5 space-y-3">
            {complaints.map((c) => (
              <div key={c.id} className="rounded-lg bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/projects/${c.project_id}`} className="font-semibold text-dashboard-navy hover:underline">
                      {c.project_name}
                    </Link>
                    <div className="text-[11px] text-dashboard-muted">{c.project_external_id}</div>
                    <p className="mt-2 text-sm text-dashboard-ink">{c.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {c.is_location_verified ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Location Verified
                      </span>
                    ) : (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Not Verified
                      </span>
                    )}
                    {c.distance_to_project_m !== null && (
                      <span className="text-[10px] text-dashboard-muted">
                        {c.distance_to_project_m < 1000
                          ? `${c.distance_to_project_m.toFixed(0)}m from site`
                          : `${(c.distance_to_project_m / 1000).toFixed(1)}km from site`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleViewPhoto(c.id)}
                    className="rounded border border-dashboard-line px-2.5 py-1 text-[11px] font-bold text-dashboard-navy hover:bg-dashboard-surface"
                  >
                    View Photo
                  </button>
                  {canManage ? (
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className={`rounded border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[c.status] ?? ""}`}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="DISMISSED">DISMISSED</option>
                    </select>
                  ) : (
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  )}
                  <span className="text-[10px] text-dashboard-muted">{new Date(c.created_at).toLocaleString()}</span>
                </div>

                {canManage && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={notesDraft[c.id] ?? ""}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                      placeholder="Investigator notes…"
                      className="flex-1 rounded border border-dashboard-line px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => handleSaveNotes(c.id)}
                      className="rounded border border-dashboard-navy px-2.5 py-1 text-[11px] font-bold text-dashboard-navy hover:bg-dashboard-navy hover:text-white"
                    >
                      Save Note
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
