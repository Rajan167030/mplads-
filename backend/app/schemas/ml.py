from pydantic import BaseModel


class MLDetectionRunOut(BaseModel):
    projects_scored: int
    anomalies_flagged: int
    feature_names: list[str]


class MLEvaluationOut(BaseModel):
    total_projects: int
    planted_anomalies: int
    ml_flagged: int
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1: float
