"""P09 — Evidence Anomaly (spec §8).

Two checks on submitted evidence, both metadata-only — this never claims to
detect image manipulation, only inconsistencies a forensic model isn't needed
to see: the same file hash reused across unrelated projects, and a capture
timestamp that predates the project even starting.
"""

import uuid
from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.enums import Severity, SignalType
from app.models.evidence import Evidence
from app.models.project import Project
from app.risk.rules.base import SignalDraft


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = (
        db.query(Evidence.project_id, Evidence.hash, Evidence.captured_at, Evidence.file_reference)
        .filter(Evidence.hash.isnot(None))
        .all()
    )

    by_hash: dict[str, set[uuid.UUID]] = defaultdict(set)
    for project_id, file_hash, _, _ in rows:
        by_hash[file_hash].add(project_id)

    flagged_for_reuse: dict[uuid.UUID, int] = {}
    for file_hash, project_ids in by_hash.items():
        if len(project_ids) > 1:
            for pid in project_ids:
                flagged_for_reuse[pid] = max(flagged_for_reuse.get(pid, 0), len(project_ids))

    for project_id, group_size in flagged_for_reuse.items():
        signals.append((project_id, SignalDraft(
            signal_type=SignalType.EVIDENCE_ANOMALY,
            severity=Severity.HIGH if group_size >= 4 else Severity.MEDIUM,
            score=round(min(100.0, group_size * 20), 1),
            confidence=1.0,
            description=(
                f"Evidence file hash is identical across {group_size} different projects — "
                f"the same image/document appears to have been reused rather than captured on-site."
            ),
            evidence={"shared_hash_group_size": group_size},
        )))

    start_dates = {row.id: row.start_date for row in db.query(Project.id, Project.start_date).all()}
    for project_id, file_hash, captured_at, file_reference in rows:
        start_date = start_dates.get(project_id)
        if not start_date or not captured_at:
            continue
        captured_date = captured_at.date() if isinstance(captured_at, datetime) else captured_at
        if captured_date < start_date:
            days_early = (start_date - captured_date).days
            signals.append((project_id, SignalDraft(
                signal_type=SignalType.EVIDENCE_ANOMALY,
                severity=Severity.HIGH if days_early > 30 else Severity.MEDIUM,
                score=round(min(100.0, days_early * 2), 1),
                confidence=1.0,
                description=(
                    f"Evidence ({file_reference or 'file'}) is timestamped {days_early} days before the "
                    f"project's own start date — inconsistent with the claimed capture."
                ),
                evidence={"captured_at": captured_date.isoformat(), "start_date": start_date.isoformat(), "days_early": days_early},
            )))

    return signals
