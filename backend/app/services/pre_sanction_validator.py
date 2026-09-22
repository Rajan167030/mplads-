import math
import re
from typing import Any
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.project import Project


# Official MPLADS Guidelines 2023 - Prohibited Work Categories & Keywords
PROHIBITED_KEYWORDS = {
    "religious": [
        "temple", "mandir", "mosque", "masjid", "church", "gurudwara", 
        "monastery", "ashram", "shrine", "dargah", "puja", "religious", 
        "samadhi", "mutt", "madrasa", "graveyard", "burial ground", "kabristan"
    ],
    "commercial_private": [
        "commercial complex", "shopping mall", "private building", "private club", 
        "private property", "hotel", "resort", "private school", "private trust",
        "corporate office", "office of political party", "party office", "guest house"
    ],
    "non_durable_recurring": [
        "salary", "honorarium", "fuel", "stationery", "furniture for office", 
        "air conditioner", "vehicle purchase", "car", "suv", "consumables", 
        "inventory", "repair of private asset", "maintenance of vehicle"
    ]
}

# Permissible Sector Priority List & Benchmark Ceilings (INR)
PERMISSIBLE_SECTORS = {
    "DRINKING_WATER": {"priority": "CRITICAL", "benchmark_cost_range": (50000, 2500000), "guideline_ref": "Clause 2.1 - Core Civic Infrastructure"},
    "EDUCATION": {"priority": "HIGH", "benchmark_cost_range": (200000, 5000000), "guideline_ref": "Clause 2.2 - Durable Educational Assets"},
    "HEALTH": {"priority": "CRITICAL", "benchmark_cost_range": (300000, 8000000), "guideline_ref": "Clause 2.3 - Public Health Infrastructure"},
    "SANITATION": {"priority": "HIGH", "benchmark_cost_range": (100000, 3000000), "guideline_ref": "Clause 2.4 - Public Sanitation & Waste"},
    "ROADS_BRIDGES": {"priority": "STANDARD", "benchmark_cost_range": (500000, 15000000), "guideline_ref": "Clause 2.6 - Rural / Urban Connectivity"},
    "COMMUNITY_INFRASTRUCTURE": {"priority": "STANDARD", "benchmark_cost_range": (400000, 6000000), "guideline_ref": "Clause 2.7 - Community Centres"},
    "ELECTRICITY_RENEWABLE": {"priority": "HIGH", "benchmark_cost_range": (150000, 4000000), "guideline_ref": "Clause 2.8 - Solar & Renewable"},
    "OTHER": {"priority": "STANDARD", "benchmark_cost_range": (100000, 5000000), "guideline_ref": "Clause 2.9 - Other Permissible Works"},
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers between two GPS points."""
    R = 6371.0  # Earth's radius in km
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_jaccard_similarity(str1: str, str2: str) -> float:
    """Calculate token overlap similarity between two strings."""
    words1 = set(re.findall(r"\w+", str1.lower()))
    words2 = set(re.findall(r"\w+", str2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)


def validate_pre_sanction_proposal(
    db: Session,
    *,
    project_name: str,
    description: str | None = None,
    project_type: str,
    state: str,
    district: str,
    estimated_cost: float,
    latitude: float | None = None,
    longitude: float | None = None,
    target_beneficiary: str = "GENERAL",  # GENERAL, SC_HABITATION, ST_HABITATION
    implementing_agency: str | None = None,
) -> dict[str, Any]:
    """
    Evaluates a proposed MPLADS work against statutory guidelines, proximity duplicates,
    and PWD cost benchmarks before administrative sanction.
    """
    full_text = f"{project_name} {description or ''}".lower()
    violations: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    guideline_checks: list[dict[str, Any]] = []

    # 1. Official MPLADS Guidelines 2023 Rule Check
    prohibited_found = False
    for category, keywords in PROHIBITED_KEYWORDS.items():
        matched_words = [kw for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", full_text)]
        if matched_words:
            prohibited_found = True
            rule_clause = "Clause 5.1 (Prohibited Items)" if category == "religious" else (
                "Clause 5.2 (Private / Commercial Entities)" if category == "commercial_private" else "Clause 5.3 (Non-Durable / Consumable Expenses)"
            )
            violations.append({
                "rule": f"Prohibited Item ({category.replace('_', ' ').title()})",
                "clause": rule_clause,
                "matched_terms": matched_words,
                "severity": "CRITICAL",
                "explanation": f"The work proposal contains terms ({', '.join(matched_words)}) prohibited under MPLADS Guidelines {rule_clause}."
            })

    if not prohibited_found:
        guideline_checks.append({
            "check": "Prohibited Works Screening",
            "status": "PASS",
            "details": "Proposal complies with Section 5 (Permissible Durable Asset Creation)."
        })
    else:
        guideline_checks.append({
            "check": "Prohibited Works Screening",
            "status": "FAIL",
            "details": "Proposal violates Section 5 prohibited categories."
        })

    # SC/ST Mandatory Target Allocation Tracker Check
    if target_beneficiary.upper() in ["SC_HABITATION", "SC"]:
        guideline_checks.append({
            "check": "SC Area Quota (15% Mandatory Allocation)",
            "status": "PASS",
            "details": "Work directly contributes towards mandatory 15% SC community asset requirement (Section 2.5)."
        })
    elif target_beneficiary.upper() in ["ST_HABITATION", "ST"]:
        guideline_checks.append({
            "check": "ST Area Quota (7.5% Mandatory Allocation)",
            "status": "PASS",
            "details": "Work directly contributes towards mandatory 7.5% ST community asset requirement (Section 2.5)."
        })
    else:
        guideline_checks.append({
            "check": "General Community Quota",
            "status": "PASS",
            "details": "Ensure minimum 15% SC and 7.5% ST allocations are satisfied across the constituency annual pool."
        })

    # 2. Duplicate Asset & Proximity Scanner
    proximity_conflicts: list[dict[str, Any]] = []
    
    # Query recent projects in same district
    district_projects = (
        db.query(Project)
        .filter(func.lower(Project.district) == district.lower())
        .limit(100)
        .all()
    )

    for p in district_projects:
        sim = calculate_jaccard_similarity(project_name, p.project_name)
        dist_km = None
        if latitude and longitude and p.latitude and p.longitude:
            dist_km = haversine_distance(latitude, longitude, p.latitude, p.longitude)

        is_conflict = False
        conflict_reason = ""
        if sim >= 0.50:
            is_conflict = True
            conflict_reason = f"High textual similarity ({int(sim*100)}%) with existing project #{p.external_project_id}"
        elif dist_km is not None and dist_km <= 0.8 and sim >= 0.25:
            is_conflict = True
            conflict_reason = f"Similar work within {round(dist_km*1000)} meters ({int(sim*100)}% match) to #{p.external_project_id}"
        elif dist_km is not None and dist_km <= 0.2:
            warnings.append({
                "type": "PROXIMITY_OVERLAY",
                "message": f"Another project #{p.external_project_id} ('{p.project_name}') is located within 200m.",
                "distance_meters": round(dist_km * 1000)
            })

        if is_conflict:
            proximity_conflicts.append({
                "existing_project_id": p.external_project_id,
                "existing_project_name": p.project_name,
                "status": str(p.status.value if hasattr(p.status, "value") else p.status),
                "sanctioned_amount": float(p.sanctioned_amount or 0),
                "distance_km": round(dist_km, 2) if dist_km is not None else None,
                "similarity_score": round(sim, 2),
                "reason": conflict_reason,
            })

    if proximity_conflicts:
        violations.append({
            "rule": "Duplicate / Redundant Asset Creation",
            "clause": "Clause 3.4 (Anti-Duplication of Works with other Central/State Schemes)",
            "conflicts": proximity_conflicts,
            "severity": "HIGH",
            "explanation": f"Found {len(proximity_conflicts)} existing project(s) with high semantic and geographic proximity."
        })

    # 3. Schedule of Rates (SoR) / Cost Benchmark Anomaly Detector
    cost_res = (
        db.query(
            func.avg(Project.sanctioned_amount).label("avg_cost"),
            func.count(Project.id).label("count")
        )
        .filter(func.lower(Project.district) == district.lower())
        .first()
    )
    
    district_avg_cost = float(cost_res.avg_cost) if cost_res and cost_res.avg_cost else 1500000.0
    
    sector_info = PERMISSIBLE_SECTORS.get(project_type.upper(), PERMISSIBLE_SECTORS["OTHER"])
    min_bench, max_bench = sector_info["benchmark_cost_range"]

    cost_analysis = {
        "proposed_cost": estimated_cost,
        "district_historical_avg": district_avg_cost,
        "sector_standard_range": {"min": min_bench, "max": max_bench},
        "cost_variance_ratio": round(estimated_cost / (district_avg_cost or 1), 2),
        "status": "NORMAL"
    }

    if estimated_cost > max_bench * 1.5:
        cost_analysis["status"] = "EXCESSIVE_ESTIMATE"
        warnings.append({
            "type": "COST_ESTIMATE_SURGE",
            "message": f"Proposed cost (₹{estimated_cost:,.2f}) exceeds normal standard PWD ceiling (₹{max_bench:,.2f}) by {int((estimated_cost/max_bench - 1)*100)}%. Detailed engineering estimate & technical sanction required.",
            "variance": cost_analysis["cost_variance_ratio"]
        })
    elif estimated_cost < min_bench * 0.4:
        cost_analysis["status"] = "UNDERESTIMATED"
        warnings.append({
            "type": "COST_UNDERESTIMATED",
            "message": f"Proposed cost (₹{estimated_cost:,.2f}) is significantly below typical durable asset creation norms. Risk of incomplete/sub-standard execution.",
            "variance": cost_analysis["cost_variance_ratio"]
        })

    # 4. Final Recommendation & Clearance Decision
    if prohibited_found:
        clearance_status = "REJECT_PROHIBITED"
        clearance_color = "red"
        recommendation = "REJECT PROPOSAL: The proposed work violates official MPLADS Guidelines. Sanctioning this will attract statutory audit objections."
    elif proximity_conflicts:
        clearance_status = "CONDITIONAL_REVIEW_REQUIRED"
        clearance_color = "amber"
        recommendation = "HOLD FOR DDO VERIFICATION: Potential duplicate asset conflict detected. Requires physical site inspection before sanctioning."
    elif warnings:
        clearance_status = "CONDITIONAL_REVIEW_REQUIRED"
        clearance_color = "amber"
        recommendation = "PROCEED WITH CONDITIONAL TECHNICAL SANCTION: Verify PWD rate analysis and site coordinates before fund release."
    else:
        clearance_status = "APPROVED_FOR_SANCTION"
        clearance_color = "green"
        recommendation = "ELIGIBLE FOR IMMEDIATE SANCTION: Proposal fully complies with durability guidelines, non-duplication norms, and cost benchmarks."

    clearance_token = f"MPLADS-VAL-{abs(hash(project_name + str(estimated_cost))) % 1000000:06d}"

    return {
        "clearance_status": clearance_status,
        "clearance_color": clearance_color,
        "clearance_token": clearance_token,
        "recommendation": recommendation,
        "guideline_checks": guideline_checks,
        "violations": violations,
        "warnings": warnings,
        "proximity_conflicts": proximity_conflicts,
        "cost_analysis": cost_analysis,
        "target_beneficiary": target_beneficiary,
        "summary": {
            "project_name": project_name,
            "district": district,
            "state": state,
            "estimated_cost": estimated_cost,
            "total_flags": len(violations) + len(warnings)
        }
    }
