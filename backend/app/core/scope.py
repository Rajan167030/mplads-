"""Row-level scoping for the four official roles. Ministry is unscoped
(national); every other role is confined to one Project column, matched
against the user's scope_value. See docs/decisions.md ADR-016."""

from app.models.enums import UserRole
from app.models.project import Project
from app.models.user import User

_SCOPE_COLUMN = {
    UserRole.MP: "constituency",
    UserRole.DISTRICT_AUTHORITY: "district",
    UserRole.STATE_NODAL: "state",
}


def scope_filter(query, user: User, project_model=Project):
    column_name = _SCOPE_COLUMN.get(user.role)
    if column_name is None:  # MINISTRY
        return query
    return query.filter(getattr(project_model, column_name) == user.scope_value)


def in_scope(project: Project, user: User) -> bool:
    column_name = _SCOPE_COLUMN.get(user.role)
    if column_name is None:  # MINISTRY
        return True
    return getattr(project, column_name) == user.scope_value
