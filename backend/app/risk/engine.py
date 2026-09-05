"""Rule engine orchestration (spec §8). Runs every rule (P01-P10) and
persists results to RiskSignal, tagged by source so the UI can distinguish
rule-based signals from ML-discovered ones (Phase 5) and correlated
multi-signal cases (spec §26).

Re-running is idempotent: prior RULE/CORRELATED-sourced signals are cleared
first rather than accumulating duplicates on every run.

Order matters: P05 (contractor pattern) needs P01-P03's signals to compute
each contractor's high-risk project rate, and P10 (multi-signal) needs every
other rule's signals to already be persisted before it can correlate them.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import SignalSource
from app.models.project import Project
from app.models.risk_signal import RiskSignal
from app.risk.context import build_peer_group_index
from app.risk.contractor_intelligence import update_contractor_aggregates
from app.risk.rules import (
    p01_payment_mismatch,
    p02_cost_anomaly,
    p03_delay_anomaly,
    p04_duplicate,
    p05_contractor_pattern,
    p06_geographic_concentration,
    p07_payment_acceleration,
    p08_progress_inconsistency,
    p09_evidence_anomaly,
    p10_multi_signal,
)
from app.risk.rules.base import DetectionContext

PER_PROJECT_RULES = [p01_payment_mismatch, p02_cost_anomaly, p03_delay_anomaly]
BATCH_MODULES = [p04_duplicate, p05_contractor_pattern, p06_geographic_concentration,
                  p07_payment_acceleration, p08_progress_inconsistency, p09_evidence_anomaly]


@dataclass
class RuleEngineReport:
    projects_scanned: int = 0
    signals_created: int = 0
    by_type: dict[str, int] = field(default_factory=dict)


def _insert(db: Session, drafts: list, source: SignalSource, report: RuleEngineReport) -> None:
    rows = [
        RiskSignal(
            project_id=project_id,
            signal_type=draft.signal_type,
            source=source,
            severity=draft.severity,
            score=draft.score,
            confidence=draft.confidence,
            description=draft.description,
            evidence=draft.evidence,
        )
        for project_id, draft in drafts
    ]
    for i in range(0, len(rows), 500):
        db.add_all(rows[i:i + 500])
        db.commit()

    report.signals_created += len(rows)
    for _, draft in drafts:
        report.by_type[draft.signal_type.value] = report.by_type.get(draft.signal_type.value, 0) + 1


def run_rule_engine(db: Session) -> RuleEngineReport:
    report = RuleEngineReport()

    db.query(RiskSignal).filter(RiskSignal.source.in_((SignalSource.RULE, SignalSource.CORRELATED))).delete()
    db.commit()

    context = DetectionContext(peer_groups=build_peer_group_index(db))
    projects = db.scalars(select(Project)).all()
    report.projects_scanned = len(projects)

    per_project_drafts = []
    for project in projects:
        for rule_module in PER_PROJECT_RULES:
            draft = rule_module.detect(project, context)
            if draft is not None:
                per_project_drafts.append((project.id, draft))
    _insert(db, per_project_drafts, SignalSource.RULE, report)

    update_contractor_aggregates(db)

    for module in BATCH_MODULES:
        drafts = module.generate_signals(db)
        _insert(db, drafts, SignalSource.RULE, report)

    correlated_drafts = p10_multi_signal.generate_signals(db)
    _insert(db, correlated_drafts, SignalSource.CORRELATED, report)

    return report
