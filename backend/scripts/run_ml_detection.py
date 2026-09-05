"""Trains the Isolation Forest anomaly detector over the current project
feature matrix, persists ML_STATISTICAL_ANOMALY signals, and evaluates
against the synthetic ground truth (precision/recall/F1)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ml.anomaly_model import run_ml_detection  # noqa: E402
from app.ml.evaluation import evaluate  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        detection_report = run_ml_detection(db)
        eval_report = evaluate(db)
    finally:
        db.close()

    print("ML anomaly detection report")
    print("----------------------------")
    print(f"Projects scored:   {detection_report.projects_scored}")
    print(f"Anomalies flagged: {detection_report.anomalies_flagged}")
    print(f"Features used:     {', '.join(detection_report.feature_names)}")
    print()
    print("Evaluation against planted ground truth (numeric-detectable categories only)")
    print("------------------------------------------------------------------------------")
    print(f"Planted anomalies (loaded): {eval_report.planted_anomalies}")
    print(f"ML flagged:                 {eval_report.ml_flagged}")
    print(f"True positives:             {eval_report.true_positives}")
    print(f"False positives:            {eval_report.false_positives}")
    print(f"False negatives:            {eval_report.false_negatives}")
    print(f"Precision: {eval_report.precision:.1%}  Recall: {eval_report.recall:.1%}  F1: {eval_report.f1:.3f}")


if __name__ == "__main__":
    main()
