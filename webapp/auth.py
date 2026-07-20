"""
Authentication system for WiamApp.
Supports: Email/Password registration, Google Sign-In,
          Email verification, Forgot/Reset password, 2FA, QR Code login.
"""
import hashlib
import hmac
import time
import re
import string
import secrets as _secrets
from datetime import datetime, timedelta
import requests as http_requests
from collections import defaultdict
from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app, abort, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from .extensions import db, csrf, login_manager
from .models import User, VerificationCode, PlatformConfig

auth_bp = Blueprint('auth', __name__)

# Simple in-memory rate limiter
_rate_store = defaultdict(list)
_RATE_LIMIT = 10      # max requests
_RATE_WINDOW = 60     # per 60 seconds

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

TEAM_LOGIN_EMAIL = 'wiamlabs@gmail.com'
_WIAM_ID_CHARS = string.ascii_letters + string.digits  # a-z A-Z 0-9
_WIAM_ID_PREFIX = 'WIAMid'
_WIAM_ID_RAND_LEN = 6
WIAM_ID_EXPIRY_DAYS = 15

# Stricter rate limit for team login (5 attempts per 10 min per IP)
_team_rate_store = defaultdict(list)
_TEAM_RATE_LIMIT = 5
_TEAM_RATE_WINDOW = 600  # 10 minutes


def generate_wiam_id():
    """Generate a cryptographically secure WIAMid like WIAMid9k3Tz8."""
    suffix = ''.join(_secrets.choice(_WIAM_ID_CHARS) for _ in range(_WIAM_ID_RAND_LEN))
    return f'{_WIAM_ID_PREFIX}{suffix}'


def _check_team_rate_limit():
    ip = request.remote_addr or '0.0.0.0'
    now = time.time()
    _team_rate_store[ip] = [t for t in _team_rate_store[ip] if now - t < _TEAM_RATE_WINDOW]
    if len(_team_rate_store[ip]) >= _TEAM_RATE_LIMIT:
        return False
    _team_rate_store[ip].append(now)
    return True


def _post_login_redirect(user):
    """Return the correct redirect after login based on user role.
    Team accounts → /team/  |  Founder → /founder  |  Everyone else → home
    """
    if getattr(user, 'is_team_account', False):
        return redirect(url_for('team.dashboard'))
    if user.role == 'founder':
        return redirect(url_for('founder_dash.overview'))
    return redirect(url_for('home.home'))


def _check_rate_limit():
    """Return True if request is within rate limit, False if exceeded."""
    ip = request.remote_addr or '0.0.0.0'
    now = time.time()
    _rate_store[ip] = [t for t in _rate_store[ip] if now - t < _RATE_WINDOW]
    if len(_rate_store[ip]) >= _RATE_LIMIT:
        return False
    _rate_store[ip].append(now)
    return True


def _generate_synthetic_id(unique_str):
    """Generate a deterministic negative BigInteger from a unique string.
    Used internally for legacy compatibility with the wiam_id column."""
    h = int(hashlib.sha256(unique_str.encode()).hexdigest()[:14], 16)
    return -(h + 1_000_000)


@login_manager.user_loader
def load_user(user_id):
    """Flask-Login calls this to reload user from session."""
    return User.query.get(int(user_id))


# Telegram login removed — WiamApp uses email/password + Google Sign-In only.


# ---------------------------------------------------------------------------
# Login page (shows all login options)
# ---------------------------------------------------------------------------

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if not _check_rate_limit():
        abort(429)
    if current_user.is_authenticated:
        return redirect(url_for('home.index'))

    # ── Auth Gate: check if login is blocked ──
    cfg = PlatformConfig.get()
    login_blocked = cfg.is_login_blocked

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        if not email or not password:
            flash('Please enter your email and password.', 'error')
            return redirect(url_for('auth.login'))

        # Team login always allowed even when login is blocked
        is_team_login = (email == TEAM_LOGIN_EMAIL)
        if login_blocked and not is_team_login:
            flash(cfg.auth_login_blocked_message or 'Login is temporarily disabled.', 'error')
            return redirect(url_for('auth.login'))

        # ── WIAMid team login ──
        if email == TEAM_LOGIN_EMAIL:
            if not _check_team_rate_limit():
                flash('Too many login attempts. Please wait 10 minutes.', 'error')
                return redirect(url_for('auth.login'))
            from .models import TeamIdHistory
            team_users = User.query.filter_by(is_team_account=True, status='active').all()
            matched_user = None
            for tu in team_users:
                if tu.team_wiam_id_hash and tu.check_password(password):
                    matched_user = tu
                    break
            if not matched_user:
                flash('Invalid WIAMid. Please check your credentials.', 'error')
                return redirect(url_for('auth.login'))
            if matched_user.team_id_expires_at and matched_user.team_id_expires_at < datetime.utcnow():
                flash('Your WIAMid has expired. A new one has been sent to your email.', 'warning')
                return redirect(url_for('auth.login'))
            login_user(matched_user, remember=False)
            flash(f'Welcome, {matched_user.display_name}!', 'success')
            return _post_login_redirect(matched_user)

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            flash('Invalid email or password.', 'error')
            return redirect(url_for('auth.login'))

        if getattr(user, 'is_team_account', False):
            flash('Team members must log in using wiamlabs@gmail.com and their WIAMid.', 'error')
            return redirect(url_for('auth.login'))

        if user.status == 'banned':
            flash('This account has been suspended.', 'error')
            return redirect(url_for('auth.login'))

        if user.status == 'deleted':
            flash('This account has been deleted.', 'error')
            return redirect(url_for('auth.login'))

        if user.status == 'deactivated':
            flash('Your account has been deactivated. Please send feedback to the WiamApp team explaining why you want to reactivate, and wait up to 24 hours for a response.', 'warning')
            return redirect(url_for('auth.login'))

        # Check if email is verified
        if not user.email_verified:
            session.pop('pending_verify_email', None)
            session.pop('verify_attempts', None)
            session['pending_verify_email'] = email
            current_app.logger.info("Verification started for %s during login", email)
            # Send a fresh verification code so the user actually receives one
            from .services.email_service import create_and_send_code
            sent_code = create_and_send_code(email, 'register', user_id=user.id)
            if sent_code:
                flash('Please verify your email. A new code has been sent.', 'warning')
            else:
                current_app.logger.error("Login verification email failed for %s", email)
                flash('Please verify your email. We had trouble sending a code — try the Resend button on the next page.', 'warning')
            return redirect(url_for('auth.verify_email'))

        # Check if 2FA is enabled
        if user.two_factor_enabled:
            session['2fa_user_id'] = user.id
            # Send 2FA code
            from .services.email_service import create_and_send_code
            sent_code = create_and_send_code(email, 'two_factor', user_id=user.id)
            if not sent_code:
                current_app.logger.error("2FA email failed for %s", email)
                flash('We could not send the verification code right now. Please try again later.', 'error')
                session.pop('2fa_user_id', None)
                return redirect(url_for('auth.login'))

            flash('A verification code has been sent to your email.', 'info')
            return redirect(url_for('auth.verify_2fa'))

        login_user(user, remember=True)
        flash(f'Welcome back, {user.display_name}!', 'success')
        return _post_login_redirect(user)

    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID', '')
    return render_template('login.html', google_client_id=google_client_id,
                           login_blocked=login_blocked,
                           login_blocked_message=cfg.auth_login_blocked_message if login_blocked else None,
                           login_blocked_until=cfg.auth_login_blocked_until if login_blocked else None)


# ---------------------------------------------------------------------------
# Registration (email + password)
# ---------------------------------------------------------------------------

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if not _check_rate_limit():
        abort(429)
    if current_user.is_authenticated:
        return redirect(url_for('home.index'))

    # ── Auth Gate: check if registration is blocked ──
    cfg = PlatformConfig.get()
    reg_blocked = cfg.is_registration_blocked

    if request.method == 'POST':
        if reg_blocked:
            flash(cfg.auth_registration_blocked_message or 'Registration is temporarily closed.', 'error')
            return redirect(url_for('auth.register'))

        # ── Rate Guard (account creation per IP) ──
        from .services.rate_guard import check_registration_ip
        ip_ok, ip_msg = check_registration_ip(request.remote_addr)
        if not ip_ok:
            flash(ip_msg, 'error')
            return redirect(url_for('auth.register'))

        first_name = request.form.get('first_name', '').strip()
        last_name = request.form.get('last_name', '').strip()
        email = request.form.get('email', '').strip().lower()
        phone = request.form.get('phone', '').strip() or None
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')
        dob_str = request.form.get('date_of_birth', '').strip()

        # Minimum age enforcement (default 13)
        MIN_AGE = 13
        if dob_str:
            try:
                from datetime import date
                dob = date.fromisoformat(dob_str)
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                if age < MIN_AGE:
                    flash(f'You must be at least {MIN_AGE} years old to create an account.', 'error')
                    return redirect(url_for('auth.register'))
            except (ValueError, TypeError):
                flash('Please enter a valid date of birth.', 'error')
                return redirect(url_for('auth.register'))
        else:
            flash('Date of birth is required.', 'error')
            return redirect(url_for('auth.register'))

        # Block platform email from registration
        if email == TEAM_LOGIN_EMAIL:
            flash('This email cannot be used for registration.', 'error')
            return redirect(url_for('auth.register'))

        # Validations
        if not first_name:
            flash('First name is required.', 'error')
            return redirect(url_for('auth.register'))
        if not email or not _EMAIL_RE.match(email):
            flash('Please enter a valid email address.', 'error')
            return redirect(url_for('auth.register'))
        if len(password) < 8:
            flash('Password must be at least 8 characters.', 'error')
            return redirect(url_for('auth.register'))
        if password != confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('auth.register'))

        # Check unique email
        existing = User.query.filter_by(email=email).first()
        if existing:
            flash('An account with this email already exists. Please login instead.', 'error')
            return redirect(url_for('auth.login'))

        # Check unique phone
        if phone:
            phone_exists = User.query.filter_by(phone=phone).first()
            if phone_exists:
                flash('This phone number is already linked to another account.', 'error')
                return redirect(url_for('auth.register'))

        # Create user with collision-safe synthetic internal ID
        import uuid
        for _attempt in range(5):
            suffix = '' if _attempt == 0 else f'_{uuid.uuid4().hex[:8]}'
            synthetic_tid = _generate_synthetic_id(f'email_{email}{suffix}')
            if User.query.filter_by(wiam_id=synthetic_tid).first():
                continue
            break
        else:
            flash('Registration failed. Please try again.', 'error')
            return redirect(url_for('auth.register'))

        user = User(
            wiam_id=synthetic_tid,
            email=email,
            phone=phone,
            first_name=first_name,
            last_name=last_name,
            username=email.split('@')[0],
            role='user',
            source='web_email',
            auth_provider='email',
            email_verified=False,
            onboarding_completed=False,
            date_of_birth=dob,
        )
        user.set_password(password)
        try:
            db.session.add(user)
            db.session.commit()
        except Exception:
            db.session.rollback()
            flash('Registration failed. Please try again.', 'error')
            return redirect(url_for('auth.register'))

        # Store the current verification target explicitly so stale session data cannot be reused
        session.pop('pending_verify_email', None)
        session.pop('verify_attempts', None)
        session['pending_verify_email'] = email
        current_app.logger.info("Verification started for %s during registration", email)

        # Send verification code
        from .services.email_service import create_and_send_code
        sent_code = create_and_send_code(email, 'register', user_id=user.id)
        if not sent_code:
            current_app.logger.error("Registration verification email failed for %s", email)
            flash('Account created, but we could not send the verification email right now. Please try again later.', 'error')
            return redirect(url_for('auth.login'))

        # Notify Founder via email + in-app
        try:
            from .services.platform_notify import notify_new_user
            notify_new_user(f'{first_name} {last_name}', email, user.id)
        except Exception:
            pass

        flash('Account created! Please check your email for a verification code.', 'success')
        return redirect(url_for('auth.verify_email'))

    from datetime import date as _date
    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID', '')
    return render_template('register.html', google_client_id=google_client_id, today=_date.today().isoformat(),
                           reg_blocked=reg_blocked,
                           reg_blocked_message=cfg.auth_registration_blocked_message if reg_blocked else None,
                           reg_blocked_until=cfg.auth_registration_blocked_until if reg_blocked else None)


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

@auth_bp.route('/verify-email', methods=['GET', 'POST'])
def verify_email():
    if not _check_rate_limit():
        abort(429)
    email = session.get('pending_verify_email', '')
    if not email:
        flash('Verification session expired. Please register or log in again.', 'error')
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if not code:
            flash('Please enter the verification code.', 'error')
            return redirect(url_for('auth.verify_email'))

        attempts = session.get('verify_attempts', 0)
        if attempts >= 5:
            flash('Too many attempts. Please request a new code.', 'error')
            return redirect(url_for('auth.verify_email'))
        session['verify_attempts'] = attempts + 1

        from .services.email_service import verify_code
        vc = verify_code(email, code, 'register')
        if not vc:
            flash('Invalid or expired code. Please try again.', 'error')
            return redirect(url_for('auth.verify_email'))

        user = User.query.filter_by(email=email).first()
        if user:
            user.email_verified = True
            db.session.commit()
            session.pop('pending_verify_email', None)
            session.pop('verify_attempts', None)
            login_user(user, remember=True)
            # Send branded welcome email
            try:
                from .services.email_service import send_welcome_email
                send_welcome_email(email, user.first_name or user.display_name)
            except Exception:
                pass
            flash('Email verified! Welcome to WiamApp.', 'success')
            if not user.onboarding_completed:
                return redirect(url_for('auth.onboarding'))
            return redirect(url_for('home.home'))

        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))

    return render_template('verify_email.html', email=email)


@auth_bp.route('/resend-code', methods=['POST'])
def resend_code():
    """Resend verification code with 60-second cooldown."""
    if not _check_rate_limit():
        abort(429)

    purpose = request.form.get('purpose', 'register')
    if purpose == 'reset':
        email = session.get('reset_email', '').strip().lower()
    else:
        email = session.get('pending_verify_email', '').strip().lower()
    if not email:
        flash('Verification session expired. Please start again.', 'error')
        return redirect(url_for('auth.login'))

    # 60-second cooldown between resends to avoid hitting SMTP rate limits
    import time as _time
    last_resend = session.get('last_resend_ts', 0)
    now = _time.time()
    if now - last_resend < 60:
        remaining = int(60 - (now - last_resend))
        flash(f'Please wait {remaining} seconds before requesting another code.', 'warning')
        if purpose == 'register':
            return redirect(url_for('auth.verify_email'))
        elif purpose == 'reset':
            return redirect(url_for('auth.reset_password'))
        return redirect(url_for('auth.verify_email'))

    current_app.logger.info("Resending verification code to %s for %s", email, purpose)

    from .services.email_service import create_and_send_code
    user = User.query.filter_by(email=email).first()
    sent_code = create_and_send_code(email, purpose, user_id=user.id if user else None)

    if not sent_code:
        current_app.logger.error("Resend verification email failed for %s (purpose=%s)", email, purpose)
        flash('We could not send a new code right now. Please try again later.', 'error')
    else:
        session['last_resend_ts'] = now
        if purpose == 'register':
            session['verify_attempts'] = 0
        flash('A new code has been sent to your email.', 'success')

    if purpose == 'register':
        return redirect(url_for('auth.verify_email'))
    elif purpose == 'reset':
        return redirect(url_for('auth.reset_password'))
    return redirect(url_for('auth.verify_email'))


# ---------------------------------------------------------------------------
# Forgot / Reset Password
# ---------------------------------------------------------------------------

@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if not _check_rate_limit():
        abort(429)

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        if not email or not _EMAIL_RE.match(email):
            flash('Please enter a valid email address.', 'error')
            return redirect(url_for('auth.forgot_password'))

        # Block password reset for team accounts — they must contact engineers
        user = User.query.filter_by(email=email).first()
        if user and getattr(user, 'is_team_account', False):
            ce = current_app.config.get('COMPANY_EMAIL', 'labs@wiamapp.com')
            flash('Team accounts cannot reset passwords here. '
                  f'Please contact {ce} for assistance.', 'error')
            return redirect(url_for('auth.login'))

        if user and user.password_hash:
            from .services.email_service import create_and_send_code
            create_and_send_code(email, 'reset', user_id=user.id)

        # Always show success to prevent email enumeration
        session['reset_email'] = email
        flash('If an account exists with this email, a reset code has been sent.', 'success')
        return redirect(url_for('auth.reset_password'))

    return render_template('forgot_password.html')


@auth_bp.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if not _check_rate_limit():
        abort(429)
    email = session.get('reset_email', '')
    if not email:
        return redirect(url_for('auth.forgot_password'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        new_password = request.form.get('new_password', '')
        confirm = request.form.get('confirm_password', '')

        if not code:
            flash('Please enter the reset code.', 'error')
            return redirect(url_for('auth.reset_password'))
        if len(new_password) < 8:
            flash('Password must be at least 8 characters.', 'error')
            return redirect(url_for('auth.reset_password'))
        if new_password != confirm:
            flash('Passwords do not match.', 'error')
            return redirect(url_for('auth.reset_password'))

        from .services.email_service import verify_code
        vc = verify_code(email, code, 'reset')
        if not vc:
            flash('Invalid or expired code.', 'error')
            return redirect(url_for('auth.reset_password'))

        user = User.query.filter_by(email=email).first()
        if user:
            user.set_password(new_password)
            db.session.commit()
            session.pop('reset_email', None)
            flash('Password reset successfully! Please login.', 'success')
            return redirect(url_for('auth.login'))

        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))

    return render_template('reset_password.html', email=email)


# ---------------------------------------------------------------------------
# Two-Factor Authentication (2FA) via email
# ---------------------------------------------------------------------------

@auth_bp.route('/verify-2fa', methods=['GET', 'POST'])
def verify_2fa():
    user_id = session.get('2fa_user_id')
    if not user_id:
        return redirect(url_for('auth.login'))

    user = User.query.get(user_id)
    if not user:
        session.pop('2fa_user_id', None)
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if not code:
            flash('Please enter the verification code.', 'error')
            return redirect(url_for('auth.verify_2fa'))

        from .services.email_service import verify_code
        vc = verify_code(user.email, code, 'two_factor')
        if not vc:
            flash('Invalid or expired code.', 'error')
            return redirect(url_for('auth.verify_2fa'))

        session.pop('2fa_user_id', None)
        login_user(user, remember=True)
        flash(f'Welcome back, {user.display_name}!', 'success')
        return _post_login_redirect(user)

    return render_template('verify_2fa.html', email=user.email)


@auth_bp.route('/settings/2fa', methods=['GET', 'POST'])
@login_required
def settings_2fa():
    """Enable or disable 2FA."""
    if request.method == 'POST':
        action = request.form.get('action', '')
        if action == 'enable':
            if not current_user.email:
                flash('Please add an email to your account first.', 'error')
                return redirect(url_for('auth.settings_2fa'))
            current_user.two_factor_enabled = True
            db.session.commit()
            flash('Two-factor authentication enabled!', 'success')
        elif action == 'disable':
            current_user.two_factor_enabled = False
            db.session.commit()
            flash('Two-factor authentication disabled.', 'info')
        return redirect(url_for('auth.settings_2fa'))

    return render_template('settings_2fa.html')


# Telegram callback removed — login via email/password or Google only.


# ---------------------------------------------------------------------------
# Google callback (kept from original)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/google/callback', methods=['POST'])
@csrf.exempt
def google_callback():
    """Handle Google Sign-In credential (JWT id_token)."""
    if not _check_rate_limit():
        abort(429)

    # ── Auth Gate: block Google login when login is blocked ──
    cfg = PlatformConfig.get()
    if cfg.is_login_blocked:
        flash(cfg.auth_login_blocked_message or 'Login is temporarily disabled.', 'error')
        return redirect(url_for('auth.login'))

    credential = request.form.get('credential') or (request.get_json(silent=True) or {}).get('credential')
    if not credential:
        flash('Google login failed — no credential received.', 'error')
        return redirect(url_for('auth.login'))

    google_client_id = current_app.config.get('GOOGLE_CLIENT_ID', '')
    if not google_client_id:
        flash('Google login is not configured.', 'error')
        return redirect(url_for('auth.login'))

    try:
        resp = http_requests.get(
            'https://oauth2.googleapis.com/tokeninfo',
            params={'id_token': credential},
            timeout=5,
        )
        if resp.status_code != 200:
            flash('Google login verification failed.', 'error')
            return redirect(url_for('auth.login'))
        payload = resp.json()
    except Exception:
        flash('Could not verify Google login. Please try again.', 'error')
        return redirect(url_for('auth.login'))

    if payload.get('aud') != google_client_id:
        flash('Google login verification failed (audience mismatch).', 'error')
        return redirect(url_for('auth.login'))

    google_id = payload.get('sub')
    email = payload.get('email', '')
    given_name = payload.get('given_name', '')
    family_name = payload.get('family_name', '')

    if not google_id:
        flash('Google login failed — missing user ID.', 'error')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(google_id=google_id).first()

    if not user:
        if email:
            from sqlalchemy import func
            user = User.query.filter(func.lower(User.email) == email.lower()).first()
        if user:
            user.google_id = google_id
            if user.auth_provider in ('email', 'google'):
                user.auth_provider = 'both'
            if not user.email:
                user.email = email
            db.session.commit()
        else:
            # No WiamApp account — user must register first
            flash('You need a WiamApp account to use Google Sign-In. Please create an account first with your email and password, verify your email, then you can use Google Sign-In.', 'error')
            return redirect(url_for('auth.register'))
    else:
        if given_name:
            user.first_name = given_name
        if family_name:
            user.last_name = family_name
        if email and not user.email:
            user.email = email
        db.session.commit()

    if user.status == 'deleted':
        flash('This account has been deleted.', 'error')
        return redirect(url_for('auth.login'))
    if user.status == 'banned':
        flash('This account has been suspended.', 'error')
        return redirect(url_for('auth.login'))
    if user.status == 'deactivated':
        flash('Your account has been deactivated. Please send feedback to the WiamApp team explaining why you want to reactivate, and wait up to 24 hours for a response.', 'warning')
        return redirect(url_for('auth.login'))

    # Enforce email verification — user must verify email before login
    if not user.email_verified:
        session.pop('pending_verify_email', None)
        session.pop('verify_attempts', None)
        session['pending_verify_email'] = user.email
        current_app.logger.info("Verification started for %s during Google sign-in", user.email)
        from .services.email_service import create_and_send_code
        sent_code = create_and_send_code(user.email, 'register', user_id=user.id)
        if not sent_code:
            current_app.logger.error("Verification email failed for %s during sign-in", user.email)
            flash('Please verify your email first, but we could not send the verification code right now. Please try again later.', 'error')
            return redirect(url_for('auth.login'))

        flash('Please verify your email first. A verification code has been sent.', 'warning')
        return redirect(url_for('auth.verify_email'))

    login_user(user, remember=True)
    if not user.onboarding_completed:
        return redirect(url_for('auth.onboarding'))
    return _post_login_redirect(user)


# ---------------------------------------------------------------------------
# Bot login, Switch account, Logout (kept from original)
# ---------------------------------------------------------------------------

@auth_bp.route('/auth/bot-login')
def bot_login():
    """One-click login from bot link with token."""
    from .models import WebSession
    token = request.args.get('token', '')
    if not token:
        flash('Invalid login link.', 'error')
        return redirect(url_for('auth.login'))

    ws = WebSession.query.filter_by(token=token).first()
    if not ws:
        flash('Login link expired or invalid.', 'error')
        return redirect(url_for('auth.login'))

    age = (time.time() - ws.created_at.timestamp())
    if age > 600:
        db.session.delete(ws)
        db.session.commit()
        flash('Login link has expired. Request a new one from the bot.', 'error')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(wiam_id=ws.wiam_id).first()
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))

    # Only Founder can use bot login — regular users must use email/password
    if user.role != 'founder':
        db.session.delete(ws)
        db.session.commit()
        flash('Bot login is only available for platform administrators. Please login with email and password.', 'error')
        return redirect(url_for('auth.login'))

    db.session.delete(ws)
    db.session.commit()

    login_user(user, remember=True)
    return _post_login_redirect(user)


@auth_bp.route('/auth/switch', methods=['GET', 'POST'])
@login_required
def switch_account():
    """Switch account — enter email or phone, verify with code."""
    if not _check_rate_limit():
        abort(429)
    if request.method == 'POST':
        identifier = request.form.get('identifier', '').strip()
        if not identifier:
            flash('Please enter an email or phone number.', 'error')
            return redirect(url_for('auth.switch_account'))

        # Look up user by email or phone
        from sqlalchemy import func
        target = User.query.filter(
            (func.lower(User.email) == identifier.lower()) |
            (User.phone == identifier)
        ).first()

        if not target:
            flash('No account found with that email or phone number.', 'error')
            return redirect(url_for('auth.switch_account'))

        if target.id == current_user.id:
            flash('You are already logged in as this account.', 'info')
            return redirect(url_for('profile.my_profile'))

        if target.status in ('banned', 'deleted'):
            flash('That account is not available.', 'error')
            return redirect(url_for('auth.switch_account'))

        # Determine if email or phone
        is_email = '@' in identifier
        if is_email:
            # Send email verification code
            from .services.email_service import create_and_send_code
            vc = create_and_send_code(target.email, 'switch_account', user_id=target.id)
            if not vc:
                flash('Could not send verification code. Try again.', 'error')
                return redirect(url_for('auth.switch_account'))
            session['switch_target_id'] = target.id
            session['switch_identifier'] = target.email
            session['switch_method'] = 'email'
            flash('A verification code has been sent to the email address.', 'info')
        else:
            # Phone: generate a code and store in session (no SMS cost)
            import random
            code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
            vc = VerificationCode(
                user_id=target.id,
                email=target.phone or identifier,
                code=code,
                purpose='switch_account',
                expires_at=datetime.utcnow() + timedelta(minutes=10),
            )
            db.session.add(vc)
            db.session.commit()
            session['switch_target_id'] = target.id
            session['switch_identifier'] = target.phone or identifier
            session['switch_method'] = 'phone'
            session['switch_phone_code'] = code  # Show to user since SMS isn't free
            flash('Enter the verification code shown below.', 'info')

        return redirect(url_for('auth.switch_verify'))

    return render_template('switch_account.html')


@auth_bp.route('/auth/switch/verify', methods=['GET', 'POST'])
@login_required
def switch_verify():
    """Verify code for account switching."""
    if not _check_rate_limit():
        abort(429)
    target_id = session.get('switch_target_id')
    identifier = session.get('switch_identifier')
    method = session.get('switch_method', 'email')
    phone_code = session.get('switch_phone_code')

    if not target_id or not identifier:
        flash('No switch request found. Please start again.', 'error')
        return redirect(url_for('auth.switch_account'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if not code:
            flash('Please enter the verification code.', 'error')
            return redirect(url_for('auth.switch_verify'))

        from .services.email_service import verify_code
        vc = verify_code(identifier, code, 'switch_account')
        if not vc:
            flash('Invalid or expired code. Please try again.', 'error')
            return redirect(url_for('auth.switch_verify'))

        target = User.query.get(target_id)
        if not target:
            flash('Account not found.', 'error')
            return redirect(url_for('auth.switch_account'))

        # Clear session switch data
        session.pop('switch_target_id', None)
        session.pop('switch_identifier', None)
        session.pop('switch_method', None)
        session.pop('switch_phone_code', None)

        logout_user()
        login_user(target, remember=True)
        flash(f'Switched to {target.display_name}!', 'success')
        return _post_login_redirect(target)

    return render_template('switch_verify.html',
        method=method,
        phone_code=phone_code,
        identifier=identifier,
    )


@auth_bp.route('/logout')
@login_required
def logout():
    session.pop('pending_verify_email', None)
    session.pop('verify_attempts', None)
    session.pop('reset_email', None)
    session.pop('2fa_user_id', None)
    logout_user()
    return redirect(url_for('auth.login'))


# ---------------------------------------------------------------------------
# F19: QR Code Login
# ---------------------------------------------------------------------------

_qr_tokens = {}

@auth_bp.route('/auth/qr-login')
def qr_login_page():
    """Display a QR code for cross-device login."""
    token = _secrets.token_urlsafe(32)
    _qr_tokens[token] = {'user_id': None, 'status': 'pending', 'created': time.time()}
    cutoff = time.time() - 300
    for k in list(_qr_tokens.keys()):
        if _qr_tokens[k]['created'] < cutoff:
            del _qr_tokens[k]
    app_url = current_app.config.get('APP_URL', request.host_url.rstrip('/'))
    qr_url = f"{app_url}/auth/qr-approve?token={token}"
    return render_template('qr_login.html', token=token, qr_url=qr_url)


@auth_bp.route('/auth/qr-approve')
@login_required
def qr_approve():
    """Mobile user approves a QR login (scanned from their phone)."""
    token = request.args.get('token', '')
    if token not in _qr_tokens:
        flash('QR code expired or invalid.', 'error')
        return redirect(url_for('home.home'))
    entry = _qr_tokens[token]
    if entry['status'] == 'approved':
        flash('Already approved.', 'info')
        return redirect(url_for('home.home'))
    entry['user_id'] = current_user.id
    entry['status'] = 'approved'
    flash('Login approved! The other device is now logged in.', 'success')
    return redirect(url_for('home.home'))


@auth_bp.route('/auth/qr-poll')
@csrf.exempt
def qr_poll():
    """Desktop polls this to check if QR was scanned and approved."""
    token = request.args.get('token', '')
    entry = _qr_tokens.get(token)
    if not entry:
        return jsonify({'status': 'expired'})
    if entry['status'] == 'approved' and entry['user_id']:
        user = User.query.get(entry['user_id'])
        if user:
            login_user(user, remember=True)
            del _qr_tokens[token]
            redir = url_for('team.dashboard') if getattr(user, 'is_team_account', False) else (url_for('founder_dash.overview') if user.role == 'founder' else url_for('home.home'))
            return jsonify({'status': 'approved', 'redirect': redir})
    return jsonify({'status': 'pending'})


# ---------------------------------------------------------------------------
# Onboarding Wizard (3-step: T&C → Profile → Genres)
# ---------------------------------------------------------------------------

@auth_bp.route('/onboarding', methods=['GET', 'POST'])
@login_required
def onboarding():
    """5-step onboarding for new users."""
    from .models import Genre, UserGenrePreference

    if current_user.onboarding_completed:
        return redirect(url_for('home.home'))

    step = request.args.get('step', '1')

    if request.method == 'POST':
        action = request.form.get('action', '')

        if action == 'accept_terms':
            session['onboarding_terms_accepted'] = True
            return redirect(url_for('auth.onboarding', step='2'))

        elif action == 'save_profile':
            display_name = request.form.get('display_name', '').strip()
            username = request.form.get('username', '').strip().lstrip('@').lower()

            if not display_name or len(display_name) < 2:
                flash('Please enter a display name (at least 2 characters).', 'error')
                return redirect(url_for('auth.onboarding', step='2'))

            if not username or len(username) < 3:
                flash('Please enter a username (at least 3 characters).', 'error')
                return redirect(url_for('auth.onboarding', step='2'))

            if not re.match(r'^[a-z0-9_]+$', username):
                flash('Username can only contain letters, numbers, and underscores.', 'error')
                return redirect(url_for('auth.onboarding', step='2'))

            existing = User.query.filter(User.username == username, User.id != current_user.id).first()
            if existing:
                flash('This username is taken. Please choose another.', 'error')
                return redirect(url_for('auth.onboarding', step='2'))

            # ── Content Guard scan ──
            from .services.content_guard import scan_multiple
            verdict = scan_multiple(current_user.id, {
                'display_name': display_name,
                'username': username,
            }, skip_ai=True)
            if not verdict.allowed:
                flash(verdict.reason, 'error')
                return redirect(url_for('auth.onboarding', step='2'))

            parts = display_name.split(' ', 1)
            current_user.first_name = parts[0]
            current_user.last_name = parts[1] if len(parts) > 1 else ''
            current_user.username = username
            db.session.commit()
            return redirect(url_for('auth.onboarding', step='3'))

        elif action == 'save_avatar':
            # Step 3 — avatar uploaded via JS, just move to next step
            return redirect(url_for('auth.onboarding', step='4'))

        elif action == 'save_about':
            # Step 4 — bio, DOB, pronouns (all optional)
            bio = request.form.get('bio', '').strip()
            dob = request.form.get('date_of_birth', '').strip()
            pronouns = request.form.get('pronouns', '').strip()

            # ── Content Guard scan ──
            if bio:
                from .services.content_guard import scan_content
                verdict = scan_content(current_user.id, bio, 'bio', skip_ai=True)
                if not verdict.allowed:
                    flash(verdict.reason, 'error')
                    return redirect(url_for('auth.onboarding', step='4'))

            current_user.bio = bio[:500] if bio else None
            current_user.pronouns = pronouns if pronouns else None
            current_user.show_pronouns = request.form.get('show_pronouns') == 'on'
            if dob:
                try:
                    from datetime import datetime as dt
                    current_user.date_of_birth = dt.strptime(dob, '%Y-%m-%d').date()
                except ValueError:
                    pass
            db.session.commit()
            return redirect(url_for('auth.onboarding', step='5'))

        elif action == 'save_genres':
            genre_ids = request.form.getlist('genres')
            if len(genre_ids) < 3:
                flash('Please select at least 3 genres.', 'error')
                return redirect(url_for('auth.onboarding', step='5'))

            UserGenrePreference.query.filter_by(user_id=current_user.wiam_id).delete()
            for gid in genre_ids[:10]:
                try:
                    pref = UserGenrePreference(user_id=current_user.wiam_id, genre_id=int(gid))
                    db.session.add(pref)
                except (ValueError, TypeError):
                    pass
            current_user.onboarding_completed = True
            db.session.commit()
            # Send welcome notification
            try:
                from .services.notifications import notify_welcome
                notify_welcome(current_user.wiam_id or current_user.id)
            except Exception:
                pass
            session['needs_pwa_install'] = True
            return redirect(url_for('auth.install_app'))

    # GET — show the correct step
    genres = Genre.query.order_by(Genre.name).all()
    terms_accepted = session.get('onboarding_terms_accepted', False)

    return render_template('onboarding.html',
        step=step,
        genres=genres,
        terms_accepted=terms_accepted,
    )


# ---------------------------------------------------------------------------
# PWA Install Gate (shown once after onboarding)
# ---------------------------------------------------------------------------

@auth_bp.route('/install-app')
@login_required
def install_app():
    """Show PWA install prompt after onboarding completion."""
    if not session.get('needs_pwa_install'):
        return redirect(url_for('home.home'))
    return render_template('install_app.html')


@auth_bp.route('/install-app/complete', methods=['POST'])
@login_required
def install_app_complete():
    """Mark PWA install step as done."""
    session.pop('needs_pwa_install', None)
    flash('Welcome to WiamApp! Enjoy reading.', 'success')
    return redirect(url_for('home.home'))
