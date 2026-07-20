"""
Studio Pro entitlement helpers (Push 7+).

A creator is "Pro" if they have at least one active StudioProSubscription
row. Founder accounts get a permanent grant from ``_grant_founder_pro``
on boot. Real paid subscriptions land here via:

  * RevenueCat webhook  (Push 8)
  * Stripe webhook      (Push 8)
  * Manual admin grant  (Push 9 admin tool)

Public API:
    is_studio_pro(user)             -> bool
    studio_pro_required(view)        decorator for JWT API routes
    get_or_create_settings(user)     -> CreatorSettings row
"""
import logging
from datetime import datetime
from functools import wraps

from flask import jsonify, request

log = logging.getLogger(__name__)


def is_studio_pro(user):
    """Return True if the user currently holds an active Pro subscription."""
    if not user:
        return False
    try:
        from ..models import StudioProSubscription
        active = StudioProSubscription.query.filter_by(user_id=user.id).all()
        for sub in active:
            if sub.status not in ('active', 'grace'):
                continue
            if sub.plan in ('lifetime', 'founder'):
                return True
            if sub.current_period_end and sub.current_period_end < datetime.utcnow():
                continue
            return True
        return False
    except Exception as exc:
        log.warning("is_studio_pro check failed: %s", exc)
        return False


def studio_pro_required(view):
    """Decorator: gate a JWT API route to Pro creators only.

    Use AFTER ``jwt_required``. Returns 402 (Payment Required) with a
    machine-readable JSON body so the mobile app can route to the
    paywall screen automatically.
    """
    @wraps(view)
    def wrapper(*args, **kwargs):
        user = getattr(request, 'api_user', None)
        if not is_studio_pro(user):
            return jsonify({
                'error': 'studio_pro_required',
                'message': (
                    'This is a WiamStudio Pro feature. '
                    'Upgrade to unlock advanced creator tools.'
                ),
                'upgrade_url': '/api/v1/studio/pro/products',
            }), 402
        return view(*args, **kwargs)
    return wrapper


def get_or_create_settings(user):
    """Fetch the user's CreatorSettings row, creating a default if missing."""
    if not user:
        return None
    try:
        from ..extensions import db
        from ..models import CreatorSettings
        s = CreatorSettings.query.filter_by(user_id=user.id).first()
        if s:
            return s
        s = CreatorSettings(user_id=user.id)
        db.session.add(s)
        db.session.commit()
        return s
    except Exception as exc:
        log.warning("get_or_create_settings failed: %s", exc)
        try:
            from ..extensions import db as _db
            _db.session.rollback()
        except Exception:
            pass
        return None
