from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.project import Project
from app.schemas.financials import FinancialsByType, FinancialsSummaryOut

router = APIRouter(prefix="/financials", tags=["financials"])


@router.get("/summary", response_model=FinancialsSummaryOut)
def financials_summary(db: Session = Depends(get_db)) -> FinancialsSummaryOut:
    totals = db.query(
        func.coalesce(func.sum(Project.sanctioned_amount), 0),
        func.coalesce(func.sum(Project.released_amount), 0),
        func.coalesce(func.sum(Project.expenditure_amount), 0),
    ).one()
    total_sanctioned, total_released, total_expenditure = (float(x) for x in totals)

    rows = (
        db.query(
            Project.project_type,
            func.count(Project.id),
            func.coalesce(func.sum(Project.sanctioned_amount), 0),
            func.coalesce(func.sum(Project.released_amount), 0),
            func.coalesce(func.sum(Project.expenditure_amount), 0),
        )
        .group_by(Project.project_type)
        .all()
    )
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

    return FinancialsSummaryOut(
        total_sanctioned=total_sanctioned,
        total_released=total_released,
        total_expenditure=total_expenditure,
        release_utilization_pct=round(total_released / total_sanctioned * 100, 1) if total_sanctioned else 0.0,
        expenditure_utilization_pct=round(total_expenditure / total_released * 100, 1) if total_released else 0.0,
        by_type=by_type,
    )
