import { reportDownloadUrl } from "@/lib/api";

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
  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-dashboard-muted">
          Export the current state of the system as CSV. Each file is streamed directly from the database, so it
          always reflects exactly what&apos;s stored right now — never a cached or stale snapshot.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <div key={r.key} className="flex flex-col rounded-lg bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">{r.title}</h2>
              <p className="mt-1 flex-1 text-xs text-dashboard-muted">{r.description}</p>
              <a
                href={reportDownloadUrl(r.key)}
                className="mt-4 inline-block rounded bg-dashboard-navy px-4 py-2 text-center text-sm font-semibold text-white hover:bg-dashboard-deep"
              >
                Download CSV
              </a>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
