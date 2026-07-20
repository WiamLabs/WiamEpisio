import os

from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
csrf = CSRFProtect()

# S2: Use Redis if REDIS_URL is set (Upstash / managed Redis), otherwise fall back to memory://
_limiter_storage = os.environ.get('REDIS_URL', 'memory://')
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"], storage_uri=_limiter_storage)

login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'


def is_feature_locked(feature_key):
    """Check if a feature is locked via FeatureFlag table.
    Returns True if the feature is LOCKED (is_enabled=False or flag doesn't exist yet).
    Default: unlocked (True) if no flag row exists.
    """
    from .models import FeatureFlag
    flag = FeatureFlag.query.filter_by(key=feature_key).first()
    if flag is None:
        return False  # No flag = unlocked by default
    return not flag.is_enabled
