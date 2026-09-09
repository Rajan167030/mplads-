import secrets

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.core.audit import log_audit_event
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.scope import in_scope, scope_filter
from app.models.complaint import Complaint
from app.models.enums import ComplaintStatus, UserRole
from app.models.project import Project
from app.models.user import User
from app.schemas.complaint import (
    ComplaintDetailOut,
    ComplaintListItem,
    ComplaintStatusOut,
    ComplaintSubmitOut,
    ComplaintUpdate,
)
from app.utils.geo import COMPLAINT_VERIFICATION_RADIUS_M, distance_to_project_m

router = APIRouter(prefix="/complaints", tags=["complaints"])

MAX_PHOTO_BYTES = 8 * 1024 * 1024  # 8MB
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _list_item(c: Complaint) -> ComplaintListItem:
    return ComplaintListItem(
        id=c.id,
        project_id=c.project_id,
        project_name=c.project.project_name,
        project_external_id=c.project.external_project_id,
        description=c.description,
        is_location_verified=c.is_location_verified,
        distance_to_project_m=c.distance_to_project_m,
        status=c.status.value,
        created_at=c.created_at,
    )


def _detail(c: Complaint) -> ComplaintDetailOut:
    return ComplaintDetailOut(
        **_list_item(c).model_dump(),
        submitted_latitude=c.submitted_latitude,
        submitted_longitude=c.submitted_longitude,
        resolution_notes=c.resolution_notes,
        updated_at=c.updated_at,
    )


# No auth dependency at all here, deliberately — there is no citizen account
# concept in this system (only the four official UserRoles), so an anonymous
# complaint has nowhere to attach an identity even if it wanted to. See
# app.core.deps module docstring for the general read-open/write-gated norm;
# this POST is the one open write endpoint, by design.
@router.post("", response_model=ComplaintSubmitOut)
async def submit_complaint(
    project_id: str = Form(...),
    description: str = Form(..., min_length=10, max_length=2000),
    latitude: float = Form(..., ge=-90, le=90),
    longitude: float = Form(..., ge=-180, le=180),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ComplaintSubmitOut:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if photo.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=422, detail="Photo must be JPEG, PNG, or WEBP.")
    photo_bytes = await photo.read()
    if len(photo_bytes) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Photo too large — 8MB limit.")
    if not photo_bytes:
        raise HTTPException(status_code=422, detail="Photo is required.")

    distance_m = distance_to_project_m(db, project, latitude, longitude)
    is_verified = distance_m is not None and distance_m <= COMPLAINT_VERIFICATION_RADIUS_M

    complaint = Complaint(
        project_id=project.id,
        description=description,
        photo_data=photo_bytes,
        photo_content_type=photo.content_type,
        submitted_latitude=latitude,
        submitted_longitude=longitude,
        submitted_geom=f"SRID=4326;POINT({longitude} {latitude})",
        distance_to_project_m=distance_m,
        is_location_verified=is_verified,
        anonymous_token=secrets.token_urlsafe(24),
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    if is_verified:
        message = "Complaint submitted. Your location matches this project's site — it's been marked location-verified."
    elif distance_m is not None:
        message = (
            f"Complaint submitted, but your location was ~{distance_m / 1000:.1f}km from this project's site, "
            "so it needs manual review before being treated as location-verified."
        )
    else:
        message = "Complaint submitted. This project has no recorded location on file, so it needs manual review."

    return ComplaintSubmitOut(
        token=complaint.anonymous_token,
        status=complaint.status.value,
        is_location_verified=complaint.is_location_verified,
        distance_to_project_m=complaint.distance_to_project_m,
        message=message,
    )


@router.get("/status/{token}", response_model=ComplaintStatusOut)
def get_complaint_status(token: str, db: Session = Depends(get_db)) -> ComplaintStatusOut:
    complaint = db.query(Complaint).filter(Complaint.anonymous_token == token).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="No complaint found for this reference code")

    return ComplaintStatusOut(
        token=complaint.anonymous_token,
        status=complaint.status.value,
        is_location_verified=complaint.is_location_verified,
        distance_to_project_m=complaint.distance_to_project_m,
        project_name=complaint.project.project_name,
        created_at=complaint.created_at,
    )


@router.get("", response_model=list[ComplaintListItem])
def list_complaints(
    project_id: str | None = None,
    status: str | None = None,
    verified_only: bool = False,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ComplaintListItem]:
    query = scope_filter(db.query(Complaint).join(Project, Project.id == Complaint.project_id), user)
    if project_id:
        query = query.filter(Complaint.project_id == project_id)
    if status:
        query = query.filter(Complaint.status == status.upper())
    if verified_only:
        query = query.filter(Complaint.is_location_verified.is_(True))

    complaints = query.order_by(Complaint.created_at.desc()).offset(offset).limit(limit).all()
    return [_list_item(c) for c in complaints]


@router.get("/{complaint_id}", response_model=ComplaintDetailOut)
def get_complaint(complaint_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ComplaintDetailOut:
    complaint = db.get(Complaint, complaint_id)
    if not complaint or not in_scope(complaint.project, user):
        raise HTTPException(status_code=404, detail="Complaint not found")
    return _detail(complaint)


@router.get("/{complaint_id}/photo")
def get_complaint_photo(complaint_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    complaint = db.get(Complaint, complaint_id)
    if not complaint or not in_scope(complaint.project, user):
        raise HTTPException(status_code=404, detail="Complaint not found")
    return Response(content=complaint.photo_data, media_type=complaint.photo_content_type)


@router.patch("/{complaint_id}", response_model=ComplaintDetailOut)
def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.DISTRICT_AUTHORITY, UserRole.STATE_NODAL, UserRole.MINISTRY)),
) -> ComplaintDetailOut:
    complaint = db.get(Complaint, complaint_id)
    if not complaint or not in_scope(complaint.project, user):
        raise HTTPException(status_code=404, detail="Complaint not found")

    if payload.status is not None:
        if payload.status.upper() not in ComplaintStatus.__members__:
            raise HTTPException(status_code=422, detail=f"Invalid status: {payload.status!r}")
        complaint.status = ComplaintStatus[payload.status.upper()]
    if payload.resolution_notes is not None:
        complaint.resolution_notes = payload.resolution_notes

    db.commit()
    db.refresh(complaint)

    log_audit_event(db, user.id, "UPDATE_COMPLAINT", "Complaint", complaint.id, payload.model_dump(exclude_none=True))
    return _detail(complaint)
