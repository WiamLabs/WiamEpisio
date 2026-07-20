"""Founder Dashboard — full platform control panel."""
import re
import logging
from functools import wraps
from flask import Blueprint, render_template, redirect, url_for, request, jsonify, flash, current_app
from flask_login import login_required, current_user

log = logging.getLogger(__name__)
from sqlalchemy import func
from ..extensions import db, csrf
from ..models import (
    User, Content, Order, Access, Genre, FeaturedBook,
    CreatorProfile, Follow, Rating, WebBookContent,
    CommissionSettings, PlatformFeeSettings, Announcement,
    BookCollection, CollectionItem, SectionSettings, EliteStory,
    PlatformConfig, CoinTransaction, CoinBalance, CoinPackage,
    EliteSubscription, CreatorEarnings, CreatorPayout,
    PremiumSubscription, TeamPayroll, TeamPayrollSettings,
    FeatureFlag, CreatorWithdrawal, CreatorPayoutSettings,
    LedgerEntry, SystemWallet, RefundRequest, FraudAlert,
    AdImpression, PremiumCreditsLedger, BookSection,
)
from ..services.founder_ai import get_content_trends, detect_content_issues, get_user_behavior_analysis, get_platform_health

founder_bp = Blueprint('founder_dash', __name__, url_prefix='/founder')


def founder_required(f):
    """Decorator: only the founder can access."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_founder:
            flash('Access denied.', 'error')
            if getattr(current_user, 'is_team_account', False):
                return redirect(url_for('team.dashboard'))
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated


@founder_bp.route('/')
@founder_required
def overview():
    """Episio founder overview — watchers, creators, catalog KPIs."""
    from ..services import episio_founder as ef

    def _safe(default, fn):
        try:
            return fn()
        except Exception:
            db.session.rollback()
            log.exception('founder overview query failed')
            return default

    stats = ef.overview_stats()
    recent_users = _safe([], lambda: User.query.order_by(User.date_joined.desc()).limit(8).all())
    recent_series = _safe([], lambda: ef.list_drama_series(limit=8))

    try:
        from ..services.monetization import COIN_TO_GHS
    except Exception:
        COIN_TO_GHS = 0.1

    month_start = __import__('datetime').datetime.utcnow().replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    month_coin_revenue = _safe(0, lambda: db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(
        CoinTransaction.type == 'purchase',
        CoinTransaction.created_at >= month_start,
    ).scalar() or 0)
    month_revenue_ghs = abs(month_coin_revenue) * COIN_TO_GHS

    try:
        return render_template(
            'founder/overview.html',
            stats=stats,
            recent_users=recent_users,
            recent_series=recent_series,
            month_revenue_ghs=month_revenue_ghs,
            active='overview',
            # legacy template vars kept for safety
            total_users=stats.get('watchers', 0),
            total_creators=stats.get('creators', 0),
            published_books=stats.get('live_series', 0),
            draft_books=max(0, (stats.get('all_series') or 0) - (stats.get('live_series') or 0)),
            pending_apps=stats.get('pending_applications', 0),
            total_coin_purchases=stats.get('coin_purchases_month', 0),
            total_coins_circulating=stats.get('coins_circulating', 0),
            active_elite_subs=stats.get('vip_active', 0),
            recent_books=recent_series,
        )
    except Exception as e:
        log.exception('founder overview template failed')
        from flask import make_response
        body = (
            '<!doctype html><html><body style="background:#08081a;color:#eee;font-family:sans-serif;padding:2rem">'
            '<h1 style="color:#d4a843">Founder panel (safe mode)</h1>'
            '<p>Overview template failed: <code>%s</code></p>'
            '<p><a href="/founder/episio/series" style="color:#d4a843">Series</a> · '
            '<a href="/founder/episio-quality" style="color:#d4a843">Season QC</a> · '
            '<a href="/logout" style="color:#f87171">Logout</a></p>'
            '</body></html>'
        ) % (str(e)[:300].replace('<', '&lt;'),)
        return make_response(body, 200)


@founder_bp.route('/users')
@founder_required
def users():
    """User management."""
    page = request.args.get('page', 1, type=int)
    role_filter = request.args.get('role', '')
    search = request.args.get('q', '').strip()

    q = User.query.filter(~User.status.in_(['deleted', 'deactivated']))
    if role_filter:
        q = q.filter(User.role == role_filter)
    if search:
        q = q.filter(
            (User.username.ilike(f'%{search}%')) |
            (User.first_name.ilike(f'%{search}%')) |
            (User.last_name.ilike(f'%{search}%'))
        )
    q = q.order_by(User.date_joined.desc())
    users_page = q.paginate(page=page, per_page=20, error_out=False)

    return render_template('founder/users.html',
        users=users_page,
        role_filter=role_filter,
        search=search,
    )


@founder_bp.route('/users/<int:user_id>/role', methods=['POST'])
@founder_required
def change_role(user_id):
    """Change a user's role. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    new_role = request.form.get('role', 'user')

    if user.id == current_user.id:
        flash('Cannot change your own role.', 'error')
        return redirect(url_for('founder_dash.users'))

    if user.role == 'founder':
        flash('Cannot change the founder role.', 'error')
        return redirect(url_for('founder_dash.users'))

    if new_role not in ('user', 'creator', 'admin'):
        flash('Invalid role.', 'error')
        return redirect(url_for('founder_dash.users'))

    user.role = new_role
    # Sync RBAC: add or remove admin role entry
    from ..models import Role, UserRole
    admin_role = Role.query.filter_by(name='admin').first()
    if admin_role:
        existing_ur = UserRole.query.filter_by(user_id=user.id, role_id=admin_role.id).first()
        if new_role == 'admin' and not existing_ur:
            db.session.add(UserRole(user_id=user.id, role_id=admin_role.id, assigned_by=current_user.wiam_id))
        elif new_role != 'admin' and existing_ur:
            db.session.delete(existing_ur)
    db.session.commit()
    flash(f'{user.display_name} is now {new_role}.', 'success')
    return redirect(url_for('founder_dash.users'))


@founder_bp.route('/users/<int:user_id>/ban', methods=['POST'])
@founder_required
def toggle_ban(user_id):
    """Ban or unban a user. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('Cannot ban yourself.', 'error')
        return redirect(url_for('founder_dash.users'))

    if user.role == 'founder':
        flash('Cannot ban the founder.', 'error')
        return redirect(url_for('founder_dash.users'))

    if user.status == 'banned':
        user.status = 'active'
        flash(f'{user.display_name} has been unbanned.', 'success')
    else:
        user.status = 'banned'
        flash(f'{user.display_name} has been banned.', 'warning')
    db.session.commit()
    return redirect(url_for('founder_dash.users'))


@founder_bp.route('/content')
@founder_required
def content():
    """Content management."""
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

    return render_template('founder/content.html',
        books=books_page,
        status_filter=status_filter,
        search=search,
    )


@founder_bp.route('/content/<int:book_id>/feature', methods=['POST'])
@founder_required
def toggle_feature(book_id):
    """Toggle featured status of a book."""
    existing = FeaturedBook.query.filter_by(content_id=book_id).first()
    if existing:
        db.session.delete(existing)
        flash('Book removed from featured.', 'success')
    else:
        fb = FeaturedBook(content_id=book_id, featured_by=current_user.wiam_id)
        db.session.add(fb)
        flash('Book added to featured.', 'success')
    db.session.commit()
    return redirect(url_for('founder_dash.content'))


@founder_bp.route('/content/<int:book_id>/approve', methods=['POST'])
@founder_required
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
    return redirect(url_for('founder_dash.content'))


@founder_bp.route('/content/<int:book_id>/reject', methods=['POST'])
@founder_required
def reject_book(book_id):
    """Reject a book."""
    book = Content.query.get_or_404(book_id)
    book.status = 'rejected'
    db.session.commit()
    # Notify creator
    if book.creator_wiam_id:
        try:
            from ..services.notifications import notify_system
            notify_system(book.creator_wiam_id,
                          'Story Update',
                          f'Your story "{book.title}" was not approved. Check the feedback and make revisions.',
                          f'/book/{book.id}')
        except Exception:
            pass
    flash(f'"{book.title}" rejected.', 'success')
    return redirect(url_for('founder_dash.content'))


@founder_bp.route('/content/<int:book_id>/publish', methods=['POST'])
@founder_required
def publish_book(book_id):
    """Set a book's status to ongoing (restore hidden/rejected books)."""
    from datetime import datetime
    book = Content.query.get_or_404(book_id)
    old_status = book.status
    book.status = 'ongoing'
    if not book.published_at:
        book.published_at = datetime.utcnow()
    db.session.commit()
    flash(f'"{book.title}" published (was {old_status}).', 'success')
    return redirect(url_for('founder_dash.content'))


@founder_bp.route('/content/<int:book_id>/delete', methods=['POST'])
@founder_required
def delete_book(book_id):
    """Permanently delete a book and ALL related data from the database."""
    book = Content.query.get_or_404(book_id)
    title = book.title
    from .studio import _hard_delete_book
    _hard_delete_book(book_id)
    flash(f'"{title}" has been permanently deleted from WiamApp.', 'success')
    return redirect(url_for('founder_dash.content'))


@founder_bp.route('/coin-purchases')
@founder_required
def coin_purchases():
    """Coin purchase history — replaces old dead Orders page."""
    from datetime import datetime
    page = request.args.get('page', 1, type=int)
    type_filter = request.args.get('type', '')

    q = CoinTransaction.query
    if type_filter:
        q = q.filter(CoinTransaction.type == type_filter)
    q = q.order_by(CoinTransaction.created_at.desc())

    per_page = 30
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    # Fetch user info for each transaction
    user_ids = list({t.user_id for t in items})
    users_map = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(user_ids)).all()} if user_ids else {}

    return render_template('founder/coin_purchases.html',
        transactions=items,
        users_map=users_map,
        type_filter=type_filter,
        page=page,
        total=total,
        per_page=per_page,
    )


# Legacy redirect — old /orders URL now points to coin purchases
@founder_bp.route('/orders')
@founder_required
def orders():
    return redirect(url_for('founder_dash.coin_purchases'))


@founder_bp.route('/revenue')
@founder_required
def revenue():
    """Platform revenue and earnings overview — coin system."""
    from datetime import datetime

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Coin purchases ──
    all_purchase_coins = db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(CoinTransaction.type == 'purchase').scalar() or 0
    from ..services.monetization import COIN_TO_GHS as _CTG
    total_coin_revenue_ghs = abs(all_purchase_coins) * _CTG

    month_purchase_coins = db.session.query(
        func.coalesce(func.sum(CoinTransaction.amount), 0)
    ).filter(
        CoinTransaction.type == 'purchase',
        CoinTransaction.created_at >= month_start,
    ).scalar() or 0
    month_coin_revenue_ghs = abs(month_purchase_coins) * _CTG

    total_purchases = CoinTransaction.query.filter_by(type='purchase').count()

    # ── Elite subscriptions ──
    active_subs = EliteSubscription.query.filter_by(status='active').count()
    total_subs_ever = EliteSubscription.query.count()
    cfg = PlatformConfig.get()
    monthly_sub_revenue_ghs = active_subs * cfg.elite_price_ghs

    # ── Combined ──
    total_revenue_ghs = total_coin_revenue_ghs + (total_subs_ever * cfg.elite_price_ghs)
    month_revenue_ghs = month_coin_revenue_ghs + monthly_sub_revenue_ghs

    # ── Per-creator earnings (from CreatorEarnings table) ──
    now = datetime.utcnow()
    creator_rows = CreatorEarnings.query.order_by(
        CreatorEarnings.total_coins.desc()
    ).all()

    # Aggregate per creator (all months)
    creator_agg = {}
    for e in creator_rows:
        if e.creator_id not in creator_agg:
            creator_agg[e.creator_id] = {'coins': 0, 'ghs': 0.0}
        creator_agg[e.creator_id]['coins'] += e.total_coins
        creator_agg[e.creator_id]['ghs'] += e.creator_share_ghs

    creator_ids = list(creator_agg.keys())
    creator_users = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(creator_ids)).all()} if creator_ids else {}
    creator_profiles_map = {}
    if creator_ids:
        profiles = CreatorProfile.query.filter(CreatorProfile.wiam_id.in_(creator_ids)).all()
        creator_profiles_map = {p.wiam_id: p for p in profiles}

    earnings_list = []
    for tid in sorted(creator_agg, key=lambda x: creator_agg[x]['coins'], reverse=True):
        user = creator_users.get(tid)
        profile = creator_profiles_map.get(tid)
        earnings_list.append({
            'wiam_id': tid,
            'name': (profile.pen_name if profile else (user.display_name if user else f'ID:{tid}')),
            'username': user.username if user else None,
            'total_coins': creator_agg[tid]['coins'],
            'creator_ghs': creator_agg[tid]['ghs'],
        })

    # ── Pending payouts ──
    pending_payouts = CreatorPayout.query.filter(
        CreatorPayout.status.in_(['pending', 'processing'])
    ).count()

    # ── Revenue rules ──
    from ..models import RevenueRule
    revenue_rules = RevenueRule.query.order_by(RevenueRule.rule_type).all()

    return render_template('founder/revenue.html',
        total_revenue_ghs=total_revenue_ghs,
        month_revenue_ghs=month_revenue_ghs,
        total_purchases=total_purchases,
        month_coin_revenue_ghs=month_coin_revenue_ghs,
        active_subs=active_subs,
        monthly_sub_revenue_ghs=monthly_sub_revenue_ghs,
        earnings_list=earnings_list,
        pending_payouts=pending_payouts,
        cfg=cfg,
        revenue_rules=revenue_rules,
    )


@founder_bp.route('/revenue/update-rule', methods=['POST'])
@founder_required
def update_revenue_rule():
    """Update a revenue rule's creator/platform share percentages."""
    from ..models import RevenueRule
    rule_id = request.form.get('rule_id', type=int)
    creator_pct = request.form.get('creator_share_pct', type=float)
    if not rule_id or creator_pct is None:
        flash('Missing required fields.', 'error')
        return redirect(url_for('founder_dash.revenue'))
    if creator_pct < 0 or creator_pct > 100:
        flash('Creator share must be between 0 and 100.', 'error')
        return redirect(url_for('founder_dash.revenue'))
    rule = RevenueRule.query.get(rule_id)
    if not rule:
        flash('Rule not found.', 'error')
        return redirect(url_for('founder_dash.revenue'))
    rule.creator_share_pct = creator_pct
    rule.platform_share_pct = 100.0 - creator_pct
    db.session.commit()
    flash(f'{rule.rule_type} rule updated: Creator {creator_pct}% / Platform {100 - creator_pct}%', 'success')
    return redirect(url_for('founder_dash.revenue'))


@founder_bp.route('/revenue/add-rule', methods=['POST'])
@founder_required
def add_revenue_rule():
    """Add a new special revenue rule for a creator or book."""
    from ..models import RevenueRule
    rule_type = request.form.get('rule_type', '').strip().upper()
    target_id = request.form.get('target_id', type=int)
    creator_pct = request.form.get('creator_share_pct', type=float)
    if rule_type not in ('SPECIAL_CREATOR', 'SPECIAL_BOOK'):
        flash('Only SPECIAL_CREATOR or SPECIAL_BOOK rules can be added.', 'error')
        return redirect(url_for('founder_dash.revenue'))
    if not target_id or creator_pct is None:
        flash('Target ID and Creator Share % are required.', 'error')
        return redirect(url_for('founder_dash.revenue'))
    rule = RevenueRule(
        rule_type=rule_type, target_id=target_id,
        creator_share_pct=creator_pct, platform_share_pct=100.0 - creator_pct,
        created_by=current_user.wiam_id,
    )
    db.session.add(rule)
    db.session.commit()
    flash(f'Added {rule_type} rule for ID {target_id}: {creator_pct}%/{100 - creator_pct}%', 'success')
    return redirect(url_for('founder_dash.revenue'))


@founder_bp.route('/revenue/delete-rule/<int:rule_id>', methods=['POST'])
@founder_required
def delete_revenue_rule(rule_id):
    """Delete a special revenue rule."""
    from ..models import RevenueRule
    rule = RevenueRule.query.get(rule_id)
    if not rule:
        flash('Rule not found.', 'error')
    elif rule.rule_type in ('DEFAULT', 'ELITE', 'APEX'):
        flash('Cannot delete system rules. Edit them instead.', 'error')
    else:
        db.session.delete(rule)
        db.session.commit()
        flash('Rule deleted.', 'success')
    return redirect(url_for('founder_dash.revenue'))


@founder_bp.route('/payouts/<int:payout_id>/approve', methods=['POST'])
@founder_required
def approve_payout(payout_id):
    """Approve a pending payout."""
    payout = CreatorPayout.query.get_or_404(payout_id)
    if payout.status != 'pending':
        flash('Payout is not pending.', 'error')
        return redirect(url_for('founder_dash.payouts'))
    payout.status = 'processing'
    payout.approved_by = current_user.wiam_id
    db.session.commit()
    # Notify platform (founder dashboard)
    try:
        from ..services.platform_notify import notify_payout_event
        from ..models import User
        creator = User.query.filter_by(wiam_id=payout.creator_id).first()
        notify_payout_event(
            creator.display_name if creator else str(payout.creator_id),
            payout.amount_ghs, 'GHS', 'approved', payout_id=payout.id,
        )
    except Exception:
        pass
    # Notify creator in-app + push
    try:
        from ..services.notifications import notify_system
        notify_system(payout.creator_id,
                      'Payout Approved!',
                      f'Your payout of {payout.amount_ghs} GHS has been approved and is being processed.',
                      '/dashboard?tab=earnings')
    except Exception:
        pass
    flash(f'Payout #{payout.id} approved and queued for processing.', 'success')
    return redirect(url_for('founder_dash.payouts'))


@founder_bp.route('/payouts/<int:payout_id>/reject', methods=['POST'])
@founder_required
def reject_payout(payout_id):
    """Reject a pending payout."""
    payout = CreatorPayout.query.get_or_404(payout_id)
    reason = request.form.get('reason', 'Rejected by Founder')
    payout.status = 'failed'
    payout.failure_reason = reason
    db.session.commit()
    # Notify creator about rejected payout
    try:
        from ..services.notifications import notify_system
        notify_system(payout.creator_id,
                      'Payout Update',
                      f'Your payout request was not processed. Reason: {reason}',
                      '/dashboard?tab=earnings')
    except Exception:
        pass
    flash(f'Payout #{payout.id} rejected.', 'warning')
    return redirect(url_for('founder_dash.payouts'))


@founder_bp.route('/genres')
@founder_required
def genres():
    """Episio genre management (founder-driven; app loads via API)."""
    from ..services.episio_genres import seed_episio_genres
    seed_episio_genres()
    episio_genres = Genre.query.filter_by(product='episio').order_by(
        Genre.sort_order.asc(), Genre.name.asc()
    ).all()
    legacy_genres = Genre.query.filter(
        db.or_(Genre.product == 'legacy', Genre.product.is_(None))
    ).order_by(Genre.name.asc()).all()
    return render_template(
        'founder/genres.html',
        episio_genres=episio_genres,
        legacy_genres=legacy_genres,
        genres=episio_genres,
    )


@founder_bp.route('/genres/add', methods=['POST'])
@founder_required
def add_genre():
    """Add a new genre (default product=episio)."""
    from ..services.episio_genres import add_genre as add_g
    name = request.form.get('name', '').strip()
    product = (request.form.get('product') or 'episio').strip().lower()
    if not name:
        flash('Genre name is required.', 'error')
        return redirect(url_for('founder_dash.genres'))
    try:
        add_g(name, product=product)
        flash(f'Genre "{name}" added for {product}.', 'success')
    except Exception as e:
        flash(str(e)[:200], 'error')
    return redirect(url_for('founder_dash.genres'))


@founder_bp.route('/genres/purge-legacy', methods=['POST'])
@founder_required
def purge_legacy_genres():
    """Hide legacy novel genres from lists (does not drop parked novel rows)."""
    rows = Genre.query.filter(
        db.or_(Genre.product == 'legacy', Genre.product.is_(None))
    ).all()
    for g in rows:
        g.product = 'legacy'
        g.is_active = False
    db.session.commit()
    flash(f'Hid {len(rows)} legacy genres from active lists.', 'success')
    return redirect(url_for('founder_dash.genres'))


@founder_bp.route('/genres/<int:genre_id>/delete', methods=['POST'])
@founder_required
def delete_genre(genre_id):
    """Delete a genre and remove it from all content + user preferences."""
    from ..models import UserGenrePreference
    genre = Genre.query.get_or_404(genre_id)
    genre_name = genre.name

    Content.query.filter(Content.genre == genre_name).update(
        {Content.genre: ''}, synchronize_session=False
    )
    UserGenrePreference.query.filter_by(genre_id=genre_id).delete()
    db.session.delete(genre)
    db.session.commit()
    flash(f'Genre "{genre_name}" deleted.', 'success')
    return redirect(url_for('founder_dash.genres'))


# ---------------------------------------------------------------------------
# BOOK SECTIONS ENGINE
# ---------------------------------------------------------------------------

@founder_bp.route('/book-sections')
@founder_required
def book_sections():
    """Book sections management — dynamic home page sections."""
    sections = BookSection.query.order_by(BookSection.display_order, BookSection.id).all()
    all_genres = Genre.query.order_by(Genre.name).all()
    # Attach book count to each section
    for sec in sections:
        sec._book_count = len(sec.fetch_books())
    return render_template('founder/book_sections.html', sections=sections, genres=all_genres)


@founder_bp.route('/book-sections/add', methods=['POST'])
@founder_required
def add_book_section():
    """Add a new book section."""
    title = request.form.get('title', '').strip()
    if not title:
        flash('Title is required.', 'error')
        return redirect(url_for('founder_dash.book_sections'))

    sec = BookSection(
        title=title,
        description=request.form.get('description', '').strip() or None,
        icon=request.form.get('icon', 'Sparkles').strip() or 'Sparkles',
        genre_filter=request.form.get('genre_filter', '').strip() or None,
        min_views=int(request.form.get('min_views', 0) or 0),
        min_rating=float(request.form.get('min_rating', 0) or 0),
        min_chapters=int(request.form.get('min_chapters', 0) or 0),
        status_filter=request.form.get('status_filter', '').strip() or None,
        sort_by=request.form.get('sort_by', 'views').strip() or 'views',
        max_books=int(request.form.get('max_books', 12) or 12),
        display_order=int(request.form.get('display_order', 0) or 0),
        is_active='is_active' in request.form,
        created_by=current_user.wiam_id or current_user.id,
    )
    db.session.add(sec)
    db.session.commit()
    flash(f'Section "{title}" created. ({len(sec.fetch_books())} books matched)', 'success')
    return redirect(url_for('founder_dash.book_sections'))


@founder_bp.route('/book-sections/<int:sec_id>/edit', methods=['POST'])
@founder_required
def edit_book_section(sec_id):
    """Edit an existing book section."""
    from datetime import datetime
    sec = BookSection.query.get_or_404(sec_id)

    sec.title = request.form.get('title', sec.title).strip() or sec.title
    sec.description = request.form.get('description', '').strip() or None
    sec.icon = request.form.get('icon', 'Sparkles').strip() or 'Sparkles'
    sec.genre_filter = request.form.get('genre_filter', '').strip() or None
    sec.min_views = int(request.form.get('min_views', 0) or 0)
    sec.min_rating = float(request.form.get('min_rating', 0) or 0)
    sec.min_chapters = int(request.form.get('min_chapters', 0) or 0)
    sec.status_filter = request.form.get('status_filter', '').strip() or None
    sec.sort_by = request.form.get('sort_by', 'views').strip() or 'views'
    sec.max_books = int(request.form.get('max_books', 12) or 12)
    sec.display_order = int(request.form.get('display_order', 0) or 0)
    sec.is_active = 'is_active' in request.form
    sec.updated_at = datetime.utcnow()

    db.session.commit()
    flash(f'Section "{sec.title}" updated. ({len(sec.fetch_books())} books matched)', 'success')
    return redirect(url_for('founder_dash.book_sections'))


@founder_bp.route('/book-sections/<int:sec_id>/toggle', methods=['POST'])
@founder_required
def toggle_book_section(sec_id):
    """Toggle a book section on/off."""
    sec = BookSection.query.get_or_404(sec_id)
    sec.is_active = not sec.is_active
    db.session.commit()
    status = 'active' if sec.is_active else 'hidden'
    flash(f'Section "{sec.title}" is now {status}.', 'success')
    return redirect(url_for('founder_dash.book_sections'))


@founder_bp.route('/book-sections/<int:sec_id>/delete', methods=['POST'])
@founder_required
def delete_book_section(sec_id):
    """Delete a book section."""
    sec = BookSection.query.get_or_404(sec_id)
    name = sec.title
    db.session.delete(sec)
    db.session.commit()
    flash(f'Section "{name}" deleted.', 'success')
    return redirect(url_for('founder_dash.book_sections'))


@founder_bp.route('/creators')
@founder_required
def creators():
    """Creator management and applications."""
    import json as _json
    tab = request.args.get('tab', 'active')

    if tab == 'pending':
        pending_users = User.query.filter(
            User.creator_application_status == 'pending'
        ).order_by(User.date_joined.desc()).all()
        active = []
        # Enrich pending apps with application data from CreatorProfile.bio
        pending = []
        for u in pending_users:
            cp = CreatorProfile.query.filter_by(wiam_id=u.wiam_id).first()
            app_data = {}
            if cp and cp.bio:
                try:
                    app_data = _json.loads(cp.bio)
                except (ValueError, TypeError):
                    app_data = {'legacy_bio': cp.bio}
            pending.append({
                'user': u,
                'profile': cp,
                'pen_name': cp.pen_name if cp else '—',
                'writing_experience': app_data.get('writing_experience', '—'),
                'genres': app_data.get('genres', '—'),
                'story_idea': app_data.get('story_idea', '—'),
                'why_wiam': app_data.get('why_wiam', '—'),
                'sample_paragraph': app_data.get('sample_paragraph', '—'),
                'applied_at': app_data.get('applied_at', ''),
                'legacy_bio': app_data.get('legacy_bio', ''),
            })
    else:
        pending = []
        active = User.query.filter(
            User.role == 'creator'
        ).order_by(User.date_joined.desc()).all()

    pending_count = User.query.filter(User.creator_application_status == 'pending').count()

    return render_template('founder/creators.html',
        tab=tab,
        pending=pending,
        active=active,
        pending_count=pending_count,
    )


# ── AI Status Dashboard (S16) ─────────────────────────────────────

@founder_bp.route('/ai-status')
@founder_required
def ai_status():
    """AI provider status, protection system health, and scheduler overview."""
    from datetime import datetime, timedelta
    from ..services.ai_service import provider_status, get_daily_usage, DAILY_LIMITS
    from ..models import UserWarning, PlatformSetting

    # AI provider status
    ai_providers = provider_status()
    ai_usage = get_daily_usage()
    ai_limits = DAILY_LIMITS

    # Protection system stats
    now = datetime.utcnow()
    cutoff_24h = now - timedelta(hours=24)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    warnings_24h = UserWarning.query.filter(UserWarning.created_at >= cutoff_24h).count()
    warnings_7d = UserWarning.query.filter(UserWarning.created_at >= cutoff_7d).count()
    warnings_30d = UserWarning.query.filter(UserWarning.created_at >= cutoff_30d).count()
    strikes_30d = UserWarning.query.filter(
        UserWarning.severity == 'strike',
        UserWarning.created_at >= cutoff_30d,
    ).count()
    unacked = UserWarning.query.filter(UserWarning.acknowledged == False).count()
    banned_users = User.query.filter(User.status == 'banned').count()

    # TC violations
    tc_violations_30d = UserWarning.query.filter(
        UserWarning.category == 'tc_violation',
        UserWarning.created_at >= cutoff_30d,
    ).count()

    # Verified content count
    verified_books = Content.query.filter(Content.ai_verified == True).count()
    total_books = Content.query.filter(Content.deleted_at == None).count()

    # Rate guard settings
    rate_settings = {}
    try:
        rows = PlatformSetting.query.filter(PlatformSetting.key.like('rate_%')).all()
        for r in rows:
            rate_settings[r.key] = r.value
    except Exception:
        pass

    # Scheduler status (from PlatformSetting cache keys)
    curation_status = None
    try:
        from ..services.ai_curation import CACHE_KEY
        cs = PlatformSetting.query.filter_by(key=CACHE_KEY).first()
        if cs and cs.value:
            import json as _j
            data = cs.value if isinstance(cs.value, dict) else _j.loads(cs.value)
            curation_status = data.get('curated_at', 'Never')
    except Exception:
        pass

    return render_template('founder/ai_status.html',
        ai_providers=ai_providers,
        ai_usage=ai_usage,
        ai_limits=ai_limits,
        warnings_24h=warnings_24h,
        warnings_7d=warnings_7d,
        warnings_30d=warnings_30d,
        strikes_30d=strikes_30d,
        unacked=unacked,
        banned_users=banned_users,
        tc_violations_30d=tc_violations_30d,
        verified_books=verified_books,
        total_books=total_books,
        rate_settings=rate_settings,
        curation_status=curation_status,
    )


# ── Founder AI Analytics ───────────────────────────────────

@founder_bp.route('/analytics/content')
@founder_required
def analytics_content():
    """AI-powered content trends and analysis."""
    trends = get_content_trends(days=30)
    return render_template('founder/analytics_content.html', trends=trends)


@founder_bp.route('/analytics/users')
@founder_required
def analytics_users():
    """AI-powered user behavior analysis."""
    page = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    
    # Get user list with behavior scores
    users_query = User.query
    if search:
        users_query = users_query.filter(
            User.username.ilike(f'%{search}%')
        )
    
    users = users_query.paginate(page=page, per_page=20, error_out=False)
    
    # Analyze sample users for insights
    user_insights = []
    for user in users.items:
        analysis = get_user_behavior_analysis(user.id, days=30)
        if 'error' not in analysis:
            user_insights.append({
                'user': user,
                'analysis': analysis
            })
    
    return render_template('founder/analytics_users.html', 
                     users=users, 
                     user_insights=user_insights,
                     search=search)


@founder_bp.route('/analytics/platform')
@founder_required
def analytics_platform():
    """Overall platform health metrics."""
    health = get_platform_health()
    return render_template('founder/analytics_platform.html', health=health)


@founder_bp.route('/ai-content-review')
@founder_required
def ai_content_review():
    """AI-assisted content review queue."""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', '')
    
    # Get content needing review
    content_query = Content.query.filter(
        Content.status.in_(['pending_review', 'flagged'])
    ).order_by(Content.created_at.desc())
    
    if status_filter:
        content_query = content_query.filter(Content.status == status_filter)
    
    content_page = content_query.paginate(page=page, per_page=20, error_out=False)
    
    # AI analysis for each content item
    content_analysis = []
    for content in content_page.items:
        issues = detect_content_issues(content.title + ' ' + (content.description or ''), 'content')
        content_analysis.append({
            'content': content,
            'issues': issues
        })
    
    return render_template('founder/ai_content_review.html',
                     content=content_page,
                     content_analysis=content_analysis,
                     status_filter=status_filter)


@founder_bp.route('/creators/<int:user_id>/approve', methods=['POST'])
@founder_required
def approve_creator(user_id):
    """Approve a creator application. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    from ..services.creator_activation import finalize_creator_upgrade
    finalize_creator_upgrade(user)
    db.session.commit()
    try:
        from ..services.notifications import notify_system
        notify_system(user.wiam_id or user.id,
                      'Creator Application Approved!',
                      'Congratulations! You are now a WiamApp creator. Start writing your first story!',
                      '/studio')
    except Exception:
        pass
    flash(f'{user.display_name} approved as creator.', 'success')
    return redirect(url_for('founder_dash.creators', tab='pending'))


@founder_bp.route('/creators/<int:user_id>/reject', methods=['POST'])
@founder_required
def reject_creator(user_id):
    """Reject a creator application. Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    user.creator_application_status = 'rejected'
    db.session.commit()
    try:
        from ..services.notifications import notify_system
        notify_system(user.wiam_id or user.id,
                      'Creator Application Update',
                      'Your creator application was not approved at this time. You can re-apply later.',
                      '/dashboard')
    except Exception:
        pass
    flash(f'{user.display_name} application rejected.', 'success')
    return redirect(url_for('founder_dash.creators', tab='pending'))


# ── Platform Settings ─────────────────────────────────────────────

@founder_bp.route('/settings')
@founder_required
def settings():
    """Platform settings — coin system, Paystack status, subscriptions, payouts."""
    import requests as http_requests

    cfg = PlatformConfig.get()
    sections = SectionSettings.get_all()
    packages = CoinPackage.query.order_by(CoinPackage.sort_order).all()

    # ── Paystack connection status ──
    paystack_ok = False
    paystack_msg = 'Not configured'
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    public = current_app.config.get('PAYSTACK_PUBLIC_KEY', '')
    plan_code = current_app.config.get('PAYSTACK_ELITE_PLAN_CODE', '')
    if secret and public:
        try:
            resp = http_requests.get(
                'https://api.paystack.co/balance',
                headers={'Authorization': f'Bearer {secret}'},
                timeout=8,
            )
            if resp.status_code == 200 and resp.json().get('status'):
                balance_data = resp.json().get('data', [])
                paystack_balance = 0
                for b in balance_data:
                    if b.get('currency') == 'GHS':
                        paystack_balance = b.get('balance', 0) / 100.0
                paystack_ok = True
                paystack_msg = f'Connected — Balance: GH₵{paystack_balance:,.2f}'
            else:
                paystack_msg = f'API error: {resp.status_code}'
        except Exception as e:
            paystack_msg = f'Connection failed: {e}'
    elif secret:
        paystack_msg = 'Secret key set, public key missing'
    elif public:
        paystack_msg = 'Public key set, secret key missing'

    # ── SMTP status ──
    import os
    smtp_host = (current_app.config.get('SMTP_HOST') or os.environ.get('SMTP_HOST', '') or '').strip()
    smtp_user = (current_app.config.get('SMTP_USER') or os.environ.get('SMTP_USER', '') or '').strip()
    smtp_pass = (current_app.config.get('SMTP_PASS') or os.environ.get('SMTP_PASS', '') or '').strip()
    smtp_port = current_app.config.get('SMTP_PORT') or os.environ.get('SMTP_PORT', '587')
    smtp_ok = bool(smtp_host and smtp_user and smtp_pass)
    smtp_msg = f'{smtp_host}:{smtp_port} as {smtp_user}' if smtp_ok else 'Not configured'
    smtp_missing = []
    if not smtp_host:
        smtp_missing.append('SMTP_HOST')
    if not smtp_user:
        smtp_missing.append('SMTP_USER')
    if not smtp_pass:
        smtp_missing.append('SMTP_PASS')

    # ── Feature lock flags ──
    lock_keys = ['feature_elite', 'feature_bulletin', 'feature_apex', 'feature_programs', 'feature_premium']
    feature_flags = {}
    for k in lock_keys:
        flag = FeatureFlag.query.filter_by(key=k).first()
        feature_flags[k] = flag.is_enabled if flag else True  # default unlocked

    return render_template('founder/settings.html',
        cfg=cfg,
        sections=sections,
        packages=packages,
        paystack_ok=paystack_ok,
        paystack_msg=paystack_msg,
        has_plan_code=bool(plan_code),
        plan_code=plan_code,
        smtp_ok=smtp_ok,
        smtp_msg=smtp_msg,
        smtp_missing=smtp_missing,
        feature_flags=feature_flags,
    )


@founder_bp.route('/settings/test-email', methods=['POST'])
@founder_required
def test_email():
    """Send a test email — direct SMTP diagnostic with detailed error reporting."""
    import os, smtplib, ssl as _ssl
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    to_email = (request.form.get('email') or '').strip()
    if not to_email or '@' not in to_email:
        flash('Enter a valid email to test.', 'error')
        return redirect(url_for('founder_dash.settings'))

    # ── Try Resend HTTP API first (works on Render — uses HTTPS port 443) ──
    resend_key = (os.environ.get('RESEND_API_KEY') or '').strip()
    if resend_key:
        import requests as http_req
        test_html = ('<div style="font-family:sans-serif;padding:20px;background:#1a1a2e;color:#e0e0e0;">'
                     '<h2 style="color:#d4a843;">WiamApp Test Email</h2>'
                     '<p>If you received this, your Resend API email is working correctly!</p></div>')
        smtp_from_env = (os.environ.get('SMTP_FROM') or 'onboarding@resend.dev').strip()
        try:
            resp = http_req.post(
                'https://api.resend.com/emails',
                headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                json={'from': f'WiamApp <{smtp_from_env}>', 'to': [to_email], 'subject': 'WiamApp Test Email', 'html': test_html},
                timeout=15,
            )
            if resp.status_code in (200, 201):
                flash(f'Test email sent to {to_email} via Resend API! Check inbox + spam.', 'success')
                return redirect(url_for('founder_dash.settings'))
            else:
                flash(f'Resend API error {resp.status_code}: {resp.text[:200]}', 'error')
                return redirect(url_for('founder_dash.settings'))
        except Exception as e:
            flash(f'Resend API failed: {e}', 'error')
            return redirect(url_for('founder_dash.settings'))

    # ── Fall back to SMTP ──
    smtp_host = (current_app.config.get('SMTP_HOST') or os.environ.get('SMTP_HOST', '') or '').strip()
    smtp_user = (current_app.config.get('SMTP_USER') or os.environ.get('SMTP_USER', '') or '').strip()
    smtp_pass = (current_app.config.get('SMTP_PASS') or os.environ.get('SMTP_PASS', '') or '').strip()
    smtp_pass_clean = smtp_pass.replace(' ', '')
    smtp_port = int(current_app.config.get('SMTP_PORT') or os.environ.get('SMTP_PORT', '587'))
    smtp_from = (current_app.config.get('SMTP_FROM') or os.environ.get('SMTP_FROM', '') or smtp_user).strip()

    if not smtp_host or not smtp_user or not smtp_pass_clean:
        flash(f'SMTP not configured — host: {smtp_host or "MISSING"}, user: {smtp_user or "MISSING"}, '
              f'pass: {"MISSING" if not smtp_pass_clean else f"{len(smtp_pass_clean)} chars"}. '
              f'Tip: Set RESEND_API_KEY env var (free at resend.com) to bypass Render SMTP blocks.', 'error')
        return redirect(url_for('founder_dash.settings'))

    # Force IPv4 — Render lacks IPv6, smtp.gmail.com AAAA causes Errno 101
    import socket
    smtp_ip = smtp_host
    try:
        results = socket.getaddrinfo(smtp_host, None, socket.AF_INET)
        if results:
            smtp_ip = results[0][4][0]
            log.info("Resolved %s → %s (IPv4)", smtp_host, smtp_ip)
    except socket.gaierror:
        pass

    log.info("TEST EMAIL: host=%s(%s) port=%d user=%s from=%s pass_len=%d to=%s",
             smtp_host, smtp_ip, smtp_port, smtp_user, smtp_from, len(smtp_pass_clean), to_email)

    # Build a simple test message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'WiamApp Test Email'
    msg['From'] = f'WiamApp <{smtp_from}>'
    msg['To'] = to_email
    msg.attach(MIMEText(
        '<div style="font-family:sans-serif;padding:20px;background:#1a1a2e;color:#e0e0e0;">'
        '<h2 style="color:#d4a843;">WiamApp Test Email</h2>'
        '<p>If you received this, your SMTP is working correctly!</p></div>', 'html'))

    ctx = _ssl.create_default_context()
    errors = []

    # Try STARTTLS (587) first, then SSL (465)
    methods = [('starttls', 587), ('ssl', 465)] if smtp_port == 587 else [('ssl', 465), ('starttls', 587)]

    for method, port in methods:
        try:
            log.info("TEST: trying %s on %s:%d ...", method, smtp_ip, port)
            if method == 'ssl':
                with smtplib.SMTP_SSL(smtp_ip, port, timeout=10, context=ctx) as srv:
                    srv.ehlo(smtp_host)
                    srv.login(smtp_user, smtp_pass_clean)
                    srv.send_message(msg)
            else:
                with smtplib.SMTP(smtp_ip, port, timeout=10) as srv:
                    srv.ehlo(smtp_host)
                    srv.starttls(context=ctx)
                    srv.ehlo(smtp_host)
                    srv.login(smtp_user, smtp_pass_clean)
                    srv.send_message(msg)
            log.info("TEST EMAIL SENT via %s:%d to %s", method, port, to_email)
            flash(f'Test email sent to {to_email} via {method.upper()}:{port}! Check inbox + spam.', 'success')
            return redirect(url_for('founder_dash.settings'))

        except smtplib.SMTPAuthenticationError as e:
            err = f'{method.upper()}:{port} — AUTH FAILED (code {e.smtp_code}): {e.smtp_error}'
            log.error("TEST: %s", err)
            errors.append(err)
            break  # auth error = wrong password, no point trying other method
        except smtplib.SMTPConnectError as e:
            err = f'{method.upper()}:{port} — Connection refused: {e}'
            log.error("TEST: %s", err)
            errors.append(err)
        except smtplib.SMTPServerDisconnected as e:
            err = f'{method.upper()}:{port} — Server disconnected: {e}'
            log.error("TEST: %s", err)
            errors.append(err)
        except TimeoutError:
            err = f'{method.upper()}:{port} — Connection timed out (port may be blocked by Render)'
            log.error("TEST: %s", err)
            errors.append(err)
        except OSError as e:
            err = f'{method.upper()}:{port} — Network error: {e}'
            log.error("TEST: %s", err)
            errors.append(err)
        except Exception as e:
            err = f'{method.upper()}:{port} — {type(e).__name__}: {e}'
            log.error("TEST: %s", err)
            errors.append(err)

    # All methods failed — show the exact errors + Render guidance
    error_detail = ' | '.join(str(e)[:120] for e in errors)
    resend_key = os.environ.get('RESEND_API_KEY', '')
    if not resend_key:
        flash(f'Email FAILED. {error_detail}. Render blocks SMTP ports 587/465. '
              f'Set RESEND_API_KEY env var (free at resend.com) to use HTTP-based email instead.', 'error')
    else:
        flash(f'Email FAILED. {error_detail}', 'error')
    return redirect(url_for('founder_dash.settings'))


def _sync_paystack_plan(config_key, plan_name, price_ghs):
    """Sync a subscription plan price to Paystack. Updates existing or creates new."""
    import requests as http_requests
    import os
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        log.warning("Paystack secret key not configured — skipping plan sync")
        return
    plan_code = current_app.config.get(config_key, '')
    amount_pesewas = int(price_ghs * 100)
    headers = {'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'}

    if plan_code:
        # Try to update existing plan
        try:
            resp = http_requests.put(
                f'https://api.paystack.co/plan/{plan_code}',
                json={'name': plan_name, 'amount': amount_pesewas},
                headers=headers, timeout=15,
            )
            data = resp.json()
            if data.get('status'):
                log.info("Paystack plan %s updated to %d pesewas", plan_code, amount_pesewas)
                return
            else:
                log.warning("Paystack plan update failed (%s): %s — will create new",
                            plan_code, data.get('message'))
        except Exception as e:
            log.error("Paystack plan update error: %s", e)

    # Create a new plan if update failed or no plan code exists
    try:
        resp = http_requests.post(
            'https://api.paystack.co/plan',
            json={
                'name': plan_name,
                'amount': amount_pesewas,
                'interval': 'monthly',
                'currency': 'GHS',
            },
            headers=headers, timeout=15,
        )
        data = resp.json()
        if data.get('status') and data.get('data', {}).get('plan_code'):
            new_code = data['data']['plan_code']
            log.info("Paystack plan created: %s = %s (%d pesewas)", plan_name, new_code, amount_pesewas)
            # Update the env-based config key so subsequent requests use the new plan
            os.environ[config_key] = new_code
            current_app.config[config_key] = new_code
            flash(f'Paystack plan synced: {new_code}', 'info')
        else:
            log.error("Paystack plan creation failed: %s", data.get('message'))
            flash(f'Warning: Could not sync plan to Paystack — {data.get("message", "unknown error")}', 'warning')
    except Exception as e:
        log.error("Paystack plan create error: %s", e)
        flash('Warning: Could not sync plan to Paystack.', 'warning')


@founder_bp.route('/settings/platform-config', methods=['POST'])
@founder_required
def update_platform_config():
    """Update platform config (revenue splits, elite price, min payout)."""
    from datetime import datetime
    cfg = PlatformConfig.get()
    field = request.form.get('field', '')

    try:
        if field == 'creator_revenue_pct':
            pct = int(request.form.get('value', 50))
            if 10 <= pct <= 90:
                cfg.creator_revenue_pct = pct / 100.0
                flash(f'Creator revenue split set to {pct}%.', 'success')
            else:
                flash('Must be between 10% and 90%.', 'error')
        elif field == 'elite_price_ghs':
            price = float(request.form.get('value', 25))
            if 1 <= price <= 500:
                cfg.elite_price_ghs = price
                _sync_paystack_plan('PAYSTACK_ELITE_PLAN_CODE', 'WiamElite', price)
                flash(f'Elite price set to GH₵{price:.2f}/mo.', 'success')
            else:
                flash('Must be between GH₵1 and GH₵500.', 'error')
        elif field == 'premium_price_ghs':
            price = float(request.form.get('value', 20))
            if 1 <= price <= 500:
                cfg.premium_price_ghs = price
                _sync_paystack_plan('PAYSTACK_PREMIUM_PLAN_CODE', 'WiamPremium', price)
                flash(f'Premium price set to GH₵{price:.2f}/mo.', 'success')
            else:
                flash('Must be between GH₵1 and GH₵500.', 'error')
        elif field == 'elite_creator_pct':
            pct = int(request.form.get('value', 60))
            if 10 <= pct <= 90:
                cfg.elite_creator_pct = pct / 100.0
                flash(f'Elite creator share set to {pct}%.', 'success')
            else:
                flash('Must be between 10% and 90%.', 'error')
        elif field == 'min_payout_ghs':
            amt = float(request.form.get('value', 10))
            if 1 <= amt <= 100:
                cfg.min_payout_ghs = amt
                flash(f'Minimum payout set to GH₵{amt:.2f}.', 'success')
            else:
                flash('Must be between GH₵1 and GH₵100.', 'error')
        elif field == 'premium_monthly_unlock_credits':
            credits = int(request.form.get('value', 10))
            if 1 <= credits <= 100:
                cfg.premium_monthly_unlock_credits = credits
                flash(f'Monthly unlock credits set to {credits}.', 'success')
            else:
                flash('Must be between 1 and 100.', 'error')
        else:
            flash('Unknown setting.', 'error')
    except (ValueError, TypeError):
        flash('Invalid value.', 'error')

    cfg.updated_at = datetime.utcnow()
    db.session.commit()
    return redirect(url_for('founder_dash.settings'))


@founder_bp.route('/settings/feature-flag', methods=['POST'])
@founder_required
def toggle_feature_flag():
    """Toggle a monetization feature flag ON/OFF."""
    from datetime import datetime
    cfg = PlatformConfig.get()
    flag = request.form.get('flag', '')

    allowed_flags = [
        'ff_premium_enabled', 'ff_elite_paywall_enabled', 'ff_apex_paywall_enabled',
        'ff_monthly_unlocks_enabled', 'ff_ad_free_premium_enabled', 'ff_premium_badge_enabled',
    ]
    if flag not in allowed_flags:
        flash('Unknown feature flag.', 'error')
        return redirect(url_for('founder_dash.settings'))

    current = getattr(cfg, flag, False)
    setattr(cfg, flag, not current)
    cfg.updated_at = datetime.utcnow()
    db.session.commit()

    label = flag.replace('ff_', '').replace('_', ' ').title()
    flash(f'{label} {"enabled" if not current else "disabled"}.', 'success')
    return redirect(url_for('founder_dash.settings'))


@founder_bp.route('/settings/feature-lock', methods=['POST'])
@founder_required
def toggle_feature_lock():
    """Lock or unlock a platform feature (Elite, Bulletin, Apex, Programs, Premium)."""
    from datetime import datetime
    key = request.form.get('key', '')
    allowed_keys = ['feature_elite', 'feature_bulletin', 'feature_apex', 'feature_programs', 'feature_premium']
    if key not in allowed_keys:
        flash('Unknown feature key.', 'error')
        return redirect(url_for('founder_dash.settings'))

    try:
        flag = FeatureFlag.query.filter_by(key=key).first()
        if not flag:
            # First time: create as LOCKED (user clicked Lock on an unlocked feature)
            flag = FeatureFlag(key=key, is_enabled=False, description=f'Lock gate for {key}')
            db.session.add(flag)
        else:
            flag.is_enabled = not flag.is_enabled

        flag.updated_by = current_user.wiam_id or current_user.id
        flag.updated_at = datetime.utcnow()
        db.session.commit()

        label = key.replace('feature_', '').replace('_', ' ').title()
        status = 'UNLOCKED' if flag.is_enabled else 'LOCKED'
        flash(f'{label} is now {status}.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Failed to update feature lock: {str(e)[:100]}', 'error')

    return redirect(url_for('founder_dash.settings'))


@founder_bp.route('/settings/coin-package', methods=['POST'])
@founder_required
def update_coin_package():
    """Toggle a coin package active/inactive or update its details."""
    from datetime import datetime
    pkg_id = request.form.get('package_id', type=int)
    action = request.form.get('action', '')

    if not pkg_id:
        flash('Invalid package.', 'error')
        return redirect(url_for('founder_dash.settings'))

    pkg = CoinPackage.query.get(pkg_id)
    if not pkg:
        flash('Package not found.', 'error')
        return redirect(url_for('founder_dash.settings'))

    if action == 'toggle':
        pkg.is_active = not pkg.is_active
        flash(f'Package "{pkg.label}" {"activated" if pkg.is_active else "deactivated"}.', 'success')
    elif action == 'update':
        try:
            pkg.label = request.form.get('label', pkg.label).strip() or pkg.label
            pkg.coins = int(request.form.get('coins', pkg.coins))
            pkg.bonus_coins = int(request.form.get('bonus_coins', pkg.bonus_coins))
            pkg.price_ghs = float(request.form.get('price_ghs', pkg.price_ghs))
            flash(f'Package "{pkg.label}" updated.', 'success')
        except (ValueError, TypeError):
            flash('Invalid package values.', 'error')

    db.session.commit()
    return redirect(url_for('founder_dash.settings'))


# ── Section Settings (curated home page sections) ────────────────

@founder_bp.route('/settings/section-toggle', methods=['POST'])
@founder_required
def toggle_section():
    """Toggle a section setting (is_active or admin_can_manage)."""
    from datetime import datetime
    section_key = request.form.get('section_key', '')
    field = request.form.get('field', '')  # 'is_active' or 'admin_can_manage'

    if field not in ('is_active', 'admin_can_manage'):
        flash('Invalid field.', 'error')
        return redirect(url_for('founder_dash.settings'))

    s = SectionSettings.get(section_key)
    if not s:
        flash('Section not found.', 'error')
        return redirect(url_for('founder_dash.settings'))

    current_val = getattr(s, field)
    setattr(s, field, not current_val)
    s.updated_at = datetime.utcnow()
    db.session.commit()

    state = 'ON' if getattr(s, field) else 'OFF'
    label = 'Section active' if field == 'is_active' else 'Admin access'
    flash(f'{s.label}: {label} → {state}', 'success')
    return redirect(url_for('founder_dash.settings'))


# ── Admin Management ──────────────────────────────────────────────

@founder_bp.route('/admins')
@founder_required
def admins():
    """Admin management — list, add, remove admins."""
    from ..models import Role, UserRole
    # Show admins from both legacy column AND RBAC
    legacy_admins = User.query.filter(User.role == 'admin').all()
    rbac_admin_role = Role.query.filter_by(name='admin').first()
    rbac_admin_ids = []
    if rbac_admin_role:
        rbac_admin_ids = [ur.user_id for ur in UserRole.query.filter_by(role_id=rbac_admin_role.id).all()]
    all_admin_ids = list(set([u.id for u in legacy_admins] + rbac_admin_ids))
    admin_users = User.query.filter(User.id.in_(all_admin_ids)).order_by(User.date_joined.desc()).all() if all_admin_ids else []
    return render_template('founder/admins.html', admins=admin_users)


@founder_bp.route('/admins/add', methods=['POST'])
@founder_required
def add_admin():
    """Add a new admin by email or username."""
    identifier = request.form.get('identifier', '').strip().lstrip('@')
    if not identifier:
        flash('Please provide an email or username.', 'error')
        return redirect(url_for('founder_dash.admins'))

    # Try by wiam_id first, then username
    try:
        user = User.query.filter_by(wiam_id=int(identifier)).first()
    except (ValueError, TypeError):
        user = User.query.filter(func.lower(User.username) == identifier.lower()).first()

    if not user:
        flash(f'User "{identifier}" not found.', 'error')
        return redirect(url_for('founder_dash.admins'))

    if user.role == 'founder':
        flash('Cannot change the founder role.', 'error')
        return redirect(url_for('founder_dash.admins'))

    if user.role == 'admin' or user.has_role('admin'):
        flash(f'{user.display_name} is already an admin.', 'info')
        return redirect(url_for('founder_dash.admins'))

    user.role = 'admin'
    # Also create RBAC admin role entry
    from ..models import Role, UserRole
    admin_role = Role.query.filter_by(name='admin').first()
    if admin_role:
        existing_ur = UserRole.query.filter_by(user_id=user.id, role_id=admin_role.id).first()
        if not existing_ur:
            db.session.add(UserRole(user_id=user.id, role_id=admin_role.id, assigned_by=current_user.wiam_id))
    db.session.commit()
    flash(f'{user.display_name} promoted to admin.', 'success')
    return redirect(url_for('founder_dash.admins'))


@founder_bp.route('/admins/<int:user_id>/remove', methods=['POST'])
@founder_required
def remove_admin(user_id):
    """Remove an admin (demote to user). Accepts user.id (primary key)."""
    user = User.query.get_or_404(user_id)
    if user.role == 'founder':
        flash('Cannot demote the founder.', 'error')
        return redirect(url_for('founder_dash.admins'))

    user.role = 'user'
    # Also remove RBAC admin role entry
    from ..models import Role, UserRole
    admin_role = Role.query.filter_by(name='admin').first()
    if admin_role:
        ur = UserRole.query.filter_by(user_id=user.id, role_id=admin_role.id).first()
        if ur:
            db.session.delete(ur)
    db.session.commit()
    flash(f'{user.display_name} demoted to user.', 'success')
    return redirect(url_for('founder_dash.admins'))


# ---------------------------------------------------------------------------
# Announcements
# ---------------------------------------------------------------------------

@founder_bp.route('/announcements')
@founder_required
def announcements():
    """List all announcements."""
    items = Announcement.query.order_by(Announcement.created_at.desc()).all()
    return render_template('founder/announcements.html', announcements=items)


@founder_bp.route('/announcements/create', methods=['POST'])
@founder_required
def create_announcement():
    """Create a new announcement — auto-notify all users + post to channel."""
    title = request.form.get('title', '').strip()
    message = request.form.get('message', '').strip()
    ann_type = request.form.get('type', 'info')
    audience = request.form.get('audience', 'all')

    if not title:
        flash('Title is required.', 'error')
        return redirect(url_for('founder_dash.announcements'))

    ann = Announcement(title=title, message=message, type=ann_type, audience=audience)
    db.session.add(ann)
    db.session.commit()

    # Auto-notify all relevant users (batch for speed)
    try:
        from ..models import Notification
        from ..services.notifications import _try_push
        if audience == 'creators':
            users = User.query.filter(
                User.role.in_(['creator', 'founder', 'admin']),
                User.status != 'banned',
            ).all()
        else:
            users = User.query.filter(User.status != 'banned').all()
        notif_count = 0
        for u in users:
            uid = u.wiam_id or u.id
            if not uid:
                continue
            notif = Notification(
                user_id=uid, type='announcement',
                title=title, message=message or title,
                link='/notifications',
            )
            db.session.add(notif)
            notif_count += 1
        db.session.commit()
        log.info("Announcement '%s' → %d notifications created", title, notif_count)
        # Send push notifications (best-effort, don't block)
        for u in users[:50]:  # limit push to avoid timeout
            uid = u.wiam_id or u.id
            if uid:
                _try_push(uid, title, message or title, '/notifications', notif_type='announcement')
    except Exception as e:
        log.error("Announcement notification error: %s", e, exc_info=True)
        db.session.rollback()

    # Auto-post to announcement channel
    try:
        from ..services.channel_post import post_announcement_to_channel
        post_announcement_to_channel(title, message)
    except Exception:
        pass

    flash(f'Announcement "{title}" published!', 'success')
    return redirect(url_for('founder_dash.announcements'))


@founder_bp.route('/announcements/<int:ann_id>/toggle', methods=['POST'])
@founder_required
def toggle_announcement(ann_id):
    """Toggle announcement active/inactive."""
    ann = Announcement.query.get_or_404(ann_id)
    ann.is_active = not ann.is_active
    db.session.commit()
    flash(f'Announcement {"activated" if ann.is_active else "dismissed"}.', 'success')
    return redirect(url_for('founder_dash.announcements'))


@founder_bp.route('/announcements/<int:ann_id>/delete', methods=['POST'])
@founder_required
def delete_announcement(ann_id):
    """Delete an announcement."""
    ann = Announcement.query.get_or_404(ann_id)
    db.session.delete(ann)
    db.session.commit()
    flash('Announcement deleted.', 'success')
    return redirect(url_for('founder_dash.announcements'))


# ---------------------------------------------------------------------------
# F8: Book Collections / Curated Lists
# ---------------------------------------------------------------------------

@founder_bp.route('/collections')
@founder_required
def collections():
    """List all curated collections."""
    items = BookCollection.query.order_by(BookCollection.sort_order, BookCollection.created_at.desc()).all()
    coll_data = []
    for c in items:
        book_count = CollectionItem.query.filter_by(collection_id=c.id).count()
        coll_data.append({'collection': c, 'count': book_count})
    return render_template('founder/collections.html', collections=coll_data)


@founder_bp.route('/collections/create', methods=['POST'])
@founder_required
def create_collection():
    """Create a new curated collection."""
    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    if not title:
        flash('Title is required.', 'error')
        return redirect(url_for('founder_dash.collections'))
    coll = BookCollection(title=title, description=description)
    db.session.add(coll)
    db.session.commit()
    flash(f'Collection "{title}" created.', 'success')
    return redirect(url_for('founder_dash.collections'))


@founder_bp.route('/collections/<int:coll_id>')
@founder_required
def collection_detail(coll_id):
    """View and manage books in a collection."""
    coll = BookCollection.query.get_or_404(coll_id)
    items = db.session.query(CollectionItem, Content).join(
        Content, CollectionItem.content_id == Content.id
    ).filter(CollectionItem.collection_id == coll_id).order_by(CollectionItem.sort_order).all()
    # Available books to add
    existing_ids = {ci.content_id for ci, _ in items}
    available = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at == None,
        ~Content.id.in_(existing_ids) if existing_ids else True,
    ).order_by(Content.title).limit(50).all()
    return render_template('founder/collection_detail.html', collection=coll, items=items, available=available)


@founder_bp.route('/collections/<int:coll_id>/add', methods=['POST'])
@founder_required
def add_to_collection(coll_id):
    """Add a book to a collection."""
    BookCollection.query.get_or_404(coll_id)
    content_id = request.form.get('content_id', 0, type=int)
    if content_id:
        existing = CollectionItem.query.filter_by(collection_id=coll_id, content_id=content_id).first()
        if not existing:
            db.session.add(CollectionItem(collection_id=coll_id, content_id=content_id))
            db.session.commit()
            flash('Book added to collection.', 'success')
    return redirect(url_for('founder_dash.collection_detail', coll_id=coll_id))


@founder_bp.route('/collections/<int:coll_id>/remove/<int:item_id>', methods=['POST'])
@founder_required
def remove_from_collection(coll_id, item_id):
    """Remove a book from a collection."""
    item = CollectionItem.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    flash('Book removed from collection.', 'success')
    return redirect(url_for('founder_dash.collection_detail', coll_id=coll_id))


@founder_bp.route('/collections/<int:coll_id>/toggle', methods=['POST'])
@founder_required
def toggle_collection(coll_id):
    """Toggle collection active/inactive."""
    coll = BookCollection.query.get_or_404(coll_id)
    coll.is_active = not coll.is_active
    db.session.commit()
    flash(f'Collection {"activated" if coll.is_active else "hidden"}.', 'success')
    return redirect(url_for('founder_dash.collections'))


@founder_bp.route('/collections/<int:coll_id>/delete', methods=['POST'])
@founder_required
def delete_collection(coll_id):
    """Delete a collection and its items."""
    coll = BookCollection.query.get_or_404(coll_id)
    CollectionItem.query.filter_by(collection_id=coll_id).delete()
    db.session.delete(coll)
    db.session.commit()
    flash('Collection deleted.', 'success')
    return redirect(url_for('founder_dash.collections'))


# ---------------------------------------------------------------------------
# MODERATION (Phase 4)
# ---------------------------------------------------------------------------

@founder_bp.route('/moderation')
@founder_required
def moderation():
    """Moderation dashboard — flagged content, reports, log."""
    from ..models import ContentFlag, ContentReport, ModerationLog, BannedWord

    page = request.args.get('page', 1, type=int)
    tab = request.args.get('tab', 'flagged')

    flagged = ContentFlag.query.filter(
        ContentFlag.status.in_(['flagged', 'hidden'])
    ).order_by(ContentFlag.updated_at.desc()).all()

    pending_reports = ContentReport.query.filter_by(status='pending').order_by(
        ContentReport.created_at.desc()
    ).limit(50).all()

    log_entries = ModerationLog.query.order_by(
        ModerationLog.created_at.desc()
    ).limit(100).all()

    banned_count = BannedWord.query.filter_by(is_active=True).count()

    # Enrich flagged items with book info
    flagged_items = []
    for f in flagged:
        book = Content.query.get(f.content_id)
        flagged_items.append({'flag': f, 'book': book})

    # Enrich reports with book + reporter info
    report_items = []
    for r in pending_reports:
        book = Content.query.get(r.content_id)
        reporter = User.query.filter_by(wiam_id=r.reporter_id).first()
        report_items.append({'report': r, 'book': book, 'reporter': reporter})

    return render_template('founder/moderation.html',
        tab=tab,
        flagged_items=flagged_items,
        report_items=report_items,
        log_entries=log_entries,
        banned_count=banned_count,
    )


@founder_bp.route('/moderation/action', methods=['POST'])
@founder_required
def moderation_action():
    """Founder takes action on flagged content."""
    from ..services.moderation import founder_action

    content_id = request.form.get('content_id', type=int)
    chapter_number = request.form.get('chapter_number', type=int)
    action = request.form.get('action', '')
    reason = request.form.get('reason', '')

    if not content_id or action not in ('clear', 'hide', 'restore'):
        flash('Invalid action.', 'error')
        return redirect(url_for('founder_dash.moderation'))

    founder_action(current_user.wiam_id, action, content_id, chapter_number, reason)

    labels = {'clear': 'Content approved', 'hide': 'Content hidden', 'restore': 'Content restored'}
    flash(f'{labels.get(action, "Action taken")}.', 'success')
    return redirect(url_for('founder_dash.moderation'))


@founder_bp.route('/moderation/report/<int:report_id>/dismiss', methods=['POST'])
@founder_required
def dismiss_report(report_id):
    """Dismiss a report."""
    from ..models import ContentReport
    report = ContentReport.query.get_or_404(report_id)
    report.status = 'dismissed'
    report.reviewed_by = current_user.wiam_id
    from datetime import datetime
    report.reviewed_at = datetime.utcnow()
    db.session.commit()
    flash('Report dismissed.', 'info')
    return redirect(url_for('founder_dash.moderation', tab='reports'))


# ---------------------------------------------------------------------------
# WARNINGS (role-specific: creator vs team)
# ---------------------------------------------------------------------------

CREATOR_WARNING_CATEGORIES = [
    ('content_violation', 'Content Violation'),
    ('plagiarism', 'Plagiarism'),
    ('monetization_abuse', 'Monetization Abuse'),
    ('spam', 'Spam / Manipulation'),
    ('inappropriate', 'Inappropriate Content'),
    ('copyright', 'Copyright Infringement'),
    ('general', 'General Warning'),
]

TEAM_WARNING_CATEGORIES = [
    ('conduct', 'Professional Conduct'),
    ('performance', 'Performance Issue'),
    ('confidentiality', 'Confidentiality Breach'),
    ('absence', 'Unauthorized Absence'),
    ('misuse', 'Platform Misuse'),
    ('insubordination', 'Insubordination'),
    ('general', 'General Warning'),
]


@founder_bp.route('/warnings')
@founder_required
def warnings_list():
    """View all issued warnings — filterable by role type."""
    from ..models import UserWarning, User
    role_filter = request.args.get('role', '')  # creator | team | ''
    q = UserWarning.query
    if role_filter:
        q = q.filter(UserWarning.target_role == role_filter)
    warnings = q.order_by(UserWarning.created_at.desc()).limit(100).all()

    # Enrich with user names + emails
    user_ids = {w.user_id for w in warnings}
    users_map = {}   # user_id -> display_name
    emails_map = {}  # user_id -> email
    if user_ids:
        for u in User.query.filter(User.wiam_id.in_(user_ids)).all():
            users_map[u.wiam_id] = u.display_name
            if u.email:
                emails_map[u.wiam_id] = u.email
        for u in User.query.filter(User.id.in_(user_ids)).all():
            if u.id not in users_map:
                users_map[u.id] = u.display_name
            if u.email and u.id not in emails_map:
                emails_map[u.id] = u.email

    return render_template('founder/warnings.html',
        warnings=warnings, users_map=users_map, emails_map=emails_map,
        role_filter=role_filter,
        creator_categories=CREATOR_WARNING_CATEGORIES,
        team_categories=TEAM_WARNING_CATEGORIES,
    )


@founder_bp.route('/warnings/issue', methods=['POST'])
@founder_required
def issue_warning():
    """Issue a warning to a user (creator or team member)."""
    from ..models import UserWarning, User, Notification
    from datetime import datetime

    user_id = request.form.get('user_id', type=int)
    target_role = request.form.get('target_role', 'creator')
    category = request.form.get('category', 'general')
    message = request.form.get('message', '').strip()
    severity = request.form.get('severity', 'warning')

    if not user_id or not message:
        flash('User and message are required.', 'error')
        return redirect(url_for('founder_dash.warnings_list'))

    if severity not in ('notice', 'warning', 'strike'):
        severity = 'warning'
    if target_role not in ('creator', 'team'):
        target_role = 'creator'

    # Find user — try wiam_id first, then id
    user = User.query.filter_by(wiam_id=user_id).first()
    if not user:
        user = User.query.get(user_id)
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('founder_dash.warnings_list'))

    uid = user.wiam_id or user.id
    w = UserWarning(
        user_id=uid,
        target_role=target_role,
        category=category,
        message=message,
        severity=severity,
        issued_by=current_user.wiam_id,
    )
    db.session.add(w)

    # Notify the user
    severity_labels = {'notice': 'Notice', 'warning': 'Warning', 'strike': 'Strike'}
    try:
        notif = Notification(
            user_id=uid,
            type='system',
            title=f'{severity_labels.get(severity, "Warning")}: {category.replace("_", " ").title()}',
            message=message[:200],
            link='/profile/warnings',
        )
        db.session.add(notif)
    except Exception as e:
        log.error("Warning notification error: %s", e)

    db.session.commit()

    # Send warning email to user (if they have email)
    try:
        if user.email:
            from ..services.bot_review import _send_warning_email
            _send_warning_email(user, w)
    except Exception as e:
        log.warning("Founder warning email failed for user %s: %s", user.id, str(e)[:100])

    flash(f'{severity_labels.get(severity, "Warning")} issued to {user.display_name}.', 'success')
    return redirect(url_for('founder_dash.warnings_list', role=target_role))


@founder_bp.route('/warnings/<int:warning_id>/delete', methods=['POST'])
@founder_required
def delete_warning(warning_id):
    """Delete a warning."""
    from ..models import UserWarning
    w = UserWarning.query.get_or_404(warning_id)
    db.session.delete(w)
    db.session.commit()
    flash('Warning deleted.', 'success')
    return redirect(url_for('founder_dash.warnings_list'))


@founder_bp.route('/disputes')
@founder_required
def disputes():
    """View all user-submitted reports/disputes."""
    from ..models import Report
    status_filter = request.args.get('status', '')
    q = Report.query
    if status_filter:
        q = q.filter_by(status=status_filter)
    reports = q.order_by(Report.created_at.desc()).limit(100).all()
    # Enrich with reporter info
    reporter_ids = list({r.reporter_user_id for r in reports})
    r_map = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(reporter_ids)).all()} if reporter_ids else {}
    for r in reports:
        r._reporter = r_map.get(r.reporter_user_id)
    counts = {
        'open': Report.query.filter_by(status='OPEN').count(),
        'in_review': Report.query.filter_by(status='IN_REVIEW').count(),
        'resolved': Report.query.filter_by(status='RESOLVED').count(),
        'dismissed': Report.query.filter_by(status='DISMISSED').count(),
    }
    return render_template('founder/disputes.html',
        reports=reports, status_filter=status_filter, counts=counts)


@founder_bp.route('/disputes/<int:report_id>/assign', methods=['POST'])
@founder_required
def assign_dispute(report_id):
    """Assign a report to a team member for review."""
    from ..models import Report
    report = Report.query.get_or_404(report_id)
    report.status = 'IN_REVIEW'
    report.assigned_to = current_user.wiam_id
    db.session.commit()
    flash(f'Report #{report.id} assigned to you.', 'info')
    return redirect(url_for('founder_dash.disputes'))


@founder_bp.route('/disputes/<int:report_id>/resolve', methods=['POST'])
@founder_required
def resolve_dispute(report_id):
    """Resolve a report with notes."""
    from ..models import Report
    from datetime import datetime
    report = Report.query.get_or_404(report_id)
    notes = request.form.get('notes', '').strip()
    report.status = 'RESOLVED'
    report.resolution_notes = notes
    report.resolved_at = datetime.utcnow()
    db.session.commit()
    # Notify via email + in-app
    try:
        from ..services.platform_notify import notify_moderation_flag
        notify_moderation_flag(report.target_type, report.target_id,
                               f'Resolved: {notes[:100]}', reporter_name='Founder')
    except Exception:
        pass
    flash(f'Report #{report.id} resolved.', 'success')
    return redirect(url_for('founder_dash.disputes'))


@founder_bp.route('/disputes/<int:report_id>/dismiss', methods=['POST'])
@founder_required
def dismiss_dispute(report_id):
    """Dismiss a report."""
    from ..models import Report
    from datetime import datetime
    report = Report.query.get_or_404(report_id)
    report.status = 'DISMISSED'
    report.resolved_at = datetime.utcnow()
    report.resolution_notes = request.form.get('notes', 'Dismissed by Founder')
    db.session.commit()
    flash(f'Report #{report.id} dismissed.', 'info')
    return redirect(url_for('founder_dash.disputes'))


@founder_bp.route('/moderation/banned-words')
@founder_required
def banned_words():
    """Manage banned words list."""
    from ..models import BannedWord
    words = BannedWord.query.order_by(BannedWord.severity.desc(), BannedWord.word).all()
    return render_template('founder/banned_words.html', words=words)


@founder_bp.route('/moderation/banned-words/add', methods=['POST'])
@founder_required
def add_banned_word():
    """Add a banned word."""
    from ..models import BannedWord
    word = request.form.get('word', '').strip().lower()
    category = request.form.get('category', 'general')
    severity = request.form.get('severity', 1, type=int)

    if not word:
        flash('Word cannot be empty.', 'error')
        return redirect(url_for('founder_dash.banned_words'))

    existing = BannedWord.query.filter_by(word=word).first()
    if existing:
        flash(f'"{word}" already exists.', 'warning')
        return redirect(url_for('founder_dash.banned_words'))

    db.session.add(BannedWord(word=word, category=category, severity=max(1, min(3, severity))))
    db.session.commit()
    flash(f'Added "{word}" (severity {severity}).', 'success')
    return redirect(url_for('founder_dash.banned_words'))


@founder_bp.route('/moderation/banned-words/<int:word_id>/delete', methods=['POST'])
@founder_required
def delete_banned_word(word_id):
    """Delete a banned word."""
    from ..models import BannedWord
    bw = BannedWord.query.get_or_404(word_id)
    db.session.delete(bw)
    db.session.commit()
    flash(f'Removed "{bw.word}".', 'success')
    return redirect(url_for('founder_dash.banned_words'))


@founder_bp.route('/moderation/seed-words', methods=['POST'])
@founder_required
def seed_words():
    """Seed default banned words."""
    from ..services.moderation import seed_banned_words
    count = seed_banned_words()
    flash(f'Seeded {count} banned words.', 'success')
    return redirect(url_for('founder_dash.banned_words'))


# ── WiamElite Management ──────────────────────────────────────────────

@founder_bp.route('/elite')
@founder_required
def elite_manage():
    """View and manage WiamElite stories."""
    from ..services.elite import compute_story_metrics, THRESHOLDS

    active = EliteStory.query.filter_by(is_active=True).order_by(
        EliteStory.promoted_at.desc()
    ).all()
    demoted = EliteStory.query.filter_by(is_active=False).order_by(
        EliteStory.demoted_at.desc()
    ).limit(20).all()

    elite_data = []
    for e in active:
        story = Content.query.get(e.content_id)
        if story:
            elite_data.append({'elite': e, 'story': story})

    demoted_data = []
    for e in demoted:
        story = Content.query.get(e.content_id)
        if story:
            demoted_data.append({'elite': e, 'story': story})

    return render_template('founder/elite.html',
        elite_data=elite_data,
        demoted_data=demoted_data,
        thresholds=THRESHOLDS,
        total_active=len(elite_data),
        total_demoted=len(demoted_data),
    )


@founder_bp.route('/elite/run-algorithm', methods=['POST'])
@founder_required
def elite_run_algorithm():
    """Manually trigger the WiamElite algorithm."""
    from ..services.elite import run_elite_algorithm
    results = run_elite_algorithm()
    flash(f'WiamElite algorithm complete: {results["promoted"]} promoted, {results["demoted"]} demoted.', 'success')
    return redirect(url_for('founder_dash.elite_manage'))


@founder_bp.route('/elite/demote/<int:content_id>', methods=['POST'])
@founder_required
def elite_demote(content_id):
    """Manually demote a story from WiamElite."""
    from ..services.elite import demote_story
    reason = request.form.get('reason', 'Manual removal by founder')
    demote_story(content_id, reason=reason)
    flash('Story removed from WiamElite.', 'success')
    return redirect(url_for('founder_dash.elite_manage'))


@founder_bp.route('/elite/promote/<int:content_id>', methods=['POST'])
@founder_required
def elite_promote(content_id):
    """Manually promote a story to WiamElite (founder override)."""
    from ..services.elite import compute_story_metrics, promote_story
    story = Content.query.get_or_404(content_id)
    metrics = compute_story_metrics(content_id)
    if not metrics:
        flash('Could not compute metrics for this story.', 'error')
        return redirect(url_for('founder_dash.elite_manage'))
    promote_story(content_id, metrics)
    # Notify the creator
    try:
        from ..services.notifications import notify_elite_promotion
        notify_elite_promotion(story.creator_wiam_id, story.title, content_id)
    except Exception:
        pass
    flash(f'"{story.title}" promoted to WiamElite.', 'success')
    return redirect(url_for('founder_dash.elite_manage'))


# ---------------------------------------------------------------------------
# Application Forms System
# ---------------------------------------------------------------------------

_DEFAULT_FORMS = [
    {
        'form_type': 'creator',
        'title': 'WiamApp Creator Application',
        'description': 'Apply to become an official WiamApp Creator and share your stories with readers across the world.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"pen_name","label":"Preferred Pen Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"age","label":"Age","type":"number","required":true},{"name":"genres","label":"What genres do you write?","type":"textarea","required":true},{"name":"experience","label":"Tell us about your writing experience","type":"textarea","required":true},{"name":"sample_link","label":"Link to a writing sample (Google Docs, Wattpad, etc.)","type":"url","required":true},{"name":"why_wiamapp","label":"Why do you want to create on WiamApp?","type":"textarea","required":true},{"name":"publish_frequency","label":"How often can you publish new chapters?","type":"select","options":["Daily","2-3 times per week","Weekly","Bi-weekly","Monthly"],"required":true},{"name":"original_work","label":"I confirm all my work will be 100% original and not plagiarized","type":"checkbox","required":true}]',
    },
    {
        'form_type': 'engineer',
        'title': 'WiamApp Software Engineer Application',
        'description': 'Join the WiamApp engineering team and help build the future of storytelling in Africa and beyond.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"role_interest","label":"What role interests you?","type":"select","options":["Full-Stack Developer","Frontend Developer","Backend Developer","Mobile Developer","DevOps Engineer","QA Engineer"],"required":true},{"name":"experience_years","label":"Years of Professional Experience","type":"select","options":["0-1 years","1-3 years","3-5 years","5+ years"],"required":true},{"name":"tech_stack","label":"Your tech stack (languages, frameworks, tools)","type":"textarea","required":true},{"name":"portfolio","label":"Portfolio / GitHub Link","type":"url","required":true},{"name":"linkedin","label":"LinkedIn Profile (optional)","type":"url","required":false},{"name":"why_join","label":"Why do you want to join WiamApp?","type":"textarea","required":true},{"name":"availability","label":"Availability","type":"select","options":["Full-time","Part-time","Contract / Freelance"],"required":true},{"name":"salary_expectation","label":"Monthly salary expectation (USD or GHS)","type":"text","required":false},{"name":"challenge","label":"Describe a technical challenge you solved recently","type":"textarea","required":true}]',
    },
    {
        'form_type': 'admin',
        'title': 'WiamApp Platform Administrator Application',
        'description': 'Help manage the WiamApp platform — content moderation, user support, and community management.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"age","label":"Age","type":"number","required":true},{"name":"experience","label":"Do you have experience managing online communities or platforms?","type":"textarea","required":true},{"name":"languages","label":"Languages you speak fluently","type":"textarea","required":true},{"name":"hours_available","label":"How many hours per day can you dedicate?","type":"select","options":["2-4 hours","4-6 hours","6-8 hours","8+ hours"],"required":true},{"name":"timezone","label":"Your timezone (e.g. GMT+0, WAT, EAT)","type":"text","required":true},{"name":"conflict_resolution","label":"How would you handle a dispute between a creator and a reader?","type":"textarea","required":true},{"name":"why_admin","label":"Why do you want to be a WiamApp Administrator?","type":"textarea","required":true},{"name":"background_check","label":"I agree to a background check if required","type":"checkbox","required":true}]',
    },
    {
        'form_type': 'editor',
        'title': 'WiamApp Content Editor Application',
        'description': 'Join as a Content Editor — review stories, help creators improve their work, and curate the best reading experience.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"education","label":"Education Background","type":"textarea","required":true},{"name":"editing_experience","label":"Describe your editing or proofreading experience","type":"textarea","required":true},{"name":"genres_preferred","label":"Which genres are you most comfortable editing?","type":"textarea","required":true},{"name":"sample_edit","label":"Link to a sample of your editing work (before/after)","type":"url","required":false},{"name":"tools","label":"Editing tools you are familiar with","type":"textarea","required":true},{"name":"turnaround","label":"How quickly can you review a 3,000-word chapter?","type":"select","options":["Within 2 hours","Same day","Within 24 hours","Within 48 hours"],"required":true},{"name":"why_editor","label":"Why do you want to edit for WiamApp?","type":"textarea","required":true},{"name":"languages","label":"Languages you can edit in","type":"textarea","required":true}]',
    },
    {
        'form_type': 'moderator',
        'title': 'WiamApp Community Moderator Application',
        'description': 'Become a Community Moderator — keep WiamApp safe, welcoming, and fun for all readers and creators.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"age","label":"Age","type":"number","required":true},{"name":"mod_experience","label":"Have you moderated any online community before? Describe.","type":"textarea","required":true},{"name":"hours_available","label":"Hours per day you can moderate","type":"select","options":["1-2 hours","2-4 hours","4-6 hours","6+ hours"],"required":true},{"name":"handle_harassment","label":"How would you handle a user posting hate speech or harassment?","type":"textarea","required":true},{"name":"why_mod","label":"Why do you want to moderate for WiamApp?","type":"textarea","required":true},{"name":"code_of_conduct","label":"I agree to uphold the WiamApp Code of Conduct at all times","type":"checkbox","required":true}]',
    },
    {
        'form_type': 'marketing',
        'title': 'WiamApp Marketing & Growth Application',
        'description': 'Help WiamApp reach millions of readers and creators across Africa and the world.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"specialization","label":"Area of Specialization","type":"select","options":["Social Media Marketing","Content Marketing","SEO/ASO","Influencer Marketing","Paid Ads","PR & Communications","Growth Hacking"],"required":true},{"name":"experience","label":"Describe your marketing experience","type":"textarea","required":true},{"name":"portfolio","label":"Link to portfolio or campaigns you have worked on","type":"url","required":false},{"name":"social_handles","label":"Your social media handles","type":"textarea","required":true},{"name":"growth_idea","label":"Share one idea to grow WiamApp to 100K users","type":"textarea","required":true},{"name":"availability","label":"Availability","type":"select","options":["Full-time","Part-time","Freelance"],"required":true}]',
    },
    {
        'form_type': 'translator',
        'title': 'WiamApp Translator Application',
        'description': 'Help translate stories and the WiamApp platform into more languages to reach readers everywhere.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"native_language","label":"Your native language","type":"text","required":true},{"name":"translate_from","label":"Languages you translate FROM","type":"textarea","required":true},{"name":"translate_to","label":"Languages you translate TO","type":"textarea","required":true},{"name":"experience","label":"Translation experience (professional or volunteer)","type":"textarea","required":true},{"name":"sample","label":"Link to a translation sample","type":"url","required":false},{"name":"turnaround","label":"How fast can you translate a 2,000-word chapter?","type":"select","options":["Same day","Within 24 hours","Within 48 hours","Within a week"],"required":true},{"name":"why_translate","label":"Why do you want to translate for WiamApp?","type":"textarea","required":true}]',
    },
    {
        'form_type': 'support',
        'title': 'WiamApp User Support Application',
        'description': 'Help users with account issues, feedback, and questions. Be the friendly face of WiamApp.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"experience","label":"Do you have customer support experience? Describe.","type":"textarea","required":true},{"name":"languages","label":"Languages you speak fluently","type":"textarea","required":true},{"name":"hours_available","label":"Hours per day you can dedicate","type":"select","options":["2-4 hours","4-6 hours","6-8 hours","8+ hours"],"required":true},{"name":"scenario","label":"A user says their coins disappeared after purchase. How do you handle it?","type":"textarea","required":true},{"name":"why_support","label":"Why do you want to join WiamApp support?","type":"textarea","required":true}]',
    },
    {
        'form_type': 'finance',
        'title': 'WiamApp Finance Manager Application',
        'description': 'Manage revenue, creator payouts, coin economy, and platform financial health.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"education","label":"Education Background (Finance/Accounting)","type":"textarea","required":true},{"name":"experience","label":"Finance or accounting experience","type":"textarea","required":true},{"name":"tools","label":"Financial tools/software you are proficient with","type":"textarea","required":true},{"name":"mobile_money","label":"Experience with Mobile Money or payment platforms","type":"textarea","required":true},{"name":"why_finance","label":"Why do you want to manage finances at WiamApp?","type":"textarea","required":true}]',
    },
    {
        'form_type': 'analyst',
        'title': 'WiamApp Data Analyst Application',
        'description': 'Analyze platform data, user behavior, and content performance to drive growth.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"education","label":"Education Background","type":"textarea","required":true},{"name":"tools","label":"Analytics tools you are proficient with (SQL, Python, Excel, etc.)","type":"textarea","required":true},{"name":"experience","label":"Data analysis experience","type":"textarea","required":true},{"name":"portfolio","label":"Link to portfolio or sample analysis","type":"url","required":false},{"name":"insight","label":"What metric would you track first to grow a reading platform?","type":"textarea","required":true},{"name":"why_analyst","label":"Why do you want to be a WiamApp analyst?","type":"textarea","required":true}]',
    },
    {
        'form_type': 'overall_boss',
        'title': 'WiamApp Overall Boss Application',
        'description': 'Second-in-command to the Founder. Oversee all teams, approve major decisions, and lead platform operations.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"experience","label":"Describe your leadership and management experience","type":"textarea","required":true},{"name":"teams_managed","label":"How many people have you managed before?","type":"select","options":["1-5","5-10","10-20","20+"],"required":true},{"name":"strategy","label":"How would you grow WiamApp to 1 million users?","type":"textarea","required":true},{"name":"availability","label":"Availability","type":"select","options":["Full-time","Part-time"],"required":true},{"name":"why_boss","label":"Why should you be the Overall Boss of WiamApp?","type":"textarea","required":true},{"name":"linkedin","label":"LinkedIn Profile (optional)","type":"url","required":false}]',
    },
    {
        'form_type': 'team_lead',
        'title': 'WiamApp Team Lead Application',
        'description': 'Lead a department, coordinate team members, review work, and report to leadership.',
        'fields_json': '[{"name":"full_name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email Address","type":"email","required":true},{"name":"phone","label":"Phone Number","type":"text","required":true},{"name":"country","label":"Country of Residence","type":"text","required":true},{"name":"department","label":"Which department do you want to lead?","type":"select","options":["Content/Editorial","Moderation","Engineering","Marketing","Support","Finance","Translation"],"required":true},{"name":"experience","label":"Describe your team leadership experience","type":"textarea","required":true},{"name":"team_size","label":"Largest team you have led","type":"select","options":["1-3","3-5","5-10","10+"],"required":true},{"name":"conflict","label":"How would you handle underperformance in your team?","type":"textarea","required":true},{"name":"why_lead","label":"Why do you want to be a Team Lead at WiamApp?","type":"textarea","required":true}]',
    },
]


@founder_bp.route('/forms')
@founder_required
def forms_dashboard():
    """Application forms management dashboard."""
    from ..models import ApplicationForm, ApplicationResponse
    import json

    forms = ApplicationForm.query.order_by(ApplicationForm.form_type).all()

    # Get response counts per form
    form_stats = {}
    for f in forms:
        total = ApplicationResponse.query.filter_by(form_id=f.id).count()
        pending = ApplicationResponse.query.filter_by(form_id=f.id, status='pending').filter(
            ApplicationResponse.submitted_at.isnot(None)
        ).count()
        sent = ApplicationResponse.query.filter_by(form_id=f.id).filter(
            ApplicationResponse.submitted_at.is_(None)
        ).count()
        form_stats[f.id] = {'total': total, 'pending': pending, 'sent': sent}

    return render_template('founder/forms_dashboard.html',
        forms=forms,
        form_stats=form_stats,
    )


@founder_bp.route('/forms/seed', methods=['POST'])
@founder_required
def seed_forms():
    """Seed default application forms."""
    from ..models import ApplicationForm
    created = 0
    for fd in _DEFAULT_FORMS:
        existing = ApplicationForm.query.filter_by(form_type=fd['form_type']).first()
        if not existing:
            f = ApplicationForm(**fd)
            db.session.add(f)
            created += 1
    db.session.commit()
    flash(f'Created {created} default application forms.', 'success')
    return redirect(url_for('founder_dash.forms_dashboard'))


@founder_bp.route('/forms/<int:form_id>/responses')
@founder_required
def form_responses(form_id):
    """View all responses for a specific form."""
    from ..models import ApplicationForm, ApplicationResponse
    import json

    form = ApplicationForm.query.get_or_404(form_id)
    status_filter = request.args.get('status', 'all')

    q = ApplicationResponse.query.filter_by(form_id=form_id)
    if status_filter == 'pending':
        q = q.filter_by(status='pending').filter(ApplicationResponse.submitted_at.isnot(None))
    elif status_filter == 'sent':
        q = q.filter(ApplicationResponse.submitted_at.is_(None))
    elif status_filter != 'all':
        q = q.filter_by(status=status_filter)

    responses = q.order_by(ApplicationResponse.sent_at.desc()).all()
    fields = json.loads(form.fields_json or '[]')

    return render_template('founder/form_responses.html',
        form=form,
        responses=responses,
        fields=fields,
        status_filter=status_filter,
        json=json,
    )


@founder_bp.route('/forms/<int:form_id>/send', methods=['POST'])
@founder_required
def send_form_invite(form_id):
    """Send a form invitation to an email address."""
    from ..models import ApplicationForm, ApplicationResponse
    from ..services.email_service import send_application_invite, _app_url
    import secrets as _secrets

    form = ApplicationForm.query.get_or_404(form_id)
    email = request.form.get('email', '').strip().lower()
    name = request.form.get('name', '').strip()

    if not email or '@' not in email:
        flash('Please enter a valid email address.', 'error')
        return redirect(url_for('founder_dash.form_responses', form_id=form_id))

    existing = ApplicationResponse.query.filter_by(form_id=form_id, applicant_email=email).first()
    if existing:
        flash(f'Form already sent to {email}.', 'warning')
        return redirect(url_for('founder_dash.form_responses', form_id=form_id))

    token = _secrets.token_urlsafe(32)
    resp = ApplicationResponse(
        form_id=form_id,
        form_type=form.form_type,
        applicant_email=email,
        applicant_name=name,
        token=token,
    )
    db.session.add(resp)
    db.session.commit()

    app_url = _app_url()
    form_url = f"{app_url}/apply/{token}"
    sent = send_application_invite(email, name or 'Applicant', form.title, form_url)
    if sent:
        flash(f'Application form sent to {email}.', 'success')
    else:
        flash(f'Failed to send email to {email}. Check SMTP settings.', 'error')

    return redirect(url_for('founder_dash.form_responses', form_id=form_id))


@founder_bp.route('/forms/response/<int:resp_id>/review', methods=['POST'])
@founder_required
def review_response(resp_id):
    """Accept or reject an application response."""
    from ..models import ApplicationResponse, ApplicationForm
    from ..services.email_service import send_application_accepted, send_application_rejected
    from datetime import datetime

    resp = ApplicationResponse.query.get_or_404(resp_id)
    form = ApplicationForm.query.get(resp.form_id)
    action = request.form.get('action', '')
    notes = request.form.get('notes', '').strip()

    if action in ('accepted', 'rejected'):
        resp.status = action
        resp.reviewer_notes = notes
        resp.reviewed_at = datetime.utcnow()
        db.session.commit()

        applicant = resp.applicant_name or 'Applicant'
        role_title = (form.form_type or 'team member').title()

        if action == 'accepted':
            send_application_accepted(resp.applicant_email, applicant, role_title, notes)
        else:
            send_application_rejected(resp.applicant_email, applicant, role_title, notes)

        flash(f'Application {action}. Email sent to {resp.applicant_email}.', 'success')
    else:
        flash('Invalid action.', 'error')

    return redirect(url_for('founder_dash.form_responses', form_id=resp.form_id))


@founder_bp.route('/forms/response/<int:resp_id>/create-account', methods=['POST'])
@founder_required
def create_team_account(resp_id):
    """Create a team account with a secure WIAMid for an accepted applicant."""
    from datetime import datetime, timedelta
    from ..models import ApplicationResponse, ApplicationForm, User, TeamIdHistory
    from ..services.email_service import send_team_credentials
    from ..auth import generate_wiam_id, WIAM_ID_EXPIRY_DAYS
    import random

    resp = ApplicationResponse.query.get_or_404(resp_id)
    if resp.status != 'accepted':
        flash('Can only create accounts for accepted applicants.', 'error')
        return redirect(url_for('founder_dash.form_responses', form_id=resp.form_id))

    form = ApplicationForm.query.get(resp.form_id)
    from ..models import Role, UserRole

    # Determine the RBAC role to assign
    rbac_role_name = form.form_type  # e.g. 'editor', 'moderator', 'marketing'
    rbac_role = Role.query.filter_by(name=rbac_role_name).first()

    # Check if this applicant already has a team account
    existing = User.query.filter_by(team_personal_email=resp.applicant_email, is_team_account=True).first()
    if existing:
        if rbac_role:
            already_has = UserRole.query.filter_by(user_id=existing.id, role_id=rbac_role.id).first()
            if not already_has:
                db.session.add(UserRole(user_id=existing.id, role_id=rbac_role.id, assigned_by=current_user.wiam_id))
                db.session.commit()
                flash(f'Assigned {rbac_role.display_name} role to {existing.display_name}.', 'success')
            else:
                flash(f'{existing.display_name} already has the {rbac_role.display_name} role.', 'warning')
        else:
            flash(f'Role "{rbac_role_name}" not found in RBAC system.', 'error')
        return redirect(url_for('founder_dash.form_responses', form_id=resp.form_id))

    # Generate a secure WIAMid
    wiam_id = generate_wiam_id()
    now = datetime.utcnow()

    synthetic_tid = -random.randint(800000000, 899999999)
    while User.query.filter_by(wiam_id=synthetic_tid).first():
        synthetic_tid = -random.randint(800000000, 899999999)

    name_parts = (resp.applicant_name or 'Team Member').split(None, 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    # Team accounts use an internal email — login is via wiamlabs@gmail.com + WIAMid only
    internal_email = f'team_{synthetic_tid}@wiamapp.internal'

    user = User(
        wiam_id=synthetic_tid,
        email=internal_email,
        username=f'team_{first_name.lower()}_{rbac_role_name}',
        first_name=first_name,
        last_name=last_name,
        role='user',
        email_verified=True,
        auth_provider='team_wiam_id',
        onboarding_completed=True,
        status='active',
        is_team_account=True,
        team_role_slug=rbac_role_name,
        team_created_by=current_user.id,
        team_created_at=now,
        team_personal_email=resp.applicant_email,
        team_id_issued_at=now,
        team_id_expires_at=now + timedelta(days=WIAM_ID_EXPIRY_DAYS),
    )
    user.set_password(wiam_id)
    user.team_wiam_id_hash = user.password_hash  # store the same bcrypt hash
    db.session.add(user)
    db.session.flush()

    # Record in audit history
    db.session.add(TeamIdHistory(
        user_id=user.id,
        wiam_id_hash=user.team_wiam_id_hash,
        issued_at=now,
        is_active=True,
    ))

    # Assign the correct RBAC role
    if rbac_role:
        db.session.add(UserRole(user_id=user.id, role_id=rbac_role.id, assigned_by=current_user.wiam_id))
    db.session.commit()

    role_title = rbac_role.display_name if rbac_role else form.form_type.title()
    send_team_credentials(resp.applicant_email, resp.applicant_name or 'Team Member', role_title, wiam_id)
    flash(f'Team account created! WIAMid sent to {resp.applicant_email} ({role_title}).', 'success')

    return redirect(url_for('founder_dash.form_responses', form_id=resp.form_id))


@founder_bp.route('/team/rotate-id/<int:user_id>', methods=['POST'])
@founder_required
def rotate_team_id(user_id):
    """Manually rotate a team member's WIAMid."""
    from datetime import datetime, timedelta
    from ..models import User, TeamIdHistory
    from ..auth import generate_wiam_id, WIAM_ID_EXPIRY_DAYS
    from ..services.email_service import send_team_id_rotation

    user = User.query.get_or_404(user_id)
    if not user.is_team_account:
        flash('This user is not a team member.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    now = datetime.utcnow()

    # Expire old history entries
    TeamIdHistory.query.filter_by(user_id=user.id, is_active=True).update({
        'is_active': False, 'expired_at': now
    })

    # Generate new WIAMid
    new_id = generate_wiam_id()
    user.set_password(new_id)
    user.team_wiam_id_hash = user.password_hash
    user.team_id_issued_at = now
    user.team_id_expires_at = now + timedelta(days=WIAM_ID_EXPIRY_DAYS)

    db.session.add(TeamIdHistory(
        user_id=user.id,
        wiam_id_hash=user.team_wiam_id_hash,
        issued_at=now,
        is_active=True,
    ))
    db.session.commit()

    # Send new ID to team member's personal email
    if user.team_personal_email:
        send_team_id_rotation(user.team_personal_email, user.display_name, new_id)

    flash(f'WIAMid rotated for {user.display_name}. New credentials sent to {user.team_personal_email}.', 'success')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/forms/response/<int:resp_id>/delete', methods=['POST'])
@founder_required
def delete_form_response(resp_id):
    """Permanently delete an application response from the database."""
    from ..models import ApplicationResponse
    resp = ApplicationResponse.query.get_or_404(resp_id)
    form_id = resp.form_id
    db.session.delete(resp)
    db.session.commit()
    flash('Application response permanently deleted.', 'success')
    return redirect(url_for('founder_dash.form_responses', form_id=form_id))


# ---------------------------------------------------------------------------
# Monetization Controls (moved from admin — founder only)
# ---------------------------------------------------------------------------

@founder_bp.route('/run-eligibility-check', methods=['POST'])
@founder_required
def run_eligibility_check():
    """Manually trigger monetization eligibility check for all creators."""
    from ..services.monetization import run_eligibility_check_all
    results = run_eligibility_check_all()
    flash(
        f'Eligibility check done: {results["checked"]} checked, '
        f'{results["eligible"]} eligible, {results["ineligible"]} ineligible.',
        'success'
    )
    return redirect(url_for('founder_dash.overview'))


@founder_bp.route('/payouts')
@founder_required
def payouts():
    """View and manage all creator payouts."""
    from ..models import CreatorPayout, CreatorPayoutSettings, User
    status_filter = request.args.get('status', '')

    q = CreatorPayout.query.order_by(CreatorPayout.created_at.desc())
    if status_filter:
        q = q.filter_by(status=status_filter)

    all_payouts = q.limit(200).all()

    # Enrich with creator names
    creator_ids = {p.creator_id for p in all_payouts}
    creators = {u.wiam_id: u for u in User.query.filter(
        User.wiam_id.in_(creator_ids)
    ).all()} if creator_ids else {}

    # Stats
    from sqlalchemy import func
    stats = {
        'total': CreatorPayout.query.count(),
        'sent': CreatorPayout.query.filter_by(status='sent').count(),
        'processing': CreatorPayout.query.filter_by(status='processing').count(),
        'failed': CreatorPayout.query.filter_by(status='failed').count(),
        'pending': CreatorPayout.query.filter_by(status='pending').count(),
        'total_sent_ghs': db.session.query(func.coalesce(func.sum(CreatorPayout.amount_ghs), 0)).filter_by(status='sent').scalar(),
    }

    return render_template('founder/payouts.html',
        payouts=all_payouts,
        creators=creators,
        stats=stats,
        status_filter=status_filter,
    )


@founder_bp.route('/run-payouts', methods=['POST'])
@founder_required
def run_payouts():
    """Manually trigger monthly payout processing."""
    from ..services.monetization import process_monthly_payouts
    results = process_monthly_payouts()
    flash(
        f'Payouts processed: {results["paid"]} paid, '
        f'{results["below_minimum"]} below minimum, '
        f'{results["failed"]} failed, {results["no_settings"]} no settings.',
        'success'
    )
    return redirect(url_for('founder_dash.payouts'))


@founder_bp.route('/retry-payout/<int:payout_id>', methods=['POST'])
@founder_required
def retry_payout(payout_id):
    """Retry a single failed payout."""
    from ..services.monetization import retry_failed_payout
    success, msg = retry_failed_payout(payout_id)
    if success:
        flash(f'Payout retry initiated: {msg}', 'success')
    else:
        flash(f'Retry failed: {msg}', 'error')
    return redirect(url_for('founder_dash.payouts'))


# ---------------------------------------------------------------------------
# Team Management (founder only)
# ---------------------------------------------------------------------------

@founder_bp.route('/team')
@founder_required
def team_management():
    """View and manage all team members (RBAC-powered)."""
    from ..models import User, Role, UserRole
    role_filter = request.args.get('role', '')

    # Get all RBAC roles
    all_roles = Role.query.order_by(Role.name).all()
    role_names = [r.name for r in all_roles]

    # Build team members list — users with RBAC roles + founders
    if role_filter and role_filter in role_names:
        role_obj = Role.query.filter_by(name=role_filter).first()
        if role_obj:
            ur_rows = UserRole.query.filter_by(role_id=role_obj.id).all()
            user_ids = [ur.user_id for ur in ur_rows]
            members = User.query.filter(User.id.in_(user_ids)).order_by(User.date_joined.desc()).all() if user_ids else []
        else:
            members = []
    elif role_filter == 'founder':
        members = User.query.filter_by(role='founder').order_by(User.date_joined.desc()).all()
    else:
        # All team: founders + anyone with RBAC role
        ur_user_ids = [ur.user_id for ur in UserRole.query.all()]
        founder_ids = [u.id for u in User.query.filter_by(role='founder').all()]
        all_ids = list(set(ur_user_ids + founder_ids))
        members = User.query.filter(User.id.in_(all_ids)).order_by(User.date_joined.desc()).all() if all_ids else []

    # Count per role
    role_counts = {}
    for r in all_roles:
        role_counts[r.name] = UserRole.query.filter_by(role_id=r.id).count()
    role_counts['founder'] = User.query.filter_by(role='founder').count()

    # Enrich members with their RBAC roles
    enriched = []
    for m in members:
        m_roles = m.get_roles()
        enriched.append({'user': m, 'roles': m_roles})

    return render_template('founder/team_management.html',
        members=enriched,
        role_counts=role_counts,
        role_filter=role_filter,
        all_roles=all_roles,
        now=datetime.utcnow(),
    )


@founder_bp.route('/team/<int:user_id>/assign-role', methods=['POST'])
@founder_required
def team_assign_role(user_id):
    """Assign an RBAC role to a user."""
    from ..models import User, Role, UserRole
    role_name = request.form.get('role', '').strip()
    role_obj = Role.query.filter_by(name=role_name).first()
    if not role_obj:
        flash('Invalid role.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    user = User.query.get(user_id)
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('founder_dash.team_management'))
    if user.is_founder:
        flash("Cannot modify the founder's roles.", 'error')
        return redirect(url_for('founder_dash.team_management'))

    existing = UserRole.query.filter_by(user_id=user.id, role_id=role_obj.id).first()
    if existing:
        flash(f'{user.display_name} already has the {role_obj.display_name} role.', 'warning')
        return redirect(url_for('founder_dash.team_management'))

    db.session.add(UserRole(user_id=user.id, role_id=role_obj.id, assigned_by=current_user.wiam_id))
    # Reset legacy role column: if user had 'admin' legacy role but is being given
    # a non-admin RBAC role, reset legacy to 'user' so they don't get admin access
    if user.role == 'admin' and role_name != 'admin':
        # Check if they still have an RBAC admin role
        admin_role = Role.query.filter_by(name='admin').first()
        has_admin_rbac = False
        if admin_role:
            has_admin_rbac = UserRole.query.filter_by(user_id=user.id, role_id=admin_role.id).first() is not None
        if not has_admin_rbac:
            user.role = 'user'
    # If assigning admin RBAC role, also set legacy column
    if role_name == 'admin':
        user.role = 'admin'
    db.session.commit()

    # Send role assignment notification email
    try:
        from ..services.email_service import send_role_assigned
        if user.email:
            send_role_assigned(user.email, user.display_name, role_obj.display_name)
    except Exception as e:
        log.warning("Could not send role assignment email to %s: %s", user.email, e)

    flash(f'Assigned {role_obj.display_name} role to {user.display_name}.', 'success')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/<int:user_id>/remove-role', methods=['POST'])
@founder_required
def team_remove_role(user_id):
    """Remove an RBAC role from a user."""
    from ..models import User, Role, UserRole
    role_name = request.form.get('role', '').strip()
    role_obj = Role.query.filter_by(name=role_name).first()
    if not role_obj:
        flash('Invalid role.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    user = User.query.get(user_id)
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('founder_dash.team_management'))
    if user.is_founder:
        flash("Cannot modify the founder's roles.", 'error')
        return redirect(url_for('founder_dash.team_management'))

    ur = UserRole.query.filter_by(user_id=user.id, role_id=role_obj.id).first()
    if ur:
        db.session.delete(ur)
        db.session.commit()
        flash(f'Removed {role_obj.display_name} role from {user.display_name}.', 'success')
    else:
        flash(f'{user.display_name} does not have the {role_obj.display_name} role.', 'warning')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/add-member', methods=['POST'])
@founder_required
def team_add_member():
    """Add a user to the team by email — assign them an RBAC role."""
    from ..models import User, Role, UserRole
    email = request.form.get('email', '').strip().lower()
    role_name = request.form.get('role', '').strip()

    if not email:
        flash('Please enter an email address.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash(f'No account found with email: {email}', 'error')
        return redirect(url_for('founder_dash.team_management'))

    role_obj = Role.query.filter_by(name=role_name).first()
    if not role_obj:
        flash('Invalid role selected.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    existing = UserRole.query.filter_by(user_id=user.id, role_id=role_obj.id).first()
    if existing:
        flash(f'{user.display_name} already has the {role_obj.display_name} role.', 'warning')
        return redirect(url_for('founder_dash.team_management'))

    db.session.add(UserRole(user_id=user.id, role_id=role_obj.id, assigned_by=current_user.wiam_id))
    db.session.commit()
    flash(f'Added {user.display_name} as {role_obj.display_name}.', 'success')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/create-account', methods=['POST'])
@founder_required
def team_create_account():
    """Create a dedicated team work account with a secure WIAMid.

    Flow: Founder enters the person's name, personal email, picks a role.
    System generates a WIAMid and emails it to the personal email.
    Login: wiamlabs@gmail.com + WIAMid → team dashboard.
    """
    from datetime import datetime, timedelta
    import random
    from ..models import User, Role, UserRole, TeamIdHistory
    from ..auth import generate_wiam_id, WIAM_ID_EXPIRY_DAYS
    from ..services.email_service import send_team_credentials

    first_name = request.form.get('first_name', '').strip()
    personal_email = request.form.get('personal_email', '').strip().lower()
    role_name  = request.form.get('role', '').strip()

    if not first_name or not role_name or not personal_email:
        flash('Name, personal email, and role are required.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    if personal_email == 'wiamlabs@gmail.com':
        flash('Cannot use the platform login email as personal email.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    role_obj = Role.query.filter_by(name=role_name).first()
    if not role_obj:
        flash('Invalid role selected.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    # Check if this person already has a team account
    existing = User.query.filter_by(team_personal_email=personal_email, is_team_account=True).first()
    if existing:
        flash(f'A team account for {personal_email} already exists.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    now = datetime.utcnow()
    wiam_id = generate_wiam_id()

    synthetic_id = -random.randint(800000000, 899999999)
    while User.query.filter_by(wiam_id=synthetic_id).first():
        synthetic_id = -random.randint(800000000, 899999999)

    internal_email = f'team_{synthetic_id}@wiamapp.internal'

    user = User(
        email=internal_email,
        first_name=first_name.title(),
        last_name=f'({role_obj.display_name})',
        username=f'team_{first_name.lower()}_{role_name}',
        role='user',
        wiam_id=synthetic_id,
        auth_provider='team_wiam_id',
        email_verified=True,
        onboarding_completed=True,
        is_team_account=True,
        team_role_slug=role_name,
        team_created_by=current_user.id,
        team_created_at=now,
        team_personal_email=personal_email,
        team_id_issued_at=now,
        team_id_expires_at=now + timedelta(days=WIAM_ID_EXPIRY_DAYS),
        status='active',
    )
    user.set_password(wiam_id)
    user.team_wiam_id_hash = user.password_hash
    db.session.add(user)
    db.session.flush()

    db.session.add(TeamIdHistory(
        user_id=user.id,
        wiam_id_hash=user.team_wiam_id_hash,
        issued_at=now,
        is_active=True,
    ))

    db.session.add(UserRole(user_id=user.id, role_id=role_obj.id, assigned_by=current_user.wiam_id))
    db.session.commit()

    log.info("Team account created: %s (%s) by %s — WIAMid sent to %s",
             first_name, role_name, current_user.display_name, personal_email)

    role_title = role_obj.display_name
    send_team_credentials(personal_email, first_name.title(), role_title, wiam_id)

    flash(f'Team account created for {first_name.title()} ({role_title}). WIAMid sent to {personal_email}.', 'success')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/<int:user_id>/reset-password', methods=['POST'])
@founder_required
def team_reset_password(user_id):
    """Founder/engineer resets a team member's password and shows the new one."""
    import secrets as _secrets
    import string
    from ..models import User

    user = User.query.get_or_404(user_id)
    if not user.is_team_account:
        flash('Can only reset passwords for team accounts.', 'error')
        return redirect(url_for('founder_dash.team_management'))
    if user.is_founder:
        flash('Cannot reset founder password here.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    # Generate new secure password
    alphabet = string.ascii_letters + string.digits + '!@#$%&*-_=+'
    password = ''.join(_secrets.choice(alphabet) for _ in range(16))
    pw_list = list(password)
    _secrets.SystemRandom().shuffle(pw_list)
    password = ''.join(pw_list)

    user.set_password(password)
    db.session.commit()

    log.info("Team password reset for %s by %s", user.email, current_user.display_name)

    flash(
        f'🔑 PASSWORD RESET — SAVE NOW!\n'
        f'📧 Email: {user.email}\n'
        f'🔑 New Password: {password}\n'
        f'⚠️ This password will NOT be shown again.',
        'team_credentials'
    )
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/<int:user_id>/deactivate', methods=['POST'])
@founder_required
def team_deactivate(user_id):
    """Deactivate a team member's account. Accepts user.id (primary key)."""
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.is_founder:
        flash('Cannot deactivate the founder.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    user.status = 'deactivated'
    db.session.commit()
    flash(f'{user.display_name} has been deactivated.', 'warning')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/<int:user_id>/reactivate', methods=['POST'])
@founder_required
def team_reactivate(user_id):
    """Reactivate a deactivated team member. Accepts user.id (primary key)."""
    from ..models import User
    user = User.query.get_or_404(user_id)

    user.status = 'active'
    db.session.commit()
    flash(f'{user.display_name} has been reactivated.', 'success')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/comp-plans')
@founder_required
def team_comp_plans():
    """View and manage team compensation plans."""
    from ..models import TeamCompPlan, Role
    plans = TeamCompPlan.query.order_by(TeamCompPlan.role_name).all()
    roles = Role.query.order_by(Role.name).all()
    return render_template('founder/team_comp_plans.html', plans=plans, roles=roles)


@founder_bp.route('/team/comp-plans/add', methods=['POST'])
@founder_required
def add_comp_plan():
    """Add a new compensation plan for a role."""
    from ..models import TeamCompPlan
    role_name = request.form.get('role_name', '').strip()
    plan_type = request.form.get('plan_type', 'MONTHLY').strip()
    base_amount = request.form.get('base_amount', 0, type=float)
    commission_pct = request.form.get('commission_pct', 0, type=float)
    notes = request.form.get('notes', '').strip()
    if not role_name:
        flash('Role is required.', 'error')
        return redirect(url_for('founder_dash.team_comp_plans'))
    plan = TeamCompPlan(
        role_name=role_name, plan_type=plan_type,
        base_amount=base_amount, commission_pct=commission_pct, notes=notes,
    )
    db.session.add(plan)
    db.session.commit()
    flash(f'Comp plan added for {role_name}.', 'success')
    return redirect(url_for('founder_dash.team_comp_plans'))


@founder_bp.route('/team/comp-plans/<int:plan_id>/update', methods=['POST'])
@founder_required
def update_comp_plan(plan_id):
    """Update an existing compensation plan."""
    from ..models import TeamCompPlan
    from datetime import datetime
    plan = TeamCompPlan.query.get_or_404(plan_id)
    plan.plan_type = request.form.get('plan_type', plan.plan_type).strip()
    plan.base_amount = request.form.get('base_amount', plan.base_amount, type=float)
    plan.commission_pct = request.form.get('commission_pct', plan.commission_pct, type=float)
    plan.notes = request.form.get('notes', plan.notes).strip()
    plan.updated_at = datetime.utcnow()
    db.session.commit()
    flash(f'Comp plan for {plan.role_name} updated.', 'success')
    return redirect(url_for('founder_dash.team_comp_plans'))


@founder_bp.route('/team/comp-plans/<int:plan_id>/toggle', methods=['POST'])
@founder_required
def toggle_comp_plan(plan_id):
    """Toggle a comp plan active/inactive."""
    from ..models import TeamCompPlan
    plan = TeamCompPlan.query.get_or_404(plan_id)
    plan.is_active = not plan.is_active
    db.session.commit()
    flash(f'Comp plan for {plan.role_name} {"activated" if plan.is_active else "deactivated"}.', 'success')
    return redirect(url_for('founder_dash.team_comp_plans'))


@founder_bp.route('/team/<int:user_id>/ban', methods=['POST'])
@founder_required
def team_ban(user_id):
    """Ban a team member. Accepts user.id (primary key)."""
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.is_founder:
        flash('Cannot ban the founder.', 'error')
        return redirect(url_for('founder_dash.team_management'))

    user.status = 'banned'
    db.session.commit()
    flash(f'{user.display_name} has been banned. They can no longer access WiamApp.', 'warning')
    return redirect(url_for('founder_dash.team_management'))


@founder_bp.route('/team/<int:user_id>/unban', methods=['POST'])
@founder_required
def team_unban(user_id):
    """Unban a banned team member. Accepts user.id (primary key)."""
    from ..models import User
    user = User.query.get_or_404(user_id)

    user.status = 'active'
    db.session.commit()
    flash(f'{user.display_name} has been unbanned and can access WiamApp again.', 'success')
    return redirect(url_for('founder_dash.team_management'))


# ---------------------------------------------------------------------------
# Account Management — Deactivated users panel + complete delete
# ---------------------------------------------------------------------------

@founder_bp.route('/accounts')
@founder_required
def account_management():
    """View deactivated users and manage account deletion."""
    from ..models import User
    deactivated = User.query.filter_by(status='deactivated').order_by(User.last_active.desc()).all()
    banned = User.query.filter_by(status='banned').order_by(User.last_active.desc()).all()
    return render_template('founder/accounts.html', deactivated=deactivated, banned=banned)


@founder_bp.route('/accounts/<int:user_id>/reactivate', methods=['POST'])
@founder_required
def account_reactivate(user_id):
    """Reactivate a deactivated user account (toggle OFF)."""
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.is_founder:
        flash('Cannot modify founder account.', 'error')
        return redirect(url_for('founder_dash.account_management'))
    user.status = 'active'
    db.session.commit()
    flash(f'{user.display_name} ({user.email or "no email"}) has been reactivated.', 'success')
    return redirect(url_for('founder_dash.account_management'))


@founder_bp.route('/accounts/<int:user_id>/delete', methods=['POST'])
@founder_required
def account_complete_delete(user_id):
    """Completely delete a user account and ALL their data from the database."""
    from ..models import User
    user = User.query.get_or_404(user_id)
    if user.is_founder:
        flash('Cannot delete founder account.', 'error')
        return redirect(url_for('founder_dash.account_management'))

    name = user.display_name
    email = user.email or 'no email'
    uid = user.wiam_id

    from .profile import _purge_user_data
    try:
        _purge_user_data(user.id, uid)
        flash(f'Account "{name}" ({email}) has been completely deleted from the database.', 'success')
    except Exception as e:
        flash(f'Error deleting account: {e}', 'error')
    return redirect(url_for('founder_dash.account_management'))


@founder_bp.route('/accounts/delete-by-email', methods=['POST'])
@founder_required
def account_delete_by_email():
    """Completely delete a user by their email address — founder types the email."""
    from ..models import User
    email = request.form.get('email', '').strip().lower()
    if not email:
        flash('Please enter an email address.', 'error')
        return redirect(url_for('founder_dash.account_management'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash(f'No account found with email: {email}', 'error')
        return redirect(url_for('founder_dash.account_management'))
    if user.is_founder:
        flash('Cannot delete the founder account.', 'error')
        return redirect(url_for('founder_dash.account_management'))

    name = user.display_name
    uid = user.wiam_id

    from .profile import _purge_user_data
    try:
        _purge_user_data(user.id, uid)
        flash(f'Account "{name}" ({email}) has been COMPLETELY deleted from the database. All data wiped.', 'success')
    except Exception as e:
        flash(f'Error deleting account: {e}', 'error')
    return redirect(url_for('founder_dash.account_management'))


# ---------------------------------------------------------------------------
# Feedback viewer
# ---------------------------------------------------------------------------

@founder_bp.route('/feedback')
@founder_required
def feedback_list():
    """View all user feedback."""
    from ..models import Feedback
    status_filter = request.args.get('status', '')
    q = Feedback.query
    if status_filter:
        q = q.filter(Feedback.status == status_filter)
    feedbacks = q.order_by(Feedback.created_at.desc()).limit(100).all()
    new_count = Feedback.query.filter_by(status='new').count()
    return render_template('founder/feedback.html',
                           feedbacks=feedbacks, status_filter=status_filter, new_count=new_count)


@founder_bp.route('/feedback/<int:fb_id>/status', methods=['POST'])
@founder_required
def feedback_status(fb_id):
    """Update feedback status."""
    from ..models import Feedback
    fb = Feedback.query.get_or_404(fb_id)
    new_status = request.form.get('status', 'read')
    if new_status in ('new', 'read', 'resolved'):
        fb.status = new_status
        db.session.commit()
        flash(f'Feedback #{fb.id} marked as {new_status}.', 'success')
    return redirect(url_for('founder_dash.feedback_list'))


@founder_bp.route('/feedback/<int:fb_id>/reply', methods=['POST'])
@founder_required
def reply_feedback(fb_id):
    """Reply to user feedback — sends a notification to the user."""
    from ..models import Feedback, Notification
    from datetime import datetime
    fb = Feedback.query.get_or_404(fb_id)
    reply_text = request.form.get('reply', '').strip()
    if not reply_text:
        flash('Reply cannot be empty.', 'error')
        return redirect(url_for('founder_dash.feedback_list'))

    fb.reply = reply_text
    fb.replied_by = current_user.wiam_id
    fb.replied_at = datetime.utcnow()
    fb.status = 'resolved'

    # Send notification to the user who submitted feedback
    try:
        notif = Notification(
            user_id=fb.user_id,
            type='system',
            title='Reply to Your Feedback',
            message=reply_text[:200],
            link='/profile/feedback',
        )
        db.session.add(notif)
    except Exception as e:
        log.error("Failed to notify user about feedback reply: %s", e)

    db.session.commit()
    flash(f'Reply sent to {fb.user_name or "user"}.', 'success')
    return redirect(url_for('founder_dash.feedback_list'))


@founder_bp.route('/feedback/<int:fb_id>/delete', methods=['POST'])
@founder_required
def delete_feedback(fb_id):
    """Permanently delete feedback from the database."""
    from ..models import Feedback
    fb = Feedback.query.get_or_404(fb_id)
    db.session.delete(fb)
    db.session.commit()
    flash('Feedback permanently deleted.', 'success')
    return redirect(url_for('founder_dash.feedback_list'))


# ---------------------------------------------------------------------------
# Premium management (Phase 4)
# ---------------------------------------------------------------------------
# NOTE: grant/revoke routes defined below near premium_analytics to avoid duplication.


@founder_bp.route('/premium/grant-credits', methods=['POST'])
@founder_required
def grant_credits():
    """Manually grant premium credits to a user."""
    from ..models import User
    from ..services.premium_service import admin_grant_credits
    identifier = request.form.get('identifier', '').strip()
    amount = request.form.get('amount', type=int)
    if not identifier or not amount or amount < 1:
        flash('Provide a user and a positive credit amount.', 'error')
        return redirect(url_for('founder_dash.settings'))

    user = User.query.filter_by(email=identifier).first()
    if not user:
        try:
            user = User.query.filter_by(wiam_id=int(identifier)).first()
        except (ValueError, TypeError):
            pass
    if not user:
        flash(f'User not found: {identifier}', 'error')
        return redirect(url_for('founder_dash.settings'))

    new_bal = admin_grant_credits(user, amount, reason='founder_grant')
    flash(f'Granted {amount} credits to {user.display_name}. New balance: {new_bal}.', 'success')
    return redirect(url_for('founder_dash.settings'))


# ── Smart Hybrid Publishing — Bot Review Queue ────────────────────────

@founder_bp.route('/review-queue')
@founder_required
def review_queue():
    """Founder view of the bot review queue with override controls."""
    from ..models import ReviewQueue
    status_filter = request.args.get('status', '')
    query = ReviewQueue.query
    if status_filter:
        query = query.filter(ReviewQueue.status == status_filter)
    items = query.order_by(ReviewQueue.created_at.desc()).limit(200).all()

    enriched = []
    for item in items:
        story = Content.query.get(item.content_id)
        if story and not story.deleted_at:
            creator = User.query.filter_by(wiam_id=story.creator_wiam_id).first()
            enriched.append({'queue': item, 'story': story, 'creator': creator})

    from ..models import ReviewQueue as RQ
    stats = {
        'total': RQ.query.count(),
        'pending': RQ.query.filter_by(status='pending').count(),
        'bot_approved': RQ.query.filter(RQ.status.in_(['bot_approved', 'approved'])).count(),
        'bot_rejected': RQ.query.filter(RQ.status.in_(['bot_rejected', 'rejected'])).count(),
        'in_review': RQ.query.filter_by(status='in_review').count(),
        'tc_violation': RQ.query.filter_by(status='tc_violation').count(),
    }

    return render_template('founder/review_queue.html',
        items=enriched, status_filter=status_filter, stats=stats)


@founder_bp.route('/review-queue/<int:queue_id>/override', methods=['POST'])
@founder_required
def review_override(queue_id):
    """Founder overrides a bot decision (approve or reject)."""
    from ..models import ReviewQueue, AuditLog
    import json as _json
    from datetime import datetime

    qe = ReviewQueue.query.get_or_404(queue_id)
    story = Content.query.get(qe.content_id)
    action = request.form.get('action')  # 'approve' or 'reject'
    reason = request.form.get('reason', '').strip()

    if action == 'approve':
        qe.status = 'approved'
        qe.reviewed_by = current_user.wiam_id
        qe.reviewed_at = datetime.utcnow()
        qe.editor_feedback = reason or 'Founder override: approved'
        if story:
            story.review_status = 'approved'
            story.last_reviewed_at = datetime.utcnow()
            story.reviewed_by = current_user.wiam_id
        flash(f'Story "{story.title}" approved by founder override.', 'success')
    elif action == 'reject':
        if not reason:
            flash('A reason is required when rejecting.', 'error')
            return redirect(url_for('founder_dash.review_queue'))
        qe.status = 'rejected'
        qe.reviewed_by = current_user.wiam_id
        qe.reviewed_at = datetime.utcnow()
        qe.editor_feedback = reason
        if story:
            story.review_status = 'rejected'
            story.last_reviewed_at = datetime.utcnow()
            story.reviewed_by = current_user.wiam_id
        flash(f'Story "{story.title}" rejected by founder.', 'warning')

    # Audit log
    db.session.add(AuditLog(
        actor_user_id=current_user.wiam_id,
        action=f'FOUNDER_OVERRIDE_{action.upper()}',
        target_type='BOOK',
        target_id=qe.content_id,
        details_json=_json.dumps({'reason': reason[:500], 'bot_score': qe.bot_score}),
        ip_address=request.remote_addr,
    ))
    db.session.commit()
    return redirect(url_for('founder_dash.review_queue'))


@founder_bp.route('/review-queue/<int:queue_id>/rerun-bot', methods=['POST'])
@founder_required
def rerun_bot_review(queue_id):
    """Founder re-runs the bot review on a story."""
    from ..models import ReviewQueue
    qe = ReviewQueue.query.get_or_404(queue_id)

    try:
        from ..services.bot_review import run_bot_review
        result = run_bot_review(qe.content_id)
        score = result.get('total_score', 0)
        passed = result.get('passed_monetization', False)
        flash(f'Bot re-review complete: score {score}/100 — {"APPROVED" if passed else "NOT APPROVED"}', 'success' if passed else 'warning')
    except Exception as e:
        flash(f'Bot review error: {str(e)[:200]}', 'error')

    return redirect(url_for('founder_dash.review_queue'))


@founder_bp.route('/settings/platform')
@founder_required
def platform_settings():
    """View and edit platform settings."""
    from ..models import PlatformSetting, FeatureFlag, PlatformConfig
    settings = PlatformSetting.query.order_by(PlatformSetting.key).all()
    flags = FeatureFlag.query.order_by(FeatureFlag.key).all()
    platform_cfg = PlatformConfig.get()
    return render_template('founder/platform_settings.html', settings=settings, flags=flags, platform_cfg=platform_cfg)


@founder_bp.route('/settings/platform/save', methods=['POST'])
@founder_required
def save_platform_settings():
    """Save platform settings changes."""
    import json as _json
    from ..models import PlatformSetting, AuditLog
    from datetime import datetime

    for key in request.form:
        if key.startswith('setting_'):
            setting_key = key[8:]
            new_value = request.form[key]
            s = PlatformSetting.query.filter_by(key=setting_key).first()
            if s:
                old = s.value_json
                # Convert to proper type
                if s.value_type == 'int':
                    try:
                        new_value = _json.dumps(int(new_value))
                    except ValueError:
                        continue
                elif s.value_type == 'bool':
                    new_value = _json.dumps(new_value.lower() in ('true', '1', 'on', 'yes'))
                else:
                    new_value = _json.dumps(new_value)

                if new_value != old:
                    s.value_json = new_value
                    s.updated_by = current_user.wiam_id
                    s.updated_at = datetime.utcnow()
                    db.session.add(AuditLog(
                        actor_user_id=current_user.wiam_id,
                        action='SETTING_CHANGED',
                        target_type='SETTING',
                        details_json=_json.dumps({'key': setting_key, 'old': old, 'new': new_value}),
                        ip_address=request.remote_addr,
                    ))

    db.session.commit()
    flash('Platform settings saved.', 'success')
    return redirect(url_for('founder_dash.platform_settings'))


@founder_bp.route('/settings/ads/save', methods=['POST'])
@founder_required
def save_ads_settings():
    """Save Google Ads settings (on/off toggle + AdSense client ID)."""
    import json as _json
    from ..models import PlatformConfig, AuditLog
    from datetime import datetime

    cfg = PlatformConfig.get()
    old_enabled = cfg.ads_enabled
    old_client = cfg.ads_client_id

    ads_enabled = request.form.get('ads_enabled', 'false').lower() in ('true', '1', 'on', 'yes')
    ads_client_id = request.form.get('ads_client_id', '').strip()

    cfg.ads_enabled = ads_enabled
    cfg.ads_client_id = ads_client_id
    cfg.updated_at = datetime.utcnow()

    db.session.add(AuditLog(
        actor_user_id=current_user.wiam_id,
        action='ADS_SETTINGS_CHANGED',
        target_type='PLATFORM',
        details_json=_json.dumps({
            'ads_enabled': {'old': old_enabled, 'new': ads_enabled},
            'ads_client_id': {'old': old_client, 'new': ads_client_id},
        }),
        ip_address=request.remote_addr,
    ))

    db.session.commit()
    status = 'enabled' if ads_enabled else 'disabled'
    flash(f'Google Ads {status}. Changes take effect within 5 minutes.', 'success')
    return redirect(url_for('founder_dash.platform_settings'))


@founder_bp.route('/settings/auth-gate/save', methods=['POST'])
@founder_required
def save_auth_gate():
    """Save auth gate settings — block/unblock login and registration independently."""
    import json as _json
    from ..models import PlatformConfig, AuditLog
    from datetime import datetime

    cfg = PlatformConfig.get()
    old_login = cfg.auth_login_blocked
    old_reg = cfg.auth_registration_blocked

    cfg.auth_login_blocked = request.form.get('login_blocked', 'false').lower() in ('true', '1', 'on', 'yes')
    cfg.auth_registration_blocked = request.form.get('registration_blocked', 'false').lower() in ('true', '1', 'on', 'yes')

    # Scheduled unblock (optional datetime)
    login_until = request.form.get('login_blocked_until', '').strip()
    reg_until = request.form.get('registration_blocked_until', '').strip()
    cfg.auth_login_blocked_until = datetime.fromisoformat(login_until) if login_until else None
    cfg.auth_registration_blocked_until = datetime.fromisoformat(reg_until) if reg_until else None

    # Custom messages
    login_msg = request.form.get('login_blocked_message', '').strip()
    reg_msg = request.form.get('registration_blocked_message', '').strip()
    if login_msg:
        cfg.auth_login_blocked_message = login_msg
    if reg_msg:
        cfg.auth_registration_blocked_message = reg_msg

    cfg.auth_gate_updated_by = current_user.wiam_id
    cfg.auth_gate_updated_at = datetime.utcnow()
    cfg.updated_at = datetime.utcnow()

    db.session.add(AuditLog(
        actor_user_id=current_user.wiam_id,
        action='AUTH_GATE_CHANGED',
        target_type='PLATFORM',
        details_json=_json.dumps({
            'login_blocked': {'old': old_login, 'new': cfg.auth_login_blocked},
            'registration_blocked': {'old': old_reg, 'new': cfg.auth_registration_blocked},
            'login_until': str(cfg.auth_login_blocked_until),
            'reg_until': str(cfg.auth_registration_blocked_until),
        }),
        ip_address=request.remote_addr,
    ))

    db.session.commit()
    flash('Auth gate settings saved. Changes take effect immediately.', 'success')
    return redirect(url_for('founder_dash.platform_settings'))


# ── Email Writer Studio ────────────────────────────────────────────────

def _email_studio_access(f):
    """Allow founder OR overall_boss to access email studio."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        roles = current_user.get_roles() if hasattr(current_user, 'get_roles') else []
        if not current_user.is_founder and 'overall_boss' not in roles:
            flash('Access denied.', 'error')
            if getattr(current_user, 'is_team_account', False):
                return redirect(url_for('team.dashboard'))
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated


@founder_bp.route('/email-studio')
@_email_studio_access
def email_studio():
    """Email Writer Studio — compose and send branded emails."""
    from ..models import User, Role, UserRole, CreatorProfile
    total_users = User.query.filter(User.email.isnot(None), User.email != '').count()
    total_creators = User.query.filter(User.role == 'creator', User.email.isnot(None), User.email != '').count()
    total_admins = User.query.filter(User.role == 'admin', User.email.isnot(None), User.email != '').count()
    # Team roles
    all_roles = Role.query.order_by(Role.name).all()
    role_counts = {}
    for r in all_roles:
        cnt = UserRole.query.filter_by(role_id=r.id).count()
        role_counts[r.name] = cnt
    from ..services.email_service import get_queue_status
    queue = get_queue_status()
    return render_template('founder/email_studio.html',
        total_users=total_users,
        total_creators=total_creators,
        total_admins=total_admins,
        all_roles=all_roles,
        role_counts=role_counts,
        queue=queue,
    )


@founder_bp.route('/email-studio/send', methods=['POST'])
@_email_studio_access
def email_studio_send():
    """Send branded email to selected recipients via the email queue."""
    from ..models import User, Role, UserRole
    from ..services.email_service import _heading, _paragraph, _button, _divider, _app_url, _info_box

    subject = request.form.get('subject', '').strip()
    body_text = request.form.get('body', '').strip()
    cta_text = request.form.get('cta_text', '').strip()
    cta_link = request.form.get('cta_link', '').strip()
    audience = request.form.get('audience', 'all')
    role_name = request.form.get('role_name', '')

    if not subject or not body_text:
        flash('Subject and body are required.', 'error')
        return redirect(url_for('founder_dash.email_studio'))

    # Build email body template with {name} placeholder for personalization
    url = _app_url()

    def _build_studio_body(recipient_name):
        """Build a polished branded email body for one recipient."""
        greeting = f'Hi {recipient_name},' if recipient_name else 'Hi there,'
        html = f'<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:16px;color:#e0e0e0;font-weight:600;">{greeting}</p>'
        html += f'<p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:12px;color:#888;">From the WiamApp Team</p>'
        html += _divider()
        html += f'<h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#d4a843;">{subject}</h2>'
        for line in body_text.split('\n'):
            line = line.strip()
            if line:
                html += _paragraph(line)
        if cta_text and cta_link:
            link = cta_link if cta_link.startswith('http') else f'{url}{cta_link}'
            html += _button(cta_text, link)
        html += _divider()
        html += '<p style="margin:0;font-size:11px;color:#555;text-align:center;">This email was sent by the WiamApp team.<br>You received it because you are a member of WiamApp.</p>'
        return html

    # Gather recipients
    single_email = request.form.get('single_email', '').strip()
    q = User.query.filter(User.email.isnot(None), User.email != '')
    if audience in ('single_user', 'single_creator', 'single_team_member'):
        # Founder-only: send to one person
        if not current_user.is_founder:
            flash('Access denied.', 'error')
            return redirect(url_for('founder_dash.email_studio'))
        if not single_email:
            flash('Please enter a recipient email or username.', 'error')
            return redirect(url_for('founder_dash.email_studio'))
        user = User.query.filter(
            db.or_(User.email == single_email, User.username == single_email)
        ).first()
        if not user or not user.email:
            flash(f'User "{single_email}" not found or has no email.', 'error')
            return redirect(url_for('founder_dash.email_studio'))
        if audience == 'single_creator' and user.role != 'creator':
            flash(f'"{user.display_name}" is not a creator.', 'error')
            return redirect(url_for('founder_dash.email_studio'))
        if audience == 'single_team_member':
            user_roles = UserRole.query.filter_by(user_id=user.id).all()
            if not user_roles:
                flash(f'"{user.display_name}" has no team roles.', 'error')
                return redirect(url_for('founder_dash.email_studio'))
        recipients = [(user.email, user.display_name)]
    elif audience == 'creators':
        q = q.filter(User.role == 'creator')
        recipients = [(u.email, u.display_name) for u in q.all()]
    elif audience == 'admins':
        q = q.filter(User.role == 'admin')
        recipients = [(u.email, u.display_name) for u in q.all()]
    elif audience == 'team_role' and role_name:
        role = Role.query.filter_by(name=role_name).first()
        if role:
            user_ids = [ur.user_id for ur in UserRole.query.filter_by(role_id=role.id).all()]
            q = q.filter(User.id.in_(user_ids)) if user_ids else q.filter(False)
        else:
            flash('Role not found.', 'error')
            return redirect(url_for('founder_dash.email_studio'))
        recipients = [(u.email, u.display_name) for u in q.all()]
    else:
        # audience == 'all'
        recipients = [(u.email, u.display_name) for u in q.all()]
    count = len(recipients)

    if count == 0:
        flash('No recipients found with email addresses.', 'warning')
        return redirect(url_for('founder_dash.email_studio'))

    # Queue emails via the centralized email queue (4s delay between sends)
    from ..services.email_service import enqueue_branded
    queued = 0
    skipped = 0
    for email, name in recipients:
        try:
            personalized_body = _build_studio_body(name or 'there')
            job = enqueue_branded(email, subject, personalized_body, subject[:100], priority=2)
            if job:
                queued += 1
            else:
                skipped += 1
        except Exception:
            skipped += 1
    log.info("Email Studio: queued=%d, skipped=%d, subject='%s'", queued, skipped, subject)

    flash(f'Queued {queued} email{"s" if queued != 1 else ""} for delivery (~4s between each). {f"{skipped} skipped (duplicate/deleted)." if skipped else ""}', 'success')
    return redirect(url_for('founder_dash.email_studio'))


@founder_bp.route('/email-studio/preview', methods=['POST'])
@_email_studio_access
def email_studio_preview():
    """Return preview HTML of the branded email."""
    from ..services.email_service import branded_email, _paragraph, _button, _divider, _app_url

    subject = request.form.get('subject', '').strip() or 'Preview Subject'
    body_text = request.form.get('body', '').strip() or 'Preview body text...'
    cta_text = request.form.get('cta_text', '').strip()
    cta_link = request.form.get('cta_link', '').strip()
    url = _app_url()

    # Build preview with sample recipient name
    body_html = '<p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:16px;color:#e0e0e0;font-weight:600;">Hi John,</p>'
    body_html += '<p style="margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:12px;color:#888;">From the WiamApp Team</p>'
    body_html += _divider()
    body_html += f'<h2 style="margin:0 0 16px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#d4a843;">{subject}</h2>'
    for line in body_text.split('\n'):
        line = line.strip()
        if line:
            body_html += _paragraph(line)
    if cta_text and cta_link:
        link = cta_link if cta_link.startswith('http') else f'{url}{cta_link}'
        body_html += _button(cta_text, link)
    body_html += _divider()
    body_html += '<p style="margin:0;font-size:11px;color:#555;text-align:center;">This email was sent by the WiamApp team.<br>You received it because you are a member of WiamApp.</p>'

    full_html = branded_email(body_html, subject[:100])
    return full_html


@founder_bp.route('/email-studio/search-users')
@founder_required
def email_studio_search_users():
    """AJAX endpoint: search users by email, username, or name. Founder only."""
    from ..models import User, UserRole
    from flask import jsonify
    term = request.args.get('q', '').strip()
    scope = request.args.get('scope', 'user')  # user, creator, team_member
    if len(term) < 2:
        return jsonify([])
    q = User.query.filter(
        User.email.isnot(None), User.email != '',
        db.or_(
            User.email.ilike(f'%{term}%'),
            User.username.ilike(f'%{term}%'),
            User.first_name.ilike(f'%{term}%'),
            User.last_name.ilike(f'%{term}%'),
        )
    )
    if scope == 'creator':
        q = q.filter(User.role == 'creator')
    elif scope == 'team_member':
        team_user_ids = [ur.user_id for ur in UserRole.query.all()]
        q = q.filter(User.id.in_(team_user_ids)) if team_user_ids else q.filter(False)
    results = []
    for u in q.limit(8).all():
        results.append({
            'email': u.email,
            'username': u.username or '',
            'display_name': u.display_name or u.email,
            'role': u.role or 'user',
        })
    return jsonify(results)


@founder_bp.route('/settings/flags/toggle', methods=['POST'])
@founder_required
def toggle_platform_flag():
    """Toggle a feature flag on/off."""
    import json as _json
    from ..models import FeatureFlag, AuditLog
    from datetime import datetime

    flag_key = request.form.get('key')
    flag = FeatureFlag.query.filter_by(key=flag_key).first()
    if not flag:
        flash('Flag not found.', 'error')
        return redirect(url_for('founder_dash.platform_settings'))

    flag.is_enabled = not flag.is_enabled
    flag.updated_by = current_user.wiam_id
    flag.updated_at = datetime.utcnow()

    db.session.add(AuditLog(
        actor_user_id=current_user.wiam_id,
        action='FLAG_TOGGLED',
        target_type='FLAG',
        details_json=_json.dumps({'key': flag_key, 'enabled': flag.is_enabled}),
        ip_address=request.remote_addr,
    ))
    db.session.commit()

    flash(f'Feature "{flag_key}" {"enabled" if flag.is_enabled else "disabled"}.', 'success')
    return redirect(url_for('founder_dash.platform_settings'))


# ---------------------------------------------------------------------------
# Subscribers Dashboard (P5)
# ---------------------------------------------------------------------------

@founder_bp.route('/subscribers')
@founder_required
def subscribers():
    """View all Premium & Elite subscribers, revenue, churn."""
    from datetime import datetime, timedelta

    # Premium stats
    premium_active = PremiumSubscription.query.filter_by(status='active').count()
    premium_cancelled = PremiumSubscription.query.filter_by(status='cancelled').count()
    premium_total = PremiumSubscription.query.count()
    premium_revenue = db.session.query(func.coalesce(func.sum(PremiumSubscription.amount_ghs), 0)).filter(
        PremiumSubscription.status.in_(['active', 'cancelled'])
    ).scalar() or 0

    # Elite stats
    elite_active = EliteSubscription.query.filter_by(status='active').count()
    elite_cancelled = EliteSubscription.query.filter_by(status='cancelled').count()
    elite_total = EliteSubscription.query.count()
    elite_revenue = db.session.query(func.coalesce(func.sum(EliteSubscription.amount_ghs), 0)).filter(
        EliteSubscription.status.in_(['active', 'cancelled'])
    ).scalar() or 0

    # Recent 30 days
    thirty_ago = datetime.utcnow() - timedelta(days=30)
    new_premium_30d = PremiumSubscription.query.filter(
        PremiumSubscription.created_at >= thirty_ago
    ).count()
    new_elite_30d = EliteSubscription.query.filter(
        EliteSubscription.created_at >= thirty_ago
    ).count()

    # All subscribers with user info
    premium_subs = db.session.query(PremiumSubscription, User).join(
        User, User.wiam_id == PremiumSubscription.user_id
    ).order_by(PremiumSubscription.created_at.desc()).limit(100).all()

    elite_subs = db.session.query(EliteSubscription, User).join(
        User, User.wiam_id == EliteSubscription.user_id
    ).order_by(EliteSubscription.created_at.desc()).limit(100).all()

    # Premium users (from user model)
    premium_users_count = User.query.filter(User.premium_status == 'active').count()

    return render_template(
        'founder/subscribers.html',
        premium_active=premium_active,
        premium_cancelled=premium_cancelled,
        premium_total=premium_total,
        premium_revenue=premium_revenue,
        elite_active=elite_active,
        elite_cancelled=elite_cancelled,
        elite_total=elite_total,
        elite_revenue=elite_revenue,
        new_premium_30d=new_premium_30d,
        new_elite_30d=new_elite_30d,
        premium_subs=premium_subs,
        elite_subs=elite_subs,
        premium_users_count=premium_users_count,
        total_revenue=premium_revenue + elite_revenue,
    )


# ---------------------------------------------------------------------------
# Team Payroll (P6)
# ---------------------------------------------------------------------------

@founder_bp.route('/payroll')
@founder_required
def payroll():
    """Team payroll dashboard — manage worker payments."""
    try:
        from datetime import datetime
        current_dt = datetime.utcnow()
        year = int(request.args.get('year', current_dt.year))
        month = int(request.args.get('month', current_dt.month))

        try:
            from ..services.payroll_service import get_payroll_summary
            summary = get_payroll_summary(year, month)
        except Exception as e:
            log.error("Payroll service import/query error: %s", e, exc_info=True)
            summary = {'records': [], 'total_amount': 0, 'sent': 0, 'failed': 0, 'pending': 0, 'count': 0}

        # All configured workers
        try:
            workers = TeamPayrollSettings.query.order_by(TeamPayrollSettings.role_name).all()
        except Exception as e:
            log.error("TeamPayrollSettings query error: %s", e, exc_info=True)
            workers = []

        # Get user info for each worker
        worker_users = {}
        for w in workers:
            u = User.query.filter_by(wiam_id=w.user_id).first()
            if u:
                worker_users[w.user_id] = u

        # Global payroll toggle (stored in PlatformConfig)
        cfg = PlatformConfig.get()
        payroll_enabled = getattr(cfg, 'payroll_enabled', True)

        return render_template(
            'founder/payroll.html',
            workers=workers,
            worker_users=worker_users,
            summary=summary,
            year=year,
            month=month,
            payroll_enabled=payroll_enabled,
            current_dt=current_dt,
        )
    except Exception as e:
        log.error("Payroll page crash: %s", e, exc_info=True)
        flash(f'Payroll error: {type(e).__name__}: {str(e)[:200]}', 'error')
        return redirect(url_for('founder_dash.overview'))


@founder_bp.route('/payroll/add-worker', methods=['POST'])
@founder_required
def payroll_add_worker():
    """Add or update a team member's payroll settings."""
    user_id = request.form.get('user_id', type=int)
    if not user_id:
        email = request.form.get('email', '').strip().lower()
        user = User.query.filter_by(email=email).first()
        if not user:
            flash('User not found with that email.', 'error')
            return redirect(url_for('founder_dash.payroll'))
        user_id = user.wiam_id

    role_name = request.form.get('role_name', '').strip()
    salary = request.form.get('salary', 0.0, type=float)
    provider = request.form.get('provider', 'MTN').upper()
    account_number = request.form.get('account_number', '').strip()
    account_name = request.form.get('account_name', '').strip()

    settings = TeamPayrollSettings.query.get(user_id)
    if settings:
        settings.role_name = role_name or settings.role_name
        settings.monthly_salary_ghs = salary
        settings.provider = provider
        settings.account_number = account_number
        settings.account_name = account_name
        from datetime import datetime
        settings.updated_at = datetime.utcnow()
    else:
        settings = TeamPayrollSettings(
            user_id=user_id,
            role_name=role_name or 'team_member',
            monthly_salary_ghs=salary,
            provider=provider,
            account_number=account_number,
            account_name=account_name,
        )
        db.session.add(settings)

    db.session.commit()
    flash(f'Payroll settings saved for {account_name or role_name}.', 'success')
    return redirect(url_for('founder_dash.payroll'))


@founder_bp.route('/payroll/toggle-worker/<int:user_id>', methods=['POST'])
@founder_required
def payroll_toggle_worker(user_id):
    """Enable/disable payroll for a specific worker."""
    settings = TeamPayrollSettings.query.get(user_id)
    if not settings:
        flash('Worker not found.', 'error')
        return redirect(url_for('founder_dash.payroll'))

    settings.is_active = not settings.is_active
    from datetime import datetime
    settings.updated_at = datetime.utcnow()
    db.session.commit()

    status = 'enabled' if settings.is_active else 'disabled'
    flash(f'Payroll {status} for {settings.account_name or settings.role_name}.', 'success')
    return redirect(url_for('founder_dash.payroll'))


@founder_bp.route('/payroll/remove-worker/<int:user_id>', methods=['POST'])
@founder_required
def payroll_remove_worker(user_id):
    """Remove a worker from payroll entirely."""
    settings = TeamPayrollSettings.query.get(user_id)
    if settings:
        db.session.delete(settings)
        db.session.commit()
        flash('Worker removed from payroll.', 'success')
    return redirect(url_for('founder_dash.payroll'))


@founder_bp.route('/payroll/create-recipient/<int:user_id>', methods=['POST'])
@founder_required
def payroll_create_recipient(user_id):
    """Create Paystack transfer recipient for a worker."""
    settings = TeamPayrollSettings.query.get(user_id)
    if not settings:
        flash('Worker not found.', 'error')
        return redirect(url_for('founder_dash.payroll'))

    from ..services.payroll_service import create_transfer_recipient
    code = create_transfer_recipient(settings)
    if code:
        flash(f'Paystack recipient created: {code}', 'success')
    else:
        flash('Failed to create Paystack recipient. Check MoMo details.', 'error')
    return redirect(url_for('founder_dash.payroll'))


@founder_bp.route('/payroll/generate', methods=['POST'])
@founder_required
def payroll_generate():
    """Generate pending payroll records for a month."""
    from datetime import datetime
    year = request.form.get('year', datetime.utcnow().year, type=int)
    month = request.form.get('month', datetime.utcnow().month, type=int)

    from ..services.payroll_service import generate_monthly_payroll
    created = generate_monthly_payroll(year, month, approved_by=current_user.wiam_id)
    flash(f'Generated {len(created)} payroll records for {month}/{year}.', 'success')
    return redirect(url_for('founder_dash.payroll', year=year, month=month))


@founder_bp.route('/payroll/run', methods=['POST'])
@founder_required
def payroll_run():
    """Execute all pending payroll transfers for a month."""
    from datetime import datetime
    year = request.form.get('year', datetime.utcnow().year, type=int)
    month = request.form.get('month', datetime.utcnow().month, type=int)

    from ..services.payroll_service import run_payroll
    results = run_payroll(year, month)
    flash(f'Payroll run: {results["sent"]} sent, {results["failed"]} failed out of {results["total"]}.', 'success')
    return redirect(url_for('founder_dash.payroll', year=year, month=month))


@founder_bp.route('/payroll/retry/<int:payroll_id>', methods=['POST'])
@founder_required
def payroll_retry(payroll_id):
    """Retry a failed payroll transfer."""
    record = TeamPayroll.query.get(payroll_id)
    if not record or record.status != 'failed':
        flash('Record not found or not in failed state.', 'error')
        return redirect(url_for('founder_dash.payroll'))

    record.status = 'pending'
    record.failure_reason = None
    db.session.commit()

    from ..services.payroll_service import send_transfer
    success = send_transfer(record)
    if success:
        flash('Transfer retried successfully.', 'success')
    else:
        flash(f'Retry failed: {record.failure_reason}', 'error')
    return redirect(url_for('founder_dash.payroll', year=record.year, month=record.month))


@founder_bp.route('/settings/manage-founder', methods=['POST'])
@founder_required
def manage_founder_account():
    """Create or promote a user to founder role, or reset a user's password."""
    action = request.form.get('action', '')
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '').strip()

    if not email or '@' not in email:
        flash('Valid email required.', 'error')
        return redirect(url_for('founder_dash.settings'))

    from sqlalchemy import func
    user = User.query.filter(func.lower(User.email) == email).first()

    if action == 'make_founder':
        if not user:
            # Create new founder account
            import secrets as _s, random
            synthetic_tid = -random.randint(900000000, 999999999)
            while User.query.filter_by(wiam_id=synthetic_tid).first():
                synthetic_tid = -random.randint(900000000, 999999999)
            user = User(
                wiam_id=synthetic_tid,
                email=email,
                username=email.split('@')[0],
                first_name='Founder',
                role='founder',
                email_verified=True,
                auth_provider='email',
                onboarding_completed=True,
                status='active',
            )
            if password:
                user.set_password(password)
            db.session.add(user)
            db.session.commit()
            flash(f'Created new founder account: {email}', 'success')
        else:
            user.role = 'founder'
            user.status = 'active'
            if password:
                user.set_password(password)
            db.session.commit()
            flash(f'{user.display_name} ({email}) is now a founder.', 'success')

    elif action == 'reset_password':
        if not user:
            flash(f'No account found with email: {email}', 'error')
        elif not password:
            flash('Please provide a new password.', 'error')
        else:
            user.set_password(password)
            db.session.commit()
            flash(f'Password reset for {user.display_name} ({email}).', 'success')

    return redirect(url_for('founder_dash.settings'))


# ── Notification Testing ──────────────────────────────────────────

@founder_bp.route('/notifications')
@founder_required
def notification_testing():
    """Notification testing page — test ALL notification types."""
    from ..models import PushSubscription, Notification
    uid = current_user.wiam_id

    push_subs = PushSubscription.query.filter_by(user_id=uid).count()
    recent_notifs = Notification.query.filter_by(user_id=uid).order_by(
        Notification.created_at.desc()
    ).limit(10).all()

    vapid_configured = bool(current_app.config.get('VAPID_PRIVATE_KEY'))
    vapid_public = current_app.config.get('VAPID_PUBLIC_KEY', '')

    return render_template(
        'founder/notifications.html',
        push_subs=push_subs,
        recent_notifs=recent_notifs,
        vapid_configured=vapid_configured,
        vapid_public=vapid_public,
    )


@founder_bp.route('/notifications/test', methods=['POST'])
@founder_required
def send_test_notification():
    """Send a test notification of the specified type to the founder."""
    from ..services.notifications import (
        notify_new_follower, notify_comment, notify_like,
        notify_mention, notify_coin_received, notify_order_update,
        notify_elite_promotion, notify_announcement, notify_system,
    )

    notif_type = request.form.get('type', 'system')
    uid = current_user.wiam_id
    name = current_user.display_name

    test_handlers = {
        'new_book': lambda: _test_new_book_notif(uid, name),
        'new_chapter': lambda: _test_new_chapter_notif(uid, name),
        'follow': lambda: notify_new_follower(uid, 'TestUser123'),
        'comment': lambda: notify_comment(uid, 'TestReader', 'My Amazing Story', 0, 1),
        'like': lambda: notify_like(uid, 'BookLover42', 'My Amazing Story', 0, 3),
        'mention': lambda: notify_mention(uid, 'CoolWriter', 'Hey @' + name + ' love your work!'),
        'coins': lambda: notify_coin_received(uid, 50, 'Test reward'),
        'order_update': lambda: notify_order_update(uid, 'Premium Story', 'approved', 0),
        'elite': lambda: notify_elite_promotion(uid, 'Elite Story Title', 0),
        'announcement': lambda: notify_announcement(uid, 'Platform Update', 'WiamApp has new features! Check them out.'),
        'system': lambda: notify_system(uid, 'System Test', 'This is a test system notification.'),
    }

    handler = test_handlers.get(notif_type)
    if handler:
        try:
            handler()
            flash(f'Test "{notif_type}" notification sent!', 'success')
        except Exception as e:
            flash(f'Error sending {notif_type}: {str(e)[:200]}', 'error')
    else:
        flash(f'Unknown notification type: {notif_type}', 'error')

    return redirect(url_for('founder_dash.notification_testing'))


def _test_new_book_notif(uid, name):
    """Create a test new-book notification directly."""
    from ..models import Notification
    from ..services.notifications import _try_push
    notif = Notification(
        user_id=uid, type='new_book',
        title=f'New story by {name}',
        message='"Test Book Title" is now available!',
        link='/notifications',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, f'New story by {name}',
              '"Test Book Title" is now available!', '/notifications',
              notif_type='new_book')


def _test_new_chapter_notif(uid, name):
    """Create a test new-chapter notification directly."""
    from ..models import Notification
    from ..services.notifications import _try_push
    notif = Notification(
        user_id=uid, type='new_chapter',
        title='New chapter in "Test Book"',
        message=f'{name} published Chapter 5',
        link='/notifications',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'New chapter in "Test Book"',
              f'{name} published Chapter 5', '/notifications',
              notif_type='new_chapter')


# ===========================================================================
# Creator Payout History (read-only — payouts are fully automatic)
# ===========================================================================

@founder_bp.route('/withdrawals')
@founder_required
def withdrawals():
    """View payout history. Payouts are automatic — no manual actions."""
    items = CreatorWithdrawal.query.order_by(CreatorWithdrawal.requested_at.desc()).limit(100).all()

    creator_ids = {w.creator_id for w in items}
    creators = {u.wiam_id: u for u in User.query.filter(User.wiam_id.in_(creator_ids)).all()} if creator_ids else {}

    return render_template('founder/withdrawals.html', items=items, creators=creators)


# ===========================================================================
# Money Ecosystem v5 — Financial Dashboard + Controls
# ===========================================================================

def _financial_access(f):
    """Allow founder, overall_boss, or finance role to access financial pages."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.is_founder:
            return f(*args, **kwargs)
        roles = current_user.get_roles() if hasattr(current_user, 'get_roles') else []
        if {'overall_boss', 'finance'} & set(roles):
            return f(*args, **kwargs)
        flash('Access denied.', 'error')
        if getattr(current_user, 'is_team_account', False):
            return redirect(url_for('team.dashboard'))
        return redirect(url_for('home.home'))
    return decorated


@founder_bp.route('/financial')
@_financial_access
def financial_dashboard():
    """Full financial overview: ledger health, system wallets, fraud alerts."""
    from ..services.ledger import get_ledger_health
    health = get_ledger_health()

    # Recent ledger entries
    recent_entries = LedgerEntry.query.order_by(LedgerEntry.created_at.desc()).limit(50).all()

    # Pending refunds
    pending_refunds = RefundRequest.query.filter_by(status='pending')\
        .order_by(RefundRequest.created_at.desc()).all()

    # Frozen accounts
    frozen_users = User.query.filter_by(account_frozen=True).all()

    # High-risk users
    high_risk = User.query.filter(User.risk_score >= 50)\
        .order_by(User.risk_score.desc()).limit(20).all()

    return render_template('founder/financial.html',
                           health=health,
                           recent_entries=recent_entries,
                           pending_refunds=pending_refunds,
                           frozen_users=frozen_users,
                           high_risk=high_risk)


@founder_bp.route('/financial/freeze/<int:user_id>', methods=['POST'])
@founder_required
def freeze_account(user_id):
    """Freeze or unfreeze a user's financial account."""
    from ..services.ledger import founder_freeze_account
    action = request.form.get('action', 'freeze')
    reason = request.form.get('reason', '')
    freeze = action != 'unfreeze'
    result = founder_freeze_account(user_id, freeze=freeze,
                                    founder_id=current_user.wiam_id, reason=reason)
    if result.get('error'):
        flash(result['error'], 'danger')
    else:
        flash(f'Account {"frozen" if freeze else "unfrozen"} successfully.', 'success')
    return redirect(url_for('founder_dash.financial_dashboard'))


@founder_bp.route('/financial/adjust/<int:user_id>', methods=['POST'])
@founder_required
def adjust_balance(user_id):
    """Manually adjust a user's coin balance (via ledger)."""
    from ..services.ledger import founder_adjust_balance
    try:
        coins = int(request.form.get('coins', 0))
    except (ValueError, TypeError):
        flash('Invalid coin amount.', 'danger')
        return redirect(url_for('founder_dash.financial_dashboard'))

    reason = request.form.get('reason', 'Founder adjustment')
    if coins == 0:
        flash('Coin amount cannot be zero.', 'warning')
        return redirect(url_for('founder_dash.financial_dashboard'))

    result = founder_adjust_balance(user_id, coins, reason, founder_id=current_user.wiam_id)
    if result.get('error'):
        flash(result['error'], 'danger')
    else:
        flash(f'Balance adjusted by {coins:+d} coins. New balance: {result["balance"]}', 'success')
    return redirect(url_for('founder_dash.financial_dashboard'))


@founder_bp.route('/financial/refund/<int:refund_id>', methods=['POST'])
@founder_required
def resolve_refund(refund_id):
    """Approve or reject a pending refund request."""
    from ..services.ledger import record_refund
    refund = RefundRequest.query.get_or_404(refund_id)
    action = request.form.get('action', 'reject')
    note = request.form.get('note', '')

    if refund.status != 'pending':
        flash('This refund has already been resolved.', 'warning')
        return redirect(url_for('founder_dash.financial_dashboard'))

    if action == 'approve':
        # Find the original transaction to get creator_id
        orig_tx = CoinTransaction.query.get(refund.original_tx_id)
        creator_id = orig_tx.recipient_id if orig_tx else None
        result = record_refund(
            refund.user_id, refund.original_tx_id, refund.amount_coins,
            reason=refund.reason, creator_id=creator_id,
            resolved_by=current_user.wiam_id,
        )
        if result.get('error'):
            flash(result['error'], 'danger')
        else:
            flash(f'Refund of {refund.amount_coins} coins approved.', 'success')
    else:
        from datetime import datetime
        refund.status = 'rejected'
        refund.resolution_note = note
        refund.resolved_by = current_user.wiam_id
        refund.resolved_at = datetime.utcnow()
        db.session.commit()
        flash('Refund rejected.', 'info')

    return redirect(url_for('founder_dash.financial_dashboard'))


@founder_bp.route('/financial/alert/<int:alert_id>/resolve', methods=['POST'])
@founder_required
def resolve_fraud_alert(alert_id):
    """Resolve a fraud alert."""
    from datetime import datetime
    alert = FraudAlert.query.get_or_404(alert_id)
    alert.is_resolved = True
    alert.resolved_by = current_user.wiam_id
    alert.resolved_note = request.form.get('note', '')
    alert.resolved_at = datetime.utcnow()
    db.session.commit()
    flash('Alert resolved.', 'success')
    return redirect(url_for('founder_dash.financial_dashboard'))


# ── Premium Analytics Dashboard ──────────────────────────────────

@founder_bp.route('/premium')
@founder_required
def premium_analytics():
    """Founder dashboard — WiamPremium subscription analytics."""
    from datetime import datetime, timedelta

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # Subscription counts by status
    total_premium = User.query.filter(User.premium_status.in_(['active', 'trial'])).count()
    active_count = User.query.filter_by(premium_status='active').count()
    trial_count = User.query.filter_by(premium_status='trial').count()
    expired_count = User.query.filter_by(premium_status='expired').count()

    # Plan breakdown
    basic_count = User.query.filter(
        User.premium_status.in_(['active', 'trial']),
        User.premium_plan == 'basic',
    ).count()
    plus_count = User.query.filter(
        User.premium_status.in_(['active', 'trial']),
        User.premium_plan == 'plus',
    ).count()
    unlimited_count = User.query.filter(
        User.premium_status.in_(['active', 'trial']),
        User.premium_plan == 'unlimited',
    ).count()

    # Recent subscribers (last 30 days)
    recent_subs = User.query.filter(
        User.premium_status.in_(['active', 'trial']),
        User.premium_started_at >= thirty_days_ago,
    ).order_by(User.premium_started_at.desc()).limit(20).all()

    # Credits stats
    total_credits_granted = db.session.query(
        func.coalesce(func.sum(PremiumCreditsLedger.amount), 0)
    ).filter(PremiumCreditsLedger.type == 'grant').scalar()

    total_credits_spent = db.session.query(
        func.coalesce(func.sum(func.abs(PremiumCreditsLedger.amount)), 0)
    ).filter(PremiumCreditsLedger.type == 'spend').scalar()

    # Ad impression stats
    total_impressions = AdImpression.query.count()
    impressions_30d = AdImpression.query.filter(
        AdImpression.created_at >= thirty_days_ago
    ).count()
    est_revenue = db.session.query(
        func.coalesce(func.sum(AdImpression.estimated_revenue_usd), 0)
    ).scalar()

    # Expiring soon (within 7 days)
    seven_days = now + timedelta(days=7)
    expiring_soon = User.query.filter(
        User.premium_status == 'active',
        User.premium_expires_at.isnot(None),
        User.premium_expires_at <= seven_days,
        User.premium_expires_at > now,
    ).count()

    return render_template('founder/premium_analytics.html',
        total_premium=total_premium,
        active_count=active_count,
        trial_count=trial_count,
        expired_count=expired_count,
        basic_count=basic_count,
        plus_count=plus_count,
        unlimited_count=unlimited_count,
        recent_subs=recent_subs,
        total_credits_granted=total_credits_granted,
        total_credits_spent=total_credits_spent,
        total_impressions=total_impressions,
        impressions_30d=impressions_30d,
        est_revenue=est_revenue,
        expiring_soon=expiring_soon,
    )


@founder_bp.route('/premium/grant', methods=['POST'])
@founder_required
def premium_grant():
    """Manually grant premium to a user."""
    from datetime import datetime, timedelta
    from ..services.premium_service import grant_monthly_credits
    user_id = request.form.get('user_id', type=int)
    plan = request.form.get('plan', 'basic')
    days = request.form.get('days', 30, type=int)

    target = User.query.get(user_id)
    if not target:
        flash('User not found.', 'error')
        return redirect(url_for('founder_dash.premium_analytics'))

    target.premium_status = 'active'
    target.premium_plan = plan
    target.premium_provider = 'admin_grant'
    target.premium_started_at = target.premium_started_at or datetime.utcnow()
    target.premium_expires_at = datetime.utcnow() + timedelta(days=days)
    db.session.commit()

    # Grant monthly credits for the new subscription
    try:
        grant_monthly_credits(target)
    except Exception:
        pass  # credits are a bonus, don't block the grant

    flash(f'Granted {plan} premium to {target.display_name or target.username} for {days} days.', 'success')
    return redirect(url_for('founder_dash.premium_analytics'))


@founder_bp.route('/migrate-images')
@founder_required
def migrate_images_page():
    """Show image migration status with a Run button."""
    from ..models import ImageStore
    total_db_images = ImageStore.query.count()
    db_covers = Content.query.filter(Content.cover_file_id.like('dbimg_%')).count()
    cloud_covers = Content.query.filter(Content.cover_file_id.like('ext_%')).count()
    db_avatars = User.query.filter(User.avatar_url.like('/img/%')).count()
    cloud_avatars = User.query.filter(User.avatar_url.like('http%')).count()

    html = f'''<!DOCTYPE html>
<html><head><title>Image Migration - WiamApp</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; background: #0a0a1a; color: #eee; }}
  h1 {{ color: #d4a843; }}
  .card {{ background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 16px 0; }}
  .stat {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }}
  .stat:last-child {{ border-bottom: none; }}
  .label {{ color: #aaa; }}
  .value {{ font-weight: bold; }}
  .value.db {{ color: #ff6b6b; }}
  .value.cloud {{ color: #51cf66; }}
  .btn {{ display: inline-block; padding: 14px 32px; background: #d4a843; color: #0a0a1a; border: none; border-radius: 8px;
          font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; }}
  .btn:hover {{ background: #c49a3a; }}
  .btn:disabled {{ background: #555; cursor: not-allowed; }}
  #result {{ margin-top: 20px; padding: 16px; border-radius: 8px; display: none; }}
  .success {{ background: #1a3a1a; border: 1px solid #51cf66; }}
  .error {{ background: #3a1a1a; border: 1px solid #ff6b6b; }}
  a {{ color: #d4a843; }}
  .back-btn {{ display: inline-block; padding: 10px 20px; background: #1a1a2e; color: #d4a843; border: 1px solid #d4a843;
              border-radius: 8px; text-decoration: none; font-weight: bold; margin-bottom: 16px; }}
  .back-btn:hover {{ background: #d4a843; color: #0a0a1a; }}
</style></head>
<body>
  <a href="/founder" class="back-btn">&larr; Back to Founder Dashboard</a>
  <h1>Image Migration to Cloudinary</h1>

  <div class="card">
    <h2>Current Status</h2>
    <div class="stat"><span class="label">Total images in DB</span><span class="value db">{total_db_images}</span></div>
    <div class="stat"><span class="label">Covers still in DB</span><span class="value db">{db_covers}</span></div>
    <div class="stat"><span class="label">Covers on Cloudinary</span><span class="value cloud">{cloud_covers}</span></div>
    <div class="stat"><span class="label">Avatars still in DB</span><span class="value db">{db_avatars}</span></div>
    <div class="stat"><span class="label">Avatars on Cloudinary</span><span class="value cloud">{cloud_avatars}</span></div>
  </div>

  <div class="card">
    <h2>Run Migration</h2>
    <p>This will upload all DB images to Cloudinary and free up Neon storage. Safe to run multiple times.</p>
    <button class="btn" id="migrateBtn" onclick="runMigration()">
      Migrate All Images to Cloudinary
    </button>
    <div id="result"></div>
  </div>

<script>
async function runMigration() {{
  const btn = document.getElementById('migrateBtn');
  const result = document.getElementById('result');
  btn.disabled = true;
  btn.textContent = 'Migrating... please wait';
  result.style.display = 'none';
  try {{
    const resp = await fetch('/founder/migrate-images/run', {{ method: 'POST' }});
    const data = await resp.json();
    result.style.display = 'block';
    result.className = data.failed > 0 ? 'error' : 'success';
    result.innerHTML = '<strong>' + data.message + '</strong>';
    if (data.failed > 0) result.innerHTML += '<br>Failed: ' + data.failed;
    btn.textContent = 'Done! Refresh page to see updated counts';
  }} catch(e) {{
    result.style.display = 'block';
    result.className = 'error';
    result.innerHTML = '<strong>Error:</strong> ' + e.message;
    btn.textContent = 'Migrate All Images to Cloudinary';
    btn.disabled = false;
  }}
}}
</script>
</body></html>'''
    return html


@founder_bp.route('/migrate-images/run', methods=['POST'])
@csrf.exempt
@founder_required
def migrate_images_run():
    """Migrate existing DB images to Cloudinary. Safe to run multiple times."""
    from ..models import ImageStore
    from ..services.image_service import upload_image

    migrated_covers = 0
    migrated_avatars = 0
    failed = 0

    # ── Migrate book covers ──
    db_cover_books = Content.query.filter(
        Content.cover_file_id.like('dbimg_%'),
        Content.deleted_at == None,
    ).all()

    for book in db_cover_books:
        try:
            img_id = int(book.cover_file_id.replace('dbimg_', ''))
            img = ImageStore.query.get(img_id)
            if not img or not img.data:
                failed += 1
                continue
            url = upload_image(
                img.data,
                folder='covers',
                public_id=f'cover_{book.id}',
                content_type=img.content_type or 'image/jpeg',
            )
            if url:
                book.cover_file_id = f'ext_{url}'
                img.data = None
                migrated_covers += 1
            else:
                failed += 1
        except Exception as e:
            log.error("Cover migration failed for book #%s: %s", book.id, e)
            failed += 1

    # ── Migrate user avatars ──
    db_avatar_users = User.query.filter(
        User.avatar_url.like('/img/%'),
    ).all()

    for user in db_avatar_users:
        try:
            img_id = int(user.avatar_url.replace('/img/', ''))
            img = ImageStore.query.get(img_id)
            if not img or not img.data:
                failed += 1
                continue
            url = upload_image(
                img.data,
                folder='avatars',
                public_id=f'avatar_{user.id}',
                content_type=img.content_type or 'image/png',
            )
            if url:
                user.avatar_url = url
                img.data = None
                migrated_avatars += 1
            else:
                failed += 1
        except Exception as e:
            log.error("Avatar migration failed for user #%s: %s", user.id, e)
            failed += 1

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        log.error("Migration commit failed: %s", e)
        return jsonify({'migrated_covers': migrated_covers, 'migrated_avatars': migrated_avatars, 'failed': failed + 1, 'message': f'Commit error: {e}'}), 500

    return jsonify({
        'migrated_covers': migrated_covers,
        'migrated_avatars': migrated_avatars,
        'failed': failed,
        'message': f'Done! Migrated {migrated_covers} covers + {migrated_avatars} avatars to Cloudinary.',
    })


@founder_bp.route('/premium/revoke', methods=['POST'])
@founder_required
def premium_revoke():
    """Revoke a user's premium subscription."""
    user_id = request.form.get('user_id', type=int)
    target = User.query.get(user_id)
    if not target:
        flash('User not found.', 'error')
        return redirect(url_for('founder_dash.premium_analytics'))

    target.premium_status = 'none'
    target.premium_plan = None
    target.premium_provider = None
    db.session.commit()

    flash(f'Revoked premium from {target.display_name or target.username}.', 'success')
    return redirect(url_for('founder_dash.premium_analytics'))


# ---------------------------------------------------------------------------
# WiamEpisio full-season QC (Founder ON/OFF + queue + publish)
# ---------------------------------------------------------------------------

@founder_bp.route('/episio-quality')
@founder_required
def episio_quality():
    """Full-season QC dashboard: toggles + jobs for trailer + every episode."""
    from ..models import SeasonQualityJob, Content
    from ..services.season_quality_pipeline import (
        pipeline_enabled, tool_availability, review_tool_catalog, estimate_season_review,
    )
    cfg = PlatformConfig.get()
    status_filter = (request.args.get('status') or '').strip()
    q = SeasonQualityJob.query.order_by(SeasonQualityJob.id.desc())
    if status_filter:
        q = q.filter_by(status=status_filter)
    jobs = q.limit(80).all()
    series_map = {}
    for j in jobs:
        if j.content_id not in series_map:
            series_map[j.content_id] = Content.query.get(j.content_id)
    stats = {
        'queued': SeasonQualityJob.query.filter_by(status='queued').count(),
        'running': SeasonQualityJob.query.filter_by(status='running').count(),
        'borderline': SeasonQualityJob.query.filter_by(status='borderline').count(),
        'passed': SeasonQualityJob.query.filter_by(status='passed').count(),
        'failed': SeasonQualityJob.query.filter_by(status='failed').count(),
        'pipeline_on': pipeline_enabled(),
    }
    return render_template(
        'founder/episio_quality.html',
        cfg=cfg,
        jobs=jobs,
        series_map=series_map,
        stats=stats,
        status_filter=status_filter,
        tools=tool_availability(),
        tool_catalog=review_tool_catalog(),
        timing_example=estimate_season_review(20, True),
    )


@founder_bp.route('/episio-quality/flags', methods=['POST'])
@founder_required
def episio_quality_flags():
    cfg = PlatformConfig.get()
    for key in (
        'ff_season_quality_pipeline', 'ff_season_qc_technical', 'ff_season_qc_visual',
        'ff_season_qc_audio', 'ff_season_qc_vmaf', 'ff_season_qc_ssim',
        'ff_season_qc_scenedetect', 'ff_season_qc_vad', 'ff_season_qc_phash',
        'ff_season_qc_watermark', 'ff_season_qc_blackdetect', 'ff_season_qc_integrity',
        'ff_season_qc_auto_reject_poor', 'ff_season_qc_auto_clear_good',
        'ff_season_qc_sla_auto_decide',
        'ff_trailer_quality_gate', 'ff_require_complete_series',
    ):
        # Checkbox: missing means OFF
        setattr(cfg, key, request.form.get(key) == 'on')
    from datetime import datetime as _dt
    cfg.updated_at = _dt.utcnow()
    db.session.commit()
    flash('WiamEpisio quality pipeline flags saved.', 'success')
    return redirect(url_for('founder_dash.episio_quality'))


@founder_bp.route('/episio-quality/run-queue', methods=['POST'])
@founder_required
def episio_quality_run_queue():
    from ..services.season_quality_pipeline import process_queued_jobs
    from ..services.season_sla_auto import process_expired_review_slas
    n = process_queued_jobs(limit=10)
    sla = process_expired_review_slas(limit=40)
    flash(
        'Processed %s QC job(s). SLA auto: published %s · rejected %s (Good→publish, not good→Needs Changes).'
        % (n, sla.get('published', 0), sla.get('rejected', 0)),
        'success',
    )
    return redirect(url_for('founder_dash.episio_quality'))


@founder_bp.route('/episio-quality/jobs/<int:job_id>')
@founder_required
def episio_quality_job(job_id):
    from ..models import SeasonQualityJob, SeasonAssetQualityReport, Content
    job = SeasonQualityJob.query.get_or_404(job_id)
    assets = (
        SeasonAssetQualityReport.query.filter_by(job_id=job.id)
        .order_by(SeasonAssetQualityReport.id.asc())
        .all()
    )
    series = Content.query.get(job.content_id)
    return render_template(
        'founder/episio_quality_job.html',
        job=job,
        assets=assets,
        series=series,
    )


@founder_bp.route('/episio-quality/jobs/<int:job_id>/decide', methods=['POST'])
@founder_required
def episio_quality_decide(job_id):
    from datetime import datetime as _dt
    from ..models import SeasonQualityJob, Content, Episode
    from ..services.series_publish_gate import can_go_live, refresh_completeness
    from ..services.coin_pricing import apply_band_to_unpublished_episodes
    from ..services.episode_access import free_episode_count_for

    job = SeasonQualityJob.query.get_or_404(job_id)
    series = Content.query.get_or_404(job.content_id)
    decision = (request.form.get('decision') or '').strip()
    note = (request.form.get('note') or '').strip()
    job.founder_note = note
    job.decided_by = current_user.wiam_id or current_user.id
    job.decided_at = _dt.utcnow()

    if decision == 'changes_required':
        import json as _json
        from ..models import SeasonAssetQualityReport
        from ..services.season_sla_auto import unpublish_whole_series
        # Whole unit offline — never EP1 live while EP2 is rejected
        unpublish_whole_series(series)
        job.founder_decision = 'changes_required'
        job.status = 'needs_changes'
        series.season_qc_status = 'needs_changes'
        series.review_status = 'revision_requested'
        # Build structured change items for creator Needs-Changes screen
        assets = (
            SeasonAssetQualityReport.query.filter_by(job_id=job.id)
            .order_by(SeasonAssetQualityReport.id.asc())
            .all()
        )
        items = []
        for a in assets:
            if (a.status or '') not in ('failed', 'borderline') and not (a.failure_reasons or '').strip():
                continue
            kind = (a.asset_kind or 'episode').lower()
            tag = kind.upper()
            if kind == 'episode' and a.episode_number:
                title = f'Episode {a.episode_number} needs a fix'
                fix = 'episodes'
            elif kind == 'trailer':
                title = 'Trailer needs a fix'
                fix = 'trailer'
            elif kind == 'cover':
                title = 'Cover / poster needs a fix'
                fix = 'cover'
            elif kind == 'banner':
                title = 'Banner needs a fix'
                fix = 'cover'
            else:
                title = f'{kind} needs a fix'
                fix = 'episodes'
            items.append({
                'tag': tag,
                'title': title,
                'text': (a.failure_reasons or note or 'Re-export and re-upload this asset.').strip(),
                'fix_target': fix,
                'episode_id': a.episode_id,
                'episode_number': a.episode_number,
                'band': a.band,
            })
        team_intro = (
            'The WiamEpisio team has reviewed your series and flagged problems. '
            'Your whole series/season stays offline — no episode is live until everything is fixed. '
            'Open each item, fix that file, then resubmit.'
        )
        if note:
            items.insert(0, {
                'tag': 'TEAM',
                'title': 'A note from the WiamEpisio team',
                'text': note,
                'fix_target': 'episodes',
                'episode_id': None,
                'episode_number': None,
            })
        items.insert(0, {
            'tag': 'TEAM',
            'title': 'The WiamEpisio team reviewed your series',
            'text': team_intro,
            'fix_target': 'episodes',
        })
        if len(items) <= 2 and not any(a for a in assets if (a.status or '') in ('failed', 'borderline')):
            items.append({
                'tag': 'REVIEW',
                'title': 'Changes required before going live',
                'text': note or (job.failure_reasons or 'Please fix the quality issues and resubmit.'),
                'fix_target': 'episodes',
            })
        series.review_change_items = _json.dumps(items)
        db.session.commit()
        flash('Needs Changes — whole series unpublished; creator sees fix list.', 'success')
        return redirect(url_for('founder_dash.episio_quality_job', job_id=job.id))

    if decision != 'publish':
        flash('Unknown decision.', 'error')
        return redirect(url_for('founder_dash.episio_quality_job', job_id=job.id))

    refresh_completeness(series)
    ok, reason, _details = can_go_live(series)
    if not ok:
        flash('Cannot publish yet: %s' % reason, 'error')
        return redirect(url_for('founder_dash.episio_quality_job', job_id=job.id))
    if (series.season_qc_status or '') == 'failed':
        flash('Season QC failed — request changes instead of publishing.', 'error')
        return redirect(url_for('founder_dash.episio_quality_job', job_id=job.id))

    apply_band_to_unpublished_episodes(series)
    series.status = 'published'
    series.review_status = 'approved'
    series.season_qc_status = 'passed'
    if not series.published_at:
        series.published_at = _dt.utcnow()
    now = _dt.utcnow()
    publish_all = request.form.get('publish_all') == '1'
    for ep in Episode.query.filter_by(content_id=series.id).order_by(Episode.episode_number.asc()).all():
        if publish_all or ep.episode_number <= free_episode_count_for(series):
            ep.published = True
            if not ep.publish_at:
                ep.publish_at = now
    job.founder_decision = 'approved'
    job.status = 'passed'
    db.session.commit()
    flash('Published "%s" — WiamEpisio (platform) publish complete.' % (series.title or series.id), 'success')
    return redirect(url_for('founder_dash.episio_quality'))


# ---------------------------------------------------------------------------
# WiamEpisio founder control pages (watchers + creators + catalog)
# ---------------------------------------------------------------------------
from .founder_episio_pages import register_episio_founder_pages
register_episio_founder_pages(founder_bp, founder_required)
