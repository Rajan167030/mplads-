from datetime import date

from app.ml.features import _max_regression


def test_max_regression_no_regression_is_zero():
    pairs = [(date(2025, 1, 1), 10.0), (date(2025, 2, 1), 40.0), (date(2025, 3, 1), 70.0)]
    assert _max_regression(pairs) == 0.0


def test_max_regression_single_point_is_zero():
    assert _max_regression([(date(2025, 1, 1), 50.0)]) == 0.0


def test_max_regression_empty_is_zero():
    assert _max_regression([]) == 0.0


def test_max_regression_detects_backward_jump():
    pairs = [(date(2025, 1, 1), 60.0), (date(2025, 2, 1), 30.0), (date(2025, 3, 1), 70.0)]
    assert _max_regression(pairs) == 30.0


def test_max_regression_uses_running_max_not_previous_value():
    # Regression should be measured against the running max seen so far, not
    # just the immediately preceding reading — a later dip below an earlier
    # peak is still a regression even if the value right before it was lower.
    pairs = [(date(2025, 1, 1), 80.0), (date(2025, 2, 1), 20.0), (date(2025, 3, 1), 40.0)]
    assert _max_regression(pairs) == 60.0
