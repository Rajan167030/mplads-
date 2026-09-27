from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.scope import in_scope, scope_filter
from app.models.audit_log import AuditLog
from app.models.enums import (
    EscalationLevel,
    InvestigationResolution,
    InvestigationStatus,
    ReviewVerdict,
    Severity,
    UserRole,
)
from app.models.investigation import Investigation
from app.models.project import Project
from app.models.review import InvestigationReview
from app.models.user import User
from app.schemas.investigation import InvestigationCreate, InvestigationOut, InvestigationUpdate
from app.schemas.review import ReviewCreate, ReviewOut

router = APIRouter(prefix="/investigations", tags=["investigations"])

ESCALATION_OVERDUE_AFTER = timedelta(days=30)
_NEXT_LEVEL = {EscalationLevel.DISTRICT: EscalationLevel.STATE, EscalationLevel.STATE: EscalationLevel.MINISTRY}
_ESCALATOR_LEVEL = {UserRole.DISTRICT_AUTHORITY: EscalationLevel.DISTRICT, UserRole.STATE_NODAL: EscalationLevel.STATE}
_VERIFIER_LEVEL = {UserRole.DISTRICT_AUTHORITY: EscalationLevel.DISTRICT, UserRole.STATE_NODAL: EscalationLevel.STATE}


def _out(inv: Investigation) -> InvestigationOut:
    overdue = (
        inv.status == InvestigationStatus.OPEN
        and inv.current_level == EscalationLevel.DISTRICT
        and datetime.now(timezone.utc) - inv.created_at > ESCALATION_OVERDUE_AFTER
    )
    review_count = len(inv.reviews) if "reviews" in inv.__dict__ else 0
    return InvestigationOut(
        id=inv.id,
        project_id=inv.project_id,
        project_name=inv.project.project_name,
        project_external_id=inv.project.external_project_id,
        priority=inv.priority.value,
        status=inv.status.value,
        assigned_to=inv.assigned_to,
        assigned_to_name=inv.assignee.full_name if inv.assignee else None,
        notes=inv.notes,
        resolution=inv.resolution.value if inv.resolution else None,
        current_level=inv.current_level.value,
        overdue_for_escalation=overdue,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


@router.get("", response_model=list[InvestigationOut])
def list_investigations(
    status: str | None = None,
    project_id: str | None = None,
    assigned_to: str | None = None,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[InvestigationOut]:
    query = scope_filter(db.query(Investigation).join(Project, Project.id == Investigation.project_id), user)
    if status:
        query = query.filter(Investigation.status == status.upper())
    if project_id:
        query = query.filter(Investigation.project_id == project_id)
    if assigned_to:
        query = query.filter(Investigation.assigned_to == assigned_to)

    investigations = query.order_by(Investigation.created_at.desc()).offset(offset).limit(limit).all()
    return [_out(i) for i in investigations]


@router.post("", response_model=InvestigationOut)
def create_investigation(
    payload: InvestigationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DISTRICT_AUTHORITY, UserRole.STATE_NODAL, UserRole.MINISTRY)),
) -> InvestigationOut:
    project = db.get(Project, payload.project_id)
    if not project or not in_scope(project, user):
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.priority.upper() not in Severity.__members__:
        raise HTTPException(status_code=422, detail=f"Invalid priority: {payload.priority!r}")

    investigation = Investigation(
        project_id=payload.project_id,
        priority=Severity[payload.priority.upper()],
        assigned_to=payload.assigned_to,
        notes=payload.notes,
    )
    db.add(investigation)
    db.commit()
    db.refresh(investigation)

    log_audit_event(db, user.id, "CREATE_INVESTIGATION", "Investigation", investigation.id, {"project_id": str(payload.project_id)})
    return _out(investigation)


@router.patch("/{investigation_id}", response_model=InvestigationOut)
def update_investigation(
    investigation_id: str,
    payload: InvestigationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DISTRICT_AUTHORITY, UserRole.STATE_NODAL, UserRole.MINISTRY)),
) -> InvestigationOut:
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    # Ministry has override/final authority regardless of level or jurisdiction.
    # District Authority / State Nodal can only act while the case sits at
    # their own tier, and only within their own scope.
    if user.role != UserRole.MINISTRY:
        required_level = _VERIFIER_LEVEL[user.role]
        if investigation.current_level != required_level or not in_scope(investigation.project, user):
            raise HTTPException(status_code=403, detail="This case isn't at your level or outside your jurisdiction")

    if payload.status is not None:
        if payload.status.upper() not in InvestigationStatus.__members__:
            raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status!r}")
        investigation.status = InvestigationStatus[payload.status.upper()]
    if payload.priority is not None:
        if payload.priority.upper() not in Severity.__members__:
            raise HTTPException(status_code=422, detail=f"Invalid priority: {payload.priority!r}")
        investigation.priority = Severity[payload.priority.upper()]
    if payload.assigned_to is not None:
        investigation.assigned_to = payload.assigned_to
    if payload.notes is not None:
        investigation.notes = payload.notes
    if payload.resolution is not None:
        if payload.resolution.upper() not in InvestigationResolution.__members__:
            raise HTTPException(status_code=422, detail=f"Invalid resolution: {payload.resolution!r}")
        investigation.resolution = InvestigationResolution[payload.resolution.upper()]

    db.commit()
    db.refresh(investigation)

    log_audit_event(db, user.id, "UPDATE_INVESTIGATION", "Investigation", investigation.id, payload.model_dump(exclude_none=True))
    return _out(investigation)


@router.post("/{investigation_id}/escalate", response_model=InvestigationOut)
def escalate_investigation(
    investigation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DISTRICT_AUTHORITY, UserRole.STATE_NODAL)),
) -> InvestigationOut:
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    required_level = _ESCALATOR_LEVEL[user.role]
    if investigation.current_level != required_level or not in_scope(investigation.project, user):
        raise HTTPException(status_code=403, detail="This case isn't at your level or outside your jurisdiction")

    investigation.current_level = _NEXT_LEVEL[investigation.current_level]
    investigation.escalated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(investigation)

    log_audit_event(
        db, user.id, "ESCALATE_INVESTIGATION", "Investigation", investigation.id,
        {"new_level": investigation.current_level.value},
    )
    return _out(investigation)


@router.get("/{investigation_id}/audit-log")
def get_investigation_audit_log(
    investigation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """Returns the full chronological audit trail for a specific investigation case."""
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .filter(
            AuditLog.entity_type == "Investigation",
            AuditLog.entity_id == uuid.UUID(investigation_id),
        )
        .order_by(AuditLog.timestamp.asc())
        .limit(200)
        .all()
    )

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "timestamp": log.timestamp.isoformat(),
            "user_name": log.user.full_name if hasattr(log, "user") and log.user else "System",
            "user_role": log.user.role.value if hasattr(log, "user") and log.user else None,
            "metadata": log.action_metadata or {},
        }
        for log in logs
    ]


# ─── Single Investigation Detail (Investigation Center) ──────────────────────

@router.get("/{investigation_id}", response_model=InvestigationOut)
def get_investigation(
    investigation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InvestigationOut:
    """Fetch a single investigation with full detail for the Investigation Center."""
    investigation = (
        db.query(Investigation)
        .options(joinedload(Investigation.project), joinedload(Investigation.assignee), joinedload(Investigation.reviews))
        .filter(Investigation.id == investigation_id)
        .first()
    )
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return _out(investigation)


# ─── Reviews CRUD ─────────────────────────────────────────────────────────────

def _review_out(r: InvestigationReview) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        investigation_id=r.investigation_id,
        reviewer_id=r.reviewer_id,
        reviewer_name=r.reviewer.full_name if r.reviewer else "Unknown",
        reviewer_role=r.reviewer.role.value if r.reviewer else "UNKNOWN",
        verdict=r.verdict.value,
        findings=r.findings,
        recommendation=r.recommendation,
        evidence_references=r.evidence_references,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.get("/{investigation_id}/reviews", response_model=list[ReviewOut])
def list_reviews(
    investigation_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReviewOut]:
    """List all reviews for an investigation, most recent first."""
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    reviews = (
        db.query(InvestigationReview)
        .options(joinedload(InvestigationReview.reviewer))
        .filter(InvestigationReview.investigation_id == investigation_id)
        .order_by(InvestigationReview.created_at.desc())
        .limit(100)
        .all()
    )
    return [_review_out(r) for r in reviews]


@router.post("/{investigation_id}/reviews", response_model=ReviewOut)
def create_review(
    investigation_id: str,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DISTRICT_AUTHORITY, UserRole.STATE_NODAL, UserRole.MINISTRY)),
) -> ReviewOut:
    """Add a review finding to an investigation."""
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    if payload.verdict.upper() not in ReviewVerdict.__members__:
        raise HTTPException(status_code=422, detail=f"Invalid verdict: {payload.verdict!r}")

    review = InvestigationReview(
        investigation_id=uuid.UUID(investigation_id),
        reviewer_id=user.id,
        verdict=ReviewVerdict[payload.verdict.upper()],
        findings=payload.findings,
        recommendation=payload.recommendation,
        evidence_references=payload.evidence_references,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    log_audit_event(
        db, user.id, "ADD_REVIEW", "Investigation", investigation.id,
        {"review_id": str(review.id), "verdict": payload.verdict.upper()},
    )
    return _review_out(review)
