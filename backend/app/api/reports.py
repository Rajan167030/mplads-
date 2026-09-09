"""CSV export endpoints (spec's Reports requirement). Streams directly from
the database — the export is always exactly what's currently stored, never a
cached or pre-generated snapshot that could drift from the live data.
"""

import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.scope import scope_filter
from app.models.investigation import Investigation
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


def _csv_response(rows: list[list], header: list[str], filename: str) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/projects.csv")
def export_projects_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    projects = scope_filter(db.query(Project), user).order_by(Project.risk_score.desc().nulls_last()).all()
    header = [
        "external_project_id", "project_name", "project_type", "state", "district", "status",
        "sanctioned_amount", "released_amount", "physical_progress", "financial_progress",
        "contractor_name", "risk_score", "risk_band",
    ]
    rows = [
        [
            p.external_project_id, p.project_name, p.project_type.value, p.state, p.district, p.status.value,
            float(p.sanctioned_amount), float(p.released_amount), p.physical_progress, p.financial_progress,
            p.contractor.name if p.contractor else "", p.risk_score, p.risk_band.value if p.risk_band else "",
        ]
        for p in projects
    ]
    return _csv_response(rows, header, "projects.csv")


@router.get("/risk-signals.csv")
def export_risk_signals_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    signals = (
        scope_filter(db.query(RiskSignal, Project).join(Project, Project.id == RiskSignal.project_id), user)
        .order_by(RiskSignal.score.desc())
        .all()
    )
    header = [
        "external_project_id", "project_name", "signal_type", "source", "severity",
        "score", "confidence", "description",
    ]
    rows = [
        [
            project.external_project_id, project.project_name, signal.signal_type.value, signal.source.value,
            signal.severity.value, signal.score, signal.confidence, signal.description,
        ]
        for signal, project in signals
    ]
    return _csv_response(rows, header, "risk_signals.csv")


@router.get("/investigations.csv")
def export_investigations_csv(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    investigations = (
        scope_filter(db.query(Investigation, Project).join(Project, Project.id == Investigation.project_id), user)
        .order_by(Investigation.created_at.desc())
        .all()
    )
    header = ["external_project_id", "project_name", "priority", "status", "resolution", "notes", "created_at"]
    rows = [
        [
            project.external_project_id, project.project_name, inv.priority.value, inv.status.value,
            inv.resolution.value if inv.resolution else "", inv.notes or "", inv.created_at.isoformat(),
        ]
        for inv, project in investigations
    ]
    return _csv_response(rows, header, "investigations.csv")
