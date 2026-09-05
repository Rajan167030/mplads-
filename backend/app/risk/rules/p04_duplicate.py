"""P04 — Duplicate / Similar Project (spec §8).

Doesn't fit the per-project `detect(project, context)` shape the other rules
use — it reuses Phase 3's EntityMatch table directly (multilingual embeddings
+ location/contractor/date/amount scoring) rather than recomputing similarity
here. A MATCH/POSSIBLE_MATCH pair produces a signal on *both* projects, since
either could be the one under investigation.
"""

import uuid

from sqlalchemy.orm import Session

from app.models.entity_match import EntityMatch
from app.models.enums import MatchVerdict, Severity, SignalType
from app.risk.rules.base import SignalDraft

SEVERITY_BY_VERDICT = {
    MatchVerdict.MATCH: Severity.HIGH,
    MatchVerdict.POSSIBLE_MATCH: Severity.MEDIUM,
}


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    matches = db.query(EntityMatch).filter(EntityMatch.verdict != MatchVerdict.DIFFERENT).all()
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    for match in matches:
        severity = SEVERITY_BY_VERDICT[match.verdict]
        score = round(match.match_confidence * 100, 1)
        description = (
            f"{'Likely' if match.verdict == MatchVerdict.MATCH else 'Possible'} duplicate of another project "
            f"(confidence {match.match_confidence:.2f}) — matched on name similarity, location, and other "
            f"project attributes."
        )
        evidence = {
            "matched_project_id": None,  # filled per-side below
            "match_confidence": match.match_confidence,
            "verdict": match.verdict.value,
            "matching_features": match.matching_features,
        }

        for this_id, other_id in ((match.source_project_id, match.matched_project_id),
                                   (match.matched_project_id, match.source_project_id)):
            signals.append((this_id, SignalDraft(
                signal_type=SignalType.POSSIBLE_DUPLICATE,
                severity=severity,
                score=score,
                confidence=match.match_confidence,
                description=description,
                evidence={**evidence, "matched_project_id": str(other_id)},
            )))

    return signals
