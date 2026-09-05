"""Experiment: does Isolation Forest actually beat a dead-simple baseline?

A real ML engineering question worth answering honestly rather than assuming
"more sophisticated = better": a naive per-feature z-score rule ("flag if any
single engineered feature is more than T standard deviations from the mean")
is far cheaper to build, explain, and audit than a multivariate model. If it
matched Isolation Forest's precision/recall, that would be a real argument
against using ML here at all — Phase 4's rule engine already does exactly
this kind of single-feature thresholding, explicitly and auditably.

Run from backend/ with the venv active:
    python ../ml/experiments/baseline_vs_isolation_forest.py

Both detectors are evaluated on the exact same feature matrix and ground
truth as app.ml.evaluation, at the same ~5% flagging rate, so the comparison
is apples-to-apples.
"""

import csv
import sys
from pathlib import Path

import numpy as np
from sklearn.preprocessing import StandardScaler

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.db import SessionLocal  # noqa: E402
from app.ml.anomaly_model import CONTAMINATION, RANDOM_STATE  # noqa: E402
from app.ml.evaluation import GROUND_TRUTH_PATH, NUMERIC_DETECTABLE_CATEGORIES  # noqa: E402
from app.ml.features import FEATURE_NAMES, compute_feature_matrix  # noqa: E402
from app.models.project import Project  # noqa: E402


def load_ground_truth_positive_set(external_to_id: dict) -> set:
    positives = set()
    if not GROUND_TRUTH_PATH.exists():
        return positives
    with open(GROUND_TRUTH_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            categories = set(row["planted_signals"].split(";")) if row["planted_signals"] else set()
            if categories & NUMERIC_DETECTABLE_CATEGORIES and row["project_external_id"] in external_to_id:
                positives.add(external_to_id[row["project_external_id"]])
    return positives


def precision_recall_f1(flagged_ids: set, positive_ids: set) -> tuple[float, float, float]:
    tp = len(flagged_ids & positive_ids)
    fp = len(flagged_ids - positive_ids)
    fn = len(positive_ids - flagged_ids)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return precision, recall, f1


def main() -> None:
    db = SessionLocal()
    project_ids, X = compute_feature_matrix(db)
    external_to_id = {ext: pid for ext, pid in db.query(Project.external_project_id, Project.id).all()}
    positive_ids = load_ground_truth_positive_set(external_to_id)
    n = len(project_ids)
    n_to_flag = max(1, int(n * CONTAMINATION))

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # --- Isolation Forest (the real, deployed model) ------------------------
    from sklearn.ensemble import IsolationForest

    iso = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=RANDOM_STATE)
    iso_predictions = iso.fit_predict(X_scaled)
    iso_flagged = {pid for pid, pred in zip(project_ids, iso_predictions) if pred == -1}
    iso_metrics = precision_recall_f1(iso_flagged, positive_ids)

    # --- Baseline: flag by max absolute z-score across all features --------
    # Same flagging *rate* as Isolation Forest (top n_to_flag by max |z|), so
    # the comparison isn't confounded by one detector simply flagging more.
    max_abs_z = np.max(np.abs(X_scaled), axis=1)
    baseline_flag_indices = np.argsort(max_abs_z)[-n_to_flag:]
    baseline_flagged = {project_ids[i] for i in baseline_flag_indices}
    baseline_metrics = precision_recall_f1(baseline_flagged, positive_ids)

    # --- Per-category recall for both, for a category-level view -----------
    def per_category_recall(flagged_ids: set) -> dict[str, tuple[int, int]]:
        totals: dict[str, int] = {}
        hits: dict[str, int] = {}
        with open(GROUND_TRUTH_PATH, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                categories = [c for c in row["planted_signals"].split(";") if c in NUMERIC_DETECTABLE_CATEGORIES]
                pid = external_to_id.get(row["project_external_id"])
                if pid is None:
                    continue
                for cat in categories:
                    totals[cat] = totals.get(cat, 0) + 1
                    if pid in flagged_ids:
                        hits[cat] = hits.get(cat, 0) + 1
        return {cat: (hits.get(cat, 0), totals[cat]) for cat in totals}

    iso_by_cat = per_category_recall(iso_flagged)
    baseline_by_cat = per_category_recall(baseline_flagged)

    lines = [
        "# Baseline vs. Isolation Forest",
        "",
        f"Projects: {n}  |  Flagged by each detector: {n_to_flag} (matched rate, {CONTAMINATION:.0%})",
        f"Ground truth positives (numeric-detectable categories): {len(positive_ids)}",
        "",
        "## Overall",
        "",
        "| Detector | Precision | Recall | F1 |",
        "|---|---|---|---|",
        f"| Isolation Forest | {iso_metrics[0]:.1%} | {iso_metrics[1]:.1%} | {iso_metrics[2]:.3f} |",
        f"| Max-|z|-score baseline | {baseline_metrics[0]:.1%} | {baseline_metrics[1]:.1%} | {baseline_metrics[2]:.3f} |",
        "",
        "## Per-category recall",
        "",
        "| Category | Isolation Forest | Baseline |",
        "|---|---|---|",
    ]
    for cat in sorted(iso_by_cat):
        ih, it = iso_by_cat[cat]
        bh, bt = baseline_by_cat.get(cat, (0, it))
        lines.append(f"| {cat} | {ih}/{it} ({ih / it:.0%}) | {bh}/{bt} ({bh / bt:.0%}) |")

    verdict = "Isolation Forest wins on F1" if iso_metrics[2] > baseline_metrics[2] else (
        "The baseline matches or beats Isolation Forest on F1" if baseline_metrics[2] >= iso_metrics[2] else "tie"
    )
    lines += ["", f"**Verdict: {verdict}.**"]

    output_path = Path(__file__).resolve().parent / "baseline_comparison_report.md"
    output_path.write_text("\n".join(lines), encoding="utf-8")
    db.close()

    print("\n".join(lines))
    print(f"\nSaved to {output_path}")


if __name__ == "__main__":
    main()
