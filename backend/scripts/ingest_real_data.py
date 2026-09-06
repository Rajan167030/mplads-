"""Replaces the operational dataset with the transformed real MPLADS data."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.ingestion.pipeline import ingest_payments, ingest_projects  # noqa: E402
from app.models.agency import Agency  # noqa: E402
from app.models.contractor import Contractor  # noqa: E402
from app.models.entity_match import EntityMatch  # noqa: E402
from app.models.evidence import Evidence  # noqa: E402
from app.models.ingestion_report import IngestionReport  # noqa: E402
from app.models.inspection import Inspection  # noqa: E402
from app.models.investigation import Investigation  # noqa: E402
from app.models.milestone import Milestone  # noqa: E402
from app.models.payment import Payment  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.risk_signal import RiskSignal  # noqa: E402

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


def clear_operational_data(db) -> None:
    """Remove prior generated/imported project data while preserving users."""
    for model in (EntityMatch, Investigation, RiskSignal, Evidence, Inspection, Milestone, Payment):
        db.query(model).delete(synchronize_session=False)
    db.query(Project).delete(synchronize_session=False)
    db.query(Contractor).delete(synchronize_session=False)
    db.query(Agency).delete(synchronize_session=False)
    db.query(IngestionReport).delete(synchronize_session=False)
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        clear_operational_data(db)
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
