"""
Single place to finish turning a user into a creator in the database.

Call from: auto-approval, delayed approval, founder/admin approve, and any
future path so we never ship `role=creator` without wiam_id / profile / monetization row.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import User

log = logging.getLogger(__name__)


def ensure_user_wiam_id(user: "User") -> int:
    """Every creator needs a stable BigInteger wiam_id for books, earnings, studio API."""
    from ..extensions import db

    if user.wiam_id is not None:
        return int(user.wiam_id)
    seed = (str(user.email or "").strip()) or f"id:{user.id}"
    h = int(hashlib.sha256(seed.encode()).hexdigest()[:14], 16)
    wid = -(h + 1_000_000)
    user.wiam_id = wid
    db.session.flush()
    log.info("Assigned wiam_id=%s to user id=%s", wid, user.id)
    return wid


def finalize_creator_upgrade(user: "User", pen_name_hint: Optional[str] = None) -> None:
    """
    - Sets role + application status (founder keeps role=founder).
    - Ensures wiam_id, CreatorProfile, MonetizationStatus (wiam_id PK).
    Does not commit — caller commits.
    """
    from ..extensions import db
    from ..models import CreatorProfile, MonetizationStatus

    ensure_user_wiam_id(user)

    if getattr(user, "role", "") != "founder":
        user.role = "creator"

    user.creator_application_status = "approved"
    user.creator_approval_scheduled = None

    pname = (pen_name_hint or "").strip() or (
        (getattr(user, "display_name", None) or getattr(user, "username", None) or "Creator")
    )
    pname = str(pname)[:120]

    cp = CreatorProfile.query.filter_by(wiam_id=user.wiam_id).first()
    if not cp:
        db.session.add(
            CreatorProfile(
                wiam_id=user.wiam_id,
                pen_name=pname,
                bio=getattr(user, "bio", None),
            )
        )
    elif pen_name_hint and not (cp.pen_name or "").strip():
        cp.pen_name = pname

    ms = MonetizationStatus.query.get(user.wiam_id)
    if not ms:
        db.session.add(
            MonetizationStatus(
                creator_id=user.wiam_id,
                is_eligible=False,
            )
        )


def reconcile_approved_creator_if_needed(user: "User") -> bool:
    """
    Legacy rows: creator_application_status=approved but role is still user/admin/etc.
    Run on login / JWT attach so Expo and API gates match the dashboard.

    Returns True if a DB commit ran (role / profile rows updated).
    """
    from ..extensions import db

    st = (getattr(user, "creator_application_status", None) or "").strip().lower()
    if st != "approved":
        return False
    r = (getattr(user, "role", None) or "").strip().lower()
    if r in ("creator", "founder"):
        return False

    finalize_creator_upgrade(user)
    try:
        db.session.commit()
    except Exception as e:
        log.warning("reconcile_approved_creator_if_needed commit failed user=%s: %s", user.id, e)
        db.session.rollback()
        return False
    return True


def refresh_user_for_session(user: "User") -> "User":
    """Reload merged state from DB after role changes (same request / tests)."""
    from ..models import User

    db_user = User.query.get(user.id)
    return db_user or user
