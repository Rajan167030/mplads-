"""ML Ensemble Consensus — cross-model agreement among the unsupervised
detectors (app.ml.ensemble: Isolation Forest, Autoencoder, DBSCAN).

Deliberately not a weighted average of the three models' anomaly scores —
their raw scales aren't comparable (isolation-path depth vs. reconstruction
error vs. cluster distance), and this codebase already rejected weighted
sums as the risk engine's combining rule (see app.risk.scoring's docstring
and docs/decisions.md ADR-007: a hard cap needed to stay in [0, 100], and it
makes several weak signals as alarming as one strong one). Instead, treat
agreement itself as the evidence — the same "independent signals correlating"
idea as P10 (app.risk.rules.p10_multi_signal), just scoped to the three ML
detectors rather than every rule. When ≥2 of them independently flag the
same project, that's a genuinely different, stronger claim than any one
detector's score alone, and it feeds the same noisy-OR risk engine as
everything else via `source=CORRELATED`.
"""

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.enums import SignalSource, SignalType, Severity
from app.models.risk_signal import RiskSignal
from app.risk.rules.base import SignalDraft

ML_SIGNAL_TYPES = (
    SignalType.ML_STATISTICAL_ANOMALY,
    SignalType.ML_AUTOENCODER_ANOMALY,
    SignalType.ML_CLUSTER_OUTLIER,
)
MIN_AGREEING_MODELS = 2


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = (
        db.query(RiskSignal.project_id, RiskSignal.signal_type, RiskSignal.score)
        .filter(RiskSignal.source == SignalSource.ML, RiskSignal.signal_type.in_(ML_SIGNAL_TYPES))
        .all()
    )

    by_project: dict[uuid.UUID, dict[SignalType, float]] = defaultdict(dict)
    for project_id, signal_type, score in rows:
        by_project[project_id][signal_type] = float(score)

    for project_id, per_model_scores in by_project.items():
        if len(per_model_scores) < MIN_AGREEING_MODELS:
            continue

        combined = 1.0
        for s in per_model_scores.values():
            combined *= (1 - min(s, 99.0) / 100)
        combined = (1 - combined) * 100

        severity = Severity.CRITICAL if len(per_model_scores) == len(ML_SIGNAL_TYPES) else Severity.HIGH
        agreeing = ", ".join(sorted(t.value.replace("ML_", "").replace("_", " ").title() for t in per_model_scores))

        signals.append((project_id, SignalDraft(
            signal_type=SignalType.ML_ENSEMBLE_CONSENSUS,
            severity=severity,
            score=round(combined, 1),
            confidence=1.0,
            description=(
                f"{len(per_model_scores)} of {len(ML_SIGNAL_TYPES)} independent anomaly detectors flagged this "
                f"project: {agreeing}. Agreement across detectors built on different assumptions is stronger "
                f"evidence than any one detector's score alone."
            ),
            evidence={
                "agreeing_detectors": [t.value for t in per_model_scores],
                "per_detector_scores": {t.value: s for t, s in per_model_scores.items()},
            },
        )))

    return signals
