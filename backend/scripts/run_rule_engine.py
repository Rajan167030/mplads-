"""Runs the rule-based pattern detection engine (P01-P10, see app/risk/rules)
over every project currently in the database and prints a summary."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.risk.engine import run_rule_engine  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        report = run_rule_engine(db)
    finally:
        db.close()

    print("Rule engine report")
    print("-------------------")
    print(f"Projects scanned: {report.projects_scanned}")
    print(f"Signals created:  {report.signals_created}")
    print()
    for signal_type, count in sorted(report.by_type.items(), key=lambda x: -x[1]):
        print(f"  {signal_type:<32} {count}")


if __name__ == "__main__":
    main()
