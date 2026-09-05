"""Column-mapping layer: tolerates header variants a real government CSV export
might use, and maps them onto the canonical field names the rest of the
pipeline works with. Not ML-based schema detection — an explicit alias table,
which is honest about what it does and easy for an analyst to extend."""

import pandas as pd

# canonical field -> acceptable header spellings (case-insensitive, whitespace-trimmed)
PROJECT_COLUMNS: dict[str, list[str]] = {
    "external_project_id": ["Project ID", "Project Id", "Sanction ID", "Sanction No"],
    "project_name": ["Project Name", "Name of Work", "Work Name"],
    "description": ["Description", "Work Description"],
    "project_type": ["Type", "Project Type", "Category"],
    "state": ["State"],
    "district": ["District"],
    "constituency": ["Constituency", "PC", "Parliamentary Constituency"],
    "latitude": ["Latitude", "Lat"],
    "longitude": ["Longitude", "Lon", "Long"],
    "sanctioned_amount": ["Sanctioned Amount", "Sanctioned Amt", "Amount Sanctioned"],
    "estimated_cost": ["Estimated Cost", "Estimate Cost", "Est. Cost"],
    "released_amount": ["Released Amount", "Amount Released", "Fund Released"],
    "expenditure_amount": ["Expenditure Amount", "Amount Spent", "Expenditure"],
    "start_date": ["Start Date", "Date of Start", "Commencement Date"],
    "expected_completion_date": ["Expected Completion", "Expected Completion Date", "Target Date"],
    "actual_completion_date": ["Actual Completion", "Actual Completion Date", "Completion Date"],
    "physical_progress": ["Physical Progress (%)", "Physical Progress", "Physical %"],
    "financial_progress": ["Financial Progress (%)", "Financial Progress", "Financial %"],
    "status": ["Status", "Project Status"],
    "contractor_name": ["Contractor Name", "Contractor", "Agency/Contractor"],
    "implementing_agency": ["Implementing Agency", "Agency", "Executing Agency"],
}

REQUIRED_PROJECT_FIELDS = [
    "external_project_id", "project_name", "project_type", "state", "district",
    "sanctioned_amount", "start_date", "expected_completion_date",
]

CONTRACTOR_COLUMNS = {"name": ["name", "Name", "Contractor Name"], "state": ["state", "State"], "district": ["district", "District"]}
AGENCY_COLUMNS = {"name": ["name", "Name"], "level": ["level", "Level"], "state": ["state", "State"], "district": ["district", "District"]}

PAYMENT_COLUMNS = {
    "external_project_id": ["Project ID"],
    "amount": ["Amount"],
    "payment_date": ["Payment Date"],
    "payment_type": ["Payment Type"],
    "payment_status": ["Payment Status"],
    "recipient": ["Recipient"],
    "transaction_reference": ["Transaction Reference"],
}

MILESTONE_COLUMNS = {
    "external_project_id": ["Project ID"],
    "name": ["Milestone Name"],
    "expected_date": ["Expected Date"],
    "actual_date": ["Actual Date"],
    "expected_progress": ["Expected Progress"],
    "actual_progress": ["Actual Progress"],
    "status": ["Status"],
}

INSPECTION_COLUMNS = {
    "external_project_id": ["Project ID"],
    "inspection_date": ["Inspection Date"],
    "inspector": ["Inspector"],
    "reported_progress": ["Reported Progress"],
    "remarks": ["Remarks"],
    "location": ["Location"],
}

EVIDENCE_COLUMNS = {
    "external_project_id": ["Project ID"],
    "type": ["Type"],
    "file_reference": ["File Reference"],
    "description": ["Description"],
    "captured_at": ["Captured At"],
    "source": ["Source"],
    "hash": ["Hash"],
}


def map_columns(df: pd.DataFrame, column_map: dict[str, list[str]], required: list[str] | None = None) -> pd.DataFrame:
    lower_lookup = {c.strip().lower(): c for c in df.columns}
    rename = {}
    missing_required = []

    for canonical, aliases in column_map.items():
        found = next((lower_lookup[a.strip().lower()] for a in aliases if a.strip().lower() in lower_lookup), None)
        if found:
            rename[found] = canonical
        elif required and canonical in required:
            missing_required.append(canonical)

    if missing_required:
        raise ValueError(f"Missing required columns: {missing_required}")

    return df.rename(columns=rename)[[c for c in rename.values()]]
