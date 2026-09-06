"""Evaluates the unsupervised anomaly ensemble against the synthetic ground
truth (spec §9). None of the three detectors ever see these labels during
training — this is purely a post-hoc check of whether their unsupervised
outlier calls line up with the anomalies actually planted in the data,
reported both combined (any ML source) and broken down per detector plus the
cross-model consensus signal, so it's clear whether any one model is
carrying the ensemble or dragging it down.

POSSIBLE_DUPLICATE-only rows are excluded from the positive set: duplicate
identity isn't a numeric-outlier phenomenon and none of the engineered
features encode it, so including it would understate precision/recall for
something the model was never positioned to catch (that's Phase 3/P04's job).
"""

import csv
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.enums import SignalSource, SignalType
from app.models.project import Project
from app.models.risk_signal import RiskSignal

GROUND_TRUTH_PATH = Path(__file__).resolve().parents[3] / "data" / "synthetic" / "ground_truth.csv"
NUMERIC_DETECTABLE_CATEGORIES = {
    "COST_ANOMALY", "DELAY_ANOMALY", "PAYMENT_PROGRESS_MISMATCH",
    "CONTRACTOR_RISK_PATTERN", "GEOGRAPHIC_CONCENTRATION", "EVIDENCE_ANOMALY",
}

PER_MODEL_SIGNAL_TYPES = {
    "isolation_forest": SignalType.ML_STATISTICAL_ANOMALY,
    "autoencoder": SignalType.ML_AUTOENCODER_ANOMALY,
    "dbscan": SignalType.ML_CLUSTER_OUTLIER,
    "ml_consensus": SignalType.ML_ENSEMBLE_CONSENSUS,
}


@dataclass
class ModelEvaluation:
    flagged: int = 0
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0


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
    by_model: dict[str, ModelEvaluation] = field(default_factory=dict)


def _prf(flagged_ids: set, positive_ids: set) -> tuple[int, int, int, float, float, float]:
    tp = len(flagged_ids & positive_ids)
    fp = len(flagged_ids - positive_ids)
    fn = len(positive_ids - flagged_ids)
    precision = round(tp / (tp + fp), 3) if (tp + fp) else 0.0
    recall = round(tp / (tp + fn), 3) if (tp + fn) else 0.0
    f1 = round(2 * precision * recall / (precision + recall), 3) if (precision + recall) else 0.0
    return tp, fp, fn, precision, recall, f1


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

    report.total_projects = len(external_to_id)
    report.planted_anomalies = len(planted_loaded_ids)

    ml_flagged_ids = {
        row[0] for row in db.query(RiskSignal.project_id).filter(RiskSignal.source == SignalSource.ML).distinct().all()
    }
    report.ml_flagged = len(ml_flagged_ids)
    (report.true_positives, report.false_positives, report.false_negatives,
     report.precision, report.recall, report.f1) = _prf(ml_flagged_ids, planted_loaded_ids)

    for model_key, signal_type in PER_MODEL_SIGNAL_TYPES.items():
        flagged_ids = {
            row[0] for row in db.query(RiskSignal.project_id)
            .filter(RiskSignal.signal_type == signal_type).distinct().all()
        }
        tp, fp, fn, precision, recall, f1 = _prf(flagged_ids, planted_loaded_ids)
        report.by_model[model_key] = ModelEvaluation(
            flagged=len(flagged_ids), true_positives=tp, false_positives=fp, false_negatives=fn,
            precision=precision, recall=recall, f1=f1,
        )

    return report
