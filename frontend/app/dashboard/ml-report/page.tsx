import fs from "node:fs";
import path from "node:path";

interface ReviewItem {
  rank: number;
  project_id: string;
  project_name: string;
  district: string;
  state: string;
  anomaly_score: number;
  district_authority_action: string;
}

interface TrainingReport {
  data_source: { project_rows: number; payment_rows: number };
  training: {
    feature_count: number;
    rows_trained: number;
    anomalies_flagged: number;
    estimators: number;
    split: { train_rows: number; test_rows: number; train_test_project_id_overlap: number; leakage_check: string };
    held_out_test: { anomalies_flagged: number };
  };
  feature_source_gaps: { dropped_features: string[]; reason: string };
  human_verification_queue: ReviewItem[];
  feature_contributions: { feature: string; relative_contribution: number }[];
}

function readReport(): TrainingReport | null {
  try {
    const reportPath = path.join(process.cwd(), "..", "ml", "models", "real_data_training_report.json");
    return JSON.parse(fs.readFileSync(reportPath, "utf8")) as TrainingReport;
  } catch {
    return null;
  }
}

export default function MlReportPage() {
  const report = readReport();
  return (
    <main className="min-h-screen bg-dashboard-surface px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">ML Evidence &amp; Review</h1>
        <p className="mt-2 max-w-3xl text-sm text-dashboard-muted">
          Real-data anomaly flags are unverified statistical outliers. Synthetic precision, recall, and F1 remain a separate benchmark.
        </p>
        {!report ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Training report not found. Run the local trainer first.</div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["CSV projects", report.data_source.project_rows.toLocaleString()],
                ["CSV payments", report.data_source.payment_rows.toLocaleString()],
                ["Features", report.training.feature_count.toString()],
                ["Train / test", `${report.training.split.train_rows.toLocaleString()} / ${report.training.split.test_rows.toLocaleString()}`],
                ["Leakage", report.training.split.leakage_check],
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-white p-4 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-wider text-dashboard-muted">{label}</div><div className="mt-2 text-xl font-bold">{value}</div></div>)}
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.6fr]">
              <section className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold">Model evidence</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><dt className="text-dashboard-muted">Rows loaded</dt><dd className="font-semibold">{report.training.rows_trained.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt className="text-dashboard-muted">Trees</dt><dd className="font-semibold">{report.training.estimators}</dd></div>
                  <div className="flex justify-between"><dt className="text-dashboard-muted">Flags at 5%</dt><dd className="font-semibold">{report.training.anomalies_flagged.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt className="text-dashboard-muted">Held-out flags</dt><dd className="font-semibold">{report.training.held_out_test.anomalies_flagged.toLocaleString()}</dd></div>
                  <div className="flex justify-between"><dt className="text-dashboard-muted">ID overlap</dt><dd className="font-semibold">{report.training.split.train_test_project_id_overlap}</dd></div>
                </dl>
                <h3 className="mt-6 text-sm font-semibold">Pending source data</h3>
                <p className="mt-2 text-xs text-dashboard-muted">{report.feature_source_gaps.reason}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-dashboard-muted">{report.feature_source_gaps.dropped_features.map((gap) => <li key={gap}>{gap}</li>)}</ul>
              </section>
              <section className="rounded-lg bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold">Feature contribution</h2>
                <p className="mt-1 text-xs text-dashboard-muted">Relative absolute z-score among flagged rows; not causal importance.</p>
                <div className="mt-4 space-y-2">{report.feature_contributions.slice(0, 10).map((item) => <div key={item.feature}><div className="flex justify-between text-xs"><span>{item.feature}</span><span>{item.relative_contribution.toFixed(2)}</span></div><div className="mt-1 h-2 rounded bg-dashboard-surface"><div className="h-2 rounded bg-dashboard-teal" style={{ width: `${Math.min(item.relative_contribution * 35, 100)}%` }} /></div></div>)}</div>
              </section>
            </div>
            <section className="mt-5 overflow-x-auto rounded-lg bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">Top-20 district authority review queue</h2>
              <p className="mt-1 text-xs text-dashboard-muted">Actions are human decisions: verify, false positive, or confirmed.</p>
              <table className="mt-4 w-full min-w-[900px] text-sm"><thead><tr className="border-b border-dashboard-line text-left text-[10px] font-bold uppercase tracking-wider text-dashboard-muted"><th className="py-3">#</th><th>Project</th><th>Location</th><th>Score</th><th>District authority action</th></tr></thead><tbody>{report.human_verification_queue.map((item) => <tr key={item.project_id} className="border-b border-dashboard-line/60"><td className="py-3">{item.rank}</td><td><div className="font-semibold">{item.project_name}</div><div className="text-[11px] text-dashboard-muted">{item.project_id}</div></td><td>{item.district}, {item.state}</td><td className="font-semibold">{item.anomaly_score.toFixed(1)}</td><td><select defaultValue="" className="rounded border border-dashboard-line bg-white px-2 py-1 text-xs"><option value="" disabled>Select action</option><option>VERIFY</option><option>FALSE_POSITIVE</option><option>CONFIRMED</option></select></td></tr>)}</tbody></table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
