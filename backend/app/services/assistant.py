"""Retrieval-grounded AI assistant (spec's AI Assistant requirement). Every
answer is built from real data pulled from the database first, then handed to
the LLM with an explicit instruction to answer only from that context — never
free-associate from training data about a specific project. If no LLM is
configured, the retrieved context is returned directly rather than a
fabricated answer, so the endpoint stays honestly useful either way.
"""

from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.risk.scoring import SOURCE_WEIGHT
from app.services.llm import LLMNotConfiguredError, LLMRequestError, generate_completion

SYSTEM_PROMPT = (
    "You are an assistant for the MPLADS Intelligence Platform, a government project monitoring "
    "system. Answer the user's question using ONLY the CONTEXT provided below — it is real data "
    "retrieved from the database for this specific question. Do not use outside knowledge about "
    "MPLADS, this project, or any contractor. If the context does not contain enough information "
    "to answer, say so plainly rather than guessing. Never assert that a project is fraudulent — "
    "frame findings as 'flagged for investigation' or 'requires human review', consistent with how "
    "the platform itself communicates risk."
)


@dataclass
class AssistantResponse:
    llm_configured: bool
    answer: str | None
    context_summary: str
    grounded_on: dict = field(default_factory=dict)
    error: str | None = None


def _build_project_context(db: Session, project_id: str) -> tuple[str, dict] | None:
    project = db.get(Project, project_id)
    if not project:
        return None

    signals = db.query(RiskSignal).filter(RiskSignal.project_id == project_id).all()
    signal_lines = []
    for s in sorted(signals, key=lambda s: (s.score / 100) * s.confidence * SOURCE_WEIGHT[s.source], reverse=True):
        signal_lines.append(f"  - [{s.source.value}] {s.signal_type.value} (severity={s.severity.value}, score={s.score}): {s.description}")

    text = f"""PROJECT: {project.project_name} ({project.external_project_id})
Location: {project.district}, {project.state}
Type: {project.project_type.value}
Status: {project.status.value}
Sanctioned amount: Rs.{float(project.sanctioned_amount):,.0f}
Released amount: Rs.{float(project.released_amount):,.0f}
Physical progress: {project.physical_progress}%
Financial progress: {project.financial_progress}%
Contractor: {project.contractor.name if project.contractor else "Not assigned"}
Overall risk score: {project.risk_score if project.risk_score is not None else "not yet scored"} ({project.risk_band.value if project.risk_band else "N/A"})

RISK SIGNALS ({len(signals)} total, most significant first):
{chr(10).join(signal_lines) if signal_lines else "  (none recorded)"}
"""
    grounded_on = {
        "project_id": str(project.id),
        "external_project_id": project.external_project_id,
        "signal_count": len(signals),
    }
    return text, grounded_on


def _build_portfolio_context(db: Session) -> tuple[str, dict]:
    total_projects = db.query(Project).count()
    band_rows = (
        db.query(Project.risk_band, func.count(Project.id))
        .filter(Project.risk_band.isnot(None))
        .group_by(Project.risk_band)
        .all()
    )
    band_counts = {band.value: count for band, count in band_rows}

    signal_rows = (
        db.query(RiskSignal.signal_type, func.count(RiskSignal.id))
        .group_by(RiskSignal.signal_type)
        .order_by(func.count(RiskSignal.id).desc())
        .limit(5)
        .all()
    )

    text = f"""PORTFOLIO OVERVIEW
Total projects: {total_projects}
Risk bands: {band_counts}
Top signal types: {", ".join(f"{t.value} ({c})" for t, c in signal_rows)}
"""
    return text, {"total_projects": total_projects, "band_counts": band_counts}


def answer_question(db: Session, question: str, project_id: str | None = None) -> AssistantResponse:
    if project_id:
        built = _build_project_context(db, project_id)
        if built is None:
            return AssistantResponse(
                llm_configured=False, answer=None, context_summary="", error="Project not found"
            )
        context_text, grounded_on = built
    else:
        context_text, grounded_on = _build_portfolio_context(db)

    prompt = f"CONTEXT:\n{context_text}\n\nQUESTION: {question}"

    try:
        answer = generate_completion(prompt, system=SYSTEM_PROMPT)
        return AssistantResponse(llm_configured=True, answer=answer, context_summary=context_text, grounded_on=grounded_on)
    except LLMNotConfiguredError as exc:
        return AssistantResponse(
            llm_configured=False,
            answer=None,
            context_summary=context_text,
            grounded_on=grounded_on,
            error=str(exc),
        )
    except LLMRequestError as exc:
        return AssistantResponse(
            llm_configured=True,
            answer=None,
            context_summary=context_text,
            grounded_on=grounded_on,
            error=str(exc),
        )
