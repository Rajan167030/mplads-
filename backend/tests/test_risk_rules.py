import uuid
from datetime import date, timedelta
from types import SimpleNamespace

from app.models.enums import ProjectStatus, ProjectType, Severity
from app.risk.context import PeerGroupIndex, PeerStats
from app.risk.rules import p01_payment_mismatch, p02_cost_anomaly, p03_delay_anomaly
from app.risk.rules.base import DetectionContext


def make_project(**overrides):
    defaults = dict(
        id=uuid.uuid4(),
        project_type=ProjectType.COMMUNITY_HALL,
        state="Kerala",
        district="Ernakulam",
        status=ProjectStatus.ONGOING,
        sanctioned_amount=900_000.0,
        physical_progress=50.0,
        financial_progress=55.0,
        start_date=date(2025, 1, 1),
        expected_completion_date=date(2025, 7, 1),
        actual_completion_date=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_context(cost_median=900_000.0, duration_median_days=180, level="district"):
    class FixedPeerIndex(PeerGroupIndex):
        def stats_for(self, project_type, state, district, exclude_project_id=None):
            return PeerStats(cost_median=cost_median, duration_median_days=duration_median_days, n=10, level=level)

    return DetectionContext(peer_groups=FixedPeerIndex())


# --- P01: payment/progress mismatch ---

def test_p01_no_signal_when_progress_aligned():
    project = make_project(physical_progress=50.0, financial_progress=55.0)
    assert p01_payment_mismatch.detect(project, make_context()) is None


def test_p01_flags_large_gap():
    project = make_project(physical_progress=35.0, financial_progress=82.0)
    result = p01_payment_mismatch.detect(project, make_context())
    assert result is not None
    assert result.severity in (Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL)
    assert result.evidence["gap_points"] == 47.0


def test_p01_severity_scales_with_gap():
    small_gap = p01_payment_mismatch.detect(make_project(physical_progress=40, financial_progress=62), make_context())
    large_gap = p01_payment_mismatch.detect(make_project(physical_progress=10, financial_progress=90), make_context())
    assert small_gap.score < large_gap.score


# --- P02: cost anomaly ---

def test_p02_no_signal_within_peer_range():
    project = make_project(sanctioned_amount=1_000_000.0)
    assert p02_cost_anomaly.detect(project, make_context(cost_median=900_000.0)) is None


def test_p02_flags_cost_well_above_peer_median():
    project = make_project(sanctioned_amount=2_500_000.0)
    result = p02_cost_anomaly.detect(project, make_context(cost_median=900_000.0))
    assert result is not None
    assert result.evidence["ratio"] > 1.75


def test_p02_confidence_reflects_peer_group_level():
    project = make_project(sanctioned_amount=2_500_000.0)
    district_result = p02_cost_anomaly.detect(project, make_context(cost_median=900_000.0, level="district"))
    national_result = p02_cost_anomaly.detect(project, make_context(cost_median=900_000.0, level="national"))
    assert district_result.confidence > national_result.confidence


# --- P03: delay anomaly ---

def test_p03_sanctioned_projects_never_flagged():
    project = make_project(status=ProjectStatus.SANCTIONED, expected_completion_date=date.today() - timedelta(days=400))
    assert p03_delay_anomaly.detect(project, make_context()) is None


def test_p03_not_yet_due_ongoing_project_is_not_flagged():
    # Still within its own committed window — this is the exact case the
    # earlier elapsed-time-vs-peer-median design incorrectly flagged.
    project = make_project(
        status=ProjectStatus.ONGOING,
        start_date=date.today() - timedelta(days=200),
        expected_completion_date=date.today() + timedelta(days=100),
    )
    assert p03_delay_anomaly.detect(project, make_context(duration_median_days=180)) is None


def test_p03_flags_project_overdue_past_own_deadline():
    project = make_project(
        status=ProjectStatus.DELAYED,
        start_date=date.today() - timedelta(days=400),
        expected_completion_date=date.today() - timedelta(days=200),
    )
    result = p03_delay_anomaly.detect(project, make_context(duration_median_days=180))
    assert result is not None
    assert result.evidence["overrun_days"] == 200


def test_p03_completed_project_measures_overrun_against_own_expected_date():
    project = make_project(
        status=ProjectStatus.COMPLETED,
        start_date=date(2024, 1, 1),
        expected_completion_date=date(2024, 7, 1),
        actual_completion_date=date(2025, 1, 1),
    )
    result = p03_delay_anomaly.detect(project, make_context(duration_median_days=180))
    assert result is not None
    assert result.evidence["overrun_days"] == 184  # Jul 1 2024 -> Jan 1 2025
