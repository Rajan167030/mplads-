"""P11 — Overpayment (spec §8, hard rule).

Released amount exceeding the sanctioned amount is not a statistical
judgment call the way a cost or delay anomaly is — it's a direct, auditable
fact from the project's own two numbers. Flagged at full confidence and
severity regardless of peer context; the ML ensemble (app.ml) finds the
patterns rules don't encode, this rule exists precisely so the one pattern
that needs no model at all is never missed waiting on one.
"""

from app.models.enums import Severity, SignalType
from app.models.project import Project
from app.risk.rules.base import DetectionContext, SignalDraft

# Guards against flagging on rounding/float noise, not a policy tolerance.
ROUNDING_TOLERANCE = 1.0


def detect(project: Project, context: DetectionContext) -> SignalDraft | None:
    overpayment = float(project.released_amount) - float(project.sanctioned_amount)
    if overpayment <= ROUNDING_TOLERANCE:
        return None

    pct_over = overpayment / float(project.sanctioned_amount) * 100 if project.sanctioned_amount else 0.0

    return SignalDraft(
        signal_type=SignalType.OVERPAYMENT,
        severity=Severity.CRITICAL,
        score=100.0,
        confidence=1.0,
        description=(
            f"Released amount (₹{project.released_amount:,.0f}) exceeds the sanctioned amount "
            f"(₹{project.sanctioned_amount:,.0f}) by ₹{overpayment:,.0f} ({pct_over:.1f}%)."
        ),
        evidence={
            "released_amount": float(project.released_amount),
            "sanctioned_amount": float(project.sanctioned_amount),
            "overpayment_amount": round(overpayment, 2),
            "overpayment_pct": round(pct_over, 1),
        },
    )
