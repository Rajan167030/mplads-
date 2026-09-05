"""Relationship queries over the relational schema (spec §12). No separate
graph database — at this scale, Postgres joins plus a PostGIS proximity query
answer the same questions a graph traversal would, without syncing a second
store. "Related projects" combines four independent relationship types so
the caller can see *why* two projects are connected, not just that they are.
"""

import uuid
from dataclasses import dataclass, field

from geoalchemy2 import Geography
from sqlalchemy import cast, func, or_, select
from sqlalchemy.orm import Session

from app.models.contractor import Contractor
from app.models.entity_match import EntityMatch
from app.models.project import Project

DEFAULT_NEARBY_RADIUS_KM = 5.0
DEFAULT_RELATED_LIMIT = 10


@dataclass
class RelatedProject:
    project: Project
    relationship_types: list[str] = field(default_factory=list)
    distance_km: float | None = None


@dataclass
class ContractorNetworkEntry:
    contractor: Contractor
    shared_context_count: int
    contexts: list[tuple[str, str]] = field(default_factory=list)


def find_nearby_projects(
    db: Session, project: Project, radius_km: float = DEFAULT_NEARBY_RADIUS_KM, limit: int = 20
) -> list[tuple[Project, float]]:
    """Projects within radius_km of this one (excluding itself), nearest
    first. Casts to geography so the radius is real kilometers, not degrees.

    The reference point is looked up via a scalar subquery rather than
    binding `project.geom` (a loaded WKBElement) directly as a query
    parameter — GeoAlchemy2 has no way to know that value should serialize as
    EWKB rather than WKT once it's a bare Python object in a `cast(...)`, and
    binding it directly raises "parse error - invalid geometry" in Postgres.
    """
    if project.geom is None:
        return []

    project_geog = (
        select(cast(Project.geom, Geography)).where(Project.id == project.id).scalar_subquery()
    )
    distance_m = func.ST_Distance(cast(Project.geom, Geography), project_geog)

    rows = (
        db.query(Project, distance_m.label("distance_m"))
        .filter(Project.id != project.id)
        .filter(func.ST_DWithin(cast(Project.geom, Geography), project_geog, radius_km * 1000))
        .order_by("distance_m")
        .limit(limit)
        .all()
    )
    return [(p, round(d / 1000, 3)) for p, d in rows]


def find_related_projects(db: Session, project: Project, limit: int = DEFAULT_RELATED_LIMIT) -> list[RelatedProject]:
    related: dict[uuid.UUID, RelatedProject] = {}

    def add(other: Project, relationship: str, distance_km: float | None = None) -> None:
        entry = related.setdefault(other.id, RelatedProject(project=other))
        if relationship not in entry.relationship_types:
            entry.relationship_types.append(relationship)
        if distance_km is not None:
            entry.distance_km = distance_km

    if project.contractor_id:
        same_contractor = (
            db.query(Project)
            .filter(Project.contractor_id == project.contractor_id, Project.id != project.id)
            .limit(limit)
            .all()
        )
        for other in same_contractor:
            add(other, "SAME_CONTRACTOR")

    if project.implementing_agency_id:
        same_agency = (
            db.query(Project)
            .filter(Project.implementing_agency_id == project.implementing_agency_id, Project.id != project.id)
            .limit(limit)
            .all()
        )
        for other in same_agency:
            add(other, "SAME_AGENCY")

    matches = (
        db.query(EntityMatch)
        .filter(or_(EntityMatch.source_project_id == project.id, EntityMatch.matched_project_id == project.id))
        .all()
    )
    for m in matches:
        other_id = m.matched_project_id if m.source_project_id == project.id else m.source_project_id
        other = db.get(Project, other_id)
        if other:
            add(other, f"ENTITY_{m.verdict.value}")

    for other, distance_km in find_nearby_projects(db, project, radius_km=DEFAULT_NEARBY_RADIUS_KM, limit=limit):
        if other.project_type == project.project_type:
            add(other, "NEARBY_SAME_TYPE", distance_km)

    results = list(related.values())
    results.sort(key=lambda r: (-len(r.relationship_types), r.distance_km if r.distance_km is not None else 999.0))
    return results[:limit]


def get_contractor_network(db: Session, contractor: Contractor, limit: int = 10) -> list[ContractorNetworkEntry]:
    """Other contractors repeatedly operating in the same district + project
    type niches as this one. A proxy for a real corporate-registry network
    (shared directors, registered addresses) that this dataset doesn't have —
    two contractors persistently competing for/rotating through the same
    narrow niche is itself a mild, honestly-labeled signal, not a fabricated
    connection dressed up as something stronger."""
    own_contexts = (
        db.query(Project.district, Project.project_type)
        .filter(Project.contractor_id == contractor.id)
        .distinct()
        .all()
    )
    if not own_contexts:
        return []

    entries: dict[uuid.UUID, ContractorNetworkEntry] = {}
    for district, ptype in own_contexts:
        peers = (
            db.query(Contractor)
            .join(Project, Project.contractor_id == Contractor.id)
            .filter(Project.district == district, Project.project_type == ptype, Contractor.id != contractor.id)
            .distinct()
            .all()
        )
        for other in peers:
            entry = entries.setdefault(other.id, ContractorNetworkEntry(contractor=other, shared_context_count=0))
            entry.contexts.append((district, ptype.value))
            entry.shared_context_count += 1

    results = list(entries.values())
    results.sort(key=lambda e: -e.shared_context_count)
    return results[:limit]


def get_top_risk_contractor_network(
    db: Session, limit: int = 15
) -> tuple[list[Contractor], list[tuple[uuid.UUID, uuid.UUID, int, list[tuple[str, str]]]]]:
    """Nodes/edges for the Overview page's network graph: the highest-risk
    contractors, linked when they share a district+project-type niche (the
    same proxy signal as get_contractor_network, restricted so the graph
    only shows connections *within* this already-flagged set rather than
    pulling in every peer of every peer, which would balloon into an
    unreadable hairball)."""
    contractors = (
        db.query(Contractor)
        .filter(Contractor.risk_score.isnot(None))
        .order_by(Contractor.risk_score.desc())
        .limit(limit)
        .all()
    )
    if not contractors:
        return [], []

    ids = [c.id for c in contractors]
    contexts_by_contractor = (
        db.query(Project.contractor_id, Project.district, Project.project_type)
        .filter(Project.contractor_id.in_(ids))
        .distinct()
        .all()
    )
    by_context: dict[tuple[str, str], list[uuid.UUID]] = {}
    for contractor_id, district, ptype in contexts_by_contractor:
        by_context.setdefault((district, ptype.value), []).append(contractor_id)

    edges: dict[tuple[uuid.UUID, uuid.UUID], dict] = {}
    for context, contractor_ids in by_context.items():
        unique_ids = sorted(set(contractor_ids), key=str)
        for i in range(len(unique_ids)):
            for j in range(i + 1, len(unique_ids)):
                a, b = unique_ids[i], unique_ids[j]
                entry = edges.setdefault((a, b), {"weight": 0, "contexts": []})
                entry["weight"] += 1
                entry["contexts"].append(context)

    edge_list = [(a, b, e["weight"], e["contexts"]) for (a, b), e in edges.items()]
    return contractors, edge_list
