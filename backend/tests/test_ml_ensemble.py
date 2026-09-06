import numpy as np

from app.ml.ensemble import drop_dead_features


def test_drop_dead_features_removes_constant_columns():
    # column 1 is constant zero (e.g. a feature sourced from an empty table,
    # like milestone_max_regression when no Milestone rows exist)
    X = np.array([
        [1.0, 0.0, 5.0],
        [2.0, 0.0, 6.0],
        [3.0, 0.0, 7.0],
    ])
    names = ["a", "b", "c"]

    X_kept, kept, dropped = drop_dead_features(X, names)

    assert dropped == ["b"]
    assert kept == ["a", "c"]
    assert X_kept.shape == (3, 2)


def test_drop_dead_features_keeps_everything_when_all_vary():
    X = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 1.0]])
    names = ["a", "b"]

    X_kept, kept, dropped = drop_dead_features(X, names)

    assert dropped == []
    assert kept == names
    assert X_kept.shape == X.shape
