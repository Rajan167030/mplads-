"""Three independent unsupervised anomaly detectors over one shared,
peer-normalized feature matrix (app.ml.features): Isolation Forest (splits on
axis-aligned thresholds — cheap, scale-invariant, good at single extreme
features), an Autoencoder (reconstruction error — catches multivariate
patterns that are only odd in combination, invisible to a single feature or
axis-aligned split), and DBSCAN (density-based — catches projects that sit in
their own small cluster rather than near any dense "normal" region, a
different anomaly shape than either of the above).

All three read `X_scaled` produced by `scale()` and return
`(anomaly_score, is_outlier)` in the same shape (`anomaly_score`: higher =
more anomalous, comparable via `normalize_scores` to 0-100 within its own
model — never compared *across* models directly, since raw scales differ).
Kept pure/DB-independent so the same functions run from the DB-backed live
path (app.ml.anomaly_model) and the isolated CSV benchmark
(scripts/evaluate_ensemble_benchmark.py) without duplicating logic.

Scaling: RobustScaler (median/IQR), not StandardScaler. These are heavy-tailed
ratio features (e.g. cost_ratio) — StandardScaler's mean/std are themselves
distorted by the very outliers being hunted for, while a robust scaler's
median/IQR barely move. Isolation Forest's splits are scale-invariant so it
loses nothing either way; DBSCAN (distance-based) and the Autoencoder
(gradient-based on reconstruction distance) are the ones this actually
matters for, and all three need to share one scaled matrix for their
evidence/explanations to be comparable.
"""

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import RobustScaler

CONTAMINATION = 0.05
RANDOM_STATE = 42
DEAD_FEATURE_STD_THRESHOLD = 1e-9

DBSCAN_MIN_SAMPLES = 5
DBSCAN_EPS_PERCENTILE = 90  # of k-nearest-neighbor distances, k = DBSCAN_MIN_SAMPLES

AUTOENCODER_EPOCHS = 200
AUTOENCODER_LR = 0.01


def drop_dead_features(X: np.ndarray, feature_names: list[str]) -> tuple[np.ndarray, list[str], list[str]]:
    """Columns with ~zero variance carry no information (typically a related
    table — Milestone/Inspection/Contractor — that real-data ingestion never
    populated) and are dropped before scaling/fitting rather than silently
    wasting every model's capacity on a constant."""
    std = X.std(axis=0)
    keep_mask = std > DEAD_FEATURE_STD_THRESHOLD
    kept = [name for name, keep in zip(feature_names, keep_mask) if keep]
    dropped = [name for name, keep in zip(feature_names, keep_mask) if not keep]
    return X[:, keep_mask], kept, dropped


def scale(X: np.ndarray) -> tuple[np.ndarray, RobustScaler]:
    scaler = RobustScaler()
    return scaler.fit_transform(X), scaler


def normalize_scores(anomaly_scores: np.ndarray) -> np.ndarray:
    """Min-max to 0-100 within one model's own score distribution."""
    lo, hi = float(anomaly_scores.min()), float(anomaly_scores.max())
    span = (hi - lo) or 1.0
    return (anomaly_scores - lo) / span * 100


def fit_isolation_forest(X_scaled: np.ndarray) -> tuple[np.ndarray, np.ndarray, IsolationForest]:
    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=RANDOM_STATE)
    predictions = model.fit_predict(X_scaled)
    raw_scores = model.decision_function(X_scaled)  # higher = more normal
    anomaly_scores = -raw_scores  # flip so higher = more anomalous, matching the other two models
    is_outlier = predictions == -1
    return anomaly_scores, is_outlier, model


class _Autoencoder:
    """Plain-numpy MLP autoencoder — input -> hidden -> bottleneck -> hidden ->
    input, ReLU between every layer but the last. Same architecture the torch
    version used; forward, backprop and Adam are hand-rolled below so this
    module carries no torch dependency (torch + its CUDA wheels were ~2.5GB
    of a Render free-tier deploy for a network four `Linear` layers deep)."""

    def __init__(self, input_dim: int, rng: np.random.Generator):
        hidden = max(2, input_dim // 2)
        bottleneck = max(1, input_dim // 4)
        dims = [input_dim, hidden, bottleneck, hidden, input_dim]
        # He init (ReLU-appropriate) for every layer, including the last —
        # its output has no activation but this is still a sane scale.
        self.weights = [rng.normal(0, np.sqrt(2.0 / fan_in), size=(fan_in, fan_out))
                         for fan_in, fan_out in zip(dims[:-1], dims[1:])]
        self.biases = [np.zeros(fan_out) for fan_out in dims[1:]]

    def _forward(self, X: np.ndarray) -> tuple[np.ndarray, list[np.ndarray], list[np.ndarray]]:
        """Returns (output, pre_activations, activations-including-input) —
        the latter two only matter for backprop during training."""
        pre_acts, acts = [], [X]
        a = X
        last = len(self.weights) - 1
        for i, (W, b) in enumerate(zip(self.weights, self.biases)):
            z = a @ W + b
            pre_acts.append(z)
            a = z if i == last else np.maximum(z, 0)
            acts.append(a)
        return a, pre_acts, acts

    def predict(self, X: np.ndarray) -> np.ndarray:
        output, _, _ = self._forward(X)
        return output


def fit_autoencoder(X_scaled: np.ndarray) -> tuple[np.ndarray, np.ndarray, _Autoencoder]:
    """Reconstruction-error anomaly score: a project whose feature vector the
    network can't compress-and-reconstruct well is unusual in how its
    features combine, not just in any one of them — the multivariate pattern
    Isolation Forest's axis-aligned splits can miss.

    Trained by full-batch gradient descent (Adam) over AUTOENCODER_EPOCHS —
    the same regime the torch version used, just with the forward/backward
    pass and optimizer written out explicitly instead of via autograd."""
    rng = np.random.default_rng(RANDOM_STATE)
    model = _Autoencoder(X_scaled.shape[1], rng)
    n_layers = len(model.weights)
    beta1, beta2, adam_eps = 0.9, 0.999, 1e-8
    m_w = [np.zeros_like(W) for W in model.weights]
    v_w = [np.zeros_like(W) for W in model.weights]
    m_b = [np.zeros_like(b) for b in model.biases]
    v_b = [np.zeros_like(b) for b in model.biases]

    for t in range(1, AUTOENCODER_EPOCHS + 1):
        output, pre_acts, acts = model._forward(X_scaled)
        delta = 2 * (output - X_scaled) / output.size  # dL/d(output), MSE mean over all elements

        grads_w: list[np.ndarray] = [None] * n_layers  # type: ignore[list-item]
        grads_b: list[np.ndarray] = [None] * n_layers  # type: ignore[list-item]
        for i in reversed(range(n_layers)):
            if i != n_layers - 1:
                delta = delta * (pre_acts[i] > 0)  # ReLU derivative (last layer has none)
            grads_w[i] = acts[i].T @ delta
            grads_b[i] = delta.sum(axis=0)
            if i > 0:
                delta = delta @ model.weights[i].T

        for i in range(n_layers):
            for params, grad, m, v in ((model.weights, grads_w[i], m_w, v_w), (model.biases, grads_b[i], m_b, v_b)):
                m[i] = beta1 * m[i] + (1 - beta1) * grad
                v[i] = beta2 * v[i] + (1 - beta2) * grad ** 2
                m_hat = m[i] / (1 - beta1 ** t)
                v_hat = v[i] / (1 - beta2 ** t)
                params[i] -= AUTOENCODER_LR * m_hat / (np.sqrt(v_hat) + adam_eps)

    reconstructed = model.predict(X_scaled)
    per_row_error = ((reconstructed - X_scaled) ** 2).mean(axis=1)

    threshold = np.percentile(per_row_error, 100 * (1 - CONTAMINATION))
    is_outlier = per_row_error >= threshold
    return per_row_error, is_outlier, model


def _k_distance_eps(X_scaled: np.ndarray, k: int) -> float:
    k = min(k, len(X_scaled) - 1)
    neighbors = NearestNeighbors(n_neighbors=k + 1).fit(X_scaled)
    distances, _ = neighbors.kneighbors(X_scaled)
    return float(np.percentile(distances[:, -1], DBSCAN_EPS_PERCENTILE))


def fit_dbscan(X_scaled: np.ndarray) -> tuple[np.ndarray, np.ndarray, dict]:
    """Density-based: flags projects that don't belong to any dense cluster
    of "normal" projects at all, rather than being far from one center — a
    different anomaly shape (e.g. a small group of agency/vendor projects
    that only look unusual relative to each other) than a single-center
    model like Isolation Forest or the Autoencoder can express. `eps` is
    picked from the data (90th percentile of k-nearest-neighbor distances)
    instead of a hardcoded constant, so it adapts to the actual feature scale
    after RobustScaler."""
    eps = _k_distance_eps(X_scaled, DBSCAN_MIN_SAMPLES)
    model = DBSCAN(eps=eps, min_samples=DBSCAN_MIN_SAMPLES)
    labels = model.fit_predict(X_scaled)
    is_outlier = labels == -1

    cluster_labels = set(labels.tolist()) - {-1}
    centroids = (
        np.array([X_scaled[labels == lbl].mean(axis=0) for lbl in cluster_labels])
        if cluster_labels else np.empty((0, X_scaled.shape[1]))
    )
    anomaly_scores = dbscan_score_fn(centroids)(X_scaled)

    return anomaly_scores, is_outlier, {
        "eps": eps, "min_samples": DBSCAN_MIN_SAMPLES, "n_clusters": len(cluster_labels), "centroids": centroids,
    }


def isolation_forest_score_fn(model: IsolationForest):
    """Inductive score function (works on any row, not just fitted ones) —
    used both to score the training set and, unchanged, as SHAP's black-box
    function in app.ml.explainability."""
    return lambda X: -model.decision_function(X)


def autoencoder_score_fn(model: _Autoencoder):
    def score(X: np.ndarray) -> np.ndarray:
        reconstructed = model.predict(X)
        return ((reconstructed - X) ** 2).mean(axis=1)
    return score


def dbscan_score_fn(centroids: np.ndarray):
    """DBSCAN itself has no inductive score for unseen rows (it only labels
    the points it was fit on); this reuses the centroids of the clusters it
    found to score arbitrary rows — nearest-centroid distance — so the same
    function can be used for both training-set scores and SHAP's perturbed
    (necessarily out-of-sample) query points."""
    def score(X: np.ndarray) -> np.ndarray:
        if len(centroids) == 0:
            return np.zeros(len(X))
        return np.array([np.linalg.norm(centroids - row, axis=1).min() for row in X])
    return score
