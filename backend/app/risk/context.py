"""Peer-group statistics for contextual anomaly detection (spec §10): a
project's cost/duration is judged against similar projects — same type,
refined by district/state where there's enough data to trust it — never
against one national average.
"""

import statistics
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

    def stats_for(self, project_type: str, state: str, district: str) -> PeerStats | None:
        district_key = (project_type, state, district)
        state_key = (project_type, state)

        for records, level, key in (
            (self.by_district.get(district_key), "district", district_key),
            (self.by_state.get(state_key), "state", state_key),
            (self.by_type.get(project_type), "national", project_type),
        ):
            if records and len(records) >= MIN_PEER_GROUP_SIZE:
                costs = [r[0] for r in records]
                durations = [r[1] for r in records]
                return PeerStats(
                    cost_median=statistics.median(costs),
                    duration_median_days=statistics.median(durations),
                    n=len(records),
                    level=level,
                )
        return None


def build_peer_group_index(db: Session) -> PeerGroupIndex:
    rows = (
        db.query(
            Project.project_type, Project.state, Project.district,
            Project.sanctioned_amount, Project.start_date, Project.expected_completion_date,
        )
        .filter(Project.status != ProjectStatus.SANCTIONED)
        .all()
    )

    index = PeerGroupIndex()
    for ptype, state, district, amount, start, expected in rows:
        if not start or not expected or expected <= start:
            continue
        duration_days = (expected - start).days
        record = (float(amount), duration_days)

        index.by_district.setdefault((ptype, state, district), []).append(record)
        index.by_state.setdefault((ptype, state), []).append(record)
        index.by_type.setdefault(ptype, []).append(record)

    return index
