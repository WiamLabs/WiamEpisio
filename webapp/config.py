import os
import ssl


def _env_bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return str(val).strip().lower() in ('1', 'true', 'yes', 'on')


def _build_db_uri():
    """Build the SQLAlchemy database URI from environment variables."""
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        # Fallback to individual params for local dev
        db_name = os.environ.get('DB_NAME', 'wiamlight')
        db_user = os.environ.get('DB_USER', 'postgres')
        db_pass = os.environ.get('DB_PASSWORD', '')
        db_host = os.environ.get('DB_HOST', 'localhost')
        db_port = os.environ.get('DB_PORT', '5432')
        return f'postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}'
    # Fix postgres:// → postgresql:// (some providers use the old prefix)
    return url.replace('postgres://', 'postgresql://', 1)


class Config:
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', os.environ.get('BOT_TOKEN', 'dev-secret-key'))
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB upload limit (B6)
    SQLALCHEMY_DATABASE_URI = _build_db_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # SSL for remote PostgreSQL (Supabase)
    if os.environ.get('DATABASE_URL', ''):
        SQLALCHEMY_ENGINE_OPTIONS = {
            'connect_args': {'sslmode': 'require'},
            'pool_pre_ping': True,
            'pool_size': 5,           # S4: max persistent connections per instance
            'max_overflow': 10,       # S4: extra connections under burst load
            'pool_recycle': 300,      # S4: recycle connections every 5 min (Supabase pooler compat)
            'pool_timeout': 10,       # S4: wait max 10s for a connection from pool
        }
    else:
        SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True}
    WTF_CSRF_TIME_LIMIT = None  # Disable CSRF token expiration (Render free tier spins down)
    BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
    BOT_USERNAME = os.environ.get('BOT_USERNAME', '')
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
    PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY', '')
    PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY', '')
    PAYSTACK_ELITE_PLAN_CODE = os.environ.get('PAYSTACK_ELITE_PLAN_CODE', '')
    PAYSTACK_PREMIUM_PLAN_CODE = os.environ.get('PAYSTACK_PREMIUM_PLAN_CODE', '')
    # SMTP for email verification / password reset
    SMTP_HOST = os.environ.get('SMTP_HOST', '')
    SMTP_PORT = os.environ.get('SMTP_PORT', '587')
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASS = os.environ.get('SMTP_PASS', '')
    SMTP_FROM = os.environ.get('SMTP_FROM', 'noreply@wiamapp.com')
    # Web Push (VAPID)
    VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
    VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
    VAPID_CLAIMS_EMAIL = os.environ.get('VAPID_CLAIMS_EMAIL', 'mailto:support@wiamapp.com')
    # User-facing support (privacy, Help, Play Store, deletion, WiamBot prompts, etc.)
    SUPPORT_EMAIL = os.environ.get('SUPPORT_EMAIL', 'support@wiamapp.com')
    # Company / internal ops (team account issues, QA dashboards, engineering contact)
    COMPANY_EMAIL = os.environ.get('COMPANY_EMAIL', 'labs@wiamapp.com')
    # AI Providers (all free tier)
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
    GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
    CEREBRAS_API_KEY = os.environ.get('CEREBRAS_API_KEY', '')
    # Cloudinary (free tier image CDN)
    CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET', '')
    # Founder notifications (email + in-app)
    FOUNDER_EMAIL = os.environ.get('FOUNDER_EMAIL', 'wiamlabs@gmail.com')
    # Play Integrity / trial anti-abuse
    PLAY_INTEGRITY_ENFORCE = _env_bool('PLAY_INTEGRITY_ENFORCE', False)
    PLAY_INTEGRITY_REQUIRED_FOR_TRIAL = _env_bool('PLAY_INTEGRITY_REQUIRED_FOR_TRIAL', False)
    PLAY_INTEGRITY_REQUIRE_PLAY_RECOGNIZED = _env_bool('PLAY_INTEGRITY_REQUIRE_PLAY_RECOGNIZED', True)
    PLAY_INTEGRITY_REQUIRE_LICENSED = _env_bool('PLAY_INTEGRITY_REQUIRE_LICENSED', False)
    PLAY_INTEGRITY_AUDIENCE = os.environ.get('PLAY_INTEGRITY_AUDIENCE', '')
    PLAY_INTEGRITY_PACKAGE_NAME = os.environ.get('PLAY_INTEGRITY_PACKAGE_NAME', '')
    PLAY_INTEGRITY_JWKS_URL = os.environ.get('PLAY_INTEGRITY_JWKS_URL', 'https://www.googleapis.com/oauth2/v3/certs')
    PLAY_INTEGRITY_ALLOWED_DEVICE_VERDICTS = os.environ.get(
        'PLAY_INTEGRITY_ALLOWED_DEVICE_VERDICTS',
        'MEETS_DEVICE_INTEGRITY,MEETS_BASIC_INTEGRITY'
    )
    # iOS App Attest / DeviceCheck rollout flags
    IOS_INTEGRITY_ENFORCE = _env_bool('IOS_INTEGRITY_ENFORCE', False)
    IOS_INTEGRITY_REQUIRED_FOR_TRIAL = _env_bool('IOS_INTEGRITY_REQUIRED_FOR_TRIAL', False)
    IOS_INTEGRITY_AUDIENCE = os.environ.get('IOS_INTEGRITY_AUDIENCE', '')
    IOS_INTEGRITY_ISSUER = os.environ.get('IOS_INTEGRITY_ISSUER', '')
    IOS_INTEGRITY_JWKS_URL = os.environ.get('IOS_INTEGRITY_JWKS_URL', '')
    IOS_INTEGRITY_REQUIRE_JWT_SIGNATURE = _env_bool('IOS_INTEGRITY_REQUIRE_JWT_SIGNATURE', False)
    # QA automation webhook (CI -> QA dashboard feed)
    QA_AUTOMATION_WEBHOOK_SECRET = os.environ.get('QA_AUTOMATION_WEBHOOK_SECRET', '')
