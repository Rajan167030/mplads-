"""Per-feature similarity scores used for entity-resolution match confidence
(spec §7). Each returns a float in [0, 1]. Combined and weighted in
app.nlp.entity_resolution — kept separate here so every score is individually
inspectable/testable and gets stored verbatim in EntityMatch.matching_features
for explainability.
"""

import math
from difflib import SequenceMatcher

import numpy as np

from app.nlp.text_normalization import romanized_phonetic_key


def text_similarity(embedding_a: list[float], embedding_b: list[float]) -> float:
    a, b = np.asarray(embedding_a), np.asarray(embedding_b)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    cosine = float(np.dot(a, b) / denom)
    return max(0.0, min(1.0, (cosine + 1) / 2))  # cosine in [-1,1] -> [0,1]


def phonetic_similarity(name_a: str, name_b: str) -> float:
    """Extra signal for same-script spelling variants; embeddings already
    capture cross-script semantic similarity, this catches things like
    'Bhawan' vs 'Bhavan' that embeddings alone may under-weight."""
    key_a, key_b = romanized_phonetic_key(name_a), romanized_phonetic_key(name_b)
    if not key_a or not key_b:
        return 0.0
    return SequenceMatcher(None, key_a, key_b).ratio()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def location_similarity(
    state_a: str, district_a: str, lat_a: float | None, lon_a: float | None,
    state_b: str, district_b: str, lat_b: float | None, lon_b: float | None,
) -> float:
    if lat_a is not None and lon_a is not None and lat_b is not None and lon_b is not None:
        distance_km = haversine_km(lat_a, lon_a, lat_b, lon_b)
        if distance_km <= 2:
            return 1.0
        if distance_km >= 50:
            return 0.0
        return 1.0 - (distance_km - 2) / 48
    if state_a == state_b and district_a == district_b:
        return 0.9  # same district, no coordinates to refine with
    if state_a == state_b:
        return 0.3
    return 0.0


def type_similarity(type_a: str, type_b: str) -> float:
    return 1.0 if type_a == type_b else 0.0


def contractor_similarity(contractor_id_a, contractor_id_b, name_a: str | None, name_b: str | None) -> float:
    if contractor_id_a is not None and contractor_id_b is not None:
        return 1.0 if contractor_id_a == contractor_id_b else 0.0
    if name_a and name_b:
        return SequenceMatcher(None, name_a.lower(), name_b.lower()).ratio()
    return 0.0


def date_similarity(date_a, date_b, decay_days: int = 90) -> float:
    if not date_a or not date_b:
        return 0.0
    diff_days = abs((date_a - date_b).days)
    return max(0.0, 1.0 - diff_days / decay_days)


def amount_similarity(amount_a: float, amount_b: float, decay_fraction: float = 0.5) -> float:
    if not amount_a or not amount_b:
        return 0.0
    relative_diff = abs(amount_a - amount_b) / max(amount_a, amount_b)
    return max(0.0, 1.0 - relative_diff / decay_fraction)
