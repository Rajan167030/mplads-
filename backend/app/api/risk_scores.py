from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.models.enums import InvestigationStatus, UserRole
from app.models.investigation import Investigation
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.models.user import User
from app.risk.narrative import build_explanation
from app.risk.scoring import SOURCE_WEIGHT, run_risk_scoring
from app.schemas.risk_score import (
    ContributingSignal,
    ProjectRiskSummary,
    RiskExplanationOut,
    RiskScoringRunOut,
    RiskSummaryOut,
)

router = APIRouter(prefix="/risk-scores", tags=["risk-scores"])


def _summary(project: Project) -> ProjectRiskSummary:
    return ProjectRiskSummary(
        id=project.id,
        external_project_id=project.external_project_id,
        project_name=project.project_name,
        state=project.state,
        district=project.district,
        project_type=project.project_type.value,
        status=project.status.value,
        risk_score=project.risk_score,
        risk_band=project.risk_band.value if project.risk_band else None,
    )


@router.post("/run", response_model=RiskScoringRunOut)
def trigger_risk_scoring(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.ADMIN, UserRole.ANALYST)),
) -> RiskScoringRunOut:
    report = run_risk_scoring(db)
    log_audit_event(db, user.id, "RUN_RISK_SCORING", "Project", metadata={"band_counts": report.band_counts})
    return RiskScoringRunOut(projects_scored=report.projects_scored, band_counts=report.band_counts)


@router.get("/summary", response_model=RiskSummaryOut)
def risk_summary(db: Session = Depends(get_db)) -> RiskSummaryOut:
    band_counts: dict[str, int] = dict(
        db.query(Project.risk_band, func.count(Project.id))
        .filter(Project.risk_band.isnot(None))
        .group_by(Project.risk_band)
        .all()
    )
    band_counts = {band.value: count for band, count in band_counts.items()}

    return RiskSummaryOut(
        total_projects_scored=db.query(Project).filter(Project.risk_score.isnot(None)).count(),
        band_counts=band_counts,
        total_risk_signals=db.query(RiskSignal).count(),
        open_investigations=db.query(Investigation)
        .filter(Investigation.status.in_((InvestigationStatus.OPEN, InvestigationStatus.IN_PROGRESS)))
        .count(),
    )


@router.get("/top", response_model=list[ProjectRiskSummary])
def top_risk_projects(
    band: str | None = Query(default=None, description="Filter by LOW/MEDIUM/HIGH/CRITICAL"),
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
) -> list[ProjectRiskSummary]:
    query = db.query(Project).filter(Project.risk_score.isnot(None))
    if band:
        query = query.filter(Project.risk_band == band.upper())
    projects = query.order_by(Project.risk_score.desc()).offset(offset).limit(limit).all()
    return [_summary(p) for p in projects]


@router.get("/{project_id}/explain", response_model=RiskExplanationOut)
def explain_risk_score(project_id: str, db: Session = Depends(get_db)) -> RiskExplanationOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    signals = db.query(RiskSignal).filter(RiskSignal.project_id == project_id).all()

    def contribution_of(s: RiskSignal) -> float:
        return round(min(1.0, (s.score / 100) * s.confidence * SOURCE_WEIGHT[s.source]), 4)

    ranked_signals = sorted(signals, key=contribution_of, reverse=True)

    contributing = [
        ContributingSignal(
            signal_type=s.signal_type.value,
            source=s.source.value,
            severity=s.severity.value,
            score=s.score,
            confidence=s.confidence,
            weighted_contribution=contribution_of(s),
            description=s.description,
        )
        for s in ranked_signals
    ]

    ranked_for_narrative = [
        (s.signal_type, s.evidence, s.description, s.confidence, contribution_of(s)) for s in ranked_signals
    ]
    narrative_reasons, recommended_verification, overall_confidence = build_explanation(ranked_for_narrative)

    return RiskExplanationOut(
        project=_summary(project),
        contributing_signals=contributing,
        narrative_reasons=narrative_reasons,
        recommended_verification=recommended_verification,
        overall_confidence=overall_confidence,
    )
