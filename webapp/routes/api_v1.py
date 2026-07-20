"""
WiamApp REST API v1
JSON endpoints for the separated frontend (Next.js on Cloudflare Pages).
All routes are prefixed with /api/v1/.
"""
import os
import logging
import jwt
import re
import json
import hashlib
from io import BytesIO
from datetime import datetime, timedelta, date
from functools import wraps
from flask import Blueprint, jsonify, request, current_app
from flask_login import current_user
from ..extensions import db, csrf
from ..models import (
    User, Content, Genre, Follow, Rating, Favorite, Review, ReviewLike,
    WebBookContent, ReadingProgress, CreatorProfile, Access,
    ChapterComment, ChapterCommentLike, ChapterLike, FeaturedBook,
    UserLibrary, CoinBalance, CoinTransaction, CoinPackage, CreatorEarnings, RevenueRule,
    ChapterUnlock, AdImpression,
    ParagraphReaction, ParagraphComment, ParagraphCommentLike,
    ReaderBadge, ReadingStreak, UserGenrePreference, BookSection, Report,
    Notification, StickerGift, StoryChallenge, ChallengeEntry,
    TrialDeviceFingerprint, AuditLog, CreatorSettings, AnalyticsEvent,
)

log = logging.getLogger(__name__)

api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1')

# All API routes are CSRF-exempt (they use JWT, not cookies)
csrf.exempt(api_v1)

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def _parse_date_of_birth(raw, min_age=13):
    """Parse YYYY-MM-DD; returns (date or None, error_message or None). Empty input -> (None, None)."""
    if not raw or not isinstance(raw, str):
        return None, None
    s = raw.strip()
    if not s:
        return None, None
    try:
        parts = s.split('-')
        if len(parts) != 3:
            return None, 'Invalid date of birth'
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        bd = date(y, m, d)
    except (ValueError, TypeError):
        return None, 'Invalid date of birth'
    today = date.today()
    age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
    if age < min_age:
        return None, 'You must be at least 13 years old'
    if age > 120:
        return None, 'Invalid date of birth'
    return bd, None


# ---------------------------------------------------------------------------
# JWT Helpers
# ---------------------------------------------------------------------------

def _get_jwt_secret():
    return current_app.config.get('SECRET_KEY', 'dev-secret')


def _create_token(user_id, expires_hours=72):
    """Create a JWT token for a user."""
    payload = {
        'sub': user_id,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm='HS256')


def _decode_token(token):
    """Decode and validate a JWT token. Returns user_id or None."""
    try:
        payload = jwt.decode(token, _get_jwt_secret(), algorithms=['HS256'])
        return payload.get('sub')
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def jwt_required(f):
    """Decorator: require a valid JWT in the Authorization header."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        token = auth_header[7:]
        user_id = _decode_token(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 401
        if user.status == 'banned':
            return jsonify({'error': 'Account is banned'}), 403
        # Centralized premium expiry enforcement
        from ..services.premium_service import check_and_expire_premium
        check_and_expire_premium(user)
        from ..services.creator_activation import reconcile_approved_creator_if_needed
        reconcile_approved_creator_if_needed(user)
        request.api_user = user
        return f(*args, **kwargs)
    return decorated


def jwt_optional(f):
    """Decorator: attach user if JWT present, but don't require it."""
    @wraps(f)
    def decorated(*args, **kwargs):
        request.api_user = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            user_id = _decode_token(token)
            if user_id:
                user = User.query.get(user_id)
                if user:
                    from ..services.premium_service import check_and_expire_premium
                    check_and_expire_premium(user)
                    from ..services.creator_activation import reconcile_approved_creator_if_needed
                    reconcile_approved_creator_if_needed(user)
                request.api_user = user
        return f(*args, **kwargs)
    return decorated


def _creator_api_forbidden():
    """403 JSON if JWT user is missing or not a creator/founder."""
    u = getattr(request, 'api_user', None)
    if not u or not u.is_creator:
        return jsonify({'error': 'Creator account required'}), 403
    return None


def _abs_url(path):
    """Convert a relative URL to absolute using the current request's host."""
    if not path or not path.startswith('/'):
        return path
    return request.host_url.rstrip('/') + path


def _is_own_bulletin(uid, creator_id):
    """Check if user is viewing their own bulletin."""
    return int(uid) == int(creator_id)


def _extract_device_hash(data=None):
    """Build a stable hash from client fingerprint headers/body for anti-abuse checks."""
    data = data or {}
    raw_fp = (data.get('device_fingerprint') or request.headers.get('X-Device-Fingerprint') or '').strip()
    device_name = (data.get('device_name') or request.headers.get('X-Device-Name') or '').strip()
    platform = (data.get('platform') or request.headers.get('X-Device-Platform') or '').strip()
    signal = data.get('device_signal') if isinstance(data.get('device_signal'), dict) else {}
    install_id = str(signal.get('install_id') or '').strip()
    model_name = str(signal.get('model_name') or '').strip()
    os_name = str(signal.get('os_name') or '').strip()
    os_version = str(signal.get('os_version') or '').strip()
    ua = (request.headers.get('User-Agent') or '').strip()
    if not raw_fp and not ua and not install_id:
        return ''
    blob = f'{raw_fp}|{device_name}|{platform}|{install_id}|{model_name}|{os_name}|{os_version}|{ua}'
    return hashlib.sha256(blob.encode('utf-8')).hexdigest()


def _device_trial_used(device_hash):
    if not device_hash:
        return False
    row = TrialDeviceFingerprint.query.filter_by(device_hash=device_hash).first()
    return bool(row and (row.trial_count or 0) > 0)


def _record_device_trial(device_hash, user_id):
    if not device_hash:
        return
    row = TrialDeviceFingerprint.query.filter_by(device_hash=device_hash).first()
    if not row:
        row = TrialDeviceFingerprint(
            device_hash=device_hash,
            first_user_id=user_id,
            last_user_id=user_id,
            trial_count=1,
        )
        db.session.add(row)
    else:
        row.last_user_id = user_id
        row.trial_count = (row.trial_count or 0) + 1
        row.last_seen_at = datetime.utcnow()


def _audit_security(user, action, details):
    try:
        entry = AuditLog(
            actor_user_id=user.wiam_id or user.id,
            action=action,
            target_type='SECURITY',
            target_id=user.id,
            details_json=str(details or {}),
            ip_address=request.headers.get('X-Forwarded-For', request.remote_addr),
        )
        db.session.add(entry)
    except Exception:
        # Never block auth/trial flows if audit insert fails.
        pass


def _user_json(user, include_email=False):
    """Serialize a User to JSON."""
    data = {
        'id': user.id,
        'wiam_id': user.wiam_id,
        'username': user.username,
        'display_name': user.display_name,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'avatar_url': _abs_url(user.avatar_url),
        'bio': user.bio,
        'role': user.role,
        'is_creator': user.is_creator,
        'creator_application_status': (getattr(user, 'creator_application_status', None) or 'none'),
        'onboarding_completed': bool(getattr(user, 'onboarding_completed', True)),
        'registration_completed': bool(getattr(user, 'registration_completed', True)),
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
    }
    if include_email:
        data['email'] = user.email
        data['email_verified'] = user.email_verified
        data['auth_provider'] = user.auth_provider
        # Expiry already enforced by JWT middleware (check_and_expire_premium)
        data['premium_status'] = user.premium_status or 'none'
        data['premium_plan'] = user.premium_plan
        data['trial_used'] = bool(getattr(user, 'trial_used', False))
        data['referred_by'] = user.referred_by
        data['referral_code'] = user.referral_code
    return data


def _me_json(user):
    """Same shape as GET /auth/me — use after flows that mutate the user."""
    data = _user_json(user, include_email=True)
    data['roles'] = user.get_roles()
    data['is_team_member'] = user.is_team_member
    data['is_founder'] = getattr(user, 'is_founder', False)
    # Push 2: include the pen_name from CreatorProfile so the mobile
    # WelcomeCreator screen and creator badges have a stable fallback.
    pen = None
    try:
        if user.wiam_id:
            cp = CreatorProfile.query.filter_by(wiam_id=user.wiam_id).first()
            if cp and (cp.pen_name or '').strip():
                pen = cp.pen_name.strip()
    except Exception:
        pen = None
    data['creator_pen_name'] = pen
    # Extended profile fields for Account tab
    data['phone'] = user.phone or ''
    data['date_of_birth'] = user.date_of_birth.isoformat() if getattr(user, 'date_of_birth', None) else None
    data['dob_visible'] = bool(getattr(user, 'dob_visible', False))
    data['pronouns'] = getattr(user, 'pronouns', None) or ''
    data['show_pronouns'] = bool(getattr(user, 'show_pronouns', False))
    data['account_region'] = getattr(user, 'account_region', None) or ''
    data['two_factor_enabled'] = bool(getattr(user, 'two_factor_enabled', False))
    data['notif_sound'] = getattr(user, 'notif_sound', 'chime') or 'chime'
    return data


def _book_json(book, current_user_obj=None, _creator_cache=None, _profile_cache=None, _stats_cache=None):
    """Serialize a Content (book) to JSON.

    Pass _creator_cache / _profile_cache dicts (keyed by wiam_id) to avoid N+1 queries.
    Pass _stats_cache (keyed by content id) with avg_rating/rating_count/chapter_count/favorite_count
    to avoid per-book aggregate queries.
    """
    # Resolve creator — use cache if available, else fall back to per-book query
    creator = None
    if book.creator_wiam_id:
        if _creator_cache is not None:
            creator = _creator_cache.get(book.creator_wiam_id)
        else:
            creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()

    # Resolve author display name: prefer CreatorProfile.pen_name > book.author > display_name
    author_display = book.author
    creator_data = None
    if creator:
        pen = None
        if creator.wiam_id:
            if _profile_cache is not None:
                cp = _profile_cache.get(creator.wiam_id)
            else:
                cp = CreatorProfile.query.filter_by(wiam_id=creator.wiam_id).first()
            pen = cp.pen_name if cp and cp.pen_name else None
        author_display = pen or book.author or creator.display_name
        creator_data = {
            'id': creator.id,
            'username': creator.username,
            'display_name': pen or creator.display_name,
            'pen_name': pen,
            'avatar_url': _abs_url(creator.avatar_url),
        }
    data = {
        'id': book.id,
        'title': book.title,
        'author': author_display,
        'description': book.description,
        'genre': book.genre,
        'cover_url': _abs_url(book.cover_url),
        'status': book.status,
        'views': book.views or 0,
        'chapter_count': _stats_cache.get(book.id, {}).get('chapter_count', book.chapter_count) if _stats_cache else book.chapter_count,
        'avg_rating': _stats_cache.get(book.id, {}).get('avg_rating', book.avg_rating) if _stats_cache else book.avg_rating,
        'rating_count': _stats_cache.get(book.id, {}).get('rating_count', book.rating_count) if _stats_cache else book.rating_count,
        'favorite_count': _stats_cache.get(book.id, {}).get('favorite_count', book.favorite_count) if _stats_cache else book.favorite_count,
        'created_at': book.created_at.isoformat() if book.created_at else None,
        'published_at': book.published_at.isoformat() if book.published_at else None,
        'introduction': book.introduction,
        'is_featured': book.is_featured,
        'creator': creator_data,
    }
    if current_user_obj:
        data['is_favorited'] = Favorite.query.filter_by(
            user_id=current_user_obj.id, content_id=book.id
        ).first() is not None
        uid = current_user_obj.wiam_id or current_user_obj.id
        data['in_library'] = UserLibrary.query.filter_by(
            user_id=uid, content_id=book.id
        ).first() is not None
        data['user_rating'] = None
        r = Rating.query.filter_by(
            user_id=current_user_obj.id, content_id=book.id
        ).first()
        if r:
            data['user_rating'] = r.rating
    return data


def _preload_creator_caches(books):
    """Batch-load all creators and CreatorProfiles for a list of books (2 queries total)."""
    wiam_ids = {b.creator_wiam_id for b in books if b.creator_wiam_id}
    if not wiam_ids:
        return {}, {}
    creators = User.query.filter(User.wiam_id.in_(wiam_ids)).all()
    creator_cache = {u.wiam_id: u for u in creators}
    profiles = CreatorProfile.query.filter(CreatorProfile.wiam_id.in_(wiam_ids)).all()
    profile_cache = {p.wiam_id: p for p in profiles}
    return creator_cache, profile_cache


def _normalize_unit_label(label: str | None) -> str:
    """Return a safe singular unit label for creator-facing chapter units."""
    v = (label or 'chapter').strip().lower()
    if not v:
        return 'chapter'
    # Keep labels compact to avoid broken UI chips.
    return v[:32]


def _unit_title(unit_label: str | None, number: int) -> str:
    """Default title such as 'Chapter 3' / 'Episode 3' / 'Part 3'."""
    u = _normalize_unit_label(unit_label)
    return f"{u.capitalize()} {number}"


def _creator_default_unit_label(user_obj) -> str:
    """Resolve creator's default content-unit label from CreatorSettings."""
    if not user_obj:
        return 'chapter'
    try:
        cs = CreatorSettings.query.filter_by(user_id=user_obj.id).first()
        return _normalize_unit_label(getattr(cs, 'default_unit_label', None))
    except Exception:
        return 'chapter'


# ---------------------------------------------------------------------------
# Health & Info
# ---------------------------------------------------------------------------

@api_v1.route('/health')
def health_check():
    return jsonify(ok=True)


@api_v1.route('/health/db')
def health_db():
    """Quick database connectivity check."""
    try:
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        count = Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        ).count()
        return jsonify(ok=True, db='connected', published_count=count)
    except Exception as e:
        db.session.rollback()
        return jsonify(ok=False, db='error', error=str(e)[:300]), 500


@api_v1.route('/')
def api_info():
    return jsonify({
        'name': 'WiamApp API',
        'version': 'v1',
        'docs': '/api/v1/',
        'endpoints': {
            'auth': '/api/v1/auth/',
            'books': '/api/v1/books/',
            'creators': '/api/v1/creators/',
            'search': '/api/v1/search',
            'genres': '/api/v1/genres',
        }
    })


# ---------------------------------------------------------------------------
# AUTH — Login, Register, Me
# ---------------------------------------------------------------------------

@api_v1.route('/auth/login', methods=['POST'])
def auth_login():
    """Login with email + password. Returns JWT token."""
    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    if cfg.is_login_blocked:
        return jsonify({'error': cfg.auth_login_blocked_message or 'Login is temporarily disabled.',
                        'auth_blocked': True}), 503

    data = request.get_json(silent=True) or {}
    raw_email = data.get('email')
    raw_password = data.get('password')
    if not isinstance(raw_email, str) or not isinstance(raw_password, str):
        return jsonify({'error': 'Email and password must be strings'}), 400
    email = raw_email.strip().lower()
    password = raw_password
    device_hash = _extract_device_hash(data)

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    if user.status == 'banned':
        return jsonify({'error': 'Account is banned'}), 403

    # Legacy DB: approved application but role not yet creator — fix before issuing token / user JSON
    from ..services.creator_activation import reconcile_approved_creator_if_needed
    reconcile_approved_creator_if_needed(user)

    # Anti-abuse: if this device has already consumed a trial on any account,
    # make sure this account is also marked trial-used.
    if device_hash and _device_trial_used(device_hash) and not bool(getattr(user, 'trial_used', False)):
        user.trial_used = True
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    token = _create_token(user.id)
    user_data = _user_json(user, include_email=True)
    user_data['is_founder'] = getattr(user, 'is_founder', False)
    user_data['is_team_member'] = user.is_team_member
    return jsonify({
        'token': token,
        'user': user_data,
    })


@api_v1.route('/auth/register', methods=['POST'])
def auth_register():
    """Register a new user with email + password."""
    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    if cfg.is_registration_blocked:
        return jsonify({'error': cfg.auth_registration_blocked_message or 'Registration is temporarily closed.',
                        'auth_blocked': True}), 503

    data = request.get_json(silent=True) or {}
    platform = str(data.get('platform') or '').lower()
    is_mobile = platform in ('ios', 'android')
    raw_email = data.get('email')
    raw_password = data.get('password')
    raw_first = data.get('first_name')
    raw_last = data.get('last_name')
    if not isinstance(raw_email, str) or not isinstance(raw_password, str):
        return jsonify({'error': 'Email and password must be strings'}), 400
    email = raw_email.strip().lower()
    password = raw_password
    first_name = (raw_first if isinstance(raw_first, str) else '').strip()
    last_name = (raw_last if isinstance(raw_last, str) else '').strip()
    device_hash = _extract_device_hash(data)

    if not email or not _EMAIL_RE.match(email):
        return jsonify({'error': 'Valid email is required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if not first_name:
        return jsonify({'error': 'First name is required'}), 400

    raw_username = data.get('username')
    username = (
        _normalize_username(str(raw_username))
        if raw_username is not None and str(raw_username).strip()
        else ''
    )

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'An account with this email already exists'}), 409

    if is_mobile:
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        if not _USERNAME_RE.match(username):
            return jsonify(
                {'error': 'Username must be 3-30 characters, only lowercase letters, numbers, and underscores'}
            ), 400
        if _is_username_taken(username):
            return jsonify({
                'error': 'Username already taken',
                'suggestions': _suggest_usernames(username),
            }), 409
    elif username:
        if not _USERNAME_RE.match(username):
            return jsonify(
                {'error': 'Username must be 3-30 characters, only lowercase letters, numbers, and underscores'}
            ), 400
        if _is_username_taken(username):
            return jsonify({
                'error': 'Username already taken',
                'suggestions': _suggest_usernames(username),
            }), 409
    else:
        base = _re.sub(r'[^a-z0-9_]', '', email.split('@')[0].lower())[:20] or 'user'
        username = base
        suffix = 1
        while _is_username_taken(username):
            username = f"{base}{suffix}"
            suffix += 1

    dob_date = None
    raw_dob = data.get('date_of_birth')
    if is_mobile:
        if not raw_dob or not isinstance(raw_dob, str) or not raw_dob.strip():
            return jsonify({'error': 'Date of birth is required'}), 400
        dob_date, dob_err = _parse_date_of_birth(raw_dob.strip())
        if dob_err:
            return jsonify({'error': dob_err}), 400
    elif raw_dob and isinstance(raw_dob, str) and raw_dob.strip():
        dob_date, dob_err = _parse_date_of_birth(raw_dob.strip())
        if dob_err:
            return jsonify({'error': dob_err}), 400

    raw_phone = data.get('phone')
    phone_val = None
    if isinstance(raw_phone, str) and raw_phone.strip():
        phone_val = raw_phone.strip()[:32]

    import hashlib
    h = int(hashlib.sha256(email.encode()).hexdigest()[:14], 16)
    synthetic_tid = -(h + 1_000_000)

    user = User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        wiam_id=synthetic_tid,
        username=username,
        auth_provider='email',
        email_verified=False,
        onboarding_completed=False,
        registration_completed=not is_mobile,
        phone=phone_val,
        date_of_birth=dob_date,
        source='mobile' if is_mobile else 'web',
    )
    if device_hash and _device_trial_used(device_hash):
        user.trial_used = True
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = _create_token(user.id)
    return jsonify({
        'token': token,
        'user': _user_json(user, include_email=True),
    }), 201


@api_v1.route('/auth/google', methods=['POST'])
def auth_google():
    """Mobile / API Google Sign-In: verify id_token, find or create user, return JWT."""
    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    if cfg.is_login_blocked:
        return jsonify({
            'error': cfg.auth_login_blocked_message or 'Login is temporarily disabled.',
            'auth_blocked': True,
        }), 503

    data = request.get_json(silent=True) or {}
    id_token_raw = data.get('id_token')
    if not isinstance(id_token_raw, str) or not id_token_raw.strip():
        return jsonify({'error': 'Missing Google id_token.'}), 400

    platform = str(data.get('platform') or '').lower()
    is_mobile = platform in ('ios', 'android')

    # Allowed audiences = web client id + per-platform client ids (comma-separated env)
    allowed = []
    for env_key in ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID_IOS', 'GOOGLE_CLIENT_ID_ANDROID'):
        v = current_app.config.get(env_key) or os.environ.get(env_key)
        if v:
            for piece in str(v).split(','):
                piece = piece.strip()
                if piece:
                    allowed.append(piece)
    if not allowed:
        return jsonify({'error': 'Google sign-in is not configured on the server.'}), 503

    import requests as http_requests
    try:
        resp = http_requests.get(
            'https://oauth2.googleapis.com/tokeninfo',
            params={'id_token': id_token_raw.strip()},
            timeout=5,
        )
        if resp.status_code != 200:
            return jsonify({'error': 'Google login verification failed.'}), 401
        payload = resp.json()
    except Exception:
        return jsonify({'error': 'Could not verify Google login. Please try again.'}), 502

    if payload.get('aud') not in allowed:
        return jsonify({'error': 'Google login verification failed (audience mismatch).'}), 401

    google_id = payload.get('sub')
    email = (payload.get('email') or '').strip().lower()
    given_name = (payload.get('given_name') or '').strip()
    family_name = (payload.get('family_name') or '').strip()
    if not google_id:
        return jsonify({'error': 'Google login failed (missing user id).'}), 400

    user = User.query.filter_by(google_id=google_id).first()
    created_new = False
    if not user and email:
        user = User.query.filter(db.func.lower(User.email) == email).first()
        if user:
            user.google_id = google_id
            if user.auth_provider in ('email', 'google'):
                user.auth_provider = 'both'
            if not user.email:
                user.email = email

    if not user:
        # Brand-new user — create one. Generate a unique username from email or name.
        base = _re.sub(r'[^a-z0-9_]', '', (email.split('@')[0] if email else (given_name or 'user')).lower())[:20] or 'user'
        username = base
        suffix = 1
        while _is_username_taken(username):
            username = f"{base}{suffix}"
            suffix += 1
        import hashlib
        seed = (email or google_id)
        h = int(hashlib.sha256(seed.encode()).hexdigest()[:14], 16)
        synthetic_tid = -(h + 1_000_000)
        user = User(
            email=email or None,
            first_name=given_name or 'Reader',
            last_name=family_name or '',
            wiam_id=synthetic_tid,
            username=username,
            auth_provider='google',
            email_verified=bool(payload.get('email_verified')) or bool(email),
            onboarding_completed=False,
            registration_completed=not is_mobile,
            google_id=google_id,
            source='mobile_google' if is_mobile else 'web_google',
        )
        db.session.add(user)
        created_new = True
    else:
        if given_name and not user.first_name:
            user.first_name = given_name
        if family_name and not user.last_name:
            user.last_name = family_name
        if email and not user.email:
            user.email = email
        if not user.email_verified and (payload.get('email_verified') or email):
            user.email_verified = True

    if user.status == 'banned':
        return jsonify({'error': 'Account is banned.'}), 403
    if user.status == 'deleted':
        return jsonify({'error': 'This account has been deleted.'}), 403

    db.session.commit()

    token = _create_token(user.id)
    user_data = _user_json(user, include_email=True)
    user_data['is_founder'] = getattr(user, 'is_founder', False)
    user_data['is_team_member'] = user.is_team_member
    return jsonify({
        'token': token,
        'user': user_data,
        'created': created_new,
    }), (201 if created_new else 200)


@api_v1.route('/auth/forgot-password', methods=['POST'])
def auth_forgot_password():
    """Request password reset code by email (non-enumerating response)."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    if not email or not _EMAIL_RE.match(email):
        return jsonify({'error': 'Please enter a valid email address.'}), 400

    user = User.query.filter_by(email=email).first()
    if user and user.password_hash:
        try:
            from ..services.email_service import create_and_send_code
            create_and_send_code(email, 'reset', user_id=user.id)
        except Exception:
            # Do not leak internals; keep stable client-facing response.
            pass

    return jsonify({'message': 'If an account exists with this email, a reset code has been sent.'})


@api_v1.route('/auth/reset-password', methods=['POST'])
def auth_reset_password():
    """Reset password with emailed verification code."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    new_password = data.get('new_password') or ''
    confirm_password = data.get('confirm_password') or ''

    if not email or not _EMAIL_RE.match(email):
        return jsonify({'error': 'Please enter a valid email address.'}), 400
    if not code:
        return jsonify({'error': 'Please enter the reset code.'}), 400
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters.'}), 400
    if new_password != confirm_password:
        return jsonify({'error': 'Passwords do not match.'}), 400

    from ..services.email_service import verify_code
    vc = verify_code(email, code, 'reset')
    if not vc:
        return jsonify({'error': 'Invalid or expired reset code.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash:
        return jsonify({'error': 'Account not found or unavailable for password reset.'}), 400

    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password reset successful. You can now sign in.'})


@api_v1.route('/auth/me')
@jwt_required
def auth_me():
    """Get current user profile."""
    user = request.api_user
    return jsonify(_me_json(user))


import re as _re
import random as _random

_USERNAME_RE = _re.compile(r'^[a-z0-9_]{3,30}$')


def _normalize_username(raw: str) -> str:
    return raw.strip().lower().replace(' ', '_')


def _is_username_taken(username: str, exclude_user_id: int = None) -> bool:
    q = User.query.filter(db.func.lower(User.username) == username.lower())
    if exclude_user_id:
        q = q.filter(User.id != exclude_user_id)
    return q.first() is not None


def _suggest_usernames(base: str, exclude_user_id: int = None, count: int = 5) -> list:
    """Generate available username suggestions based on the desired username."""
    clean = _re.sub(r'[^a-z0-9_]', '', base.lower())[:20]
    if not clean:
        clean = 'user'
    candidates = []
    candidates.append(f"{clean}{_random.randint(1, 99)}")
    candidates.append(f"{clean}_{_random.randint(10, 999)}")
    candidates.append(f"the_{clean}")
    candidates.append(f"{clean}_official")
    candidates.append(f"{clean}{_random.randint(100, 9999)}")
    candidates.append(f"{clean}_{_random.choice(['x', 'gh', 'real', 'vip', 'pro'])}")
    candidates.append(f"its_{clean}")
    candidates.append(f"{clean}_{_random.randint(1, 9)}")

    available = []
    for c in candidates:
        if _USERNAME_RE.match(c) and not _is_username_taken(c, exclude_user_id):
            available.append(c)
            if len(available) >= count:
                break
    return available


@api_v1.route('/auth/check-username', methods=['GET'])
def check_username_availability():
    """Check if a username is available. Returns suggestions if taken.

    Query params: ?username=khoby
    No auth required — lets the onboarding screen check before account creation.
    """
    raw = request.args.get('username', '').strip()
    username = _normalize_username(raw)

    if not username:
        return jsonify({'error': 'Username is required'}), 400
    if not _USERNAME_RE.match(username):
        return jsonify({
            'available': False,
            'username': username,
            'reason': 'Username must be 3-30 characters, only lowercase letters, numbers, and underscores',
            'suggestions': [],
        })

    taken = _is_username_taken(username)
    result = {
        'available': not taken,
        'username': username,
    }
    if taken:
        result['reason'] = 'This username is already taken'
        result['suggestions'] = _suggest_usernames(username)
    return jsonify(result)


@api_v1.route('/auth/profile', methods=['PUT'])
@jwt_required
def update_profile():
    """Update current user's profile (first name, last name, bio, username)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    changed = False
    if 'first_name' in data and data['first_name']:
        user.first_name = data['first_name'].strip()[:50]
        changed = True
    if 'last_name' in data and data['last_name']:
        user.last_name = data['last_name'].strip()[:50]
        changed = True
    if 'bio' in data:
        user.bio = (data['bio'] or '').strip()[:500]
        changed = True
    if 'pronouns' in data:
        raw_pr = data.get('pronouns')
        user.pronouns = (raw_pr.strip()[:80] if isinstance(raw_pr, str) and raw_pr.strip() else None)
        changed = True
    if 'show_pronouns' in data:
        user.show_pronouns = bool(data['show_pronouns'])
        changed = True
    if 'dob_visible' in data:
        user.dob_visible = bool(data['dob_visible'])
        changed = True
    if 'phone' in data:
        raw_ph = data.get('phone')
        user.phone = (raw_ph.strip()[:32] if isinstance(raw_ph, str) and raw_ph.strip() else None)
        changed = True
    if 'date_of_birth' in data:
        raw_bd = data.get('date_of_birth')
        if raw_bd is None or raw_bd == '':
            user.date_of_birth = None
            changed = True
        elif isinstance(raw_bd, str):
            bd_parsed, bd_err = _parse_date_of_birth(raw_bd.strip())
            if bd_err:
                return jsonify({'error': bd_err}), 400
            user.date_of_birth = bd_parsed
            changed = True
    if 'username' in data:
        raw = _normalize_username(str(data['username'] or ''))
        if not raw:
            return jsonify({'error': 'Username cannot be empty'}), 400
        if not _USERNAME_RE.match(raw):
            return jsonify({'error': 'Username must be 3-30 characters, only lowercase letters, numbers, and underscores'}), 400
        if _is_username_taken(raw, exclude_user_id=user.id):
            return jsonify({
                'error': 'Username already taken',
                'suggestions': _suggest_usernames(raw, exclude_user_id=user.id),
            }), 409
        user.username = raw
        changed = True
    if changed:
        db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': _user_json(user, include_email=True)})


@api_v1.route('/auth/complete-registration', methods=['POST'])
@jwt_required
def complete_registration():
    """Mark signup finished after mobile user adds a profile photo (and optional profile fields)."""
    user = request.api_user
    if not (user.avatar_url or '').strip():
        return jsonify({'error': 'Add a profile photo before continuing.'}), 400
    user.registration_completed = True
    db.session.commit()
    return jsonify({'ok': True, 'user': _user_json(user, include_email=True)})


@api_v1.route('/auth/avatar', methods=['POST'])
@jwt_required
def upload_avatar():
    """Upload avatar image (multipart file or base64 JSON)."""
    import base64
    from ..models import ImageStore
    user = request.api_user
    img_bytes = None
    content_type = 'image/jpeg'

    # Method 1: multipart file upload
    if 'avatar' in request.files:
        f = request.files['avatar']
        if f and f.filename:
            img_bytes = f.read()
            content_type = f.content_type or 'image/jpeg'
    # Method 2: base64 JSON { "avatar_data": "data:image/png;base64,..." }
    elif request.is_json:
        b64_data = (request.get_json(silent=True) or {}).get('avatar_data', '')
        if b64_data and ',' in b64_data:
            header, b64 = b64_data.split(',', 1)
            content_type = header.split(':')[1].split(';')[0] if ':' in header else 'image/jpeg'
            img_bytes = base64.b64decode(b64)

    if not img_bytes:
        return jsonify({'error': 'No image data provided'}), 400
    if len(img_bytes) > 5 * 1024 * 1024:
        return jsonify({'error': 'Image too large (max 5 MB)'}), 400

    # Upload to Cloudinary (no DB fallback — saves space). Drop previous asset first.
    from ..services.image_service import (
        upload_avatar as cloud_upload, delete_avatar, delete_image_url,
    )
    old = user.avatar_url
    if old and 'res.cloudinary.com' in str(old):
        delete_image_url(old)
    delete_avatar(user.id)
    cloud_url = cloud_upload(img_bytes, user.id, content_type)
    if not cloud_url:
        return jsonify({'error': 'Image upload failed. Please try again.'}), 500

    user.avatar_url = cloud_url
    db.session.commit()
    return jsonify({'message': 'Avatar updated', 'avatar_url': _abs_url(cloud_url)})


@api_v1.route('/auth/avatar', methods=['DELETE'])
@jwt_required
def delete_avatar_api():
    """Delete profile photo from Cloudinary and clear user.avatar_url."""
    from ..services.image_service import delete_avatar, delete_image_url
    user = request.api_user
    if user.avatar_url and 'res.cloudinary.com' in str(user.avatar_url):
        delete_image_url(user.avatar_url)
    delete_avatar(user.id)
    user.avatar_url = None
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Avatar deleted'})


@api_v1.route('/auth/change-password', methods=['POST'])
@jwt_required
def change_password():
    """Change password (requires current password)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    current_pw = data.get('current_password', '')
    new_pw = data.get('new_password', '')
    confirm_pw = data.get('confirm_password', '')

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify({'error': 'All password fields are required'}), 400
    if new_pw != confirm_pw:
        return jsonify({'error': 'New passwords do not match'}), 400
    if len(new_pw) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if not user.check_password(current_pw):
        return jsonify({'error': 'Current password is incorrect'}), 400

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'})


@api_v1.route('/auth/delete-account', methods=['POST'])
@jwt_required
def delete_account():
    """Soft-delete the current user account and clean up Cloudinary assets.

    The user row is kept (``status='deleted'``) for audit + foreign-key safety,
    but every Cloudinary asset they own — avatar, every book cover, every voice
    story cover — is destroyed so we don't leak storage on the free CDN tier.
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')

    if not password:
        return jsonify({'error': 'Password is required to confirm deletion'}), 400
    if not user.check_password(password):
        return jsonify({'error': 'Incorrect password'}), 400

    # Cloudinary cleanup — best-effort, never blocks the soft-delete.
    try:
        from ..services.image_service import (
            delete_avatar as _del_avatar,
            delete_cover as _del_cover,
            delete_voice_cover as _del_voice_cover,
        )
        from ..models import Content, VoiceStory

        try:
            _del_avatar(user.id)
        except Exception as _exc:
            log.warning("delete-account avatar cleanup skipped for %s: %s", user.id, _exc)

        owned_books = Content.query.filter(
            (Content.creator_wiam_id == user.wiam_id) | (Content.creator_wiam_id == user.id)
        ).all() if user.wiam_id else []
        for _bk in owned_books:
            try:
                _del_cover(_bk.id)
            except Exception as _exc:
                log.warning("delete-account cover cleanup skipped for book %s: %s", _bk.id, _exc)

        if user.wiam_id:
            owned_voice = VoiceStory.query.filter_by(creator_wiam_id=user.wiam_id).all()
            for _vs in owned_voice:
                try:
                    target = _vs.cover_url if (_vs.cover_url and 'res.cloudinary.com' in _vs.cover_url) else _vs.id
                    _del_voice_cover(target)
                except Exception as _exc:
                    log.warning("delete-account voice cover cleanup skipped for story %s: %s", _vs.id, _exc)
    except Exception as _exc:
        log.warning("delete-account Cloudinary cleanup top-level failure: %s", _exc)

    user.status = 'deleted'
    db.session.commit()
    return jsonify({'message': 'Account deleted'})


# ---------------------------------------------------------------------------
# Creator Application (mobile)
# ---------------------------------------------------------------------------

@api_v1.route('/apply/submit', methods=['POST'])
@jwt_required
def apply_creator():
    """Tiny one-tap creator gate — pen name + Creator Terms checkbox.

    Replaces the old rubric-based application that scored a writing sample,
    story idea, and motivation paragraph. Wattpad / Webnovel / RoyalRoad all
    let any reader self-promote to writer in one tap, and the rubric was
    blocking real users (see ``deep_tracking_and_home_fix`` plan, workstream
    H). The only friction we keep is a cheap spam-pattern check on the pen
    name itself — if a user types ``asdf`` we ask them to pick something real.

    On success the user is *immediately* a creator (role + wiam_id +
    CreatorProfile + MonetizationStatus all populated by
    ``finalize_creator_upgrade``) and a typed ``creator_welcome`` push is
    queued so the mobile app deep-links into the WelcomeCreator tour.
    """
    user = request.api_user

    if user.is_creator:
        return jsonify({'error': 'You are already a creator'}), 400

    data = request.get_json(silent=True) or {}
    pen_name = (data.get('pen_name') or '').strip()
    accepted_terms = bool(data.get('accepted_terms'))

    if not pen_name or len(pen_name) < 2:
        return jsonify({'error': 'Please enter a pen name (at least 2 characters).'}), 400
    if len(pen_name) > 60:
        return jsonify({'error': 'Pen name must be 60 characters or less.'}), 400
    if not accepted_terms:
        return jsonify({'error': 'Please agree to the Creator Terms to continue.'}), 400

    # Cheap spam-pattern screen — placeholder strings like ``asdf`` / ``test`` /
    # ``lorem ipsum``. Anything else is fine. We are deliberately not running
    # the AI/keyword content_guard pass here because the tiny gate must feel
    # instant and creator-friendly; abuse is dealt with downstream.
    from ..services.creator_approval import _has_spam
    if _has_spam(pen_name):
        return jsonify({'error': 'That pen name looks like a placeholder. Pick something real.'}), 400

    from ..services.creator_activation import finalize_creator_upgrade
    finalize_creator_upgrade(user, pen_name_hint=pen_name)

    try:
        from ..services.analytics import track
        track('creator_upgrade', user, source='mobile', pen_name=pen_name[:80])
    except Exception:
        pass

    db.session.commit()

    fresh = User.query.get(user.id) or user

    try:
        from ..services.notifications import notify_creator_welcome
        notify_creator_welcome(fresh)
    except Exception as exc:
        log.warning("creator_welcome notify skipped for user=%s: %s", user.id, exc)

    return jsonify({
        'message': 'Welcome to WiamApp Creators! Your studio is unlocked.',
        'status': 'approved',
        'user': _me_json(fresh) if fresh else None,
    })


# ---------------------------------------------------------------------------
# HOME — Combined endpoint for mobile HomeScreen (1 call instead of 7)
# ---------------------------------------------------------------------------

@api_v1.route('/home')
@jwt_optional
def home_feed():
    """Return all data needed for the mobile HomeScreen in a single response.

    Home V2 — daily-rotating section system. The previous build returned a
    fixed 9-rail shape; this version returns:

    * ``sections[]`` — ordered list of sections selected by
      :func:`home_sections_v2.build_home`. Pinned sections (Continue
      Reading, For You, Spotlight, Top Rated, From Creators You Follow)
      always lead; 4-6 rotating sections follow, picked deterministically
      per user per day from a 16-section pool. Each section has shape
      ``{key, title, subtitle, icon, layout, books: [...]}``.
    * Legacy top-level keys (``spotlight``, ``pulse``, ``stream``,
      ``latest``, ``top_rated``, ``premium_picks``, ``continue_reading``,
      ``trending``, ``featured``, ``popular``, ``genres``, ``is_premium``,
      ``recommendation_sections``, ``custom_sections``) — retained so
      older mobile builds and the WiamVox app keep working without
      regression. Old clients ignore ``sections[]`` and read these
      directly. Removal target: once Render telemetry shows zero clients
      on the legacy shape (track via the mobile build version header).

    Cross-section invariant: a book never appears in two sections within
    one response. ``continue_reading`` is exempt because the user's
    library is independent of the public feed.
    """
    _empty = {
        'sections': [],
        'spotlight': [], 'pulse': [], 'stream': [],
        'latest': [], 'trending': [], 'featured': [], 'popular': [],
        'top_rated': [], 'premium_picks': [], 'continue_reading': [],
        'genres': [], 'is_premium': False,
        'recommendation_sections': [], 'custom_sections': [],
    }
    try:
        from ..services.home_sections_v2 import build_home
        from sqlalchemy import func as _fn

        user = request.api_user
        uid = (user.wiam_id or user.id) if user else None

        # Single pass: builds both new sections[] and legacy pools, runs
        # every fetcher exactly once, and returns the union of every book
        # ID we'll need to serialize so we can batch-load caches.
        home = build_home(user, target_count=8)
        all_ids = home['all_book_ids']

        if not all_ids and not home['continue_reading']:
            genres = Genre.query.order_by(Genre.name).all()
            _empty['genres'] = [{'id': g.id, 'name': g.name} for g in genres]
            return jsonify(_empty)

        # Union for batch caches — sections[] + legacy pools + continue_reading.
        union_book_map = {}
        for entry in home['sections']:
            for b in entry['books']:
                union_book_map[b.id] = b
        for pool in home['legacy_pools'].values():
            for b in pool:
                union_book_map[b.id] = b
        for b in home['continue_reading']:
            union_book_map[b.id] = b
        union_books = list(union_book_map.values())

        # Batch-load creators + profiles (2 queries total — kills N+1).
        creator_cache, profile_cache = _preload_creator_caches(union_books)

        # Batch-load rating / favorite / chapter aggregates (3 queries total).
        book_ids = [b.id for b in union_books]
        stats_cache = {
            bid: {'avg_rating': 0.0, 'rating_count': 0,
                  'chapter_count': 0, 'favorite_count': 0}
            for bid in book_ids
        }
        if book_ids:
            for row in (db.session.query(
                    Rating.content_id, _fn.avg(Rating.rating), _fn.count(Rating.id))
                    .filter(Rating.content_id.in_(book_ids))
                    .group_by(Rating.content_id)):
                stats_cache[row[0]]['avg_rating'] = round(float(row[1] or 0), 1)
                stats_cache[row[0]]['rating_count'] = row[2]
            for row in (db.session.query(
                    Favorite.content_id, _fn.count(Favorite.id))
                    .filter(Favorite.content_id.in_(book_ids))
                    .group_by(Favorite.content_id)):
                stats_cache[row[0]]['favorite_count'] = row[1]
            for row in (db.session.query(
                    WebBookContent.content_id, _fn.count(WebBookContent.id))
                    .filter(
                        WebBookContent.content_id.in_(book_ids),
                        WebBookContent.status == 'published')
                    .group_by(WebBookContent.content_id)):
                stats_cache[row[0]]['chapter_count'] = row[1]

        def _bj(b):
            return _book_json(
                b, user,
                _creator_cache=creator_cache,
                _profile_cache=profile_cache,
                _stats_cache=stats_cache,
            )

        # Reading-progress lookup for the continue_reading section. Loaded
        # once and indexed so the continue rail can attach
        # ``reading_progress`` metadata in O(1).
        prog_map = {}
        if user and home['continue_reading']:
            try:
                prog_uid = user.wiam_id or user.id
                cont_ids = [b.id for b in home['continue_reading']]
                rows = (ReadingProgress.query
                        .filter_by(user_id=prog_uid)
                        .filter(ReadingProgress.content_id.in_(cont_ids))
                        .all())
                prog_map = {p.content_id: p for p in rows}
            except Exception:
                try:
                    db.session.rollback()
                except Exception:
                    pass

        def _bj_with_progress(b):
            item = _bj(b)
            p = prog_map.get(b.id)
            if p and p.current_chapter and p.current_chapter > 0:
                item['reading_progress'] = {
                    'current_chapter': p.current_chapter,
                    'last_read_at': p.last_read_at.isoformat() if p.last_read_at else None,
                }
            return item

        # ── Build new sections[] array ──────────────────────────────
        sections_array = []
        for entry in home['sections']:
            section = entry['section']
            books = entry['books']
            if section.key == 'continue_reading':
                serialized = [_bj_with_progress(b) for b in books]
            else:
                serialized = [_bj(b) for b in books]
            sections_array.append({
                'key': section.key,
                'title': section.title,
                'subtitle': section.subtitle,
                'icon': section.icon,
                'layout': section.layout,
                'books': serialized,
            })

        # ── Build legacy keys (backwards compat) ────────────────────
        legacy = home['legacy_pools']
        spotlight_json = [_bj(b) for b in legacy.get('spotlight', [])]
        pulse_json = [_bj(b) for b in legacy.get('pulse', [])]
        stream_json = [_bj(b) for b in legacy.get('stream', [])]
        latest_json = [_bj(b) for b in legacy.get('latest', [])]
        top_rated_json = [_bj(b) for b in legacy.get('top_rated', [])]
        premium_json = [_bj(b) for b in legacy.get('premium_picks', [])]
        continue_reading_json = [
            _bj_with_progress(b) for b in home['continue_reading']
            if prog_map.get(b.id) is not None
            and prog_map[b.id].current_chapter
            and prog_map[b.id].current_chapter > 0
        ]

        genres = Genre.query.order_by(Genre.name).all()
        is_premium = user and getattr(user, 'premium_status', None) in ('active', 'trial')

        return jsonify({
            # Home V2 — daily-rotating section list (consumed by new clients).
            'sections': sections_array,
            # Legacy keys — fixed-shape rails for older mobile builds.
            'spotlight': spotlight_json,
            'pulse': pulse_json,
            'stream': stream_json,
            'latest': latest_json,
            'trending': pulse_json,
            'featured': spotlight_json,
            'popular': stream_json,
            'top_rated': top_rated_json,
            'premium_picks': premium_json,
            'continue_reading': continue_reading_json,
            'genres': [{'id': g.id, 'name': g.name} for g in genres],
            'is_premium': is_premium,
            'recommendation_sections': [],
            'custom_sections': [],
        })
    except Exception as exc:
        log.error("home_feed error: %s", exc, exc_info=True)
        try:
            db.session.rollback()
        except Exception:
            pass
        return jsonify(_empty)


# ---------------------------------------------------------------------------
# RECOMMENDATIONS
# ---------------------------------------------------------------------------

@api_v1.route('/recommendations')
@jwt_optional
def recommendations_api():
    """Full recommendation sections for the home screen."""
    user = request.api_user
    try:
        from ..services.recommendation_service import home_sections
        sections = home_sections(user, compact=False)
    except Exception as e:
        log.warning("Recommendation error: %s", str(e)[:120])
        sections = []
    return jsonify({'sections': sections})


@api_v1.route('/recommendations/similar/<int:book_id>')
@jwt_optional
def recommendations_similar(book_id):
    """Similar books for a given book."""
    try:
        from ..services.recommendation_service import similar_books
        books = similar_books(book_id, limit=request.args.get('limit', 10, type=int))
    except Exception:
        books = []
    return jsonify({'books': books})


@api_v1.route('/recommendations/genre/<genre>')
@jwt_optional
def recommendations_genre(genre):
    """Popular books in a genre."""
    try:
        from ..services.recommendation_service import popular_in_genre
        books = popular_in_genre(genre, limit=request.args.get('limit', 20, type=int))
    except Exception:
        books = []
    return jsonify({'books': books})


# ---------------------------------------------------------------------------
# READING LISTS — CRUD for user-curated book lists
# ---------------------------------------------------------------------------

@api_v1.route('/reading-lists')
@jwt_required
def reading_lists_index():
    """Get all reading lists for the authenticated user."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..models import ReadingList
    lists = ReadingList.query.filter_by(user_id=uid).order_by(ReadingList.updated_at.desc()).all()
    return jsonify({'lists': [_reading_list_json(rl) for rl in lists]})


@api_v1.route('/reading-lists', methods=['POST'])
@jwt_required
def reading_lists_create():
    """Create a new reading list."""
    user = request.api_user
    uid = user.wiam_id or user.id
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or 'My List').strip()[:80]
    description = (data.get('description') or '').strip()[:300]
    is_public = data.get('is_public', True)

    from ..models import ReadingList
    # Max 20 lists per user
    count = ReadingList.query.filter_by(user_id=uid).count()
    if count >= 20:
        return jsonify({'error': 'Maximum 20 reading lists allowed'}), 400

    rl = ReadingList(user_id=uid, name=name, description=description, is_public=bool(is_public))
    db.session.add(rl)
    db.session.commit()
    return jsonify({'list': _reading_list_json(rl)}), 201


@api_v1.route('/reading-lists/<int:list_id>')
@jwt_optional
def reading_lists_detail(list_id):
    """Get a reading list with its books."""
    from ..models import ReadingList, ReadingListItem
    rl = ReadingList.query.get(list_id)
    if not rl:
        return jsonify({'error': 'List not found'}), 404

    user = request.api_user
    uid = (user.wiam_id or user.id) if user else None

    # Private lists only visible to owner
    if not rl.is_public and (not uid or uid != rl.user_id):
        return jsonify({'error': 'List not found'}), 404

    items = ReadingListItem.query.filter_by(list_id=rl.id).order_by(ReadingListItem.sort_order).all()
    content_ids = [i.content_id for i in items]
    books_map = {}
    if content_ids:
        books = Content.query.filter(Content.id.in_(content_ids), Content.deleted_at.is_(None)).all()
        books_map = {b.id: b for b in books}

    books_out = []
    for item in items:
        book = books_map.get(item.content_id)
        if book:
            bj = _book_json(book, user)
            bj['list_note'] = item.note or ''
            bj['added_at'] = item.added_at.isoformat() if item.added_at else None
            books_out.append(bj)

    result = _reading_list_json(rl)
    result['books'] = books_out
    result['is_owner'] = uid == rl.user_id if uid else False
    return jsonify({'list': result})


@api_v1.route('/reading-lists/<int:list_id>', methods=['PUT', 'PATCH'])
@jwt_required
def reading_lists_update(list_id):
    """Update a reading list (name, description, visibility)."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..models import ReadingList
    rl = ReadingList.query.get(list_id)
    if not rl or rl.user_id != uid:
        return jsonify({'error': 'List not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        rl.name = (data['name'] or 'My List').strip()[:80]
    if 'description' in data:
        rl.description = (data['description'] or '').strip()[:300]
    if 'is_public' in data:
        rl.is_public = bool(data['is_public'])
    db.session.commit()
    return jsonify({'list': _reading_list_json(rl)})


@api_v1.route('/reading-lists/<int:list_id>', methods=['DELETE'])
@jwt_required
def reading_lists_delete(list_id):
    """Delete a reading list."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..models import ReadingList
    rl = ReadingList.query.get(list_id)
    if not rl or rl.user_id != uid:
        return jsonify({'error': 'List not found'}), 404
    db.session.delete(rl)
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/reading-lists/<int:list_id>/items', methods=['POST'])
@jwt_required
def reading_lists_add_item(list_id):
    """Add a book to a reading list."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..models import ReadingList, ReadingListItem
    rl = ReadingList.query.get(list_id)
    if not rl or rl.user_id != uid:
        return jsonify({'error': 'List not found'}), 404

    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id') or data.get('book_id')
    if not content_id:
        return jsonify({'error': 'content_id required'}), 400

    # Verify book exists
    book = Content.query.get(content_id)
    if not book or book.deleted_at:
        return jsonify({'error': 'Book not found'}), 404

    # Check duplicate
    existing = ReadingListItem.query.filter_by(list_id=rl.id, content_id=content_id).first()
    if existing:
        return jsonify({'error': 'Book already in list'}), 409

    # Max 100 items per list
    if rl.item_count >= 100:
        return jsonify({'error': 'Maximum 100 books per list'}), 400

    note = (data.get('note') or '').strip()[:200]
    item = ReadingListItem(list_id=rl.id, content_id=content_id, sort_order=rl.item_count, note=note)
    db.session.add(item)
    rl.item_count = (rl.item_count or 0) + 1
    if not rl.cover_book_id:
        rl.cover_book_id = content_id
    db.session.commit()
    return jsonify({'ok': True, 'item_count': rl.item_count}), 201


@api_v1.route('/reading-lists/<int:list_id>/items/<int:content_id>', methods=['DELETE'])
@jwt_required
def reading_lists_remove_item(list_id, content_id):
    """Remove a book from a reading list."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..models import ReadingList, ReadingListItem
    rl = ReadingList.query.get(list_id)
    if not rl or rl.user_id != uid:
        return jsonify({'error': 'List not found'}), 404

    item = ReadingListItem.query.filter_by(list_id=rl.id, content_id=content_id).first()
    if not item:
        return jsonify({'error': 'Item not found'}), 404

    db.session.delete(item)
    rl.item_count = max(0, (rl.item_count or 1) - 1)
    # Update cover if removed book was the cover
    if rl.cover_book_id == content_id:
        first = ReadingListItem.query.filter_by(list_id=rl.id).order_by(ReadingListItem.sort_order).first()
        rl.cover_book_id = first.content_id if first else None
    db.session.commit()
    return jsonify({'ok': True, 'item_count': rl.item_count})


def _reading_list_json(rl):
    """Serialize a ReadingList to dict."""
    cover_url = None
    if rl.cover_book_id:
        book = Content.query.get(rl.cover_book_id)
        if book:
            cover_url = _abs_url(book.cover_url)
    return {
        'id': rl.id,
        'name': rl.name,
        'description': rl.description,
        'is_public': rl.is_public,
        'item_count': rl.item_count or 0,
        'cover_url': cover_url,
        'created_at': rl.created_at.isoformat() if rl.created_at else None,
        'updated_at': rl.updated_at.isoformat() if rl.updated_at else None,
    }


# ---------------------------------------------------------------------------
# BOOKS — List, Detail, Chapters, Read
# ---------------------------------------------------------------------------

@api_v1.route('/books')
@jwt_optional
def books_list():
    """List published books with filters and pagination."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)
    genre = request.args.get('genre')
    sort = request.args.get('sort', 'latest')  # latest | popular | top_rated

    query = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    )

    if genre:
        query = query.filter(Content.genre.ilike(f'%{genre}%'))

    if sort == 'popular':
        query = query.order_by(Content.views.desc().nullslast())
    elif sort == 'top_rated':
        query = query.order_by(Content.views.desc().nullslast())
    else:
        query = query.order_by(Content.created_at.desc())

    total = query.count()
    books = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'books': [_book_json(b, request.api_user) for b in books],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page,
    })


@api_v1.route('/books/<int:book_id>')
@jwt_optional
def book_detail(book_id):
    """Get book detail with chapters, creator info, and user state."""
    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404
    if not book.is_published and (not request.api_user or book.creator_wiam_id != (request.api_user.wiam_id if request.api_user else None)):
        return jsonify({'error': 'Book not found'}), 404

    data = _book_json(book, request.api_user)

    # Chapters list
    chapters = WebBookContent.query.filter_by(
        content_id=book_id, status='published'
    ).order_by(WebBookContent.chapter_number).all()
    inferred_unit = 'chapter'
    if chapters:
        inferred_unit = _normalize_unit_label(chapters[0].content_unit_label or 'chapter')
    data['content_unit_label'] = inferred_unit
    data['chapters'] = [{
        'number': ch.chapter_number,
        'title': ch.chapter_title or _unit_title(ch.content_unit_label or inferred_unit, ch.chapter_number),
        'unit_label': _normalize_unit_label(ch.content_unit_label or inferred_unit),
        'content_kind': (ch.content_kind or '').strip().lower() or None,
        'word_count': ch.word_count,
        'is_locked': ch.is_locked,
        'chapter_price': ch.chapter_price,
    } for ch in chapters]

    # Follower info
    creator = book.creator
    if creator:
        data['creator']['follower_count'] = Follow.query.filter_by(creator_id=creator.id).count()
        if request.api_user and request.api_user.id != creator.id:
            data['creator']['is_following'] = Follow.query.filter_by(
                user_id=request.api_user.id, creator_id=creator.id
            ).first() is not None
        else:
            data['creator']['is_following'] = False

    # Reading progress — must match /reader/save-position (uses wiam_id when set)
    if request.api_user:
        prog_uid = request.api_user.wiam_id or request.api_user.id
        progress = ReadingProgress.query.filter_by(
            user_id=prog_uid, content_id=book_id
        ).first()
        if progress:
            rp = {
                'current_chapter': progress.current_chapter,
                'current_position': progress.current_position or 0,
                'last_read_at': progress.last_read_at.isoformat() if progress.last_read_at else None,
            }
            try:
                rp['current_paragraph'] = progress.current_paragraph or 0
            except Exception:
                rp['current_paragraph'] = 0
            data['reading_progress'] = rp
        else:
            data['reading_progress'] = None

    # Reviews
    reviews = Review.query.filter_by(content_id=book_id).order_by(Review.created_at.desc()).limit(10).all()
    data['reviews'] = []
    for rev in reviews:
        reviewer = User.query.get(rev.user_id)
        data['reviews'].append({
            'id': rev.id,
            'text': rev.text,
            'created_at': rev.created_at.isoformat(),
            'like_count': rev.like_count,
            'user': {
                'id': reviewer.id,
                'display_name': reviewer.display_name,
                'avatar_url': _abs_url(reviewer.avatar_url),
            } if reviewer else None,
        })

    # Similar books (Readers Also Enjoyed)
    try:
        from ..services.recommendation_service import similar_books as _sim_books
        data['similar_books'] = _sim_books(book_id, limit=10)
    except Exception:
        data['similar_books'] = []

    # Creator subscription info
    try:
        from ..services.creator_sub_service import (
            check_subscription as _csub_check, get_subscriber_perks as _csub_perks,
            get_creator_tiers as _csub_tiers, tier_to_dict as _tier_dict,
            is_creator_eligible_for_subs as _csub_eligible, get_subscriber_count,
        )
        creator_id = book.creator_wiam_id
        eligible, _ = _csub_eligible(creator) if creator else (False, '')
        data['creator_subscription'] = {
            'eligible': eligible,
            'tiers': [_tier_dict(t) for t in _csub_tiers(creator_id)] if eligible else [],
            'subscriber_count': get_subscriber_count(creator_id) if eligible else 0,
        }
        if request.api_user and creator_id:
            sub = _csub_check(request.api_user.id, creator_id)
            perks = _csub_perks(request.api_user.id, creator_id)
            data['creator_subscription']['is_subscribed'] = sub is not None and sub.is_valid if sub else False
            data['creator_subscription']['perks'] = perks
        else:
            data['creator_subscription']['is_subscribed'] = False
            data['creator_subscription']['perks'] = {}
    except Exception:
        data['creator_subscription'] = {'eligible': False, 'tiers': [], 'is_subscribed': False}

    return jsonify(data)


@api_v1.route('/books/<int:book_id>/chapters/<int:ch_num>')
@jwt_optional
def read_chapter(book_id, ch_num):
    """Read a chapter's content."""
    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num, status='published'
    ).first()
    if not chapter:
        return jsonify({'error': 'Chapter not found'}), 404

    # Check if locked and user has access
    is_coin_locked = chapter.is_locked and chapter.chapter_price
    is_premium_locked = getattr(chapter, 'is_premium_locked', False)
    if (is_coin_locked or is_premium_locked) and request.api_user:
        uid = request.api_user.id
        wiam_id = request.api_user.wiam_id
        is_creator = book.creator_wiam_id == wiam_id
        # Premium subscribers bypass premium-locked chapters
        user_is_premium = request.api_user.premium_status in ('active', 'trial')
        if user_is_premium and request.api_user.premium_expires_at:
            if datetime.utcnow() > request.api_user.premium_expires_at:
                user_is_premium = False
        if not is_creator and not (is_premium_locked and user_is_premium):
            has_access = Access.query.filter_by(
                user_id=uid, content_id=book_id, status='active'
            ).first() is not None
            has_unlock = ChapterUnlock.query.filter(
                ChapterUnlock.content_id == book_id,
                ChapterUnlock.chapter_number == ch_num,
                db.or_(ChapterUnlock.user_id == uid, ChapterUnlock.user_id == wiam_id),
            ).first() is not None
            if not has_access and not has_unlock:
                return jsonify({
                    'error': 'Chapter is locked',
                    'locked': True,
                    'price': chapter.chapter_price or 0,
                    'premium_locked': bool(is_premium_locked),
                }), 403
    elif (is_coin_locked or is_premium_locked) and not request.api_user:
        return jsonify({'error': 'Login required to read locked chapters', 'locked': True}), 401

    # Update reading progress (same user_id scheme as POST /reader/save-position)
    if request.api_user:
        prog_uid = request.api_user.wiam_id or request.api_user.id
        progress = ReadingProgress.query.filter_by(
            user_id=prog_uid, content_id=book_id
        ).first()
        if progress:
            progress.current_chapter = ch_num
            progress.last_read_at = datetime.utcnow()
        else:
            progress = ReadingProgress(
                user_id=prog_uid,
                content_id=book_id,
                current_chapter=ch_num,
            )
            db.session.add(progress)
        db.session.commit()

    # Views are now tracked via time-based /record-view endpoint (not on page load)

    # Get chapter comments
    comments = ChapterComment.query.filter_by(
        content_id=book_id, chapter_number=ch_num, is_deleted=False
    ).order_by(ChapterComment.created_at.desc()).limit(50).all()
    comments_data = []
    # Check subscriber status for badge + perks
    creator_wiam_id = book.creator_wiam_id
    reader_sub_perks = {}
    try:
        from ..services.creator_sub_service import get_subscriber_perks as _gsp
        if request.api_user:
            reader_sub_perks = _gsp(request.api_user.id, creator_wiam_id)
    except Exception:
        pass
    # Build a set of subscriber user_ids for this creator (for badge display)
    subscriber_ids = set()
    try:
        from ..models import CreatorSubscription as _CS
        sub_rows = _CS.query.filter_by(creator_id=creator_wiam_id, status='active').all()
        subscriber_ids = {s.subscriber_id for s in sub_rows}
    except Exception:
        pass

    for c in comments:
        commenter = User.query.get(c.user_id) or User.query.filter_by(wiam_id=c.user_id).first()
        comments_data.append({
            'id': c.id,
            'text': c.text,
            'created_at': c.created_at.isoformat(),
            'like_count': c.like_count,
            'is_subscriber': (commenter.id in subscriber_ids) if commenter else False,
            'user': {
                'id': commenter.id,
                'display_name': commenter.display_name,
                'avatar_url': commenter.avatar_url,
            } if commenter else {'id': 0, 'display_name': 'Unknown', 'avatar_url': None},
        })

    # Total chapters for navigation
    total_chapters = WebBookContent.query.filter_by(
        content_id=book_id, status='published'
    ).count()

    # Subscriber note (author notes perk)
    subscriber_note = None
    if reader_sub_perks.get('author_notes'):
        subscriber_note = getattr(chapter, 'subscriber_note', None)

    return jsonify({
        'book_id': book_id,
        'chapter_number': ch_num,
        'chapter_title': chapter.chapter_title or _unit_title(chapter.content_unit_label, ch_num),
        'unit_label': _normalize_unit_label(chapter.content_unit_label or 'chapter'),
        'content_kind': (chapter.content_kind or '').strip().lower() or None,
        'body': chapter.body,
        'word_count': chapter.word_count,
        'total_chapters': total_chapters,
        'has_next': ch_num < total_chapters,
        'has_prev': ch_num > 1,
        'comments': comments_data,
        'subscriber_note': subscriber_note,
        'reader_perks': reader_sub_perks,
    })


# ---------------------------------------------------------------------------
# LIBRARY & TIPS (mobile-native actions)
# ---------------------------------------------------------------------------

@api_v1.route('/books/<int:book_id>/library/toggle', methods=['POST'])
@jwt_required
def toggle_library_api(book_id):
    """Add/remove a book from the user's library shelf."""
    user = request.api_user
    uid = user.wiam_id or user.id
    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    existing = UserLibrary.query.filter_by(user_id=uid, content_id=book_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'in_library': False})

    db.session.add(UserLibrary(user_id=uid, content_id=book_id))
    db.session.commit()
    return jsonify({'in_library': True})


@api_v1.route('/library')
@jwt_required
def my_library_api():
    """Return reader library books + reading progress for mobile."""
    user = request.api_user
    uid = user.wiam_id or user.id
    entries = UserLibrary.query.filter_by(user_id=uid).order_by(UserLibrary.added_at.desc()).limit(100).all()
    content_ids = [e.content_id for e in entries]
    books = []
    if content_ids:
        books = Content.query.filter(
            Content.id.in_(content_ids),
            Content.deleted_at.is_(None),
        ).all()
    book_map = {b.id: b for b in books}
    progress_rows = ReadingProgress.query.filter_by(user_id=uid).limit(100).all()
    progress_map = {p.content_id: p for p in progress_rows}

    out = []
    for cid in content_ids:
        b = book_map.get(cid)
        if not b:
            continue
        p = progress_map.get(cid)
        item = _book_json(b, user)
        item['reading_progress'] = {
            'current_chapter': p.current_chapter,
            'last_read_at': p.last_read_at.isoformat() if p.last_read_at else None,
        } if p else None
        out.append(item)
    return jsonify({'books': out})


@api_v1.route('/books/<int:book_id>/tip', methods=['POST'])
@jwt_required
def tip_creator_api(book_id):
    """Tip a creator with coins from mobile app."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    amount = data.get('amount', 0)
    if not isinstance(amount, int) or amount < 1:
        return jsonify({'error': 'Invalid tip amount'}), 400
    if amount > 100:
        return jsonify({'error': 'Maximum tip is 100 coins'}), 400

    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404
    creator = book.creator
    if not creator:
        return jsonify({'error': 'Creator not found'}), 404
    if creator.id == user.id:
        return jsonify({'error': 'You cannot tip yourself'}), 400

    # v5 ledger: record tip through double-entry ledger
    try:
        from ..services.ledger import record_tip
        result = record_tip(user.wiam_id or user.id, creator.wiam_id, book_id, amount)
        if result.get('error'):
            if 'Not enough' in result['error']:
                bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
                return jsonify({'error': result['error'], 'need_coins': True,
                                'balance': bal.balance if bal else 0}), 402
            return jsonify({'error': result['error']}), 400
        new_balance = result['balance']
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Ledger tip error, falling back: %s", e)
        bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
        if not bal:
            bal = CoinBalance(user_id=user.wiam_id or user.id, balance=0, total_purchased=0, total_spent=0)
            db.session.add(bal)
            db.session.flush()
        if bal.balance < amount:
            return jsonify({'error': 'Not enough coins', 'need_coins': True, 'balance': bal.balance}), 402
        bal.balance -= amount
        bal.total_spent += amount
        bal.updated_at = datetime.utcnow()
        tx = CoinTransaction(
            user_id=user.wiam_id or user.id, type='tip', amount=-amount,
            balance_after=bal.balance,
            description=f'Tipped {amount} coins on "{book.title}"',
            content_id=book_id, recipient_id=creator.wiam_id,
        )
        db.session.add(tx)
        new_balance = bal.balance

    # Track creator earnings
    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=creator.wiam_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(creator_id=creator.wiam_id, year=now.year, month=now.month)
        db.session.add(earn)
    earn.coins_from_tips += amount
    earn.total_coins = (earn.coins_from_unlocks or 0) + (earn.coins_from_tips or 0)
    from ..services.monetization import COIN_TO_GHS
    share_pct = RevenueRule.get_creator_share(creator.id) or 50.0
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = now

    db.session.commit()
    return jsonify({'ok': True, 'balance': new_balance, 'amount': amount})


# ---------------------------------------------------------------------------
# Reading Position (JWT version for mobile)
# ---------------------------------------------------------------------------

@api_v1.route('/reader/save-position', methods=['POST'])
@jwt_required
def save_position_api():
    """Save the reader's scroll position (0-100%) for a chapter — JWT version."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter_number = data.get('chapter_number', 0)
    position = data.get('position', 0)
    paragraph_index = data.get('paragraph_index', 0)
    if not content_id or not chapter_number:
        return jsonify(ok=False, error='Missing content_id or chapter_number'), 400

    uid = user.wiam_id or user.id
    progress = ReadingProgress.query.filter_by(user_id=uid, content_id=content_id).first()
    if progress:
        progress.current_chapter = chapter_number
        progress.current_position = min(100, max(0, int(position)))
        try:
            progress.current_paragraph = max(0, int(paragraph_index))
        except Exception:
            pass
        progress.last_read_at = datetime.utcnow()
    else:
        kwargs = dict(
            user_id=uid, content_id=content_id,
            current_chapter=chapter_number,
            current_position=min(100, max(0, int(position))),
        )
        try:
            kwargs['current_paragraph'] = max(0, int(paragraph_index))
        except Exception:
            pass
        progress = ReadingProgress(**kwargs)
        db.session.add(progress)
    db.session.commit()
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# Paragraph Reactions & Comments (JWT versions for mobile)
# ---------------------------------------------------------------------------

ALLOWED_EMOJIS = ['❤️', '😂', '😭', '😡', '😮', '🔥']


@api_v1.route('/reader/react', methods=['POST'])
@jwt_required
def react_api():
    """Add/update/remove an emoji reaction on a paragraph — JWT version."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter = data.get('chapter_number', 0)
    para = data.get('paragraph_index', 0)
    emoji = data.get('emoji', '')

    if emoji and emoji not in ALLOWED_EMOJIS:
        return jsonify(ok=False, error='Invalid emoji.'), 400

    uid = user.wiam_id or user.id
    existing = ParagraphReaction.query.filter_by(
        user_id=uid, content_id=content_id,
        chapter_number=chapter, paragraph_index=para
    ).first()

    if not emoji:
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify(ok=True, removed=True)

    if existing:
        if existing.emoji == emoji:
            db.session.delete(existing)
            db.session.commit()
            return jsonify(ok=True, removed=True)
        existing.emoji = emoji
        existing.updated_at = datetime.utcnow()
    else:
        r = ParagraphReaction(
            user_id=uid, content_id=content_id,
            chapter_number=chapter, paragraph_index=para,
            emoji=emoji,
        )
        db.session.add(r)

    db.session.commit()
    return jsonify(ok=True, emoji=emoji)


@api_v1.route('/reader/reactions', methods=['GET'])
@jwt_required
def get_reactions_api():
    """Batch-fetch all reactions for a chapter — JWT version."""
    user = request.api_user
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)

    rows = ParagraphReaction.query.filter_by(
        content_id=content_id, chapter_number=chapter
    ).all()

    uid = user.wiam_id or user.id
    paras = {}
    user_reactions = {}
    for r in rows:
        pi = r.paragraph_index
        if pi not in paras:
            paras[pi] = {}
        paras[pi][r.emoji] = paras[pi].get(r.emoji, 0) + 1
        if r.user_id == uid:
            user_reactions[pi] = r.emoji

    return jsonify(ok=True, reactions=paras, user_reactions=user_reactions)


@api_v1.route('/reader/comment', methods=['POST'])
@jwt_required
def add_comment_api():
    """Add a comment on a paragraph — JWT version."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter = data.get('chapter_number', 0)
    para = data.get('paragraph_index', 0)
    text = (data.get('text', '') or '').strip()[:1000]
    parent_id = data.get('parent_id')

    if not text:
        return jsonify(ok=False, error='Comment cannot be empty.'), 400

    uid = user.wiam_id or user.id

    c = ParagraphComment(
        parent_id=parent_id if parent_id else None,
        user_id=uid, content_id=content_id,
        chapter_number=chapter, paragraph_index=para,
        text=text,
    )
    db.session.add(c)

    try:
        from ..services.analytics import track
        track(
            'comment',
            user,
            content_id=content_id if isinstance(content_id, int) else None,
            chapter_number=chapter if isinstance(chapter, int) else None,
            paragraph_index=para if isinstance(para, int) else None,
            is_reply=bool(parent_id),
        )
    except Exception:
        pass
    db.session.commit()

    # Notify the right people. We do this AFTER commit so a notification failure
    # never rolls back the comment itself.
    try:
        commenter_name = (user.display_name or user.first_name or 'A reader').strip()
        book_for_notify = Content.query.get(content_id) if isinstance(content_id, int) else None
        book_title_for_notify = (book_for_notify.title if book_for_notify else '') or 'a story'
        ch_num = chapter if isinstance(chapter, int) and chapter else None
        if parent_id:
            # Reply: notify the parent comment's author (unless they're replying to themselves).
            parent = ParagraphComment.query.get(parent_id)
            if parent and parent.user_id and parent.user_id != uid:
                from ..services.notifications import notify_comment_reply
                try:
                    notify_comment_reply(
                        parent.user_id,
                        commenter_name,
                        book_title_for_notify,
                        book_for_notify.id if book_for_notify else (content_id or 0),
                        ch_num,
                    )
                except Exception:
                    pass
        else:
            # Top-level comment: notify the creator (unless they're commenting on their own story).
            if book_for_notify and book_for_notify.creator_wiam_id and book_for_notify.creator_wiam_id != uid:
                from ..services.notifications import notify_comment
                try:
                    notify_comment(
                        book_for_notify.creator_wiam_id,
                        commenter_name,
                        book_title_for_notify,
                        book_for_notify.id,
                        ch_num,
                    )
                except Exception:
                    pass
    except Exception:
        pass

    return jsonify(ok=True, comment={
        'id': c.id,
        'text': c.text,
        'user_name': user.display_name or user.first_name or 'User',
        'user_initial': ((user.display_name or user.first_name or 'U')[0]).upper(),
        'user_id': uid,
        'is_own': True,
        'can_delete': True,
        'created_at': c.created_at.strftime('%b %d, %H:%M') if c.created_at else '',
        'like_count': 0,
        'liked': False,
        'parent_id': c.parent_id,
        'replies': [],
    })


@api_v1.route('/reader/comments', methods=['GET'])
@jwt_required
def get_comments_api():
    """Get all comments for a paragraph — JWT version."""
    user = request.api_user
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)
    para = request.args.get('paragraph_index', 0, type=int)
    sort = request.args.get('sort', 'newest')

    uid = user.wiam_id or user.id

    # Check if current user is the book creator
    book = Content.query.get(content_id)
    is_book_creator = False
    if book and book.creator_wiam_id:
        is_book_creator = book.creator_wiam_id in (user.wiam_id, user.id)

    q = ParagraphComment.query.filter_by(
        content_id=content_id, chapter_number=chapter,
        paragraph_index=para, parent_id=None, is_deleted=False,
    )
    if sort == 'top':
        # Premium users' comments get a boost (+1000 to like_count for sorting)
        from sqlalchemy import case
        premium_boost = case(
            (User.premium_status.in_(['active', 'trial']), 1000),
            else_=0,
        )
        q = q.outerjoin(User, ParagraphComment.user_id == User.wiam_id)
        q = q.order_by(
            (ParagraphComment.like_count + premium_boost).desc(),
            ParagraphComment.created_at.desc(),
        )
    else:
        q = q.order_by(ParagraphComment.created_at.desc())

    comments = q.limit(50).all()

    all_ids = [c.id for c in comments]
    for c in comments:
        all_ids.extend([r.id for r in c.replies])
    liked_ids = set()
    if all_ids:
        liked = ParagraphCommentLike.query.filter(
            ParagraphCommentLike.comment_id.in_(all_ids),
            ParagraphCommentLike.user_id == uid,
        ).all()
        liked_ids = {lk.comment_id for lk in liked}

    def fmt(c):
        u = c.user
        is_own = (c.user_id == uid)
        _plan = None
        if u and getattr(u, 'premium_status', None) in ('active', 'trial'):
            _plan = u.premium_plan
        return {
            'id': c.id,
            'text': c.text,
            'user_name': u.display_name if u else 'User',
            'user_initial': ((u.display_name if u else 'U')[0]).upper(),
            'user_id': c.user_id,
            'is_own': is_own,
            'can_delete': is_own or is_book_creator,
            'created_at': c.created_at.strftime('%b %d, %H:%M') if c.created_at else '',
            'like_count': c.like_count,
            'liked': c.id in liked_ids,
            'parent_id': c.parent_id,
            'premium_plan': _plan,
            'replies': [fmt(r) for r in c.replies],
        }

    return jsonify(ok=True, comments=[fmt(c) for c in comments])


@api_v1.route('/reader/comment-counts', methods=['GET'])
@jwt_required
def comment_counts_api():
    """Batch-fetch comment counts per paragraph — JWT version."""
    user = request.api_user
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)

    from sqlalchemy import func
    rows = db.session.query(
        ParagraphComment.paragraph_index,
        func.count(ParagraphComment.id)
    ).filter_by(
        content_id=content_id, chapter_number=chapter, is_deleted=False,
    ).group_by(ParagraphComment.paragraph_index).all()

    counts = {pi: cnt for pi, cnt in rows}
    return jsonify(ok=True, counts=counts)


@api_v1.route('/reader/comment/<int:comment_id>/like', methods=['POST'])
@jwt_required
def like_comment_api(comment_id):
    """Toggle like on a paragraph comment — JWT version."""
    user = request.api_user
    uid = user.wiam_id or user.id
    c = ParagraphComment.query.get_or_404(comment_id)

    existing = ParagraphCommentLike.query.filter_by(
        comment_id=comment_id, user_id=uid
    ).first()

    if existing:
        db.session.delete(existing)
        c.like_count = max(0, (c.like_count or 0) - 1)
        liked = False
    else:
        db.session.add(ParagraphCommentLike(comment_id=comment_id, user_id=uid))
        c.like_count = (c.like_count or 0) + 1
        liked = True

    try:
        from ..services.analytics import track
        track(
            'comment_like' if liked else 'comment_unlike',
            user,
            content_id=getattr(c, 'content_id', None),
            chapter_number=getattr(c, 'chapter_number', None),
            comment_id=c.id,
        )
    except Exception:
        pass

    db.session.commit()
    return jsonify(ok=True, liked=liked, count=c.like_count)


@api_v1.route('/reader/comment/<int:comment_id>/delete', methods=['POST'])
@jwt_required
def delete_comment_api(comment_id):
    """Soft-delete a comment (own or book creator) — JWT version."""
    user = request.api_user
    uid = user.wiam_id or user.id
    c = ParagraphComment.query.get_or_404(comment_id)

    # Allow comment owner OR book creator to delete
    is_owner = (c.user_id == uid)
    is_book_creator = False
    if not is_owner:
        book = Content.query.get(c.content_id)
        if book and book.creator_wiam_id and book.creator_wiam_id in (user.wiam_id, user.id):
            is_book_creator = True

    if not is_owner and not is_book_creator:
        return jsonify(ok=False, error='Not allowed.'), 403

    c.is_deleted = True
    c.text = '[deleted]'
    db.session.commit()
    return jsonify(ok=True)


@api_v1.route('/reader/comment/<int:comment_id>/report', methods=['POST'])
@jwt_required
def report_comment_api(comment_id):
    """Report a paragraph comment for moderation review."""
    user = request.api_user
    uid = user.wiam_id or user.id
    c = ParagraphComment.query.get_or_404(comment_id)
    data = request.get_json(silent=True) or {}

    category = (data.get('category') or 'other').strip().lower()[:32]
    if category not in ('spam', 'harassment', 'hate', 'plagiarism', 'nsfw', 'other'):
        category = 'other'
    description = (data.get('description') or '').strip()[:1000]

    # Prevent self-reporting noise
    if c.user_id == uid:
        return jsonify(ok=False, error='You cannot report your own comment.'), 400

    existing = Report.query.filter_by(
        reporter_user_id=uid,
        target_type='COMMENT',
        target_id=comment_id,
        status='OPEN',
    ).first()
    if existing:
        return jsonify(ok=True, already_reported=True, report_id=existing.id)

    report = Report(
        reporter_user_id=uid,
        target_type='COMMENT',
        target_id=comment_id,
        category=category,
        description=description or f'Reader comment report (content={c.content_id}, chapter={c.chapter_number})',
        status='OPEN',
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(ok=True, report_id=report.id, already_reported=False)


@api_v1.route('/notifications', methods=['GET'])
@jwt_required
def notifications_api():
    """JWT notifications feed for mobile app."""
    user = request.api_user
    uid = user.wiam_id or user.id
    rows = Notification.query.filter_by(user_id=uid).order_by(Notification.created_at.desc()).limit(50).all()
    now = datetime.utcnow()

    def _time_ago(dt):
        if not dt:
            return ''
        diff = int((now - dt).total_seconds())
        if diff < 60:
            return 'just now'
        if diff < 3600:
            return f'{diff // 60}m ago'
        if diff < 86400:
            return f'{diff // 3600}h ago'
        return f'{diff // 86400}d ago'

    unread_count = Notification.query.filter_by(user_id=uid, is_read=False).count()
    return jsonify({
        'notifications': [{
            'id': n.id,
            'type': n.type or 'system',
            'title': n.title or 'Notification',
            'message': n.message or '',
            'link_url': n.link or '',
            'is_read': bool(n.is_read),
            'created_at': n.created_at.isoformat() if n.created_at else None,
            'time_ago': _time_ago(n.created_at),
        } for n in rows],
        'unread_count': unread_count,
    })


@api_v1.route('/notifications/<int:notif_id>/read', methods=['POST'])
@jwt_required
def notifications_mark_read_api(notif_id):
    """Mark a notification as read for the current user."""
    user = request.api_user
    uid = user.wiam_id or user.id
    n = Notification.query.filter_by(id=notif_id, user_id=uid).first()
    if not n:
        return jsonify({'error': 'Notification not found'}), 404
    n.is_read = True
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/notifications/mark-all-read', methods=['POST'])
@jwt_required
def notifications_mark_all_read_api():
    """Mark every notification as read for the current user."""
    user = request.api_user
    uid = user.wiam_id or user.id
    updated = Notification.query.filter_by(user_id=uid, is_read=False).update(
        {Notification.is_read: True}, synchronize_session=False
    )
    db.session.commit()
    return jsonify({'ok': True, 'updated': int(updated or 0)})


@api_v1.route('/notifications/<int:notif_id>', methods=['DELETE'])
@jwt_required
def notifications_delete_api(notif_id):
    """Delete a single notification."""
    user = request.api_user
    uid = user.wiam_id or user.id
    n = Notification.query.filter_by(id=notif_id, user_id=uid).first()
    if not n:
        return jsonify({'error': 'Notification not found'}), 404
    db.session.delete(n)
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/notifications/clear', methods=['DELETE'])
@jwt_required
def notifications_clear_api():
    """Delete all notifications for the current user (cleans the inbox)."""
    user = request.api_user
    uid = user.wiam_id or user.id
    deleted = Notification.query.filter_by(user_id=uid).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({'ok': True, 'deleted': int(deleted or 0)})


@api_v1.route('/gifts/received', methods=['GET'])
@jwt_required
def gifts_received_api():
    """Return sticker gifts received by current user."""
    user = request.api_user
    uid = user.wiam_id or user.id
    rows = StickerGift.query.filter_by(recipient_id=uid).order_by(StickerGift.created_at.desc()).limit(100).all()
    sender_ids = list({g.sender_id for g in rows if g.sender_id})
    senders = {}
    if sender_ids:
        users = User.query.filter(User.wiam_id.in_(sender_ids)).all()
        senders = {u.wiam_id: u for u in users}
    sticker_meta = {
        'balloon': {'emoji': '🎈', 'label': 'Balloon'},
        'lollipop': {'emoji': '🍭', 'label': 'Lollipop'},
        'candy': {'emoji': '🍬', 'label': 'Candy'},
        'chocolate': {'emoji': '🍫', 'label': 'Chocolate'},
        'coffee': {'emoji': '☕', 'label': 'Coffee'},
        'donut': {'emoji': '🍩', 'label': 'Donut'},
        'cupcake': {'emoji': '🧁', 'label': 'Cupcake'},
        'icecream': {'emoji': '🍧', 'label': 'Ice Cream'},
        'cone': {'emoji': '🍦', 'label': 'Cone'},
        'watermelon': {'emoji': '🍉', 'label': 'Watermelon'},
        'party': {'emoji': '🎉', 'label': 'Party'},
        'confetti': {'emoji': '🎊', 'label': 'Confetti'},
        'gift': {'emoji': '🎁', 'label': 'Gift Box'},
        'heart': {'emoji': '♥️', 'label': 'Heart'},
        'cocktail': {'emoji': '🍹', 'label': 'Cocktail'},
        'sunglasses': {'emoji': '🕶️', 'label': 'Cool'},
        'backpack': {'emoji': '🎒', 'label': 'Backpack'},
        'beer': {'emoji': '🍻', 'label': 'Cheers'},
        'champagne': {'emoji': '🥂', 'label': 'Champagne'},
        'bottle': {'emoji': '🍾', 'label': 'Celebrate'},
    }

    return jsonify({
        'gifts': [{
            'id': g.id,
            'sticker_key': g.sticker_key,
            'sticker_emoji': sticker_meta.get(g.sticker_key, {}).get('emoji', '🎁'),
            'sticker_name': sticker_meta.get(g.sticker_key, {}).get('label', (g.sticker_key or 'gift').replace('_', ' ').title()),
            'sender_id': g.sender_id,
            'sender_name': (senders.get(g.sender_id).display_name if senders.get(g.sender_id) else 'Someone'),
            'content_id': g.content_id,
            'message': g.message or '',
            'created_at': g.created_at.isoformat() if g.created_at else None,
        } for g in rows]
    })


@api_v1.route('/programs', methods=['GET'])
@jwt_required
def programs_api():
    """Programs hub payload for mobile app."""
    user = request.api_user
    now = datetime.utcnow()
    active_challenges = StoryChallenge.query.filter(
        StoryChallenge.is_active.is_(True),
        StoryChallenge.ends_at > now,
    ).order_by(StoryChallenge.ends_at.asc()).limit(12).all()
    challenge_ids = [c.id for c in active_challenges]
    entries_count = {}
    if challenge_ids:
        from sqlalchemy import func
        entry_rows = db.session.query(
            ChallengeEntry.challenge_id,
            func.count(ChallengeEntry.id)
        ).filter(
            ChallengeEntry.challenge_id.in_(challenge_ids)
        ).group_by(ChallengeEntry.challenge_id).all()
        entries_count = {cid: int(cnt or 0) for cid, cnt in entry_rows}

    sixty_ago = now - timedelta(days=60)
    from sqlalchemy import func
    rising_rows = db.session.query(
        User,
        func.count(Content.id).label('story_count')
    ).join(
        Content, Content.creator_wiam_id == User.wiam_id
    ).filter(
        User.date_joined >= sixty_ago,
        User.role.in_(['creator', 'founder']),
        Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
    ).group_by(User.id).order_by(func.count(Content.id).desc()).limit(20).all()

    return jsonify({
        'programs': [
            {'key': 'elite', 'title': 'WiamPremium', 'description': 'Unlock premium benefits and credits.', 'icon': 'star'},
            {'key': 'challenges', 'title': 'Story Challenges', 'description': 'Join active challenges and win rewards.', 'icon': 'flame'},
            {'key': 'rising', 'title': 'WiamRising', 'description': 'Discover creators rising this month.', 'icon': 'trending_up'},
            {'key': 'ambassador', 'title': 'WiamAmbassador', 'description': 'Invite friends and earn bonuses.', 'icon': 'users'},
        ],
        'active_challenges': [{
            'id': c.id,
            'title': c.title,
            'description': c.description or '',
            'type': c.challenge_type or 'weekly',
            'coin_reward': c.coin_reward or 0,
            'entries_count': entries_count.get(c.id, 0),
            'ends_at': c.ends_at.isoformat() if c.ends_at else None,
        } for c in active_challenges],
        'rising_creators': [{
            'id': u.wiam_id or u.id,
            'display_name': u.display_name or u.first_name or 'Creator',
            'avatar_url': _abs_url(getattr(u, 'avatar_url', None)),
            'story_count': int(story_count or 0),
        } for (u, story_count) in rising_rows],
        'viewer': {
            'id': user.wiam_id or user.id,
            'is_creator': bool(getattr(user, 'is_creator', False)),
        },
    })


# ---------------------------------------------------------------------------
# BOOKS — Actions (Follow, Rate, Favorite)
# ---------------------------------------------------------------------------

@api_v1.route('/books/<int:book_id>/favorite', methods=['POST'])
@jwt_required
def toggle_favorite(book_id):
    """Toggle favorite on a book."""
    user = request.api_user
    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    from ..services.analytics import track

    existing = Favorite.query.filter_by(user_id=user.id, content_id=book_id).first()
    if existing:
        db.session.delete(existing)
        track('unfavorite', user, content_id=book_id)
        db.session.commit()
        return jsonify({'favorited': False, 'count': book.favorite_count})
    else:
        fav = Favorite(user_id=user.id, content_id=book_id)
        db.session.add(fav)
        track('favorite', user, content_id=book_id)
        db.session.commit()
        return jsonify({'favorited': True, 'count': book.favorite_count})


@api_v1.route('/books/<int:book_id>/rate', methods=['POST'])
@jwt_required
def rate_book(book_id):
    """Rate a book (1-5)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    rating_val = data.get('rating')

    if not rating_val or not isinstance(rating_val, int) or rating_val < 1 or rating_val > 5:
        return jsonify({'error': 'Rating must be 1-5'}), 400

    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    existing = Rating.query.filter_by(user_id=user.id, content_id=book_id).first()
    if existing:
        existing.rating = rating_val
        existing.updated_at = datetime.utcnow()
        rating_action = 'rating_update'
    else:
        r = Rating(user_id=user.id, content_id=book_id, rating=rating_val)
        db.session.add(r)
        rating_action = 'rating'

    from ..services.analytics import track
    track(rating_action, user, content_id=book_id, rating=rating_val)
    db.session.commit()

    return jsonify({
        'rating': rating_val,
        'avg_rating': book.avg_rating,
        'rating_count': book.rating_count,
    })


@api_v1.route('/books/<int:book_id>/reviews')
@jwt_optional
def book_reviews(book_id):
    """Get paginated reviews for a book."""
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)

    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    q = Review.query.filter_by(content_id=book_id).order_by(Review.created_at.desc())
    total = q.count()
    reviews = q.offset((page - 1) * per_page).limit(per_page).all()

    user = request.api_user
    uid = user.id if user else None

    out = []
    for rev in reviews:
        reviewer = User.query.get(rev.user_id)
        liked = False
        if uid:
            liked = ReviewLike.query.filter_by(review_id=rev.id, user_id=uid).first() is not None
        out.append({
            'id': rev.id,
            'text': rev.text,
            'created_at': rev.created_at.isoformat() if rev.created_at else None,
            'like_count': rev.like_count,
            'liked': liked,
            'user': {
                'id': reviewer.id,
                'display_name': reviewer.display_name,
                'avatar_url': _abs_url(reviewer.avatar_url),
            } if reviewer else None,
        })

    return jsonify({'reviews': out, 'total': total, 'page': page, 'per_page': per_page})


@api_v1.route('/books/<int:book_id>/reviews', methods=['POST'])
@jwt_required
def create_review(book_id):
    """Create or update a review for a book."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()

    if not text or len(text) < 10:
        return jsonify({'error': 'Review must be at least 10 characters'}), 400
    if len(text) > 2000:
        return jsonify({'error': 'Review must be under 2000 characters'}), 400

    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'Book not found'}), 404

    existing = Review.query.filter_by(user_id=user.id, content_id=book_id).first()
    if existing:
        existing.text = text
        db.session.commit()
        return jsonify({'review_id': existing.id, 'updated': True})

    rev = Review(user_id=user.id, content_id=book_id, text=text)
    db.session.add(rev)
    db.session.commit()
    return jsonify({'review_id': rev.id, 'created': True}), 201


@api_v1.route('/books/<int:book_id>/reviews/<int:review_id>', methods=['DELETE'])
@jwt_required
def delete_review(book_id, review_id):
    """Delete own review."""
    user = request.api_user
    rev = Review.query.get(review_id)
    if not rev or rev.content_id != book_id or rev.user_id != user.id:
        return jsonify({'error': 'Review not found'}), 404
    ReviewLike.query.filter_by(review_id=rev.id).delete()
    db.session.delete(rev)
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/reviews/<int:review_id>/like', methods=['POST'])
@jwt_required
def toggle_review_like(review_id):
    """Like or unlike a review."""
    user = request.api_user
    rev = Review.query.get(review_id)
    if not rev:
        return jsonify({'error': 'Review not found'}), 404

    existing = ReviewLike.query.filter_by(review_id=review_id, user_id=user.id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'liked': False, 'like_count': rev.like_count})

    like = ReviewLike(review_id=review_id, user_id=user.id)
    db.session.add(like)
    db.session.commit()
    return jsonify({'liked': True, 'like_count': rev.like_count})


# ---------------------------------------------------------------------------
# READER STATS & BADGES
# ---------------------------------------------------------------------------

# Badge definitions: key -> (name, icon, color, description, check_fn)
_READER_BADGE_DEFS = [
    ('first_book', 'First Read', 'book-open', '#3b82f6', 'Read your first book', lambda s: s['books_started'] >= 1),
    ('bookworm', 'Bookworm', 'book', '#8b5cf6', 'Start 10 books', lambda s: s['books_started'] >= 10),
    ('voracious', 'Voracious Reader', 'library', '#ec4899', 'Start 50 books', lambda s: s['books_started'] >= 50),
    ('first_review', 'Critic', 'message-square', '#f59e0b', 'Write your first review', lambda s: s['reviews_written'] >= 1),
    ('reviewer', 'Prolific Reviewer', 'star', '#f97316', 'Write 10 reviews', lambda s: s['reviews_written'] >= 10),
    ('streak_3', 'Consistent', 'flame', '#ef4444', '3-day reading streak', lambda s: s['current_streak'] >= 3),
    ('streak_7', 'Dedicated', 'flame', '#dc2626', '7-day reading streak', lambda s: s['current_streak'] >= 7),
    ('streak_30', 'Unstoppable', 'flame', '#991b1b', '30-day reading streak', lambda s: s['current_streak'] >= 30),
    ('collector', 'Collector', 'heart', '#e11d48', 'Favorite 20 books', lambda s: s['favorites_count'] >= 20),
    ('social_reader', 'Social Reader', 'list', '#06b6d4', 'Create 3 reading lists', lambda s: s['lists_count'] >= 3),
]


def _compute_reader_stats(user):
    """Compute reading stats for a user."""
    from ..models import ReadingList
    uid = user.id
    prog_uid = user.wiam_id or user.id

    books_started = db.session.query(db.func.count(db.distinct(ReadingProgress.content_id))).filter(ReadingProgress.user_id == prog_uid).scalar() or 0
    chapters_read = ReadingProgress.query.filter_by(user_id=prog_uid).count()
    favorites_count = Favorite.query.filter_by(user_id=uid).count()
    reviews_written = Review.query.filter_by(user_id=uid).count()
    ratings_given = Rating.query.filter_by(user_id=uid).count()
    lists_count = ReadingList.query.filter_by(user_id=uid).count()

    # Streak calculation
    from datetime import date as date_type
    today = date_type.today()
    streak_rows = ReadingStreak.query.filter_by(user_id=uid).order_by(ReadingStreak.date.desc()).limit(60).all()
    current_streak = 0
    check_date = today
    for row in streak_rows:
        if row.date == check_date:
            current_streak += 1
            check_date = check_date - timedelta(days=1)
        elif row.date == check_date - timedelta(days=1):
            check_date = row.date
            current_streak += 1
            check_date = check_date - timedelta(days=1)
        else:
            break

    total_minutes = db.session.query(db.func.coalesce(db.func.sum(ReadingStreak.minutes_read), 0)).filter_by(user_id=uid).scalar()

    return {
        'books_started': books_started,
        'chapters_read': chapters_read,
        'favorites_count': favorites_count,
        'reviews_written': reviews_written,
        'ratings_given': ratings_given,
        'lists_count': lists_count,
        'current_streak': current_streak,
        'total_minutes_read': int(total_minutes),
    }


def _award_badges(user, stats):
    """Check and award any new badges based on current stats."""
    uid = user.id
    existing_keys = {b.badge_key for b in ReaderBadge.query.filter_by(user_id=uid).all()}
    newly_earned = []

    for key, name, icon, color, desc, check_fn in _READER_BADGE_DEFS:
        if key not in existing_keys and check_fn(stats):
            badge = ReaderBadge(
                user_id=uid, badge_key=key, badge_name=name,
                badge_icon=icon, badge_color=color, badge_description=desc,
            )
            db.session.add(badge)
            newly_earned.append(key)

    if newly_earned:
        db.session.commit()
    return newly_earned


@api_v1.route('/reader/stats')
@jwt_required
def reader_stats():
    """Get reader stats and auto-award any new badges."""
    user = request.api_user
    stats = _compute_reader_stats(user)
    newly_earned = _award_badges(user, stats)

    badges = ReaderBadge.query.filter_by(user_id=user.id).order_by(ReaderBadge.earned_at.desc()).all()
    badges_out = [{
        'key': b.badge_key,
        'name': b.badge_name,
        'icon': b.badge_icon,
        'color': b.badge_color,
        'description': b.badge_description,
        'earned_at': b.earned_at.isoformat() if b.earned_at else None,
    } for b in badges]

    return jsonify({
        'stats': stats,
        'badges': badges_out,
        'newly_earned': newly_earned,
    })


@api_v1.route('/reader/badges')
@jwt_required
def reader_badges():
    """Get all reader badges (earned and available)."""
    user = request.api_user
    earned = {b.badge_key: b for b in ReaderBadge.query.filter_by(user_id=user.id).all()}

    all_badges = []
    for key, name, icon, color, desc, _ in _READER_BADGE_DEFS:
        b = earned.get(key)
        all_badges.append({
            'key': key,
            'name': name,
            'icon': icon,
            'color': color,
            'description': desc,
            'earned': key in earned,
            'earned_at': b.earned_at.isoformat() if b else None,
        })

    return jsonify({'badges': all_badges})


# ---------------------------------------------------------------------------
# CREATORS — Profile, Follow
# ---------------------------------------------------------------------------

@api_v1.route('/creators/<int:creator_id>')
@jwt_optional
def creator_profile(creator_id):
    """Get a creator's profile."""
    user = User.query.get(creator_id)
    if not user or not user.is_creator:
        return jsonify({'error': 'Creator not found'}), 404

    profile = CreatorProfile.query.filter_by(wiam_id=user.wiam_id).first()
    follower_count = Follow.query.filter_by(creator_id=user.id).count()
    uid = user.wiam_id or user.id
    pub = None
    try:
        from ..models import EpisioCreatorPublicProfile
        pub = EpisioCreatorPublicProfile.query.get(uid)
    except Exception:
        pub = None

    # Creator's books + drama series
    books = Content.query.filter(
        Content.creator_wiam_id == user.wiam_id,
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    ).order_by(Content.created_at.desc()).all()

    drama = [
        b for b in books
        if (getattr(b, 'format', None) or '').lower() in ('drama', 'series', 'short_drama', 'episio')
        or getattr(b, 'content_kind', None) == 'drama'
    ]

    is_following = False
    if request.api_user and request.api_user.id != user.id:
        is_following = Follow.query.filter_by(
            user_id=request.api_user.id, creator_id=user.id
        ).first() is not None

    display = (
        (pub.channel_name if pub and pub.channel_name else None)
        or (profile.pen_name if profile else None)
        or user.display_name
    )
    bio = (pub.bio if pub and pub.bio else None) or user.bio or (profile.bio if profile else None)
    try:
        genres = json.loads(pub.genres_json) if pub and pub.genres_json else []
    except Exception:
        genres = []

    return jsonify({
        'id': user.id,
        'username': user.username,
        'display_name': display,
        'avatar_url': (pub.avatar_url if pub and pub.avatar_url else None) or user.avatar_url,
        'banner_url': (pub.banner_url if pub else None) or None,
        'bio': bio,
        'tagline': (pub.tagline if pub else None) or None,
        'pen_name': profile.pen_name if profile else display,
        'channel_name': (pub.channel_name if pub else None) or display,
        'country': (pub.country if pub and pub.country else None) or (profile.country if profile else None),
        'city': (pub.city if pub else None) or None,
        'website_url': (pub.website_url if pub else None) or None,
        'instagram': (pub.instagram if pub else None) or None,
        'tiktok': (pub.tiktok if pub else None) or None,
        'youtube': (pub.youtube if pub else None) or None,
        'twitter_x': (pub.twitter_x if pub else None) or None,
        'facebook': (pub.facebook if pub else None) or None,
        'genres': genres if isinstance(genres, list) else [],
        'follower_count': follower_count,
        'is_following': is_following,
        'verified': bool(getattr(user, 'is_verified', False) or getattr(user, 'is_founder', False)),
        'book_count': len(books),
        'books': [_book_json(b, request.api_user) for b in books],
        'series': [
            {
                'id': d.id,
                'title': d.title,
                'badge': 'LIVE' if d.status in Content.PUBLISHED_STATUSES else 'REVIEW',
                'views': getattr(d, 'view_count', None) or getattr(d, 'views', None),
                'cover_url': getattr(d, 'cover_url', None) or getattr(d, 'poster_url', None),
            }
            for d in (drama or books[:12])
        ],
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
        'premium_plan': user.premium_plan if user.premium_status in ('active', 'trial') else None,
    })


@api_v1.route('/creators/<int:creator_id>/follow', methods=['POST'])
@jwt_required
def toggle_follow(creator_id):
    """Toggle follow/unfollow a creator."""
    user = request.api_user
    if user.id == creator_id:
        return jsonify({'error': 'Cannot follow yourself'}), 400

    creator = User.query.get(creator_id)
    if not creator:
        return jsonify({'error': 'Creator not found'}), 404
    if not creator.is_creator:
        return jsonify({'error': 'You can only follow creators'}), 400

    from ..services.analytics import track

    existing = Follow.query.filter_by(user_id=user.id, creator_id=creator_id).first()
    if existing:
        db.session.delete(existing)
        track('unfollow', user, target_user_id=creator_id)
        db.session.commit()
        following = False
    else:
        follow = Follow(user_id=user.id, creator_id=creator_id)
        db.session.add(follow)
        track('follow', user, target_user_id=creator_id)
        db.session.commit()
        following = True
        try:
            from ..services.notifications import notify_new_follower
            notify_new_follower(creator_id, user.display_name)
        except Exception:
            pass

    count = Follow.query.filter_by(creator_id=creator_id).count()
    return jsonify({'following': following, 'count': count})


@api_v1.route('/my/following')
@jwt_required
def my_following():
    """List creators the current user follows."""
    user = request.api_user
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 50)

    follows = Follow.query.filter_by(user_id=user.id).order_by(Follow.id.desc()).all()
    creator_ids = [f.creator_id for f in follows]

    creators_out = []
    if creator_ids:
        creators = User.query.filter(User.id.in_(creator_ids)).all()
        creator_map = {c.id: c for c in creators}
        for cid in creator_ids:
            c = creator_map.get(cid)
            if not c or not c.is_creator:
                continue
            creators_out.append({
                'id': c.id,
                'wiam_id': c.wiam_id,
                'username': c.username,
                'display_name': c.display_name,
                'avatar_url': _abs_url(c.avatar_url),
                'bio': c.bio or '',
                'follower_count': Follow.query.filter_by(creator_id=c.id).count(),
            })

    total = len(creators_out)
    start = (page - 1) * per_page
    paged = creators_out[start:start + per_page]
    return jsonify({
        'following': paged,
        'total': total,
        'page': page,
        'per_page': per_page,
    })


# ---------------------------------------------------------------------------
# SCHEDULE (READER-FACING)
# ---------------------------------------------------------------------------

@api_v1.route('/schedule/upcoming')
@jwt_optional
def schedule_upcoming():
    """Return upcoming scheduled chapter releases.

    Authenticated users see releases from creators they follow first,
    then other public releases.  Unauthenticated users see all public
    upcoming releases.

    Query params:
        page (int): default 1
        per_page (int): default 30, max 50
    """
    from datetime import datetime as _dt

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 30, type=int), 50)

    now = _dt.utcnow()

    # All future-scheduled chapters that are not yet published
    scheduled = (
        WebBookContent.query
        .filter(
            WebBookContent.scheduled_publish_at > now,
            WebBookContent.status != 'published',
        )
        .order_by(WebBookContent.scheduled_publish_at.asc())
        .limit(200)
        .all()
    )

    if not scheduled:
        return jsonify({'upcoming': [], 'total': 0, 'page': page})

    # Gather unique book IDs and load books + creators in batch
    book_ids = list({ch.content_id for ch in scheduled})
    books = Content.query.filter(Content.id.in_(book_ids)).all()
    book_map = {b.id: b for b in books}

    creator_ids = list({b.author_id for b in books if b.author_id})
    creators = User.query.filter(User.id.in_(creator_ids)).all() if creator_ids else []
    creator_map = {c.id: c for c in creators}

    # If authenticated, mark which creators the user follows
    followed_ids = set()
    user = getattr(request, 'api_user', None)
    if user:
        follows = Follow.query.filter_by(user_id=user.id).all()
        followed_ids = {f.creator_id for f in follows}

    items = []
    for ch in scheduled:
        book = book_map.get(ch.content_id)
        if not book:
            continue
        # Only show chapters from published/ongoing books
        if book.status not in ('ongoing', 'complete', 'approved', 'published'):
            continue
        creator = creator_map.get(book.author_id)
        is_followed = book.author_id in followed_ids
        items.append({
            'chapter_id': ch.id,
            'book_id': book.id,
            'book_title': book.title,
            'book_cover': _abs_url(book.cover_url) if book.cover_url else None,
            'chapter_number': ch.chapter_number,
            'chapter_title': ch.chapter_title or f'Chapter {ch.chapter_number}',
            'scheduled_at': ch.scheduled_publish_at.isoformat(),
            'creator_id': book.author_id,
            'creator_name': creator.display_name if creator else 'Unknown',
            'creator_username': creator.username if creator else None,
            'creator_avatar': _abs_url(creator.avatar_url) if creator and creator.avatar_url else None,
            'is_followed': is_followed,
        })

    # Sort: followed creators first, then by scheduled time
    items.sort(key=lambda x: (not x['is_followed'], x['scheduled_at']))

    total = len(items)
    start = (page - 1) * per_page
    paged = items[start:start + per_page]
    return jsonify({'upcoming': paged, 'total': total, 'page': page, 'per_page': per_page})


# ---------------------------------------------------------------------------
# SEARCH
# ---------------------------------------------------------------------------

@api_v1.route('/search')
@jwt_optional
def search():
    """Search books and creators."""
    q = (request.args.get('q') or '').strip()
    if len(q) < 2:
        return jsonify({'error': 'Search query must be at least 2 characters'}), 400

    search_type = request.args.get('type', 'all')  # all | books | creators
    limit = min(request.args.get('limit', 20, type=int), 50)
    pattern = f'%{q}%'

    try:
        from ..services.analytics import track
        track('search', request.api_user, query=q[:80], search_type=search_type)
        db.session.commit()
    except Exception:
        db.session.rollback()

    results = {'books': [], 'creators': []}

    if search_type in ('all', 'books'):
        books = Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
            db.or_(
                Content.title.ilike(pattern),
                Content.author.ilike(pattern),
                Content.description.ilike(pattern),
            )
        ).order_by(Content.views.desc().nullslast()).limit(limit).all()
        results['books'] = [_book_json(b, request.api_user) for b in books]

    if search_type in ('all', 'creators'):
        creators = User.query.filter(
            User.role.in_(['creator', 'founder']),
            db.or_(
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
                User.username.ilike(pattern),
            )
        ).limit(limit).all()
        results['creators'] = [{
            'id': c.id,
            'username': c.username,
            'display_name': c.display_name,
            'avatar_url': c.avatar_url,
            'follower_count': Follow.query.filter_by(creator_id=c.id).count(),
        } for c in creators]

    return jsonify(results)


# ---------------------------------------------------------------------------
# GENRES
# ---------------------------------------------------------------------------

_api_genre_cache = {'ts': None, 'data': None}

@api_v1.route('/genres')
def genres_list():
    """List genres. ?product=episio returns drama catalog only."""
    from datetime import datetime as _dt
    product = (request.args.get('product') or '').strip().lower()
    now = _dt.utcnow()
    cache_key = product or 'all'
    if (
        _api_genre_cache['ts']
        and _api_genre_cache.get('key') == cache_key
        and (now - _api_genre_cache['ts']).total_seconds() < 3600
    ):
        return jsonify(_api_genre_cache['data'])
    if product == 'episio':
        from ..services.episio_genres import list_episio_genres
        result = {'product': 'episio', 'genres': list_episio_genres(active_only=True)}
    else:
        genres = Genre.query.order_by(Genre.name).all()
        result = {'genres': [{'id': g.id, 'name': g.name, 'product': getattr(g, 'product', None)} for g in genres]}
    _api_genre_cache['ts'] = now
    _api_genre_cache['key'] = cache_key
    _api_genre_cache['data'] = result
    return jsonify(result)


@api_v1.route('/genres/preferences', methods=['GET', 'POST'])
@jwt_required
def genre_preferences():
    """Get or save user genre preferences (onboarding + settings)."""
    user = request.api_user
    uid = user.wiam_id or user.id

    if request.method == 'GET':
        prefs = UserGenrePreference.query.filter_by(user_id=uid).all()
        genre_ids = [p.genre_id for p in prefs]
        genres = Genre.query.filter(Genre.id.in_(genre_ids)).all() if genre_ids else []
        return jsonify({
            'genre_ids': genre_ids,
            'genres': [{'id': g.id, 'name': g.name} for g in genres],
        })

    # POST — save preferences (replace all)
    data = request.get_json(silent=True) or {}
    genre_ids = data.get('genre_ids', [])
    if not isinstance(genre_ids, list):
        return jsonify({'error': 'genre_ids must be an array'}), 400

    # Validate genre IDs exist
    valid = {g.id for g in Genre.query.filter(Genre.id.in_(genre_ids)).all()}
    genre_ids = [gid for gid in genre_ids if gid in valid]

    # Replace all preferences
    UserGenrePreference.query.filter_by(user_id=uid).delete()
    for gid in genre_ids:
        db.session.add(UserGenrePreference(user_id=uid, genre_id=gid))

    # Mark onboarding as completed if not already
    if not user.onboarding_completed:
        user.onboarding_completed = True

    db.session.commit()
    return jsonify({'ok': True, 'saved': len(genre_ids)})


# ---------------------------------------------------------------------------
# FEATURED & TRENDING
# ---------------------------------------------------------------------------

@api_v1.route('/featured')
@jwt_optional
def featured_books():
    """Get featured books."""
    featured = db.session.query(Content).join(
        FeaturedBook, FeaturedBook.content_id == Content.id
    ).filter(
        Content.deleted_at.is_(None),
    ).order_by(FeaturedBook.featured_at.desc()).limit(10).all()

    return jsonify({
        'books': [_book_json(b, request.api_user) for b in featured]
    })


@api_v1.route('/trending')
@jwt_optional
def trending_books():
    """Get trending books — Push 4 reads from the popularity score table."""
    from ..services.popularity import top_books_by_score
    books = top_books_by_score(limit=20)
    return jsonify({
        'books': [_book_json(b, request.api_user) for b in books]
    })


# ---------------------------------------------------------------------------
# COINS & WALLET
# ---------------------------------------------------------------------------

@api_v1.route('/coins/balance')
@jwt_required
def get_coins_balance():
    """Get the current user's coin balance."""
    user = request.api_user
    bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
    if not bal:
        bal = CoinBalance(user_id=user.wiam_id or user.id, balance=0, total_purchased=0, total_spent=0)
        db.session.add(bal)
        db.session.commit()

    return jsonify({
        'balance': bal.balance,
        'total_purchased': bal.total_purchased,
        'total_spent': bal.total_spent,
        'updated_at': bal.updated_at.isoformat() if bal.updated_at else None,
    })


@api_v1.route('/coins/history')
@jwt_required
def get_coins_history():
    """Get the current user's coin transaction history."""
    user = request.api_user
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)

    txs = CoinTransaction.query.filter(
        db.or_(CoinTransaction.user_id == user.wiam_id, CoinTransaction.user_id == user.id)
    )\
        .order_by(CoinTransaction.created_at.desc())\
        .offset((page - 1) * per_page).limit(per_page).all()

    total = CoinTransaction.query.filter(
        db.or_(CoinTransaction.user_id == user.wiam_id, CoinTransaction.user_id == user.id)
    ).count()

    return jsonify({
        'transactions': [{
            'id': t.id,
            'type': t.type,
            'amount': t.amount,
            'balance_after': t.balance_after,
            'description': t.description,
            'created_at': t.created_at.isoformat(),
            'reference': t.reference,
        } for t in txs],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page,
    })


@api_v1.route('/coins/packages')
def get_coin_packages():
    """Get available coin packages. Optional ?currency=GHS for local display (USD base)."""
    currency = (request.args.get('currency') or request.headers.get('Accept-Currency') or '').upper().strip()
    if currency:
        try:
            from ..services.currency_display import list_packages_for_currency, ensure_default_fx
            ensure_default_fx()
            return jsonify({
                'base_currency': 'USD',
                'currency': currency,
                'packages': list_packages_for_currency(currency),
            })
        except Exception:
            pass

    packages = CoinPackage.query.filter_by(is_active=True)\
        .order_by(CoinPackage.sort_order).all()

    return jsonify({
        'base_currency': 'USD',
        'packages': [{
            'id': p.id,
            'label': p.label,
            'coins': p.coins,
            'bonus_coins': p.bonus_coins or 0,
            'total_coins': p.total_coins,
            'price_ghs': p.price_ghs,
            'price_pesewas': p.price_pesewas,
            'price_usd_cents': p.price_usd_cents or 0,
            'ghs_label': f"GH\u20b5{p.price_ghs:.2f}",
        } for p in packages]
    })


# ---------------------------------------------------------------------------
# MONEY ECOSYSTEM v5 — Native API
# ---------------------------------------------------------------------------

@api_v1.route('/coins/unlock', methods=['POST'])
@jwt_required
def unlock_chapter_api():
    """Spend coins to unlock a locked chapter (via v5 ledger)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id')
    chapter_num = data.get('chapter_number')

    if not content_id or not chapter_num:
        return jsonify({'error': 'content_id and chapter_number required'}), 400

    from ..models import WebBookContent, ChapterUnlock
    chapter = WebBookContent.query.filter_by(
        content_id=content_id, chapter_number=chapter_num
    ).first()
    if not chapter:
        return jsonify({'error': 'Chapter not found'}), 404
    if not chapter.is_locked or not chapter.chapter_price:
        return jsonify({'error': 'Chapter is not locked'}), 400

    # Already unlocked?
    existing = ChapterUnlock.query.filter(
        ChapterUnlock.content_id == content_id,
        ChapterUnlock.chapter_number == chapter_num,
        db.or_(ChapterUnlock.user_id == user.id,
               ChapterUnlock.user_id == user.wiam_id),
    ).first()
    if existing:
        return jsonify({'ok': True, 'already_unlocked': True})

    book = Content.query.get(content_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    coins_needed = int(chapter.chapter_price)
    if book.creator_wiam_id == user.wiam_id:
        return jsonify({'ok': True, 'already_unlocked': True})

    uid = user.wiam_id or user.id
    try:
        from ..services.ledger import record_chapter_unlock
        result = record_chapter_unlock(
            uid, book.creator_wiam_id,
            content_id, chapter_num, coins_needed,
        )
        if result.get('error'):
            bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
            return jsonify({'error': result['error'], 'need_coins': 'Not enough' in result['error'],
                            'balance': bal.balance if bal else 0}), 402
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Ledger unlock API error: %s", e)
        return jsonify({'error': 'Unlock failed. Please try again.'}), 500

    # Record unlock row
    unlock = ChapterUnlock(
        user_id=uid, content_id=content_id,
        chapter_number=chapter_num, coins_spent=coins_needed,
        creator_id=book.creator_wiam_id,
    )
    db.session.add(unlock)

    # Track creator earnings
    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=book.creator_wiam_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(creator_id=book.creator_wiam_id, year=now.year, month=now.month)
        db.session.add(earn)
    earn.coins_from_unlocks += coins_needed
    earn.total_coins = (earn.coins_from_unlocks or 0) + (earn.coins_from_tips or 0)
    from ..services.monetization import COIN_TO_GHS
    share_pct = RevenueRule.get_creator_share(book.creator_wiam_id) or 50.0
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = now

    db.session.commit()
    return jsonify({'ok': True, 'balance': result['balance'], 'coins_spent': coins_needed})


@api_v1.route('/coins/initialize', methods=['POST'])
@jwt_required
def initialize_purchase_api():
    """Initialize a Paystack transaction for coin purchase (native app)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    package_id = data.get('package_id')

    if not package_id:
        return jsonify({'error': 'package_id required'}), 400

    pkg = CoinPackage.query.get(package_id)
    if not pkg or not pkg.is_active:
        return jsonify({'error': 'Package not available'}), 404

    import requests as http_requests
    from flask import current_app
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        return jsonify({'error': 'Payment system not configured'}), 500

    email = user.email or f'user{user.wiam_id or user.id}@wiamapp.com'
    payload = {
        'email': email,
        'amount': pkg.price_pesewas,
        'currency': 'GHS',
        'metadata': {
            'user_id': user.wiam_id or user.id,
            'package_id': pkg.id,
            'coins': pkg.total_coins,
            'source': 'native_app',
        },
    }

    try:
        resp = http_requests.post(
            'https://api.paystack.co/transaction/initialize',
            json=payload,
            headers={'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'},
            timeout=15,
        )
        result = resp.json()
        if result.get('status') and result.get('data', {}).get('authorization_url'):
            return jsonify({
                'ok': True,
                'authorization_url': result['data']['authorization_url'],
                'reference': result['data']['reference'],
                'access_code': result['data'].get('access_code', ''),
            })
        return jsonify({'error': result.get('message', 'Payment init failed')}), 500
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Paystack init API error: %s", e)
        return jsonify({'error': 'Payment service unavailable'}), 503


@api_v1.route('/coins/verify', methods=['POST'])
@jwt_required
def verify_purchase_api():
    """Verify a Paystack transaction and credit coins (native app callback)."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    reference = data.get('reference', '')

    if not reference:
        return jsonify({'error': 'reference required'}), 400

    # Already credited?
    existing = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    if existing:
        bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
        return jsonify({'ok': True, 'balance': bal.balance if bal else 0, 'already_credited': True})

    import requests as http_requests
    from flask import current_app
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    try:
        resp = http_requests.get(
            f'https://api.paystack.co/transaction/verify/{reference}',
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        payload = resp.json()
        if not (payload.get('status') and payload['data'].get('status') == 'success'):
            return jsonify({'error': 'Payment not successful'}), 400
    except Exception:
        return jsonify({'error': 'Could not verify payment'}), 503

    pdata = payload['data']
    meta = pdata.get('metadata', {})
    uid = meta.get('user_id')
    coins = meta.get('coins')
    pkg_id = meta.get('package_id')

    if not uid or not coins or int(uid) not in (user.wiam_id, user.id):
        return jsonify({'error': 'Payment metadata mismatch'}), 400

    # Double-check idempotency
    existing = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    if existing:
        bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
        return jsonify({'ok': True, 'balance': bal.balance if bal else 0, 'already_credited': True})

    price_ghs = pdata.get('amount', 0) / 100
    try:
        from ..services.ledger import record_coin_purchase
        result = record_coin_purchase(int(uid), int(coins), price_ghs, reference, package_id=pkg_id)
        if result.get('error'):
            return jsonify({'error': result['error']}), 400
        return jsonify({'ok': True, 'balance': result['balance'], 'coins_credited': int(coins)})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Ledger verify error: %s", e)
        return jsonify({'error': 'Credit failed. Contact support.'}), 500


@api_v1.route('/wallet/status')
@jwt_required
def wallet_status_api():
    """Full wallet status including v5 freeze/risk info."""
    user = request.api_user
    bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
    if not bal:
        bal = CoinBalance(user_id=user.wiam_id or user.id, balance=0, total_purchased=0, total_spent=0)
        db.session.add(bal)
        db.session.commit()

    return jsonify({
        'balance': bal.balance,
        'total_purchased': bal.total_purchased,
        'total_spent': bal.total_spent,
        'account_frozen': bool(user.account_frozen),
        'risk_score': user.risk_score or 0,
        'refund_count': user.refund_count or 0,
    })


@api_v1.route('/wallet/refund', methods=['POST'])
@jwt_required
def request_refund_api():
    """Submit a refund request for a specific transaction."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    tx_id = data.get('transaction_id')
    reason = data.get('reason', '')

    if not tx_id:
        return jsonify({'error': 'transaction_id required'}), 400

    tx = CoinTransaction.query.get(tx_id)
    if not tx or tx.user_id not in (user.id, user.wiam_id):
        return jsonify({'error': 'Transaction not found'}), 404
    if tx.type not in ('unlock', 'tip'):
        return jsonify({'error': 'Only unlock/tip transactions can be refunded'}), 400
    if tx.dispute_status:
        return jsonify({'error': 'This transaction already has a dispute'}), 400

    from ..models import RefundRequest
    existing = RefundRequest.query.filter_by(original_tx_id=tx_id).first()
    if existing:
        return jsonify({'error': 'Refund already requested', 'status': existing.status}), 400

    refund = RefundRequest(
        user_id=user.wiam_id,
        original_tx_id=tx_id,
        amount_coins=abs(tx.amount),
        reason=reason,
        status='pending',
    )
    db.session.add(refund)
    tx.dispute_status = 'pending'
    db.session.commit()

    return jsonify({'ok': True, 'refund_id': refund.id, 'status': 'pending'})


@api_v1.route('/creator/earnings')
@jwt_required
def creator_earnings_api():
    """Get the authenticated creator's earnings breakdown."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    wiam_id = user.wiam_id

    from ..services.monetization import COIN_TO_GHS

    earnings = CreatorEarnings.query.filter_by(creator_id=wiam_id)\
        .order_by(CreatorEarnings.year.desc(), CreatorEarnings.month.desc()).all()

    share_pct = RevenueRule.get_creator_share(user.id) if hasattr(RevenueRule, 'get_creator_share') else 50.0

    months = []
    total_coins = 0
    total_ghs = 0.0
    for e in earnings:
        coins = (e.coins_from_unlocks or 0) + (e.coins_from_tips or 0)
        ghs = coins * COIN_TO_GHS
        creator_ghs = ghs * (share_pct / 100.0)
        total_coins += coins
        total_ghs += creator_ghs
        months.append({
            'year': e.year,
            'month': e.month,
            'coins_from_unlocks': e.coins_from_unlocks or 0,
            'coins_from_tips': e.coins_from_tips or 0,
            'total_coins': coins,
            'ghs_value': round(ghs, 2),
            'creator_share_ghs': round(creator_ghs, 2),
        })

    return jsonify({
        'creator_share_pct': share_pct,
        'coin_to_ghs': COIN_TO_GHS,
        'total_coins': total_coins,
        'total_ghs': round(total_ghs, 2),
        'months': months,
    })


# ---------------------------------------------------------------------------
# IAP (In-App Purchase) — RevenueCat integration
# ---------------------------------------------------------------------------

@api_v1.route('/iap/confirm', methods=['POST'])
@jwt_required
def iap_confirm_purchase():
    """
    Confirm an IAP coin purchase.
    Mobile app calls this after RevenueCat completes a purchase.
    We verify with RevenueCat API and credit coins via ledger.

    JSON body:
      { rc_user_id, product_id, store: "apple"|"google",
        transaction_id (optional — for extra idempotency) }
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}

    rc_user_id = data.get('rc_user_id', '')
    product_id = data.get('product_id', '')
    store = data.get('store', '')
    transaction_id = data.get('transaction_id', '')

    if not product_id or not store or not rc_user_id:
        return jsonify({'ok': False, 'error': 'rc_user_id, product_id and store are required'}), 400

    if store not in ('apple', 'google'):
        return jsonify({'ok': False, 'error': 'store must be apple or google'}), 400

    from ..services.iap import (
        verify_rc_purchase, find_purchase_in_rc_data,
        map_product_to_coins, credit_coins_for_iap, is_coin_product,
    )

    if not is_coin_product(product_id):
        return jsonify({'ok': False, 'error': 'Not a coin product. Use /iap/confirm-subscription for subscriptions.'}), 400

    # Step 1: Strict verify with RevenueCat
    rc_data = verify_rc_purchase(rc_user_id, product_id)
    if not rc_data.get('ok'):
        return jsonify({'ok': False, 'error': rc_data.get('error', 'RevenueCat verification failed')}), 400
    purchase = find_purchase_in_rc_data(rc_data, product_id)
    if not purchase:
        return jsonify({'ok': False, 'error': 'Purchase not found for product on RevenueCat'}), 400
    if not transaction_id:
        transaction_id = purchase.get('store_transaction_id', '') or purchase.get('id', '')
    if not transaction_id:
        return jsonify({'ok': False, 'error': 'Missing store transaction id from verified purchase'}), 400

    # Step 2: Credit coins
    result = credit_coins_for_iap(
        user_id=user.wiam_id or user.id,
        product_id=product_id,
        store=store,
        store_transaction_id=transaction_id,
        rc_user_id=rc_user_id,
    )

    if result.get('ok'):
        return jsonify(result)
    else:
        return jsonify(result), 400


@api_v1.route('/iap/confirm-subscription', methods=['POST'])
@jwt_required
def iap_confirm_subscription():
    """
    Confirm an IAP subscription purchase (WiamPremium or WiamElite).

    JSON body:
      { rc_user_id, product_id, store: "apple"|"google",
        transaction_id (optional), expires_at (optional ISO string) }
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}

    rc_user_id = data.get('rc_user_id', '')
    product_id = data.get('product_id', '')
    store = data.get('store', '')
    transaction_id = data.get('transaction_id', '')
    expires_at_str = data.get('expires_at', '')

    if not product_id or not store or not rc_user_id:
        return jsonify({'ok': False, 'error': 'rc_user_id, product_id and store are required'}), 400

    if store not in ('apple', 'google'):
        return jsonify({'ok': False, 'error': 'store must be apple or google'}), 400

    from ..services.iap import (
        verify_rc_purchase, find_purchase_in_rc_data,
        is_subscription_product, activate_subscription_for_iap,
    )

    if not is_subscription_product(product_id):
        return jsonify({'ok': False, 'error': 'Not a subscription product. Use /iap/confirm for coins.'}), 400

    # Strict verify with RevenueCat
    expires_at = None
    rc_data = verify_rc_purchase(rc_user_id, product_id)
    if not rc_data.get('ok'):
        return jsonify({'ok': False, 'error': rc_data.get('error', 'RevenueCat verification failed')}), 400
    purchase = find_purchase_in_rc_data(rc_data, product_id)
    if not purchase:
        return jsonify({'ok': False, 'error': 'Subscription purchase not found on RevenueCat'}), 400
    if not transaction_id:
        transaction_id = purchase.get('store_transaction_id', '') or purchase.get('id', '')
    exp_str = purchase.get('expires_date')
    if exp_str:
        try:
            expires_at = datetime.fromisoformat(exp_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            pass

    # Parse explicit expires_at if provided
    if not expires_at and expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            pass

    if not transaction_id:
        return jsonify({'ok': False, 'error': 'Missing store transaction id from verified subscription'}), 400

    # Default expiry: 30 days from now if not provided
    if not expires_at:
        expires_at = datetime.utcnow() + timedelta(days=30)

    result = activate_subscription_for_iap(
        user_id=user.wiam_id or user.id,
        product_id=product_id,
        store=store,
        store_transaction_id=transaction_id,
        expires_at=expires_at,
        rc_user_id=rc_user_id,
    )

    if result.get('ok'):
        return jsonify(result)
    else:
        return jsonify(result), 400


@api_v1.route('/iap/packages')
@jwt_required
def iap_packages():
    """
    Return coin packages with both GHS and USD pricing + store product IDs.
    Mobile app uses this to know which RevenueCat products to fetch.
    """
    packages = CoinPackage.query.filter_by(is_active=True)\
        .order_by(CoinPackage.sort_order).all()

    from ..services.monetization import COIN_TO_GHS, COIN_TO_USD

    return jsonify({
        'coin_to_ghs': COIN_TO_GHS,
        'coin_to_usd': COIN_TO_USD,
        'packages': [{
            'id': p.id,
            'coins': p.coins,
            'bonus_coins': p.bonus_coins,
            'total_coins': p.total_coins,
            'price_ghs': p.price_ghs,
            'price_usd_cents': p.price_usd_cents or 0,
            'price_usd': p.price_usd,
            'store_product_id': p.store_product_id or '',
            'label': p.label,
        } for p in packages],
    })


# ---------------------------------------------------------------------------
# Growth Features: Welcome Bonus, Daily Rewards
# ---------------------------------------------------------------------------

@api_v1.route('/rewards/welcome', methods=['POST'])
@jwt_required
def claim_welcome_bonus_api():
    """Claim one-time welcome bonus (50 coins)."""
    user = request.api_user
    from ..services.ledger import claim_welcome_bonus
    result = claim_welcome_bonus(user.wiam_id or user.id)
    if result.get('ok'):
        return jsonify(result)
    return jsonify(result), 400


@api_v1.route('/rewards/daily', methods=['POST'])
@jwt_required
def claim_daily_reward_api():
    """Claim daily login reward (5 coins + streak bonus)."""
    user = request.api_user
    from ..services.ledger import claim_daily_reward
    result = claim_daily_reward(user.wiam_id or user.id)
    if result.get('ok'):
        return jsonify(result)
    return jsonify(result), 400


@api_v1.route('/rewards/status')
@jwt_required
def rewards_status_api():
    """Get user's reward status: welcome bonus, daily streak info."""
    user = request.api_user
    u = User.query.get(user.id)
    if not u:
        return jsonify({'error': 'User not found'}), 404

    today = datetime.utcnow().date()
    can_claim_daily = True
    if u.last_daily_reward:
        can_claim_daily = u.last_daily_reward.date() < today

    from ..services.ledger import WELCOME_BONUS_COINS
    return jsonify({
        'welcome_bonus_claimed': u.welcome_bonus_claimed or False,
        'welcome_bonus_coins': WELCOME_BONUS_COINS,
        'daily_reward_claimed_today': not can_claim_daily,
        'can_claim_daily': can_claim_daily,
        'daily_streak': u.daily_reward_streak or 0,
        'daily_base_coins': 5,
        'streak_bonuses': {3: 5, 7: 15, 14: 30, 30: 100},
    })


@api_v1.route('/rewards/first-mission/status')
@jwt_required
def first_mission_status_api():
    """
    First mission status:
      1) read at least one chapter (book_view event)
      2) follow at least one creator
    Completing both unlocks +10 coins one-time.
    """
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..services.ledger import FIRST_MISSION_COINS, has_claimed_first_mission_bonus

    has_read = db.session.query(AnalyticsEvent.id).filter(
        db.or_(AnalyticsEvent.user_id == user.id, AnalyticsEvent.user_id == uid),
        AnalyticsEvent.event_type == 'book_view',
    ).first() is not None
    has_followed = db.session.query(Follow.id).filter(Follow.user_id == user.id).first() is not None
    claimed = has_claimed_first_mission_bonus(uid)
    eligible = has_read and has_followed and not claimed
    return jsonify({
        'has_read_chapter': has_read,
        'has_followed_creator': has_followed,
        'claimed': claimed,
        'eligible': eligible,
        'reward_coins': FIRST_MISSION_COINS,
    })


@api_v1.route('/rewards/first-mission/claim', methods=['POST'])
@jwt_required
def first_mission_claim_api():
    """Claim first mission reward once requirements are completed."""
    user = request.api_user
    uid = user.wiam_id or user.id
    from ..services.ledger import claim_first_mission_bonus

    has_read = db.session.query(AnalyticsEvent.id).filter(
        db.or_(AnalyticsEvent.user_id == user.id, AnalyticsEvent.user_id == uid),
        AnalyticsEvent.event_type == 'book_view',
    ).first() is not None
    has_followed = db.session.query(Follow.id).filter(Follow.user_id == user.id).first() is not None
    if not has_read or not has_followed:
        return jsonify({
            'ok': False,
            'error': 'Complete first mission first',
            'has_read_chapter': has_read,
            'has_followed_creator': has_followed,
        }), 400

    result = claim_first_mission_bonus(uid)
    if result.get('ok'):
        return jsonify({
            **result,
            'has_read_chapter': has_read,
            'has_followed_creator': has_followed,
        })
    return jsonify(result), 400


# ---------------------------------------------------------------------------
# CREATOR / STUDIO API (for mobile app)
# ---------------------------------------------------------------------------

@api_v1.route('/creator/dashboard')
@jwt_required
def creator_dashboard_api():
    """Creator dashboard stats for WiamStudio mobile."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    wiam_id = user.wiam_id

    from sqlalchemy import func

    books = Content.query.filter(
        Content.creator_wiam_id == wiam_id,
        Content.deleted_at.is_(None),
    ).all()

    pub_ids = [b.id for b in books if b.is_published]
    total_views = sum(b.views or 0 for b in books)
    followers_count = Follow.query.filter_by(creator_id=user.id).count()

    avg_rating = 0.0
    if pub_ids:
        result = db.session.query(func.avg(Rating.rating)).filter(
            Rating.content_id.in_(pub_ids)
        ).scalar()
        avg_rating = round(float(result or 0), 2)

    total_earnings = 0.0
    try:
        from ..services.monetization import COIN_TO_GHS
        earnings_rows = CreatorEarnings.query.filter_by(creator_id=wiam_id).all()
        for e in earnings_rows:
            coins = (e.coins_from_unlocks or 0) + (e.coins_from_tips or 0)
            total_earnings += coins * COIN_TO_GHS
    except Exception:
        pass

    return jsonify({
        'total_views': total_views,
        'followers_count': followers_count,
        'stories_count': len(books),
        'avg_rating': avg_rating,
        'total_earnings': round(total_earnings, 2),
    })


@api_v1.route('/creator/stories')
@jwt_required
def creator_stories_api():
    """List all stories belonging to the authenticated creator."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    wiam_id = user.wiam_id

    books = Content.query.filter(
        Content.creator_wiam_id == wiam_id,
        Content.deleted_at.is_(None),
    ).order_by(Content.created_at.desc()).all()

    stories = []
    for b in books:
        ch_count = WebBookContent.query.filter_by(content_id=b.id).count()
        stories.append({
            'id': b.id,
            'title': b.title,
            'status': b.status or 'draft',
            'genre': b.genre or '',
            'views': b.views or 0,
            'chapter_count': ch_count,
            'cover_url': _abs_url(b.cover_url),
            'created_at': b.created_at.isoformat() if b.created_at else None,
        })

    return jsonify({'stories': stories})


@api_v1.route('/creator/stories/<int:book_id>/analytics')
@jwt_required
def creator_story_analytics_api(book_id):
    """Per-book analytics for a creator (Push 5).

    Returns daily view buckets (last 30 days), aggregated totals, and a
    breakdown of engagement signals (favorites, ratings, comments,
    shares). Pulls from the AnalyticsEvent table populated in Push 3.
    Falls back to denormalized counters when the event log is empty
    (e.g. a freshly published book with no rows yet).
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user

    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'not_found'}), 404

    try:
        from ..models import AnalyticsEvent
    except Exception:
        AnalyticsEvent = None

    now = datetime.utcnow()
    cutoff = now - timedelta(days=30)

    daily_views = {}
    total_view_events = 0
    total_share_events = 0
    total_favorite_events = 0
    total_rating_events = 0
    total_comment_events = 0
    if AnalyticsEvent is not None:
        try:
            rows = AnalyticsEvent.query.filter(
                AnalyticsEvent.content_id == book.id,
                AnalyticsEvent.created_at >= cutoff,
            ).all()
            for r in rows:
                ts = r.created_at or now
                bucket = ts.strftime('%Y-%m-%d')
                if r.event_type in ('book_view', 'view'):
                    daily_views[bucket] = daily_views.get(bucket, 0) + 1
                    total_view_events += 1
                elif r.event_type == 'share':
                    total_share_events += 1
                elif r.event_type in ('favorite', 'unfavorite'):
                    if r.event_type == 'favorite':
                        total_favorite_events += 1
                elif r.event_type in ('rating', 'rating_update'):
                    total_rating_events += 1
                elif r.event_type == 'comment':
                    total_comment_events += 1
        except Exception:
            try:
                db.session.rollback()
            except Exception:
                pass

    daily_series = []
    for i in range(29, -1, -1):
        d = (now - timedelta(days=i)).strftime('%Y-%m-%d')
        daily_series.append({'date': d, 'views': int(daily_views.get(d, 0))})

    chapter_count = WebBookContent.query.filter_by(content_id=book.id).count()
    favorite_count_total = Favorite.query.filter_by(content_id=book.id).count()
    rating_count_total = Rating.query.filter_by(content_id=book.id).count()
    try:
        comment_count_total = ChapterComment.query.filter_by(content_id=book.id).count()
    except Exception:
        comment_count_total = 0

    rating_avg = float(book.avg_rating or 0)

    score_row = None
    try:
        from ..models import BookPopularityScore
        score_row = BookPopularityScore.query.get(book.id)
    except Exception:
        score_row = None

    return jsonify({
        'book': {
            'id': book.id,
            'title': book.title,
            'status': book.status or 'draft',
            'created_at': book.created_at.isoformat() if book.created_at else None,
            'published_at': book.published_at.isoformat() if getattr(book, 'published_at', None) else None,
            'cover_url': _abs_url(book.cover_url),
        },
        'totals': {
            'views': int(book.views or 0),
            'views_last_30d': int(total_view_events),
            'favorites': int(favorite_count_total),
            'favorite_events_last_30d': int(total_favorite_events),
            'ratings': int(rating_count_total),
            'rating_events_last_30d': int(total_rating_events),
            'rating_avg': round(rating_avg, 2),
            'comments': int(comment_count_total),
            'comment_events_last_30d': int(total_comment_events),
            'shares_last_30d': int(total_share_events),
            'chapters': int(chapter_count),
        },
        'daily_views': daily_series,
        'popularity': {
            'score': float(score_row.score) if score_row else 0.0,
            'view_score': float(score_row.view_score) if score_row else 0.0,
            'rating_score': float(score_row.rating_score) if score_row else 0.0,
            'favorite_score': float(score_row.favorite_score) if score_row else 0.0,
            'freshness_score': float(score_row.freshness_score) if score_row else 0.0,
            'updated_at': score_row.updated_at.isoformat() if score_row and score_row.updated_at else None,
        } if score_row else None,
    })


@api_v1.route('/creator/followers')
@jwt_required
def creator_followers_api():
    """List followers for the authenticated creator."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user

    follows = Follow.query.filter_by(creator_id=user.id).order_by(Follow.id.desc()).limit(100).all()
    follower_ids = [f.user_id for f in follows]

    followers = []
    if follower_ids:
        users = User.query.filter(User.id.in_(follower_ids)).all()
        user_map = {u.id: u for u in users}
        for fid in follower_ids:
            u = user_map.get(fid)
            if u:
                followers.append({
                    'id': u.id,
                    'wiam_id': u.wiam_id,
                    'display_name': u.display_name,
                    'username': u.username,
                    'avatar_url': u.avatar_url,
                })

    return jsonify({
        'followers': followers,
        'total': Follow.query.filter_by(creator_id=user.id).count(),
    })


@api_v1.route('/studio/stories', methods=['POST'])
@jwt_required
def studio_create_story_api():
    """Create a new story from the mobile app."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()[:500]
    genre = (data.get('genre') or '').strip()

    if not title:
        return jsonify({'error': 'Title is required'}), 400

    profile = CreatorProfile.query.get(user.wiam_id)
    author = (data.get('author') or '').strip()
    if not author:
        author = profile.pen_name if profile else user.display_name

    book = Content(
        title=title,
        author=author,
        description=description,
        genre=genre,
        status='draft',
        source='mobile',
        allow_download=False,
        creator_wiam_id=user.wiam_id,
        price=0.0,
    )
    db.session.add(book)
    db.session.flush()

    unit_label = _creator_default_unit_label(user)
    ch1 = WebBookContent(
        content_id=book.id,
        chapter_number=1,
        chapter_title=_unit_title(unit_label, 1),
        content_unit_label=unit_label,
        content_kind=unit_label,
        body='',
        word_count=0,
    )
    db.session.add(ch1)
    db.session.commit()

    return jsonify({
        'id': book.id,
        'title': book.title,
        'status': book.status,
    }), 201


@api_v1.route('/studio/stories/<int:book_id>')
@jwt_required
def studio_get_story_api(book_id):
    """Get a specific story by the authenticated creator."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    chapters = WebBookContent.query.filter_by(content_id=book_id)\
        .order_by(WebBookContent.chapter_number).all()
    unit_label = _creator_default_unit_label(user)

    return jsonify({
        'id': book.id,
        'title': book.title,
        'author': book.author,
        'description': book.description or '',
        'genre': book.genre or '',
        'status': book.status or 'draft',
        'views': book.views or 0,
        'cover_url': _abs_url(book.cover_url),
        'content_unit_label': unit_label,
        'chapters': [{
            'id': c.id,
            'chapter_number': c.chapter_number,
            'chapter_title': c.chapter_title or _unit_title(c.content_unit_label, c.chapter_number),
            'unit_label': _normalize_unit_label(c.content_unit_label or unit_label),
            'content_kind': (c.content_kind or '').strip().lower() or None,
            'word_count': c.word_count or 0,
            'status': c.status or 'draft',
            'is_published': (c.status == 'published'),
            'is_scheduled': bool(c.scheduled_publish_at) and c.status != 'published',
            'scheduled_publish_at': c.scheduled_publish_at.isoformat() if c.scheduled_publish_at else None,
            'published_at': c.published_at.isoformat() if c.published_at else None,
            'is_locked': c.is_locked or False,
            'updated_at': c.updated_at.isoformat() if c.updated_at else None,
        } for c in chapters],
    })


@api_v1.route('/studio/stories/<int:book_id>/save', methods=['POST'])
@jwt_required
def studio_save_chapter_api(book_id):
    """Save a chapter draft."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    data = request.get_json(silent=True) or {}
    ch_num = data.get('chapter_number', 1)
    ch = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first()
    unit_label = _creator_default_unit_label(user)
    if not ch:
        ch = WebBookContent(content_id=book_id, chapter_number=ch_num)
        db.session.add(ch)
    if not ch.content_unit_label:
        ch.content_unit_label = unit_label
    if not ch.content_kind:
        ch.content_kind = unit_label
    fallback_title = _unit_title(ch.content_unit_label or unit_label, ch_num)
    ch.chapter_title = data.get('chapter_title', ch.chapter_title or fallback_title)

    raw_body = data.get('body', ch.body or '')
    try:
        from ..services.chapter_sanitizer import sanitize_chapter_body
        ch.body = sanitize_chapter_body(raw_body)
    except Exception as exc:
        log.warning("sanitize_chapter_body failed: %s", exc)
        ch.body = raw_body
    ch.word_count = data.get('word_count', ch.word_count or 0)
    db.session.commit()

    return jsonify({'ok': True, 'chapter_number': ch.chapter_number})


@api_v1.route('/studio/stories/<int:book_id>/chapter/add', methods=['POST'])
@jwt_required
def studio_add_chapter_api(book_id):
    """Add a new chapter to a story."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    last = WebBookContent.query.filter_by(content_id=book_id)\
        .order_by(WebBookContent.chapter_number.desc()).first()
    next_num = (last.chapter_number + 1) if last else 1

    unit_label = _creator_default_unit_label(user)
    ch = WebBookContent(
        content_id=book_id,
        chapter_number=next_num,
        chapter_title=_unit_title(unit_label, next_num),
        content_unit_label=unit_label,
        content_kind=unit_label,
        body='',
        word_count=0,
    )
    db.session.add(ch)
    db.session.commit()

    return jsonify({'ok': True, 'chapter_number': next_num})


@api_v1.route('/studio/stories/<int:book_id>/chapter/<int:ch_num>')
@jwt_required
def studio_get_chapter_api(book_id, ch_num):
    """Get a specific chapter for editing."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    ch = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first()
    if not ch:
        return jsonify({'error': 'Chapter not found'}), 404

    # Status fields — explicit, since WebBookContent has no `is_published` property.
    # Mobile editors read `status` directly; legacy `is_published` kept for older app builds.
    ch_status = (ch.status or 'draft').lower()
    return jsonify({
        'chapter_number': ch.chapter_number,
        'chapter_title': ch.chapter_title or _unit_title(ch.content_unit_label, ch.chapter_number),
        'unit_label': _normalize_unit_label(ch.content_unit_label or _creator_default_unit_label(user)),
        'content_kind': (ch.content_kind or '').strip().lower() or None,
        'body': ch.body or '',
        'word_count': ch.word_count or 0,
        'updated_at': ch.updated_at.isoformat() if hasattr(ch, 'updated_at') and ch.updated_at else None,
        'status': ch_status,
        'is_published': ch_status == 'published',
        'is_scheduled': bool(ch.scheduled_publish_at) and ch_status != 'published',
        'scheduled_publish_at': ch.scheduled_publish_at.isoformat() if ch.scheduled_publish_at else None,
        'published_at': ch.published_at.isoformat() if ch.published_at else None,
    })


@api_v1.route('/studio/stories/<int:book_id>/settings', methods=['POST'])
@jwt_required
def studio_update_settings_api(book_id):
    """Update story settings (title, description, genre)."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    data = request.get_json(silent=True) or {}
    if 'title' in data and data['title'].strip():
        book.title = data['title'].strip()
    if 'description' in data:
        book.description = data['description'].strip()[:500]
    if 'genre' in data:
        book.genre = data['genre'].strip()
    if 'allow_download' in data:
        book.allow_download = bool(data['allow_download'])

    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/studio/stories/<int:book_id>/cover', methods=['POST'])
@jwt_required
def studio_upload_cover_api(book_id):
    """Upload a cover image for a story."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    if 'cover' not in request.files:
        return jsonify({'error': 'No cover file provided'}), 400

    cover_file = request.files['cover']
    if not cover_file or not cover_file.filename:
        return jsonify({'error': 'Invalid file'}), 400

    allowed_ext = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ext = cover_file.filename.rsplit('.', 1)[-1].lower() if '.' in cover_file.filename else ''
    if ext not in allowed_ext:
        return jsonify({'error': 'Unsupported image format. Use JPG, PNG, or WebP.'}), 400

    cover_bytes = cover_file.read()
    if not cover_bytes:
        return jsonify({'error': 'Empty cover file'}), 400

    ct_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp'}
    ct = ct_map.get(ext, 'image/jpeg')

    # Same pipeline as web Studio: validate_cover expects a seekable file-like object
    # and returns a dict — not (ok, err) tuples. Passing raw bytes caused 500s on mobile.
    from ..services.cover_scanner import validate_cover, normalize_cover, check_duplicate_cover

    scan = validate_cover(BytesIO(cover_bytes))
    if not scan.get('valid'):
        if scan.get('nsfw'):
            from ..services.cover_scanner import issue_cover_strike
            issue_cover_strike(
                user.id,
                scan.get('skin_ratio', 0),
                severe=scan.get('severe', False),
            )
        return jsonify({'error': scan.get('error') or 'Cover did not pass validation.'}), 400

    if scan.get('hash'):
        dupe_book = check_duplicate_cover(scan['hash'], exclude_book_id=book_id)
        if dupe_book:
            return jsonify({
                'error': (
                    f'This cover image is already used by another story ("{dupe_book.title}"). '
                    'Please use an original cover.'
                ),
            }), 400

    try:
        cover_bytes, ct = normalize_cover(cover_bytes, ct)
    except Exception:
        # Normalization is best-effort — if it fails, fall through and let
        # the upstream upload still attempt the original bytes.
        pass

    from ..services.image_service import upload_cover as cloud_upload_cover
    cloud_id = cloud_upload_cover(cover_bytes, book.id, ct, scan_nsfw=True)
    if not cloud_id:
        # Could be a configuration miss OR a rejection from the NSFW scanner.
        # We can't tell them apart from the helper return value, so always
        # return a friendly explicit-content message — admin logs will have
        # the precise reason.
        return jsonify({
            'error': (
                'We could not accept this cover. Make sure it follows '
                'community guidelines (no nudity, gore, or hate symbols) '
                'and try a different image.'
            ),
        }), 400
    book.cover_file_id = cloud_id
    db.session.commit()

    return jsonify({'ok': True, 'cover_url': _abs_url(book.cover_url)})


@api_v1.route('/studio/stories/<int:book_id>/publish', methods=['POST'])
@jwt_required
def studio_publish_story_api(book_id):
    """Publish or change the status of a story — web-parity edition.

    On the first transition out of ``draft`` we stamp ``published_at`` and
    fire ``notify_new_book_published`` so followers learn about the launch.
    Subsequent status flips (ongoing -> complete -> hidden -> ongoing)
    don't re-notify but they do log a ``story_status_change`` analytics row
    so we can graph creator activity.
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    data = request.get_json(silent=True) or {}
    action = data.get('action', 'ongoing')
    valid = ['draft', 'ongoing', 'complete', 'hidden']
    if action not in valid:
        return jsonify({'error': f'Invalid action. Must be one of: {valid}'}), 400

    previous_status = book.status
    going_live = action in ('ongoing', 'complete') and previous_status == 'draft'
    book.status = action
    if going_live and not book.published_at:
        book.published_at = datetime.utcnow()

    try:
        from ..services.analytics import track
        track(
            'publish_story' if going_live else 'story_status_change',
            user,
            content_id=book_id,
            previous_status=previous_status,
            new_status=action,
            source='mobile',
        )
    except Exception:
        pass

    db.session.commit()

    if going_live:
        try:
            from ..services.notifications import notify_new_book_published
            notify_new_book_published(book_id)
        except Exception as exc:
            log.warning("notify_new_book_published skipped book=%s: %s", book_id, exc)

    return jsonify({
        'ok': True,
        'status': book.status,
        'published_at': book.published_at.isoformat() if book.published_at else None,
    })


@api_v1.route('/studio/stories/<int:book_id>/chapter/<int:ch_num>/publish', methods=['POST'])
@jwt_required
def studio_publish_chapter_api(book_id, ch_num):
    """Toggle publish status of a chapter — full parity with the web Studio.

    The previous mobile implementation just flipped ``status='published'``
    with no moderation scan, no ``published_at`` timestamp, and no follower
    notification. That meant a creator who only ever used the Expo app
    could publish chapters that the web equivalent would block, and their
    followers would never learn about new chapters. Workstream D fixes
    that by mirroring the web ``publish_chapter`` flow byte-for-byte.
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    ch = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first()
    if not ch:
        return jsonify({'error': 'Chapter not found'}), 404

    data = request.get_json(silent=True) or {}
    publish = data.get('publish', True)

    if publish:
        if not ch.body or not ch.body.strip():
            return jsonify({'error': 'Cannot publish an empty chapter.'}), 400

        try:
            from ..services.moderation import scan_chapter_on_publish
            result = scan_chapter_on_publish(book_id, ch_num, ch.body, ch.chapter_title or '')
            if result.get('should_reject'):
                return jsonify({
                    'error': 'This chapter contains prohibited content and cannot be published. Please review and edit it.',
                }), 400
            flagged = bool(result.get('should_flag'))
        except Exception as exc:
            log.warning("studio mobile publish scan skipped book=%s ch=%s: %s", book_id, ch_num, exc)
            flagged = False

        was_unpublished = (ch.status != 'published')
        ch.status = 'published'
        ch.updated_at = datetime.utcnow()
        if was_unpublished:
            ch.published_at = datetime.utcnow()

        try:
            from ..services.analytics import track
            track('publish_chapter', user, content_id=book_id, chapter_number=ch_num, source='mobile')
        except Exception:
            pass

        db.session.commit()

        # Fire follower notifications only on the first publish so we don't
        # spam followers when a creator toggles draft -> published a few times.
        if was_unpublished:
            try:
                from ..services.notifications import notify_new_chapter
                notify_new_chapter(book_id, ch_num, ch.chapter_title or '')
            except Exception as exc:
                log.warning("notify_new_chapter skipped book=%s ch=%s: %s", book_id, ch_num, exc)

        return jsonify({
            'ok': True,
            'status': ch.status,
            'flagged': flagged,
            'message': 'Chapter flagged for review but still published.' if flagged else None,
        })

    # Unpublish path
    ch.status = 'draft'
    ch.updated_at = datetime.utcnow()
    try:
        from ..services.analytics import track
        track('unpublish_chapter', user, content_id=book_id, chapter_number=ch_num, source='mobile')
    except Exception:
        pass
    db.session.commit()
    return jsonify({'ok': True, 'status': ch.status})


@api_v1.route('/studio/stories/<int:book_id>/publish-all-chapters', methods=['POST'])
@jwt_required
def studio_publish_all_chapters_api(book_id):
    """Publish every draft chapter that has content — with full parity.

    Each chapter is scanned by ``scan_chapter_on_publish`` first; rejected
    chapters stay in draft and are reported back so the creator can fix
    them, while clean ones get ``published_at`` set and trigger a
    ``notify_new_chapter`` push to followers. We batch the scans and the
    notifications to avoid N round-trips.
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    from ..services.moderation import scan_chapter_on_publish
    from ..services.analytics import track

    chapters = WebBookContent.query.filter_by(content_id=book_id).all()
    published = []
    rejected = []
    for ch in chapters:
        if ch.status != 'draft' or not ch.body or not ch.body.strip():
            continue
        try:
            result = scan_chapter_on_publish(book_id, ch.chapter_number, ch.body, ch.chapter_title or '')
        except Exception as exc:
            log.warning("publish-all scan skip book=%s ch=%s: %s", book_id, ch.chapter_number, exc)
            result = {'should_reject': False, 'should_flag': False}
        if result.get('should_reject'):
            rejected.append({'chapter_number': ch.chapter_number, 'title': ch.chapter_title})
            continue
        ch.status = 'published'
        ch.updated_at = datetime.utcnow()
        if not ch.published_at:
            ch.published_at = datetime.utcnow()
        published.append(ch)
        track('publish_chapter', user, content_id=book_id, chapter_number=ch.chapter_number, source='mobile_bulk')

    db.session.commit()

    for ch in published:
        try:
            from ..services.notifications import notify_new_chapter
            notify_new_chapter(book_id, ch.chapter_number, ch.chapter_title or '')
        except Exception as exc:
            log.warning("notify_new_chapter skipped book=%s ch=%s: %s", book_id, ch.chapter_number, exc)

    return jsonify({
        'ok': True,
        'published_count': len(published),
        'rejected': rejected,
    })


@api_v1.route('/studio/stories/<int:book_id>/delete', methods=['POST'])
@jwt_required
def studio_delete_story_api(book_id):
    """Soft-delete a story."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    book.deleted_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/studio/stories/<int:book_id>/chapter/<int:ch_num>/delete', methods=['POST'])
@jwt_required
def studio_delete_chapter_api(book_id, ch_num):
    """Delete a chapter from a story."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == user.wiam_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Story not found'}), 404

    ch = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first()
    if not ch:
        return jsonify({'error': 'Chapter not found'}), 404

    # Don't allow deleting the only chapter
    total = WebBookContent.query.filter_by(content_id=book_id).count()
    if total <= 1:
        return jsonify({'error': 'Cannot delete the only chapter'}), 400

    db.session.delete(ch)
    # Re-number remaining chapters
    remaining = WebBookContent.query.filter_by(content_id=book_id)\
        .order_by(WebBookContent.chapter_number).all()
    for i, c in enumerate(remaining, 1):
        c.chapter_number = i
    db.session.commit()

    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# BULLETIN API (for mobile app)
# ---------------------------------------------------------------------------

@api_v1.route('/bulletin/feed')
@jwt_required
def bulletin_feed_api():
    """Bulletin feed for the mobile app — returns latest posts from followed creators.

    Bug fix: merges both BulletinFollow *and* the main Follow table so users
    who follow a creator via the regular follow button also see their
    Bulletin posts.  Also adds missing ``id``, ``username``, ``is_verified``,
    ``is_creator`` fields to the creator object so mobile navigation + badges
    work correctly.
    """
    user = request.api_user
    uid = user.wiam_id
    page = request.args.get('page', 1, type=int)
    per_page = 20

    from ..models import BulletinPost, BulletinFollow, BulletinReaction

    # --- Merge both follow sources into one set of creator wiam_ids ---
    # 1) BulletinFollow (explicit bulletin subscription, uses wiam_id)
    bfollows = BulletinFollow.query.filter_by(user_id=uid).all()
    creator_wiam_ids = set(bf.creator_id for bf in bfollows)

    # 2) Main Follow table (uses user.id PK).  Map creator PKs → wiam_ids.
    main_follows = Follow.query.filter_by(user_id=user.id).all()
    if main_follows:
        main_creator_pks = [f.creator_id for f in main_follows]
        main_creators = User.query.filter(User.id.in_(main_creator_pks)).all()
        for c in main_creators:
            if c.wiam_id:
                creator_wiam_ids.add(c.wiam_id)

    # Always include official bulletin (creator_id=0)
    creator_wiam_ids.add(0)
    creator_ids = list(creator_wiam_ids)

    if not creator_ids:
        return jsonify({'posts': [], 'page': page, 'has_more': False})

    query = BulletinPost.query.filter(
        BulletinPost.creator_id.in_(creator_ids),
        BulletinPost.is_deleted == False,
    ).order_by(BulletinPost.created_at.desc())

    total = query.count()
    posts = query.offset((page - 1) * per_page).limit(per_page).all()

    # --- Batch-load creators to avoid N+1 queries ---
    post_creator_wids = list({p.creator_id for p in posts if p.creator_id != 0})
    creator_map = {}
    profile_map = {}
    if post_creator_wids:
        creators_batch = User.query.filter(User.wiam_id.in_(post_creator_wids)).all()
        creator_map = {c.wiam_id: c for c in creators_batch}
        profiles_batch = CreatorProfile.query.filter(
            CreatorProfile.wiam_id.in_(post_creator_wids)
        ).all()
        profile_map = {cp.wiam_id: cp for cp in profiles_batch}

    # Get user reactions for these posts
    post_ids = [p.id for p in posts]
    user_reactions = {}
    if post_ids:
        reacts = BulletinReaction.query.filter(
            BulletinReaction.post_id.in_(post_ids),
            BulletinReaction.user_id == uid,
        ).all()
        for r in reacts:
            user_reactions.setdefault(r.post_id, []).append(r.emoji)

    # Build set of creator IDs where user has an active creator subscription
    from ..services.creator_sub_service import check_subscription as _check_csub
    subscribed_creator_ids = set()
    for cid in creator_ids:
        if cid == 0:
            continue
        if _check_csub(user.id, cid):
            subscribed_creator_ids.add(cid)

    # --- Batch-load books for book_share posts ---
    book_ids = [p.content_id for p in posts if p.type == 'book_share' and p.content_id]
    book_map = {}
    if book_ids:
        books_batch = Content.query.filter(Content.id.in_(book_ids)).all()
        book_map = {b.id: b for b in books_batch}

    result = []
    for p in posts:
        creator = creator_map.get(p.creator_id)
        cp = profile_map.get(p.creator_id)
        book = book_map.get(p.content_id) if p.type == 'book_share' and p.content_id else None
        is_sub_only = getattr(p, 'is_subscriber_only', False)
        is_subscribed = p.creator_id in subscribed_creator_ids
        # Hide subscriber-only content for non-subscribers
        show_content = not is_sub_only or is_subscribed or _is_own_bulletin(uid, p.creator_id)

        if p.creator_id != 0 and creator:
            creator_obj = {
                'id': creator.id,
                'wiam_id': p.creator_id,
                'username': creator.username,
                'display_name': creator.display_name or 'Creator',
                'pen_name': cp.pen_name if cp else None,
                'avatar_url': _abs_url(creator.avatar_url) if creator.avatar_url else None,
                'is_creator': creator.is_creator,
                'is_verified': bool(getattr(creator, 'is_verified', False)),
            }
        elif p.creator_id != 0:
            creator_obj = {
                'id': 0,
                'wiam_id': p.creator_id,
                'username': None,
                'display_name': 'Creator',
                'pen_name': None,
                'avatar_url': None,
                'is_creator': True,
                'is_verified': False,
            }
        else:
            creator_obj = {
                'id': 0,
                'wiam_id': 0,
                'username': 'wiamapp',
                'display_name': 'WiamApp Official',
                'pen_name': None,
                'avatar_url': None,
                'is_creator': False,
                'is_verified': True,
            }

        result.append({
            'id': p.id,
            'type': p.type,
            'text': p.text_content or '' if show_content else '',
            'is_pinned': p.is_pinned,
            'is_subscriber_only': is_sub_only,
            'is_locked': is_sub_only and not show_content,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'creator': creator_obj,
            'book': {
                'id': book.id,
                'title': book.title,
                'cover_url': _abs_url(book.cover_url) if book.cover_url else None,
                'author': creator_obj.get('username') or 'unknown',
            } if book else None,
            'reactions': p.reactions_summary,
            'total_reactions': p.total_reactions,
            'user_emojis': user_reactions.get(p.id, []),
        })

    return jsonify({
        'posts': result,
        'page': page,
        'per_page': per_page,
        'has_more': (page * per_page) < total,
    })


@api_v1.route('/bulletin/<int:post_id>/react', methods=['POST'])
@jwt_required
def bulletin_react_api(post_id):
    """Toggle a reaction on a bulletin post."""
    user = request.api_user
    data = request.get_json(silent=True) or {}
    emoji = data.get('emoji', '')

    if not emoji:
        return jsonify({'error': 'emoji required'}), 400

    from ..models import BulletinPost, BulletinReaction

    post = BulletinPost.query.filter_by(id=post_id, is_deleted=False).first()
    if not post:
        return jsonify({'error': 'Post not found'}), 404

    existing = BulletinReaction.query.filter_by(
        post_id=post_id, user_id=user.wiam_id, emoji=emoji
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'ok': True, 'action': 'removed'})
    else:
        r = BulletinReaction(post_id=post_id, user_id=user.wiam_id, emoji=emoji)
        db.session.add(r)
        db.session.commit()
        return jsonify({'ok': True, 'action': 'added'})


# ---------------------------------------------------------------------------
# Push Notification Token Registration
# ---------------------------------------------------------------------------

@api_v1.route('/push-token', methods=['POST'])
@jwt_required
def register_push_token():
    """
    Register an Expo push token for the authenticated user.

    JSON body:
      { token: "ExponentPushToken[...]", device_name?: string, platform?: "ios"|"android" }
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    token = data.get('token', '')
    device_name = data.get('device_name', '')
    platform = data.get('platform', '')

    if not token or not token.startswith('ExponentPushToken['):
        return jsonify({'ok': False, 'error': 'Invalid Expo push token'}), 400

    # Tokens must be associated with the same id we use when looking up
    # notifications and resolving recipients (wiam_id when present, otherwise
    # the internal user id). Earlier builds keyed only on wiam_id, which
    # caused legacy users without a wiam_id to silently drop pushes.
    push_user_id = user.wiam_id or user.id
    from ..services.expo_push import register_token
    result = register_token(push_user_id, token, device_name, platform)
    if result:
        return jsonify({'ok': True})
    return jsonify({'ok': False, 'error': 'Failed to register token'}), 500


@api_v1.route('/push-token', methods=['DELETE'])
@jwt_required
def unregister_push_token():
    """
    Unregister an Expo push token (e.g. on logout).

    JSON body:
      { token: "ExponentPushToken[...]" }
    """
    data = request.get_json(silent=True) or {}
    token = data.get('token', '')

    if not token:
        return jsonify({'ok': False, 'error': 'Token required'}), 400

    from ..services.expo_push import unregister_token
    unregister_token(token)
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# ADS — impression logging & creator revenue share
# ---------------------------------------------------------------------------

# Estimated revenue per impression by ad type (USD)
_AD_EST_REV = {'banner': 0.001, 'interstitial': 0.005, 'rewarded': 0.015}


@api_v1.route('/ads/impression', methods=['POST'])
@jwt_optional
def log_ad_impression():
    """
    Log a single ad impression from the mobile app.

    JSON body:
      { ad_type: "banner"|"interstitial"|"rewarded",
        placement: "home"|"browse"|"book_detail"|"reader"|"comments"|"studio",
        book_id: <int|null> }
    """
    data = request.get_json(silent=True) or {}
    ad_type = data.get('ad_type', '')
    placement = data.get('placement', '')
    book_id = data.get('book_id')

    if ad_type not in ('banner', 'interstitial', 'rewarded'):
        return jsonify({'error': 'Invalid ad_type'}), 400
    if not placement:
        return jsonify({'error': 'placement required'}), 400

    user = request.api_user
    uid = None
    if user:
        uid = user.wiam_id or user.id

    creator_id = None
    attribution = 'platform_only'

    # If book_id provided and placement is in reader/book_detail/comments → creator_share
    if book_id and placement in ('reader', 'book_detail', 'comments'):
        book = Content.query.get(book_id)
        if book and book.user_id:
            creator_id = book.user_id
            attribution = 'creator_share'

    est_rev = _AD_EST_REV.get(ad_type, 0.001)

    imp = AdImpression(
        user_id=uid,
        book_id=book_id,
        creator_id=creator_id,
        ad_type=ad_type,
        placement=placement,
        attribution=attribution,
        estimated_revenue_usd=est_rev,
    )
    db.session.add(imp)
    db.session.commit()

    return jsonify({'ok': True})


@api_v1.route('/ads/reward-unlock', methods=['POST'])
@jwt_required
def reward_ad_unlock():
    """
    Record a chapter unlock earned by watching a rewarded ad.
    JSON body: { content_id, chapter_number }
    Creates a ChapterUnlock with unlock_method='rewarded_ad'.
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id')
    chapter_num = data.get('chapter_number')

    if not content_id or not chapter_num:
        return jsonify({'error': 'content_id and chapter_number required'}), 400

    chapter = WebBookContent.query.filter_by(
        content_id=content_id, chapter_number=chapter_num
    ).first()
    if not chapter:
        return jsonify({'error': 'Chapter not found'}), 404

    uid = user.wiam_id or user.id

    # Already unlocked?
    existing = ChapterUnlock.query.filter(
        ChapterUnlock.content_id == content_id,
        ChapterUnlock.chapter_number == chapter_num,
        db.or_(ChapterUnlock.user_id == user.id, ChapterUnlock.user_id == uid),
    ).first()
    if existing:
        return jsonify({'ok': True, 'already_unlocked': True})

    book = Content.query.get(content_id)
    creator_id = book.creator_wiam_id if book else 0

    unlock = ChapterUnlock(
        user_id=uid, content_id=content_id,
        chapter_number=chapter_num, coins_spent=0,
        creator_id=creator_id,
        unlock_method='rewarded_ad',
    )
    db.session.add(unlock)
    db.session.commit()

    return jsonify({'ok': True})


@api_v1.route('/creator/ad-earnings')
@jwt_required
def creator_ad_earnings():
    """
    Return the authenticated creator's ad revenue share.

    Response:
      { total_impressions, total_revenue_usd, creator_share_usd, monthly: [...] }
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    uid = user.wiam_id or user.id

    impressions = AdImpression.query.filter_by(
        creator_id=uid, attribution='creator_share'
    ).all()

    total_impressions = len(impressions)
    total_revenue = sum(i.estimated_revenue_usd for i in impressions)
    creator_share = total_revenue * 0.5  # 50% to creator

    # Group by month
    monthly = {}
    for imp in impressions:
        key = imp.created_at.strftime('%Y-%m') if imp.created_at else 'unknown'
        if key not in monthly:
            monthly[key] = {'impressions': 0, 'revenue_usd': 0.0, 'creator_share_usd': 0.0}
        monthly[key]['impressions'] += 1
        monthly[key]['revenue_usd'] += imp.estimated_revenue_usd
        monthly[key]['creator_share_usd'] += imp.estimated_revenue_usd * 0.5

    monthly_list = [
        {'month': k, **v}
        for k, v in sorted(monthly.items(), reverse=True)
    ]

    return jsonify({
        'total_impressions': total_impressions,
        'total_revenue_usd': round(total_revenue, 4),
        'creator_share_usd': round(creator_share, 4),
        'monthly': monthly_list,
    })


@api_v1.route('/premium/dev-activate', methods=['POST'])
@jwt_required
def dev_activate_premium():
    """
    DEV/SANDBOX — Activate premium without going through IAP.
    In production: restricted to founder accounts only.
    In dev: available to all authenticated users.
    """
    is_prod = bool(os.environ.get('RENDER') or os.environ.get('FLASK_ENV') == 'production')
    if is_prod and not getattr(request.api_user, 'is_founder', False):
        return jsonify({'error': 'Only available for founder accounts in production'}), 403

    user = request.api_user
    data = request.get_json(silent=True) or {}
    plan = data.get('plan', 'plus')
    if plan not in ('basic', 'plus', 'unlimited'):
        return jsonify({'error': 'Invalid plan. Use: basic, plus, unlimited'}), 400

    from ..services.premium_service import activate_premium
    expires = datetime.utcnow() + timedelta(days=30)
    activate_premium(user, plan=plan, provider='dev_sandbox', expires_at=expires)

    return jsonify({
        'ok': True,
        'message': f'DEV sandbox: {plan} premium activated for 30 days',
        'plan': plan,
        'expires_at': expires.isoformat(),
    })


@api_v1.route('/premium/status')
@jwt_required
def premium_status():
    """
    Return the authenticated user's premium subscription status.

    Response:
      { is_premium, status, plan, expires_at, credits_balance, trial_remaining_days }
    """
    user = request.api_user
    # Expiry already enforced by JWT middleware (check_and_expire_premium)
    is_active = user.premium_status in ('active', 'trial')
    trial_remaining = 0
    if user.premium_status == 'trial' and user.premium_expires_at:
        delta = user.premium_expires_at - datetime.utcnow()
        trial_remaining = max(0, delta.days)
    device_hash = _extract_device_hash()
    trial_eligible = (not bool(getattr(user, 'trial_used', False))) and (not _device_trial_used(device_hash))

    return jsonify({
        'is_premium': is_active,
        'status': user.premium_status or 'none',
        'plan': user.premium_plan or 'none',
        'expires_at': user.premium_expires_at.isoformat() if user.premium_expires_at else None,
        'credits_balance': user.premium_credits_balance or 0,
        'trial_remaining_days': trial_remaining,
        'trial_used': bool(getattr(user, 'trial_used', False)),
        'trial_eligible': bool(trial_eligible),
        'integrity_required_for_trial': bool(current_app.config.get('PLAY_INTEGRITY_REQUIRED_FOR_TRIAL', False)),
        'ios_integrity_required_for_trial': bool(current_app.config.get('IOS_INTEGRITY_REQUIRED_FOR_TRIAL', False)),
    })


@api_v1.route('/security/play-integrity/verify', methods=['POST'])
@jwt_required
def verify_play_integrity():
    """
    Verify Play Integrity token and return security verdict.
    This endpoint is rollout-safe and can be called before premium trial starts.
    """
    from ..services.play_integrity import verify_play_integrity_token

    user = request.api_user
    data = request.get_json(silent=True) or {}
    token = (data.get('play_integrity_token') or '').strip()
    nonce = (data.get('integrity_nonce') or '').strip() or None
    result = verify_play_integrity_token(token, expected_nonce=nonce)

    _audit_security(user, 'PLAY_INTEGRITY_VERIFY', {
        'ok': result.get('ok'),
        'allow_trial': result.get('allow_trial'),
        'reason': result.get('reason'),
        'risk_score': result.get('risk_score'),
        'nonce_ok': result.get('nonce_ok'),
        'app_ok': result.get('app_ok'),
        'device_ok': result.get('device_ok'),
        'licensing_ok': result.get('licensing_ok'),
    })
    db.session.commit()

    status_code = 200 if result.get('ok') else 400
    return jsonify({
        'ok': bool(result.get('ok')),
        'allow_trial': bool(result.get('allow_trial')),
        'reason': result.get('reason'),
        'risk_score': result.get('risk_score'),
        'nonce_ok': bool(result.get('nonce_ok')),
        'app_ok': bool(result.get('app_ok')),
        'device_ok': bool(result.get('device_ok')),
        'licensing_ok': bool(result.get('licensing_ok')),
        'skipped': bool(result.get('skipped')),
    }), status_code


@api_v1.route('/security/integrity/nonce', methods=['POST'])
@jwt_required
def issue_integrity_nonce():
    """
    Issue short-lived signed nonce bound to user+platform.
    Client must pass this as integrity_nonce when requesting attestation.
    """
    from ..services.integrity_nonce import mint_integrity_nonce

    user = request.api_user
    data = request.get_json(silent=True) or {}
    platform = (data.get('platform') or request.headers.get('X-Device-Platform') or '').strip().lower()
    if platform not in ('android', 'ios'):
        return jsonify({'ok': False, 'error': 'Unsupported platform for integrity nonce'}), 400

    nonce = mint_integrity_nonce(user.wiam_id or user.id, platform)
    return jsonify({'ok': True, 'integrity_nonce': nonce, 'platform': platform})


@api_v1.route('/security/ios-integrity/verify', methods=['POST'])
@jwt_required
def verify_ios_integrity():
    """
    Verify iOS integrity token and return security verdict.
    """
    from ..services.ios_integrity import verify_ios_integrity_token

    user = request.api_user
    data = request.get_json(silent=True) or {}
    token = (data.get('ios_integrity_token') or '').strip()
    nonce = (data.get('integrity_nonce') or '').strip() or None
    result = verify_ios_integrity_token(token, expected_nonce=nonce)

    _audit_security(user, 'IOS_INTEGRITY_VERIFY', {
        'ok': result.get('ok'),
        'allow_trial': result.get('allow_trial'),
        'reason': result.get('reason'),
        'risk_score': result.get('risk_score'),
        'nonce_ok': result.get('nonce_ok'),
        'token_ok': result.get('token_ok'),
    })
    db.session.commit()

    status_code = 200 if result.get('ok') else 400
    return jsonify({
        'ok': bool(result.get('ok')),
        'allow_trial': bool(result.get('allow_trial')),
        'reason': result.get('reason'),
        'risk_score': result.get('risk_score'),
        'nonce_ok': bool(result.get('nonce_ok')),
        'token_ok': bool(result.get('token_ok')),
        'skipped': bool(result.get('skipped')),
    }), status_code


@api_v1.route('/premium/start-trial', methods=['POST'])
@jwt_required
def premium_start_trial():
    """
    Start one 7-day premium trial for the authenticated user.
    Anti-abuse checks:
      - user.trial_used must be false
      - device fingerprint must not have consumed a previous trial
    """
    user = request.api_user
    if user.premium_status in ('active', 'trial'):
        return jsonify({'ok': False, 'error': 'Premium is already active on this account'}), 400

    data = request.get_json(silent=True) or {}
    device_hash = _extract_device_hash(data)
    platform = (data.get('platform') or request.headers.get('X-Device-Platform') or '').strip().lower()
    requires_android_integrity = bool(current_app.config.get('PLAY_INTEGRITY_REQUIRED_FOR_TRIAL', False))
    requires_ios_integrity = bool(current_app.config.get('IOS_INTEGRITY_REQUIRED_FOR_TRIAL', False))

    if bool(getattr(user, 'trial_used', False)):
        return jsonify({'ok': False, 'error': 'Free trial has already been used on this account'}), 403
    if device_hash and _device_trial_used(device_hash):
        user.trial_used = True
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        return jsonify({'ok': False, 'error': 'Free trial has already been used on this device'}), 403

    # Android production hardening: require device authenticity verdict before trial start.
    if platform == 'android' and requires_android_integrity:
        from ..services.play_integrity import verify_play_integrity_token
        from ..services.integrity_nonce import verify_integrity_nonce
        token = (data.get('play_integrity_token') or '').strip()
        nonce = (data.get('integrity_nonce') or '').strip() or None
        nonce_ok, nonce_reason = verify_integrity_nonce(
            nonce,
            expected_user_id=user.wiam_id or user.id,
            expected_platform='android',
            max_age_seconds=300,
        )
        if not nonce_ok:
            _audit_security(user, 'TRIAL_ANDROID_NONCE_REJECTED', {'reason': nonce_reason})
            db.session.commit()
            return jsonify({
                'ok': False,
                'error': 'Security nonce is invalid or expired. Please try again.',
                'reason': nonce_reason,
                'risk_score': 95,
            }), 403
        verify_result = verify_play_integrity_token(token, expected_nonce=nonce)
        _audit_security(user, 'TRIAL_INTEGRITY_CHECK', {
            'allow_trial': verify_result.get('allow_trial'),
            'reason': verify_result.get('reason'),
            'risk_score': verify_result.get('risk_score'),
            'device_hash_present': bool(device_hash),
        })
        if not verify_result.get('allow_trial'):
            db.session.commit()
            return jsonify({
                'ok': False,
                'error': 'Device authenticity check failed. Free trial is blocked on this device.',
                'reason': verify_result.get('reason'),
                'risk_score': verify_result.get('risk_score'),
            }), 403

    # iOS production hardening: require iOS integrity verdict before trial start.
    if platform == 'ios' and requires_ios_integrity:
        from ..services.ios_integrity import verify_ios_integrity_token
        from ..services.integrity_nonce import verify_integrity_nonce
        token = (data.get('ios_integrity_token') or '').strip()
        nonce = (data.get('integrity_nonce') or '').strip() or None
        nonce_ok, nonce_reason = verify_integrity_nonce(
            nonce,
            expected_user_id=user.wiam_id or user.id,
            expected_platform='ios',
            max_age_seconds=300,
        )
        if not nonce_ok:
            _audit_security(user, 'TRIAL_IOS_NONCE_REJECTED', {'reason': nonce_reason})
            db.session.commit()
            return jsonify({
                'ok': False,
                'error': 'Security nonce is invalid or expired. Please try again.',
                'reason': nonce_reason,
                'risk_score': 95,
            }), 403
        verify_result = verify_ios_integrity_token(token, expected_nonce=nonce)
        _audit_security(user, 'TRIAL_IOS_INTEGRITY_CHECK', {
            'allow_trial': verify_result.get('allow_trial'),
            'reason': verify_result.get('reason'),
            'risk_score': verify_result.get('risk_score'),
            'device_hash_present': bool(device_hash),
        })
        if not verify_result.get('allow_trial'):
            db.session.commit()
            return jsonify({
                'ok': False,
                'error': 'iOS device authenticity check failed. Free trial is blocked on this device.',
                'reason': verify_result.get('reason'),
                'risk_score': verify_result.get('risk_score'),
            }), 403

    expires = datetime.utcnow() + timedelta(days=7)
    user.premium_status = 'trial'
    user.premium_plan = 'basic'
    user.premium_provider = 'trial'
    user.premium_started_at = datetime.utcnow()
    user.premium_expires_at = expires
    user.trial_used = True

    _record_device_trial(device_hash, user.wiam_id or user.id)
    _audit_security(user, 'TRIAL_STARTED', {
        'device_hash_present': bool(device_hash),
        'platform': platform,
        'provider': 'trial',
    })
    db.session.commit()

    return jsonify({
        'ok': True,
        'status': 'trial',
        'plan': 'basic',
        'expires_at': expires.isoformat(),
        'trial_used': True,
    })


# ---------------------------------------------------------------------------
# PREMIUM CREDITS — grant, spend, history
# ---------------------------------------------------------------------------

# Monthly credit grants by plan
_PLAN_CREDITS = {'basic': 5, 'plus': 15, 'unlimited': 999}


@api_v1.route('/premium/credits/claim', methods=['POST'])
@jwt_required
def claim_monthly_credits():
    """
    Claim monthly premium credits. Idempotent — only grants once per cycle.
    Returns { ok, credits_balance, granted }.
    """
    from ..models import PremiumCreditsLedger
    user = request.api_user

    if user.premium_status not in ('active', 'trial'):
        return jsonify({'error': 'Premium subscription required'}), 403

    plan = user.premium_plan or 'basic'
    grant_amount = _PLAN_CREDITS.get(plan, 5)

    now = datetime.utcnow()
    cycle_start = user.premium_credits_cycle_start
    cycle_end = user.premium_credits_cycle_end

    # Check if we're still in the current cycle
    if cycle_start and cycle_end and cycle_start <= now <= cycle_end:
        return jsonify({
            'ok': True, 'credits_balance': user.premium_credits_balance or 0,
            'granted': 0, 'message': 'Credits already claimed this cycle',
            'cycle_end': cycle_end.isoformat(),
        })

    # New cycle: grant credits
    new_cycle_start = now
    # Cycle ends on the 1st of next month
    if now.month == 12:
        new_cycle_end = datetime(now.year + 1, 1, 1)
    else:
        new_cycle_end = datetime(now.year, now.month + 1, 1)

    new_balance = (user.premium_credits_balance or 0) + grant_amount
    user.premium_credits_balance = new_balance
    user.premium_credits_cycle_start = new_cycle_start
    user.premium_credits_cycle_end = new_cycle_end

    ledger = PremiumCreditsLedger(
        user_id=user.wiam_id or user.id,
        type='grant',
        amount=grant_amount,
        balance_after=new_balance,
        reason=f'monthly_grant:{plan}',
    )
    db.session.add(ledger)
    db.session.commit()

    return jsonify({
        'ok': True, 'credits_balance': new_balance,
        'granted': grant_amount, 'cycle_end': new_cycle_end.isoformat(),
    })


@api_v1.route('/premium/credits/unlock', methods=['POST'])
@jwt_required
def unlock_with_credits():
    """
    Spend 1 premium credit to unlock a locked chapter (instead of coins).
    JSON body: { content_id, chapter_number }
    """
    from ..models import PremiumCreditsLedger, WebBookContent, ChapterUnlock
    user = request.api_user

    if user.premium_status not in ('active', 'trial'):
        return jsonify({'error': 'Premium subscription required'}), 403

    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id')
    chapter_num = data.get('chapter_number')
    if not content_id or not chapter_num:
        return jsonify({'error': 'content_id and chapter_number required'}), 400

    chapter = WebBookContent.query.filter_by(
        content_id=content_id, chapter_number=chapter_num
    ).first()
    if not chapter:
        return jsonify({'error': 'Chapter not found'}), 404
    if not chapter.is_locked:
        return jsonify({'ok': True, 'already_unlocked': True})

    uid = user.wiam_id or user.id

    # Already unlocked?
    existing = ChapterUnlock.query.filter(
        ChapterUnlock.content_id == content_id,
        ChapterUnlock.chapter_number == chapter_num,
        db.or_(ChapterUnlock.user_id == user.id,
               ChapterUnlock.user_id == uid),
    ).first()
    if existing:
        return jsonify({'ok': True, 'already_unlocked': True})

    # Check credits
    balance = user.premium_credits_balance or 0
    if balance < 1:
        return jsonify({'error': 'No credits remaining', 'credits_balance': balance}), 402

    book = Content.query.get(content_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    # Spend 1 credit
    new_balance = balance - 1
    user.premium_credits_balance = new_balance

    ledger = PremiumCreditsLedger(
        user_id=uid, type='spend', amount=-1,
        balance_after=new_balance,
        reason=f'unlock_chapter:{content_id}:{chapter_num}',
        related_chapter_id=chapter.id,
    )
    db.session.add(ledger)

    # Record unlock
    unlock = ChapterUnlock(
        user_id=uid, content_id=content_id,
        chapter_number=chapter_num, coins_spent=0,
        creator_id=book.creator_wiam_id,
        unlock_method='premium_credit',
    )
    db.session.add(unlock)
    db.session.commit()

    return jsonify({
        'ok': True, 'credits_balance': new_balance,
        'message': f'Chapter {chapter_num} unlocked with 1 credit',
    })


@api_v1.route('/premium/credits/history')
@jwt_required
def credits_history():
    """Get premium credits ledger history."""
    from ..models import PremiumCreditsLedger
    user = request.api_user
    uid = user.wiam_id or user.id

    entries = PremiumCreditsLedger.query.filter_by(
        user_id=uid
    ).order_by(PremiumCreditsLedger.created_at.desc()).limit(50).all()

    return jsonify({
        'credits_balance': user.premium_credits_balance or 0,
        'history': [{
            'id': e.id,
            'type': e.type,
            'amount': e.amount,
            'balance_after': e.balance_after,
            'reason': e.reason,
            'created_at': e.created_at.isoformat() if e.created_at else None,
        } for e in entries],
    })


# ---------------------------------------------------------------------------
# WIAMBOT — JWT chat endpoint with daily limits (premium gets more)
# ---------------------------------------------------------------------------

# Daily message limits by premium plan
_BOT_DAILY_LIMITS = {'none': 5, 'basic': 10, 'plus': 30, 'unlimited': 999}


@api_v1.route('/bot/chat', methods=['POST'])
@jwt_required
def bot_chat_api():
    """
    WiamBot chat — JWT authenticated with daily message limits.
    Free: 5/day, Basic: 10/day, Plus: 30/day, Unlimited: unlimited.

    JSON body: { message: "..." }
    Returns: { message, links?, remaining_today, daily_limit }
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()

    if not message or len(message) < 2:
        return jsonify({'error': 'Message too short'}), 400
    if len(message) > 1000:
        return jsonify({'error': 'Message too long (max 1000 chars)'}), 400

    # Auto-expire check
    if user.premium_status in ('active', 'trial') and user.premium_expires_at:
        if datetime.utcnow() > user.premium_expires_at:
            user.premium_status = 'expired'
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()

    # Determine daily limit based on premium plan
    plan = 'none'
    if user.premium_status in ('active', 'trial'):
        plan = user.premium_plan or 'basic'
    daily_limit = _BOT_DAILY_LIMITS.get(plan, 5)

    uid = user.wiam_id or user.id

    # Use ai_service's in-memory counter (tracks actual messages sent)
    from ..services.ai_service import get_user_usage
    msg_count, _ = get_user_usage(uid, 'chat')

    if msg_count >= daily_limit:
        return jsonify({
            'error': 'Daily message limit reached',
            'remaining_today': 0,
            'daily_limit': daily_limit,
            'upgrade_hint': plan == 'none',
        }), 429

    # Call the bot
    try:
        from ..services.wiambot import chat as wiambot_chat
        result = wiambot_chat(message, uid, db.session)
    except Exception as e:
        import traceback
        traceback.print_exc()
        result = {'reply': "I'm having trouble right now. Please try again later."}

    # Rename 'reply' → 'message' for mobile client compatibility
    if 'reply' in result:
        result['message'] = result.pop('reply')

    result['remaining_today'] = max(0, daily_limit - msg_count - 1)
    result['daily_limit'] = daily_limit
    return jsonify(result)


@api_v1.route('/bot/status')
@jwt_required
def bot_status():
    """Return WiamBot daily usage status for the current user."""
    user = request.api_user
    # Auto-expire check
    if user.premium_status in ('active', 'trial') and user.premium_expires_at:
        if datetime.utcnow() > user.premium_expires_at:
            user.premium_status = 'expired'
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
    plan = 'none'
    if user.premium_status in ('active', 'trial'):
        plan = user.premium_plan or 'basic'
    daily_limit = _BOT_DAILY_LIMITS.get(plan, 5)

    uid = user.wiam_id or user.id

    # Use ai_service's in-memory counter (tracks actual messages sent)
    from ..services.ai_service import get_user_usage
    msg_count, _ = get_user_usage(uid, 'chat')

    return jsonify({
        'used_today': msg_count,
        'daily_limit': daily_limit,
        'remaining_today': max(0, daily_limit - msg_count),
        'plan': plan,
    })


# ---------------------------------------------------------------------------
# PREMIUM REFERRALS — invite friends, earn bonus credits
# ---------------------------------------------------------------------------

REFERRAL_BONUS_CREDITS = 3  # credits awarded to referrer when referee subscribes


@api_v1.route('/referral/code')
@jwt_required
def get_referral_code():
    """Get or generate the user's referral code."""
    import hashlib
    user = request.api_user
    if not user.referral_code:
        # Generate a unique short code
        raw = f'{user.id}-{user.wiam_id}-premium'
        user.referral_code = hashlib.md5(raw.encode()).hexdigest()[:8].upper()
        db.session.commit()
    return jsonify({
        'referral_code': user.referral_code,
        'share_url': f'https://wiamapp.com/join?ref={user.referral_code}',
    })


@api_v1.route('/referral/apply', methods=['POST'])
@jwt_required
def apply_referral_code():
    """Apply a referral code (used by the referee before subscribing)."""
    from ..models import PremiumReferral
    user = request.api_user
    data = request.get_json(silent=True) or {}
    code = (data.get('code') or '').strip().upper()

    if not code:
        return jsonify({'error': 'Referral code is required'}), 400

    # Don't allow self-referral
    if user.referral_code == code:
        return jsonify({'error': 'You cannot use your own referral code'}), 400

    # Already referred
    if user.referred_by:
        return jsonify({'error': 'You have already used a referral code'}), 400

    # Find referrer
    referrer = User.query.filter_by(referral_code=code).first()
    if not referrer:
        return jsonify({'error': 'Invalid referral code'}), 404

    # Save referral
    uid = user.wiam_id or user.id
    ref_uid = referrer.wiam_id or referrer.id
    existing = PremiumReferral.query.filter_by(referrer_id=ref_uid, referee_id=uid).first()
    if not existing:
        ref = PremiumReferral(
            referrer_id=ref_uid,
            referee_id=uid,
            referral_code=code,
            status='pending',
        )
        db.session.add(ref)

    user.referred_by = ref_uid
    db.session.commit()

    return jsonify({
        'ok': True,
        'referrer_name': referrer.display_name or referrer.username,
        'message': f'Referral from {referrer.display_name or referrer.username} applied! Subscribe to premium to activate bonus credits for both of you.',
    })


@api_v1.route('/referral/stats')
@jwt_required
def referral_stats():
    """Get referral stats for the current user."""
    from ..models import PremiumReferral
    user = request.api_user
    uid = user.wiam_id or user.id

    referrals = PremiumReferral.query.filter_by(referrer_id=uid).all()
    total = len(referrals)
    converted = sum(1 for r in referrals if r.status == 'converted')
    total_bonus = sum(r.bonus_credits for r in referrals if r.status == 'converted')

    return jsonify({
        'referral_code': user.referral_code or '',
        'total_referrals': total,
        'converted': converted,
        'pending': total - converted,
        'total_bonus_credits': total_bonus,
        'referrals': [{
            'referee_id': r.referee_id,
            'status': r.status,
            'bonus_credits': r.bonus_credits,
            'created_at': r.created_at.isoformat() if r.created_at else None,
            'converted_at': r.converted_at.isoformat() if r.converted_at else None,
        } for r in referrals],
    })


@api_v1.route('/referral/convert', methods=['POST'])
@jwt_required
def convert_referral():
    """
    Called internally after a user subscribes to premium.
    Converts their pending referral and awards bonus credits to the referrer.
    """
    from ..models import PremiumReferral, PremiumCreditsLedger
    user = request.api_user
    uid = user.wiam_id or user.id

    if not user.referred_by:
        return jsonify({'ok': False, 'message': 'No referral to convert'}), 200

    ref = PremiumReferral.query.filter_by(
        referrer_id=user.referred_by, referee_id=uid, status='pending'
    ).first()
    if not ref:
        return jsonify({'ok': False, 'message': 'Referral already converted or not found'}), 200

    # Convert
    ref.status = 'converted'
    ref.converted_at = datetime.utcnow()
    ref.bonus_credits = REFERRAL_BONUS_CREDITS

    # Award bonus credits to referrer
    referrer = User.query.filter(
        db.or_(User.wiam_id == user.referred_by, User.id == user.referred_by)
    ).first()
    if referrer:
        referrer.premium_credits_balance = (referrer.premium_credits_balance or 0) + REFERRAL_BONUS_CREDITS
        ledger = PremiumCreditsLedger(
            user_id=referrer.wiam_id or referrer.id,
            type='grant',
            amount=REFERRAL_BONUS_CREDITS,
            balance_after=referrer.premium_credits_balance,
            reason=f'referral_bonus:user_{uid}',
        )
        db.session.add(ledger)

    # Also give referee a small bonus (1 credit)
    user.premium_credits_balance = (user.premium_credits_balance or 0) + 1
    referee_ledger = PremiumCreditsLedger(
        user_id=uid,
        type='grant',
        amount=1,
        balance_after=user.premium_credits_balance,
        reason=f'referral_welcome_bonus',
    )
    db.session.add(referee_ledger)

    db.session.commit()

    return jsonify({
        'ok': True,
        'referrer_bonus': REFERRAL_BONUS_CREDITS,
        'referee_bonus': 1,
    })


# ---------------------------------------------------------------------------
# WIAMELITE — leaderboard + stories
# ---------------------------------------------------------------------------

@api_v1.route('/elite/leaderboard')
@jwt_required
def elite_leaderboard():
    """Get WiamElite stories ranked by total reads."""
    from ..services.elite import get_elite_stories
    elites = get_elite_stories(limit=50)
    results = []
    for item in elites:
        s = item['story']
        e = item['elite']
        creator = User.query.filter_by(wiam_id=s.creator_wiam_id).first() if s.creator_wiam_id else None
        results.append({
            'id': s.id,
            'title': s.title,
            'author': s.author or (creator.display_name if creator else 'Unknown'),
            'cover_image': _abs_url(s.cover_url),
            'genre': s.genre or '',
            'total_reads': e.total_reads or 0,
            'unique_readers': e.unique_readers or 0,
            'avg_rating': float(e.avg_rating or 0),
            'total_ratings': e.total_ratings or 0,
            'chapter_count': e.chapter_count or 0,
            'total_words': e.total_words or 0,
            'promoted_at': e.promoted_at.isoformat() if e.promoted_at else None,
            'elite_streak_days': e.elite_streak_days or 0,
            'creator': {
                'id': creator.wiam_id if creator else None,
                'name': creator.display_name if creator else s.author,
                'avatar': creator.avatar_url if creator else None,
            } if creator else None,
        })
    return jsonify({'elite_stories': results, 'count': len(results)})


@api_v1.route('/elite/story/<int:book_id>')
@jwt_required
def elite_story_detail(book_id):
    """Get detail for a specific Elite story."""
    from ..models import EliteStory
    from ..services.elite import compute_story_metrics, is_elite
    story = Content.query.get(book_id)
    if not story:
        return jsonify({'error': 'Story not found'}), 404
    elite = EliteStory.query.filter_by(content_id=book_id, is_active=True).first()
    if not elite:
        return jsonify({'error': 'Not an Elite story'}), 404
    creator = User.query.filter_by(wiam_id=story.creator_wiam_id).first() if story.creator_wiam_id else None
    return jsonify({
        'id': story.id,
        'title': story.title,
        'author': story.author,
        'description': story.description or '',
        'cover_image': _abs_url(story.cover_url),
        'genre': story.genre or '',
        'total_reads': elite.total_reads or 0,
        'avg_rating': float(elite.avg_rating or 0),
        'total_ratings': elite.total_ratings or 0,
        'chapter_count': elite.chapter_count or 0,
        'total_words': elite.total_words or 0,
        'promoted_at': elite.promoted_at.isoformat() if elite.promoted_at else None,
        'elite_streak_days': elite.elite_streak_days or 0,
        'creator': {
            'id': creator.wiam_id if creator else None,
            'name': creator.display_name if creator else story.author,
            'avatar': creator.avatar_url if creator else None,
        } if creator else None,
    })


# ---------------------------------------------------------------------------
# CLASSICS — public-domain books collection
# ---------------------------------------------------------------------------

@api_v1.route('/classics')
@jwt_required
def classics_list():
    """List published classic books."""
    from ..models import ClassicBook
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)
    genre = request.args.get('genre', '')

    q = ClassicBook.query.filter_by(status='published')
    if genre:
        q = q.filter(ClassicBook.genre.ilike(f'%{genre}%'))
    q = q.order_by(ClassicBook.views.desc())

    paginated = q.paginate(page=page, per_page=per_page, error_out=False)
    books = []
    for b in paginated.items:
        books.append({
            'id': b.id,
            'content_id': b.content_id,
            'title': b.title,
            'author': b.author,
            'cover_image': b.cover_url,
            'genre': b.genre,
            'word_count': b.word_count or 0,
            'chapter_count': b.published_chapter_count,
            'views': b.views or 0,
            'rating': float(b.rating or 0),
            'rating_count': b.rating_count or 0,
        })
    return jsonify({
        'books': books,
        'page': page,
        'total_pages': paginated.pages,
        'total': paginated.total,
    })


@api_v1.route('/classics/<int:book_id>')
@jwt_required
def classics_detail(book_id):
    """Get detail for a specific classic book."""
    from ..models import ClassicBook, ClassicChapter
    book = ClassicBook.query.get(book_id)
    if not book or book.status != 'published':
        return jsonify({'error': 'Book not found'}), 404

    chapters = ClassicChapter.query.filter(
        ClassicChapter.book_id == book_id,
        ClassicChapter.publish_date <= datetime.utcnow(),
    ).order_by(ClassicChapter.chapter_number).all()

    return jsonify({
        'id': book.id,
        'content_id': book.content_id,
        'title': book.title,
        'author': book.author,
        'description': book.description or '',
        'cover_image': book.cover_url,
        'genre': book.genre,
        'word_count': book.word_count or 0,
        'views': book.views or 0,
        'rating': float(book.rating or 0),
        'rating_count': book.rating_count or 0,
        'chapters': [{
            'number': ch.chapter_number,
            'title': ch.chapter_title or f'Chapter {ch.chapter_number}',
            'word_count': ch.word_count or 0,
        } for ch in chapters],
    })


# ---------------------------------------------------------------------------
# CREATOR SUBSCRIPTIONS — public tier browsing
# ---------------------------------------------------------------------------

@api_v1.route('/creator/<int:creator_id>/tiers')
@jwt_required
def creator_public_tiers(creator_id):
    """Get a creator's active subscription tiers (for readers to browse)."""
    from ..services.creator_sub_service import get_creator_tiers, tier_to_dict, get_subscriber_count
    creator = User.query.filter_by(wiam_id=creator_id).first()
    if not creator or not creator.is_creator:
        return jsonify({'error': 'Creator not found'}), 404

    tiers = get_creator_tiers(creator.id, active_only=True)
    return jsonify({
        'creator': {
            'id': creator.wiam_id,
            'name': creator.display_name,
            'avatar': creator.avatar_url,
        },
        'tiers': [tier_to_dict(t) for t in tiers],
        'subscriber_count': get_subscriber_count(creator.id),
    })


@api_v1.route('/settings')
@jwt_required
def user_settings():
    """Get current user settings/profile for the settings screen.

    Notification preferences mirror the granular ``User.notif_*`` columns so
    mobile and web stay in sync. The legacy ``push_enabled`` /
    ``email_enabled`` keys are kept as aliases for older app builds.
    """
    user = request.api_user
    push_enabled = bool(getattr(user, 'notif_push', True))
    email_enabled = bool(getattr(user, 'notif_email', True))
    return jsonify({
        'id': user.wiam_id,
        'username': user.username,
        'display_name': user.display_name,
        'email': user.email or '',
        'avatar': user.avatar_url,
        'bio': user.bio or '',
        'is_creator': user.is_creator,
        'is_founder': getattr(user, 'is_founder', False),
        'premium_status': user.premium_status or 'none',
        'premium_plan': user.premium_plan or 'none',
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
        'notification_preferences': {
            # Master toggles
            'push_enabled': push_enabled,
            'email_enabled': email_enabled,
            # Granular per-category (matches User columns).
            'new_chapter': bool(getattr(user, 'notif_new_chapter', True)),
            'new_follower': bool(getattr(user, 'notif_new_follower', True)),
            'comments': bool(getattr(user, 'notif_comments', True)),
            'likes': bool(getattr(user, 'notif_likes', True)),
            'mentions': bool(getattr(user, 'notif_mentions', True)),
            'announcements': bool(getattr(user, 'notif_announcements', True)),
            'coins': bool(getattr(user, 'notif_coins', True)),
            'elite': bool(getattr(user, 'notif_elite', True)),
            'sound': getattr(user, 'notif_sound', 'chime') or 'chime',
        },
        'privacy_preferences': {
            'profile_visible': bool(getattr(user, 'privacy_profile_visible', True)),
            'show_reading_activity': bool(getattr(user, 'privacy_show_reading_activity', True)),
            'show_library': bool(getattr(user, 'privacy_show_library', True)),
            'show_favorites': bool(getattr(user, 'privacy_show_favorites', False)),
        },
    })


# Map mobile-friendly keys -> real ``User`` columns.
_NOTIF_PREF_KEYS = {
    'push_enabled': 'notif_push',
    'email_enabled': 'notif_email',
    'email_notifications': 'notif_email',  # legacy alias from old mobile build
    'new_chapter': 'notif_new_chapter',
    'new_follower': 'notif_new_follower',
    'comments': 'notif_comments',
    'likes': 'notif_likes',
    'mentions': 'notif_mentions',
    'announcements': 'notif_announcements',
    'coins': 'notif_coins',
    'elite': 'notif_elite',
    'sound': 'notif_sound',
    # Episio / older mobile prefixes
    'notif_push': 'notif_push',
    'notif_email': 'notif_email',
    'notif_new_chapter': 'notif_new_chapter',
    'notif_coins': 'notif_coins',
    'notif_announcements': 'notif_announcements',
}


@api_v1.route('/settings', methods=['PUT', 'PATCH'])
@jwt_required
def update_user_settings():
    """Update user settings.

    Accepts both the new granular notification keys and the legacy
    ``push_enabled`` / ``email_notifications`` keys. Writes to the real
    ``notif_*`` columns so push/email gating actually takes effect.
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}

    if 'display_name' in data:
        name = data['display_name'].strip()[:50]
        if name:
            user.display_name = name
    if 'bio' in data:
        user.bio = data['bio'].strip()[:500]

    for in_key, col in _NOTIF_PREF_KEYS.items():
        if in_key in data:
            try:
                if col == 'notif_sound':
                    val = str(data[in_key]).strip()
                    if val in ('chime', 'bell', 'drop', 'ping', 'marimba'):
                        user.notif_sound = val
                else:
                    setattr(user, col, bool(data[in_key]))
            except Exception:
                pass

    # Privacy settings
    _PRIVACY_KEYS = {
        'profile_visible': 'privacy_profile_visible',
        'show_reading_activity': 'privacy_show_reading_activity',
        'show_library': 'privacy_show_library',
        'show_favorites': 'privacy_show_favorites',
    }
    for in_key, col in _PRIVACY_KEYS.items():
        if in_key in data:
            try:
                setattr(user, col, bool(data[in_key]))
            except Exception:
                pass

    db.session.commit()
    return jsonify({'ok': True, 'message': 'Settings updated'})


# ---------------------------------------------------------------------------
# BOOK SECTIONS ENGINE — Founder/Team can create dynamic home page sections
# ---------------------------------------------------------------------------

def _founder_or_team(user):
    """Check if user is founder or has team permissions."""
    if not user:
        return False
    if getattr(user, 'role', '') == 'founder':
        return True
    return user.has_permission('manage_content') if hasattr(user, 'has_permission') else False


@api_v1.route('/book-sections')
@jwt_optional
def list_book_sections():
    """List all active book sections with their books (for home screen)."""
    sections = BookSection.query.filter_by(is_active=True)\
        .order_by(BookSection.display_order, BookSection.id).all()
    user = request.api_user
    result = []
    for sec in sections:
        books = sec.fetch_books()
        if not books:
            continue
        result.append({
            'id': sec.id,
            'title': sec.title,
            'description': sec.description,
            'icon': sec.icon or 'Sparkles',
            'books': [_book_json(b, user) for b in books],
        })
    return jsonify({'sections': result})


@api_v1.route('/admin/book-sections')
@jwt_required
def admin_list_book_sections():
    """List all book sections (including inactive) for admin management."""
    user = request.api_user
    if not _founder_or_team(user):
        return jsonify({'error': 'Forbidden'}), 403
    sections = BookSection.query.order_by(BookSection.display_order, BookSection.id).all()
    return jsonify({
        'sections': [{
            'id': s.id,
            'title': s.title,
            'description': s.description,
            'icon': s.icon,
            'genre_filter': s.genre_filter,
            'min_views': s.min_views,
            'min_rating': s.min_rating,
            'min_chapters': s.min_chapters,
            'status_filter': s.status_filter,
            'sort_by': s.sort_by,
            'max_books': s.max_books,
            'display_order': s.display_order,
            'is_active': s.is_active,
            'book_count': len(s.fetch_books()),
            'created_at': s.created_at.isoformat() if s.created_at else None,
        } for s in sections],
    })


@api_v1.route('/admin/book-sections', methods=['POST'])
@jwt_required
def admin_create_book_section():
    """Create a new book section."""
    user = request.api_user
    if not _founder_or_team(user):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    sec = BookSection(
        title=title,
        description=(data.get('description') or '').strip() or None,
        icon=data.get('icon', 'Sparkles'),
        genre_filter=(data.get('genre_filter') or '').strip() or None,
        min_views=int(data.get('min_views', 0)),
        min_rating=float(data.get('min_rating', 0)),
        min_chapters=int(data.get('min_chapters', 0)),
        status_filter=(data.get('status_filter') or '').strip() or None,
        sort_by=data.get('sort_by', 'views'),
        max_books=int(data.get('max_books', 12)),
        display_order=int(data.get('display_order', 0)),
        is_active=data.get('is_active', True),
        created_by=user.wiam_id or user.id,
    )
    db.session.add(sec)
    db.session.commit()
    return jsonify({'ok': True, 'id': sec.id, 'title': sec.title}), 201


@api_v1.route('/admin/book-sections/<int:sec_id>', methods=['PUT', 'PATCH'])
@jwt_required
def admin_update_book_section(sec_id):
    """Update a book section."""
    user = request.api_user
    if not _founder_or_team(user):
        return jsonify({'error': 'Forbidden'}), 403
    sec = BookSection.query.get(sec_id)
    if not sec:
        return jsonify({'error': 'Section not found'}), 404
    data = request.get_json(silent=True) or {}

    if 'title' in data:
        sec.title = (data['title'] or '').strip() or sec.title
    if 'description' in data:
        sec.description = (data['description'] or '').strip() or None
    if 'icon' in data:
        sec.icon = data['icon']
    if 'genre_filter' in data:
        sec.genre_filter = (data['genre_filter'] or '').strip() or None
    if 'min_views' in data:
        sec.min_views = int(data['min_views'])
    if 'min_rating' in data:
        sec.min_rating = float(data['min_rating'])
    if 'min_chapters' in data:
        sec.min_chapters = int(data['min_chapters'])
    if 'status_filter' in data:
        sec.status_filter = (data['status_filter'] or '').strip() or None
    if 'sort_by' in data:
        sec.sort_by = data['sort_by']
    if 'max_books' in data:
        sec.max_books = int(data['max_books'])
    if 'display_order' in data:
        sec.display_order = int(data['display_order'])
    if 'is_active' in data:
        sec.is_active = bool(data['is_active'])

    sec.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'id': sec.id})


@api_v1.route('/admin/book-sections/<int:sec_id>', methods=['DELETE'])
@jwt_required
def admin_delete_book_section(sec_id):
    """Delete a book section."""
    user = request.api_user
    if not _founder_or_team(user):
        return jsonify({'error': 'Forbidden'}), 403
    sec = BookSection.query.get(sec_id)
    if not sec:
        return jsonify({'error': 'Section not found'}), 404
    db.session.delete(sec)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# DEEP TRACKING — Push 3 (engagement instrumentation)
# ---------------------------------------------------------------------------
#
# Three workhorse endpoints feeding the AnalyticsEvent log. The mobile app
# pings these from the reader (record-view), home rails (home-impression /
# home-click), and the push-tap handler (push-open). Every other engagement
# event (likes, comments, ratings, follows, shares, search, publish) is
# tracked inline at the moment its denormalized counter is updated, so we
# never need a separate "instrumentation pass" again.

# Cap on a single batch so a buggy client cannot DoS us with millions of
# fake impressions.
_HOME_IMPRESSION_BATCH_MAX = 60


@api_v1.route('/books/<int:book_id>/record-view', methods=['POST'])
@jwt_required
def record_book_view_jwt(book_id):
    """Time-based view counting for the mobile reader.

    The Expo reader starts a 30-second timer the moment a chapter opens; if
    the reader is still on-screen when the timer fires it pings this
    endpoint. We dedupe per (user, book, day) by checking the
    ``w_analytics_events`` index for an existing ``book_view`` event today —
    the index ``ix_analytics_events_user_created`` makes that a cheap probe.

    Returns ``{counted: bool, views: int}`` so the mobile UI can update the
    visible counter without a separate refresh.
    """
    user = request.api_user
    if not user:
        return jsonify({'error': 'Authentication required'}), 401

    book = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at.is_(None),
    ).first()
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    # Creator self-views never count toward popularity. Compare against both
    # User.id and User.wiam_id so the legacy split (Push 1 fix) doesn't bite.
    if book.creator_wiam_id and (
        book.creator_wiam_id == user.wiam_id or book.creator_wiam_id == user.id
    ):
        return jsonify({'counted': False, 'views': book.views or 0, 'reason': 'own_book'})

    from ..models import AnalyticsEvent
    from ..services.analytics import track, _canonical_user_id

    uid = _canonical_user_id(user)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    already = (
        AnalyticsEvent.query
        .filter(
            AnalyticsEvent.user_id == uid,
            AnalyticsEvent.content_id == book_id,
            AnalyticsEvent.event_type == 'book_view',
            AnalyticsEvent.created_at >= today_start,
        )
        .first()
    )

    if already:
        return jsonify({'counted': False, 'views': book.views or 0, 'reason': 'already_today'})

    book.views = (book.views or 0) + 1
    track('book_view', user, content_id=book_id, source='mobile_reader')
    db.session.commit()
    return jsonify({'counted': True, 'views': book.views})


@api_v1.route('/track/home-impression', methods=['POST'])
@jwt_optional
def track_home_impression():
    """Batch-record home rail impressions.

    Body shape::

        { "events": [
            { "section": "trending", "content_id": 42, "position": 0 },
            { "section": "spotlight", "content_id": 7, "position": 1 },
            ...
        ]}

    Mobile collects up to ~60 impressions client-side and flushes them on
    rail-scroll-end / app-background, keeping request count low. Every event
    becomes a ``home_impression`` row; counters are not bumped here — those
    fall out of the eventual popularity recompute (Push 4).
    """
    data = request.get_json(silent=True) or {}
    events = data.get('events') or []
    if not isinstance(events, list):
        return jsonify({'error': 'events must be a list'}), 400
    if len(events) > _HOME_IMPRESSION_BATCH_MAX:
        events = events[:_HOME_IMPRESSION_BATCH_MAX]

    user = request.api_user

    from ..services.analytics import track

    recorded = 0
    for evt in events:
        if not isinstance(evt, dict):
            continue
        section = (evt.get('section') or '').strip()
        cid = evt.get('content_id')
        if not section:
            continue
        if not isinstance(cid, int):
            continue
        position = evt.get('position')
        track(
            'home_impression',
            user,
            content_id=cid,
            section_key=section,
            position=position if isinstance(position, int) else None,
        )
        recorded += 1

    if recorded:
        db.session.commit()
    return jsonify({'ok': True, 'recorded': recorded})


@api_v1.route('/track/home-click', methods=['POST'])
@jwt_optional
def track_home_click():
    """Record a single home-rail tap. Fired from the BookTile press handler."""
    data = request.get_json(silent=True) or {}
    section = (data.get('section') or '').strip()
    cid = data.get('content_id')
    position = data.get('position')

    if not section:
        return jsonify({'error': 'section required'}), 400
    if not isinstance(cid, int):
        return jsonify({'error': 'content_id must be int'}), 400

    user = request.api_user

    from ..services.analytics import track
    track(
        'home_click',
        user,
        content_id=cid,
        section_key=section,
        position=position if isinstance(position, int) else None,
    )
    db.session.commit()
    return jsonify({'ok': True})


@api_v1.route('/track/push-open', methods=['POST'])
@jwt_required
def track_push_open():
    """Record a push-notification tap so we can measure CTR per push type.

    Mobile pings this from the notification-tap handler with whatever
    ``data`` payload the push carried. We record the type + URL but never
    PII like the title/message text.
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    notif_type = (data.get('type') or '').strip()[:60]
    url = (data.get('url') or '').strip()[:200]

    from ..services.analytics import track
    track(
        'push_open',
        user,
        section_key=notif_type or None,
        url=url or None,
    )
    db.session.commit()
    return jsonify({'ok': True})
