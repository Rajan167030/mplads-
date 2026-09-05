"""P05 — Contractor Risk Pattern (spec §8, §21).

Flags every project handled by a contractor whose delay/high-risk rate is
*statistically significantly* above the population baseline — not just above
a flat percentage cutoff. A flat cutoff is unreliable at small sample sizes:
a contractor with 5 projects and 2 delayed hits "40% delayed" from ordinary
binomial variance alone (roughly a 1-in-4 chance at a ~20% baseline rate),
which is exactly the kind of small-sample false positive a "pattern" claim
needs to guard against. A z-test against the population rate naturally
requires a bigger relative deviation from small samples and tolerates a
smaller one from large, well-evidenced ones.
"""

import math
import uuid

from sqlalchemy.orm import Session

from app.models.contractor import Contractor
from app.models.enums import ProjectStatus, Severity, SignalType
from app.models.project import Project
from app.risk.rules.base import SignalDraft

MIN_PROJECTS = 8
Z_THRESHOLD = 2.0  # ~one-sided p < 0.025


def _z_score(observed: int, n: int, baseline_rate: float) -> float:
    expected = n * baseline_rate
    variance = n * baseline_rate * (1 - baseline_rate)
    if variance <= 0:
        return 0.0
    return (observed - expected) / math.sqrt(variance)


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    total_projects = db.query(Project).count()
    if total_projects == 0:
        return signals
    baseline_delayed_rate = db.query(Project).filter(Project.status == ProjectStatus.DELAYED).count() / total_projects

    contractors = db.query(Contractor).filter(Contractor.total_projects >= MIN_PROJECTS).all()
    baseline_high_risk_rate = (
        sum(c.high_risk_projects for c in contractors) / sum(c.total_projects for c in contractors)
        if contractors else 0.0
    )

    for contractor in contractors:
        delay_z = _z_score(contractor.delayed_projects, contractor.total_projects, baseline_delayed_rate)
        risk_z = _z_score(contractor.high_risk_projects, contractor.total_projects, baseline_high_risk_rate)
        best_z = max(delay_z, risk_z)

        if best_z < Z_THRESHOLD:
            continue

        delayed_rate = contractor.delayed_projects / contractor.total_projects
        high_risk_rate = contractor.high_risk_projects / contractor.total_projects

        severity = Severity.CRITICAL if best_z >= 3.5 else Severity.HIGH
        score = round(min(100.0, best_z * 20), 1)

        description = (
            f"Contractor \"{contractor.name}\" has {contractor.delayed_projects}/{contractor.total_projects} "
            f"delayed projects ({delayed_rate:.0%}) and {contractor.high_risk_projects} flagged high/critical risk "
            f"({high_risk_rate:.0%}) — significantly above the {baseline_delayed_rate:.0%}/{baseline_high_risk_rate:.0%} "
            f"population baseline (z={best_z:.1f})."
        )
        evidence = {
            "contractor_id": str(contractor.id),
            "contractor_name": contractor.name,
            "total_projects": contractor.total_projects,
            "delayed_projects": contractor.delayed_projects,
            "high_risk_projects": contractor.high_risk_projects,
            "delayed_rate": round(delayed_rate, 3),
            "high_risk_rate": round(high_risk_rate, 3),
            "baseline_delayed_rate": round(baseline_delayed_rate, 3),
            "baseline_high_risk_rate": round(baseline_high_risk_rate, 3),
            "z_score": round(best_z, 2),
            "average_cost_overrun": contractor.average_cost_overrun,
            "average_delay_days": contractor.average_delay_days,
        }

        project_ids = db.query(Project.id).filter(Project.contractor_id == contractor.id).all()
        for (project_id,) in project_ids:
            signals.append((project_id, SignalDraft(
                signal_type=SignalType.CONTRACTOR_RISK_PATTERN,
                severity=severity,
                score=score,
                confidence=1.0,
                description=description,
                evidence=evidence,
            )))

    return signals
