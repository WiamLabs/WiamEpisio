"""Admin Dashboard — content moderation, user management, order review."""
from functools import wraps
from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from sqlalchemy import func
from ..extensions import db
from ..models import Content, Order, Access, User, Rating

admin_dash_bp = Blueprint('admin_dash', __name__, url_prefix='/admin')


def admin_required(f):
    """Decorator: only admins, overall_boss, and founder can perform admin write actions."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.is_admin:
            return f(*args, **kwargs)
        flash('Access denied.', 'error')
        if getattr(current_user, 'is_team_account', False):
            return redirect(url_for('team.dashboard'))
        return redirect(url_for('home.home'))
    return decorated


def team_read_admin(f):
    """Decorator: any team account can access read-only admin views (content, users, orders, creators)."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.is_admin:
            return f(*args, **kwargs)
        if getattr(current_user, 'is_team_account', False):
            return f(*args, **kwargs)
        flash('Access denied.', 'error')
        return redirect(url_for('home.home'))
    return decorated


@admin_dash_bp.route('/')
@admin_required
def overview():
    """Admin overview."""
    total_users = User.query.count()
    total_books = Content.query.filter(Content.deleted_at == None).count()
    published_books = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at == None
    ).count()
    pending_orders = Order.query.filter(Order.status == 'pending_review').count()
    pending_apps = User.query.filter(User.creator_application_status == 'pending').count()

    return render_template('admin/overview.html',
        total_users=total_users,
        total_books=total_books,
        published_books=published_books,
        pending_orders=pending_orders,
        pending_apps=pending_apps,
    )


@admin_dash_bp.route('/content')
@team_read_admin
def content():
    """Content browse — accessible to all team members."""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    search = request.args.get('q', '').strip()

    q = Content.query.filter(Content.deleted_at == None)
    if status_filter:
        q = q.filter(Content.status == status_filter)
    if search:
        q = q.filter(
            (Content.title.ilike(f'%{search}%')) |
            (Content.author.ilike(f'%{search}%'))
        )
    q = q.order_by(Content.created_at.desc())
    books_page = q.paginate(page=page, per_page=20, error_out=False)

    return render_template('admin/content.html',
        books=books_page,
        status_filter=status_filter,
        search=search,
    )


@admin_dash_bp.route('/content/<int:book_id>/approve', methods=['POST'])
@admin_required
def approve_book(book_id):
    """Approve a book for publishing."""
    book = Content.query.get_or_404(book_id)
    book.status = 'approved'
    db.session.commit()
    try:
        from ..services.notifications import notify_new_book_published
        notify_new_book_published(book.id)
    except Exception:
        pass
    try:
        from ..services.channel_post import post_book_to_channel
        post_book_to_channel(book)
    except Exception:
        pass
    flash(f'"{book.title}" approved.', 'success')
    return redirect(url_for('admin_dash.content'))


@admin_dash_bp.route('/content/<int:book_id>/reject', methods=['POST'])
@admin_required
def reject_book(book_id):
    """Reject a book."""
    book = Content.query.get_or_404(book_id)
    book.status = 'rejected'
    db.session.commit()
    flash(f'"{book.title}" rejected.', 'success')
    return redirect(url_for('admin_dash.content'))


@admin_dash_bp.route('/content/<int:book_id>/delete', methods=['POST'])
@admin_required
def delete_book(book_id):
    """Permanently delete a book and ALL related data from the database."""
    book = Content.query.get_or_404(book_id)
    title = book.title
    from .studio import _hard_delete_book
    _hard_delete_book(book_id)
    flash(f'"{title}" has been permanently deleted.', 'success')
    return redirect(url_for('admin_dash.content'))


@admin_dash_bp.route('/users')
@team_read_admin
def users():
    """User list — accessible to all team members."""
    page = request.args.get('page', 1, type=int)
    search = request.args.get('q', '').strip()

    q = User.query
    if search:
        q = q.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.first_name.ilike(f'%{search}%'))
        )
    q = q.order_by(User.date_joined.desc())
    users_page = q.paginate(page=page, per_page=20, error_out=False)

    return render_template('admin/users.html', users=users_page, search=search)


@admin_dash_bp.route('/users/<int:user_id>/ban', methods=['POST'])
@admin_required
def toggle_ban(user_id):
    """Ban or unban a user. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    if user.role in ('admin', 'founder'):
        flash('Cannot ban admins or founder.', 'error')
        return redirect(url_for('admin_dash.users'))

    if user.status == 'banned':
        user.status = 'active'
        flash(f'{user.display_name} unbanned.', 'success')
    else:
        user.status = 'banned'
        flash(f'{user.display_name} banned.', 'success')
    db.session.commit()
    return redirect(url_for('admin_dash.users'))


@admin_dash_bp.route('/orders')
@team_read_admin
def orders():
    """Orders view — accessible to all team members."""
    status_filter = request.args.get('status', '')

    q = db.session.query(Order, Content, User).join(
        Content, Order.content_id == Content.id
    ).join(
        User, Order.user_id == User.id
    )
    if status_filter:
        q = q.filter(Order.status == status_filter)
    items = q.order_by(Order.id.desc()).limit(50).all()

    return render_template('admin/orders.html',
        orders=items,
        status_filter=status_filter,
    )


@admin_dash_bp.route('/orders/<int:order_id>/approve', methods=['POST'])
@admin_required
def approve_order(order_id):
    """Approve an order and grant access."""
    order = Order.query.get_or_404(order_id)
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
        book = Content.query.get(order.content_id)
        notify_order_update(order.user_id, book.title if book else 'Unknown', 'approved', order.content_id)
    except Exception:
        pass
    flash('Order approved.', 'success')
    return redirect(url_for('admin_dash.orders'))


@admin_dash_bp.route('/orders/<int:order_id>/reject', methods=['POST'])
@admin_required
def reject_order(order_id):
    """Reject an order."""
    order = Order.query.get_or_404(order_id)
    order.status = 'rejected'
    db.session.commit()
    try:
        from ..services.notifications import notify_order_update
        book = Content.query.get(order.content_id)
        notify_order_update(order.user_id, book.title if book else 'Unknown', 'rejected', order.content_id)
    except Exception:
        pass
    flash('Order rejected.', 'success')
    return redirect(url_for('admin_dash.orders'))


@admin_dash_bp.route('/creators')
@team_read_admin
def creators():
    """Creator applications — accessible to all team members (read-only view)."""
    pending = User.query.filter(
        User.creator_application_status == 'pending'
    ).order_by(User.date_joined.desc()).all()

    return render_template('admin/creators.html', pending=pending)


@admin_dash_bp.route('/creators/<int:user_id>/approve', methods=['POST'])
@admin_required
def approve_creator(user_id):
    """Approve a creator application. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    from ..services.creator_activation import finalize_creator_upgrade
    finalize_creator_upgrade(user)
    db.session.commit()
    flash(f'{user.display_name} approved as creator.', 'success')
    return redirect(url_for('admin_dash.creators'))


@admin_dash_bp.route('/creators/<int:user_id>/reject', methods=['POST'])
@admin_required
def reject_creator(user_id):
    """Reject a creator application. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    user.creator_application_status = 'rejected'
    db.session.commit()
    flash(f'{user.display_name} application rejected.', 'info')
    return redirect(url_for('admin_dash.creators'))

