from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.models.user import User
from app.schemas.pre_sanction import PreSanctionValidationIn, PreSanctionValidationOut
from app.services.pre_sanction_validator import (
    PERMISSIBLE_SECTORS,
    PROHIBITED_KEYWORDS,
    validate_pre_sanction_proposal,
)

router = APIRouter(prefix="/pre-sanction", tags=["pre-sanction"])


@router.post("/validate", response_model=PreSanctionValidationOut)
def validate_proposal(
    payload: PreSanctionValidationIn,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> PreSanctionValidationOut:
    """
    Validates a proposed MPLADS work against statutory guidelines,
    geospatial proximity duplicates, and Schedule of Rates benchmarks.
    """
    result = validate_pre_sanction_proposal(
        db,
        project_name=payload.project_name,
        description=payload.description,
        project_type=payload.project_type,
        state=payload.state,
        district=payload.district,
        estimated_cost=payload.estimated_cost,
        latitude=payload.latitude,
        longitude=payload.longitude,
        target_beneficiary=payload.target_beneficiary,
        implementing_agency=payload.implementing_agency,
    )
    return PreSanctionValidationOut(**result)


@router.get("/guidelines")
def get_guideline_rules():
    """Returns official MPLADS guideline permissible sectors and prohibited criteria."""
    return {
        "permissible_sectors": PERMISSIBLE_SECTORS,
        "prohibited_categories": {
            cat: {"terms_count": len(terms), "sample_terms": terms[:5]}
            for cat, terms in PROHIBITED_KEYWORDS.items()
        },
        "statutory_quotas": {
            "SC_HABITATION": {"mandatory_percent": 15.0, "guideline_clause": "Section 2.5"},
            "ST_HABITATION": {"mandatory_percent": 7.5, "guideline_clause": "Section 2.5"},
        },
    }
