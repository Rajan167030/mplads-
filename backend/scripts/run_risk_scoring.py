"""Combines every RiskSignal (rules + ML + correlated) into one 0-100
risk_score and LOW/MEDIUM/HIGH/CRITICAL band per project. Run after
run_rule_engine.py and run_ml_detection.py so all signal sources are present."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.risk.scoring import run_risk_scoring  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        report = run_risk_scoring(db)
    finally:
        db.close()

    print("Risk scoring report")
    print("--------------------")
    print(f"Projects scored: {report.projects_scored}")
    for band, count in sorted(report.band_counts.items()):
        print(f"  {band:10} {count}")


if __name__ == "__main__":
    main()
