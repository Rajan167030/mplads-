# Isolation Forest Model Evaluation

Projects scored: 9901
Flagged as anomalies: 495 (5.0%)

## Recall by planted category

| Category | Recovered | Total | Recall |
|---|---|---|---|
| COST_ANOMALY | 8 | 100 | 8.0% |
| DELAY_ANOMALY | 30 | 100 | 30.0% |
| PAYMENT_PROGRESS_MISMATCH | 98 | 98 | 100.0% |
| CONTRACTOR_RISK_PATTERN | 28 | 49 | 57.1% |
| GEOGRAPHIC_CONCENTRATION | 2 | 30 | 6.7% |
| EVIDENCE_ANOMALY | 1 | 30 | 3.3% |

## Charts

- `feature_distributions.png` — why the model separates (or doesn't) flagged vs normal projects
  on each engineered feature.
- `anomaly_score_distribution.png` — where the 5% contamination cutoff actually falls.
- `recall_by_category.png` — the same story as the table above, visually.

See `mplads-intelligence/docs/decisions.md` ADR-006 for why recall is uneven across categories
(single-dimension anomalies like COST_ANOMALY are structurally harder for Isolation Forest to
isolate than multi-dimension ones like PAYMENT_PROGRESS_MISMATCH) — this is documented model
behavior, not something this report papers over.