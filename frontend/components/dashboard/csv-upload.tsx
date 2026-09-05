"use client";

import { useState } from "react";

import { ApiError, uploadProjectsCsv, type IngestionReport } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function CsvUpload() {
  const { user, token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<IngestionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canUpload = user?.role === "ADMIN" || user?.role === "ANALYST";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    setReport(null);
    try {
      const result = await uploadProjectsCsv(token, file);
      setReport(result);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Is the backend reachable?");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Upload Project Data</h2>
      <p className="mt-1 text-xs text-dashboard-muted">
        Upload a CSV of project records through the same validation/normalization pipeline the synthetic dataset went
        through. Requires signing in as ADMIN or ANALYST.
      </p>

      {!user && <p className="mt-3 text-xs text-amber-700">Sign in to upload data.</p>}
      {user && !canUpload && (
        <p className="mt-3 text-xs text-amber-700">Your role ({user.role}) can&apos;t upload data — ADMIN or ANALYST only.</p>
      )}

      {canUpload && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded bg-dashboard-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload & Ingest"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}

      {report && (
        <div className="mt-4 rounded border border-dashboard-line bg-dashboard-surface p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-dashboard-muted">
            Ingestion report — {report.source_filename}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              Received: <strong>{report.records_received}</strong>
            </div>
            <div>
              Valid: <strong className="text-emerald-700">{report.valid}</strong>
            </div>
            <div>
              Invalid: <strong className="text-red-700">{report.invalid}</strong>
            </div>
            <div>
              Duplicate candidates: <strong>{report.duplicate_candidates}</strong>
            </div>
          </div>
          {report.validation_errors.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold text-dashboard-navy">
                Sample validation errors ({report.validation_errors.length})
              </summary>
              <ul className="mt-1 space-y-1">
                {report.validation_errors.slice(0, 10).map((e, i) => (
                  <li key={i} className="text-dashboard-muted">
                    row {e.row} ({e.external_project_id ?? "no ID"}): {e.errors.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
