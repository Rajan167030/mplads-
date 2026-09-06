"""Trains the Isolation Forest anomaly detector over the real project data."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ml.anomaly_model import run_ml_detection  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        detection_report = run_ml_detection(db)
    finally:
        db.close()

    print("ML anomaly detection report")
    print("----------------------------")
    print(f"Projects scored:   {detection_report.projects_scored}")
    print(f"Anomalies flagged: {detection_report.anomalies_flagged}")
    print(f"Features used:     {', '.join(detection_report.feature_names)}")
    print()
    print("Evaluation: unavailable because the real dataset has no planted labels")


if __name__ == "__main__":
    main()
