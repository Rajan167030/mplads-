# Ensemble Comparison — Isolation Forest vs. Autoencoder vs. DBSCAN vs. combined

Projects: 10000  |  Ground truth positives (numeric-detectable categories): 399
Dropped (near-zero-variance) features: milestone_max_regression, inspection_max_regression, contractor_delayed_rate, contractor_high_risk_rate, n_milestones, n_inspections

## Overall

| Detector | Flagged | Precision | Recall | F1 |
|---|---|---|---|---|
| Max-|z|-score baseline | 500 | 32.6% | 40.9% | 0.363 |
| Isolation Forest | 500 | 33.8% | 42.4% | 0.376 |
| Autoencoder | 500 | 31.2% | 39.1% | 0.347 |
| DBSCAN | 563 | 31.3% | 44.1% | 0.366 |
| Ensemble — any of 3 | 862 | 23.7% | 51.1% | 0.324 |
| Ensemble — >=2 of 3 agree | 481 | 36.8% | 44.4% | 0.402 |

## Per-category recall

| Category | Baseline | Isolation Forest | Autoencoder | DBSCAN | Ensemble (any of 3) | Ensemble (>=2 agree) |
|---|---|---|---|---|---|---|
| CONTRACTOR_RISK_PATTERN | 39/50 (78%) | 28/50 (56%) | 36/50 (72%) | 39/50 (78%) | 43/50 (86%) | 39/50 (78%) |
| COST_ANOMALY | 24/100 (24%) | 35/100 (35%) | 16/100 (16%) | 43/100 (43%) | 50/100 (50%) | 35/100 (35%) |
| DELAY_ANOMALY | 4/100 (4%) | 3/100 (3%) | 5/100 (5%) | 7/100 (7%) | 8/100 (8%) | 4/100 (4%) |
| EVIDENCE_ANOMALY | 2/30 (7%) | 2/30 (7%) | 1/30 (3%) | 2/30 (7%) | 3/30 (10%) | 1/30 (3%) |
| GEOGRAPHIC_CONCENTRATION | 1/30 (3%) | 9/30 (30%) | 6/30 (20%) | 6/30 (20%) | 9/30 (30%) | 6/30 (20%) |
| PAYMENT_PROGRESS_MISMATCH | 100/100 (100%) | 98/100 (98%) | 100/100 (100%) | 87/100 (87%) | 100/100 (100%) | 99/100 (99%) |

**Best F1: ensemble_consensus_2_of_3 (0.402).**