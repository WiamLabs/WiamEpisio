"""RBAC decorators and helpers for route-level permission enforcement."""
from functools import wraps
from flask import flash, redirect, url_for, abort
from flask_login import login_required, current_user


def require_permission(*perm_keys):
    """Decorator: require the current user to have ALL specified permissions.

    Usage:
        @require_permission('content.view')
        @require_permission('review.approve', 'review.override')
    """
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            for pk in perm_keys:
                if not current_user.has_permission(pk):
                    flash('Access denied — insufficient permissions.', 'error')
                    return redirect(url_for('home.home'))
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_any_permission(*perm_keys):
    """Decorator: require at least ONE of the specified permissions."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            for pk in perm_keys:
                if current_user.has_permission(pk):
                    return f(*args, **kwargs)
            flash('Access denied — insufficient permissions.', 'error')
            return redirect(url_for('home.home'))
        return decorated
    return decorator


def require_role(*role_names):
    """Decorator: require the current user to have at least one of the specified roles."""
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated(*args, **kwargs):
            for rn in role_names:
                if current_user.has_role(rn):
                    return f(*args, **kwargs)
            flash('Access denied — role required.', 'error')
            return redirect(url_for('home.home'))
        return decorated
    return decorator


def require_team_member(f):
    """Decorator: require the user to be any team member (founder, admin, or has RBAC role)."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_team_member:
            flash('Access denied.', 'error')
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated
