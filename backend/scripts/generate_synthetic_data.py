"""Generates a realistic synthetic MPLADS dataset for development and demo use.

Writes two kinds of output, deliberately kept apart:
  data/raw/*.csv        — what a messy government CSV export would look like.
                           This is the ONLY input the ingestion pipeline sees.
  data/synthetic/*.csv  — ground truth (planted anomalies, duplicate pairs).
                           Used later for model evaluation (precision/recall),
                           never fed into ingestion.

Design notes (see docs/decisions.md for the full rationale):
  - Costs and durations are sampled per project-type peer group (lognormal),
    not a single global distribution — a ₹22L health centre is normal; a ₹22L
    community hall is not. See app.utils.reference_data.
  - Planted anomalies are mutations of otherwise-realistic base records, and a
    fraction deliberately overlap (e.g. a cost anomaly on a contractor already
    carrying a contractor-risk pattern) so multi-signal correlation has real
    cases to find in Phase 4, rather than being invented after the fact.
"""

import csv
import random
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.enums import ProjectType  # noqa: E402
from app.utils.reference_data import (  # noqa: E402
    PROJECT_TYPE_PROFILES,
    PROJECT_TYPE_WEIGHTS,
    ROMANIZED_VARIANTS,
    STATE_CODES,
    STATES,
)

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

TODAY = date(2026, 9, 5)
N_PROJECTS = 10_000
N_CONTRACTORS = 500

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"
SYNTHETIC_DIR = DATA_DIR / "synthetic"

CONTRACTOR_PREFIXES = [
    "Shree", "Sai", "Om", "National", "United", "Bharat", "Modern", "Regional", "City", "Metro",
    "Prime", "Reliable", "Trust", "Apex", "Elite", "Suraksha", "Vishwakarma", "Ganga", "Himalaya", "Coastal",
    "Sunrise", "Sanskar", "Vikas", "Progressive", "Krishna",
]
CONTRACTOR_SUFFIXES = [
    "Constructions", "Infra Pvt Ltd", "Builders", "Engineering Works", "Contractors",
    "Infrastructure Ltd", "Enterprises", "Associates", "Projects Pvt Ltd", "Developers",
]

AGENCY_TEMPLATES = [
    "{district} Rural Development Agency",
    "{district} Zilla Parishad",
    "{district} Municipal Corporation",
]


@dataclass
class GroundTruthEntry:
    external_project_id: str
    planted_signals: list = field(default_factory=list)
    duplicate_of: str = ""
    notes: str = ""


def build_contractors(n: int) -> list[dict]:
    names = set()
    combos = [(p, s) for p in CONTRACTOR_PREFIXES for s in CONTRACTOR_SUFFIXES]
    random.shuffle(combos)
    for p, s in combos:
        names.add(f"{p} {s}")
    i = 1
    while len(names) < n:
        p, s = random.choice(CONTRACTOR_PREFIXES), random.choice(CONTRACTOR_SUFFIXES)
        names.add(f"{p} {s} {i}")
        i += 1
    contractors = []
    for name in list(names)[:n]:
        state, info = random.choice(list(STATES.items()))
        contractors.append({
            "name": name,
            "state": state,
            "district": random.choice(info["districts"]),
        })
    return contractors


def build_agencies() -> list[dict]:
    agencies = []
    for state, info in STATES.items():
        for district in info["districts"]:
            template = random.choice(AGENCY_TEMPLATES)
            agencies.append({
                "name": template.format(district=district, state=state),
                "level": "DISTRICT",
                "state": state,
                "district": district,
            })
        agencies.append({"name": f"Public Works Department, {state}", "level": "STATE", "state": state, "district": ""})
    return agencies


def jitter_latlon(center: tuple[float, float], spread: float) -> tuple[float, float]:
    lat = center[0] + np.random.normal(0, spread / 3)
    lon = center[1] + np.random.normal(0, spread / 3)
    return round(float(lat), 5), round(float(lon), 5)


def random_date(start: date, end: date) -> date:
    delta_days = (end - start).days
    return start + timedelta(days=random.randint(0, max(delta_days, 0)))


def pick_weighted(weights: dict):
    keys = list(weights.keys())
    probs = list(weights.values())
    return random.choices(keys, weights=probs, k=1)[0]


def project_name(project_type: ProjectType, district: str, language: str | None = None) -> tuple[str, str]:
    """Returns (name, language_used). language=None picks per configured mix."""
    profile = PROJECT_TYPE_PROFILES[project_type]
    locality = f"{district} Sector {random.randint(1, 12)}" if random.random() < 0.4 else district

    if language is None:
        roll = random.random()
        if roll < 0.72:
            language = "en"
        elif roll < 0.88 and profile.lexicon:
            language = random.choice(list(profile.lexicon.keys()))
        elif project_type in ROMANIZED_VARIANTS:
            language = "romanized"
        else:
            language = "en"

    if language == "en":
        return f"{profile.name_phrase_en} – {locality}", "en"
    if language == "romanized" and project_type in ROMANIZED_VARIANTS:
        phrase = random.choice(ROMANIZED_VARIANTS[project_type])
        return f"{phrase} – {locality}", "en"  # romanized text still detects as latin-script/en
    if language in profile.lexicon:
        return f"{profile.lexicon[language]} – {locality}", language
    return f"{profile.name_phrase_en} – {locality}", "en"


def generate_base_projects(contractors: list[dict], agencies: list[dict]) -> list[dict]:
    contractor_weights = np.array([1 / (r ** 0.8) for r in range(1, len(contractors) + 1)])
    contractor_weights /= contractor_weights.sum()
    contractor_order = list(range(len(contractors)))
    random.shuffle(contractor_order)  # so "rank 1" isn't always the same alphabetical contractor

    agencies_by_district = {}
    for a in agencies:
        agencies_by_district.setdefault((a["state"], a["district"]), []).append(a)

    seq_counter: dict[str, int] = {}
    projects = []

    for i in range(N_PROJECTS):
        project_type = pick_weighted(PROJECT_TYPE_WEIGHTS)
        profile = PROJECT_TYPE_PROFILES[project_type]
        state, info = random.choice(list(STATES.items()))
        district = random.choice(info["districts"])

        cost_multiplier = np.random.lognormal(mean=0, sigma=profile.cost_sigma)
        sanctioned_amount = round(profile.cost_median * cost_multiplier, -3)
        estimated_cost = round(sanctioned_amount * np.random.uniform(0.95, 1.08), -3)

        duration_months = max(2, np.random.lognormal(
            mean=np.log(profile.duration_median_months), sigma=profile.duration_sigma
        ))

        start_date = random_date(date(2022, 6, 1), date(2025, 10, 1))
        expected_completion = start_date + timedelta(days=int(duration_months * 30.4))

        elapsed_fraction = min(1.0, max(0.0, (TODAY - start_date).days / max((expected_completion - start_date).days, 1)))

        if start_date > TODAY - timedelta(days=20):
            status, physical_progress, financial_progress, actual_completion = "SANCTIONED", 0.0, 0.0, None
        elif expected_completion < TODAY and random.random() < 0.85:
            status = "COMPLETED"
            physical_progress = 100.0
            financial_progress = round(np.random.uniform(96, 100), 1)
            actual_completion = expected_completion + timedelta(days=int(np.random.normal(10, 25)))
            if actual_completion > TODAY:
                actual_completion = TODAY - timedelta(days=random.randint(1, 30))
        elif expected_completion < TODAY:
            status = "DELAYED"
            physical_progress = round(min(95.0, elapsed_fraction * 100 * np.random.uniform(0.4, 0.75)), 1)
            financial_progress = round(min(98.0, physical_progress + np.random.uniform(-5, 15)), 1)
            actual_completion = None
        else:
            status = "ONGOING"
            physical_progress = round(min(95.0, elapsed_fraction * 100 * np.random.uniform(0.75, 1.05)), 1)
            financial_progress = round(min(98.0, physical_progress + np.random.uniform(-8, 12)), 1)
            actual_completion = None

        released_amount = round(sanctioned_amount * (financial_progress / 100) * np.random.uniform(0.97, 1.0), 0)
        expenditure_amount = round(released_amount * np.random.uniform(0.9, 1.0), 0)

        lat, lon = jitter_latlon(info["center"], info["spread"])

        contractor_idx = None
        if random.random() > 0.009:  # ~0.9% naturally missing contractor
            contractor_idx = random.choices(contractor_order, weights=contractor_weights, k=1)[0]

        district_agencies = agencies_by_district.get((state, district), [])
        agency = random.choice(district_agencies) if district_agencies and random.random() > 0.05 else None

        name, language = project_name(project_type, district)

        code = STATE_CODES[state]
        year = start_date.year
        key = f"{code}-{year}"
        seq_counter[key] = seq_counter.get(key, 0) + 1
        external_id = f"MP-{code}-{year}-{seq_counter[key]:04d}"

        projects.append({
            "external_project_id": external_id,
            "project_name": name,
            "language_hint": language,
            "description": f"{profile.name_phrase_en} under MPLADS in {district}, {state}.",
            "project_type": project_type.value,
            "state": state,
            "district": district,
            "constituency": f"{district} PC",
            "latitude": lat,
            "longitude": lon,
            "sanctioned_amount": float(sanctioned_amount),
            "estimated_cost": float(estimated_cost),
            "released_amount": float(released_amount),
            "expenditure_amount": float(expenditure_amount),
            "start_date": start_date,
            "expected_completion_date": expected_completion,
            "actual_completion_date": actual_completion,
            "physical_progress": float(physical_progress),
            "financial_progress": float(financial_progress),
            "status": status,
            "contractor_name": contractors[contractor_idx]["name"] if contractor_idx is not None else "",
            "implementing_agency": agency["name"] if agency else "",
            "peer_cost_median": profile.cost_median,
            "peer_duration_median_months": profile.duration_median_months,
        })

    return projects


def plant_cost_anomalies(projects: list[dict], gt: dict[str, GroundTruthEntry], n: int) -> None:
    idxs = random.sample(range(len(projects)), n)
    for i in idxs:
        p = projects[i]
        factor = np.random.uniform(1.8, 3.5)
        p["sanctioned_amount"] = round(p["peer_cost_median"] * factor, -3)
        p["estimated_cost"] = round(p["sanctioned_amount"] * np.random.uniform(0.97, 1.05), -3)
        p["released_amount"] = round(p["sanctioned_amount"] * (p["financial_progress"] / 100), 0)
        p["expenditure_amount"] = round(p["released_amount"] * np.random.uniform(0.9, 1.0), 0)
        entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
        entry.planted_signals.append("COST_ANOMALY")


def plant_delay_anomalies(projects: list[dict], gt: dict[str, GroundTruthEntry], n: int) -> None:
    idxs = random.sample(range(len(projects)), n)
    for i in idxs:
        p = projects[i]
        extra_months = np.random.uniform(8, 20)
        p["expected_completion_date"] = p["start_date"] + timedelta(
            days=int(p["peer_duration_median_months"] * 30.4)
        )
        p["status"] = "DELAYED"
        p["actual_completion_date"] = None
        elapsed = max((TODAY - p["start_date"]).days, 1)
        total_expected = (p["expected_completion_date"] - p["start_date"]).days + int(extra_months * 30.4)
        p["physical_progress"] = round(min(60.0, 100 * elapsed / max(total_expected, 1)), 1)
        p["financial_progress"] = round(min(80.0, p["physical_progress"] + np.random.uniform(0, 10)), 1)
        p["released_amount"] = round(p["sanctioned_amount"] * (p["financial_progress"] / 100), 0)
        p["expenditure_amount"] = round(p["released_amount"] * np.random.uniform(0.9, 1.0), 0)
        entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
        entry.planted_signals.append("DELAY_ANOMALY")
        entry.notes = f"peer_median_months={p['peer_duration_median_months']:.1f}; planted_extra_months={extra_months:.1f}"


def plant_mismatch_anomalies(projects: list[dict], gt: dict[str, GroundTruthEntry], n: int) -> None:
    idxs = random.sample(range(len(projects)), n)
    for i in idxs:
        p = projects[i]
        p["financial_progress"] = round(np.random.uniform(75, 95), 1)
        p["physical_progress"] = round(np.random.uniform(10, 40), 1)
        p["status"] = "ONGOING"
        p["actual_completion_date"] = None
        p["released_amount"] = round(p["sanctioned_amount"] * (p["financial_progress"] / 100), 0)
        p["expenditure_amount"] = round(p["released_amount"] * np.random.uniform(0.85, 1.0), 0)
        entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
        entry.planted_signals.append("PAYMENT_PROGRESS_MISMATCH")
        p["_mismatch_flavor"] = True


def plant_duplicates(projects: list[dict], gt: dict[str, GroundTruthEntry], n_pairs: int) -> None:
    candidates = [i for i, p in enumerate(projects) if p["project_type"] in
                  (ProjectType.COMMUNITY_HALL.value, ProjectType.WATER_INFRASTRUCTURE.value, ProjectType.HEALTH_CENTRE.value)]
    seeds = random.sample(candidates, min(n_pairs, len(candidates) // 2))
    others_pool = [i for i in range(len(projects)) if i not in seeds]
    twins = random.sample(others_pool, len(seeds))

    for seed_i, twin_i in zip(seeds, twins):
        seed, twin = projects[seed_i], projects[twin_i]
        ptype = ProjectType(seed["project_type"])

        twin["project_type"] = seed["project_type"]
        twin["state"] = seed["state"]
        twin["district"] = seed["district"]
        twin["constituency"] = seed["constituency"]
        twin["latitude"] = round(seed["latitude"] + np.random.uniform(-0.01, 0.01), 5)
        twin["longitude"] = round(seed["longitude"] + np.random.uniform(-0.01, 0.01), 5)
        twin["sanctioned_amount"] = round(seed["sanctioned_amount"] * np.random.uniform(0.92, 1.08), -3)
        twin["estimated_cost"] = round(twin["sanctioned_amount"] * np.random.uniform(0.97, 1.05), -3)
        twin["start_date"] = seed["start_date"] + timedelta(days=random.randint(-45, 45))
        if twin["actual_completion_date"] and twin["actual_completion_date"] <= twin["start_date"]:
            twin["actual_completion_date"] = None
            twin["status"] = "ONGOING"
            twin["expected_completion_date"] = twin["start_date"] + timedelta(
                days=int(PROJECT_TYPE_PROFILES[ptype].duration_median_months * 30.4)
            )

        other_lang = "romanized" if ptype in ROMANIZED_VARIANTS and random.random() < 0.5 else random.choice(
            list(PROJECT_TYPE_PROFILES[ptype].lexicon.keys()) or ["en"]
        )
        twin["project_name"], twin["language_hint"] = project_name(ptype, seed["district"], language=other_lang)

        gt.setdefault(seed["external_project_id"], GroundTruthEntry(seed["external_project_id"])).duplicate_of = twin["external_project_id"]
        entry = gt.setdefault(twin["external_project_id"], GroundTruthEntry(twin["external_project_id"]))
        entry.planted_signals.append("POSSIBLE_DUPLICATE")
        entry.duplicate_of = seed["external_project_id"]
        gt[seed["external_project_id"]].planted_signals.append("POSSIBLE_DUPLICATE")


def plant_contractor_patterns(projects: list[dict], gt: dict[str, GroundTruthEntry], contractors: list[dict], n: int) -> None:
    named_contractors = [c["name"] for c in contractors]
    risky = random.sample(named_contractors, 5)
    per_contractor = n // len(risky)
    pool = [i for i in range(len(projects))]
    random.shuffle(pool)
    used = 0
    for name in risky:
        for i in pool[used:used + per_contractor]:
            p = projects[i]
            p["contractor_name"] = name
            if random.random() < 0.6:
                p["status"] = "DELAYED"
                p["actual_completion_date"] = None
                p["physical_progress"] = round(min(p["physical_progress"], np.random.uniform(20, 55)), 1)
            if random.random() < 0.5:
                p["sanctioned_amount"] = round(p["sanctioned_amount"] * np.random.uniform(1.2, 1.6), -3)
            entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
            entry.planted_signals.append("CONTRACTOR_RISK_PATTERN")
            entry.notes = f"contractor={name}"
        used += per_contractor


def plant_geo_clusters(projects: list[dict], gt: dict[str, GroundTruthEntry], n_clusters: int, per_cluster: int) -> None:
    pool = list(range(len(projects)))
    random.shuffle(pool)
    used = 0
    for _ in range(n_clusters):
        cluster_idxs = pool[used:used + per_cluster]
        used += per_cluster
        anchor = projects[cluster_idxs[0]]
        base_lat, base_lon = anchor["latitude"], anchor["longitude"]
        shared_type = anchor["project_type"]
        window_start = anchor["start_date"]
        for i in cluster_idxs:
            p = projects[i]
            p["project_type"] = shared_type
            p["state"] = anchor["state"]
            p["district"] = anchor["district"]
            # Regenerate the name too — otherwise a project moved into this
            # cluster keeps a name describing its old type/locality, which
            # reads as a data bug rather than a planted anomaly.
            p["project_name"], p["language_hint"] = project_name(ProjectType(shared_type), anchor["district"])
            p["latitude"] = round(base_lat + np.random.uniform(-0.015, 0.015), 5)
            p["longitude"] = round(base_lon + np.random.uniform(-0.015, 0.015), 5)
            new_start = window_start + timedelta(days=random.randint(0, 20))
            delta = new_start - p["start_date"]
            p["start_date"] = new_start
            p["expected_completion_date"] = p["expected_completion_date"] + delta
            if p["actual_completion_date"]:
                p["actual_completion_date"] = min(p["actual_completion_date"] + delta, TODAY - timedelta(days=1))
            entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
            entry.planted_signals.append("GEOGRAPHIC_CONCENTRATION")
            entry.notes = f"cluster_type={shared_type}"


def inject_missing_data(projects: list[dict]) -> dict:
    counts = {"missing_location": 0, "missing_contractor": 0, "missing_amount": 0, "malformed": 0}
    n = len(projects)

    for i in random.sample(range(n), int(n * 0.007)):
        projects[i]["_missing_location"] = True
        counts["missing_location"] += 1

    for i in random.sample(range(n), int(n * 0.009)):
        projects[i]["contractor_name"] = ""
        counts["missing_contractor"] += 1

    for i in random.sample(range(n), int(n * 0.0015)):
        projects[i]["_missing_amount"] = True
        counts["missing_amount"] += 1

    for i in random.sample(range(n), int(n * 0.008)):
        projects[i]["_malformed"] = True
        counts["malformed"] += 1

    return counts


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


PROJECT_CSV_FIELDS = [
    "Project ID", "Project Name", "Description", "Type", "State", "District", "Constituency",
    "Latitude", "Longitude", "Sanctioned Amount", "Estimated Cost", "Released Amount", "Expenditure Amount",
    "Start Date", "Expected Completion", "Actual Completion", "Physical Progress (%)", "Financial Progress (%)",
    "Status", "Contractor Name", "Implementing Agency",
]


def to_raw_row(p: dict) -> dict:
    row = {
        "Project ID": p["external_project_id"],
        "Project Name": p["project_name"],
        "Description": p["description"],
        "Type": p["project_type"],
        "State": p["state"],
        "District": p["district"],
        "Constituency": p["constituency"],
        # State/district stay populated even when precise coordinates are
        # missing — a GPS-tagging gap, not a lost record (peer-group lookups
        # in Phase 4/5 still work off state/district).
        "Latitude": "" if p.get("_missing_location") else p["latitude"],
        "Longitude": "" if p.get("_missing_location") else p["longitude"],
        "Sanctioned Amount": "" if p.get("_missing_amount") else p["sanctioned_amount"],
        "Estimated Cost": p["estimated_cost"],
        "Released Amount": p["released_amount"],
        "Expenditure Amount": p["expenditure_amount"],
        "Start Date": "not-a-date" if p.get("_malformed") else p["start_date"].isoformat(),
        "Expected Completion": p["expected_completion_date"].isoformat(),
        "Actual Completion": p["actual_completion_date"].isoformat() if p["actual_completion_date"] else "",
        "Physical Progress (%)": p["physical_progress"],
        "Financial Progress (%)": p["financial_progress"],
        "Status": p["status"],
        "Contractor Name": p["contractor_name"],
        "Implementing Agency": p["implementing_agency"],
    }
    return row


def generate_payments(projects: list[dict]) -> list[dict]:
    rows = []
    for p in projects:
        released = p["released_amount"]
        if released <= 0:
            continue
        start = p["start_date"]
        flavor_mismatch = p.get("_mismatch_flavor", False)

        if flavor_mismatch:
            # Payment acceleration: small trickle then one very late lump sum.
            advance = round(released * 0.08, 0)
            rows.append(_payment(p, advance, start + timedelta(days=20), "ADVANCE"))
            trickle_date = start + timedelta(days=60)
            for _ in range(2):
                rows.append(_payment(p, round(released * 0.04, 0), trickle_date, "MILESTONE"))
                trickle_date += timedelta(days=45)
            lump_sum = released - advance - round(released * 0.08, 0)
            rows.append(_payment(p, max(lump_sum, 0), trickle_date + timedelta(days=10), "MILESTONE"))
            continue

        advance = round(released * np.random.uniform(0.1, 0.2), 0)
        rows.append(_payment(p, advance, start + timedelta(days=random.randint(10, 30)), "ADVANCE"))
        remaining = released - advance
        n_milestones = random.randint(1, 3)
        span_days = max((min(p["actual_completion_date"] or TODAY, TODAY) - start).days, 30)
        for m in range(n_milestones):
            amount = round(remaining / n_milestones, 0)
            pay_date = start + timedelta(days=int(span_days * (m + 1) / (n_milestones + 1)))
            ptype = "FINAL" if (p["status"] == "COMPLETED" and m == n_milestones - 1) else "MILESTONE"
            rows.append(_payment(p, amount, pay_date, ptype))
    return rows


def _payment(p: dict, amount: float, pay_date: date, ptype: str) -> dict:
    return {
        "Project ID": p["external_project_id"],
        "Amount": amount,
        "Payment Date": pay_date.isoformat(),
        "Payment Type": ptype,
        "Payment Status": "CLEARED",
        "Recipient": p["contractor_name"] or "Unknown",
        "Transaction Reference": f"TXN{random.randint(10**9, 10**10 - 1)}",
    }


def generate_milestones(projects: list[dict]) -> list[dict]:
    rows = []
    for p in projects:
        if p["status"] == "SANCTIONED":
            continue
        start = p["start_date"]
        end = p["actual_completion_date"] or p["expected_completion_date"]
        n = random.randint(2, 4)
        flavor_mismatch = p.get("_mismatch_flavor", False)
        readings = np.linspace(25, 100, n)
        if flavor_mismatch and n >= 3:
            readings[-2] = readings[-3] - random.uniform(5, 15)  # non-monotonic dip
        for idx, expected_progress in enumerate(readings):
            exp_date = start + (end - start) * (idx + 1) / n
            actual_date = exp_date + timedelta(days=random.randint(-5, 20))
            actual_progress = min(p["physical_progress"], expected_progress) + np.random.uniform(-8, 3)
            actual_progress = max(0, round(actual_progress, 1))
            status = "COMPLETED" if actual_progress >= expected_progress - 2 else (
                "DELAYED" if actual_date > exp_date + timedelta(days=10) else "ON_TRACK"
            )
            rows.append({
                "Project ID": p["external_project_id"],
                "Milestone Name": f"Milestone {idx + 1}",
                "Expected Date": exp_date.date().isoformat() if hasattr(exp_date, "date") else exp_date.isoformat(),
                "Actual Date": actual_date.date().isoformat() if hasattr(actual_date, "date") else actual_date.isoformat(),
                "Expected Progress": round(float(expected_progress), 1),
                "Actual Progress": actual_progress,
                "Status": status,
            })
    return rows


def generate_inspections(projects: list[dict]) -> list[dict]:
    rows = []
    for p in projects:
        if p["status"] == "SANCTIONED":
            continue
        start = p["start_date"]
        end = min(p["actual_completion_date"] or p["expected_completion_date"], TODAY)
        n = random.randint(1, 4)
        flavor_mismatch = p.get("_mismatch_flavor", False)
        last_progress = 0.0
        for idx in range(n):
            insp_date = start + (end - start) * (idx + 1) / (n + 1) if end > start else start
            target = p["physical_progress"] * (idx + 1) / n
            if flavor_mismatch and idx == n - 1 and n >= 2:
                reported = max(0, last_progress - random.uniform(2, 8))  # regression, then a later jump elsewhere
            else:
                reported = max(last_progress, target + np.random.uniform(-6, 6))
            reported = round(min(100.0, max(0.0, reported)), 1)
            last_progress = reported
            rows.append({
                "Project ID": p["external_project_id"],
                "Inspection Date": insp_date.isoformat() if isinstance(insp_date, date) else insp_date.date().isoformat(),
                "Inspector": f"Inspector-{random.randint(100, 999)}",
                "Reported Progress": reported,
                "Remarks": "Site visit conducted; progress verified." if not flavor_mismatch else "Progress verification pending discrepancy review.",
                "Location": p["district"],
            })
    return rows


def generate_evidence(projects: list[dict], gt: dict[str, GroundTruthEntry], n_anomalous: int) -> list[dict]:
    rows = []
    for p in projects:
        if p["status"] == "SANCTIONED" or random.random() < 0.5:
            continue
        rows.append({
            "Project ID": p["external_project_id"],
            "Type": "PHOTO",
            "File Reference": f"/evidence/{p['external_project_id']}/photo_{random.randint(1,999)}.jpg",
            "Description": "Site progress photo",
            "Captured At": (p["start_date"] + timedelta(days=random.randint(10, 200))).isoformat(),
            "Source": "Field Officer App",
            "Hash": f"sha256:{random.getrandbits(128):032x}",
        })

    eligible = [p for p in projects if p["status"] != "SANCTIONED"]
    groups = random.sample(eligible, min(n_anomalous, len(eligible)))
    shared_hash_groups = [groups[i:i + 5] for i in range(0, len(groups), 5)]
    for group in shared_hash_groups:
        shared_hash = f"sha256:{random.getrandbits(128):032x}"
        for p in group:
            bad_captured_at = p["start_date"] - timedelta(days=random.randint(5, 60))  # before project even started
            rows.append({
                "Project ID": p["external_project_id"],
                "Type": "PHOTO",
                "File Reference": f"/evidence/{p['external_project_id']}/photo_reused.jpg",
                "Description": "Site progress photo",
                "Captured At": bad_captured_at.isoformat(),
                "Source": "Field Officer App",
                "Hash": shared_hash,
            })
            entry = gt.setdefault(p["external_project_id"], GroundTruthEntry(p["external_project_id"]))
            entry.planted_signals.append("EVIDENCE_ANOMALY")
    return rows


def main() -> None:
    contractors = build_contractors(N_CONTRACTORS)
    agencies = build_agencies()
    projects = generate_base_projects(contractors, agencies)

    gt: dict[str, GroundTruthEntry] = {}
    plant_cost_anomalies(projects, gt, 100)
    plant_delay_anomalies(projects, gt, 100)
    plant_mismatch_anomalies(projects, gt, 100)
    plant_duplicates(projects, gt, 25)  # 25 pairs = 50 projects
    plant_contractor_patterns(projects, gt, contractors, 50)
    plant_geo_clusters(projects, gt, n_clusters=3, per_cluster=10)
    messiness_counts = inject_missing_data(projects)

    payments = generate_payments(projects)
    milestones = generate_milestones(projects)
    inspections = generate_inspections(projects)
    evidence = generate_evidence(projects, gt, n_anomalous=30)

    write_csv(RAW_DIR / "projects.csv", [to_raw_row(p) for p in projects], PROJECT_CSV_FIELDS)
    write_csv(RAW_DIR / "contractors.csv", contractors, ["name", "state", "district"])
    write_csv(RAW_DIR / "agencies.csv", agencies, ["name", "level", "state", "district"])
    write_csv(RAW_DIR / "payments.csv", payments,
              ["Project ID", "Amount", "Payment Date", "Payment Type", "Payment Status", "Recipient", "Transaction Reference"])
    write_csv(RAW_DIR / "milestones.csv", milestones,
              ["Project ID", "Milestone Name", "Expected Date", "Actual Date", "Expected Progress", "Actual Progress", "Status"])
    write_csv(RAW_DIR / "inspections.csv", inspections,
              ["Project ID", "Inspection Date", "Inspector", "Reported Progress", "Remarks", "Location"])
    write_csv(RAW_DIR / "evidence.csv", evidence,
              ["Project ID", "Type", "File Reference", "Description", "Captured At", "Source", "Hash"])

    gt_rows = [
        {
            "project_external_id": e.external_project_id,
            "planted_signals": ";".join(e.planted_signals),
            "duplicate_of": e.duplicate_of,
            "notes": e.notes,
        }
        for e in gt.values()
    ]
    write_csv(SYNTHETIC_DIR / "ground_truth.csv", gt_rows, ["project_external_id", "planted_signals", "duplicate_of", "notes"])

    print(f"Generated {len(projects)} projects, {len(contractors)} contractors, {len(agencies)} agencies")
    print(f"Payments: {len(payments)}  Milestones: {len(milestones)}  Inspections: {len(inspections)}  Evidence: {len(evidence)}")
    print(f"Planted ground-truth rows: {len(gt_rows)}")
    print(f"Injected messiness: {messiness_counts}")


if __name__ == "__main__":
    main()
