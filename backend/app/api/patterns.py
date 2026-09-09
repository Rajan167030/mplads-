from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user_optional
from app.core.scope import scope_filter
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.models.user import User
from app.schemas.pattern import PatternSummary, PatternSummaryOut

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("/summary", response_model=PatternSummaryOut)
def pattern_summary(
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> PatternSummaryOut:
    query = db.query(RiskSignal.signal_type, RiskSignal.source, RiskSignal.score, Project.state).join(
        Project, Project.id == RiskSignal.project_id
    )
    if user:
        query = scope_filter(query, user)
    rows = query.all()

    grouped: dict[tuple[str, str], list] = defaultdict(list)
    for signal_type, source, score, state in rows:
        grouped[(signal_type.value, source.value)].append((score, state))

    patterns = []
    for (signal_type, source), entries in grouped.items():
        state_counts: dict[str, int] = defaultdict(int)
        for _, state in entries:
            state_counts[state] += 1
        top_states = sorted(state_counts, key=state_counts.get, reverse=True)[:3]

        patterns.append(PatternSummary(
            signal_type=signal_type,
            source=source,
            count=len(entries),
            average_score=round(sum(s for s, _ in entries) / len(entries), 1),
            top_states=top_states,
        ))

    patterns.sort(key=lambda p: p.count, reverse=True)
    return PatternSummaryOut(total_signals=len(rows), patterns=patterns)
