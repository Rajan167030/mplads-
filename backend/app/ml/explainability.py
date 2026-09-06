"""Shared explainability for every model in app.ml.ensemble: one SHAP
permutation explainer, reused unchanged across Isolation Forest, the
Autoencoder, and DBSCAN.

Permutation (not Tree) explainer, deliberately: it treats the model as a
black box — any `X -> per-row score` callable — so the exact same code
explains all three, including DBSCAN which has no tree structure and no
gradient. TreeExplainer would be faster for Isolation Forest specifically,
but the point here is one explanation format judges can trust everywhere,
not the fastest explanation for one model. This is a genuine Shapley-value
approximation (permutation sampling), not the z-score proxy this replaced.

Cost is bounded by only explaining flagged (outlier) rows against a small
random background sample, not the whole dataset.
"""

from typing import Callable

import numpy as np
import shap

BACKGROUND_SAMPLE_SIZE = 15
TOP_K_FEATURES = 4


def explain_flagged_rows(
    score_fn: Callable[[np.ndarray], np.ndarray],
    X_scaled: np.ndarray,
    flagged_indices: np.ndarray,
    feature_names: list[str],
    random_state: int = 42,
) -> dict[int, list[tuple[str, float]]]:
    """Returns {row_index: [(feature_name, shap_contribution), ...]} sorted
    by |contribution| descending, top `TOP_K_FEATURES` only, for every index
    in `flagged_indices`. Empty dict if there's nothing to explain."""
    if len(flagged_indices) == 0:
        return {}

    rng = np.random.default_rng(random_state)
    background_size = min(BACKGROUND_SAMPLE_SIZE, len(X_scaled))
    background = X_scaled[rng.choice(len(X_scaled), size=background_size, replace=False)]

    explainer = shap.PermutationExplainer(score_fn, background)
    shap_values = explainer(X_scaled[flagged_indices]).values

    contributions = {}
    for row_position, row_index in enumerate(flagged_indices):
        pairs = sorted(
            zip(feature_names, shap_values[row_position]),
            key=lambda pair: abs(pair[1]),
            reverse=True,
        )
        contributions[int(row_index)] = [(name, float(value)) for name, value in pairs[:TOP_K_FEATURES]]
    return contributions
