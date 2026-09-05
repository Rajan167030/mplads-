from app.models.enums import SignalType
from app.risk.narrative import build_explanation, narrate_signal


def test_cost_anomaly_narrative_uses_real_evidence_numbers():
    evidence = {"sanctioned_amount": 2450000, "peer_median": 1210000, "peer_group_level": "district", "ratio": 2.0248}
    line = narrate_signal(SignalType.COST_ANOMALY, evidence, fallback="fallback")
    assert "24.5L" in line
    assert "12.1L" in line
    assert "+102%" in line


def test_payment_progress_mismatch_narrative():
    evidence = {"physical_progress": 37.0, "financial_progress": 81.0, "gap_points": 44.0}
    line = narrate_signal(SignalType.PAYMENT_PROGRESS_MISMATCH, evidence, fallback="fallback")
    assert "37%" in line
    assert "81%" in line


def test_delay_anomaly_narrative_converts_days_to_months():
    evidence = {"overrun_days": 213}
    line = narrate_signal(SignalType.DELAY_ANOMALY, evidence, fallback="fallback")
    assert "213 days" in line
    assert "7.0 months" in line


def test_missing_evidence_field_falls_back_to_description():
    line = narrate_signal(SignalType.COST_ANOMALY, {}, fallback="original description text")
    assert line == "original description text"


def test_unrecognized_signal_type_falls_back_to_description():
    # PROGRESS_INCONSISTENCY has a formatter; use a made-up scenario where the
    # formatter isn't reached because evidence is empty for an ML signal with
    # no top_contributing_features key.
    line = narrate_signal(SignalType.ML_STATISTICAL_ANOMALY, {}, fallback="fallback text")
    assert line == "fallback text"


def test_build_explanation_orders_and_dedupes_verification():
    ranked = [
        (SignalType.COST_ANOMALY, {"sanctioned_amount": 2000000, "peer_median": 1000000, "peer_group_level": "district", "ratio": 2.0}, "desc1", 1.0, 0.8),
        (SignalType.PAYMENT_PROGRESS_MISMATCH, {"physical_progress": 20, "financial_progress": 80, "gap_points": 60}, "desc2", 1.0, 0.6),
    ]
    reasons, verification, confidence = build_explanation(ranked)
    assert len(reasons) == 2
    assert "Cost anomaly" in reasons[0]
    assert "Progress mismatch" in reasons[1]
    assert len(verification) == 2
    assert confidence == 1.0


def test_build_explanation_confidence_is_weighted_by_contribution():
    ranked = [
        (SignalType.COST_ANOMALY, {"sanctioned_amount": 2000000, "peer_median": 1000000, "peer_group_level": "district", "ratio": 2.0}, "desc1", 1.0, 0.9),
        (SignalType.ML_STATISTICAL_ANOMALY, {}, "desc2", 0.5, 0.1),
    ]
    _, _, confidence = build_explanation(ranked)
    # weighted: (1.0*0.9 + 0.5*0.1) / (0.9+0.1) = 0.95/1.0 = 0.95
    assert confidence == 0.95


def test_build_explanation_empty_list():
    reasons, verification, confidence = build_explanation([])
    assert reasons == []
    assert verification == []
    assert confidence == 0.0
