from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.scope import in_scope
from app.graph.relationships import (
    find_nearby_projects,
    find_related_projects,
    get_contractor_network,
    get_top_risk_contractor_network,
)
from app.models.contractor import Contractor
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User
from app.schemas.graph import (
    ContractorNetworkEntryOut,
    ContractorRef,
    GraphEdge,
    GraphNode,
    NearbyProjectOut,
    OverviewGraphOut,
    ProjectRef,
    RelatedProjectOut,
)

router = APIRouter(prefix="/graph", tags=["graph"])


def _project_ref(p: Project) -> ProjectRef:
    return ProjectRef(
        id=p.id,
        external_project_id=p.external_project_id,
        project_name=p.project_name,
        state=p.state,
        district=p.district,
        project_type=p.project_type.value,
        status=p.status.value,
        risk_score=p.risk_score,
        risk_band=p.risk_band.value if p.risk_band else None,
    )


@router.get("/projects/{project_id}/related", response_model=list[RelatedProjectOut])
def related_projects(
    project_id: str,
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or not in_scope(project, user):
        raise HTTPException(status_code=404, detail="Project not found")

    results = find_related_projects(db, project, limit=limit)
    return [
        RelatedProjectOut(
            project=_project_ref(r.project),
            relationship_types=r.relationship_types,
            distance_km=r.distance_km,
        )
        for r in results
    ]


@router.get("/projects/{project_id}/nearby", response_model=list[NearbyProjectOut])
def nearby_projects(
    project_id: str,
    radius_km: float = Query(default=5.0, le=100.0),
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project or not in_scope(project, user):
        raise HTTPException(status_code=404, detail="Project not found")

    results = find_nearby_projects(db, project, radius_km=radius_km, limit=limit)
    return [NearbyProjectOut(project=_project_ref(p), distance_km=d) for p, d in results]


@router.get("/overview", response_model=OverviewGraphOut)
def overview_graph(
    limit: int = Query(default=15, le=40),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STATE_NODAL, UserRole.MINISTRY)),
) -> OverviewGraphOut:
    contractors, edges = get_top_risk_contractor_network(db, limit=limit)
    nodes = [
        GraphNode(
            id=c.id,
            label=c.name,
            risk_score=c.risk_score,
            total_projects=c.total_projects,
            high_risk_projects=c.high_risk_projects,
        )
        for c in contractors
    ]
    edge_out = [
        GraphEdge(source=a, target=b, weight=weight, contexts=[list(ctx) for ctx in contexts])
        for a, b, weight, contexts in edges
    ]
    return OverviewGraphOut(nodes=nodes, edges=edge_out)


@router.get("/contractors/{contractor_id}/network", response_model=list[ContractorNetworkEntryOut])
def contractor_network(
    contractor_id: str,
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.STATE_NODAL, UserRole.MINISTRY)),
):
    contractor = db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")

    results = get_contractor_network(db, contractor, limit=limit)
    return [
        ContractorNetworkEntryOut(
            contractor=ContractorRef(
                id=e.contractor.id,
                name=e.contractor.name,
                total_projects=e.contractor.total_projects,
                delayed_projects=e.contractor.delayed_projects,
                high_risk_projects=e.contractor.high_risk_projects,
                risk_score=e.contractor.risk_score,
            ),
            shared_context_count=e.shared_context_count,
            contexts=[list(c) for c in e.contexts],
        )
        for e in results
    ]
