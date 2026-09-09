"use client";

import { useState } from "react";

import { ApiError, downloadReportCsv } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const REPORTS: { key: "projects" | "risk-signals" | "investigations"; title: string; description: string }[] = [
  {
    key: "projects",
    title: "All Projects",
    description: "Every project with sanctioned/released amounts, progress, contractor, and current risk score/band.",
  },
  {
    key: "risk-signals",
    title: "Risk Signals",
    description: "Every detected signal (rule-based and ML) with type, source, severity, score, and confidence.",
  },
  {
    key: "investigations",
    title: "Investigations",
    description: "Every investigation record with priority, status, resolution, and notes.",
  },
];

export default function ReportsPage() {
  const { user, token } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(report: (typeof REPORTS)[number]["key"]) {
    if (!token) return;
    setDownloading(report);
    setError(null);
    try {
      await downloadReportCsv(token, report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-dashboard-muted">
          Export the current state of the system as CSV, scoped to your jurisdiction. Each file is streamed directly
          from the database, so it always reflects exactly what&apos;s stored right now — never a cached or stale
          snapshot.
        </p>

        {!user && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Sign in to export reports.</div>
        )}
        {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <div key={r.key} className="flex flex-col rounded-lg bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">{r.title}</h2>
              <p className="mt-1 flex-1 text-xs text-dashboard-muted">{r.description}</p>
              <button
                onClick={() => handleDownload(r.key)}
                disabled={!user || downloading === r.key}
                className="mt-4 rounded bg-dashboard-navy px-4 py-2 text-center text-sm font-semibold text-white hover:bg-dashboard-deep disabled:opacity-60"
              >
                {downloading === r.key ? "Downloading…" : "Download CSV"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
