"""Convenience wrapper: runs the rule engine, ML anomaly detection, and risk
scoring in the order they depend on each other. Equivalent to running
run_rule_engine.py, run_ml_detection.py, and run_risk_scoring.py in sequence."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ml.anomaly_model import run_ml_detection  # noqa: E402
from app.risk.engine import run_rule_engine  # noqa: E402
from app.risk.scoring import run_risk_scoring  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        rule_report = run_rule_engine(db)
        print(f"Rule engine:  {rule_report.projects_scanned} scanned, {rule_report.signals_created} signals")

        ml_report = run_ml_detection(db)
        print(f"ML detection: {ml_report.projects_scored} scored, {ml_report.anomalies_flagged} flagged")

        scoring_report = run_risk_scoring(db)
        print(f"Risk scoring: {scoring_report.projects_scored} scored — {scoring_report.band_counts}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
