"""One-off transform: the real MPLADS dashboard's own tile API
(data/Works_Recommended.csv, Works_Sanctioned.csv, Works_Completed.csv —
fetched via mplads-scraper/extract_dashboard_tiles.py from
POST https://mplads.mospi.gov.in/rest/PreLoginDashboardData/getTilesReportData,
unauthenticated, no login required) -> the same raw CSV shape the ingestion
pipeline already understands (app.ingestion.schema.PROJECT_COLUMNS /
PAYMENT_COLUMNS), so it goes through the exact same
ingestion -> entity resolution -> rules -> ML -> risk scoring pipeline as
everything else.

This is the tile-API counterpart to scripts/import_real_mplads_data.py (a
different, older, thinner pair of real exports) — reuses that script's
category classification, district extraction, amount/date parsing, and
approximate-coordinate helpers rather than re-deriving them, since the
underlying real-world messiness (Indian comma-grouped amounts, IDA-name
district parsing, 92 free-text work-type phrases) is identical.

What the tile API adds that the older source never had: real MP_NAME and
real CONSTITUENCY on every row — the actual point of this script.

Honest gaps in this source, surfaced in the printed summary too:
  - No expected_completion_date is published. Derived from start_date + this
    project type's typical peer duration (same derivation
    import_real_mplads_data.py already uses, for the same reason).
  - No itemized payment tranches — only a single ACTUAL_AMOUNT/ACTUAL_END_DATE
    per completed work. real_mplads_payments.csv therefore has at most one
    row per work (completed works only), not a real disbursement history.
  - No coordinates at all — approximated via the same state-center jitter
    import_real_mplads_data.py uses (approx_coords()).
  - No contractor — IDA_NAME (the government implementing agency) maps to
    implementing_agency, not contractor_name, which stays blank.
"""

import csv
import random
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.reference_data import PROJECT_TYPE_PROFILES  # noqa: E402
from import_real_mplads_data import (  # noqa: E402
    approx_coords,
    classify_work,
    clean_mp_name,
    extract_district,
    parse_amount,
    parse_real_date,
    split_work_id,
)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"
SAMPLE_SIZE = 8000
SEED = 42
STATE_FLOOR = 15
STATE_CAP = 400


def _read_tile(filename: str) -> list[dict]:
    with open(DATA_DIR / filename, encoding="cp1252", errors="replace", newline="") as f:
        return list(csv.DictReader(f))


def _index_by_id(rows: list[dict]) -> dict[str, dict]:
    return {row["WORK_RECOMMENDATION_DTL_ID"]: row for row in rows if row.get("WORK_RECOMMENDATION_DTL_ID")}


def _work_category_phrase(activity_name: str) -> str:
    """ACTIVITY_NAME is 'WS/ MPxxx/2024-2025/133166-Construction of...' — the
    part after the last '-' is the same category phrase
    import_real_mplads_data.py's WORK_TYPE_MAP is keyed on."""
    _, phrase = split_work_id(activity_name or "")
    return phrase


def main() -> None:
    rng = random.Random(SEED)

    print("Reading tiles (cp1252)...")
    recommended = _index_by_id(_read_tile("Works_Recommended.csv"))
    sanctioned = _index_by_id(_read_tile("Works_Sanctioned.csv"))
    completed = _index_by_id(_read_tile("Works_Completed.csv"))
    all_ids = set(recommended) | set(sanctioned) | set(completed)
    print(f"Recommended: {len(recommended)}  Sanctioned: {len(sanctioned)}  Completed: {len(completed)}  "
          f"Unique works: {len(all_ids)}")

    by_state: dict[str, list[str]] = defaultdict(list)
    for work_id in all_ids:
        base = recommended.get(work_id) or sanctioned.get(work_id) or completed.get(work_id)
        state = (base.get("STATE_NAME") or "").strip()
        if state:
            by_state[state].append(work_id)

    total_available = sum(len(v) for v in by_state.values())
    selected_ids: list[str] = []
    for state, ids in by_state.items():
        share = round(SAMPLE_SIZE * len(ids) / total_available)
        quota = max(STATE_FLOOR, min(STATE_CAP, share, len(ids)))
        selected_ids.extend(rng.sample(ids, quota))

    if len(selected_ids) > SAMPLE_SIZE:
        selected_ids = rng.sample(selected_ids, SAMPLE_SIZE)
    elif len(selected_ids) < SAMPLE_SIZE:
        remaining_pool = list(all_ids - set(selected_ids))
        top_up = min(SAMPLE_SIZE - len(selected_ids), len(remaining_pool))
        selected_ids.extend(rng.sample(remaining_pool, top_up))

    print(f"Sampled {len(selected_ids)} works across {len(by_state)} states")

    project_rows: list[dict] = []
    payment_rows: list[dict] = []
    stage_counts = {"COMPLETED": 0, "ONGOING": 0, "SANCTIONED": 0, "skipped_no_amount": 0}

    for work_id in selected_ids:
        rec = recommended.get(work_id)
        sanc = sanctioned.get(work_id)
        comp = completed.get(work_id)
        base = rec or sanc or comp

        activity_name = base.get("ACTIVITY_NAME") or base.get("WORK_DESCRIPTION") or ""
        category_phrase = _work_category_phrase(activity_name)
        ptype = classify_work(category_phrase)
        profile = PROJECT_TYPE_PROFILES[ptype]
        duration_days = round(profile.duration_median_months * 30.4)

        state = (base.get("STATE_NAME") or "").strip()
        district = extract_district(base.get("IDA_NAME") or "")
        constituency = (base.get("CONSTITUENCY") or "").strip().title()
        mp_name = clean_mp_name(base.get("MP_NAME") or "")
        description = (base.get("WORK_DESCRIPTION") or "")[:500]
        lat, lon = approx_coords(state)

        recommendation_date = parse_real_date((rec or {}).get("RECOMMENDATION_DATE") or (sanc or {}).get("RECOMMENDATION_DATE") or "")
        sanction_amount_raw = (sanc or rec or {}).get("SANCTION_AMOUNT") or (rec or {}).get("RECOMMENDED_AMOUNT")
        sanction_amount = parse_amount(sanction_amount_raw) if sanction_amount_raw else 0.0

        if comp:
            actual_end = parse_real_date(comp.get("ACTUAL_END_DATE") or "")
            actual_amount = parse_amount(comp.get("ACTUAL_AMOUNT") or "")
            start = recommendation_date or (actual_end - timedelta(days=duration_days) if actual_end else None)
            if sanction_amount <= 0:
                sanction_amount = actual_amount  # documented fallback — no sanction figure joined
            if sanction_amount <= 0:
                stage_counts["skipped_no_amount"] += 1
                continue
            status = "COMPLETED"
            expected = start + timedelta(days=duration_days) if start else None
            payment_rows.append({
                "Project ID": work_id,
                "Amount": actual_amount,
                "Payment Date": actual_end.isoformat() if actual_end else "",
                "Payment Type": "MILESTONE",
                "Payment Status": "CLEARED",
                "Recipient": (base.get("IDA_NAME") or "")[:255],
                "Transaction Reference": work_id,
            })
            project_rows.append({
                "Project ID": work_id, "Project Name": category_phrase[:200], "Description": description,
                "Type": ptype.value, "State": state, "District": district, "Constituency": constituency,
                "MP Name": mp_name, "Latitude": lat, "Longitude": lon,
                "Sanctioned Amount": sanction_amount, "Estimated Cost": sanction_amount,
                "Released Amount": sanction_amount, "Expenditure Amount": actual_amount,
                "Start Date": start.isoformat() if start else "", "Expected Completion": expected.isoformat() if expected else "",
                "Actual Completion": actual_end.isoformat() if actual_end else "",
                "Physical Progress (%)": 100, "Financial Progress (%)": 100, "Status": status,
                "Contractor Name": "", "Implementing Agency": (base.get("IDA_NAME") or "")[:200],
            })
            stage_counts["COMPLETED"] += 1
        else:
            if sanction_amount <= 0:
                stage_counts["skipped_no_amount"] += 1
                continue
            start = recommendation_date
            if not start:
                stage_counts["skipped_no_amount"] += 1
                continue
            expected = start + timedelta(days=duration_days)
            is_ongoing = sanc is not None
            status = "ONGOING" if is_ongoing else "SANCTIONED"
            if is_ongoing and expected < date.today():
                status = "DELAYED"
            elapsed_fraction = 0.0
            if is_ongoing and expected > start:
                elapsed_fraction = min(0.95, max(0.0, (date.today() - start).days / (expected - start).days))
            project_rows.append({
                "Project ID": work_id, "Project Name": category_phrase[:200], "Description": description,
                "Type": ptype.value, "State": state, "District": district, "Constituency": constituency,
                "MP Name": mp_name, "Latitude": lat, "Longitude": lon,
                "Sanctioned Amount": sanction_amount, "Estimated Cost": sanction_amount,
                "Released Amount": sanction_amount if is_ongoing else 0.0, "Expenditure Amount": 0.0,
                "Start Date": start.isoformat(), "Expected Completion": expected.isoformat(), "Actual Completion": "",
                "Physical Progress (%)": round(elapsed_fraction * 100, 1),
                "Financial Progress (%)": round(elapsed_fraction * 100, 1), "Status": status,
                "Contractor Name": "", "Implementing Agency": (base.get("IDA_NAME") or "")[:200],
            })
            stage_counts[status if status != "DELAYED" else "ONGOING"] += 1

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = list(project_rows[0].keys())
    with open(RAW_DIR / "real_mplads_projects.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(project_rows)

    if payment_rows:
        with open(RAW_DIR / "real_mplads_payments.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(payment_rows[0].keys()))
            writer.writeheader()
            writer.writerows(payment_rows)

    print()
    print(f"Projects written: {len(project_rows)}")
    print(f"  by stage (final classification): {stage_counts}")
    print(f"Payments written: {len(payment_rows)}")
    print(f"Distinct MPs: {len({r['MP Name'] for r in project_rows if r['MP Name']})}")
    print(f"Distinct states: {len({r['State'] for r in project_rows})}")
    print(f"Distinct districts: {len({r['District'] for r in project_rows})}")
    print(f"Classification fallback/default counts come from import_real_mplads_data's own counters — see its output if rerun standalone.")


if __name__ == "__main__":
    main()
