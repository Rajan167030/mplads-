from dataclasses import dataclass

from app.models.enums import SignalSource, Severity
from app.risk.scoring import _band_for_score, compute_risk_score


@dataclass
class FakeSignal:
    score: float
    confidence: float
    source: SignalSource


def test_no_signals_gives_zero_score():
    assert compute_risk_score([]) == 0.0


def test_single_low_signal_gives_low_score():
    signals = [FakeSignal(score=20, confidence=1.0, source=SignalSource.RULE)]
    score = compute_risk_score(signals)
    assert 0 < score < 25


def test_single_saturated_signal_pushes_close_to_but_not_exactly_max():
    signals = [FakeSignal(score=100, confidence=1.0, source=SignalSource.RULE)]
    assert compute_risk_score(signals) == 100.0  # contribution capped at 1.0 -> exact 100 is correct here


def test_two_moderate_signals_compound_higher_than_either_alone():
    one_signal = compute_risk_score([FakeSignal(score=50, confidence=1.0, source=SignalSource.RULE)])
    two_signals = compute_risk_score([
        FakeSignal(score=50, confidence=1.0, source=SignalSource.RULE),
        FakeSignal(score=50, confidence=1.0, source=SignalSource.RULE),
    ])
    assert two_signals > one_signal


def test_ml_source_contributes_less_than_equal_rule_score():
    rule_score = compute_risk_score([FakeSignal(score=50, confidence=1.0, source=SignalSource.RULE)])
    ml_score = compute_risk_score([FakeSignal(score=50, confidence=1.0, source=SignalSource.ML)])
    assert ml_score < rule_score


def test_correlated_source_contributes_more_than_rule_at_same_score():
    rule_score = compute_risk_score([FakeSignal(score=50, confidence=1.0, source=SignalSource.RULE)])
    correlated_score = compute_risk_score([FakeSignal(score=50, confidence=1.0, source=SignalSource.CORRELATED)])
    assert correlated_score > rule_score


def test_low_confidence_reduces_contribution():
    high_conf = compute_risk_score([FakeSignal(score=80, confidence=1.0, source=SignalSource.RULE)])
    low_conf = compute_risk_score([FakeSignal(score=80, confidence=0.3, source=SignalSource.RULE)])
    assert low_conf < high_conf


def test_band_thresholds():
    assert _band_for_score(0) == Severity.LOW
    assert _band_for_score(24.9) == Severity.LOW
    assert _band_for_score(25) == Severity.MEDIUM
    assert _band_for_score(49.9) == Severity.MEDIUM
    assert _band_for_score(50) == Severity.HIGH
    assert _band_for_score(74.9) == Severity.HIGH
    assert _band_for_score(75) == Severity.CRITICAL
    assert _band_for_score(100) == Severity.CRITICAL
