"""Creates one demo user per role for local/demo login. Not for production —
there's no user-management UI yet (that's a later phase); this just gives the
auth endpoints someone real to authenticate as."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.enums import UserRole  # noqa: E402
from app.models.user import User  # noqa: E402

DEMO_USERS = [
    ("admin@mplads.gov.in", "Admin User", UserRole.ADMIN),
    ("officer@mplads.gov.in", "District Officer", UserRole.OFFICER),
    ("analyst@mplads.gov.in", "Data Analyst", UserRole.ANALYST),
    ("viewer@mplads.gov.in", "Public Viewer", UserRole.VIEWER),
]
DEMO_PASSWORD = "MpladsDemo123!"


def main() -> None:
    db = SessionLocal()
    try:
        for email, full_name, role in DEMO_USERS:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"Already exists: {email} ({role.value})")
                continue
            db.add(User(email=email, full_name=full_name, role=role, hashed_password=hash_password(DEMO_PASSWORD)))
            db.commit()
            print(f"Created: {email} ({role.value})")
    finally:
        db.close()

    print(f"\nDemo password for all seeded users: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
