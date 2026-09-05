"""Multilingual entity resolution (spec §7): embeds project names with a
multilingual model, retrieves same-type candidates by embedding similarity,
scores six independent features per candidate pair, and persists MATCH /
POSSIBLE_MATCH verdicts to EntityMatch. DIFFERENT pairs are never stored —
they're the overwhelming majority once candidates are type-filtered, and
storing them would just be noise.

Never treats embedding similarity alone as identity — see compute_match.
"""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entity_match import EntityMatch
from app.models.enums import MatchVerdict
from app.models.ingestion_report import IngestionReport
from app.models.project import Project
from app.nlp.embeddings import embed_texts
from app.nlp.similarity import (
    amount_similarity,
    contractor_similarity,
    date_similarity,
    location_similarity,
    phonetic_similarity,
    text_similarity,
    type_similarity,
)
from app.nlp.text_normalization import full_normalize

EMBEDDING_BATCH_SIZE = 256
CANDIDATE_TOP_K = 10

MATCH_THRESHOLD = 0.85
POSSIBLE_MATCH_THRESHOLD = 0.65

# Candidates are pre-filtered to same district + type (see find_candidates), so
# type/location are near-constant across candidates and carry little
# discriminating power — weight is deliberately light on both. What actually
# separates a genuine duplicate from two unrelated same-type projects in the
# same district is whether their dates and costs line up, so those carry the
# most weight alongside text similarity.
FEATURE_WEIGHTS = {
    "text_similarity": 0.25,
    "phonetic_similarity": 0.05,
    "location_similarity": 0.10,
    "type_similarity": 0.05,
    "contractor_similarity": 0.15,
    "date_similarity": 0.20,
    "amount_similarity": 0.20,
}


@dataclass
class ResolutionReport:
    embeddings_computed: int = 0
    projects_considered: int = 0
    pairs_evaluated: int = 0
    matches: int = 0
    possible_matches: int = 0
    errors: list[str] = field(default_factory=list)


def compute_and_store_embeddings(db: Session, batch_size: int = EMBEDDING_BATCH_SIZE) -> int:
    projects = db.scalars(select(Project).where(Project.name_embedding.is_(None))).all()
    updated = 0
    for i in range(0, len(projects), batch_size):
        batch = projects[i:i + batch_size]
        texts = [full_normalize(p.project_name) for p in batch]
        vectors = embed_texts(texts)
        for project, vector in zip(batch, vectors):
            project.name_embedding = vector.tolist()
        db.commit()
        updated += len(batch)
    return updated


def find_candidates(db: Session, project: Project, top_k: int = CANDIDATE_TOP_K) -> list[Project]:
    """Same project_type AND same district — a duplicate MPLADS sanction is,
    definitionally, the same physical work reported twice in the same local
    area. Restricting to district also matters for precision: MPLADS project
    names are heavily templated ("{type} - {locality}"), so type alone lets
    embedding similarity be dominated by boilerplate phrasing rather than
    genuine identity — see docs/decisions.md ADR-003."""
    if project.name_embedding is None:
        return []
    stmt = (
        select(Project)
        .where(
            Project.id != project.id,
            Project.project_type == project.project_type,
            Project.district == project.district,
            Project.state == project.state,
            Project.name_embedding.isnot(None),
        )
        .order_by(Project.name_embedding.cosine_distance(project.name_embedding))
        .limit(top_k)
    )
    return list(db.scalars(stmt).all())


def compute_match(project_a: Project, project_b: Project) -> dict:
    features = {
        "text_similarity": text_similarity(project_a.name_embedding, project_b.name_embedding),
        "phonetic_similarity": phonetic_similarity(project_a.project_name, project_b.project_name),
        "location_similarity": location_similarity(
            project_a.state, project_a.district, project_a.latitude, project_a.longitude,
            project_b.state, project_b.district, project_b.latitude, project_b.longitude,
        ),
        "type_similarity": type_similarity(project_a.project_type, project_b.project_type),
        "contractor_similarity": contractor_similarity(
            project_a.contractor_id, project_b.contractor_id,
            project_a.contractor.name if project_a.contractor else None,
            project_b.contractor.name if project_b.contractor else None,
        ),
        "date_similarity": date_similarity(project_a.start_date, project_b.start_date),
        "amount_similarity": amount_similarity(float(project_a.sanctioned_amount), float(project_b.sanctioned_amount)),
    }
    confidence = sum(features[k] * w for k, w in FEATURE_WEIGHTS.items())

    if confidence >= MATCH_THRESHOLD:
        verdict = MatchVerdict.MATCH
    elif confidence >= POSSIBLE_MATCH_THRESHOLD:
        verdict = MatchVerdict.POSSIBLE_MATCH
    else:
        verdict = MatchVerdict.DIFFERENT

    return {"confidence": round(confidence, 4), "verdict": verdict, "features": {k: round(v, 4) for k, v in features.items()}}


def run_entity_resolution(db: Session, top_k: int = CANDIDATE_TOP_K) -> ResolutionReport:
    report = ResolutionReport()
    report.embeddings_computed = compute_and_store_embeddings(db)

    # Clear prior matches so re-running is idempotent rather than accumulating duplicates.
    db.query(EntityMatch).delete()
    db.commit()

    projects = db.scalars(select(Project).where(Project.name_embedding.isnot(None))).all()
    report.projects_considered = len(projects)

    seen_pairs: set[tuple[uuid.UUID, uuid.UUID]] = set()
    to_insert = []

    for project in projects:
        candidates = find_candidates(db, project, top_k=top_k)
        for candidate in candidates:
            pair_key = tuple(sorted((project.id, candidate.id), key=str))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            report.pairs_evaluated += 1

            result = compute_match(project, candidate)
            if result["verdict"] == MatchVerdict.DIFFERENT:
                continue

            to_insert.append(EntityMatch(
                source_project_id=pair_key[0],
                matched_project_id=pair_key[1],
                match_confidence=result["confidence"],
                verdict=result["verdict"],
                matching_features=result["features"],
            ))
            if result["verdict"] == MatchVerdict.MATCH:
                report.matches += 1
            else:
                report.possible_matches += 1

    for i in range(0, len(to_insert), 500):
        db.add_all(to_insert[i:i + 500])
        db.commit()

    _update_latest_ingestion_report(db, report.matches, report.possible_matches)
    return report


def _update_latest_ingestion_report(db: Session, matches: int, uncertain: int) -> None:
    latest = db.query(IngestionReport).order_by(IngestionReport.created_at.desc()).first()
    if latest:
        latest.entity_matches = matches
        latest.uncertain_matches = uncertain
        db.commit()
