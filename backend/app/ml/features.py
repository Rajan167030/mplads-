"""Feature engineering for unsupervised anomaly detection (spec §9).

Every feature is computed directly from project/payment/milestone/inspection/
contractor data and expressed as a ratio or gap against peer-group norms, so
heterogeneous project types and cost scales share one feature space without
needing separate models per type. Deliberately does NOT include Phase 4's
rule-signal counts as an input — the point of the ML pass is to surface
patterns the rules didn't encode, not to reproduce them.
"""

import uuid
from collections import defaultdict
from datetime import date

import numpy as np
from sqlalchemy.orm import Session

from app.models.contractor import Contractor
from app.models.enums import ProjectStatus
from app.models.inspection import Inspection
from app.models.milestone import Milestone
from app.models.payment import Payment
from app.models.project import Project
from app.risk.context import build_peer_group_index

FEATURE_NAMES = [
    "cost_ratio",
    "duration_ratio",
    "overrun_ratio",
    "progress_gap",
    "funding_utilization_gap",
    "milestone_max_regression",
    "inspection_max_regression",
    "contractor_delayed_rate",
    "contractor_high_risk_rate",
    "n_payments",
    "n_milestones",
    "n_inspections",
]


def _max_regression(pairs: list[tuple]) -> float:
    """pairs: [(date, progress_value), ...]. Returns the worst backward jump
    seen when scanning in date order — 0 if progress never regresses."""
    if len(pairs) < 2:
        return 0.0
    worst = 0.0
    running_max = pairs[0][1]
    for _, value in pairs[1:]:
        if value < running_max:
            worst = max(worst, running_max - value)
        running_max = max(running_max, value)
    return worst


def compute_feature_matrix(db: Session) -> tuple[list[uuid.UUID], np.ndarray]:
    peer_groups = build_peer_group_index(db)
    contractors = {c.id: c for c in db.query(Contractor).all()}

    milestones_by_project: dict[uuid.UUID, list] = defaultdict(list)
    for project_id, expected_date, actual_progress in (
        db.query(Milestone.project_id, Milestone.expected_date, Milestone.actual_progress)
        .order_by(Milestone.expected_date)
        .all()
    ):
        if actual_progress is not None:
            milestones_by_project[project_id].append((expected_date, float(actual_progress)))

    inspections_by_project: dict[uuid.UUID, list] = defaultdict(list)
    for project_id, inspection_date, reported_progress in (
        db.query(Inspection.project_id, Inspection.inspection_date, Inspection.reported_progress)
        .order_by(Inspection.inspection_date)
        .all()
    ):
        inspections_by_project[project_id].append((inspection_date, float(reported_progress)))

    payment_counts: dict[uuid.UUID, int] = defaultdict(int)
    for (project_id,) in db.query(Payment.project_id).all():
        payment_counts[project_id] += 1

    projects = db.query(Project).all()
    project_ids: list[uuid.UUID] = []
    rows: list[list[float]] = []

    for p in projects:
        peer = peer_groups.stats_for(p.project_type, p.state, p.district)

        cost_ratio = float(p.sanctioned_amount) / peer.cost_median if peer and peer.cost_median > 0 else 1.0

        planned_duration = (
            (p.expected_completion_date - p.start_date).days
            if p.expected_completion_date and p.start_date else 0
        )
        duration_ratio = planned_duration / peer.duration_median_days if peer and peer.duration_median_days > 0 else 1.0

        overrun_ratio = 0.0
        if peer and peer.duration_median_days > 0 and p.status != ProjectStatus.SANCTIONED:
            if p.status == ProjectStatus.COMPLETED and p.actual_completion_date:
                overrun_days = (p.actual_completion_date - p.expected_completion_date).days
            else:
                overrun_days = (date.today() - p.expected_completion_date).days
            overrun_ratio = max(0, overrun_days) / peer.duration_median_days

        progress_gap = float(p.financial_progress) - float(p.physical_progress)

        funding_pct = (float(p.released_amount) / float(p.sanctioned_amount) * 100) if p.sanctioned_amount else 0.0
        funding_utilization_gap = funding_pct - float(p.financial_progress)

        milestone_max_regression = _max_regression(sorted(milestones_by_project.get(p.id, [])))
        inspection_max_regression = _max_regression(sorted(inspections_by_project.get(p.id, [])))

        contractor = contractors.get(p.contractor_id) if p.contractor_id else None
        contractor_delayed_rate = (
            contractor.delayed_projects / contractor.total_projects if contractor and contractor.total_projects else 0.0
        )
        contractor_high_risk_rate = (
            contractor.high_risk_projects / contractor.total_projects if contractor and contractor.total_projects else 0.0
        )

        project_ids.append(p.id)
        rows.append([
            cost_ratio,
            duration_ratio,
            overrun_ratio,
            progress_gap,
            funding_utilization_gap,
            milestone_max_regression,
            inspection_max_regression,
            contractor_delayed_rate,
            contractor_high_risk_rate,
            float(payment_counts.get(p.id, 0)),
            float(len(milestones_by_project.get(p.id, []))),
            float(len(inspections_by_project.get(p.id, []))),
        ])

    return project_ids, np.array(rows, dtype=float)
