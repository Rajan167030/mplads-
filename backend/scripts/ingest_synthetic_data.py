"""Runs the full ingestion pipeline against data/raw/*.csv and prints the
resulting data-quality report. Requires the synthetic dataset to already exist
(run generate_synthetic_data.py first) and the database migrations applied."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ingestion.pipeline import run_full_ingestion  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def main() -> None:
    db = SessionLocal()
    try:
        report = run_full_ingestion(db, DATA_DIR)
    finally:
        db.close()

    print("Ingestion report")
    print("-----------------")
    print(f"Records received: {report.records_received}")
    print()
    print(f"Valid:   {report.valid}")
    print(f"Invalid: {report.invalid}")
    print()
    print(f"Missing location:    {report.missing_location}")
    print(f"Missing contractor:  {report.missing_contractor}")
    print(f"Missing amount:      {report.missing_amount}")
    print()
    print(f"Duplicate candidates: {report.duplicate_candidates}")
    print(f"Entity matches:       {report.entity_matches} (populated in Phase 3)")
    print(f"Uncertain matches:    {report.uncertain_matches} (populated in Phase 3)")
    print()
    print(f"Language distribution: {report.language_distribution}")
    if report.validation_errors:
        print()
        print(f"Sample validation errors ({len(report.validation_errors)} shown):")
        for err in report.validation_errors[:10]:
            print(f"  row {err['row']} ({err['external_project_id']}): {err['errors']}")


if __name__ == "__main__":
    main()
