from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.scope import scope_filter
from app.models.project import Project
from app.models.user import User
from app.schemas.map import GeoJSONPointGeometry, ProjectFeature, ProjectFeatureCollection, ProjectFeatureProperties

router = APIRouter(prefix="/map", tags=["map"])


@router.get("/filters", response_model=dict)
def map_filter_options(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> dict:
    states_query = db.query(Project.state).filter(Project.latitude.isnot(None)).distinct()
    types_query = db.query(Project.project_type).distinct()
    if user:
        states_query = scope_filter(states_query, user)
        types_query = scope_filter(types_query, user)
    states = [s for (s,) in states_query.order_by(Project.state).all()]
    project_types = [t.value for (t,) in types_query.all()]
    return {"states": states, "project_types": sorted(project_types)}


@router.get("/risk", response_model=ProjectFeatureCollection)
def risk_map(
    risk_band: str | None = Query(default=None, description="Filter by LOW/MEDIUM/HIGH/CRITICAL"),
    state: str | None = None,
    project_type: str | None = None,
    limit: int = Query(default=5000, le=10000),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> ProjectFeatureCollection:
    query = db.query(Project).filter(Project.latitude.isnot(None), Project.longitude.isnot(None))
    if user:
        query = scope_filter(query, user)
    if risk_band:
        query = query.filter(Project.risk_band == risk_band.upper())
    if state:
        query = query.filter(Project.state == state)
    if project_type:
        query = query.filter(Project.project_type == project_type.upper())

    projects = query.order_by(Project.risk_score.desc().nulls_last()).limit(limit).all()

    features = [
        ProjectFeature(
            geometry=GeoJSONPointGeometry(coordinates=(p.longitude, p.latitude)),
            properties=ProjectFeatureProperties(
                id=str(p.id),
                external_project_id=p.external_project_id,
                project_name=p.project_name,
                project_type=p.project_type.value,
                state=p.state,
                district=p.district,
                status=p.status.value,
                risk_score=p.risk_score,
                risk_band=p.risk_band.value if p.risk_band else None,
            ),
        )
        for p in projects
    ]
    return ProjectFeatureCollection(features=features)
