"""Common types for the rule engine (spec §8): every rule implements
`detect(project, context) -> RiskSignal | None`, so the engine can run them
uniformly and the UI can label each signal's origin (RULE vs ML vs CORRELATED,
per spec §26).
"""

from dataclasses import dataclass
from typing import Protocol

from app.models.enums import Severity, SignalType
from app.models.project import Project
from app.risk.context import PeerGroupIndex


@dataclass
class DetectionContext:
    peer_groups: PeerGroupIndex


@dataclass
class SignalDraft:
    """What a rule produces — turned into a RiskSignal row by the engine,
    which fills in project_id/source/created_at."""

    signal_type: SignalType
    severity: Severity
    score: float  # 0-100, this signal's contribution before risk-engine weighting (Phase 6)
    confidence: float  # 0-1
    description: str
    evidence: dict


class Rule(Protocol):
    def detect(self, project: Project, context: DetectionContext) -> SignalDraft | None: ...


def severity_from_ratio(ratio: float, thresholds: tuple[float, float, float]) -> Severity:
    """ratio is how far past the trigger point the value is (>=1.0 means at
    threshold). thresholds are (medium, high, critical) ratio cutoffs."""
    medium, high, critical = thresholds
    if ratio >= critical:
        return Severity.CRITICAL
    if ratio >= high:
        return Severity.HIGH
    if ratio >= medium:
        return Severity.MEDIUM
    return Severity.LOW


def saturating_score(x: float, midpoint: float = 1.0) -> float:
    """Maps a non-negative "how far past the trigger" quantity to a 0-100
    score via `100 * x / (x + midpoint)` — climbs quickly but only reaches
    100 in the limit, never exactly. A hard `min(100, x * k)` cap makes every
    sufficiently-extreme case indistinguishable at exactly 100, which then
    lets a single signal mechanically force a project's aggregate risk score
    (app.risk.scoring, a noisy-OR over signal contributions) to its own
    maximum regardless of anything else — see docs/decisions.md ADR-007."""
    if x <= 0:
        return 0.0
    return round(100 * x / (x + midpoint), 1)
