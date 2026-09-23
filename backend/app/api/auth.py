from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_USERS_MAP = {
    "mp_demo@mplads.gov.in": ("MP, Jaunpur Constituency", UserRole.MP, "Jaunpur"),
    "district_demo@mplads.gov.in": ("Jaunpur District Authority", UserRole.DISTRICT_AUTHORITY, "Jaunpur"),
    "state_demo@mplads.gov.in": ("Uttar Pradesh State Nodal", UserRole.STATE_NODAL, "Uttar Pradesh"),
    "ministry_demo@mplads.gov.in": ("Ministry (National)", UserRole.MINISTRY, None),
}
DEMO_PASSWORD = "Demo@123"


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    
    # Auto-seed demo users if they don't exist yet
    if not user and payload.email in DEMO_USERS_MAP and payload.password == DEMO_PASSWORD:
        full_name, role, scope_value = DEMO_USERS_MAP[payload.email]
        user = User(
            email=payload.email,
            full_name=full_name,
            role=role,
            scope_value=scope_value,
            hashed_password=hash_password(DEMO_PASSWORD),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    log_audit_event(db, user.id, "LOGIN", "User", user.id)
    return TokenResponse(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role.value, scope_value=user.scope_value)

