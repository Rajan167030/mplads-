from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.models.enums import (
    InvestigationResolution,
    InvestigationStatus,
    Severity,
    UserRole,
)
from app.models.investigation import Investigation
from app.models.project import Project
from app.models.user import User
from app.schemas.investigation import InvestigationCreate, InvestigationOut, InvestigationUpdate

router = APIRouter(prefix="/investigations", tags=["investigations"])


def _out(inv: Investigation) -> InvestigationOut:
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
) -> list[InvestigationOut]:
    query = db.query(Investigation)
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
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.OFFICER)),
) -> InvestigationOut:
    project = db.get(Project, payload.project_id)
    if not project:
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
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.OFFICER)),
) -> InvestigationOut:
    investigation = db.get(Investigation, investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

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
