"""Creates one demo user per role for local/demo login. Not for production —
there's no user-management UI yet (that's a later phase); this just gives the
auth endpoints someone real to authenticate as.

Scope values are picked from the REAL MPLADS sample (data_source=REAL_MPLADS,
see scripts/transform_real_mplads_tiles.py / ingest_real_mplads_data.py) —
Uttar Pradesh / Jaunpur district / Jaunpur constituency all landed strong
real-project counts in the ~8,000-row sample, so mp_demo/district_demo/
state_demo each show real, MP-attributed projects, not synthetic
placeholders; ministry_demo is unscoped (national, sees both datasets)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402

DEMO_USERS = [
    ("mp_demo@mplads.gov.in", "MP, Jaunpur Constituency", UserRole.MP, "Jaunpur"),
    ("district_demo@mplads.gov.in", "Jaunpur District Authority", UserRole.DISTRICT_AUTHORITY, "Jaunpur"),
    ("state_demo@mplads.gov.in", "Uttar Pradesh State Nodal", UserRole.STATE_NODAL, "Uttar Pradesh"),
    ("ministry_demo@mplads.gov.in", "Ministry (National)", UserRole.MINISTRY, None),
]
DEMO_PASSWORD = "Demo@123"


def main() -> None:
    db = SessionLocal()
    try:
        for email, full_name, role, scope_value in DEMO_USERS:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"Already exists: {email} ({role.value})")
                continue
            db.add(User(
                email=email, full_name=full_name, role=role, scope_value=scope_value,
                hashed_password=hash_password(DEMO_PASSWORD),
            ))
            db.commit()
            print(f"Created: {email} ({role.value}, scope={scope_value!r})")
    finally:
        db.close()

    print(f"\nDemo password for all seeded users: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
