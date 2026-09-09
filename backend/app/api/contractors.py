from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.scope import scope_filter
from app.models.contractor import Contractor
from app.models.project import Project
from app.models.user import User
from app.schemas.contractor import (
    ContractorDetailOut,
    ContractorListItem,
    ContractorListOut,
    ContractorProjectItem,
)

router = APIRouter(prefix="/contractors", tags=["contractors"])


def _list_item(c: Contractor) -> ContractorListItem:
    return ContractorListItem(
        id=c.id,
        name=c.name,
        state=c.state,
        district=c.district,
        total_projects=c.total_projects,
        completed_projects=c.completed_projects,
        delayed_projects=c.delayed_projects,
        high_risk_projects=c.high_risk_projects,
        average_cost_overrun=c.average_cost_overrun,
        average_delay_days=c.average_delay_days,
        risk_score=c.risk_score,
    )


@router.get("", response_model=ContractorListOut)
def list_contractors(
    min_total_projects: int = Query(default=1, ge=0),
    sort_by: str = Query(default="risk_score", pattern="^(risk_score|total_projects|delayed_projects)$"),
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContractorListOut:
    query = db.query(Contractor).filter(Contractor.total_projects >= min_total_projects)
    scoped_ids = scope_filter(db.query(Project.contractor_id), user).filter(Project.contractor_id.isnot(None)).distinct()
    query = query.filter(Contractor.id.in_(scoped_ids))
    total = query.count()

    sort_column = {
        "risk_score": Contractor.risk_score,
        "total_projects": Contractor.total_projects,
        "delayed_projects": Contractor.delayed_projects,
    }[sort_by]
    contractors = query.order_by(sort_column.desc().nulls_last()).offset(offset).limit(limit).all()

    return ContractorListOut(total=total, limit=limit, offset=offset, items=[_list_item(c) for c in contractors])


@router.get("/{contractor_id}", response_model=ContractorDetailOut)
def get_contractor(
    contractor_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ContractorDetailOut:
    contractor = db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    projects = (
        scope_filter(db.query(Project), user)
        .filter(Project.contractor_id == contractor_id)
        .order_by(Project.risk_score.desc().nulls_last())
        .all()
    )
    if not projects:
        raise HTTPException(status_code=404, detail="Contractor not found")

    return ContractorDetailOut(
        contractor=_list_item(contractor),
        projects=[
            ContractorProjectItem(
                id=p.id,
                external_project_id=p.external_project_id,
                project_name=p.project_name,
                state=p.state,
                district=p.district,
                status=p.status.value,
                sanctioned_amount=float(p.sanctioned_amount),
                risk_score=p.risk_score,
                risk_band=p.risk_band.value if p.risk_band else None,
            )
            for p in projects
        ],
    )
