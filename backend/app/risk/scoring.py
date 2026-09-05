"""Risk Engine (spec §11): combines every RiskSignal for a project — rule-based,
ML, and correlated — into one transparent 0-100 score and a LOW/MEDIUM/HIGH/
CRITICAL band, without ever describing it as a fraud probability.

Aggregation is a "noisy-OR": each signal independently contributes a
probability-like vote that the project deserves scrutiny, combined as
`1 - product(1 - contribution_i)`. This has three properties that matter here:
  - Monotonic and saturating — more signals can only raise the score, and it
    never exceeds 100, with no arbitrary cap to tune.
  - A single severe, high-confidence signal can already push the score high on
    its own — one confirmed cost anomaly is reason enough to look, it doesn't
    need corroboration.
  - Independent signals compound faster than any one of them alone — which is
    exactly the escalation P10 (multi-signal correlation) is meant to capture,
    and CORRELATED-sourced signals get a weight bump on top of that for it.
A weighted sum was considered and rejected: it requires an arbitrary cap to
stay in [0, 100] and makes five weak signals as alarming as one strong one,
which doesn't match how these signals should actually be read.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import SignalSource
from app.models.project import Project
from app.models.risk_signal import RiskSignal

SOURCE_WEIGHT = {
    SignalSource.RULE: 1.0,
    SignalSource.ML: 0.8,  # unsupervised — already discounted via its own confidence, extra care here
    SignalSource.CORRELATED: 1.3,  # P10: independently-arrived-at signals reinforcing each other
}

BAND_CUTOFFS = (25.0, 50.0, 75.0)  # score < 25 LOW, <50 MEDIUM, <75 HIGH, else CRITICAL


@dataclass
class RiskScoringReport:
    projects_scored: int = 0
    band_counts: dict[str, int] | None = None


def _band_for_score(score: float) -> str:
    from app.models.enums import Severity

    low, medium, high = BAND_CUTOFFS
    if score < low:
        return Severity.LOW
    if score < medium:
        return Severity.MEDIUM
    if score < high:
        return Severity.HIGH
    return Severity.CRITICAL


def compute_risk_score(signals: list[RiskSignal]) -> float:
    if not signals:
        return 0.0

    survival_probability = 1.0
    for signal in signals:
        contribution = min(1.0, (signal.score / 100) * signal.confidence * SOURCE_WEIGHT[signal.source])
        survival_probability *= (1 - contribution)

    return round((1 - survival_probability) * 100, 1)


def run_risk_scoring(db: Session) -> RiskScoringReport:
    report = RiskScoringReport(band_counts={})

    signals_by_project: dict = {}
    for signal in db.scalars(select(RiskSignal)).all():
        signals_by_project.setdefault(signal.project_id, []).append(signal)

    projects = db.scalars(select(Project)).all()
    for project in projects:
        signals = signals_by_project.get(project.id, [])
        score = compute_risk_score(signals)
        band = _band_for_score(score)

        project.risk_score = score
        project.risk_band = band
        report.band_counts[band.value] = report.band_counts.get(band.value, 0) + 1

    report.projects_scored = len(projects)
    db.commit()
    return report
