"""Peer-group statistics for contextual anomaly detection (spec §10): a
project's cost/duration is judged against similar projects — same type,
refined by district/state where there's enough data to trust it — never
against one national average.

`stats_for` takes the querying project's own id and excludes its own record
from the peer group before computing the median (leave-one-out). Without
this, a project is partly compared against itself — for the smallest allowed
peer groups (`MIN_PEER_GROUP_SIZE` = 5) one project's own cost/duration can
shift the very median it's then judged against, systematically understating
how anomalous it looks. `MIN_PEER_GROUP_SIZE` is enforced *after* exclusion.
"""

import statistics
import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.enums import ProjectStatus
from app.models.project import Project

MIN_PEER_GROUP_SIZE = 5


@dataclass
class PeerStats:
    cost_median: float
    duration_median_days: float
    n: int
    level: str  # "district" | "state" | "national" — which fallback tier this came from


@dataclass
class PeerGroupIndex:
    by_district: dict[tuple, list] = field(default_factory=dict)
    by_state: dict[tuple, list] = field(default_factory=dict)
    by_type: dict[str, list] = field(default_factory=dict)

    def stats_for(
        self, project_type: str, state: str, district: str, exclude_project_id: uuid.UUID | None = None
    ) -> PeerStats | None:
        district_key = (project_type, state, district)
        state_key = (project_type, state)

        for records, level, key in (
            (self.by_district.get(district_key), "district", district_key),
            (self.by_state.get(state_key), "state", state_key),
            (self.by_type.get(project_type), "national", project_type),
        ):
            if not records:
                continue
            peers = [r for r in records if r[0] != exclude_project_id]
            if len(peers) >= MIN_PEER_GROUP_SIZE:
                costs = [r[1] for r in peers]
                durations = [r[2] for r in peers]
                return PeerStats(
                    cost_median=statistics.median(costs),
                    duration_median_days=statistics.median(durations),
                    n=len(peers),
                    level=level,
                )
        return None


def build_peer_group_index(db: Session) -> PeerGroupIndex:
    rows = (
        db.query(
            Project.id, Project.project_type, Project.state, Project.district,
            Project.sanctioned_amount, Project.start_date, Project.expected_completion_date,
        )
        .filter(Project.status != ProjectStatus.SANCTIONED)
        .all()
    )

    index = PeerGroupIndex()
    for project_id, ptype, state, district, amount, start, expected in rows:
        if not start or not expected or expected <= start:
            continue
        duration_days = (expected - start).days
        record = (project_id, float(amount), duration_days)

        index.by_district.setdefault((ptype, state, district), []).append(record)
        index.by_state.setdefault((ptype, state), []).append(record)
        index.by_type.setdefault(ptype, []).append(record)

    return index
