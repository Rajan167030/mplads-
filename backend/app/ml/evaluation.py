"""Evaluates the unsupervised anomaly detector against the synthetic ground
truth (spec §9). Isolation Forest never sees these labels during training —
this is purely a post-hoc check of whether its unsupervised outlier calls
line up with the anomalies actually planted in the data.

POSSIBLE_DUPLICATE-only rows are excluded from the positive set: duplicate
identity isn't a numeric-outlier phenomenon and none of the engineered
features encode it, so including it would understate precision/recall for
something the model was never positioned to catch (that's Phase 3/P04's job).
"""

import csv
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.enums import SignalSource
from app.models.project import Project
from app.models.risk_signal import RiskSignal

GROUND_TRUTH_PATH = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "ground_truth.csv"
NUMERIC_DETECTABLE_CATEGORIES = {
    "COST_ANOMALY", "DELAY_ANOMALY", "PAYMENT_PROGRESS_MISMATCH",
    "CONTRACTOR_RISK_PATTERN", "GEOGRAPHIC_CONCENTRATION", "EVIDENCE_ANOMALY",
}


@dataclass
class EvaluationReport:
    total_projects: int = 0
    planted_anomalies: int = 0
    ml_flagged: int = 0
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0


def evaluate(db: Session, ground_truth_path: Path = GROUND_TRUTH_PATH) -> EvaluationReport:
    report = EvaluationReport()
    if not ground_truth_path.exists():
        return report

    planted_external_ids: set[str] = set()
    with open(ground_truth_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            categories = set(row["planted_signals"].split(";")) if row["planted_signals"] else set()
            if categories & NUMERIC_DETECTABLE_CATEGORIES:
                planted_external_ids.add(row["project_external_id"])

    external_to_id = {ext: pid for ext, pid in db.query(Project.external_project_id, Project.id).all()}
    planted_loaded_ids = {external_to_id[e] for e in planted_external_ids if e in external_to_id}

    ml_flagged_ids = {
        row[0] for row in db.query(RiskSignal.project_id).filter(RiskSignal.source == SignalSource.ML).distinct().all()
    }

    report.total_projects = len(external_to_id)
    report.planted_anomalies = len(planted_loaded_ids)
    report.ml_flagged = len(ml_flagged_ids)

    tp = len(planted_loaded_ids & ml_flagged_ids)
    fp = len(ml_flagged_ids - planted_loaded_ids)
    fn = len(planted_loaded_ids - ml_flagged_ids)

    report.true_positives = tp
    report.false_positives = fp
    report.false_negatives = fn
    report.precision = round(tp / (tp + fp), 3) if (tp + fp) else 0.0
    report.recall = round(tp / (tp + fn), 3) if (tp + fn) else 0.0
    report.f1 = (
        round(2 * report.precision * report.recall / (report.precision + report.recall), 3)
        if (report.precision + report.recall) else 0.0
    )

    return report
