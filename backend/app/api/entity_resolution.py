from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.models.entity_match import EntityMatch
from app.models.enums import UserRole
from app.models.user import User
from app.nlp.entity_resolution import run_entity_resolution
from app.schemas.entity_match import EntityMatchOut, EntityResolutionRunOut

router = APIRouter(prefix="/entity-resolution", tags=["entity-resolution"])


@router.post("/run", response_model=EntityResolutionRunOut)
def trigger_entity_resolution(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
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
) -> list[EntityMatch]:
    query = db.query(EntityMatch)
    if verdict:
        query = query.filter(EntityMatch.verdict == verdict.upper())
    return query.order_by(EntityMatch.match_confidence.desc()).offset(offset).limit(limit).all()
