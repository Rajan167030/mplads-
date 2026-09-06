"""Evaluate the full anomaly ensemble (Isolation Forest + Autoencoder +
DBSCAN + cross-model consensus voting) against the isolated labeled
synthetic benchmark — never the live dev database, and never mixed into
real training rows (same isolation `evaluate_synthetic_benchmark.py` already
established this project uses). Also reports the max-|z|-score baseline from
`ml/experiments/baseline_vs_isolation_forest.py` for the same reason that
script exists: a real ML engineering question, not an assumption — does the
ensemble actually beat both a naive baseline and Isolation Forest alone?

Run: cd backend && .venv/Scripts/python.exe scripts/evaluate_ensemble_benchmark.py
"""

import csv
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.ml import ensemble  # noqa: E402
from app.ml.evaluation import NUMERIC_DETECTABLE_CATEGORIES  # noqa: E402
from train_real_data_local import FEATURE_NAMES, build_features  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
BENCHMARK_DIR = DATA_DIR / "benchmark_synthetic"
REPORT_JSON_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "ensemble_benchmark_report.json"
REPORT_MD_PATH = Path(__file__).resolve().parents[2] / "ml" / "experiments" / "ensemble_comparison_report.md"


def _positive_ids(labels_path: Path) -> set[str]:
    positive_ids = set()
    with labels_path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            categories = set(filter(None, row["planted_signals"].split(";")))
            if categories & NUMERIC_DETECTABLE_CATEGORIES:
                positive_ids.add(row["project_external_id"])
    return positive_ids


def _prf(flagged_ids: set, positive_ids: set) -> dict:
    tp = len(flagged_ids & positive_ids)
    fp = len(flagged_ids - positive_ids)
    fn = len(positive_ids - flagged_ids)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {"flagged": len(flagged_ids), "tp": tp, "fp": fp, "fn": fn,
            "precision": round(precision, 3), "recall": round(recall, 3), "f1": round(f1, 3)}


def _per_category_recall(flagged_ids: set, labels_path: Path) -> dict[str, tuple[int, int]]:
    totals: dict[str, int] = {}
    hits: dict[str, int] = {}
    with labels_path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            categories = [c for c in row["planted_signals"].split(";") if c in NUMERIC_DETECTABLE_CATEGORIES]
            pid = row["project_external_id"]
            for cat in categories:
                totals[cat] = totals.get(cat, 0) + 1
                if pid in flagged_ids:
                    hits[cat] = hits.get(cat, 0) + 1
    return {cat: (hits.get(cat, 0), totals[cat]) for cat in totals}


def main() -> None:
    projects_path = BENCHMARK_DIR / "raw" / "projects.csv"
    payments_path = BENCHMARK_DIR / "raw" / "payments.csv"
    labels_path = BENCHMARK_DIR / "labels" / "ground_truth.csv"
    if not projects_path.exists() or not labels_path.exists():
        raise FileNotFoundError("Isolated synthetic benchmark not found under data/benchmark_synthetic/.")

    projects = pd.read_csv(projects_path, dtype=str, keep_default_na=False)
    payments = pd.read_csv(payments_path, dtype=str, keep_default_na=False)
    external_ids = projects["Project ID"].to_numpy()
    positive_ids = _positive_ids(labels_path)

    feature_frame = build_features(projects, payments, projects)
    X = feature_frame.to_numpy()
    X_kept, kept_names, dropped_names = ensemble.drop_dead_features(X, FEATURE_NAMES)
    X_scaled, _ = ensemble.scale(X_kept)

    n = len(external_ids)
    n_to_flag = max(1, int(n * ensemble.CONTAMINATION))

    # Baseline: same flagging rate, max-|scaled value| across all kept features.
    max_abs = np.max(np.abs(X_scaled), axis=1)
    baseline_ids = set(external_ids[np.argsort(max_abs)[-n_to_flag:]])

    _, if_outlier, if_model = ensemble.fit_isolation_forest(X_scaled)
    _, ae_outlier, ae_model = ensemble.fit_autoencoder(X_scaled)
    _, db_outlier, db_meta = ensemble.fit_dbscan(X_scaled)

    if_ids = set(external_ids[if_outlier])
    ae_ids = set(external_ids[ae_outlier])
    db_ids = set(external_ids[db_outlier])
    ensemble_any_ids = if_ids | ae_ids | db_ids
    agreement_count = if_outlier.astype(int) + ae_outlier.astype(int) + db_outlier.astype(int)
    consensus_ids = set(external_ids[agreement_count >= 2])

    results = {
        "baseline_max_z": _prf(baseline_ids, positive_ids),
        "isolation_forest": _prf(if_ids, positive_ids),
        "autoencoder": _prf(ae_ids, positive_ids),
        "dbscan": _prf(db_ids, positive_ids),
        "ensemble_any": _prf(ensemble_any_ids, positive_ids),
        "ensemble_consensus_2_of_3": _prf(consensus_ids, positive_ids),
    }

    report = {
        "benchmark_type": "isolated synthetic benchmark only — never mixed into real training rows",
        "rows": int(n),
        "ground_truth_positive_rows": len(positive_ids),
        "kept_features": kept_names,
        "dropped_features": dropped_names,
        "dbscan_meta": {k: v for k, v in db_meta.items() if k != "centroids"},
        "results": results,
        "warning": "Proxy benchmark results on synthetic data; must not be presented as real-data accuracy.",
    }
    REPORT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")

    per_category = {
        "Baseline": _per_category_recall(baseline_ids, labels_path),
        "Isolation Forest": _per_category_recall(if_ids, labels_path),
        "Autoencoder": _per_category_recall(ae_ids, labels_path),
        "DBSCAN": _per_category_recall(db_ids, labels_path),
        "Ensemble (any of 3)": _per_category_recall(ensemble_any_ids, labels_path),
        "Ensemble (>=2 agree)": _per_category_recall(consensus_ids, labels_path),
    }
    categories = sorted({cat for table in per_category.values() for cat in table})

    lines = [
        "# Ensemble Comparison — Isolation Forest vs. Autoencoder vs. DBSCAN vs. combined",
        "",
        f"Projects: {n}  |  Ground truth positives (numeric-detectable categories): {len(positive_ids)}",
        f"Dropped (near-zero-variance) features: {', '.join(dropped_names) or 'none'}",
        "",
        "## Overall",
        "",
        "| Detector | Flagged | Precision | Recall | F1 |",
        "|---|---|---|---|---|",
    ]
    for key, label in (
        ("baseline_max_z", "Max-|z|-score baseline"),
        ("isolation_forest", "Isolation Forest"),
        ("autoencoder", "Autoencoder"),
        ("dbscan", "DBSCAN"),
        ("ensemble_any", "Ensemble — any of 3"),
        ("ensemble_consensus_2_of_3", "Ensemble — >=2 of 3 agree"),
    ):
        r = results[key]
        lines.append(f"| {label} | {r['flagged']} | {r['precision']:.1%} | {r['recall']:.1%} | {r['f1']:.3f} |")

    lines += ["", "## Per-category recall", "", "| Category | " + " | ".join(per_category) + " |",
              "|---|" + "---|" * len(per_category)]
    for cat in categories:
        row = [cat]
        for label in per_category:
            hits, total = per_category[label].get(cat, (0, 0))
            row.append(f"{hits}/{total} ({hits / total:.0%})" if total else "—")
        lines.append("| " + " | ".join(row) + " |")

    best = max(results, key=lambda k: results[k]["f1"])
    lines += ["", f"**Best F1: {best} ({results[best]['f1']:.3f}).**"]

    REPORT_MD_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD_PATH.write_text("\n".join(lines), encoding="utf-8")

    print("\n".join(lines))
    print(f"\nJSON report: {REPORT_JSON_PATH}")
    print(f"Markdown report: {REPORT_MD_PATH}")


if __name__ == "__main__":
    main()
