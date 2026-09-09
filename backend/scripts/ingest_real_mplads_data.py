"""Loads the real MPLADS sample (data/raw/real_mplads_projects.csv +
real_mplads_payments.csv, produced by transform_real_mplads_tiles.py) ON TOP
OF whatever's already in the database — unlike scripts/ingest_real_data.py,
this does NOT clear existing projects/contractors/agencies first. The
existing synthetic dataset (full Payment/Milestone/Inspection/Evidence
richness) and this real, MP-attributed sample are meant to coexist, tagged
by Project.data_source. See docs/decisions.md for why."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ingestion.pipeline import ingest_payments, ingest_projects  # noqa: E402
from app.models.enums import DataSource  # noqa: E402
from app.models.ingestion_report import IngestionReport  # noqa: E402

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


def main() -> None:
    db = SessionLocal()
    try:
        project_id_by_external, report = ingest_projects(
            db, RAW_DIR / "real_mplads_projects.csv", {}, {}, data_source=DataSource.REAL_MPLADS
        )
        payment_count = ingest_payments(db, RAW_DIR / "real_mplads_payments.csv", project_id_by_external)

        db.add(IngestionReport(
            source_filename="real_mplads_projects.csv",
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
        ))
        db.commit()
    finally:
        db.close()

    print("Real MPLADS ingestion report (additive — synthetic data untouched)")
    print("--------------------------------------------------------------------")
    print(f"Records received: {report['records_received']}")
    print(f"Valid:   {report['valid']}")
    print(f"Invalid: {report['invalid']}")
    print()
    print(f"Missing location:   {report['missing_location']}")
    print(f"Missing contractor: {report['missing_contractor']}  (expected ~100% — real feed has none)")
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
