from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2 import Geography
from sqlalchemy import cast, func, or_
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.scope import in_scope, scope_filter
from app.models.evidence import Evidence
from app.models.inspection import Inspection
from app.models.milestone import Milestone
from app.models.payment import Payment
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.models.user import User
from app.schemas.project import (
    EvidenceOut,
    InspectionOut,
    MilestoneOut,
    NearbyProjectItem,
    NearbyProjectsOut,
    PaymentOut,
    ProjectDetailOut,
    ProjectListItem,
    ProjectListOut,
    ProjectTimelineOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=ProjectListOut)
def list_projects(
    state: str | None = None,
    district: str | None = None,
    project_type: str | None = None,
    status: str | None = None,
    risk_band: str | None = None,
    min_risk_score: float | None = None,
    search: str | None = Query(default=None, description="Matches project name or external ID"),
    sort_by: str = Query(default="risk_score", pattern="^(risk_score|sanctioned_amount|start_date)$"),
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ProjectListOut:
    query = db.query(Project)
    if user:
        query = scope_filter(query, user)

    if state:
        query = query.filter(Project.state == state)
    if district:
        query = query.filter(Project.district == district)
    if project_type:
        query = query.filter(Project.project_type == project_type.upper())
    if status:
        query = query.filter(Project.status == status.upper())
    if risk_band:
        query = query.filter(Project.risk_band == risk_band.upper())
    if min_risk_score is not None:
        query = query.filter(Project.risk_score >= min_risk_score)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Project.project_name.ilike(like), Project.external_project_id.ilike(like)))

    total = query.count()

    sort_column = {
        "risk_score": Project.risk_score,
        "sanctioned_amount": Project.sanctioned_amount,
        "start_date": Project.start_date,
    }[sort_by]
    projects = query.order_by(sort_column.desc().nulls_last()).offset(offset).limit(limit).all()

    items = [
        ProjectListItem(
            id=p.id,
            external_project_id=p.external_project_id,
            project_name=p.project_name,
            project_type=p.project_type.value,
            state=p.state,
            district=p.district,
            status=p.status.value,
            sanctioned_amount=float(p.sanctioned_amount),
            physical_progress=p.physical_progress,
            financial_progress=p.financial_progress,
            contractor_name=p.contractor.name if p.contractor else None,
            risk_score=p.risk_score,
            risk_band=p.risk_band.value if p.risk_band else None,
        )
        for p in projects
    ]
    return ProjectListOut(total=total, limit=limit, offset=offset, items=items)


@router.get("/nearby", response_model=NearbyProjectsOut)
def nearby_projects(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> NearbyProjectsOut:
    """Nearest monitored projects to a citizen's device location — powers
    the public portal's "use my location" area recommendation and the
    complaint entry point's nearby-project picker. Ordered via the geom
    column's <-> KNN operator so it hits the existing GiST index rather than
    scanning every project's distance."""
    point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)
    distance_m = func.ST_Distance(cast(Project.geom, Geography), cast(point, Geography))

    query = db.query(Project, distance_m.label("distance_m")).filter(Project.geom.isnot(None))
    if user:
        query = scope_filter(query, user)
    # Order by the KNN "<->" operator (not the exact geography distance) so
    # this hits the geom column's GiST index instead of scanning every row.
    rows = query.order_by(Project.geom.op("<->")(point)).limit(limit).all()

    projects = [
        NearbyProjectItem(
            id=p.id,
            external_project_id=p.external_project_id,
            project_name=p.project_name,
            project_type=p.project_type.value,
            state=p.state,
            district=p.district,
            constituency=p.constituency,
            status=p.status.value,
            sanctioned_amount=float(p.sanctioned_amount),
            physical_progress=p.physical_progress,
            distance_km=round(float(dist_m) / 1000, 2),
        )
        for p, dist_m in rows
    ]

    nearest = projects[0] if projects else None
    return NearbyProjectsOut(
        recommended_state=nearest.state if nearest else None,
        recommended_district=nearest.district if nearest else None,
        nearest_distance_km=nearest.distance_km if nearest else None,
        projects=projects,
    )


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ProjectDetailOut:
    project = db.get(Project, project_id)
    if not project or (user and not in_scope(project, user)):
        raise HTTPException(status_code=404, detail="Project not found")

    signal_count = db.query(func.count(RiskSignal.id)).filter(RiskSignal.project_id == project.id).scalar() or 0

    return ProjectDetailOut(
        id=project.id,
        external_project_id=project.external_project_id,
        project_name=project.project_name,
        description=project.description,
        language=project.language,
        project_type=project.project_type.value,
        state=project.state,
        district=project.district,
        constituency=project.constituency,
        mp_name=project.mp_name,
        data_source=project.data_source.value,
        latitude=project.latitude,
        longitude=project.longitude,
        sanctioned_amount=float(project.sanctioned_amount),
        estimated_cost=float(project.estimated_cost),
        released_amount=float(project.released_amount),
        expenditure_amount=float(project.expenditure_amount),
        start_date=project.start_date,
        expected_completion_date=project.expected_completion_date,
        actual_completion_date=project.actual_completion_date,
        physical_progress=project.physical_progress,
        financial_progress=project.financial_progress,
        status=project.status.value,
        contractor_id=project.contractor_id,
        contractor_name=project.contractor.name if project.contractor else None,
        implementing_agency_id=project.implementing_agency_id,
        implementing_agency_name=project.implementing_agency.name if project.implementing_agency else None,
        risk_score=project.risk_score,
        risk_band=project.risk_band.value if project.risk_band else None,
        signal_count=signal_count,
    )


@router.get("/{project_id}/timeline", response_model=ProjectTimelineOut)
def get_project_timeline(
    project_id: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ProjectTimelineOut:
    project = db.get(Project, project_id)
    if not project or (user and not in_scope(project, user)):
        raise HTTPException(status_code=404, detail="Project not found")

    payments = db.query(Payment).filter(Payment.project_id == project_id).order_by(Payment.payment_date).all()
    milestones = db.query(Milestone).filter(Milestone.project_id == project_id).order_by(Milestone.expected_date).all()
    inspections = (
        db.query(Inspection).filter(Inspection.project_id == project_id).order_by(Inspection.inspection_date).all()
    )
    evidence = db.query(Evidence).filter(Evidence.project_id == project_id).order_by(Evidence.captured_at).all()

    return ProjectTimelineOut(
        payments=[
            PaymentOut(
                id=p.id, amount=float(p.amount), payment_date=p.payment_date, payment_type=p.payment_type.value,
                payment_status=p.payment_status.value, recipient=p.recipient,
            )
            for p in payments
        ],
        milestones=[
            MilestoneOut(
                id=m.id, name=m.name, expected_date=m.expected_date, actual_date=m.actual_date,
                expected_progress=m.expected_progress, actual_progress=m.actual_progress, status=m.status.value,
            )
            for m in milestones
        ],
        inspections=[
            InspectionOut(
                id=i.id, inspection_date=i.inspection_date, inspector=i.inspector,
                reported_progress=i.reported_progress, remarks=i.remarks,
            )
            for i in inspections
        ],
        evidence=[
            EvidenceOut(
                id=e.id, type=e.type.value, file_reference=e.file_reference, description=e.description,
                captured_at=e.captured_at, source=e.source,
            )
            for e in evidence
        ],
    )
