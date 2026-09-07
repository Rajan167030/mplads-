from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.models.enums import UserRole
from app.models.risk_signal import RiskSignal
from app.models.user import User
from app.risk.engine import run_rule_engine
from app.schemas.graph import ProjectRef
from app.schemas.risk_signal import RiskSignalOut, RuleEngineRunOut

router = APIRouter(prefix="/risk-signals", tags=["risk-signals"])


@router.post("/run", response_model=RuleEngineRunOut)
def trigger_rule_engine(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> RuleEngineRunOut:
    report = run_rule_engine(db)
    log_audit_event(db, user.id, "RUN_RULE_ENGINE", "RiskSignal", metadata={"signals_created": report.signals_created})
    return RuleEngineRunOut(
        projects_scanned=report.projects_scanned,
        signals_created=report.signals_created,
        by_type=report.by_type,
    )


@router.get("", response_model=list[RiskSignalOut])
def list_risk_signals(
    project_id: str | None = None,
    signal_type: str | None = None,
    source: str | None = None,
    severity: str | None = None,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> list[RiskSignalOut]:
    query = db.query(RiskSignal).options(joinedload(RiskSignal.project))
    if project_id:
        query = query.filter(RiskSignal.project_id == project_id)
    if signal_type:
        query = query.filter(RiskSignal.signal_type == signal_type.upper())
    if source:
        query = query.filter(RiskSignal.source == source.upper())
    if severity:
        query = query.filter(RiskSignal.severity == severity.upper())
    signals = query.order_by(RiskSignal.score.desc()).offset(offset).limit(limit).all()

    return [
        RiskSignalOut(
            id=s.id,
            project_id=s.project_id,
            signal_type=s.signal_type,
            source=s.source,
            severity=s.severity,
            score=s.score,
            confidence=s.confidence,
            description=s.description,
            evidence=s.evidence,
            created_at=s.created_at,
            project=ProjectRef(
                id=s.project.id,
                external_project_id=s.project.external_project_id,
                project_name=s.project.project_name,
                state=s.project.state,
                district=s.project.district,
                project_type=s.project.project_type.value,
                status=s.project.status.value,
                risk_score=s.project.risk_score,
                risk_band=s.project.risk_band.value if s.project.risk_band else None,
            ),
        )
        for s in signals
    ]
