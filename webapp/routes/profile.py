"""User profile page."""
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func
from ..extensions import db, csrf
from ..models import User, Content, Access, Favorite, Order, Rating, Follow, Review, CreatorProfile, ReadingStreak

profile_bp = Blueprint('profile', __name__)


def _purge_user_data(user_id, wiam_id):
    """Completely delete ALL user data from every table in the database."""
    import logging
    log = logging.getLogger(__name__)
    from ..models import (
        Notification, PushSubscription, ReadingProgress, ReadingStreak,
        Bookmark, Shelf, ShelfItem, ChapterComment, ChapterCommentLike,
        ChapterLike, ChapterVote, ReviewLike, Review, ShareEvent,
        Favorite, Access, Order, Rating, Follow, WebBookContent,
        Content, CreatorProfile, VerificationCode, ReaderPreferences,
        BulletinPost, BulletinReaction, BulletinFollow, CoinTransaction,
        CoinBalance, Feedback, UserGenrePreference, WebSession,
        FeaturedBook, EliteStory,
    )
    uid = wiam_id

    # Grab the user email before we start deleting
    target_user = User.query.get(user_id)
    user_email = target_user.email if target_user else ''

    try:
        # Notifications & push
        Notification.query.filter_by(user_id=uid).delete()
        PushSubscription.query.filter_by(user_id=uid).delete()

        # Reading data
        ReadingProgress.query.filter_by(user_id=uid).delete()
        ReadingStreak.query.filter_by(user_id=uid).delete()
        ReaderPreferences.query.filter_by(user_id=uid).delete()
        Bookmark.query.filter_by(user_id=uid).delete()

        # Shelves
        user_shelves = Shelf.query.filter_by(user_id=uid).all()
        for s in user_shelves:
            ShelfItem.query.filter_by(shelf_id=s.id).delete()
        Shelf.query.filter_by(user_id=uid).delete()

        # Comments, likes, votes
        ChapterCommentLike.query.filter_by(user_id=uid).delete()
        ChapterComment.query.filter_by(user_id=uid).delete()
        ChapterLike.query.filter_by(user_id=uid).delete()
        ChapterVote.query.filter_by(user_id=uid).delete()

        # Reviews
        user_reviews = Review.query.filter_by(user_id=uid).all()
        for r in user_reviews:
            ReviewLike.query.filter_by(review_id=r.id).delete()
        Review.query.filter_by(user_id=uid).delete()
        ReviewLike.query.filter_by(user_id=uid).delete()

        # Social
        ShareEvent.query.filter_by(user_id=uid).delete()
        Favorite.query.filter_by(user_id=uid).delete()
        Follow.query.filter((Follow.user_id == uid) | (Follow.creator_id == uid)).delete(synchronize_session=False)

        # Library & orders
        Access.query.filter_by(user_id=uid).delete()
        Order.query.filter_by(user_id=uid).delete()
        Rating.query.filter_by(user_id=uid).delete()

        # Feedback
        try:
            Feedback.query.filter_by(user_id=uid).delete()
        except Exception:
            pass

        # Genre preferences
        try:
            UserGenrePreference.query.filter_by(user_id=uid).delete()
        except Exception:
            pass

        # Coins
        try:
            CoinTransaction.query.filter_by(user_id=uid).delete()
            CoinBalance.query.filter_by(user_id=uid).delete()
        except Exception:
            pass

        # Bulletin
        try:
            BulletinReaction.query.filter_by(user_id=uid).delete()
            BulletinFollow.query.filter_by(user_id=uid).delete()
            BulletinPost.query.filter_by(creator_id=uid).delete()
        except Exception:
            pass

        # Web sessions
        try:
            WebSession.query.filter_by(wiam_id=uid).delete()
        except Exception:
            pass

        # Verification codes
        if user_email:
            VerificationCode.query.filter_by(email=user_email).delete()

        # Creator content (books + chapters + associated data)
        creator_books = Content.query.filter_by(creator_wiam_id=uid).all()
        for book in creator_books:
            WebBookContent.query.filter_by(content_id=book.id).delete()
            try:
                FeaturedBook.query.filter_by(content_id=book.id).delete()
            except Exception:
                pass
            try:
                EliteStory.query.filter_by(content_id=book.id).delete()
            except Exception:
                pass
            # Clean up ratings, favorites, access, orders for this book
            Rating.query.filter_by(content_id=book.id).delete()
            Favorite.query.filter_by(content_id=book.id).delete()
            Access.query.filter_by(content_id=book.id).delete()
        Content.query.filter_by(creator_wiam_id=uid).delete()

        # Creator profile
        CreatorProfile.query.filter_by(wiam_id=uid).delete()

        # Finally delete the user
        User.query.filter_by(id=user_id).delete()

        db.session.commit()
        log.info("PURGED all data for user_id=%s wiam_id=%s", user_id, uid)
    except Exception as e:
        db.session.rollback()
        log.error("Failed to purge user %s: %s", user_id, e)
        raise


@profile_bp.route('/profile')
@login_required
def my_profile():
    """Redirect to unified dashboard."""
    return redirect(url_for('dashboard.index'))


@profile_bp.route('/profile/edit', methods=['GET', 'POST'])
@login_required
def edit_profile():
    """Redirect to unified dashboard profile tab."""
    return redirect(url_for('dashboard.index', tab='profile'))


@profile_bp.route('/profile/link-google', methods=['POST'])
@csrf.exempt
@login_required
def link_google():
    """Link a Google account to the current user."""
    import requests as http_requests

    credential = request.form.get('credential') or (request.get_json(silent=True) or {}).get('credential')
    if not credential:
        flash('No Google credential received.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID', '')
    if not google_client_id:
        flash('Google login is not configured.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    # Verify the token with Google
    try:
        resp = http_requests.get(
            'https://oauth2.googleapis.com/tokeninfo',
            params={'id_token': credential},
            timeout=5,
        )
        if resp.status_code != 200:
            flash('Google verification failed.', 'error')
            return redirect(url_for('dashboard.index', tab='settings'))
        payload = resp.json()
    except Exception:
        flash('Could not verify Google account.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    if payload.get('aud') != google_client_id:
        flash('Google verification failed (audience mismatch).', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    google_id = payload.get('sub')
    email = payload.get('email', '')

    if not google_id:
        flash('Missing Google user ID.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    # Check if this Google account is already linked to another user
    existing = User.query.filter_by(google_id=google_id).first()
    if existing and existing.id != current_user.id:
        flash('This Google account is already linked to another user.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    current_user.google_id = google_id
    if email and not current_user.email:
        current_user.email = email
    if current_user.auth_provider == 'telegram':
        current_user.auth_provider = 'both'
    db.session.commit()

    flash('Google account linked successfully!', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/profile/unlink-google', methods=['POST'])
@login_required
def unlink_google():
    """Unlink Google account — only if user has another login method."""
    if current_user.auth_provider == 'google':
        flash('Cannot unlink Google — it is your only login method. Set a password first.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))

    current_user.google_id = None
    if current_user.auth_provider == 'both':
        current_user.auth_provider = 'telegram'
    db.session.commit()

    flash('Google account unlinked.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/become-creator', methods=['GET', 'POST'])
@login_required
def become_creator():
    """Tiny one-tap creator gate (web) — pen name + Creator Terms checkbox.

    Mirrors the mobile ``/api/v1/apply/submit`` endpoint so web and Expo agree
    on the new model: any reader can become a creator instantly. The only
    rejection path is a cheap spam-regex on the pen name itself.
    """
    if current_user.is_creator:
        flash('You are already a creator!', 'info')
        return redirect(url_for('dashboard.index'))

    status = current_user.creator_application_status or 'none'

    if request.method == 'POST':
        pen_name = request.form.get('pen_name', '').strip()
        accepted_terms = bool(request.form.get('accepted_terms'))

        if not pen_name or len(pen_name) < 2:
            flash('Please enter a pen name (at least 2 characters).', 'error')
            return redirect(url_for('profile.become_creator'))
        if len(pen_name) > 60:
            flash('Pen name must be 60 characters or less.', 'error')
            return redirect(url_for('profile.become_creator'))
        if not accepted_terms:
            flash('Please agree to the Creator Terms to continue.', 'error')
            return redirect(url_for('profile.become_creator'))

        from ..services.creator_approval import _has_spam
        if _has_spam(pen_name):
            flash('That pen name looks like a placeholder. Pick something real.', 'error')
            return redirect(url_for('profile.become_creator'))

        from ..services.creator_activation import finalize_creator_upgrade
        finalize_creator_upgrade(current_user, pen_name_hint=pen_name)
        try:
            from ..services.analytics import track
            track('creator_upgrade', current_user, source='web', pen_name=pen_name[:80])
        except Exception:
            pass
        db.session.commit()

        try:
            from ..services.notifications import notify_creator_welcome
            notify_creator_welcome(current_user)
        except Exception:
            pass

        flash('Welcome to WiamApp Creators! Your studio is unlocked.', 'success')
        return redirect(url_for('studio.dashboard'))

    return render_template('become_creator.html', status=status)


@profile_bp.route('/connected-accounts')
@login_required
def connected_accounts():
    """Redirect to unified dashboard settings tab."""
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/reading-streaks')
@login_required
def reading_streaks():
    """Dedicated Reading Streaks page — stats, weekly calendar, badges."""
    from datetime import date, timedelta
    uid = current_user.wiam_id
    today = date.today()

    # Current streak
    streak = 0
    d = today
    while True:
        entry = ReadingStreak.query.filter_by(user_id=uid, date=d).first()
        if entry and entry.minutes_read > 0:
            streak += 1
            d -= timedelta(days=1)
        else:
            break

    # Longest streak ever
    all_entries = ReadingStreak.query.filter_by(user_id=uid).filter(
        ReadingStreak.minutes_read > 0
    ).order_by(ReadingStreak.date).all()
    longest = 0
    run = 0
    prev = None
    for e in all_entries:
        if prev and (e.date - prev).days == 1:
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        prev = e.date

    # Totals
    totals = db.session.query(
        func.sum(ReadingStreak.minutes_read),
        func.sum(ReadingStreak.pages_read),
        func.count(ReadingStreak.id),
    ).filter_by(user_id=uid).first()
    total_minutes = totals[0] or 0
    total_pages = totals[1] or 0
    total_days = totals[2] or 0

    # Last 28 days calendar
    calendar = []
    for i in range(27, -1, -1):
        day = today - timedelta(days=i)
        entry = ReadingStreak.query.filter_by(user_id=uid, date=day).first()
        calendar.append({
            'date': day,
            'minutes': entry.minutes_read if entry else 0,
            'pages': entry.pages_read if entry else 0,
            'active': bool(entry and entry.minutes_read > 0),
        })

    # Streak badges
    badges = [
        {'days': 3, 'name': 'Getting Started', 'icon': '🌱', 'color': '#2ecc71'},
        {'days': 7, 'name': 'Week Warrior', 'icon': '⚡', 'color': '#3498db'},
        {'days': 14, 'name': 'Bookworm', 'icon': '📚', 'color': '#9b59b6'},
        {'days': 30, 'name': 'Streak Master', 'icon': '🔥', 'color': '#e74c3c'},
        {'days': 60, 'name': 'Reading Machine', 'icon': '🚀', 'color': '#f39c12'},
        {'days': 100, 'name': 'Legendary Reader', 'icon': '👑', 'color': '#d4a843'},
    ]
    for b in badges:
        b['earned'] = longest >= b['days']

    return render_template(
        'reading_streaks.html',
        streak=streak,
        longest=longest,
        total_minutes=total_minutes,
        total_pages=total_pages,
        total_days=total_days,
        calendar=calendar,
        badges=badges,
        today=today,
    )


@profile_bp.route('/feedback', methods=['GET', 'POST'])
@login_required
def feedback():
    """User feedback — view history and submit new feedback."""
    from ..models import Feedback
    uid = current_user.wiam_id or current_user.id

    if request.method == 'POST':
        category = request.form.get('category', 'general')
        message = request.form.get('message', '').strip()
        if not message:
            flash('Please write your feedback.', 'error')
        else:
            # ── Content Guard scan ──
            from ..services.content_guard import scan_content
            verdict = scan_content(current_user.id, message, 'feedback')
            if not verdict.allowed:
                flash(verdict.reason, 'error')
                return redirect(url_for('profile.feedback'))
            fb = Feedback(
                user_id=uid,
                user_name=current_user.display_name,
                user_email=current_user.email or '',
                category=category,
                message=message,
            )
            db.session.add(fb)
            db.session.commit()
            flash('Thank you for your feedback!', 'success')
        return redirect(url_for('profile.feedback'))

    feedbacks = Feedback.query.filter_by(user_id=uid).order_by(
        Feedback.created_at.desc()
    ).limit(20).all()
    return render_template('user_feedback.html', feedbacks=feedbacks)


@profile_bp.route('/warnings')
@login_required
def my_warnings():
    """Redirect to Account Safety page."""
    return redirect(url_for('profile.account_safety'))


@profile_bp.route('/account/safety')
@login_required
def account_safety():
    """Account Safety dashboard — warnings, strikes, escalation status."""
    from ..models import UserWarning
    from ..services.content_guard import get_user_warning_summary
    uid = current_user.id
    warnings = UserWarning.query.filter_by(user_id=uid).order_by(
        UserWarning.created_at.desc()
    ).limit(30).all()
    summary = get_user_warning_summary(uid)
    return render_template('account_safety.html', warnings=warnings, summary=summary)


@profile_bp.route('/warnings/<int:warning_id>/acknowledge', methods=['POST'])
@login_required
def acknowledge_warning(warning_id):
    """User acknowledges a warning (supports AJAX and form POST)."""
    from ..models import UserWarning
    uid = current_user.id
    w = UserWarning.query.filter_by(id=warning_id, user_id=uid).first_or_404()
    if not w.acknowledged:
        w.acknowledged = True
        w.acknowledged_at = datetime.utcnow()
        db.session.commit()
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    if is_ajax:
        return jsonify(ok=True, warning_id=warning_id)
    flash('Warning acknowledged.', 'info')
    return redirect(url_for('profile.account_safety'))


@profile_bp.route('/privacy')
def privacy_policy():
    """Privacy Policy page."""
    return render_template('privacy.html')


@profile_bp.route('/about')
def about():
    """About WiamApp page."""
    return render_template('about.html')


@profile_bp.route('/terms')
def terms():
    """Terms & Conditions page."""
    return render_template('terms.html')


@profile_bp.route('/help')
def help_center():
    """Help Center page with FAQ and live chat bot."""
    return render_template('help_center.html')


@profile_bp.route('/wiambot')
def wiambot():
    """Dedicated WiamBot chat page — beautiful standalone experience."""
    return render_template('wiambot.html')


@profile_bp.route('/privacy-center')
def privacy_center():
    """Privacy Center — how we handle your data."""
    return render_template('privacy_center.html')


@profile_bp.route('/community-guidelines')
def community_guidelines():
    """Community Guidelines page."""
    return render_template('community_guidelines.html')


_img_cache = {}       # {image_id: (bytes, content_type)}  — LRU-ish in-memory cache
_IMG_CACHE_MAX = 100  # max entries (covers are ~50-150KB each, so ~15MB max)

@profile_bp.route('/img/<int:image_id>')
def serve_image(image_id):
    """Serve an image stored in the database (with in-memory cache to reduce DB hits)."""
    from flask import make_response

    # Check in-memory cache first (avoids Neon DB call)
    cached = _img_cache.get(image_id)
    if cached:
        resp = make_response(cached[0])
        resp.headers['Content-Type'] = cached[1]
        resp.headers['Cache-Control'] = 'public, max-age=31536000'
        return resp

    from ..models import ImageStore
    img = ImageStore.query.get_or_404(image_id)

    # Image already migrated to Cloudinary (data nulled out)
    if not img.data:
        return make_response('Image migrated to CDN', 404)

    # Evict oldest entries if cache is full
    if len(_img_cache) >= _IMG_CACHE_MAX:
        oldest_key = next(iter(_img_cache))
        _img_cache.pop(oldest_key, None)

    _img_cache[image_id] = (img.data, img.content_type)

    resp = make_response(img.data)
    resp.headers['Content-Type'] = img.content_type
    resp.headers['Cache-Control'] = 'public, max-age=31536000'
    return resp


@profile_bp.route('/upload-avatar', methods=['POST'])
@csrf.exempt
@login_required
def upload_avatar():
    """Upload a cropped avatar image to Cloudinary."""
    import base64
    data = request.form.get('avatar_data', '') or (request.get_json(silent=True) or {}).get('avatar_data', '')
    if not data or ',' not in data:
        return jsonify({'error': 'No image data'}), 400

    # Parse base64
    header, b64 = data.split(',', 1)
    content_type = 'image/png'
    if 'jpeg' in header:
        content_type = 'image/jpeg'
    img_bytes = base64.b64decode(b64)

    # Upload to Cloudinary (no DB fallback — saves space)
    from ..services.image_service import upload_avatar as cloud_upload_avatar
    cloud_url = cloud_upload_avatar(img_bytes, current_user.id, content_type)
    if not cloud_url:
        return jsonify({'error': 'Avatar upload failed. Please try again.'}), 500

    current_user.avatar_url = cloud_url
    db.session.commit()
    return jsonify({'url': cloud_url})


@profile_bp.route('/settings')
@login_required
def settings_privacy():
    """Redirect to unified dashboard settings tab."""
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/settings/update-account', methods=['POST'])
@login_required
def update_account_info():
    """Update account info — redirects to new dashboard settings."""
    phone = request.form.get('phone', '').strip()
    bio = request.form.get('bio', '').strip()
    dob = request.form.get('date_of_birth', '').strip()
    dob_visible = request.form.get('dob_visible') == 'on'
    pronouns = request.form.get('pronouns', '').strip()
    region = request.form.get('account_region', '').strip()

    # ── Content Guard scan ──
    if bio:
        from ..services.content_guard import scan_content, is_user_banned
        if is_user_banned(current_user.id):
            flash('Your account has been suspended.', 'error')
            return redirect(url_for('dashboard.index', tab='settings'))
        verdict = scan_content(current_user.id, bio, 'bio')
        if not verdict.allowed:
            flash(verdict.reason, 'error')
            return redirect(url_for('dashboard.index', tab='settings'))

    current_user.phone = phone or current_user.phone
    current_user.bio = bio[:500] if bio else current_user.bio
    current_user.dob_visible = dob_visible
    current_user.pronouns = pronouns or current_user.pronouns
    current_user.show_pronouns = request.form.get('show_pronouns') == 'on'
    current_user.account_region = region or current_user.account_region
    if dob:
        try:
            from datetime import datetime as dt
            current_user.date_of_birth = dt.strptime(dob, '%Y-%m-%d').date()
        except ValueError:
            pass
    db.session.commit()
    flash('Account info updated.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/settings/change-password', methods=['POST'])
@login_required
def change_password():
    """Change password from settings."""
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


@profile_bp.route('/settings/deactivate', methods=['POST'])
@login_required
def deactivate_account():
    """Deactivate account — different from logout. User must contact team to reactivate."""
    if current_user.is_founder:
        flash('Founder accounts cannot be deactivated.', 'error')
        return redirect(url_for('dashboard.index', tab='settings'))
    current_user.status = 'deactivated'
    db.session.commit()
    from flask_login import logout_user
    logout_user()
    return render_template('account_deactivated.html')


@profile_bp.route('/notification-settings', methods=['GET', 'POST'])
@login_required
def notification_settings():
    """Redirect to unified dashboard settings tab."""
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/settings/update-privacy', methods=['POST'])
@login_required
def update_privacy():
    """Update privacy toggle settings."""
    current_user.privacy_profile_visible = request.form.get('privacy_profile_visible') == 'on'
    current_user.privacy_show_reading_activity = request.form.get('privacy_show_reading_activity') == 'on'
    current_user.privacy_show_library = request.form.get('privacy_show_library') == 'on'
    current_user.privacy_show_favorites = request.form.get('privacy_show_favorites') == 'on'
    db.session.commit()
    flash('Privacy settings saved.', 'success')
    return redirect(url_for('dashboard.index', tab='settings'))


@profile_bp.route('/account/delete', methods=['GET', 'POST'])
@login_required
def delete_account():
    """Account deletion page — readers, creators, authors can delete their own account."""
    if current_user.is_founder:
        flash('Founder accounts cannot be deleted.', 'error')
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        confirm_text = request.form.get('confirm', '').strip()
        password = request.form.get('password', '').strip()

        if confirm_text != 'DELETE MY ACCOUNT':
            flash('Please type "DELETE MY ACCOUNT" exactly to confirm.', 'error')
            return redirect(url_for('profile.delete_account'))

        # Verify password if user has one
        if current_user.password_hash and not current_user.check_password(password):
            flash('Incorrect password.', 'error')
            return redirect(url_for('profile.delete_account'))

        user_id = current_user.id
        uid = current_user.wiam_id

        # Complete deletion — wipe ALL user data from database
        _purge_user_data(user_id, uid)

        # Log the user out
        from flask_login import logout_user
        logout_user()
        flash('Your account has been completely deleted. We are sorry to see you go.', 'info')
        return redirect(url_for('home.index'))

    return render_template('delete_account.html')
