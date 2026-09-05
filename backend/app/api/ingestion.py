import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.ingestion.normalizers import normalize_name_key
from app.ingestion.pipeline import compute_duplicate_candidates, ingest_projects
from app.models.agency import Agency
from app.models.contractor import Contractor
from app.models.enums import UserRole
from app.models.ingestion_report import IngestionReport
from app.models.user import User
from app.schemas.ingestion import IngestionReportOut

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.post("/upload", response_model=IngestionReportOut)
async def upload_projects_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> IngestionReport:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv uploads are supported.")

    contractor_cache = {c.normalized_name: c for c in db.query(Contractor).all()}
    agency_cache = {normalize_name_key(a.name): a for a in db.query(Agency).all()}

    fd, tmp_name = tempfile.mkstemp(suffix=".csv")
    tmp_path = Path(tmp_name)
    os.close(fd)
    tmp_path.write_bytes(await file.read())

    try:
        _, project_report = ingest_projects(db, tmp_path, contractor_cache, agency_cache)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    duplicate_candidates = compute_duplicate_candidates(db)

    report = IngestionReport(
        source_filename=file.filename,
        records_received=project_report["records_received"],
        valid=project_report["valid"],
        invalid=project_report["invalid"],
        missing_location=project_report["missing_location"],
        missing_contractor=project_report["missing_contractor"],
        missing_amount=project_report["missing_amount"],
        duplicate_candidates=duplicate_candidates,
        entity_matches=0,
        uncertain_matches=0,
        language_distribution=project_report["language_distribution"],
        validation_errors=project_report["validation_errors"],
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    log_audit_event(db, user.id, "UPLOAD_CSV", "IngestionReport", report.id, {"filename": file.filename})
    return report
