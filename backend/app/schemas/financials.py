from pydantic import BaseModel


class FinancialsByType(BaseModel):
    project_type: str
    project_count: int
    sanctioned_amount: float
    released_amount: float
    expenditure_amount: float


class FinancialsByState(BaseModel):
    state: str
    project_count: int
    sanctioned_amount: float
    released_amount: float
    expenditure_amount: float
    expenditure_utilization_pct: float  # expenditure / released — for this state alone


class FinancialsSummaryOut(BaseModel):
    total_sanctioned: float
    total_released: float
    total_expenditure: float
    release_utilization_pct: float  # released / sanctioned
    expenditure_utilization_pct: float  # expenditure / released
    by_type: list[FinancialsByType]
    by_state: list[FinancialsByState]


class FinancialsByMp(BaseModel):
    state: str
    constituency: str | None
    mp_name: str
    project_count: int
    sanctioned_amount: float
    released_amount: float
    expenditure_amount: float


class FinancialsByMpOut(BaseModel):
    total_projects: int
    attributed_projects: int  # projects carrying an mp_name in this scope
    attribution_coverage_pct: float
    by_mp: list[FinancialsByMp]
