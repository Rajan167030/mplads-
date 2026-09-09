from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.ml.anomaly_model import run_ml_detection
from app.ml.evaluation import evaluate
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.ml import MLDetectionRunOut, MLEvaluationOut, ModelEvaluationOut

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/run", response_model=MLDetectionRunOut)
def trigger_ml_detection(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MINISTRY)),
) -> MLDetectionRunOut:
    report = run_ml_detection(db)
    log_audit_event(db, user.id, "RUN_ML_DETECTION", "RiskSignal", metadata={"anomalies_flagged": report.anomalies_flagged})
    return MLDetectionRunOut(
        projects_scored=report.projects_scored,
        anomalies_flagged=report.anomalies_flagged,
        feature_names=report.feature_names,
        dropped_features=report.dropped_features,
        anomalies_by_model=report.anomalies_by_model,
        consensus_flagged=report.consensus_flagged,
    )


@router.get("/evaluation", response_model=MLEvaluationOut)
def get_ml_evaluation(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> MLEvaluationOut:
    report = evaluate(db)
    return MLEvaluationOut(
        total_projects=report.total_projects,
        planted_anomalies=report.planted_anomalies,
        ml_flagged=report.ml_flagged,
        true_positives=report.true_positives,
        false_positives=report.false_positives,
        false_negatives=report.false_negatives,
        precision=report.precision,
        recall=report.recall,
        f1=report.f1,
        by_model={
            key: ModelEvaluationOut(
                flagged=m.flagged, true_positives=m.true_positives, false_positives=m.false_positives,
                false_negatives=m.false_negatives, precision=m.precision, recall=m.recall, f1=m.f1,
            )
            for key, m in report.by_model.items()
        },
    )
