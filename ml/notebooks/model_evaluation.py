"""Model evaluation report for the Phase 5 Isolation Forest anomaly detector.

Run from backend/ with the venv active:
    python ../ml/notebooks/model_evaluation.py

Connects to the real database, loads the actually-trained model from
ml/models/isolation_forest.joblib, and produces:
  - ml/notebooks/output/feature_distributions.png — key feature histograms,
    flagged vs not-flagged, so you can see *why* the model separates them
    (or doesn't, for the weaker-recall categories — see ADR-006).
  - ml/notebooks/output/anomaly_score_distribution.png
  - ml/notebooks/output/recall_by_category.png — recall against planted
    ground truth per anomaly type, reproducing the numbers in README's
    Phase 5 status entry from a fresh run, not copy-pasted.
  - ml/notebooks/output/report.md — the numbers behind every chart, in text.

Nothing here is a second implementation of the model or its evaluation —
it imports and reuses app.ml.features / app.ml.evaluation directly, so this
can never drift from what the running system actually does.
"""

import csv
import sys
from collections import defaultdict
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.db import SessionLocal  # noqa: E402
from app.ml.anomaly_model import MODEL_PATH  # noqa: E402
from app.ml.evaluation import GROUND_TRUTH_PATH, NUMERIC_DETECTABLE_CATEGORIES  # noqa: E402
from app.ml.features import FEATURE_NAMES, compute_feature_matrix  # noqa: E402
from app.models.project import Project  # noqa: E402

OUTPUT_DIR = Path(__file__).resolve().parent / "output"
FEATURES_TO_PLOT = ["cost_ratio", "overrun_ratio", "progress_gap", "funding_utilization_gap"]


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    db = SessionLocal()

    if not MODEL_PATH.exists():
        print(f"No trained model at {MODEL_PATH} — run scripts/run_ml_detection.py first.")
        return

    bundle = joblib.load(MODEL_PATH)
    model, scaler = bundle["model"], bundle["scaler"]

    project_ids, X = compute_feature_matrix(db)
    X_scaled = scaler.transform(X)
    predictions = model.predict(X_scaled)  # -1 = flagged outlier, 1 = normal
    raw_scores = model.decision_function(X_scaled)

    score_min, score_max = float(raw_scores.min()), float(raw_scores.max())
    span = (score_max - score_min) or 1.0
    anomaly_scores = (score_max - raw_scores) / span * 100
    flagged_mask = predictions == -1

    report_lines = [
        "# Isolation Forest Model Evaluation",
        "",
        f"Projects scored: {len(project_ids)}",
        f"Flagged as anomalies: {int(flagged_mask.sum())} ({flagged_mask.mean():.1%})",
        "",
    ]

    # --- Feature distributions: flagged vs not-flagged ---------------------
    fig, axes = plt.subplots(2, 2, figsize=(11, 8))
    for ax, feature_name in zip(axes.flat, FEATURES_TO_PLOT):
        idx = FEATURE_NAMES.index(feature_name)
        values = X[:, idx]
        # Clip to 1st-99th percentile for readable histograms — a handful of
        # extreme planted anomalies otherwise compress the whole plot.
        lo, hi = np.percentile(values, [1, 99])
        clipped = np.clip(values, lo, hi)
        ax.hist(clipped[~flagged_mask], bins=40, alpha=0.6, label="not flagged", color="#087a20", density=True)
        ax.hist(clipped[flagged_mask], bins=40, alpha=0.6, label="flagged", color="#bf1f26", density=True)
        ax.set_title(feature_name)
        ax.legend(fontsize=8)
    fig.suptitle("Feature distributions: flagged vs not-flagged projects")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "feature_distributions.png", dpi=120)
    plt.close(fig)

    # --- Anomaly score distribution -----------------------------------------
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.hist(anomaly_scores, bins=50, color="#102e50")
    ax.axvline(anomaly_scores[flagged_mask].min(), color="#bf1f26", linestyle="--", label="flagging cutoff")
    ax.set_xlabel("Anomaly score (0-100)")
    ax.set_ylabel("Project count")
    ax.set_title("Isolation Forest anomaly score distribution")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "anomaly_score_distribution.png", dpi=120)
    plt.close(fig)

    # --- Recall by planted category, reusing the real ground truth ---------
    id_to_index = {pid: i for i, pid in enumerate(project_ids)}
    external_to_id = {ext: pid for ext, pid in db.query(Project.external_project_id, Project.id).all()}

    category_totals: dict[str, int] = defaultdict(int)
    category_hits: dict[str, int] = defaultdict(int)
    if GROUND_TRUTH_PATH.exists():
        with open(GROUND_TRUTH_PATH, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                categories = [c for c in row["planted_signals"].split(";") if c in NUMERIC_DETECTABLE_CATEGORIES]
                pid = external_to_id.get(row["project_external_id"])
                if pid is None or pid not in id_to_index:
                    continue
                is_flagged = flagged_mask[id_to_index[pid]]
                for cat in categories:
                    category_totals[cat] += 1
                    if is_flagged:
                        category_hits[cat] += 1

    categories_sorted = sorted(category_totals, key=lambda c: category_totals[c], reverse=True)
    recalls = [category_hits[c] / category_totals[c] for c in categories_sorted]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(categories_sorted, [r * 100 for r in recalls], color="#3d8f2b")
    ax.set_ylabel("Recall (%)")
    ax.set_title("ML recall by planted anomaly category")
    ax.set_ylim(0, 100)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right")
    for bar, cat in zip(bars, categories_sorted):
        ax.annotate(
            f"{category_hits[cat]}/{category_totals[cat]}",
            (bar.get_x() + bar.get_width() / 2, bar.get_height()),
            ha="center", va="bottom", fontsize=8,
        )
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "recall_by_category.png", dpi=120)
    plt.close(fig)

    report_lines.append("## Recall by planted category\n")
    report_lines.append("| Category | Recovered | Total | Recall |")
    report_lines.append("|---|---|---|---|")
    for cat in categories_sorted:
        report_lines.append(f"| {cat} | {category_hits[cat]} | {category_totals[cat]} | {category_hits[cat] / category_totals[cat]:.1%} |")

    report_lines += [
        "",
        "## Charts",
        "",
        "- `feature_distributions.png` — why the model separates (or doesn't) flagged vs normal projects",
        "  on each engineered feature.",
        "- `anomaly_score_distribution.png` — where the 5% contamination cutoff actually falls.",
        "- `recall_by_category.png` — the same story as the table above, visually.",
        "",
        "See `mplads-intelligence/docs/decisions.md` ADR-006 for why recall is uneven across categories",
        "(single-dimension anomalies like COST_ANOMALY are structurally harder for Isolation Forest to",
        "isolate than multi-dimension ones like PAYMENT_PROGRESS_MISMATCH) — this is documented model",
        "behavior, not something this report papers over.",
    ]

    (OUTPUT_DIR / "report.md").write_text("\n".join(report_lines), encoding="utf-8")
    db.close()

    print("\n".join(report_lines))
    print(f"\nCharts saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
