"""Unsupervised anomaly detection (spec §9): Isolation Forest over the
peer-normalized feature matrix from app.ml.features.

This produces an `ml_anomaly_score` — explicitly a statistical-outlier score,
never described as a fraud probability. It is one more signal for the risk
engine (Phase 6) to weigh alongside rules and entity resolution, not a
verdict on its own; confidence is deliberately capped below 1.0 for exactly
that reason.
"""

from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.ml.features import FEATURE_NAMES, compute_feature_matrix
from app.models.enums import Severity, SignalSource, SignalType
from app.models.risk_signal import RiskSignal

MODEL_DIR = Path(__file__).resolve().parents[3] / "ml" / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"

CONTAMINATION = 0.05
RANDOM_STATE = 42
MIN_PROJECTS_TO_TRAIN = 20
ML_CONFIDENCE = 0.65  # unsupervised — always framed as "worth a look", never a fact


@dataclass
class MLDetectionReport:
    projects_scored: int = 0
    anomalies_flagged: int = 0
    feature_names: list[str] = field(default_factory=lambda: list(FEATURE_NAMES))


def run_ml_detection(db: Session) -> MLDetectionReport:
    report = MLDetectionReport()

    project_ids, X = compute_feature_matrix(db)
    report.projects_scored = len(project_ids)
    if len(project_ids) < MIN_PROJECTS_TO_TRAIN:
        return report

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=RANDOM_STATE)
    predictions = model.fit_predict(X_scaled)
    raw_scores = model.decision_function(X_scaled)  # higher = more normal, lower/negative = more anomalous

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "scaler": scaler, "feature_names": FEATURE_NAMES}, MODEL_PATH)

    db.query(RiskSignal).filter(RiskSignal.source == SignalSource.ML).delete()
    db.commit()

    score_min, score_max = float(raw_scores.min()), float(raw_scores.max())
    span = (score_max - score_min) or 1.0

    rows = []
    for project_id, is_outlier, raw_score, raw_features, scaled_features in zip(
        project_ids, predictions, raw_scores, X, X_scaled
    ):
        if is_outlier != -1:
            continue

        anomaly_score = round((score_max - float(raw_score)) / span * 100, 1)
        severity = (
            Severity.CRITICAL if anomaly_score >= 85 else
            Severity.HIGH if anomaly_score >= 70 else
            Severity.MEDIUM
        )

        # Rank by |z-score| (comparable across features of very different raw
        # scales), but report the human-readable raw value in the evidence.
        ranked = sorted(zip(FEATURE_NAMES, raw_features, scaled_features), key=lambda t: abs(t[2]), reverse=True)
        top_features = ranked[:4]

        rows.append(RiskSignal(
            project_id=project_id,
            signal_type=SignalType.ML_STATISTICAL_ANOMALY,
            source=SignalSource.ML,
            severity=severity,
            score=anomaly_score,
            confidence=ML_CONFIDENCE,
            description=(
                f"Isolation Forest flagged this project's numeric profile as a statistical outlier "
                f"(anomaly score {anomaly_score:.0f}/100). Most unusual features: "
                + ", ".join(f"{name}={raw_value:.2f}" for name, raw_value, _ in top_features)
            ),
            evidence={
                "anomaly_score": anomaly_score,
                "raw_isolation_score": round(float(raw_score), 4),
                "features": {name: round(float(value), 4) for name, value in zip(FEATURE_NAMES, raw_features)},
                "top_contributing_features": [
                    {"feature": name, "value": round(float(raw_value), 4), "z_score": round(float(z), 2)}
                    for name, raw_value, z in top_features
                ],
            },
        ))

    for i in range(0, len(rows), 500):
        db.add_all(rows[i:i + 500])
        db.commit()

    report.anomalies_flagged = len(rows)
    return report
