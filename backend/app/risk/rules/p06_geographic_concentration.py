"""P06 — Geographic Concentration (spec §8, §13).

Clusters same-type projects by physical proximity (DBSCAN, haversine metric)
per spec's suggestion, then keeps only clusters whose sanction dates are also
tightly bunched — a district legitimately building many schools over a
decade isn't anomalous; the same cluster of schools all sanctioned within a
few months is worth a look.
"""

import uuid
from datetime import timedelta

import numpy as np
from sklearn.cluster import DBSCAN
from sqlalchemy.orm import Session

from app.models.enums import Severity, SignalType
from app.models.project import Project
from app.risk.rules.base import SignalDraft

EPS_KM = 3.0
EARTH_RADIUS_KM = 6371.0
MIN_SAMPLES = 5
MAX_DATE_SPREAD_DAYS = 180


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = (
        db.query(Project.id, Project.project_type, Project.latitude, Project.longitude, Project.start_date, Project.state, Project.district)
        .filter(Project.latitude.isnot(None), Project.longitude.isnot(None))
        .all()
    )

    by_type: dict[str, list] = {}
    for row in rows:
        by_type.setdefault(row.project_type, []).append(row)

    for project_type, group in by_type.items():
        if len(group) < MIN_SAMPLES:
            continue

        coords_rad = np.radians([[r.latitude, r.longitude] for r in group])
        labels = DBSCAN(eps=EPS_KM / EARTH_RADIUS_KM, min_samples=MIN_SAMPLES, metric="haversine").fit_predict(coords_rad)

        clusters: dict[int, list] = {}
        for row, label in zip(group, labels):
            if label == -1:
                continue
            clusters.setdefault(label, []).append(row)

        for members in clusters.values():
            dates = [m.start_date for m in members]
            date_spread_days = (max(dates) - min(dates)).days
            if date_spread_days > MAX_DATE_SPREAD_DAYS:
                continue

            size_ratio = len(members) / MIN_SAMPLES
            severity = Severity.CRITICAL if size_ratio >= 3 else (Severity.HIGH if size_ratio >= 1.6 else Severity.MEDIUM)
            score = round(min(100.0, size_ratio * 30), 1)

            location_label = f"{members[0].state} / {members[0].district}"
            description = (
                f"{len(members)} {project_type.value.replace('_', ' ').title()} projects sanctioned within "
                f"{EPS_KM:.0f}km of each other in {location_label}, all within a {date_spread_days}-day window."
            )
            evidence = {
                "cluster_size": len(members),
                "date_spread_days": date_spread_days,
                "radius_km": EPS_KM,
                "project_type": project_type.value,
                "member_project_ids": [str(m.id) for m in members],
            }

            for m in members:
                signals.append((m.id, SignalDraft(
                    signal_type=SignalType.GEOGRAPHIC_CONCENTRATION,
                    severity=severity,
                    score=score,
                    confidence=0.9,
                    description=description,
                    evidence=evidence,
                )))

    return signals
