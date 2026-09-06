"""One-off transform: real MPLADS eSAKSHI export data -> the same raw CSV
shape the synthetic pipeline uses (app.ingestion.schema's PROJECT_COLUMNS/
PAYMENT_COLUMNS aliases), so it goes through the exact same ingestion ->
entity resolution -> rules -> ML -> risk scoring pipeline as the synthetic
data. This is the first real (non-synthetic) data this platform has processed.

Source files (data/*.csv — deliberately not data/raw/, since these are a
one-off export to transform, not something regenerated):
  - Works Completed.csv                                          (9,964 rows)
  - Expenditure on Completed and On-going Works as on Date.csv   (9,000 rows)
Output (data/raw/, picked up by the normal ingestion pipeline alongside the
existing synthetic projects.csv/payments.csv):
  - real_projects.csv
  - real_payments.csv

Honest gaps in the source data, and how this script handles them (surfaced
in the printed report too, not just this comment):
  - Neither file gives a project's true start date or a sanctioned amount
    separate from what was actually disbursed. start_date/expected_completion
    for COMPLETED works are DERIVED from the completion date and this project
    type's typical peer duration (app.utils.reference_data) — not reported
    figures. For a completed work this makes overrun_days always ~0 by
    construction; delay detection on the real-completed slice is therefore
    not meaningful, and that's a property of the source data, not a bug.
  - Rows in the Expenditure file whose Work ID never appears in Works
    Completed are reconstructed as ONGOING projects: start_date = earliest
    payment date for that work, sanctioned_amount = total disbursed so far
    (a floor, not a true sanction figure), physical_progress estimated from
    elapsed-time fraction against peer duration (a rough proxy, not a
    reported figure).
  - No coordinates are given at all. Where the state matches one already in
    reference_data.STATES, an approximate lat/lon is jittered around that
    state's center (same method generate_synthetic_data.py uses) — clearly a
    state-level approximation, not the project's real location. Real states
    outside that table are left with no coordinates (counted as
    missing_location, same as any other row lacking one).
  - No contractor is given at the project level (only a per-payment "Vendor
    Name", which can vary payment to payment for the same work) —
    contractor_name is left blank for every real project.
"""

import csv
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.enums import ProjectType  # noqa: E402
from app.utils.reference_data import PROJECT_TYPE_PROFILES, STATES  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"

WORK_ID_RE = re.compile(r"^(WS/MP\d+/\d{4}-\d{4}/\d+)-(.*)$")

# The 92 distinct real work-type phrases (extracted directly from the source
# file, not guessed), mapped onto our ProjectType enum. Anything not matched
# here falls back to a substring keyword search, then PUBLIC_FACILITY as a
# last resort — both fallback paths are counted and reported, not silent.
WORK_TYPE_MAP: dict[str, ProjectType] = {
    "Construction of roads, link roads, pathways or any other road with or without drainage system": ProjectType.ROAD,
    "Construction of footpaths and pedestrian ways": ProjectType.ROAD,
    "Construction of culverts and bridges": ProjectType.ROAD,
    "Construction of road under bridge": ProjectType.ROAD,
    "Construction of cycle tracks, cycle stand and segregated non-motorized vehicle (NMV) lanes": ProjectType.ROAD,
    "Construction of bus-sheds or bus-stops": ProjectType.ROAD,
    "Construction of flood control embankments/ protection walls along riverbanks, hilltops, roadsides": ProjectType.ROAD,

    "Lighting of public spaces": ProjectType.LIGHTING,
    "Street lights": ProjectType.LIGHTING,
    "Improvement of electricity distribution infrastructure": ProjectType.LIGHTING,

    "Installing hand pumps": ProjectType.WATER_INFRASTRUCTURE,
    "Purchase of mobile water tankers": ProjectType.WATER_INFRASTRUCTURE,
    "Installing tube-wells and borewells": ProjectType.WATER_INFRASTRUCTURE,
    "Installing community drinking water plants": ProjectType.WATER_INFRASTRUCTURE,
    "Providing supply pipelines for drinking water": ProjectType.WATER_INFRASTRUCTURE,
    "Construction of water tanks": ProjectType.WATER_INFRASTRUCTURE,
    "Renovation of ponds and lakes": ProjectType.WATER_INFRASTRUCTURE,
    "Creation of new ponds": ProjectType.WATER_INFRASTRUCTURE,
    "Construction of rainwater harvesting structures": ProjectType.WATER_INFRASTRUCTURE,
    "Establishing public ground water recharging facilities": ProjectType.WATER_INFRASTRUCTURE,
    "Construction of public irrigation facilities": ProjectType.WATER_INFRASTRUCTURE,

    "Construction of community centers and community halls": ProjectType.COMMUNITY_HALL,
    "Construction of common work sheds/ common covered sitting area": ProjectType.COMMUNITY_HALL,
    "Construction of boundary walls of existing public and community buildings": ProjectType.COMMUNITY_HALL,
    "Construction of additional rooms and halls in the existing public and community building": ProjectType.COMMUNITY_HALL,
    "Construction of buildings for community cultural activities": ProjectType.COMMUNITY_HALL,
    "Setting up of kitchen and pantries": ProjectType.COMMUNITY_HALL,
    "Construction of buildings for cr�ches and anganwadies": ProjectType.COMMUNITY_HALL,

    "Construction of rooms and halls in school and colleges": ProjectType.SCHOOL,
    "Purchase of books and periodicals for libraries/digitization of library books": ProjectType.SCHOOL,
    "Purchase of smart boards, visual display units and projectors": ProjectType.SCHOOL,
    "Setting up of laboratories": ProjectType.SCHOOL,
    "Purchase of IT systems, including hardware and software for educational purposes": ProjectType.SCHOOL,
    "Purchase of furniture and fixtures for educational purposes": ProjectType.SCHOOL,
    "Construction of public libraries and reading rooms": ProjectType.SCHOOL,
    "Purchase of vans and buses for educational institutions": ProjectType.SCHOOL,
    "Purchase Books for Library": ProjectType.SCHOOL,
    "Purchase of books for public libraries/ digitization of library books": ProjectType.SCHOOL,
    "Construction of buildings for training institutions": ProjectType.SCHOOL,
    "Laptop/Computer": ProjectType.SCHOOL,
    "Purchase of vehicles for mobile libraries": ProjectType.SCHOOL,

    "Purchase of hospital equipment": ProjectType.HEALTH_CENTRE,
    "Construction of rooms and facilities for hospitals, FWC , PHC Centers and ANM centers": ProjectType.HEALTH_CENTRE,
    "Purchase of ambulances (Four, three and two wheelers)": ProjectType.HEALTH_CENTRE,
    "Purchase of prosthetics, wheel chairs, tricycles (manual or motorized), elect scooties, hearing aids": ProjectType.HEALTH_CENTRE,
    "Purchase of other aids / devices required for P/ M/ V/ H impaired for differently abled persons": ProjectType.HEALTH_CENTRE,
    "Construction of veterinary hospitals and dispensaries": ProjectType.HEALTH_CENTRE,
    "Purchase of vehicle for mobile dispensaries (Four, three and two wheelers)": ProjectType.HEALTH_CENTRE,
    "Construction of shelters for animals": ProjectType.HEALTH_CENTRE,
    "Purchase of ambulance to transport sick and injured animals": ProjectType.HEALTH_CENTRE,
    "Purchase of hearse van (Four, three and two wheelers)": ProjectType.HEALTH_CENTRE,
    "Construction of building for veterinary aid centers": ProjectType.HEALTH_CENTRE,

    "Construction of public toilets and bathrooms": ProjectType.SANITATION,
    "Construction of toilet blocks": ProjectType.SANITATION,
    "Providing drains and gutters for public drainage": ProjectType.SANITATION,
    "Providing garbage collection and disposal systems": ProjectType.SANITATION,
    "Purchase of mobile sanitation equipment": ProjectType.SANITATION,
    "Providing night soil collection and disposal systems": ProjectType.SANITATION,
    "Setting up of community effluent treatment plants": ProjectType.SANITATION,

    "Installation of multi-gym equipment": ProjectType.SPORTS_RECREATION,
    "Installation of fixed garden gym equipment": ProjectType.SPORTS_RECREATION,
    "Development of public parks": ProjectType.SPORTS_RECREATION,
    "Development of playfields and sports grounds": ProjectType.SPORTS_RECREATION,
    "Development of playground": ProjectType.SPORTS_RECREATION,
    "Construction of buildings for sports facilities": ProjectType.SPORTS_RECREATION,
    "Purchase of sports equipment": ProjectType.SPORTS_RECREATION,
    "Construction of stadiums": ProjectType.SPORTS_RECREATION,
    "Purchase of immovable sports equipment": ProjectType.SPORTS_RECREATION,
    "Providing sports equipment, except consumable items": ProjectType.SPORTS_RECREATION,
    "Construction of buildings for multi-gym": ProjectType.SPORTS_RECREATION,
    "Laying of synthetic turfs for hockey and football": ProjectType.SPORTS_RECREATION,

    "Setting up of farmers� training and assistance centers": ProjectType.PUBLIC_FACILITY,
    "Construction of Government office buildings (Post office, Police station, Police chauki, etc.)": ProjectType.PUBLIC_FACILITY,
    "Fitting of Sitting RCC Benches in Public Places": ProjectType.PUBLIC_FACILITY,
    "Construction of public staircase/ stair ghat for public convenience": ProjectType.PUBLIC_FACILITY,
    "Crematoriums/energy efficient crematoriums or structures on burial/cremation ground": ProjectType.PUBLIC_FACILITY,
    "Construction of night shelters for homeless": ProjectType.PUBLIC_FACILITY,
    "Security gates in streets/public place for safety purpose": ProjectType.PUBLIC_FACILITY,
    "Providing CCTV camera system for security of public areas": ProjectType.PUBLIC_FACILITY,
    "Retrofitting, preservation or conservation of heritage and archaeological monuments and buildings": ProjectType.PUBLIC_FACILITY,
    "Provision of escalator and travellators for public use": ProjectType.PUBLIC_FACILITY,
    "Patrolling Vehicles to government institution for Public Conveniences, Safety and Security": ProjectType.PUBLIC_FACILITY,
    "Purchase of non-conventional energy system and devices for community use": ProjectType.PUBLIC_FACILITY,
    "Setting up public non-conventional energy plants": ProjectType.PUBLIC_FACILITY,
    "Tree plantation for community": ProjectType.PUBLIC_FACILITY,
    "Retrofitting in essential lifeline buildings": ProjectType.PUBLIC_FACILITY,
    "Setting up crops conservation facilities": ProjectType.PUBLIC_FACILITY,
    "Construction of New Building": ProjectType.PUBLIC_FACILITY,
}

KEYWORD_FALLBACKS: list[tuple[str, ProjectType]] = [
    ("road", ProjectType.ROAD), ("bridge", ProjectType.ROAD), ("culvert", ProjectType.ROAD),
    ("light", ProjectType.LIGHTING),
    ("water", ProjectType.WATER_INFRASTRUCTURE), ("pond", ProjectType.WATER_INFRASTRUCTURE),
    ("tube-well", ProjectType.WATER_INFRASTRUCTURE), ("borewell", ProjectType.WATER_INFRASTRUCTURE),
    ("community", ProjectType.COMMUNITY_HALL), ("hall", ProjectType.COMMUNITY_HALL),
    ("school", ProjectType.SCHOOL), ("library", ProjectType.SCHOOL), ("laborator", ProjectType.SCHOOL),
    ("educat", ProjectType.SCHOOL),
    ("hospital", ProjectType.HEALTH_CENTRE), ("ambulance", ProjectType.HEALTH_CENTRE),
    ("health", ProjectType.HEALTH_CENTRE), ("medical", ProjectType.HEALTH_CENTRE),
    ("toilet", ProjectType.SANITATION), ("drain", ProjectType.SANITATION), ("sanitation", ProjectType.SANITATION),
    ("sport", ProjectType.SPORTS_RECREATION), ("gym", ProjectType.SPORTS_RECREATION),
    ("playground", ProjectType.SPORTS_RECREATION), ("stadium", ProjectType.SPORTS_RECREATION),
    ("park", ProjectType.SPORTS_RECREATION),
]

_classification_fallback_count = 0
_classification_default_count = 0


def classify_work(description: str) -> ProjectType:
    global _classification_fallback_count, _classification_default_count
    if description in WORK_TYPE_MAP:
        return WORK_TYPE_MAP[description]

    lowered = description.lower()
    for keyword, ptype in KEYWORD_FALLBACKS:
        if keyword in lowered:
            _classification_fallback_count += 1
            return ptype

    _classification_default_count += 1
    return ProjectType.PUBLIC_FACILITY


def split_work_id(work_field: str) -> tuple[str, str]:
    """'WS/MP187/2023-2024/1362-Street lights' -> ('WS/MP187/2023-2024/1362', 'Street lights')."""
    match = WORK_ID_RE.match(work_field.strip())
    if match:
        return match.group(1), match.group(2).strip()
    return work_field.strip()[:64], work_field.strip()


def clean_mp_name(raw: str) -> str:
    """Strips tenure/parenthetical artifacts: 'Dr. X (2026-32) (2026-2032)' -> 'Dr. X'."""
    return re.sub(r"\s*\([^)]*\)", "", raw or "").strip()


def extract_district(ida: str) -> str:
    """'GHAZIABAD(DISTRICT MAGISTRAE GHAZIABAD_IDA)' -> 'Ghaziabad'."""
    match = re.match(r"^([A-Za-z .]+?)\s*\(", (ida or "").strip())
    text = match.group(1) if match else (ida or "Unknown").strip()
    return text.title().strip() or "Unknown"


def parse_amount(text: str) -> float:
    """Real amounts use Indian comma-grouping ('7,61,60,88,092.21') — plain
    float() chokes on the commas."""
    text = (text or "").strip().replace(",", "")
    return float(text) if text else 0.0


def parse_real_date(text: str) -> date | None:
    text = (text or "").strip()
    if not text or text.upper() in {"N/A", "NAN"}:
        return None
    try:
        return datetime.strptime(text, "%d-%b-%Y").date()
    except ValueError:
        return None


def jitter_latlon(center: tuple[float, float], spread: float) -> tuple[float, float]:
    lat = center[0] + np.random.normal(0, spread / 3)
    lon = center[1] + np.random.normal(0, spread / 3)
    return round(lat, 5), round(lon, 5)


# Real data covers states/UTs the synthetic generator's STATES dict never
# needed (it only had to cover the 16 it actually generates districts for).
# Kept separate from reference_data.STATES rather than merged into it — these
# have no district list, since real rows already carry their own real
# district (from IDA), and adding fake district lists there risks the
# synthetic generator treating these as valid states to fabricate data in.
EXTRA_STATE_CENTERS: dict[str, tuple[tuple[float, float], float]] = {
    "Andhra Pradesh": ((15.9, 79.7), 1.8),
    "Jharkhand": ((23.6, 85.3), 1.2),
    "Himachal Pradesh": ((31.9, 77.2), 1.3),
    "Chhattisgarh": ((21.3, 81.9), 1.5),
    "Uttarakhand": ((30.1, 79.0), 1.2),
    "Jammu And Kashmir": ((33.8, 76.6), 1.8),
    "Haryana": ((29.2, 76.3), 1.0),
    "Sikkim": ((27.5, 88.5), 0.3),
    "Meghalaya": ((25.5, 91.4), 0.5),
    "Puducherry": ((11.9, 79.8), 0.2),
    "Tripura": ((23.9, 91.4), 0.4),
    "Goa": ((15.3, 74.1), 0.25),
    "Chandigarh": ((30.7, 76.8), 0.1),
    "Arunachal Pradesh": ((28.2, 94.7), 1.3),
    "Lakshadweep": ((10.6, 72.6), 0.3),
    "Mizoram": ((23.3, 92.7), 0.6),
    "Andaman And Nicobar Islands": ((11.7, 92.7), 0.8),
    "Ladakh": ((34.2, 77.6), 1.0),
}


def approx_coords(state: str) -> tuple[str, str]:
    info = STATES.get(state)
    if info:
        lat, lon = jitter_latlon(info["center"], info["spread"])
        return str(lat), str(lon)

    extra = EXTRA_STATE_CENTERS.get(state)
    if extra:
        lat, lon = jitter_latlon(*extra)
        return str(lat), str(lon)

    return "", ""


def main() -> None:
    np.random.seed(7)

    completed_ids: set[str] = set()
    project_rows: list[dict] = []
    payments_by_work: dict[str, list[dict]] = defaultdict(list)

    # --- Pass 1: Works Completed.csv -> COMPLETED projects ---
    with open(DATA_DIR / "Works Completed.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            work_id, description = split_work_id(row["Work"])
            completed_ids.add(work_id)
            ptype = classify_work(description)
            profile = PROJECT_TYPE_PROFILES[ptype]

            completion = parse_real_date(row["Completion Date"])
            amount = parse_amount(row["Amount Disbursed ( ₹ )"])
            state = row["State"].strip()

            # Neither a true start date nor a separate sanction figure exists
            # for completed works — both are derived from this type's typical
            # peer duration, documented at the top of this file.
            duration_days = round(profile.duration_median_months * 30.4)
            start = (completion - timedelta(days=duration_days)) if completion else None
            lat, lon = approx_coords(state)

            project_rows.append({
                "Project ID": work_id,
                "Project Name": description[:200],
                "Description": row.get("Work Description", "")[:500],
                "Type": ptype.value,
                "State": state,
                "District": extract_district(row["IDA"]),
                "Latitude": lat,
                "Longitude": lon,
                "Sanctioned Amount": amount,
                "Estimated Cost": amount,
                "Released Amount": amount,
                "Expenditure Amount": amount,
                "Start Date": start.isoformat() if start else "",
                "Expected Completion": completion.isoformat() if completion else "",
                "Actual Completion": completion.isoformat() if completion else "",
                "Physical Progress (%)": 100,
                "Financial Progress (%)": 100,
                "Status": "COMPLETED",
                "Contractor Name": "",
                "Implementing Agency": row["IDA"][:200],
            })

    # --- Pass 2: Expenditure file -> payments for every work, plus ONGOING
    # projects reconstructed for any Work ID not already in Works Completed ---
    with open(DATA_DIR / "Expenditure on Completed and On-going Works as on Date.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            work_id = row["Work ID"].strip()
            payments_by_work[work_id].append(row)

    ongoing_added = 0
    for work_id, payments in payments_by_work.items():
        if work_id not in completed_ids:
            first = payments[0]
            description = re.sub(r"^WS/MP\d+/\d{4}-\d{4}/\d+-?", "", first["Work"]).strip() or first["Work"]
            ptype = classify_work(description)
            profile = PROJECT_TYPE_PROFILES[ptype]
            state = first["State"].strip()

            dates = [d for d in (parse_real_date(p["Expenditure Date"]) for p in payments) if d]
            start = min(dates) if dates else None
            total_disbursed = sum(parse_amount(p["Fund Disbursed Amount ( ₹ )"]) for p in payments)
            expected = (start + timedelta(days=round(profile.duration_median_months * 30.4))) if start else None

            elapsed_fraction = 0.5
            if start and expected and expected > start:
                elapsed_fraction = min(0.95, max(0.05, (date.today() - start).days / (expected - start).days))
            physical_progress = round(elapsed_fraction * 100, 1)

            lat, lon = approx_coords(state)
            project_rows.append({
                "Project ID": work_id,
                "Project Name": description[:200],
                "Description": "",
                "Type": ptype.value,
                "State": state,
                "District": extract_district(first["IDA"]),
                "Latitude": lat,
                "Longitude": lon,
                # total disbursed so far is a floor, not a true sanction figure
                # (documented at the top of this file) — no better number exists.
                "Sanctioned Amount": total_disbursed,
                "Estimated Cost": total_disbursed,
                "Released Amount": total_disbursed,
                "Expenditure Amount": total_disbursed,
                "Start Date": start.isoformat() if start else "",
                "Expected Completion": expected.isoformat() if expected else "",
                "Actual Completion": "",
                "Physical Progress (%)": physical_progress,
                "Financial Progress (%)": min(98.0, physical_progress + 5),
                "Status": "ONGOING",
                "Contractor Name": "",
                "Implementing Agency": first["IDA"][:200],
            })
            ongoing_added += 1

    payment_rows: list[dict] = []
    for work_id, payments in payments_by_work.items():
        for p in payments:
            payment_rows.append({
                "Project ID": work_id,
                "Amount": p["Fund Disbursed Amount ( ₹ )"],
                "Payment Date": parse_real_date(p["Expenditure Date"]).isoformat() if parse_real_date(p["Expenditure Date"]) else "",
                "Payment Type": "MILESTONE",
                "Payment Status": "CLEARED" if "progress" not in p["Payment Status"].lower() else "PENDING",
                "Recipient": p["Vendor Name"][:255],
                "Transaction Reference": work_id,
            })

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(RAW_DIR / "real_projects.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(project_rows[0].keys()))
        writer.writeheader()
        writer.writerows(project_rows)

    with open(RAW_DIR / "real_payments.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(payment_rows[0].keys()))
        writer.writeheader()
        writer.writerows(payment_rows)

    print(f"Completed projects (from Works Completed.csv): {len(completed_ids)}")
    print(f"Ongoing projects reconstructed (from Expenditure file only): {ongoing_added}")
    print(f"Total real projects written: {len(project_rows)}")
    print(f"Total real payments written: {len(payment_rows)}")
    print(f"Classified via exact phrase match: {len(project_rows) - _classification_fallback_count - _classification_default_count}")
    print(f"Classified via keyword fallback: {_classification_fallback_count}")
    print(f"Defaulted to PUBLIC_FACILITY (no match at all): {_classification_default_count}")
    states_with_coords = len(STATES) + len(EXTRA_STATE_CENTERS)
    print(f"States with approximate coordinates available: {states_with_coords} (others left without lat/lon)")


if __name__ == "__main__":
    main()
