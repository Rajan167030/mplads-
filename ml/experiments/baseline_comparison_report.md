# Baseline vs. Isolation Forest

Projects: 9901  |  Flagged by each detector: 495 (matched rate, 5%)
Ground truth positives (numeric-detectable categories): 403

## Overall

| Detector | Precision | Recall | F1 |
|---|---|---|---|
| Isolation Forest | 33.3% | 40.9% | 0.367 |
| Max-|z|-score baseline | 36.4% | 44.7% | 0.401 |

## Per-category recall

| Category | Isolation Forest | Baseline |
|---|---|---|
| CONTRACTOR_RISK_PATTERN | 28/49 (57%) | 32/49 (65%) |
| COST_ANOMALY | 5/100 (5%) | 24/100 (24%) |
| DELAY_ANOMALY | 32/100 (32%) | 23/100 (23%) |
| EVIDENCE_ANOMALY | 1/30 (3%) | 1/30 (3%) |
| GEOGRAPHIC_CONCENTRATION | 2/30 (7%) | 4/30 (13%) |
| PAYMENT_PROGRESS_MISMATCH | 98/98 (100%) | 98/98 (100%) |

**Verdict: The baseline matches or beats Isolation Forest on F1.**