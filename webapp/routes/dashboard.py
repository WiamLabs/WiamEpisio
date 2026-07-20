"""Unified User Dashboard — single dashboard for readers and creators."""
import logging
from datetime import datetime, date, timedelta

from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app, jsonify
from flask_login import login_required, current_user

from ..extensions import db, csrf
from ..models import (
    User, Content, Access, Order, Rating, Follow, Review,
    CreatorProfile, ReadingStreak, ReadingProgress, CoinBalance,
    WebBookContent, MonetizationStatus, CreatorEarnings, CreatorPayout,
    CreatorPayoutSettings, CreatorWithdrawal, CoinTransaction,
)

log = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')


# ---------------------------------------------------------------------------
# Main dashboard — single route, tab-based
# ---------------------------------------------------------------------------

@dashboard_bp.route('/')
@login_required
def index():
    """Unified dashboard — all sections loaded based on active tab."""
    tab = request.args.get('tab', 'overview')
    uid = current_user.wiam_id

    # ── Common data (always needed) ──────────────────────────────────────
    creator_profile = CreatorProfile.query.filter_by(wiam_id=uid).first()
    coin_balance = CoinBalance.query.filter_by(user_id=uid).first()
    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID', '')

    # ── Overview tab ─────────────────────────────────────────────────────
    books_read = Access.query.filter_by(user_id=uid, status='active').count()
    ratings_given = Rating.query.filter_by(user_id=uid).count()
    reviews_written = Review.query.filter_by(user_id=uid).count()
    following_count = Follow.query.filter_by(user_id=current_user.id).count()

    # Reading streak — single query instead of per-day loop
    today = date.today()
    streak_dates = set(
        r.date for r in ReadingStreak.query.filter(
            ReadingStreak.user_id == uid,
            ReadingStreak.date >= today - timedelta(days=365),
        ).all()
    )
    streak = 0
    d = today
    while d in streak_dates:
        streak += 1
        d -= timedelta(days=1)
    total_reading_days = len(streak_dates)

    # ── Library tab ──────────────────────────────────────────────────────
    library_books = []
    progress_map = {}
    if tab in ('overview', 'library'):
        access_list = Access.query.filter_by(user_id=uid, status='active').all()
        content_ids = [a.content_id for a in access_list]
        if content_ids:
            library_books = Content.query.filter(Content.id.in_(content_ids)).all()
            progs = ReadingProgress.query.filter(
                ReadingProgress.user_id == uid,
                ReadingProgress.content_id.in_(content_ids),
            ).all()
            progress_map = {p.content_id: p for p in progs}

    # ── Creator data (only if creator) ───────────────────────────────────
    creator_data = {}
    if current_user.is_creator:
        my_books = Content.query.filter(
            Content.creator_wiam_id == uid,
            Content.deleted_at == None
        ).order_by(Content.created_at.desc()).all()

        total_books = len(my_books)
        published_count = sum(1 for b in my_books if b.is_published)
        draft_count = sum(1 for b in my_books if b.status == 'draft')
        total_views = sum(b.views or 0 for b in my_books)

        book_ids = [b.id for b in my_books]

        # Chapter counts per book — single grouped query instead of per-book loop
        chapter_counts = {}
        if book_ids:
            from sqlalchemy import func as _fn
            ch_rows = db.session.query(
                WebBookContent.content_id, _fn.count(WebBookContent.id)
            ).filter(
                WebBookContent.content_id.in_(book_ids)
            ).group_by(WebBookContent.content_id).all()
            chapter_counts = {cid: cnt for cid, cnt in ch_rows}

        # Orders
        pending_orders = 0
        total_sales = 0
        orders = []
        if book_ids:
            pending_orders = Order.query.filter(
                Order.content_id.in_(book_ids),
                Order.status == 'pending_review'
            ).count()
            total_sales = Order.query.filter(
                Order.content_id.in_(book_ids),
                Order.status == 'approved'
            ).count()
            orders = db.session.query(Order, Content, User).join(
                Content, Order.content_id == Content.id
            ).join(
                User, Order.user_id == User.wiam_id
            ).filter(Order.content_id.in_(book_ids)).order_by(Order.id.desc()).limit(50).all()

        # Followers
        follower_count = Follow.query.filter_by(creator_id=current_user.id).count()
        follows = Follow.query.filter_by(creator_id=current_user.id).order_by(Follow.created_at.desc()).all()
        follower_ids = [f.user_id for f in follows]
        follower_users = User.query.filter(User.id.in_(follower_ids)).all() if follower_ids else []
        follower_map = {u.id: u for u in follower_users}


        # Earnings
        now = datetime.utcnow()
        mon_status = MonetizationStatus.query.get(uid)
        current_earn = CreatorEarnings.query.filter_by(
            creator_id=uid, year=now.year, month=now.month
        ).first()
        all_earnings = CreatorEarnings.query.filter_by(creator_id=uid).order_by(
            CreatorEarnings.year.desc(), CreatorEarnings.month.desc()
        ).all()
        total_coins_earned = sum(e.total_coins for e in all_earnings)
        total_ghs_earned = sum(e.creator_share_ghs for e in all_earnings)
        payouts = CreatorPayout.query.filter_by(creator_id=uid).order_by(
            CreatorPayout.created_at.desc()
        ).limit(12).all()
        payout_settings = CreatorPayoutSettings.query.get(uid)

        # ── Wallet balance calculations ──
        total_paid_out = sum(p.amount_ghs for p in CreatorPayout.query.filter_by(
            creator_id=uid).filter(CreatorPayout.status.in_(['sent', 'processing'])).all())
        total_withdrawn = sum(w.amount_ghs for w in CreatorWithdrawal.query.filter_by(
            creator_id=uid).filter(CreatorWithdrawal.status.in_(['sent', 'processing', 'pending'])).all())
        pending_ghs = sum(e.creator_share_ghs for e in all_earnings if not e.is_paid and
                          (datetime.utcnow() - datetime(e.year, e.month, 1)).days < 7)
        cleared_ghs = total_ghs_earned - pending_ghs
        available_ghs = max(0, cleared_ghs - total_paid_out - total_withdrawn)

        # ── Today's earnings ──
        today_start = datetime(now.year, now.month, now.day)
        today_coins = 0
        try:
            from sqlalchemy import func as _fn
            today_coins = db.session.query(
                _fn.coalesce(_fn.sum(CoinTransaction.amount * -1), 0)
            ).filter(
                CoinTransaction.recipient_id == uid,
                CoinTransaction.type.in_(['unlock', 'tip']),
                CoinTransaction.created_at >= today_start,
            ).scalar() or 0
        except Exception:
            pass
        from ..services.monetization import COIN_TO_GHS
        today_ghs = today_coins * COIN_TO_GHS * 0.5

        # ── Transaction history (last 50 reader payments to this creator) ──
        creator_transactions = []
        try:
            tx_rows = db.session.query(CoinTransaction, Content).outerjoin(
                Content, CoinTransaction.content_id == Content.id
            ).filter(
                CoinTransaction.recipient_id == uid,
                CoinTransaction.type.in_(['unlock', 'tip']),
            ).order_by(CoinTransaction.created_at.desc()).limit(50).all()
            creator_transactions = tx_rows
        except Exception as e:
            log.error("Dashboard tx history error: %s", e)

        # ── Per-story earnings (coins earned per story) ──
        per_story_earnings = []
        try:
            from sqlalchemy import func as _fn2
            story_earn_rows = db.session.query(
                Content.id, Content.title,
                _fn2.coalesce(_fn2.sum(CoinTransaction.amount * -1), 0).label('total_coins')
            ).join(
                CoinTransaction, CoinTransaction.content_id == Content.id
            ).filter(
                CoinTransaction.recipient_id == uid,
                CoinTransaction.type.in_(['unlock', 'tip']),
            ).group_by(Content.id, Content.title).order_by(
                _fn2.sum(CoinTransaction.amount * -1).desc()
            ).limit(20).all()
            per_story_earnings = [{'id': r[0], 'title': r[1], 'coins': int(r[2]),
                                   'ghs': round(int(r[2]) * COIN_TO_GHS * 0.5, 2)} for r in story_earn_rows]
        except Exception as e:
            log.error("Dashboard per-story earnings error: %s", e)

        # ── Min payout from config ──
        try:
            from ..models import PlatformConfig
            _cfg = PlatformConfig.get()
            min_payout_ghs = _cfg.min_payout_ghs
        except Exception:
            min_payout_ghs = 15.0

        # ── Eligibility tracker data ─────────────────────────────────────
        elig = None
        try:
            from ..services.monetization import ELIGIBILITY_REQUIREMENTS
            from sqlalchemy import func as sa_func

            reqs = ELIGIBILITY_REQUIREMENTS
            now_e = datetime.utcnow()
            account_age = (now_e - current_user.date_joined).days if current_user.date_joined else 0

            published = [b for b in my_books if b.is_published]
            pub_ids = [b.id for b in published]

            max_chapters = 0
            for bid in pub_ids:
                cc = WebBookContent.query.filter_by(content_id=bid).count()
                if cc > max_chapters:
                    max_chapters = cc

            total_readers = 0
            if pub_ids:
                total_readers = db.session.query(
                    sa_func.count(sa_func.distinct(ReadingProgress.user_id))
                ).filter(ReadingProgress.content_id.in_(pub_ids)).scalar() or 0

            avg_rating = 0.0
            rating_count_e = 0
            if pub_ids:
                agg = db.session.query(sa_func.avg(Rating.rating), sa_func.count(Rating.id)).filter(
                    Rating.content_id.in_(pub_ids)
                ).first()
                avg_rating = round(float(agg[0] or 0), 1)
                rating_count_e = int(agg[1] or 0)

            violations_60d = 0
            try:
                from ..models import UserWarning
                violations_60d = UserWarning.query.filter(
                    UserWarning.user_id == current_user.id,
                    UserWarning.severity.in_(['warning', 'strike']),
                    UserWarning.created_at >= now_e - timedelta(days=60),
                ).count()
            except Exception:
                pass

            trust_score = 50
            try:
                from ..services.trust_engine import compute_reader_trust
                trust_score = int(compute_reader_trust(current_user.id, save=False) * 100)
            except Exception:
                trust_score = min(100, 50 + (len(published) * 5) + (follower_count // 10))

            elig = {
                'account_age':   {'val': account_age,       'req': reqs['min_account_age_days'],  'label': 'Account Age',       'unit': 'days'},
                'stories':       {'val': len(published),    'req': reqs['min_published_stories'], 'label': 'Published Stories', 'unit': ''},
                'chapters':      {'val': max_chapters,      'req': reqs['min_chapters_in_story'], 'label': 'Chapters (best story)', 'unit': ''},
                'readers':       {'val': total_readers,     'req': reqs['min_unique_readers'],     'label': 'Unique Readers',    'unit': ''},
                'followers':     {'val': follower_count,    'req': reqs['min_followers'],          'label': 'Followers',         'unit': ''},
                'rating_count':  {'val': rating_count_e,    'req': reqs['min_rating_count'],       'label': 'Ratings',           'unit': ''},
                'avg_rating':    {'val': avg_rating,        'req': reqs['min_avg_rating'],         'label': 'Avg Rating',        'unit': '\u2605'},
                'violations':    {'val': violations_60d,    'req': reqs['max_violations_60d'],     'label': 'Violations (60d)',  'unit': '', 'inverse': True},
                'trust':         {'val': trust_score,       'req': reqs['min_trust_score'],        'label': 'Trust Score',       'unit': ''},
            }
        except Exception as e:
            log.error("Dashboard eligibility error: %s", e, exc_info=True)
            try:
                from ..services.monetization import ELIGIBILITY_REQUIREMENTS as _ER
                elig = {k: {'val': 0, 'req': v, 'label': k.replace('_', ' ').title(), 'unit': ''} for k, v in _ER.items()}
            except Exception:
                elig = None

        # ── Creator Subscriptions tab ─────────────────────────────────────
        csub_tiers = []
        csub_subscribers = []
        csub_earnings_total = 0.0
        csub_earnings_pending = 0.0
        csub_subscriber_count = 0
        csub_eligible = False
        csub_reason = ''
        csub_progress = {'eligible': False, 'checks': []}
        try:
            from ..services.creator_sub_service import (
                get_creator_tiers, get_subscriber_count,
                is_creator_eligible_for_subs, get_creator_eligibility_progress,
            )
            from ..models import CreatorSubscription, CreatorSubEarning
            csub_eligible, csub_reason = is_creator_eligible_for_subs(current_user)
            csub_progress = get_creator_eligibility_progress(current_user)
            csub_tiers = get_creator_tiers(uid, active_only=False)
            csub_subscriber_count = get_subscriber_count(uid)

            # Recent subscribers
            _subs = CreatorSubscription.query.filter_by(
                creator_id=uid
            ).filter(
                CreatorSubscription.status.in_(['active', 'paused'])
            ).order_by(CreatorSubscription.started_at.desc()).limit(50).all()
            for _s in _subs:
                _su = User.query.get(_s.subscriber_id)
                csub_subscribers.append({
                    'sub': _s,
                    'user': _su,
                    'tier': _s.tier,
                })

            # Earnings summary
            from sqlalchemy import func as _csf
            csub_earnings_total = db.session.query(
                _csf.coalesce(_csf.sum(CreatorSubEarning.creator_share_ghs), 0)
            ).filter_by(creator_id=uid).scalar() or 0
            csub_earnings_pending = db.session.query(
                _csf.coalesce(_csf.sum(CreatorSubEarning.creator_share_ghs), 0)
            ).filter_by(creator_id=uid, status='pending').scalar() or 0
        except Exception as e:
            log.warning("Dashboard creator sub data error: %s", str(e)[:120])

        creator_data = {
            'my_books': my_books,
            'total_books': total_books,
            'published_count': published_count,
            'draft_count': draft_count,
            'total_views': total_views,
            'chapter_counts': chapter_counts,
            'pending_orders': pending_orders,
            'total_sales': total_sales,
            'orders': orders,
            'follower_count': follower_count,
            'follows': follows,
            'follower_map': follower_map,
            'mon_status': mon_status,
            'current_earn': current_earn,
            'all_earnings': all_earnings,
            'total_coins_earned': total_coins_earned,
            'total_ghs_earned': total_ghs_earned,
            'payouts': payouts,
            'payout_settings': payout_settings,
            'elig': elig,
            # Wallet & enhanced earnings
            'available_ghs': available_ghs,
            'pending_ghs': pending_ghs,
            'cleared_ghs': cleared_ghs,
            'total_paid_out': total_paid_out,
            'today_coins': today_coins,
            'today_ghs': today_ghs,
            'creator_transactions': creator_transactions,
            'per_story_earnings': per_story_earnings,
            'min_payout_ghs': min_payout_ghs,
            # Creator subscriptions
            'csub_tiers': csub_tiers,
            'csub_subscribers': csub_subscribers,
            'csub_earnings_total': csub_earnings_total,
            'csub_earnings_pending': csub_earnings_pending,
            'csub_subscriber_count': csub_subscriber_count,
            'csub_eligible': csub_eligible,
            'csub_reason': csub_reason,
            'csub_progress': csub_progress,
        }

    return render_template('dashboard.html',
        tab=tab,
        creator_profile=creator_profile,
        coin_balance=coin_balance,
        google_client_id=google_client_id,
        # Overview
        books_read=books_read,
        ratings_given=ratings_given,
        reviews_written=reviews_written,
        following_count=following_count,
        streak=streak,
        total_reading_days=total_reading_days,
        # Library
        library_books=library_books,
        progress_map=progress_map,
        # Creator
        **creator_data,
    )


# ---------------------------------------------------------------------------
# Form actions (POST routes)
# ---------------------------------------------------------------------------

@dashboard_bp.route('/edit-profile', methods=['POST'])
@login_required
def edit_profile():
    """Update user profile info."""
    import re
    
    # Check if this is the identity/preferences form
    if request.form.get('identity_form'):
        pronouns = request.form.get('pronouns', '').strip()
        region = request.form.get('account_region', '').strip()
        dob = request.form.get('date_of_birth', '').strip()
        dob_visible = request.form.get('dob_visible') == 'on'
        show_pronouns = request.form.get('show_pronouns') == 'on'
        
        current_user.pronouns = pronouns if pronouns else None
        current_user.show_pronouns = show_pronouns
        current_user.account_region = region if region else None
        current_user.dob_visible = dob_visible
        if dob:
            try:
                current_user.date_of_birth = datetime.strptime(dob, '%Y-%m-%d').date()
            except ValueError:
                pass
        
        db.session.commit()
        flash('Preferences updated!', 'success')
        return redirect(url_for('dashboard.index', tab='profile'))
    
    # Basic profile form
    first_name = request.form.get('first_name', '').strip()
    last_name = request.form.get('last_name', '').strip()
    bio = request.form.get('bio', '').strip()
    username = request.form.get('username', '').strip().lower()

    if first_name:
        current_user.first_name = first_name
    current_user.last_name = last_name
    current_user.bio = bio[:500] if bio else current_user.bio

    # Username validation and update
    if username:
        username = re.sub(r'[^a-z0-9_]', '', username)[:30]
        if len(username) >= 3:
            # Check if username is taken by someone else
            existing = User.query.filter(
                db.func.lower(User.username) == username,
                User.id != current_user.id
            ).first()
            if existing:
                flash(f'Username @{username} is already taken.', 'error')
                return redirect(url_for('dashboard.index', tab='profile'))
            current_user.username = username

    # Creator profile fields
    if current_user.is_creator:
        uid = current_user.wiam_id
        cp = CreatorProfile.query.filter_by(wiam_id=uid).first()
        pen_name = request.form.get('pen_name', '').strip()
        country = request.form.get('country', '').strip()
        if cp:
            if pen_name:
                cp.pen_name = pen_name
            cp.bio = bio
            cp.country = country
            cp.updated_at = datetime.utcnow()
        elif pen_name:
            cp = CreatorProfile(wiam_id=uid, pen_name=pen_name, bio=bio, country=country)
            db.session.add(cp)

    db.session.commit()
    flash('Profile updated!', 'success')
    return redirect(url_for('dashboard.index', tab='profile'))


@dashboard_bp.route('/update-account', methods=['POST'])
@login_required
def update_account():
    """Update account settings."""
    phone = request.form.get('phone', '').strip()
    dob = request.form.get('date_of_birth', '').strip()
    dob_visible = request.form.get('dob_visible') == 'on'
    pronouns = request.form.get('pronouns', '').strip()
    region = request.form.get('account_region', '').strip()

    current_user.phone = phone or current_user.phone
    current_user.dob_visible = dob_visible
    current_user.pronouns = pronouns or current_user.pronouns
    current_user.show_pronouns = request.form.get('show_pronouns') == 'on'
    current_user.account_region = region or current_user.account_region
    if dob:
        try:
            current_user.date_of_birth = datetime.strptime(dob, '%Y-%m-%d').date()
        except ValueError:
            pass
    db.session.commit()
    flash('Account info updated.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@dashboard_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change password."""
    current_pw = request.form.get('current_password', '')
    new_pw = request.form.get('new_password', '')
    confirm_pw = request.form.get('confirm_password', '')

    if current_user.password_hash and not current_user.check_password(current_pw):
        flash('Current password is incorrect.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))
    if len(new_pw) < 8:
        flash('New password must be at least 8 characters.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))
    if new_pw != confirm_pw:
        flash('Passwords do not match.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    current_user.set_password(new_pw)
    db.session.commit()
    flash('Password changed successfully.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@dashboard_bp.route('/update-notifications', methods=['POST'])
@login_required
def update_notifications():
    """Update notification preferences."""
    current_user.notif_new_chapter = request.form.get('notif_new_chapter') == 'on'
    current_user.notif_new_follower = request.form.get('notif_new_follower') == 'on'
    current_user.notif_comments = request.form.get('notif_comments') == 'on'
    current_user.notif_likes = request.form.get('notif_likes') == 'on'
    current_user.notif_mentions = request.form.get('notif_mentions') == 'on'
    current_user.notif_announcements = request.form.get('notif_announcements') == 'on'
    current_user.notif_coins = request.form.get('notif_coins') == 'on'
    current_user.notif_elite = request.form.get('notif_elite') == 'on'
    current_user.notif_email = request.form.get('notif_email') == 'on'
    current_user.notif_push = request.form.get('notif_push') == 'on'
    sound = request.form.get('notif_sound', 'chime')
    if sound in ('chime', 'bell', 'drop', 'ping', 'marimba'):
        current_user.notif_sound = sound
    db.session.commit()
    flash('Notification settings saved.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@dashboard_bp.route('/update-privacy', methods=['POST'])
@login_required
def update_privacy():
    """Update privacy settings."""
    current_user.privacy_profile_visible = request.form.get('privacy_profile_visible') == 'on'
    current_user.privacy_show_reading_activity = request.form.get('privacy_show_reading_activity') == 'on'
    current_user.privacy_show_library = request.form.get('privacy_show_library') == 'on'
    current_user.privacy_show_favorites = request.form.get('privacy_show_favorites') == 'on'
    db.session.commit()
    flash('Privacy settings saved.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@dashboard_bp.route('/payout-settings', methods=['POST'])
@login_required
def payout_settings():
    """Update creator payout settings."""
    if not current_user.is_creator:
        flash('Creator access required.', 'error')
        return redirect(url_for('dashboard.index'))

    uid = current_user.wiam_id
    provider = request.form.get('provider', 'MTN').strip()
    account_number = request.form.get('account_number', '').strip()
    account_name = request.form.get('account_name', '').strip()

    if provider not in ('MTN', 'Vodafone', 'AirtelTigo'):
        flash('Invalid provider.', 'error')
        return redirect(url_for('dashboard.index', tab='earnings'))
    if not account_number or len(account_number) < 10:
        flash('Please enter a valid Mobile Money number.', 'error')
        return redirect(url_for('dashboard.index', tab='earnings'))
    if not account_name:
        flash('Please enter the name on the account.', 'error')
        return redirect(url_for('dashboard.index', tab='earnings'))

    settings = CreatorPayoutSettings.query.get(uid)
    if settings:
        settings.provider = provider
        settings.account_number = account_number
        settings.account_name = account_name
        settings.paystack_recipient_code = None
        settings.updated_at = datetime.utcnow()
    else:
        settings = CreatorPayoutSettings(
            creator_id=uid, provider=provider,
            account_number=account_number, account_name=account_name,
        )
        db.session.add(settings)
    db.session.commit()
    flash('Payout settings saved.', 'success')
    return redirect(url_for('dashboard.index', tab='earnings'))


# Withdrawal request route removed — payouts are now fully automatic (YouTube-style)


@dashboard_bp.route('/upload-avatar', methods=['POST'])
@csrf.exempt
@login_required
def upload_avatar():
    """Upload avatar to Cloudinary."""
    import base64
    data = request.form.get('avatar_data', '') or (request.get_json(silent=True) or {}).get('avatar_data', '')
    if not data or ',' not in data:
        return jsonify({'error': 'No image data'}), 400

    header, b64 = data.split(',', 1)
    content_type = 'image/jpeg' if 'jpeg' in header else 'image/png'
    img_bytes = base64.b64decode(b64)

    # Upload to Cloudinary (no DB fallback — saves space)
    from ..services.image_service import upload_avatar as cloud_upload_avatar
    cloud_url = cloud_upload_avatar(img_bytes, current_user.id, content_type)
    if not cloud_url:
        return jsonify({'error': 'Avatar upload failed. Please try again.'}), 500

    current_user.avatar_url = cloud_url
    db.session.commit()
    return jsonify({'url': cloud_url})


@dashboard_bp.route('/send-feedback', methods=['POST'])
@login_required
def send_feedback():
    """Submit feedback."""
    from ..models import Feedback
    msg = request.form.get('message', '').strip()
    category = request.form.get('category', 'general')
    if msg:
        fb = Feedback(
            user_id=current_user.wiam_id,
            user_name=current_user.display_name,
            user_email=current_user.email or '',
            category=category,
            message=msg,
        )
        db.session.add(fb)
        db.session.commit()
        flash('Thank you for your feedback!', 'success')
    else:
        flash('Please write something before submitting.', 'error')
    return redirect(url_for('dashboard.index', tab='overview'))


@dashboard_bp.route('/create-sub-tier', methods=['POST'])
@login_required
def create_sub_tier():
    """Create a new creator subscription tier."""
    if not current_user.is_creator:
        flash('Creator access required.', 'error')
        return redirect(url_for('dashboard.index'))

    name = request.form.get('name', '').strip()
    price_ghs = request.form.get('price_ghs', 0, type=float)
    description = request.form.get('description', '').strip()
    billing_period = request.form.get('billing_period', 'monthly')
    yearly_price_ghs = request.form.get('yearly_price_ghs', None, type=float)

    if not name or price_ghs < 1:
        flash('Please provide a tier name and price (min GHS 1).', 'error')
        return redirect(url_for('dashboard.index', tab='subscriptions'))

    try:
        from ..services.creator_sub_service import create_tier
        perks = {
            'subscriber_posts': 'perk_subscriber_posts' in request.form,
            'badge': 'perk_badge' in request.form,
            'no_ads': 'perk_no_ads' in request.form,
            'author_notes': 'perk_author_notes' in request.form,
            'priority_comments': 'perk_priority_comments' in request.form,
        }
        tier, error = create_tier(
            creator_id=current_user.wiam_id,
            name=name,
            price_ghs=price_ghs,
            description=description,
            billing_period=billing_period,
            yearly_price_ghs=yearly_price_ghs,
            **perks,
        )
        if error:
            flash(error, 'error')
        else:
            flash(f'Tier "{name}" created!', 'success')
    except Exception as e:
        log.error("Create sub tier error: %s", e)
        flash('Failed to create tier.', 'error')

    return redirect(url_for('dashboard.index', tab='subscriptions'))
