from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import require_role
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _out(user: User) -> UserOut:
    return UserOut(
        id=user.id, email=user.email, full_name=user.full_name,
        role=user.role.value, is_active=user.is_active, created_at=user.created_at,
    )


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
) -> list[UserOut]:
    return [_out(u) for u in db.query(User).order_by(User.created_at.desc()).all()]


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserOut:
    if payload.role.upper() not in UserRole.__members__:
        raise HTTPException(status_code=422, detail=f"Invalid role: {payload.role!r}")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=UserRole[payload.role.upper()],
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_audit_event(db, admin.id, "CREATE_USER", "User", user.id, {"email": payload.email, "role": payload.role})
    return _out(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN)),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None:
        if payload.role.upper() not in UserRole.__members__:
            raise HTTPException(status_code=422, detail=f"Invalid role: {payload.role!r}")
        user.role = UserRole[payload.role.upper()]
    if payload.is_active is not None:
        if user.id == admin.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="You can't deactivate your own account")
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)

    log_audit_event(db, admin.id, "UPDATE_USER", "User", user.id, payload.model_dump(exclude_none=True))
    return _out(user)
