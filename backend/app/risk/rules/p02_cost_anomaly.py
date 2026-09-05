"""P02 — Cost Anomaly (spec §8, §10).

Compares a project's sanctioned cost against its peer group — same project
type, refined to district/state where there's enough data (see
app.risk.context) — never a single national average. A ₹20L community hall is
unremarkable in one district and a clear outlier in another.
"""

from app.models.enums import SignalType
from app.models.project import Project
from app.risk.rules.base import DetectionContext, SignalDraft, saturating_score, severity_from_ratio

COST_RATIO_THRESHOLD = 1.75  # must be at least 75% above peer median to flag
SEVERITY_RATIOS = (1.75, 2.25, 3.0)

CONFIDENCE_BY_LEVEL = {"district": 1.0, "state": 0.85, "national": 0.65}


def detect(project: Project, context: DetectionContext) -> SignalDraft | None:
    peer = context.peer_groups.stats_for(project.project_type, project.state, project.district)
    if peer is None or peer.cost_median <= 0:
        return None

    ratio = float(project.sanctioned_amount) / peer.cost_median
    if ratio < COST_RATIO_THRESHOLD:
        return None

    severity = severity_from_ratio(ratio, SEVERITY_RATIOS)
    score = saturating_score(ratio - 1, midpoint=1.0)
    pct_above = (ratio - 1) * 100

    return SignalDraft(
        signal_type=SignalType.COST_ANOMALY,
        severity=severity,
        score=round(score, 1),
        confidence=CONFIDENCE_BY_LEVEL[peer.level],
        description=(
            f"Sanctioned amount is {pct_above:.0f}% above the {peer.level} peer median for "
            f"{project.project_type.value.replace('_', ' ').title()} projects "
            f"(₹{peer.cost_median:,.0f}, n={peer.n})."
        ),
        evidence={
            "sanctioned_amount": float(project.sanctioned_amount),
            "peer_median": peer.cost_median,
            "peer_group_level": peer.level,
            "peer_group_size": peer.n,
            "ratio": round(ratio, 2),
        },
    )
