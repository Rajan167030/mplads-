from datetime import date

from app.nlp.similarity import (
    amount_similarity,
    contractor_similarity,
    date_similarity,
    haversine_km,
    location_similarity,
    phonetic_similarity,
    text_similarity,
    type_similarity,
)
from app.nlp.text_normalization import expand_abbreviations, full_normalize, romanized_phonetic_key


def test_text_similarity_identical_vectors_is_one():
    v = [1.0, 0.0, 0.0]
    assert text_similarity(v, v) == 1.0


def test_text_similarity_orthogonal_vectors_is_half():
    assert text_similarity([1.0, 0.0], [0.0, 1.0]) == 0.5


def test_haversine_known_distance():
    # Delhi to Mumbai is roughly 1150-1180 km great-circle.
    d = haversine_km(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1100 < d < 1250


def test_location_similarity_same_coordinates_is_one():
    assert location_similarity("Kerala", "Ernakulam", 10.0, 76.3, "Kerala", "Ernakulam", 10.0, 76.3) == 1.0


def test_location_similarity_far_apart_is_zero():
    score = location_similarity("Kerala", "Ernakulam", 10.0, 76.3, "Punjab", "Ludhiana", 30.9, 75.8)
    assert score == 0.0


def test_location_similarity_falls_back_to_district_match_without_coordinates():
    assert location_similarity("Kerala", "Ernakulam", None, None, "Kerala", "Ernakulam", None, None) == 0.9


def test_type_similarity():
    assert type_similarity("ROAD", "ROAD") == 1.0
    assert type_similarity("ROAD", "SCHOOL") == 0.0


def test_contractor_similarity_prefers_id_match():
    assert contractor_similarity("id-1", "id-1", "A Ltd", "B Ltd") == 1.0
    assert contractor_similarity("id-1", "id-2", "A Ltd", "B Ltd") == 0.0


def test_contractor_similarity_falls_back_to_name_when_no_ids():
    score = contractor_similarity(None, None, "Shree Constructions", "Shree Constructions")
    assert score == 1.0


def test_date_similarity_decays_with_distance():
    assert date_similarity(date(2025, 1, 1), date(2025, 1, 1)) == 1.0
    assert date_similarity(date(2025, 1, 1), date(2025, 4, 1)) < 0.5
    assert date_similarity(None, date(2025, 1, 1)) == 0.0


def test_amount_similarity_decays_with_relative_difference():
    assert amount_similarity(1_000_000, 1_000_000) == 1.0
    assert amount_similarity(1_000_000, 1_500_000) < amount_similarity(1_000_000, 1_050_000)
    assert amount_similarity(0, 1_000_000) == 0.0


def test_phonetic_similarity_folds_w_v_variants():
    score = phonetic_similarity("Samudayik Bhawan", "Samudayik Bhavan")
    assert score > 0.9


def test_expand_abbreviations():
    assert "road" in expand_abbreviations("Ring Rd Construction")
    assert "primary health centre" in expand_abbreviations("New PHC Building")


def test_full_normalize_strips_punctuation_and_expands():
    result = full_normalize("Community Hall - Govt. Sch. Rd")
    assert "government" in result
    assert "school" in result
    assert "road" in result
    assert "-" not in result


def test_romanized_phonetic_key_is_stable_for_spelling_variants():
    assert romanized_phonetic_key("Bhawan") == romanized_phonetic_key("Bhavan")
