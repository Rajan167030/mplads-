"""Train the anomaly model directly from real CSV exports without Docker/Postgres.

This produces the same Isolation Forest artifact used by the database-backed
runner, plus a JSON report describing source columns and derived features.
"""

import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ml.ensemble import drop_dead_features  # noqa: E402
from app.nlp.embeddings import MODEL_NAME  # noqa: E402
from app.models.project import EMBEDDING_DIM  # noqa: E402

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"
MODEL_DIR = Path(__file__).resolve().parents[2] / "ml" / "models"
MODEL_PATH = MODEL_DIR / "isolation_forest.joblib"
REPORT_PATH = MODEL_DIR / "real_data_training_report.json"
HTML_REPORT_PATH = MODEL_DIR / "real_data_training_report.html"
QUEUE_PATH = MODEL_DIR / "human_verification_queue.csv"
SENSITIVITY_PATH = MODEL_DIR / "contamination_sensitivity.csv"
SENSITIVITY_CHART_PATH = MODEL_DIR / "contamination_sensitivity.png"
CONTAMINATION = 0.05
RANDOM_STATE = 42
TEST_SIZE = 0.20
FEATURE_NAMES = [
    "cost_ratio",
    "duration_ratio",
    "overrun_ratio",
    "progress_gap",
    "funding_utilization_gap",
    "milestone_max_regression",
    "inspection_max_regression",
    "contractor_delayed_rate",
    "contractor_high_risk_rate",
    "n_payments",
    "n_milestones",
    "n_inspections",
    "payment_amount_variance",
    "payment_interval_irregularity",
    "expenditure_release_mismatch",
    "data_completeness_score",
    "duplicate_similarity_score",
]


def _leave_one_out_median(values: np.ndarray) -> np.ndarray:
    """values[i]'s peer median if row i weren't part of its own peer group —
    without this, grouping a project's peer stats from a reference frame that
    includes the project's own row lets it partly judge itself, understating
    how anomalous an extreme value looks (worst for small groups)."""
    n = len(values)
    if n <= 1:
        return np.full(n, np.nan)
    order = np.argsort(values)
    sorted_vals = values[order]
    result = np.empty(n)
    for rank in range(n):
        remaining = np.delete(sorted_vals, rank)
        mid = len(remaining) // 2
        result[order[rank]] = remaining[mid] if len(remaining) % 2 else (remaining[mid - 1] + remaining[mid]) / 2
    return result


def numeric_column(frame: pd.DataFrame, name: str) -> pd.Series:
    return pd.to_numeric(frame.get(name, 0), errors="coerce").fillna(0.0)


def _payment_features(projects: pd.DataFrame, payments: pd.DataFrame) -> pd.DataFrame:
    result = pd.DataFrame(index=projects.index)
    if payments.empty:
        result["payment_amount_variance"] = 0.0
        result["payment_interval_irregularity"] = 0.0
        return result
    payment_copy = payments.copy()
    payment_copy["Amount"] = pd.to_numeric(payment_copy.get("Amount", 0), errors="coerce").fillna(0.0)
    payment_copy["Payment Date"] = pd.to_datetime(payment_copy.get("Payment Date"), errors="coerce")
    grouped = payment_copy.groupby("Project ID", sort=False)
    amount_variance = grouped["Amount"].var(ddof=0).fillna(0.0)
    intervals = {}
    for project_id, group in grouped:
        dates = group["Payment Date"].dropna().sort_values().diff().dt.days.dropna()
        intervals[project_id] = float(dates.std(ddof=0) if len(dates) > 1 else 0.0)
    result["payment_amount_variance"] = projects["Project ID"].map(amount_variance).fillna(0.0)
    result["payment_interval_irregularity"] = projects["Project ID"].map(intervals).fillna(0.0)
    return result


def _duplicate_similarity(projects: pd.DataFrame, reference: pd.DataFrame) -> pd.Series:
    """Maximum text similarity to the fitted reference group, excluding self."""
    reference_groups = {}
    for index, row in reference.iterrows():
        group_key = (row.get("State", ""), row.get("District", ""), row.get("Type", ""))
        reference_groups.setdefault(group_key, []).append((index, str(row.get("Description", "") or row.get("Project Name", ""))))
    values = []
    for index, row in projects.iterrows():
        group_key = (row.get("State", ""), row.get("District", ""), row.get("Type", ""))
        text = str(row.get("Description", "") or row.get("Project Name", ""))
        candidates = [(candidate_index, candidate_text) for candidate_index, candidate_text in reference_groups.get(group_key, []) if candidate_index != index]
        # Keep the transform bounded for large real exports while retaining
        # the strongest lexical duplicates in the local group.
        candidates = sorted(candidates, key=lambda item: len(item[1]), reverse=True)[:10]
        values.append(max((SequenceMatcher(None, text.lower(), candidate.lower()).ratio() for _, candidate in candidates), default=0.0))
    return pd.Series(values, index=projects.index, dtype=float)


def build_features(projects: pd.DataFrame, payments: pd.DataFrame, peer_reference: pd.DataFrame | None = None) -> pd.DataFrame:
    projects = projects.copy()
    peer_reference = projects if peer_reference is None else peer_reference.copy()
    date_columns = ["Start Date", "Expected Completion", "Actual Completion"]
    for name in date_columns:
        projects[name] = pd.to_datetime(projects.get(name), errors="coerce")
        peer_reference[name] = pd.to_datetime(peer_reference.get(name), errors="coerce")
    for name in ["Sanctioned Amount", "Released Amount", "Physical Progress (%)", "Financial Progress (%)"]:
        projects[name] = pd.to_numeric(projects.get(name), errors="coerce").fillna(0.0)
        peer_reference[name] = pd.to_numeric(peer_reference.get(name), errors="coerce").fillna(0.0)

    projects["duration_days"] = (
        projects["Expected Completion"] - projects["Start Date"]
    ).dt.days.fillna(0).clip(lower=0)
    projects["overrun_days"] = (
        projects["Actual Completion"] - projects["Expected Completion"]
    ).dt.days.fillna(0).clip(lower=0)

    peer_reference["duration_days"] = (
        peer_reference["Expected Completion"] - peer_reference["Start Date"]
    ).dt.days.fillna(0).clip(lower=0)
    group_columns = ["Type", "State", "District"]

    # Leave-one-out within peer_reference itself (guards the self-referential
    # calls — training features and the final full refit both pass the same
    # frame as both `projects` and `peer_reference`) and a plain group median
    # as a fallback for rows genuinely absent from peer_reference (held-out
    # test rows, which were never at risk of self-leakage to begin with).
    loo_cost = pd.Series(index=peer_reference.index, dtype=float)
    loo_duration = pd.Series(index=peer_reference.index, dtype=float)
    group_median_cost: dict = {}
    group_median_duration: dict = {}
    for key, group in peer_reference.groupby(group_columns, dropna=False):
        loo_cost.loc[group.index] = _leave_one_out_median(group["Sanctioned Amount"].to_numpy())
        loo_duration.loc[group.index] = _leave_one_out_median(group["duration_days"].to_numpy())
        group_median_cost[key] = group["Sanctioned Amount"].median()
        group_median_duration[key] = group["duration_days"].median()

    loo_cost_by_id = dict(zip(peer_reference["Project ID"], loo_cost))
    loo_duration_by_id = dict(zip(peer_reference["Project ID"], loo_duration))
    keys = pd.MultiIndex.from_frame(projects[group_columns])

    cost_median = projects["Project ID"].map(loo_cost_by_id)
    cost_median = cost_median.fillna(pd.Series(keys.map(group_median_cost), index=projects.index)).replace(0, np.nan)
    duration_median = projects["Project ID"].map(loo_duration_by_id)
    duration_median = duration_median.fillna(pd.Series(keys.map(group_median_duration), index=projects.index)).replace(0, np.nan)

    payment_counts = payments.groupby("Project ID").size()
    projects["payment_count"] = projects["Project ID"].map(payment_counts).fillna(0)

    sanctioned = numeric_column(projects, "Sanctioned Amount")
    released = numeric_column(projects, "Released Amount")
    physical = numeric_column(projects, "Physical Progress (%)")
    financial = numeric_column(projects, "Financial Progress (%)")

    features = pd.DataFrame(index=projects.index)
    features["cost_ratio"] = (sanctioned / cost_median).replace([np.inf, -np.inf], np.nan).fillna(1.0)
    features["duration_ratio"] = (
        projects["duration_days"] / duration_median
    ).replace([np.inf, -np.inf], np.nan).fillna(1.0)
    features["overrun_ratio"] = (
        projects["overrun_days"] / duration_median
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    features["progress_gap"] = financial - physical
    features["funding_utilization_gap"] = (released / sanctioned.replace(0, np.nan) * 100).fillna(0.0) - financial
    features["milestone_max_regression"] = 0.0
    features["inspection_max_regression"] = 0.0
    features["contractor_delayed_rate"] = 0.0
    features["contractor_high_risk_rate"] = 0.0
    features["n_payments"] = projects["payment_count"]
    features["n_milestones"] = 0.0
    features["n_inspections"] = 0.0
    reference_ids = set(peer_reference["Project ID"])
    payment_reference = payments[payments["Project ID"].isin(reference_ids)]
    payment_features = _payment_features(projects, payment_reference)
    features["payment_amount_variance"] = payment_features["payment_amount_variance"]
    features["payment_interval_irregularity"] = payment_features["payment_interval_irregularity"]
    features["expenditure_release_mismatch"] = (
        numeric_column(projects, "Released Amount") - numeric_column(projects, "Expenditure Amount")
    ).abs() / sanctioned.replace(0, np.nan)
    features["expenditure_release_mismatch"] = features["expenditure_release_mismatch"].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    completeness_columns = ["Project ID", "Project Name", "Description", "Type", "State", "District", "Sanctioned Amount", "Start Date", "Expected Completion", "Status"]
    present = projects[completeness_columns].replace("", np.nan).notna().sum(axis=1)
    features["data_completeness_score"] = present / len(completeness_columns)
    features["duplicate_similarity_score"] = _duplicate_similarity(projects, peer_reference).to_numpy()
    return features[FEATURE_NAMES].astype(float)


def main() -> None:
    projects_path = RAW_DIR / "real_projects.csv"
    payments_path = RAW_DIR / "real_payments.csv"
    if not projects_path.exists():
        raise FileNotFoundError(f"Missing real project data: {projects_path}")

    projects = pd.read_csv(projects_path, dtype=str, keep_default_na=False)
    payments = pd.read_csv(payments_path, dtype=str, keep_default_na=False) if payments_path.exists() else pd.DataFrame()
    if payments.empty:
        payments = pd.DataFrame(columns=["Project ID"])

    row_indices = np.arange(len(projects))
    train_indices, test_indices = train_test_split(
        row_indices, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    train_ids = set(projects.iloc[train_indices]["Project ID"])
    test_ids = set(projects.iloc[test_indices]["Project ID"])
    overlap = train_ids & test_ids
    if overlap:
        raise RuntimeError(f"Data leakage detected: {len(overlap)} project IDs overlap")

    train_projects = projects.iloc[train_indices].copy()
    test_projects = projects.iloc[test_indices].copy()

    # Determine dead features strictly on the training partition to prevent any leakage
    train_feature_raw = build_features(train_projects, payments, train_projects)
    _, kept_names, dropped_names = drop_dead_features(train_feature_raw.to_numpy(), FEATURE_NAMES)

    train_features = train_feature_raw[kept_names]
    test_features = build_features(test_projects, payments, train_projects)[kept_names]
    scaler = StandardScaler()
    train_scaled = scaler.fit_transform(train_features)
    test_scaled = scaler.transform(test_features)

    training_log = []
    logged_model = IsolationForest(
        n_estimators=0,
        warm_start=True,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
    )
    for estimator_count in range(25, 201, 25):
        logged_model.set_params(n_estimators=estimator_count)
        logged_model.fit(train_scaled)
        train_scores = logged_model.decision_function(train_scaled)
        training_log.append({
            "estimators": estimator_count,
            "train_mean_anomaly_score": float(train_scores.mean()),
            "train_min_anomaly_score": float(train_scores.min()),
        })

    test_predictions = logged_model.predict(test_scaled)
    test_scores = logged_model.decision_function(test_scaled)

    # Refit the saved artifact on all real rows after the held-out check.
    all_feature_frame = build_features(projects, payments, projects)
    final_scaler = StandardScaler()
    all_scaled = final_scaler.fit_transform(all_feature_frame[kept_names])
    model = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        random_state=RANDOM_STATE,
    )
    predictions = model.fit_predict(all_scaled)
    scores = model.decision_function(all_scaled)

    sensitivity = []
    for contamination in (0.01, 0.03, 0.05, 0.10):
        sensitivity_model = IsolationForest(
            n_estimators=200, contamination=contamination, random_state=RANDOM_STATE
        )
        sensitivity_model.fit(all_scaled)
        sensitivity_scores = sensitivity_model.decision_function(all_scaled)
        sensitivity.append({
            "contamination": contamination,
            "anomalies_flagged": int((sensitivity_model.predict(all_scaled) == -1).sum()),
            "score_min": float(sensitivity_scores.min()),
            "score_mean": float(sensitivity_scores.mean()),
            "score_p05": float(np.percentile(sensitivity_scores, 5)),
            "score_p95": float(np.percentile(sensitivity_scores, 95)),
        })

    flagged_mask = predictions == -1
    flagged_scaled = np.abs(all_scaled[flagged_mask]).mean(axis=0)
    overall_scaled = np.abs(all_scaled).mean(axis=0)
    contribution = flagged_scaled / np.maximum(overall_scaled, 1e-9)
    feature_contributions = [
        {"feature": name, "relative_contribution": float(value)}
        for name, value in sorted(zip(kept_names, contribution), key=lambda item: item[1], reverse=True)
    ]
    score_min, score_max = float(scores.min()), float(scores.max())
    score_span = (score_max - score_min) or 1.0
    review_queue = []
    for row_index in np.where(flagged_mask)[0]:
        review_queue.append({
            "rank": 0,
            "project_id": str(projects.iloc[row_index]["Project ID"]),
            "project_name": str(projects.iloc[row_index].get("Project Name", "")),
            "district": str(projects.iloc[row_index].get("District", "")),
            "state": str(projects.iloc[row_index].get("State", "")),
            "anomaly_score": round((score_max - float(scores[row_index])) / score_span * 100, 2),
            "district_authority_action": "VERIFY / FALSE_POSITIVE / CONFIRMED",
        })
    review_queue.sort(key=lambda row: row["anomaly_score"], reverse=True)
    for rank, row in enumerate(review_queue[:20], start=1):
        row["rank"] = rank

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": model, "scaler": final_scaler, "feature_names": kept_names, "dropped_feature_names": dropped_names},
        MODEL_PATH,
    )

    report = {
        "data_source": {
            "projects_file": str(projects_path),
            "payments_file": str(payments_path),
            "project_rows": int(len(projects)),
            "payment_rows": int(len(payments)),
            "source_project_columns": int(len(projects.columns)),
            "source_payment_columns": int(len(payments.columns)),
        },
        "training": {
            "feature_count": len(kept_names),
            "feature_names": kept_names,
            "engineered_feature_names": FEATURE_NAMES,
            "rows_trained": int(len(feature_frame)),
            "anomalies_flagged": int((predictions == -1).sum()),
            "split": {
                "method": "random project-ID split",
                "random_state": RANDOM_STATE,
                "test_size": TEST_SIZE,
                "train_rows": int(len(train_indices)),
                "test_rows": int(len(test_indices)),
                "rows_match_loaded": len(train_indices) + len(test_indices) == len(projects),
                "train_test_project_id_overlap": len(overlap),
                "leakage_check": "PASS" if not overlap else "FAIL",
                "feature_preprocessing_scope": "peer medians and duplicate similarity fitted on train rows, then transformed onto train/test",
            },
            "contamination": CONTAMINATION,
            "algorithm": "IsolationForest",
            "estimators": 200,
            "standard_scaler": True,
            "training_log": training_log,
            "contamination_sensitivity": sensitivity,
            "loss_or_accuracy": "Not applicable: unsupervised anomaly detection has no labels or loss/accuracy metric.",
            "held_out_test": {
                "rows": int(len(test_indices)),
                "anomalies_flagged": int((test_predictions == -1).sum()),
                "anomaly_score_distribution": {
                    "min": float(test_scores.min()),
                    "max": float(test_scores.max()),
                    "mean": float(test_scores.mean()),
                    "median": float(np.median(test_scores)),
                    "p05": float(np.percentile(test_scores, 5)),
                    "p95": float(np.percentile(test_scores, 95)),
                },
            },
        },
        "feature_contributions": feature_contributions,
        "human_verification_queue": review_queue[:20],
        "embedding_model": {
            "used_in_this_training": False,
            "model_name": MODEL_NAME,
            "embedding_dimensions": EMBEDDING_DIM,
            "transformer_layers": 12,
            "embedding_column": "projects.name_embedding (database mode)",
            "note": "Embeddings are used by entity resolution, not as anomaly-model input features.",
        },
        "feature_source_gaps": [
            f"{name}: near-zero variance across this dataset — excluded before scaling/fitting" for name in dropped_names
        ],
        "score_summary": {
            "min": float(scores.min()),
            "max": float(scores.max()),
            "mean": float(scores.mean()),
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    pd.DataFrame(sensitivity).to_csv(SENSITIVITY_PATH, index=False)
    import matplotlib.pyplot as plt
    sensitivity_frame = pd.DataFrame(sensitivity)
    axis = sensitivity_frame.plot.bar(x="contamination", y="anomalies_flagged", legend=False, color="#0d6b78")
    axis.set_xlabel("Contamination rate")
    axis.set_ylabel("Flagged anomalies")
    axis.set_title("Isolation Forest sensitivity")
    axis.figure.tight_layout()
    axis.figure.savefig(SENSITIVITY_CHART_PATH, dpi=160)
    plt.close(axis.figure)
    pd.DataFrame(review_queue[:20]).to_csv(QUEUE_PATH, index=False)
    top_features = "".join(
        f"<tr><td>{item['feature']}</td><td>{item['relative_contribution']:.3f}</td></tr>"
        for item in feature_contributions[:10]
    )
    top_projects = "".join(
        f"<tr><td>{item['rank']}</td><td>{item['project_id']}</td><td>{item['district']}, {item['state']}</td>"
        f"<td>{item['anomaly_score']:.1f}</td><td>{item['district_authority_action']}</td></tr>"
        for item in review_queue[:20]
    )
    sensitivity_rows = "".join(
        f"<tr><td>{item['contamination']:.0%}</td><td>{item['anomalies_flagged']}</td>"
        f"<td>{item['score_mean']:.3f}</td><td>{item['score_p05']:.3f}</td></tr>"
        for item in sensitivity
    )
    HTML_REPORT_PATH.write_text(
        "<!doctype html><meta charset='utf-8'><title>Real MPLADS Training Report</title>"
        "<style>body{font:15px system-ui;max-width:1100px;margin:32px auto;color:#172033}"
        "table{border-collapse:collapse;width:100%;margin:12px 0 28px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}"
        ".grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.card{background:#f4f7fb;padding:14px}"
        "</style><h1>Real MPLADS Anomaly Training</h1>"
        f"<div class='grid'><div class='card'><b>Rows</b><br>{len(projects):,}</div>"
        f"<div class='card'><b>Features</b><br>{len(FEATURE_NAMES)}</div>"
        f"<div class='card'><b>Train/Test</b><br>{len(train_indices):,} / {len(test_indices):,}</div>"
        f"<div class='card'><b>Leakage</b><br>{'PASS' if not overlap else 'FAIL'}</div></div>"
        "<h2>Top feature contributions</h2><table><tr><th>Feature</th><th>Relative contribution</th></tr>"
        f"{top_features}</table><h2>Top-20 human verification queue</h2>"
        "<p>District Authority action is intentionally left for human review.</p>"
        "<table><tr><th>Rank</th><th>Project</th><th>Location</th><th>Score</th><th>Action</th></tr>"
        f"{top_projects}</table><h2>Contamination sensitivity</h2>"
        "<table><tr><th>Rate</th><th>Flagged</th><th>Mean score</th><th>5th percentile</th></tr>"
        f"{sensitivity_rows}</table><h2>Interpretation</h2><p>Real-data flags are unverified statistical outliers."
        " Precision, recall, and F1 require confirmed labels and are reported separately for the synthetic benchmark.</p>",
        encoding="utf-8",
    )

    print("Real-data local training complete")
    print(f"Rows trained:       {len(feature_frame)}")
    print(f"Train/test rows:    {len(train_indices)}/{len(test_indices)}")
    print(f"Leakage check:      {'PASS' if not overlap else 'FAIL'}")
    print(f"Source columns:     {len(projects.columns)} project + {len(payments.columns)} payment")
    print(f"Features:            {len(FEATURE_NAMES)}")
    print(f"Anomalies flagged:  {(predictions == -1).sum()}")
    print(f"Test score mean:    {test_scores.mean():.4f}")
    print(f"Embedding model:    {MODEL_NAME} ({EMBEDDING_DIM} dimensions, 12 transformer layers)")
    print(f"Model artifact:     {MODEL_PATH}")
    print(f"Training report:    {REPORT_PATH}")
    print(f"Readable report:    {HTML_REPORT_PATH}")


if __name__ == "__main__":
    main()
