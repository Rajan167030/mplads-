import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Rate limiter state: IP / Email -> list of failed attempt timestamps
_login_attempts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_FAILED_ATTEMPTS = 5

DEMO_USERS_MAP = {
    "mp_demo@mplads.gov.in": ("MP, Jaunpur Constituency", UserRole.MP, "Jaunpur"),
    "district_demo@mplads.gov.in": ("Jaunpur District Authority", UserRole.DISTRICT_AUTHORITY, "Jaunpur"),
    "state_demo@mplads.gov.in": ("Uttar Pradesh State Nodal", UserRole.STATE_NODAL, "Uttar Pradesh"),
    "ministry_demo@mplads.gov.in": ("Ministry (National)", UserRole.MINISTRY, None),
}
DEMO_PASSWORD = "Demo@123"


def _check_rate_limit(client_ip: str, email: str) -> None:
    now = time.time()
    for key in (client_ip, email.lower().strip()):
        if not key:
            continue
        _login_attempts[key] = [t for t in _login_attempts[key] if now - t < RATE_LIMIT_WINDOW_SECONDS]
        if len(_login_attempts[key]) >= MAX_FAILED_ATTEMPTS:
            earliest = _login_attempts[key][0]
            retry_after = max(int(RATE_LIMIT_WINDOW_SECONDS - (now - earliest)), 1)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Security alert: Too many failed login attempts. Please wait {retry_after} seconds before trying again.",
                headers={"Retry-After": str(retry_after)},
            )


def _record_failed_attempt(client_ip: str, email: str) -> None:
    now = time.time()
    if client_ip:
        _login_attempts[client_ip].append(now)
    if email:
        _login_attempts[email.lower().strip()].append(now)


def _clear_rate_limit(client_ip: str, email: str) -> None:
    if client_ip in _login_attempts:
        del _login_attempts[client_ip]
    norm_email = email.lower().strip()
    if norm_email in _login_attempts:
        del _login_attempts[norm_email]


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip, payload.email)

    user = db.query(User).filter(User.email == payload.email).first()
    
    # Auto-seed default authority demo users if DB is freshly provisioned
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
        _record_failed_attempt(client_ip, payload.email)
        remaining = MAX_FAILED_ATTEMPTS - len(_login_attempts.get(client_ip, []))
        detail_msg = "Incorrect official email or password."
        if remaining > 0 and remaining < MAX_FAILED_ATTEMPTS:
            detail_msg += f" ({remaining} attempts remaining before temporary lockout)"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail_msg)

    # Success: clear failed attempt tracker and record audit log
    _clear_rate_limit(client_ip, payload.email)
    log_audit_event(db, user.id, "LOGIN", "User", user.id)
    return TokenResponse(access_token=create_access_token(user.id, user.role.value))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, role=user.role.value, scope_value=user.scope_value)
