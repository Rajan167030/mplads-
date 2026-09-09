"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ApiError, getComplaintStatus, type ComplaintStatusResult } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting review",
  UNDER_REVIEW: "Under review by an official",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

export default function ComplaintStatusPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ComplaintStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getComplaintStatus(token.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "No complaint found for that reference code." : "Something went wrong. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-dashboard-navy text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <ShieldCheck size={22} className="text-dashboard-lime" />
          <div>
            <div className="text-[10px] font-medium text-slate-300">Government of India · MPLADS</div>
            <div className="text-sm font-bold">Check Complaint Status</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/public" className="text-xs font-semibold text-dashboard-navy hover:underline">
          ← Back to public portal
        </Link>

        <form onSubmit={handleCheck} className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-xs font-bold text-slate-700">Your reference code</label>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the code you received at submission"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-dashboard-navy focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-dashboard-navy px-4 py-2.5 text-sm font-bold text-white transition hover:bg-dashboard-blue disabled:opacity-60"
          >
            {loading ? "Checking…" : "Check Status"}
          </button>
          {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
        </form>

        {result && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Project</div>
            <div className="text-sm font-semibold text-slate-900">{result.project_name}</div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</div>
                <div className="text-sm font-semibold text-slate-900">{STATUS_LABELS[result.status] ?? result.status}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</div>
                <div className={`text-sm font-semibold ${result.is_location_verified ? "text-emerald-700" : "text-amber-700"}`}>
                  {result.is_location_verified ? "Verified" : "Not verified"}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-slate-500">Submitted {new Date(result.created_at).toLocaleString()}</div>
          </div>
        )}
      </main>
    </div>
  );
}
