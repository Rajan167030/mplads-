"""Evaluate the real-trained anomaly model on isolated labeled synthetic data.

Synthetic data is benchmark-only: it is never mixed into real training rows.
"""

import csv
import json
import sys
from pathlib import Path

import joblib
from sklearn.metrics import precision_recall_fscore_support

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from train_real_data_local import build_features  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
BENCHMARK_DIR = DATA_DIR / "benchmark_synthetic"
MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "isolation_forest.joblib"
REPORT_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "synthetic_benchmark_report.json"
NUMERIC_CATEGORIES = {
    "COST_ANOMALY",
    "DELAY_ANOMALY",
    "PAYMENT_PROGRESS_MISMATCH",
    "CONTRACTOR_RISK_PATTERN",
    "GEOGRAPHIC_CONCENTRATION",
    "EVIDENCE_ANOMALY",
}


def main() -> None:
    projects_path = BENCHMARK_DIR / "raw" / "projects.csv"
    payments_path = BENCHMARK_DIR / "raw" / "payments.csv"
    labels_path = BENCHMARK_DIR / "labels" / "ground_truth.csv"
    if not projects_path.exists() or not labels_path.exists():
        raise FileNotFoundError("Generate the isolated synthetic benchmark first.")

    projects = __import__("pandas").read_csv(projects_path, dtype=str, keep_default_na=False)
    payments = __import__("pandas").read_csv(payments_path, dtype=str, keep_default_na=False)
    model_bundle = joblib.load(MODEL_PATH)
    feature_frame = build_features(projects, payments, projects)[model_bundle["feature_names"]]
    scaled = model_bundle["scaler"].transform(feature_frame)
    predictions = model_bundle["model"].predict(scaled)
    predicted_positive = predictions == -1

    positive_ids = set()
    with labels_path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            categories = set(filter(None, row["planted_signals"].split(";")))
            if categories & NUMERIC_CATEGORIES:
                positive_ids.add(row["project_external_id"])
    y_true = projects["Project ID"].isin(positive_ids).to_numpy()
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, predicted_positive, average="binary", zero_division=0
    )
    report = {
        "benchmark_type": "synthetic labeled benchmark only",
        "real_model_used": str(MODEL_PATH),
        "rows_loaded": int(len(projects)),
        "ground_truth_positive_rows": int(y_true.sum()),
        "model_predicted_anomalies": int(predicted_positive.sum()),
        "numeric_categories": sorted(NUMERIC_CATEGORIES),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "warning": "These metrics are proxy benchmark results and must not be presented as real-data accuracy.",
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Synthetic benchmark evaluation complete")
    print(f"Rows:      {len(projects)}")
    print(f"Precision: {precision:.1%}")
    print(f"Recall:    {recall:.1%}")
    print(f"F1:        {f1:.3f}")
    print(f"Report:    {REPORT_PATH}")


if __name__ == "__main__":
    main()
