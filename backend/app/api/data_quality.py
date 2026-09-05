from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.entity_match import EntityMatch
from app.models.ingestion_report import IngestionReport
from app.models.payment import Payment
from app.models.project import Project
from app.schemas.data_quality import DataQualityOut

router = APIRouter(tags=["data-quality"])


@router.get("/data-quality", response_model=DataQualityOut)
def get_data_quality(db: Session = Depends(get_db)) -> DataQualityOut:
    latest_report = db.query(IngestionReport).order_by(IngestionReport.created_at.desc()).first()

    total_projects = db.scalar(select(func.count(Project.id))) or 0
    missing_contractor_link = db.scalar(select(func.count(Project.id)).where(Project.contractor_id.is_(None))) or 0

    projects_with_payments = db.scalar(select(func.count(func.distinct(Payment.project_id)))) or 0
    projects_without_payments = max(total_projects - projects_with_payments, 0)

    avg_confidence = db.scalar(select(func.avg(EntityMatch.match_confidence)))
    entity_match_count = db.scalar(select(func.count(EntityMatch.id))) or 0
    uncertain_match_count = db.scalar(
        select(func.count(EntityMatch.id)).where(EntityMatch.verdict == "POSSIBLE_MATCH")
    ) or 0

    return DataQualityOut(
        latest_ingestion_report_id=latest_report.id if latest_report else None,
        latest_ingestion_at=latest_report.created_at if latest_report else None,
        total_projects=total_projects,
        records_processed=latest_report.records_received if latest_report else 0,
        invalid_records=latest_report.invalid if latest_report else 0,
        missing_location=latest_report.missing_location if latest_report else 0,
        missing_contractor_text=latest_report.missing_contractor if latest_report else 0,
        missing_contractor_link=missing_contractor_link,
        missing_amount=latest_report.missing_amount if latest_report else 0,
        projects_without_payments=projects_without_payments,
        duplicate_candidates=latest_report.duplicate_candidates if latest_report else 0,
        entity_matches=entity_match_count,
        uncertain_matches=uncertain_match_count,
        average_entity_match_confidence=float(avg_confidence) if avg_confidence is not None else None,
        language_distribution=latest_report.language_distribution if latest_report else {},
    )
