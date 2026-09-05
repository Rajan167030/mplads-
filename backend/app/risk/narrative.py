"""Plain-English "why investigate this project" narrative (spec §26's
explainability requirement, sharpened for the judge-facing demo: a short
numbered list of concrete reasons beats a dump of signal metadata).

Every number in every narrative line is read straight out of the signal's own
`evidence` dict — nothing here is re-derived, estimated, or invented, so a
narrative line can never drift out of sync with what's actually stored. If a
signal type has no formatter below, its own `description` is used verbatim
rather than silently dropping it.
"""

from app.models.enums import SignalType

RECOMMENDED_VERIFICATION: dict[SignalType, str] = {
    SignalType.COST_ANOMALY: "Check the technical/administrative cost estimate against comparable local rates.",
    SignalType.PAYMENT_PROGRESS_MISMATCH: "Verify physical progress on-site against the claimed payment milestones.",
    SignalType.DELAY_ANOMALY: "Confirm current on-ground status and the reason for delay with the implementing agency.",
    SignalType.POSSIBLE_DUPLICATE: "Cross-check both project records for the same physical work under separate sanctions.",
    SignalType.CONTRACTOR_RISK_PATTERN: "Review this contractor's full project history before any further award.",
    SignalType.GEOGRAPHIC_CONCENTRATION: "Verify each project in the cluster is genuinely distinct and necessary.",
    SignalType.PAYMENT_ACCELERATION: "Verify the large payment against actual, measured completed work.",
    SignalType.PROGRESS_INCONSISTENCY: "Reconcile the conflicting inspection reports with a fresh site visit.",
    SignalType.EVIDENCE_ANOMALY: "Request fresh, verifiable geo-tagged evidence directly from the site.",
    SignalType.ML_STATISTICAL_ANOMALY: "Manually review the full record for the specific irregular fields flagged.",
    SignalType.MULTI_SIGNAL_CORRELATION: "Prioritize this project — multiple independent checks agree it needs review.",
}


def narrate_signal(signal_type: SignalType, evidence: dict, fallback: str) -> str:
    e = evidence
    try:
        if signal_type == SignalType.COST_ANOMALY:
            pct = (e["ratio"] - 1) * 100
            return (
                f"Cost anomaly: sanctioned amount is ₹{e['sanctioned_amount'] / 100000:.1f}L vs "
                f"{e['peer_group_level']} peer median ₹{e['peer_median'] / 100000:.1f}L (+{pct:.0f}%)."
            )
        if signal_type == SignalType.PAYMENT_PROGRESS_MISMATCH:
            return (
                f"Progress mismatch: {e['physical_progress']:.0f}% physical progress despite "
                f"{e['financial_progress']:.0f}% fund utilization ({e['gap_points']:.0f}-point gap)."
            )
        if signal_type == SignalType.DELAY_ANOMALY:
            months = e["overrun_days"] / 30.4
            return f"Delay: {e['overrun_days']} days (~{months:.1f} months) beyond its own expected completion date."
        if signal_type == SignalType.POSSIBLE_DUPLICATE:
            return (
                f"Similarity: matches another project at {e['match_confidence'] * 100:.0f}% confidence "
                f"({e['verdict'].replace('_', ' ').lower()}) on name, location, and cost."
            )
        if signal_type == SignalType.CONTRACTOR_RISK_PATTERN:
            return (
                f"Contractor pattern: {e['contractor_name']} has {e['delayed_rate'] * 100:.0f}% delayed / "
                f"{e['high_risk_rate'] * 100:.0f}% high-risk projects, vs a {e['baseline_delayed_rate'] * 100:.0f}% "
                f"portfolio baseline (z={e['z_score']})."
            )
        if signal_type == SignalType.GEOGRAPHIC_CONCENTRATION:
            return (
                f"Geographic concentration: {e['cluster_size']} similar "
                f"{e['project_type'].replace('_', ' ').title()} projects sanctioned within {e['radius_km']:.0f}km "
                f"in a {e['date_spread_days']}-day window."
            )
        if signal_type == SignalType.PAYMENT_ACCELERATION:
            return (
                f"Payment acceleration: a single ₹{e['spike_amount']:,.0f} payment is {e['ratio']:.1f}x the "
                f"average of the other {e['payment_count'] - 1} payments."
            )
        if signal_type == SignalType.PROGRESS_INCONSISTENCY:
            return (
                f"Progress inconsistency: a later inspection reported {e['later_progress']:.0f}% after an "
                f"earlier one already reported {e['earlier_progress']:.0f}% ({e['regression_points']:.0f}-point regression)."
            )
        if signal_type == SignalType.EVIDENCE_ANOMALY:
            if "shared_hash_group_size" in e:
                return f"Evidence anomaly: the same photo/document file is reused across {e['shared_hash_group_size']} different projects."
            return f"Evidence anomaly: site evidence was captured {e.get('days_early', '?')} days before the project's own start date."
        if signal_type == SignalType.ML_STATISTICAL_ANOMALY:
            top = e.get("top_contributing_features", [])
            if top:
                feats = ", ".join(f"{f['feature'].replace('_', ' ')}={f['value']:.2f}" for f in top[:2])
                return f"Statistical outlier: the anomaly detection model flags this project as unusual on {feats}."
        if signal_type == SignalType.MULTI_SIGNAL_CORRELATION:
            types = e.get("contributing_signal_types", [])
            names = ", ".join(t.replace("_", " ").title() for t in types)
            return f"Correlated pattern: {len(types)} independent detectors agree ({names})."
    except (KeyError, TypeError):
        pass  # evidence shape didn't match what this formatter expects — fall through
    return fallback


def build_explanation(ranked_signals: list[tuple]) -> tuple[list[str], list[str], float]:
    """ranked_signals: [(signal_type, evidence, description, confidence, weighted_contribution), ...],
    already sorted most-significant first. Returns (narrative_reasons,
    recommended_verification, overall_confidence)."""
    reasons: list[str] = []
    verification: list[str] = []
    seen_verification: set[str] = set()
    weighted_conf_sum = 0.0
    weight_sum = 0.0

    for signal_type, evidence, description, confidence, contribution in ranked_signals:
        reasons.append(narrate_signal(signal_type, evidence, description))
        action = RECOMMENDED_VERIFICATION.get(signal_type)
        if action and action not in seen_verification:
            seen_verification.add(action)
            verification.append(action)
        weighted_conf_sum += confidence * contribution
        weight_sum += contribution

    overall_confidence = round(weighted_conf_sum / weight_sum, 3) if weight_sum > 0 else 0.0
    return reasons, verification, overall_confidence
