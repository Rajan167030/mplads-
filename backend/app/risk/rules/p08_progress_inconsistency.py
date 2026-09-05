"""P08 — Progress Inconsistency (spec §8).

Physical progress should be monotonically non-decreasing across inspections —
work done doesn't get undone. A later inspection reporting materially lower
progress than an earlier one usually means inconsistent/unreliable reporting
rather than an anomaly in the work itself, but it's exactly the kind of
record-quality problem worth flagging for verification.
"""

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.enums import Severity, SignalType
from app.models.inspection import Inspection
from app.risk.rules.base import SignalDraft

MIN_INSPECTIONS = 2
REGRESSION_THRESHOLD = 5.0  # percentage points


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = (
        db.query(Inspection.project_id, Inspection.inspection_date, Inspection.reported_progress)
        .order_by(Inspection.inspection_date)
        .all()
    )
    by_project: dict[uuid.UUID, list] = defaultdict(list)
    for project_id, inspection_date, reported_progress in rows:
        by_project[project_id].append((inspection_date, float(reported_progress)))

    for project_id, inspections in by_project.items():
        if len(inspections) < MIN_INSPECTIONS:
            continue

        worst_regression = 0.0
        worst_pair = None
        running_max = inspections[0][1]
        for date, progress in inspections[1:]:
            if progress < running_max - REGRESSION_THRESHOLD:
                regression = running_max - progress
                if regression > worst_regression:
                    worst_regression = regression
                    worst_pair = (running_max, progress)
            running_max = max(running_max, progress)

        if worst_pair is None:
            continue

        severity = Severity.HIGH if worst_regression >= 20 else Severity.MEDIUM
        score = round(min(100.0, worst_regression * 2.5), 1)

        signals.append((project_id, SignalDraft(
            signal_type=SignalType.PROGRESS_INCONSISTENCY,
            severity=severity,
            score=score,
            confidence=1.0,
            description=(
                f"A later inspection reported {worst_pair[1]:.0f}% progress after an earlier inspection "
                f"had already reported {worst_pair[0]:.0f}% — a {worst_regression:.0f}-point regression."
            ),
            evidence={
                "inspection_count": len(inspections),
                "earlier_progress": worst_pair[0],
                "later_progress": worst_pair[1],
                "regression_points": round(worst_regression, 1),
            },
        )))

    return signals
