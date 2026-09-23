"""Evaluate the real-trained anomaly model on isolated labeled synthetic data.

Synthetic data is benchmark-only: it is never mixed into real training rows.
"""

import csv
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import confusion_matrix, precision_recall_fscore_support

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from train_real_data_local import build_features  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
BENCHMARK_DIR = DATA_DIR / "benchmark_synthetic"
MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "isolation_forest.joblib"
REPORT_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "synthetic_benchmark_report.json"
NUMERIC_CATEGORIES = {
    "COST_ANOMALY": "Cost / Budget Inflation",
    "DELAY_ANOMALY": "Execution Overrun & Delay",
    "PAYMENT_PROGRESS_MISMATCH": "Payment vs Progress Gap",
    "CONTRACTOR_RISK_PATTERN": "High-Risk Contractor Dominance",
    "GEOGRAPHIC_CONCENTRATION": "District Niche Monopoly",
    "EVIDENCE_ANOMALY": "Evidence / Milestone Regression",
}


def main() -> None:
    projects_path = BENCHMARK_DIR / "raw" / "projects.csv"
    payments_path = BENCHMARK_DIR / "raw" / "payments.csv"
    labels_path = BENCHMARK_DIR / "labels" / "ground_truth.csv"
    if not projects_path.exists() or not labels_path.exists():
        raise FileNotFoundError("Generate the isolated synthetic benchmark first.")

    projects = pd.read_csv(projects_path, dtype=str, keep_default_na=False)
    payments = pd.read_csv(payments_path, dtype=str, keep_default_na=False)
    model_bundle = joblib.load(MODEL_PATH)
    feature_frame = build_features(projects, payments, projects)[model_bundle["feature_names"]]
    scaled = model_bundle["scaler"].transform(feature_frame)
    predictions = model_bundle["model"].predict(scaled)
    predicted_positive = (predictions == -1)

    project_ids = projects["Project ID"].to_numpy()
    flagged_ids = set(project_ids[predicted_positive])

    category_positive_ids: dict[str, set[str]] = {cat: set() for cat in NUMERIC_CATEGORIES}
    all_positive_ids: set[str] = set()

    with labels_path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            categories = set(filter(None, row["planted_signals"].split(";")))
            pid = row["project_external_id"]
            for cat in NUMERIC_CATEGORIES:
                if cat in categories:
                    category_positive_ids[cat].add(pid)
            if categories & set(NUMERIC_CATEGORIES.keys()):
                all_positive_ids.add(pid)

    y_true = projects["Project ID"].isin(all_positive_ids).to_numpy()
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, predicted_positive, average="binary", zero_division=0
    )
    tn, fp, fn, tp = confusion_matrix(y_true, predicted_positive).ravel()

    per_category_metrics = {}
    for cat, name in NUMERIC_CATEGORIES.items():
        cat_pos = category_positive_ids[cat]
        cat_y_true = projects["Project ID"].isin(cat_pos).to_numpy()
        cat_tp = len(flagged_ids & cat_pos)
        cat_fn = len(cat_pos - flagged_ids)
        cat_recall = cat_tp / len(cat_pos) if len(cat_pos) > 0 else 0.0
        per_category_metrics[cat] = {
            "name": name,
            "total_ground_truth": len(cat_pos),
            "true_positives_caught": cat_tp,
            "missed_false_negatives": cat_fn,
            "category_recall": round(cat_recall, 4),
        }

    report = {
        "benchmark_type": "synthetic labeled benchmark only",
        "real_model_used": str(MODEL_PATH),
        "rows_loaded": int(len(projects)),
        "ground_truth_positive_rows": int(y_true.sum()),
        "model_predicted_anomalies": int(predicted_positive.sum()),
        "confusion_matrix": {
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_negatives": int(tn),
        },
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "per_category_breakdown": per_category_metrics,
        "warning": "These metrics are proxy benchmark results against isolated synthetic data and must not be presented as real-data accuracy.",
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("==========================================================")
    print("   SYNTHETIC LABELED BENCHMARK VALIDATION SCORECARD       ")
    print("==========================================================")
    print(f"Total Projects Evaluated:     {len(projects):,}")
    print(f"Ground Truth Planted Anomaly: {int(y_true.sum()):,}")
    print(f"Model Predicted Anomalies:    {int(predicted_positive.sum()):,}")
    print("----------------------------------------------------------")
    print(f"Overall Precision:            {precision:.1%}")
    print(f"Overall Recall:               {recall:.1%}")
    print(f"Overall F1-Score:             {f1:.3f}")
    print("----------------------------------------------------------")
    print("Confusion Matrix:")
    print(f"  TP: {tp:<5} | FP: {fp:<5}")
    print(f"  FN: {fn:<5} | TN: {tn:<5}")
    print("----------------------------------------------------------")
    print("Per-Category Recall Breakdown:")
    for cat, meta in per_category_metrics.items():
        print(f"  • {meta['name']:<35} : {meta['category_recall']:.1%} ({meta['true_positives_caught']}/{meta['total_ground_truth']})")
    print("==========================================================")
    print(f"Full Report Saved: {REPORT_PATH}")


if __name__ == "__main__":
    main()
