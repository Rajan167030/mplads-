"""Ingests the real MPLADS data (already transformed into data/raw/real_*.csv
by scripts/import_real_mplads_data.py) ALONGSIDE the existing synthetic
dataset — additive, not a replacement. Uses the same ingestion functions as
the synthetic pipeline (app.ingestion.pipeline), just pointed at the real
files, with fresh contractor/agency caches (real data has no contractor
field, and real "Implementing Agency" strings look nothing like the
synthetic generator's agency-name templates, so cross-batch name collisions
are not a practical concern here).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ingestion.pipeline import ingest_payments, ingest_projects  # noqa: E402
from app.models.ingestion_report import IngestionReport  # noqa: E402

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


def main() -> None:
    db = SessionLocal()
    try:
        project_id_by_external, report = ingest_projects(db, RAW_DIR / "real_projects.csv", {}, {})
        payment_count = ingest_payments(db, RAW_DIR / "real_payments.csv", project_id_by_external)

        ingestion_report = IngestionReport(
            source_filename="real_projects.csv",
            records_received=report["records_received"],
            valid=report["valid"],
            invalid=report["invalid"],
            missing_location=report["missing_location"],
            missing_contractor=report["missing_contractor"],
            missing_amount=report["missing_amount"],
            duplicate_candidates=0,  # computed across the whole table by a later full-dataset pass
            entity_matches=0,
            uncertain_matches=0,
            language_distribution=report["language_distribution"],
            validation_errors=report["validation_errors"],
        )
        db.add(ingestion_report)
        db.commit()
    finally:
        db.close()

    print("Real-data ingestion report")
    print("---------------------------")
    print(f"Records received: {report['records_received']}")
    print(f"Valid:   {report['valid']}")
    print(f"Invalid: {report['invalid']}")
    print()
    print(f"Missing location:   {report['missing_location']}")
    print(f"Missing contractor: {report['missing_contractor']}")
    print(f"Missing amount:     {report['missing_amount']}")
    print()
    print(f"Payments ingested: {payment_count}")
    print()
    print(f"Language distribution: {report['language_distribution']}")
    if report["validation_errors"]:
        print()
        print(f"Sample validation errors ({len(report['validation_errors'])} total):")
        for err in report["validation_errors"][:10]:
            print(f"  row {err['row']} ({err['external_project_id']}): {err['errors']}")


if __name__ == "__main__":
    main()
