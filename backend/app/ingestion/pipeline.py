"""Ingestion pipeline: Raw CSV -> column mapping -> validation -> normalization
-> canonical database (spec §6). Entity resolution proper (multilingual
embeddings, fuzzy contractor matching) is Phase 3; here, contractor/agency
matching is exact-on-normalized-name only — the honest baseline Phase 3
improves on, not a substitute for it.
"""

import itertools
import uuid
from datetime import datetime
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from app.ingestion.normalizers import detect_language, normalize_name_key, normalize_text, parse_date, parse_float
from app.ingestion.schema import (
    AGENCY_COLUMNS,
    CONTRACTOR_COLUMNS,
    EVIDENCE_COLUMNS,
    INSPECTION_COLUMNS,
    MILESTONE_COLUMNS,
    PAYMENT_COLUMNS,
    PROJECT_COLUMNS,
    REQUIRED_PROJECT_FIELDS,
    map_columns,
)
from app.ingestion.validators import has_valid_location, validate_project
from app.models.agency import Agency
from app.models.contractor import Contractor
from app.models.enums import (
    DataSource,
    EvidenceType,
    MilestoneStatus,
    PaymentStatus,
    PaymentType,
    ProjectStatus,
    ProjectType,
)
from app.models.evidence import Evidence
from app.models.ingestion_report import IngestionReport
from app.models.inspection import Inspection
from app.models.milestone import Milestone
from app.models.payment import Payment
from app.models.project import Project

BATCH_SIZE = 500
DUPLICATE_AMOUNT_TOLERANCE = 0.05
DUPLICATE_DATE_WINDOW_DAYS = 20


def _read_csv(csv_path: Path) -> pd.DataFrame:
    return pd.read_csv(csv_path, dtype=str, keep_default_na=False, na_values=["", "NaN", "nan"])


def _get_or_create_contractor(
    db: Session, cache: dict[str, Contractor], name: str | None, state: str | None = None, district: str | None = None
) -> Contractor | None:
    name = normalize_text(name)
    if not name:
        return None
    key = normalize_name_key(name)
    if key in cache:
        return cache[key]
    contractor = Contractor(name=name, normalized_name=key, state=state, district=district)
    db.add(contractor)
    db.flush()
    cache[key] = contractor
    return contractor


def _get_or_create_agency(
    db: Session, cache: dict[str, Agency], name: str | None, level: str | None = None,
    state: str | None = None, district: str | None = None,
) -> Agency | None:
    name = normalize_text(name)
    if not name:
        return None
    key = normalize_name_key(name)
    if key in cache:
        return cache[key]
    agency = Agency(name=name, level=level, state=state, district=district)
    db.add(agency)
    db.flush()
    cache[key] = agency
    return agency


def ingest_contractors(db: Session, csv_path: Path) -> dict[str, Contractor]:
    cache: dict[str, Contractor] = {}
    if not csv_path.exists():
        return cache
    df = map_columns(_read_csv(csv_path), CONTRACTOR_COLUMNS)
    for row in df.to_dict(orient="records"):
        _get_or_create_contractor(db, cache, row.get("name"), row.get("state"), row.get("district"))
    db.commit()
    return cache


def ingest_agencies(db: Session, csv_path: Path) -> dict[str, Agency]:
    cache: dict[str, Agency] = {}
    if not csv_path.exists():
        return cache
    df = map_columns(_read_csv(csv_path), AGENCY_COLUMNS)
    for row in df.to_dict(orient="records"):
        _get_or_create_agency(db, cache, row.get("name"), row.get("level"), row.get("state"), row.get("district"))
    db.commit()
    return cache


def ingest_projects(
    db: Session,
    csv_path: Path,
    contractor_cache: dict[str, Contractor],
    agency_cache: dict[str, Agency],
    data_source: DataSource = DataSource.SYNTHETIC,
) -> tuple[dict[str, uuid.UUID], dict]:
    df = map_columns(_read_csv(csv_path), PROJECT_COLUMNS, required=REQUIRED_PROJECT_FIELDS)

    project_id_by_external: dict[str, uuid.UUID] = {}
    valid = invalid = missing_location = missing_contractor = missing_amount = 0
    language_counts: dict[str, int] = {}
    validation_errors_sample: list[dict] = []
    records_received = len(df)

    for i, raw in enumerate(df.to_dict(orient="records")):
        normalized = {
            "external_project_id": normalize_text(raw.get("external_project_id")),
            "project_name": normalize_text(raw.get("project_name")),
            "description": normalize_text(raw.get("description")),
            "project_type": normalize_text(raw.get("project_type")),
            "state": normalize_text(raw.get("state")),
            "district": normalize_text(raw.get("district")),
            "constituency": normalize_text(raw.get("constituency")),
            "mp_name": normalize_text(raw.get("mp_name")),
            "latitude": parse_float(raw.get("latitude")),
            "longitude": parse_float(raw.get("longitude")),
            "sanctioned_amount": parse_float(raw.get("sanctioned_amount")),
            "estimated_cost": parse_float(raw.get("estimated_cost")),
            "released_amount": parse_float(raw.get("released_amount")) or 0.0,
            "expenditure_amount": parse_float(raw.get("expenditure_amount")) or 0.0,
            "start_date": parse_date(raw.get("start_date")),
            "expected_completion_date": parse_date(raw.get("expected_completion_date")),
            "actual_completion_date": parse_date(raw.get("actual_completion_date")),
            "physical_progress": parse_float(raw.get("physical_progress")) or 0.0,
            "financial_progress": parse_float(raw.get("financial_progress")) or 0.0,
            "status": normalize_text(raw.get("status")),
            "contractor_name": normalize_text(raw.get("contractor_name")),
            "implementing_agency": normalize_text(raw.get("implementing_agency")),
        }

        if not has_valid_location(normalized):
            missing_location += 1
        if not normalized["contractor_name"]:
            missing_contractor += 1
        if normalized["sanctioned_amount"] is None or normalized["sanctioned_amount"] <= 0:
            missing_amount += 1

        errors = validate_project(normalized)
        if errors:
            invalid += 1
            if len(validation_errors_sample) < 50:
                validation_errors_sample.append(
                    {"row": i, "external_project_id": normalized.get("external_project_id"), "errors": errors}
                )
            continue

        language = detect_language(normalized["project_name"]) or "en"
        language_counts[language] = language_counts.get(language, 0) + 1

        contractor = _get_or_create_contractor(
            db, contractor_cache, normalized["contractor_name"], normalized["state"], normalized["district"]
        )
        agency = _get_or_create_agency(
            db, agency_cache, normalized["implementing_agency"], None, normalized["state"], normalized["district"]
        )

        geom_wkt = None
        if has_valid_location(normalized):
            geom_wkt = f"SRID=4326;POINT({normalized['longitude']} {normalized['latitude']})"

        status_text = normalized["status"].upper() if normalized["status"] else None
        project = Project(
            external_project_id=normalized["external_project_id"],
            project_name=normalized["project_name"],
            description=normalized["description"],
            language=language,
            project_type=ProjectType[normalized["project_type"].upper().replace(" ", "_")],
            state=normalized["state"],
            district=normalized["district"],
            constituency=normalized["constituency"],
            mp_name=normalized["mp_name"],
            data_source=data_source,
            latitude=normalized["latitude"],
            longitude=normalized["longitude"],
            geom=geom_wkt,
            sanctioned_amount=normalized["sanctioned_amount"],
            estimated_cost=normalized["estimated_cost"] or normalized["sanctioned_amount"],
            released_amount=normalized["released_amount"],
            expenditure_amount=normalized["expenditure_amount"],
            start_date=normalized["start_date"],
            expected_completion_date=normalized["expected_completion_date"],
            actual_completion_date=normalized["actual_completion_date"],
            physical_progress=normalized["physical_progress"],
            financial_progress=normalized["financial_progress"],
            status=ProjectStatus[status_text] if status_text in ProjectStatus.__members__ else ProjectStatus.SANCTIONED,
            contractor_id=contractor.id if contractor else None,
            implementing_agency_id=agency.id if agency else None,
        )
        db.add(project)
        db.flush()
        project_id_by_external[normalized["external_project_id"]] = project.id
        valid += 1

        if (i + 1) % BATCH_SIZE == 0:
            db.commit()

    db.commit()

    return project_id_by_external, {
        "records_received": records_received,
        "valid": valid,
        "invalid": invalid,
        "missing_location": missing_location,
        "missing_contractor": missing_contractor,
        "missing_amount": missing_amount,
        "language_distribution": language_counts,
        "validation_errors": validation_errors_sample,
    }


def ingest_payments(db: Session, csv_path: Path, project_id_by_external: dict[str, uuid.UUID]) -> int:
    if not csv_path.exists():
        return 0
    df = map_columns(_read_csv(csv_path), PAYMENT_COLUMNS)
    count = 0
    for i, raw in enumerate(df.to_dict(orient="records")):
        project_id = project_id_by_external.get(normalize_text(raw.get("external_project_id")))
        if not project_id:
            continue
        ptype = (normalize_text(raw.get("payment_type")) or "MILESTONE").upper()
        pstatus = (normalize_text(raw.get("payment_status")) or "CLEARED").upper()
        db.add(Payment(
            project_id=project_id,
            amount=parse_float(raw.get("amount")) or 0.0,
            payment_date=parse_date(raw.get("payment_date")),
            payment_type=PaymentType[ptype] if ptype in PaymentType.__members__ else PaymentType.MILESTONE,
            payment_status=PaymentStatus[pstatus] if pstatus in PaymentStatus.__members__ else PaymentStatus.CLEARED,
            recipient=normalize_text(raw.get("recipient")),
            transaction_reference=normalize_text(raw.get("transaction_reference")),
        ))
        count += 1
        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
    db.commit()
    return count


def ingest_milestones(db: Session, csv_path: Path, project_id_by_external: dict[str, uuid.UUID]) -> int:
    if not csv_path.exists():
        return 0
    df = map_columns(_read_csv(csv_path), MILESTONE_COLUMNS)
    count = 0
    for i, raw in enumerate(df.to_dict(orient="records")):
        project_id = project_id_by_external.get(normalize_text(raw.get("external_project_id")))
        if not project_id:
            continue
        status = (normalize_text(raw.get("status")) or "PENDING").upper().replace(" ", "_")
        db.add(Milestone(
            project_id=project_id,
            name=normalize_text(raw.get("name")) or "Milestone",
            expected_date=parse_date(raw.get("expected_date")),
            actual_date=parse_date(raw.get("actual_date")),
            expected_progress=parse_float(raw.get("expected_progress")) or 0.0,
            actual_progress=parse_float(raw.get("actual_progress")),
            status=MilestoneStatus[status] if status in MilestoneStatus.__members__ else MilestoneStatus.PENDING,
        ))
        count += 1
        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
    db.commit()
    return count


def ingest_inspections(db: Session, csv_path: Path, project_id_by_external: dict[str, uuid.UUID]) -> int:
    if not csv_path.exists():
        return 0
    df = map_columns(_read_csv(csv_path), INSPECTION_COLUMNS)
    count = 0
    for i, raw in enumerate(df.to_dict(orient="records")):
        project_id = project_id_by_external.get(normalize_text(raw.get("external_project_id")))
        if not project_id:
            continue
        db.add(Inspection(
            project_id=project_id,
            inspection_date=parse_date(raw.get("inspection_date")),
            inspector=normalize_text(raw.get("inspector")),
            reported_progress=parse_float(raw.get("reported_progress")) or 0.0,
            remarks=normalize_text(raw.get("remarks")),
            location=normalize_text(raw.get("location")),
        ))
        count += 1
        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
    db.commit()
    return count


def ingest_evidence(db: Session, csv_path: Path, project_id_by_external: dict[str, uuid.UUID]) -> int:
    if not csv_path.exists():
        return 0
    df = map_columns(_read_csv(csv_path), EVIDENCE_COLUMNS)
    count = 0
    for i, raw in enumerate(df.to_dict(orient="records")):
        project_id = project_id_by_external.get(normalize_text(raw.get("external_project_id")))
        if not project_id:
            continue
        etype = (normalize_text(raw.get("type")) or "PHOTO").upper()
        captured_date = parse_date(raw.get("captured_at"))
        db.add(Evidence(
            project_id=project_id,
            type=EvidenceType[etype] if etype in EvidenceType.__members__ else EvidenceType.PHOTO,
            file_reference=normalize_text(raw.get("file_reference")),
            description=normalize_text(raw.get("description")),
            captured_at=datetime.combine(captured_date, datetime.min.time()) if captured_date else None,
            source=normalize_text(raw.get("source")),
            hash=normalize_text(raw.get("hash")),
        ))
        count += 1
        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
    db.commit()
    return count


def compute_duplicate_candidates(db: Session) -> int:
    """Coarse pre-filter: same state/district/type, cost within tolerance, dates
    close together. A cheap heuristic for the data-quality report — real
    identity resolution (multilingual embeddings, transliteration, confidence
    scoring into EntityMatch) is Phase 3."""
    rows = db.query(
        Project.id, Project.state, Project.district, Project.project_type,
        Project.sanctioned_amount, Project.start_date,
    ).all()

    groups: dict[tuple, list] = {}
    for row in rows:
        key = (row.state, row.district, row.project_type)
        groups.setdefault(key, []).append(row)

    flagged: set = set()
    for group in groups.values():
        if len(group) < 2:
            continue
        for a, b in itertools.combinations(group, 2):
            if a.sanctioned_amount == 0:
                continue
            amount_diff = abs(float(a.sanctioned_amount) - float(b.sanctioned_amount)) / float(a.sanctioned_amount)
            date_diff = abs((a.start_date - b.start_date).days) if a.start_date and b.start_date else 9999
            if amount_diff <= DUPLICATE_AMOUNT_TOLERANCE and date_diff <= DUPLICATE_DATE_WINDOW_DAYS:
                flagged.add(a.id)
                flagged.add(b.id)

    return len(flagged)


def run_full_ingestion(db: Session, data_dir: Path) -> IngestionReport:
    raw_dir = data_dir / "raw"

    contractor_cache = ingest_contractors(db, raw_dir / "contractors.csv")
    agency_cache = ingest_agencies(db, raw_dir / "agencies.csv")
    project_id_by_external, project_report = ingest_projects(
        db, raw_dir / "projects.csv", contractor_cache, agency_cache
    )
    ingest_payments(db, raw_dir / "payments.csv", project_id_by_external)
    ingest_milestones(db, raw_dir / "milestones.csv", project_id_by_external)
    ingest_inspections(db, raw_dir / "inspections.csv", project_id_by_external)
    ingest_evidence(db, raw_dir / "evidence.csv", project_id_by_external)

    duplicate_candidates = compute_duplicate_candidates(db)

    report = IngestionReport(
        source_filename="projects.csv",
        records_received=project_report["records_received"],
        valid=project_report["valid"],
        invalid=project_report["invalid"],
        missing_location=project_report["missing_location"],
        missing_contractor=project_report["missing_contractor"],
        missing_amount=project_report["missing_amount"],
        duplicate_candidates=duplicate_candidates,
        entity_matches=0,  # populated once Phase 3 entity resolution runs
        uncertain_matches=0,
        language_distribution=project_report["language_distribution"],
        validation_errors=project_report["validation_errors"],
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
