import { CsvUpload } from "@/components/dashboard/csv-upload";
import { getDataQuality, type DataQuality } from "@/lib/api";
import { DEMO_DATA_QUALITY, isNetworkError } from "@/lib/demo-data";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-dashboard-surface p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default async function DataQualityPage() {
  let data: DataQuality | null = null;
  let fetchError: string | null = null;
  try {
    data = await getDataQuality();
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn("[data-quality] backend unreachable, rendering demo data");
      data = DEMO_DATA_QUALITY;
    } else {
      fetchError = "Something went wrong loading this page. Please try again shortly.";
    }
  }

  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Data Quality</h1>
        <p className="mt-2 max-w-3xl text-sm text-dashboard-muted">
          Real-world government data is incomplete and inconsistent by nature. This report is computed directly from
          the ingestion pipeline and the entity resolution pass — every number below reflects what is actually in the
          database right now.
        </p>

        {fetchError && (
          <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
        )}

        <div className="mt-6">
          <CsvUpload />
        </div>

        {data && (
          <>
            {data.latest_ingestion_at && (
              <p className="mt-2 text-xs text-dashboard-muted">
                Last ingestion run: {new Date(data.latest_ingestion_at).toLocaleString("en-IN")}
              </p>
            )}

            <div className="mt-6 rounded-lg bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Ingestion Coverage</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <StatCard label="Records Processed" value={data.records_processed.toLocaleString()} />
                <StatCard label="Total Projects Loaded" value={data.total_projects.toLocaleString()} />
                <StatCard label="Invalid / Rejected" value={data.invalid_records.toLocaleString()} />
                <StatCard label="Missing Location" value={data.missing_location.toLocaleString()} />
                <StatCard label="Missing Contractor (text)" value={data.missing_contractor_text.toLocaleString()} />
                <StatCard label="No Contractor Link" value={data.missing_contractor_link.toLocaleString()} />
                <StatCard label="Missing Amount" value={data.missing_amount.toLocaleString()} />
                <StatCard label="Projects w/o Payments" value={data.projects_without_payments.toLocaleString()} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold">Entity Resolution</h2>
                <p className="mt-1 text-xs text-dashboard-muted">
                  Multilingual candidate matching across project records (see Phase 3 in the build log).
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatCard label="Duplicate Candidates" value={data.duplicate_candidates.toLocaleString()} />
                  <StatCard label="Confirmed Matches" value={data.entity_matches.toLocaleString()} />
                  <StatCard label="Possible Matches" value={data.uncertain_matches.toLocaleString()} />
                </div>
                <p className="mt-3 text-xs text-dashboard-muted">
                  Average match confidence:{" "}
                  <strong className="text-dashboard-ink">
                    {data.average_entity_match_confidence !== null
                      ? data.average_entity_match_confidence.toFixed(3)
                      : "not yet computed"}
                  </strong>
                </p>
              </div>

              <div className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold">Language Distribution</h2>
                <p className="mt-1 text-xs text-dashboard-muted">Detected per project name at ingestion time.</p>
                <div className="mt-4 space-y-1.5">
                  {Object.entries(data.language_distribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([lang, count]) => {
                      const total = Object.values(data!.language_distribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={lang} className="flex items-center gap-3">
                          <span className="w-10 shrink-0 font-mono text-xs uppercase text-dashboard-muted">{lang}</span>
                          <div className="h-2 flex-1 rounded-full bg-dashboard-surface">
                            <span className="block h-full rounded-full bg-dashboard-navy" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-16 shrink-0 text-right text-xs text-dashboard-muted">
                            {count.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
