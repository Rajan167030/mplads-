"""Contractor aggregate statistics (spec §21), computed from real project and
risk-signal data — never hand-set. Must run after the per-project rules
(P01-P03) so "high_risk_projects" can be derived from their persisted
RiskSignal severities rather than recomputed independently.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.contractor import Contractor
from app.models.enums import ProjectStatus, Severity, SignalSource
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.risk.context import build_peer_group_index

HIGH_RISK_SEVERITIES = (Severity.HIGH, Severity.CRITICAL)


def update_contractor_aggregates(db: Session) -> int:
    peer_groups = build_peer_group_index(db)

    high_risk_project_ids = {
        row[0]
        for row in db.query(RiskSignal.project_id)
        .filter(RiskSignal.source == SignalSource.RULE, RiskSignal.severity.in_(HIGH_RISK_SEVERITIES))
        .distinct()
        .all()
    }

    contractors = db.query(Contractor).all()
    updated = 0

    for contractor in contractors:
        projects = db.query(Project).filter(Project.contractor_id == contractor.id).all()
        total = len(projects)
        if total == 0:
            contractor.total_projects = 0
            continue

        completed = sum(1 for p in projects if p.status == ProjectStatus.COMPLETED)
        delayed = sum(1 for p in projects if p.status == ProjectStatus.DELAYED)
        high_risk = sum(1 for p in projects if p.id in high_risk_project_ids)

        overrun_ratios = []
        delay_days = []
        for p in projects:
            peer = peer_groups.stats_for(p.project_type, p.state, p.district)
            if peer and peer.cost_median > 0:
                overrun_ratios.append(float(p.sanctioned_amount) / peer.cost_median - 1)
            if p.status == ProjectStatus.DELAYED:
                delay_days.append(max(0, (date.today() - p.expected_completion_date).days))

        contractor.total_projects = total
        contractor.completed_projects = completed
        contractor.delayed_projects = delayed
        contractor.high_risk_projects = high_risk
        contractor.average_cost_overrun = round(sum(overrun_ratios) / len(overrun_ratios), 3) if overrun_ratios else None
        contractor.average_delay_days = round(sum(delay_days) / len(delay_days), 1) if delay_days else None

        delayed_rate = delayed / total
        high_risk_rate = high_risk / total
        contractor.risk_score = round(min(100.0, (delayed_rate * 50 + high_risk_rate * 50)), 1)
        updated += 1

    db.commit()
    return updated
