"""Distance between a freshly-submitted (not-yet-persisted) lat/lng and a
project's stored geom — used to geo-verify citizen complaints. Follows the
same cast-to-Geography approach as app.graph.relationships.find_nearby_projects,
but the reference point here is built from raw floats via ST_MakePoint rather
than looked up from a stored row, since the complaint doesn't exist yet.
"""

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from app.models.project import Project

COMPLAINT_VERIFICATION_RADIUS_M = 200


def distance_to_project_m(db: Session, project: Project, latitude: float, longitude: float) -> float | None:
    """Meters between (latitude, longitude) and the project's geom, or None
    if the project has no stored location to check against."""
    if project.geom is None:
        return None

    submitted_point = cast(func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326), Geography)
    distance_m = db.scalar(
        select(func.ST_Distance(cast(Project.geom, Geography), submitted_point)).where(Project.id == project.id)
    )
    return float(distance_m) if distance_m is not None else None
