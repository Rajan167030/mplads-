"""P07 — Payment Acceleration (spec §8).

Detects a payment history that's mostly a steady trickle followed by one
disproportionately large, late payment — one costly way public money can
move faster than verified work without tripping the P01 progress-mismatch
check on any single snapshot.
"""

import uuid
from collections import defaultdict

from sqlalchemy.orm import Session

from app.models.enums import SignalType, Severity
from app.models.payment import Payment
from app.risk.rules.base import SignalDraft

MIN_PAYMENTS = 3
SPIKE_RATIO_THRESHOLD = 2.5


def generate_signals(db: Session) -> list[tuple[uuid.UUID, SignalDraft]]:
    signals: list[tuple[uuid.UUID, SignalDraft]] = []

    rows = db.query(Payment.project_id, Payment.amount, Payment.payment_date).order_by(Payment.payment_date).all()
    by_project: dict[uuid.UUID, list] = defaultdict(list)
    for project_id, amount, payment_date in rows:
        by_project[project_id].append((payment_date, float(amount)))

    for project_id, payments in by_project.items():
        if len(payments) < MIN_PAYMENTS:
            continue

        amounts = [amount for _, amount in payments]
        max_amount = max(amounts)
        max_index = amounts.index(max_amount)
        others_mean = (sum(amounts) - max_amount) / (len(amounts) - 1)

        if others_mean <= 0:
            continue
        ratio = max_amount / others_mean

        # The spike must also come in the back half of the payment sequence —
        # a large *first* payment is a normal advance, not acceleration.
        if ratio < SPIKE_RATIO_THRESHOLD or max_index < len(payments) / 2:
            continue

        severity = Severity.CRITICAL if ratio >= 6 else (Severity.HIGH if ratio >= 4 else Severity.MEDIUM)
        score = round(min(100.0, ratio * 12), 1)

        signals.append((project_id, SignalDraft(
            signal_type=SignalType.PAYMENT_ACCELERATION,
            severity=severity,
            score=score,
            confidence=1.0,
            description=(
                f"A single payment of ₹{max_amount:,.0f} is {ratio:.1f}x the average of the other "
                f"{len(payments) - 1} payments, and arrived in the later part of the payment schedule."
            ),
            evidence={
                "payment_count": len(payments),
                "spike_amount": max_amount,
                "other_payments_mean": round(others_mean, 2),
                "ratio": round(ratio, 2),
                "spike_position": f"{max_index + 1} of {len(payments)}",
            },
        )))

    return signals
