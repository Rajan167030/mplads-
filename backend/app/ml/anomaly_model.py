"""Unsupervised anomaly detection (spec §9): an ensemble of three detectors
(app.ml.ensemble — Isolation Forest, Autoencoder, DBSCAN) over the
peer-normalized, dead-feature-pruned feature matrix from app.ml.features.

This produces `ml_*` signals — explicitly statistical-outlier scores, never
described as a fraud probability. Each is one more signal for the risk engine
(Phase 6) to weigh alongside rules and entity resolution, not a verdict on
its own; confidence is deliberately capped below 1.0 for exactly that reason.
Agreement across detectors (app.risk.rules.ml_consensus) is scored
separately and persisted as a CORRELATED signal, feeding the same noisy-OR
combiner as everything else rather than a second, parallel scoring path.
"""

from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
from sqlalchemy.orm import Session

from app.ml import ensemble
from app.ml.explainability import explain_flagged_rows
from app.ml.features import FEATURE_NAMES, compute_feature_matrix
from app.models.enums import Severity, SignalSource, SignalType
from app.models.risk_signal import RiskSignal
from app.risk.rules import ml_consensus

MODEL_DIR = Path(__file__).resolve().parents[3] / "ml" / "models"
MODEL_PATH = MODEL_DIR / "ensemble.joblib"

MIN_PROJECTS_TO_TRAIN = 20
ML_CONFIDENCE = 0.65  # unsupervised — always framed as "worth a look", never a fact

# SHAP's permutation explainer costs ~background_size * (2*features+1) score
# evaluations *per explained row* — real, not free, even with a small
# background sample. Every flagged project still gets a score/severity;
# only the SHAP feature breakdown is capped to the most severe cases per
# model so a full run stays bounded when hundreds of projects are flagged.
MAX_EXPLAINED_PER_MODEL = 40

MODEL_SIGNAL_TYPES = {
    "isolation_forest": SignalType.ML_STATISTICAL_ANOMALY,
    "autoencoder": SignalType.ML_AUTOENCODER_ANOMALY,
    "dbscan": SignalType.ML_CLUSTER_OUTLIER,
}
MODEL_LABELS = {
    "isolation_forest": "Isolation Forest",
    "autoencoder": "Autoencoder (reconstruction error)",
    "dbscan": "DBSCAN (density-based clustering)",
}


@dataclass
class MLDetectionReport:
    projects_scored: int = 0
    anomalies_flagged: int = 0
    feature_names: list[str] = field(default_factory=lambda: list(FEATURE_NAMES))
    dropped_features: list[str] = field(default_factory=list)
    anomalies_by_model: dict[str, int] = field(default_factory=dict)
    consensus_flagged: int = 0


def _severity_for(score: float) -> Severity:
    return Severity.CRITICAL if score >= 85 else Severity.HIGH if score >= 70 else Severity.MEDIUM


def run_ml_detection(db: Session) -> MLDetectionReport:
    report = MLDetectionReport()

    project_ids, X = compute_feature_matrix(db)
    report.projects_scored = len(project_ids)
    if len(project_ids) < MIN_PROJECTS_TO_TRAIN:
        return report

    X_kept, kept_names, dropped_names = ensemble.drop_dead_features(X, FEATURE_NAMES)
    report.dropped_features = dropped_names
    X_scaled, scaler = ensemble.scale(X_kept)

    if_scores, if_outliers, if_model = ensemble.fit_isolation_forest(X_scaled)
    ae_scores, ae_outliers, ae_model = ensemble.fit_autoencoder(X_scaled)
    db_scores, db_outliers, db_meta = ensemble.fit_dbscan(X_scaled)

    models = {
        "isolation_forest": (if_scores, if_outliers, ensemble.isolation_forest_score_fn(if_model)),
        "autoencoder": (ae_scores, ae_outliers, ensemble.autoencoder_score_fn(ae_model)),
        "dbscan": (db_scores, db_outliers, ensemble.dbscan_score_fn(db_meta["centroids"])),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "isolation_forest": if_model, "autoencoder": ae_model, "dbscan_meta": db_meta,
        "scaler": scaler, "kept_feature_names": kept_names, "dropped_feature_names": dropped_names,
    }, MODEL_PATH)

    db.query(RiskSignal).filter(RiskSignal.source == SignalSource.ML).delete()
    db.query(RiskSignal).filter(RiskSignal.signal_type == SignalType.ML_ENSEMBLE_CONSENSUS).delete()
    db.commit()

    rows = []
    for model_key, (raw_scores, is_outlier, score_fn) in models.items():
        normalized = ensemble.normalize_scores(raw_scores)
        flagged_indices = np.where(is_outlier)[0]
        report.anomalies_by_model[model_key] = int(len(flagged_indices))

        explain_indices = flagged_indices[np.argsort(-normalized[flagged_indices])][:MAX_EXPLAINED_PER_MODEL]
        explanations = explain_flagged_rows(score_fn, X_scaled, explain_indices, kept_names)

        for idx in flagged_indices:
            score = round(float(normalized[idx]), 1)
            top_features = explanations.get(int(idx), [])
            feature_clause = (
                "Most contributing features: " + ", ".join(f"{name} ({value:+.3f})" for name, value in top_features)
                if top_features else "Below the per-run SHAP explanation cutoff (see evidence.features for raw values)."
            )
            rows.append(RiskSignal(
                project_id=project_ids[idx],
                signal_type=MODEL_SIGNAL_TYPES[model_key],
                source=SignalSource.ML,
                severity=_severity_for(score),
                score=score,
                confidence=ML_CONFIDENCE,
                description=(
                    f"{MODEL_LABELS[model_key]} flagged this project's numeric profile as a statistical "
                    f"outlier (anomaly score {score:.0f}/100). {feature_clause}"
                ),
                evidence={
                    "anomaly_score": score,
                    "model": model_key,
                    "features": {name: round(float(value), 4) for name, value in zip(kept_names, X_kept[idx])},
                    "shap_contributions": [
                        {"feature": name, "contribution": round(value, 4)} for name, value in top_features
                    ],
                },
            ))

    for i in range(0, len(rows), 500):
        db.add_all(rows[i:i + 500])
        db.commit()

    consensus_drafts = ml_consensus.generate_signals(db)
    consensus_rows = [
        RiskSignal(
            project_id=project_id, signal_type=draft.signal_type, source=SignalSource.CORRELATED,
            severity=draft.severity, score=draft.score, confidence=draft.confidence,
            description=draft.description, evidence=draft.evidence,
        )
        for project_id, draft in consensus_drafts
    ]
    for i in range(0, len(consensus_rows), 500):
        db.add_all(consensus_rows[i:i + 500])
        db.commit()
    report.consensus_flagged = len(consensus_rows)

    report.anomalies_flagged = len(rows)
    return report
