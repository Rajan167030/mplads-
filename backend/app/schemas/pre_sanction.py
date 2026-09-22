from typing import Any
from pydantic import BaseModel, Field


class PreSanctionValidationIn(BaseModel):
    project_name: str = Field(..., min_length=3, max_length=500, description="Title of proposed MPLADS work")
    description: str | None = Field(default=None, max_length=2000, description="Detailed scope of work")
    project_type: str = Field(default="COMMUNITY_INFRASTRUCTURE", description="Sector/Category")
    state: str = Field(..., description="Target State")
    district: str = Field(..., description="Target District")
    estimated_cost: float = Field(..., gt=0, description="Proposed estimated cost in INR")
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    target_beneficiary: str = Field(default="GENERAL", description="GENERAL, SC_HABITATION, ST_HABITATION")
    implementing_agency: str | None = Field(default=None)


class PreSanctionValidationOut(BaseModel):
    clearance_status: str
    clearance_color: str
    clearance_token: str
    recommendation: str
    guideline_checks: list[dict[str, Any]]
    violations: list[dict[str, Any]]
    warnings: list[dict[str, Any]]
    proximity_conflicts: list[dict[str, Any]]
    cost_analysis: dict[str, Any]
    target_beneficiary: str
    summary: dict[str, Any]
