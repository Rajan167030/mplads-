"""Feature engineering for unsupervised anomaly detection (spec §9).

Every feature is computed directly from project/payment/milestone/inspection/
contractor data and expressed as a ratio or gap against peer-group norms, so
heterogeneous project types and cost scales share one feature space without
needing separate models per type. Deliberately does NOT include Phase 4's
rule-signal counts as an input — the point of the ML pass is to surface
patterns the rules didn't encode, not to reproduce them.

17 features, not 12: the last 5 (payment variance/irregularity, expenditure
mismatch, completeness, duplicate similarity) were originally only computed
by the CSV-only `scripts/train_real_data_local.py` path and had drifted out
of sync with this DB-backed one — the model actually serving the live app was
missing signals the offline training script had already validated. Ported
here so both paths see the same feature space.

Real-data ingestion (see README) loads only Project + Payment — Milestone,
Inspection, and Contractor stay empty, which makes 6 of these features
constant zero in that mode. `app.ml.ensemble.drop_dead_features` detects and
excludes near-zero-variance columns like these before scaling/fitting rather
than silently wasting model capacity on them.
"""

import uuid
from collections import defaultdict
from datetime import date
from difflib import SequenceMatcher

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
    "payment_amount_variance",
    "payment_interval_irregularity",
    "expenditure_release_mismatch",
    "data_completeness_score",
    "duplicate_similarity_score",
]

# Fields checked for data_completeness_score. Most are DB-required (NOT NULL)
# and so are always present; description is genuinely optional in real
# exports, so in practice this feature mostly tracks description presence —
# matching what the CSV-only training script already measured.
COMPLETENESS_FIELDS = (
    "project_name", "description", "project_type", "state", "district",
    "sanctioned_amount", "start_date", "expected_completion_date", "status",
)

# Cap candidates compared per project so duplicate-similarity stays bounded
# on large real exports, keeping only the longest (most informative) texts.
MAX_DUPLICATE_CANDIDATES = 10


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


def _payment_stats(payments: list[tuple[float, date]]) -> tuple[float, float]:
    """payments: [(amount, payment_date), ...] for one project. Returns
    (amount_variance, interval_irregularity) — population variance of
    amounts and stddev of day-gaps between sorted payment dates, both 0.0
    with fewer than 2 payments (matches train_real_data_local.py)."""
    if len(payments) < 2:
        return 0.0, 0.0
    amounts = np.array([a for a, _ in payments], dtype=float)
    amount_variance = float(amounts.var(ddof=0))

    dates = sorted(d for _, d in payments if d is not None)
    if len(dates) < 3:
        return amount_variance, 0.0
    gaps = np.array([(b - a).days for a, b in zip(dates, dates[1:])], dtype=float)
    return amount_variance, float(gaps.std(ddof=0))


def _duplicate_similarity(project: Project, peer_texts: list[tuple[uuid.UUID, str]]) -> float:
    text = f"{project.project_name} {project.description or ''}".strip().lower()
    if not text:
        return 0.0
    candidates = [t for pid, t in peer_texts if pid != project.id]
    candidates = sorted(candidates, key=len, reverse=True)[:MAX_DUPLICATE_CANDIDATES]
    if not candidates:
        return 0.0
    return max(SequenceMatcher(None, text, c).ratio() for c in candidates)


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

    payments_by_project: dict[uuid.UUID, list] = defaultdict(list)
    for project_id, amount, payment_date in db.query(Payment.project_id, Payment.amount, Payment.payment_date).all():
        payments_by_project[project_id].append((float(amount), payment_date))

    projects = db.query(Project).all()

    # Group texts by the same (type, state, district) peer key used for cost/
    # duration peers, so duplicate-similarity is judged against similar
    # projects rather than the whole dataset.
    text_groups: dict[tuple, list[tuple[uuid.UUID, str]]] = defaultdict(list)
    for p in projects:
        key = (p.project_type, p.state, p.district)
        text_groups[key].append((p.id, f"{p.project_name} {p.description or ''}".strip().lower()))

    project_ids: list[uuid.UUID] = []
    rows: list[list[float]] = []

    for p in projects:
        peer = peer_groups.stats_for(p.project_type, p.state, p.district, p.id)

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

        payment_amount_variance, payment_interval_irregularity = _payment_stats(payments_by_project.get(p.id, []))

        expenditure_release_mismatch = (
            abs(float(p.released_amount) - float(p.expenditure_amount)) / float(p.sanctioned_amount)
            if p.sanctioned_amount else 0.0
        )

        present = sum(1 for field in COMPLETENESS_FIELDS if getattr(p, field) not in (None, ""))
        data_completeness_score = present / len(COMPLETENESS_FIELDS)

        duplicate_similarity_score = _duplicate_similarity(p, text_groups[(p.project_type, p.state, p.district)])

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
            float(len(payments_by_project.get(p.id, []))),
            float(len(milestones_by_project.get(p.id, []))),
            float(len(inspections_by_project.get(p.id, []))),
            payment_amount_variance,
            payment_interval_irregularity,
            expenditure_release_mismatch,
            data_completeness_score,
            duplicate_similarity_score,
        ])

    return project_ids, np.array(rows, dtype=float)
