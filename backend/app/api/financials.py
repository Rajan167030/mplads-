from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.scope import scope_filter
from app.models.project import Project
from app.models.user import User
from app.schemas.financials import FinancialsByMp, FinancialsByMpOut, FinancialsByState, FinancialsByType, FinancialsSummaryOut

# States with too few projects make a weak "which regions convert funds
# fastest" comparison (one project's utilization swings the whole state's
# rate) — mirrors the risk engine's own peer-group-size reasoning
# (app.risk.context.MIN_PEER_GROUP_SIZE).
MIN_STATE_PROJECTS_FOR_RANKING = 5

router = APIRouter(prefix="/financials", tags=["financials"])


@router.get("/summary", response_model=FinancialsSummaryOut)
def financials_summary(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> FinancialsSummaryOut:
    totals_query = db.query(
        func.coalesce(func.sum(Project.sanctioned_amount), 0),
        func.coalesce(func.sum(Project.released_amount), 0),
        func.coalesce(func.sum(Project.expenditure_amount), 0),
    )
    if user:
        totals_query = scope_filter(totals_query, user)
    totals = totals_query.one()
    total_sanctioned, total_released, total_expenditure = (float(x) for x in totals)

    by_type_query = db.query(
        Project.project_type,
        func.count(Project.id),
        func.coalesce(func.sum(Project.sanctioned_amount), 0),
        func.coalesce(func.sum(Project.released_amount), 0),
        func.coalesce(func.sum(Project.expenditure_amount), 0),
    )
    if user:
        by_type_query = scope_filter(by_type_query, user)
    rows = by_type_query.group_by(Project.project_type).all()
    by_type = [
        FinancialsByType(
            project_type=ptype.value,
            project_count=count,
            sanctioned_amount=float(sanctioned),
            released_amount=float(released),
            expenditure_amount=float(expenditure),
        )
        for ptype, count, sanctioned, released, expenditure in rows
    ]
    by_type.sort(key=lambda t: t.sanctioned_amount, reverse=True)

    state_query = db.query(
        Project.state,
        func.count(Project.id),
        func.coalesce(func.sum(Project.sanctioned_amount), 0),
        func.coalesce(func.sum(Project.released_amount), 0),
        func.coalesce(func.sum(Project.expenditure_amount), 0),
    )
    if user:
        state_query = scope_filter(state_query, user)
    state_rows = state_query.group_by(Project.state).all()
    by_state = [
        FinancialsByState(
            state=state,
            project_count=count,
            sanctioned_amount=float(sanctioned),
            released_amount=float(released),
            expenditure_amount=float(expenditure),
            expenditure_utilization_pct=round(float(expenditure) / float(released) * 100, 1) if released else 0.0,
        )
        for state, count, sanctioned, released, expenditure in state_rows
        if count >= MIN_STATE_PROJECTS_FOR_RANKING
    ]
    by_state.sort(key=lambda s: s.sanctioned_amount, reverse=True)

    return FinancialsSummaryOut(
        total_sanctioned=total_sanctioned,
        total_released=total_released,
        total_expenditure=total_expenditure,
        release_utilization_pct=round(total_released / total_sanctioned * 100, 1) if total_sanctioned else 0.0,
        expenditure_utilization_pct=round(total_expenditure / total_released * 100, 1) if total_released else 0.0,
        by_type=by_type,
        by_state=by_state,
    )


@router.get("/by-mp", response_model=FinancialsByMpOut)
def financials_by_mp(
    state: str | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> FinancialsByMpOut:
    """How many works each MP has sanctioned — public accountability view.
    mp_name isn't populated on every project (source-data gap, same as
    constituency/location elsewhere), so this reports coverage honestly
    rather than presenting the attributed subset as the whole picture."""
    total_query = db.query(Project)
    if user:
        total_query = scope_filter(total_query, user)
    if state:
        total_query = total_query.filter(Project.state == state)
    total_projects = total_query.count()

    mp_query = db.query(
        Project.state,
        Project.constituency,
        Project.mp_name,
        func.count(Project.id),
        func.coalesce(func.sum(Project.sanctioned_amount), 0),
        func.coalesce(func.sum(Project.released_amount), 0),
        func.coalesce(func.sum(Project.expenditure_amount), 0),
    ).filter(Project.mp_name.isnot(None), Project.mp_name != "")
    if user:
        mp_query = scope_filter(mp_query, user)
    if state:
        mp_query = mp_query.filter(Project.state == state)
    rows = mp_query.group_by(Project.state, Project.constituency, Project.mp_name).all()

    by_mp = [
        FinancialsByMp(
            state=state_,
            constituency=constituency,
            mp_name=mp_name,
            project_count=count,
            sanctioned_amount=float(sanctioned),
            released_amount=float(released),
            expenditure_amount=float(expenditure),
        )
        for state_, constituency, mp_name, count, sanctioned, released, expenditure in rows
    ]
    by_mp.sort(key=lambda m: m.project_count, reverse=True)
    attributed_projects = sum(m.project_count for m in by_mp)

    return FinancialsByMpOut(
        total_projects=total_projects,
        attributed_projects=attributed_projects,
        attribution_coverage_pct=round(attributed_projects / total_projects * 100, 1) if total_projects else 0.0,
        by_mp=by_mp,
    )
