"""Creator Dashboard — legacy routes redirect to unified /dashboard."""
from functools import wraps
from flask import Blueprint, redirect, url_for, request, flash
from flask_login import login_required, current_user
from ..extensions import db
from ..models import Content, Order, Access, User

creator_dash_bp = Blueprint('creator_dash', __name__, url_prefix='/creator/dashboard')


def creator_required(f):
    """Decorator: only creators (and founder) can access."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_creator:
            flash('You need a creator account to access this.', 'error')
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated


@creator_dash_bp.route('/')
@creator_required
def overview():
    """Redirect to unified dashboard creator tab."""
    return redirect(url_for('dashboard.index', tab='creator'))


@creator_dash_bp.route('/books')
@creator_required
def my_books():
    """Redirect to unified dashboard stories tab."""
    return redirect(url_for('dashboard.index', tab='stories'))


@creator_dash_bp.route('/orders')
@creator_required
def my_orders():
    """Redirect to unified dashboard orders tab."""
    return redirect(url_for('dashboard.index', tab='orders'))


@creator_dash_bp.route('/orders/<int:order_id>/approve', methods=['POST'])
@creator_required
def approve_order(order_id):
    """Creator approves an order for their book."""
    order = Order.query.get_or_404(order_id)

    # Verify this order is for one of creator's books
    book = Content.query.get(order.content_id)
    if not book or book.creator_wiam_id != current_user.wiam_id:
        flash('Not your book order.', 'error')
        return redirect(url_for('dashboard.index', tab='orders'))

    order.status = 'approved'
    access = Access(
        user_id=order.user_id,
        content_id=order.content_id,
        access_type='permanent',
        status='active',
    )
    db.session.add(access)
    db.session.commit()
    try:
        from ..services.notifications import notify_order_update
        notify_order_update(order.user_id, book.title if book else 'Unknown', 'approved', order.content_id)
    except Exception:
        pass
    flash('Order approved, reader now has access.', 'success')
    return redirect(url_for('dashboard.index', tab='orders'))


@creator_dash_bp.route('/orders/<int:order_id>/reject', methods=['POST'])
@creator_required
def reject_order(order_id):
    """Creator rejects an order."""
    order = Order.query.get_or_404(order_id)
    book = Content.query.get(order.content_id)
    if not book or book.creator_wiam_id != current_user.wiam_id:
        flash('Not your book order.', 'error')
        return redirect(url_for('dashboard.index', tab='orders'))

    order.status = 'rejected'
    db.session.commit()
    try:
        from ..services.notifications import notify_order_update
        notify_order_update(order.user_id, book.title if book else 'Unknown', 'rejected', order.content_id)
    except Exception:
        pass
    flash('Order rejected.', 'success')
    return redirect(url_for('dashboard.index', tab='orders'))


@creator_dash_bp.route('/earnings')
@creator_required
def earnings():
    """Redirect to unified dashboard earnings tab."""
    return redirect(url_for('dashboard.index', tab='earnings'))


@creator_dash_bp.route('/payout-settings', methods=['GET', 'POST'])
@creator_required
def payout_settings():
    """Redirect to unified dashboard earnings tab."""
    return redirect(url_for('dashboard.index', tab='earnings'))


@creator_dash_bp.route('/profile', methods=['GET', 'POST'])
@creator_required
def edit_profile():
    """Redirect to unified dashboard profile tab."""
    return redirect(url_for('dashboard.index', tab='profile'))


@creator_dash_bp.route('/followers')
@creator_required
def followers():
    """Redirect to unified dashboard followers tab."""
    return redirect(url_for('dashboard.index', tab='followers'))
