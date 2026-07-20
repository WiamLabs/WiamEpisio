"""WiamElite routes — V2 Ultra-Hard Hall of Fame."""
import logging
import requests as http_requests
from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, current_app
from flask_login import login_required, current_user
from datetime import datetime, timedelta

from ..extensions import db
from ..models import (
    Favorite, EliteStory, EliteSubscription, EliteReadLog,
    Content, Review, User, WebBookContent, Rating, Follow,
)

log = logging.getLogger(__name__)
from ..services.elite import (
    get_elite_stories, get_elite_leaderboard, has_elite_subscription,
    creator_has_verified_badge, THRESHOLDS, SUSTAINED_MONTHS_REQUIRED,
    ELITE_COIN_MULTIPLIER, ELITE_REVENUE_PCT,
)

elite_bp = Blueprint('elite', __name__, url_prefix='/elite')


# ── Feature Lock Gate ─────────────────────────────────────────────────

@elite_bp.before_request
def elite_lock_gate():
    """Block access if founder has locked WiamElite."""
    # Allow callbacks to work even when locked
    if request.endpoint and 'callback' in (request.endpoint or ''):
        return None
    # Founders always bypass
    if current_user.is_authenticated and getattr(current_user, 'is_founder', False):
        return None
    from ..extensions import is_feature_locked
    if is_feature_locked('feature_elite'):
        return render_template('feature_locked.html',
            feature_name='WiamElite',
            feature_icon='✦',
            feature_description='WiamElite is the ultra-exclusive Hall of Fame for the best stories on WiamApp. This feature is not available right now — check back soon!'
        )


@elite_bp.route('/')
@login_required
def elite_page():
    """The WiamElite showcase page — V2 with reading, reviews, leaderboard."""
    uid = current_user.wiam_id
    elite_data = get_elite_stories(limit=50)
    fav_ids = {f.content_id for f in Favorite.query.filter_by(user_id=uid).all()}
    is_subscribed = has_elite_subscription(uid)

    # Top reviews for elite books (best comments from readers)
    elite_reviews = []
    for item in elite_data[:10]:
        reviews = Review.query.filter_by(content_id=item['story'].id).order_by(
            Review.created_at.desc()
        ).limit(2).all()
        for r in reviews:
            reviewer = User.query.filter_by(wiam_id=r.user_id).first()
            elite_reviews.append({
                'review': r,
                'story': item['story'],
                'reviewer': reviewer,
            })

    # Group elite creators (unique)
    creators = {}
    for item in elite_data:
        creator = item['story'].creator
        if creator and creator.wiam_id not in creators:
            cp = creator.creator_profile
            creators[creator.wiam_id] = {
                'user': creator,
                'profile': cp,
                'elite_count': 0,
                'has_badge': creator_has_verified_badge(creator.wiam_id),
            }
        if creator:
            creators[creator.wiam_id]['elite_count'] += 1

    # ── Elite by Genre (group elite stories by genre) ──
    elite_by_genre = {}
    for item in elite_data:
        genre = item['story'].genre or 'Other'
        if genre not in elite_by_genre:
            elite_by_genre[genre] = []
        if len(elite_by_genre[genre]) < 10:
            elite_by_genre[genre].append(item)
    # Keep only genres with 2+ stories
    elite_by_genre = {g: books for g, books in elite_by_genre.items() if len(books) >= 2}

    # ── Curated for You (based on user's reading history genres) ──
    from ..models import ReadingProgress, Access
    elite_ids_set = {item['story'].id for item in elite_data}
    curated_for_you = []
    read_ids = set()
    owned_ids = set()
    user_genres = set()

    progresses = ReadingProgress.query.filter_by(user_id=uid).all()
    read_ids = {p.content_id for p in progresses}
    owned_ids = {a.content_id for a in Access.query.filter_by(user_id=uid, status='active').all()}
    for cid in (read_ids | owned_ids | fav_ids):
        b = Content.query.filter_by(id=cid).first()
        if b and b.genre:
            user_genres.add(b.genre)
    if user_genres:
        curated_for_you = [
            item for item in elite_data
            if item['story'].genre in user_genres
            and item['story'].id not in (read_ids | fav_ids)
        ][:10]

    # ── Because You Read [title] ──
    because_you_read_elite = []
    byr_elite_book = None
    if progresses:
        # Find most recently read book
        latest_progress = max(progresses, key=lambda p: p.last_read_at or datetime.min)
        byr_elite_book = Content.query.filter(
            Content.id == latest_progress.content_id,
            Content.deleted_at == None,
        ).first()
        if byr_elite_book and byr_elite_book.genre:
            because_you_read_elite = [
                item for item in elite_data
                if item['story'].genre == byr_elite_book.genre
                and item['story'].id != byr_elite_book.id
            ][:8]

    # ── Because You Love [genre] ──
    because_you_love_elite = []
    byl_elite_genre = None
    if user_genres:
        from collections import Counter
        genre_counts = Counter()
        for cid in (read_ids | owned_ids | fav_ids):
            b = Content.query.filter_by(id=cid).first()
            if b and b.genre:
                genre_counts[b.genre] += 1
        if genre_counts:
            byl_elite_genre = genre_counts.most_common(1)[0][0]
            because_you_love_elite = [
                item for item in elite_data
                if item['story'].genre == byl_elite_genre
            ][:8]

    return render_template(
        'elite.html',
        elite_data=elite_data,
        elite_creators=list(creators.values()),
        elite_reviews=elite_reviews[:10],
        fav_ids=fav_ids,
        total_elite=len(elite_data),
        is_subscribed=is_subscribed,
        thresholds=THRESHOLDS,
        sustained_months=SUSTAINED_MONTHS_REQUIRED,
        elite_by_genre=elite_by_genre,
        curated_for_you=curated_for_you,
        because_you_read_elite=because_you_read_elite,
        byr_elite_book=byr_elite_book,
        because_you_love_elite=because_you_love_elite,
        byl_elite_genre=byl_elite_genre,
    )


@elite_bp.route('/book/<int:book_id>')
@login_required
def elite_book_detail(book_id):
    """Detailed view of an Elite book with chapters and reading access."""
    uid = current_user.wiam_id
    elite = EliteStory.query.filter_by(content_id=book_id, is_active=True).first()
    if not elite:
        flash('This story is not currently in WiamElite.', 'info')
        return redirect(url_for('elite.elite_page'))

    story = Content.query.get_or_404(book_id)
    is_subscribed = has_elite_subscription(uid)
    is_fav = Favorite.query.filter_by(user_id=uid, content_id=book_id).first() is not None

    # Chapters
    chapters = WebBookContent.query.filter_by(
        content_id=book_id, status='published'
    ).order_by(WebBookContent.chapter_number).all()

    # Reviews
    reviews = Review.query.filter_by(content_id=book_id).order_by(
        Review.created_at.desc()
    ).limit(20).all()
    review_users = {}
    for r in reviews:
        if r.user_id not in review_users:
            review_users[r.user_id] = User.query.filter_by(wiam_id=r.user_id).first()

    # Ratings
    avg_rating = elite.avg_rating
    total_ratings = elite.total_ratings

    # Creator info
    creator = story.creator
    has_badge = creator_has_verified_badge(creator.wiam_id) if creator else False

    return render_template(
        'elite_book.html',
        story=story,
        elite=elite,
        chapters=chapters,
        reviews=reviews,
        review_users=review_users,
        avg_rating=avg_rating,
        total_ratings=total_ratings,
        creator=creator,
        has_badge=has_badge,
        is_subscribed=is_subscribed,
        is_fav=is_fav,
        coin_multiplier=ELITE_COIN_MULTIPLIER,
    )


@elite_bp.route('/celebrate/<int:content_id>')
@login_required
def celebration_card(content_id):
    """Shareable celebration card for a WiamElite achievement."""
    elite = EliteStory.query.filter_by(content_id=content_id).first()
    if not elite:
        abort(404)

    story = Content.query.get_or_404(content_id)
    creator = story.creator

    return render_template(
        'elite_celebrate.html',
        story=story,
        elite=elite,
        creator=creator,
        coin_multiplier=ELITE_COIN_MULTIPLIER,
        revenue_pct=int(ELITE_REVENUE_PCT * 100),
        badge_duration='1 Year',
    )


@elite_bp.route('/subscribe')
@login_required
def subscribe_page():
    """WiamElite subscription page."""
    uid = current_user.wiam_id
    is_subscribed = has_elite_subscription(uid)
    current_sub = EliteSubscription.query.filter_by(
        user_id=uid, status='active'
    ).first()
    if not current_sub:
        # Also show cancelled sub still within grace period
        current_sub = EliteSubscription.query.filter_by(
            user_id=uid, status='cancelled'
        ).order_by(EliteSubscription.id.desc()).first()
        if current_sub and not current_sub.is_valid:
            current_sub = None

    from ..models import PlatformConfig
    cfg = PlatformConfig.get()

    return render_template(
        'elite_subscribe.html',
        is_subscribed=is_subscribed,
        current_sub=current_sub,
        price_ghs=cfg.elite_price_ghs,
        elite_count=EliteStory.query.filter_by(is_active=True).count(),
    )


@elite_bp.route('/subscribe/activate', methods=['POST'])
@login_required
def subscribe_activate():
    """Initialize Paystack transaction for WiamElite subscription."""
    uid = current_user.wiam_id

    # Check for existing active subscription
    existing = EliteSubscription.query.filter_by(user_id=uid, status='active').first()
    if existing and existing.is_valid:
        flash('You already have an active WiamElite subscription.', 'info')
        return redirect(url_for('elite.elite_page'))

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    plan_code = current_app.config.get('PAYSTACK_ELITE_PLAN_CODE', '')
    if not secret or not plan_code:
        log.error("Paystack keys or plan code not configured for Elite subscription")
        flash('Subscription system not configured. Please contact support.', 'error')
        return redirect(url_for('elite.subscribe_page'))

    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    amount_pesewas = int(cfg.elite_price_ghs * 100)

    email = current_user.email or f'user{uid}@wiamapp.com'

    payload = {
        'email': email,
        'amount': amount_pesewas,
        'currency': 'GHS',
        'plan': plan_code,
        'callback_url': url_for('elite.subscribe_callback', _external=True),
        'metadata': {
            'user_id': uid,
            'type': 'elite_subscription',
            'custom_fields': [
                {'display_name': 'User', 'variable_name': 'user_id', 'value': str(uid)},
                {'display_name': 'Plan', 'variable_name': 'plan', 'value': 'WiamElite Monthly'},
            ],
        },
    }

    try:
        resp = http_requests.post(
            'https://api.paystack.co/transaction/initialize',
            json=payload,
            headers={
                'Authorization': f'Bearer {secret}',
                'Content-Type': 'application/json',
            },
            timeout=15,
        )
        data = resp.json()
        if data.get('status') and data.get('data', {}).get('authorization_url'):
            log.info("Elite sub initialized for user %s, ref=%s", uid,
                     data['data'].get('reference', '?'))
            return redirect(data['data']['authorization_url'])
        else:
            log.error("Paystack elite init failed: %s", data.get('message'))
            flash('Could not start subscription. Please try again.', 'error')
            return redirect(url_for('elite.subscribe_page'))
    except Exception as e:
        log.error("Paystack elite init error: %s", e)
        flash('Payment service unavailable. Please try again later.', 'error')
        return redirect(url_for('elite.subscribe_page'))


@elite_bp.route('/subscribe/callback')
@login_required
def subscribe_callback():
    """Paystack redirects here after Elite subscription payment.
    The webhook handles actual subscription activation — this is just UX."""
    reference = request.args.get('reference', '')
    uid = current_user.wiam_id

    if not reference:
        flash('Invalid payment reference.', 'error')
        return redirect(url_for('elite.subscribe_page'))

    # Check if webhook already activated it
    existing = EliteSubscription.query.filter_by(
        paystack_reference=reference
    ).first()
    if existing:
        flash('WiamElite subscription activated! Enjoy unlimited Elite stories.', 'success')
        return redirect(url_for('elite.elite_page'))

    # Verify with Paystack
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    try:
        resp = http_requests.get(
            f'https://api.paystack.co/transaction/verify/{reference}',
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        payload = resp.json()
        tx_data = payload.get('data', {})

        if not (payload.get('status') and tx_data.get('status') == 'success'):
            flash('Payment was not completed. Please try again.', 'error')
            return redirect(url_for('elite.subscribe_page'))

        # Payment succeeded — create subscription as backup (webhook should do this)
        meta = tx_data.get('metadata', {})
        if meta.get('type') != 'elite_subscription':
            flash('Payment received but type mismatch. Contact support with ref: ' + reference, 'error')
            return redirect(url_for('elite.subscribe_page'))

        # Double-check idempotency
        existing = EliteSubscription.query.filter_by(
            paystack_reference=reference
        ).first()
        if existing:
            flash('WiamElite subscription activated! Enjoy unlimited Elite stories.', 'success')
            return redirect(url_for('elite.elite_page'))

        # Create subscription record (backup if webhook hasn't fired yet)
        now = datetime.utcnow()
        sub = EliteSubscription(
            user_id=uid,
            plan='monthly',
            amount_ghs=tx_data.get('amount', 2500) / 100,
            status='active',
            paystack_reference=reference,
            started_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.session.add(sub)
        db.session.commit()
        log.info("Elite sub callback: created sub for user %s ref=%s", uid, reference)

        flash('WiamElite subscription activated! Enjoy unlimited Elite stories.', 'success')
        return redirect(url_for('elite.elite_page'))

    except Exception as e:
        log.error("Elite sub callback verify error: %s", e)
        flash('Could not verify payment. If you were charged, your subscription will activate shortly.', 'info')
        return redirect(url_for('elite.elite_page'))


@elite_bp.route('/subscribe/cancel', methods=['POST'])
@login_required
def subscribe_cancel():
    """Cancel WiamElite subscription via Paystack API."""
    uid = current_user.wiam_id
    sub = EliteSubscription.query.filter_by(user_id=uid, status='active').first()
    if not sub:
        flash('No active subscription found.', 'info')
        return redirect(url_for('elite.subscribe_page'))

    # Cancel on Paystack if we have a subscription code
    if sub.paystack_sub_code:
        secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
        try:
            resp = http_requests.post(
                'https://api.paystack.co/subscription/disable',
                json={
                    'code': sub.paystack_sub_code,
                    'token': sub.paystack_email_token or '',
                },
                headers={
                    'Authorization': f'Bearer {secret}',
                    'Content-Type': 'application/json',
                },
                timeout=15,
            )
            result = resp.json()
            log.info("Paystack cancel sub %s: %s", sub.paystack_sub_code,
                     result.get('message', '?'))
        except Exception as e:
            log.error("Paystack cancel error for sub %s: %s", sub.paystack_sub_code, e)

    sub.status = 'cancelled'
    sub.cancelled_at = datetime.utcnow()
    db.session.commit()
    flash('WiamElite subscription cancelled. You retain access until your current period ends.', 'info')
    return redirect(url_for('elite.subscribe_page'))
