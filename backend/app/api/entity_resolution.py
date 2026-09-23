import math
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.entity_match import EntityMatch
from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User
from app.nlp.entity_resolution import run_entity_resolution
from app.schemas.entity_match import (
    EntityMatchEnrichedOut,
    EntityMatchOut,
    EntityResolutionRunOut,
    MatchDifferenceMetrics,
    ProjectSummaryForMatch,
)

router = APIRouter(prefix="/entity-resolution", tags=["entity-resolution"])


def _haversine_km(lat1: float | None, lon1: float | None, lat2: float | None, lon2: float | None) -> float | None:
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 3)


def _to_project_summary(p: Project) -> ProjectSummaryForMatch:
    return ProjectSummaryForMatch(
        id=p.id,
        external_project_id=p.external_project_id,
        project_name=p.project_name,
        description=p.description,
        project_type=p.project_type.value if hasattr(p.project_type, "value") else str(p.project_type),
        state=p.state,
        district=p.district,
        constituency=p.constituency,
        mp_name=p.mp_name,
        sanctioned_amount=float(p.sanctioned_amount or 0),
        released_amount=float(p.released_amount or 0),
        expenditure_amount=float(p.expenditure_amount or 0),
        start_date=p.start_date,
        expected_completion_date=p.expected_completion_date,
        actual_completion_date=p.actual_completion_date,
        physical_progress=float(p.physical_progress or 0),
        financial_progress=float(p.financial_progress or 0),
        status=p.status.value if hasattr(p.status, "value") else str(p.status),
        contractor_name=p.contractor.name if p.contractor else None,
        latitude=p.latitude,
        longitude=p.longitude,
        risk_score=p.risk_score,
        risk_band=p.risk_band.value if p.risk_band and hasattr(p.risk_band, "value") else (str(p.risk_band) if p.risk_band else None),
    )


def _enrich_match(match: EntityMatch, projects_by_id: dict[uuid.UUID, Project]) -> EntityMatchEnrichedOut | None:
    p_src = projects_by_id.get(match.source_project_id)
    p_dst = projects_by_id.get(match.matched_project_id)
    if not p_src or not p_dst:
        return None

    src_amount = float(p_src.sanctioned_amount or 0)
    dst_amount = float(p_dst.sanctioned_amount or 0)
    amount_diff = abs(src_amount - dst_amount)
    amount_pct = (amount_diff / max(src_amount, dst_amount) * 100) if max(src_amount, dst_amount) > 0 else 0.0

    days_diff = abs((p_src.start_date - p_dst.start_date).days) if p_src.start_date and p_dst.start_date else 0
    same_contractor = bool(p_src.contractor_id and p_dst.contractor_id and p_src.contractor_id == p_dst.contractor_id)
    same_mp = bool(p_src.mp_name and p_dst.mp_name and p_src.mp_name.strip().lower() == p_dst.mp_name.strip().lower())
    dist_km = _haversine_km(p_src.latitude, p_src.longitude, p_dst.latitude, p_dst.longitude)

    return EntityMatchEnrichedOut(
        id=match.id,
        source_project_id=match.source_project_id,
        matched_project_id=match.matched_project_id,
        match_confidence=match.match_confidence,
        verdict=match.verdict,
        matching_features=match.matching_features,
        created_at=match.created_at,
        source_project=_to_project_summary(p_src),
        matched_project=_to_project_summary(p_dst),
        diff_metrics=MatchDifferenceMetrics(
            amount_diff_inr=round(amount_diff, 2),
            amount_diff_pct=round(amount_pct, 2),
            days_between_sanction=days_diff,
            same_contractor=same_contractor,
            same_mp=same_mp,
            distance_km=dist_km,
        ),
    )


@router.post("/run", response_model=EntityResolutionRunOut)
def trigger_entity_resolution(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MINISTRY)),
) -> EntityResolutionRunOut:
    report = run_entity_resolution(db)
    log_audit_event(db, user.id, "RUN_ENTITY_RESOLUTION", "EntityMatch", metadata={"matches": report.matches})
    return EntityResolutionRunOut(
        embeddings_computed=report.embeddings_computed,
        projects_considered=report.projects_considered,
        pairs_evaluated=report.pairs_evaluated,
        matches=report.matches,
        possible_matches=report.possible_matches,
    )


@router.get("/matches", response_model=list[EntityMatchOut])
def list_entity_matches(
    verdict: str | None = Query(default=None, description="Filter by MATCH or POSSIBLE_MATCH"),
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EntityMatch]:
    query = db.query(EntityMatch)
    if verdict:
        query = query.filter(EntityMatch.verdict == verdict.upper())
    return query.order_by(EntityMatch.match_confidence.desc()).offset(offset).limit(limit).all()


@router.get("/matches/enriched", response_model=list[EntityMatchEnrichedOut])
def list_enriched_entity_matches(
    verdict: str | None = Query(default=None, description="Filter by MATCH or POSSIBLE_MATCH"),
    limit: int = Query(default=30, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[EntityMatchEnrichedOut]:
    query = db.query(EntityMatch)
    if verdict:
        query = query.filter(EntityMatch.verdict == verdict.upper())
    matches = query.order_by(EntityMatch.match_confidence.desc()).offset(offset).limit(limit).all()

    p_ids = set()
    for m in matches:
        p_ids.add(m.source_project_id)
        p_ids.add(m.matched_project_id)

    projects = (
        db.query(Project)
        .options(joinedload(Project.contractor))
        .filter(Project.id.isin(p_ids))
        .all()
    )
    projects_by_id = {p.id: p for p in projects}

    results = []
    for m in matches:
        enriched = _enrich_match(m, projects_by_id)
        if enriched:
            results.append(enriched)
    return results


@router.get("/matches/{match_id}/enriched", response_model=EntityMatchEnrichedOut)
def get_enriched_entity_match(
    match_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> EntityMatchEnrichedOut:
    match = db.query(EntityMatch).filter(EntityMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Entity match pair not found")
    projects = (
        db.query(Project)
        .options(joinedload(Project.contractor))
        .filter(Project.id.isin([match.source_project_id, match.matched_project_id]))
        .all()
    )
    projects_by_id = {p.id: p for p in projects}
    enriched = _enrich_match(match, projects_by_id)
    if not enriched:
        raise HTTPException(status_code=404, detail="Underlying projects not found for this match")
    return enriched

