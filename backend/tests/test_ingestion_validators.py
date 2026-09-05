from datetime import date

from app.ingestion.normalizers import normalize_name_key, normalize_text, parse_date, parse_float
from app.ingestion.validators import has_valid_location, validate_project


def make_valid_row(**overrides) -> dict:
    row = {
        "external_project_id": "MP-TEST-0001",
        "project_name": "Community Hall – Testville",
        "project_type": "COMMUNITY_HALL",
        "state": "Kerala",
        "district": "Ernakulam",
        "sanctioned_amount": 900_000.0,
        "start_date": date(2025, 1, 1),
        "expected_completion_date": date(2025, 7, 1),
        "physical_progress": 50.0,
        "financial_progress": 55.0,
        "status": "ONGOING",
        "latitude": 10.0,
        "longitude": 76.3,
    }
    row.update(overrides)
    return row


def test_valid_row_has_no_errors():
    assert validate_project(make_valid_row()) == []


def test_missing_required_fields_are_flagged():
    errors = validate_project(make_valid_row(state=None, district=None, sanctioned_amount=None))
    assert any("state" in e for e in errors)
    assert any("district" in e for e in errors)
    assert any("sanctioned_amount" in e for e in errors)


def test_unrecognized_project_type_is_flagged():
    errors = validate_project(make_valid_row(project_type="SPACESHIP_LAUNCHPAD"))
    assert any("project_type" in e for e in errors)


def test_start_after_expected_completion_is_flagged():
    errors = validate_project(make_valid_row(start_date=date(2025, 8, 1), expected_completion_date=date(2025, 1, 1)))
    assert any("after expected_completion_date" in e for e in errors)


def test_progress_out_of_range_is_flagged():
    errors = validate_project(make_valid_row(physical_progress=150.0))
    assert any("physical_progress" in e for e in errors)


def test_has_valid_location():
    assert has_valid_location({"latitude": 10.0, "longitude": 76.3}) is True
    assert has_valid_location({"latitude": None, "longitude": None}) is False
    assert has_valid_location({"latitude": 0.0, "longitude": 0.0}) is False  # outside India bbox


def test_normalize_text_treats_placeholders_as_missing():
    assert normalize_text("  Kerala  ") == "Kerala"
    assert normalize_text("N/A") is None
    assert normalize_text("") is None
    assert normalize_text(None) is None


def test_normalize_name_key_is_case_and_punctuation_insensitive():
    assert normalize_name_key("Shree Constructions Pvt. Ltd.") == normalize_name_key("shree constructions pvt ltd")


def test_parse_date_accepts_multiple_formats():
    assert parse_date("2025-01-31") == date(2025, 1, 31)
    assert parse_date("31-01-2025") == date(2025, 1, 31)
    assert parse_date("not-a-date") is None


def test_parse_float_handles_commas_and_blanks():
    assert parse_float("12,34,000") == 1234000.0
    assert parse_float("") is None
    assert parse_float(None) is None
