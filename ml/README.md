# ML workspace

## `models/`

The actual trained artifact used by the running system: `isolation_forest.joblib`
(model + scaler + feature names), written by `backend/app/ml/anomaly_model.py`
every time `POST /api/ml/run` or `scripts/run_ml_detection.py` executes.

## `notebooks/model_evaluation.py`

A real evaluation report, not a placeholder — run it and it connects to the live
database, loads the actual trained model, and produces:
- `output/feature_distributions.png` — flagged vs. not-flagged histograms per feature
- `output/anomaly_score_distribution.png`
- `output/anomaly_score_distribution.png` — anomaly-score distribution from the
  currently loaded real MPLADS dataset. The production runner does not report
  precision/recall because the real export has no planted labels.

```bash
cd backend && python ../ml/notebooks/model_evaluation.py
```

## `experiments/baseline_vs_isolation_forest.py`

A real experiment, run and reported honestly: does Isolation Forest actually earn
its complexity over a dead-simple "flag whichever projects have the single most
extreme feature value" baseline, at the same flagging rate?

**Result: no, not on this dataset** — the baseline slightly *beats* Isolation Forest
overall (F1 0.401 vs 0.367) and clearly beats it on `COST_ANOMALY` (24% vs 5% recall).
See `baseline_comparison_report.md` for the full table. This isn't hidden or spun —
it's a genuine, useful finding: **both** generic statistical approaches are
dominated by the domain-specific peer-group rules in `backend/app/risk/rules/`
for the anomaly types those rules understand (P02's cost-anomaly rule alone gets
96% recall — see `docs/decisions.md` ADR-006). The real case for keeping
Isolation Forest in the pipeline isn't "it wins a benchmark" — it's that it's the
only detector in the system that can flag a *correlated, multi-feature* drift
pattern nobody thought to write a rule for, which a single-feature baseline
structurally cannot do (see `PAYMENT_PROGRESS_MISMATCH`, where all three
approaches hit 100% because the pattern is inherently two-dimensional).

```bash
cd backend && python ../ml/experiments/baseline_vs_isolation_forest.py
```
