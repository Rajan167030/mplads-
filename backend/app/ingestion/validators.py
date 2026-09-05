from app.models.enums import ProjectStatus, ProjectType

# Generous bounding box for mainland + island India — catches obviously wrong
# coordinates (0,0 placeholders, swapped lat/lon, digit-entry typos) without
# being a precise administrative boundary check.
INDIA_LAT_RANGE = (6.0, 38.0)
INDIA_LON_RANGE = (68.0, 98.0)


def validate_project(row: dict) -> list[str]:
    errors = []

    if not row.get("external_project_id"):
        errors.append("missing external_project_id")
    if not row.get("project_name"):
        errors.append("missing project_name")

    project_type = row.get("project_type")
    if not project_type or project_type.upper().replace(" ", "_") not in ProjectType.__members__:
        errors.append(f"unrecognized project_type: {project_type!r}")

    if not row.get("state"):
        errors.append("missing state")
    if not row.get("district"):
        errors.append("missing district")

    sanctioned = row.get("sanctioned_amount")
    if sanctioned is None or sanctioned <= 0:
        errors.append("missing or non-positive sanctioned_amount")

    start_date = row.get("start_date")
    expected_completion = row.get("expected_completion_date")
    if start_date is None:
        errors.append("missing or unparseable start_date")
    if expected_completion is None:
        errors.append("missing or unparseable expected_completion_date")
    if start_date and expected_completion and start_date > expected_completion:
        errors.append("start_date is after expected_completion_date")

    for field in ("physical_progress", "financial_progress"):
        value = row.get(field)
        if value is not None and not (0 <= value <= 100):
            errors.append(f"{field} out of range 0-100: {value}")

    status = row.get("status")
    if status and status.upper() not in ProjectStatus.__members__:
        errors.append(f"unrecognized status: {status!r}")

    return errors


def has_valid_location(row: dict) -> bool:
    lat, lon = row.get("latitude"), row.get("longitude")
    if lat is None or lon is None:
        return False
    return INDIA_LAT_RANGE[0] <= lat <= INDIA_LAT_RANGE[1] and INDIA_LON_RANGE[0] <= lon <= INDIA_LON_RANGE[1]
