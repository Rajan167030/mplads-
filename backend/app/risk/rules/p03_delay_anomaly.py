"""P03 — Timeline / Delay Anomaly (spec §8, §10).

Flags projects that have overrun *their own committed* expected_completion_date
— not raw elapsed time against a peer average. Comparing elapsed-time-so-far
for still-running projects against a peer median would be systematically
biased: projects that finish faster than the median have already left the
"still running" pool, so at any snapshot in time the ongoing/delayed pool
skews toward slower projects, and the comparison would flag roughly half of
everything regardless of whether it's actually behind schedule. Measuring
overrun against each project's own deadline avoids that bias entirely; the
peer group is only used to calibrate how severe a given overrun is (a 60-day
overrun means something different for an 8-month-median project than a
24-month-median one).
"""

from datetime import date

from app.models.enums import ProjectStatus, SignalType
from app.models.project import Project
from app.risk.rules.base import DetectionContext, SignalDraft, saturating_score, severity_from_ratio
from app.risk.rules.p02_cost_anomaly import CONFIDENCE_BY_LEVEL

# Overrun must be at least 30% of a typical peer project's whole duration
# before it's worth flagging — a few days late on an 8-month project isn't.
OVERRUN_RATIO_THRESHOLD = 0.3
SEVERITY_RATIOS = (0.3, 0.75, 1.5)


def detect(project: Project, context: DetectionContext) -> SignalDraft | None:
    if project.status == ProjectStatus.SANCTIONED:
        return None  # too early to judge

    if project.status == ProjectStatus.COMPLETED and project.actual_completion_date:
        overrun_days = (project.actual_completion_date - project.expected_completion_date).days
        phase = "completed"
    else:
        overrun_days = (date.today() - project.expected_completion_date).days
        phase = "still running, unresolved,"

    if overrun_days <= 0:
        return None  # not yet past its own committed deadline

    peer = context.peer_groups.stats_for(project.project_type, project.state, project.district)
    if peer is None or peer.duration_median_days <= 0:
        return None

    ratio = overrun_days / peer.duration_median_days
    if ratio < OVERRUN_RATIO_THRESHOLD:
        return None

    severity = severity_from_ratio(ratio, SEVERITY_RATIOS)
    score = saturating_score(ratio, midpoint=1.0)

    return SignalDraft(
        signal_type=SignalType.DELAY_ANOMALY,
        severity=severity,
        score=round(score, 1),
        confidence=CONFIDENCE_BY_LEVEL[peer.level],
        description=(
            f"Project is {phase} {overrun_days} days past its own expected completion date — "
            f"{peer.level} peer median duration for similar projects is ~{peer.duration_median_days / 30.4:.1f} "
            f"months (n={peer.n})."
        ),
        evidence={
            "overrun_days": overrun_days,
            "peer_median_days": peer.duration_median_days,
            "peer_group_level": peer.level,
            "peer_group_size": peer.n,
            "ratio": round(ratio, 2),
        },
    )
