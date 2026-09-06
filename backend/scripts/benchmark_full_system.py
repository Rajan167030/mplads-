"""Real benchmark of the FULL detection system (rules + ML combined) against
the planted ground truth — not just the ML model in isolation (that narrower
number already lives in ml/experiments/baseline_comparison_report.md).

Run: cd backend && python scripts/benchmark_full_system.py
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.models.entity_match import EntityMatch  # noqa: E402
from app.models.enums import MatchVerdict, SignalSource  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.risk_signal import RiskSignal  # noqa: E402

GROUND_TRUTH_PATH = Path(__file__).resolve().parents[2] / "data" / "synthetic" / "ground_truth.csv"
NUMERIC_CATEGORIES = [
    "COST_ANOMALY", "DELAY_ANOMALY", "PAYMENT_PROGRESS_MISMATCH",
    "CONTRACTOR_RISK_PATTERN", "GEOGRAPHIC_CONCENTRATION", "EVIDENCE_ANOMALY",
]


def main() -> None:
    db = SessionLocal()
    try:
        planted_by_category: dict[str, set[str]] = {c: set() for c in NUMERIC_CATEGORIES}
        planted_duplicates: set[str] = set()

        with open(GROUND_TRUTH_PATH, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                categories = set(row["planted_signals"].split(";")) if row["planted_signals"] else set()
                for c in categories:
                    if c in planted_by_category:
                        planted_by_category[c].add(row["project_external_id"])
                    elif c == "POSSIBLE_DUPLICATE":
                        planted_duplicates.add(row["project_external_id"])

        external_to_id = dict(db.query(Project.external_project_id, Project.id).all())
        total_projects = len(external_to_id)

        # Every project with at least one RULE signal, per category
        rule_flagged_by_category: dict[str, set] = {}
        for c in NUMERIC_CATEGORIES:
            rule_flagged_by_category[c] = {
                row[0] for row in db.query(RiskSignal.project_id)
                .filter(RiskSignal.signal_type == c, RiskSignal.source == SignalSource.RULE)
                .distinct().all()
            }

        ml_flagged = {
            row[0] for row in db.query(RiskSignal.project_id)
            .filter(RiskSignal.source == SignalSource.ML).distinct().all()
        }

        any_flagged = {
            row[0] for row in db.query(RiskSignal.project_id).distinct().all()
        }

        print(f"{'Category':<28} {'Planted':>8} {'Rule hit':>9} {'ML hit':>7} {'ML-ONLY (rules missed)':>23} {'System':>7} {'Recall':>7}")
        print("-" * 100)

        total_planted = 0
        total_rules_only_caught = 0
        total_system_caught = 0
        total_ml_only = 0
        for c in NUMERIC_CATEGORIES:
            planted_ext = planted_by_category[c]
            planted_ids = {external_to_id[e] for e in planted_ext if e in external_to_id}
            if not planted_ids:
                continue
            rule_hit = planted_ids & rule_flagged_by_category[c]
            ml_hit = planted_ids & ml_flagged
            ml_only = ml_hit - rule_hit
            system_hit = planted_ids & (rule_flagged_by_category[c] | ml_flagged)
            recall = len(system_hit) / len(planted_ids)
            total_planted += len(planted_ids)
            total_rules_only_caught += len(rule_hit)
            total_system_caught += len(system_hit)
            total_ml_only += len(ml_only)
            print(f"{c:<28} {len(planted_ids):>8} {len(rule_hit):>9} {len(ml_hit):>7} {len(ml_only):>23} {len(system_hit):>7} {recall:>6.1%}")

        print("-" * 100)
        overall_recall = total_system_caught / total_planted if total_planted else 0
        rules_only_recall = total_rules_only_caught / total_planted if total_planted else 0
        print(f"{'OVERALL (numeric categories)':<28} {total_planted:>8} {'':>9} {'':>7} {total_ml_only:>23} {total_system_caught:>7} {overall_recall:>6.1%}")
        print()
        print(f"Rules-only recall (if ML were removed entirely): {total_rules_only_caught}/{total_planted} = {rules_only_recall:.1%}")
        print(f"System recall (rules + ML combined):              {total_system_caught}/{total_planted} = {overall_recall:.1%}")
        print(f"Genuine incremental contribution from ML alone:   +{total_ml_only} cases "
              f"({total_ml_only/total_planted:.1%} of all planted anomalies) that rules missed entirely")

        # Duplicate detection is entity resolution's job (Phase 3), not risk signals
        confirmed_pairs = db.query(EntityMatch).filter(EntityMatch.verdict == MatchVerdict.MATCH).all()
        possible_pairs = db.query(EntityMatch).filter(EntityMatch.verdict == MatchVerdict.POSSIBLE_MATCH).all()

        def project_ids_from(pairs):
            ids = set()
            for m in pairs:
                ids.add(m.source_project_id)
                ids.add(m.matched_project_id)
            return ids

        confirmed_ids = project_ids_from(confirmed_pairs)
        possible_ids = project_ids_from(possible_pairs)

        dup_planted_ids = {external_to_id[e] for e in planted_duplicates if e in external_to_id}
        dup_caught_confirmed = dup_planted_ids & confirmed_ids
        dup_caught_any = dup_planted_ids & (confirmed_ids | possible_ids)
        print()
        print(f"POSSIBLE_DUPLICATE (via entity resolution — auto-confirmed MATCH only): "
              f"{len(dup_caught_confirmed)}/{len(dup_planted_ids)} = {len(dup_caught_confirmed)/len(dup_planted_ids):.1%}")
        print(f"POSSIBLE_DUPLICATE (surfaced for human review — MATCH + POSSIBLE_MATCH): "
              f"{len(dup_caught_any)}/{len(dup_planted_ids)} = {len(dup_caught_any)/len(dup_planted_ids):.1%}")

        # Precision framing: how many flagged projects are "explainable" by being
        # either a planted anomaly OR independently high/critical risk (i.e. not
        # noise) — reported honestly rather than papering over it.
        all_planted_ids = set()
        for ids in planted_by_category.values():
            all_planted_ids |= {external_to_id[e] for e in ids if e in external_to_id}
        precision = len(all_planted_ids & any_flagged) / len(any_flagged) if any_flagged else 0
        print()
        print(f"Total projects scored: {total_projects}")
        print(f"Total projects with >=1 risk signal: {len(any_flagged)}")
        print(f"Of those, planted ground-truth anomalies: {len(all_planted_ids & any_flagged)} "
              f"({precision:.1%} of flagged projects)")
        print("Note: the remainder are organically-generated risk patterns in the synthetic data")
        print("(real variance, not deliberately planted) — expected, since the system is designed")
        print("to surface genuine statistical outliers for human review, not only labeled cases.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
