"""P10 — Multi-Signal Correlation (spec §8).

The single most important pattern per spec: several independently-sourced
weak signals on the same project should produce a higher-priority case than
any one signal alone. Runs last, after every other rule for the current
engine pass has been persisted, and combines their per-type scores with a
noisy-OR (treating each signal's score/100 as an independent probability of
genuine concern) rather than a raw sum, so the combined score stays bounded
and reflects "increasingly unlikely to be coincidence" rather than just
piling up points.
"""

import uuid
from collections import defaultdict
from math import prod

from sqlalchemy.orm import Session

from app.models.enums import SignalSource, SignalType, Severity
from app.models.risk_signal import RiskSignal
from app.risk.rules.base import SignalDraft

MIN_DISTINCT_SIGNAL_TYPES = 3


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = (
        db.query(RiskSignal.project_id, RiskSignal.signal_type, RiskSignal.score)
        .filter(RiskSignal.source.in_((SignalSource.RULE,)))
        .all()
    )

    by_project: dict[uuid.UUID, dict[SignalType, float]] = defaultdict(dict)
    for project_id, signal_type, score in rows:
        current = by_project[project_id].get(signal_type, 0.0)
        by_project[project_id][signal_type] = max(current, float(score))

    for project_id, per_type_scores in by_project.items():
        if len(per_type_scores) < MIN_DISTINCT_SIGNAL_TYPES:
            continue

        combined = (1 - prod(1 - min(s, 99.0) / 100 for s in per_type_scores.values())) * 100
        severity = Severity.CRITICAL if len(per_type_scores) >= 5 else Severity.HIGH

        contributing = ", ".join(sorted(t.value.replace("_", " ").title() for t in per_type_scores))
        signals.append((project_id, SignalDraft(
            signal_type=SignalType.MULTI_SIGNAL_CORRELATION,
            severity=severity,
            score=round(combined, 1),
            confidence=1.0,
            description=(
                f"{len(per_type_scores)} independent risk signals on the same project: {contributing}. "
                f"Correlated findings across independent detectors carry more weight than any one alone."
            ),
            evidence={
                "contributing_signal_types": [t.value for t in per_type_scores],
                "per_type_scores": {t.value: s for t, s in per_type_scores.items()},
            },
        )))

    return signals
