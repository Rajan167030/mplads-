"""P01 — Payment / Progress Mismatch (spec §8).

Financial progress far ahead of physical progress on the ground is one of the
clearest early-warning signs in public works monitoring: money moving faster
than verifiable work.
"""

from app.models.enums import SignalType
from app.models.project import Project
from app.risk.rules.base import DetectionContext, SignalDraft, saturating_score, severity_from_ratio

GAP_THRESHOLD = 20.0  # percentage points
SEVERITY_RATIOS = (1.0, 1.75, 2.5)  # gap >= 20 / 35 / 50 points


def detect(project: Project, context: DetectionContext) -> SignalDraft | None:
    gap = float(project.financial_progress) - float(project.physical_progress)
    if gap < GAP_THRESHOLD:
        return None

    ratio = gap / GAP_THRESHOLD
    severity = severity_from_ratio(ratio, SEVERITY_RATIOS)
    score = saturating_score(ratio, midpoint=1.0)

    return SignalDraft(
        signal_type=SignalType.PAYMENT_PROGRESS_MISMATCH,
        severity=severity,
        score=round(score, 1),
        confidence=1.0,
        description=(
            f"Financial progress ({project.financial_progress:.0f}%) is {gap:.0f} points ahead of "
            f"physical progress ({project.physical_progress:.0f}%)."
        ),
        evidence={
            "financial_progress": float(project.financial_progress),
            "physical_progress": float(project.physical_progress),
            "gap_points": round(gap, 1),
        },
    )
