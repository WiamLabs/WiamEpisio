"""
WiamApp — Rate Guard Service
==============================
Unified behaviour rate-limiting and anti-abuse engine.

All user actions (comments, follows, ratings, book creation, reports)
pass through check_rate() before execution.  Limits are read from
PlatformSetting (cached) so the founder can tune them at runtime.

Also provides:
  - Burst detection  (too many total actions in a short window)
  - IP registration limiting  (prevent mass account creation)
  - Cooldown enforcement  (temporary block after burst)
"""
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

log = logging.getLogger(__name__)

# ── In-memory stores ─────────────────────────────────────────────────────────
# { (user_id, action): [timestamp, ...] }
_action_store: dict = defaultdict(list)
# { user_id: [timestamp, ...] }  — all actions combined for burst detection
_burst_store: dict = defaultdict(list)
# { user_id: cooldown_expires_ts }
_cooldown_store: dict = {}
# { ip: [timestamp, ...] }  — registration counter
_reg_store: dict = defaultdict(list)

# ── Default limits (overridden by PlatformSetting) ──────────────────────────
_DEFAULTS = {
    'comment_per_min': 5,
    'comment_per_hour': 20,
    'follow_per_hour': 30,
    'rating_per_hour': 10,
    'book_create_per_day': 3,
    'burst_threshold': 50,          # total actions in burst window
    'burst_window_min': 5,          # minutes
    'burst_cooldown_min': 5,        # cooldown duration
    'registration_per_ip_per_hour': 5,
}

# Cached settings (refreshed every 5 min)
_settings_cache = {'data': None, 'ts': 0}
_CACHE_TTL = 300  # seconds


def _get_limits():
    """Read limits from PlatformSetting, cached 5 min."""
    now = time.time()
    if _settings_cache['data'] and (now - _settings_cache['ts']) < _CACHE_TTL:
        return _settings_cache['data']

    limits = dict(_DEFAULTS)
    try:
        from ..models import PlatformSetting
        rows = PlatformSetting.query.filter(
            PlatformSetting.key.like('rate_%')
        ).all()
        for r in rows:
            # Strip 'rate_' prefix: rate_comment_per_min → comment_per_min
            short_key = r.key[5:] if r.key.startswith('rate_') else r.key
            try:
                limits[short_key] = int(r.value)
            except (ValueError, TypeError):
                pass
    except Exception as e:
        log.debug("rate_guard: could not read PlatformSettings: %s", e)

    _settings_cache['data'] = limits
    _settings_cache['ts'] = now
    return limits


# ── Cleanup helper ───────────────────────────────────────────────────────────

def _prune(store_list, window_seconds):
    """Remove timestamps older than window from list (in-place) and return it."""
    cutoff = time.time() - window_seconds
    store_list[:] = [t for t in store_list if t > cutoff]
    return store_list


# ── Cooldown check ───────────────────────────────────────────────────────────

def _is_on_cooldown(user_id):
    """Return (True, message) if user is in cooldown, else (False, '')."""
    expires = _cooldown_store.get(user_id)
    if expires and time.time() < expires:
        remaining = int(expires - time.time())
        mins = max(1, remaining // 60)
        return True, f'You are performing actions too quickly. Please wait {mins} minute{"s" if mins != 1 else ""}.'
    # Clean up expired
    if expires:
        del _cooldown_store[user_id]
    return False, ''


def _record_burst(user_id):
    """Record an action for burst detection. Trigger cooldown if threshold hit."""
    limits = _get_limits()
    window = limits['burst_window_min'] * 60
    threshold = limits['burst_threshold']
    cooldown = limits['burst_cooldown_min'] * 60

    _prune(_burst_store[user_id], window)
    _burst_store[user_id].append(time.time())

    if len(_burst_store[user_id]) >= threshold:
        _cooldown_store[user_id] = time.time() + cooldown
        log.warning("BURST: user_id=%s triggered cooldown (%d actions in %d min)",
                     user_id, len(_burst_store[user_id]), limits['burst_window_min'])
        return True
    return False


# ── Main check function ─────────────────────────────────────────────────────

# Action configs: { action_name: [(limit_key, window_seconds)] }
_ACTION_WINDOWS = {
    'comment':     [('comment_per_min', 60), ('comment_per_hour', 3600)],
    'follow':      [('follow_per_hour', 3600)],
    'rating':      [('rating_per_hour', 3600)],
    'book_create': [('book_create_per_day', 86400)],
    'report':      [('comment_per_hour', 3600)],  # reuse comment limit for reports
}

_ACTION_MESSAGES = {
    'comment':     'You are commenting too quickly. Please slow down.',
    'follow':      'You are following users too quickly.',
    'rating':      'You are rating too quickly. Please slow down.',
    'book_create': 'You have reached the maximum number of books you can create today.',
    'report':      'You are submitting reports too quickly. Please slow down.',
}


def check_rate(user_id, action):
    """Check if a user action is within rate limits.

    Args:
        user_id: int — the user's primary key (User.id)
        action: str — one of 'comment', 'follow', 'rating', 'book_create', 'report'

    Returns:
        (allowed: bool, message: str)
        If allowed is False, message contains the user-facing reason.
    """
    # Cooldown check first
    on_cd, cd_msg = _is_on_cooldown(user_id)
    if on_cd:
        return False, cd_msg

    limits = _get_limits()
    windows = _ACTION_WINDOWS.get(action)
    if not windows:
        return True, ''

    for limit_key, window_secs in windows:
        max_count = limits.get(limit_key, 999)
        key = (user_id, action, limit_key)
        _prune(_action_store[key], window_secs)
        if len(_action_store[key]) >= max_count:
            return False, _ACTION_MESSAGES.get(action, 'Please slow down.')

    # Record timestamps
    now = time.time()
    for limit_key, _ in windows:
        key = (user_id, action, limit_key)
        _action_store[key].append(now)

    # Burst detection
    _record_burst(user_id)

    return True, ''


def check_book_create(user_id):
    """Check book creation limit with trusted-creator bypass.

    Trusted creator = account older than 14 days AND no strikes in 90 days.
    Returns (allowed: bool, message: str)
    """
    try:
        from ..models import User
        from .content_guard import count_user_strikes
        user = User.query.get(user_id)
        if user:
            age_days = (datetime.utcnow() - (user.date_joined or datetime.utcnow())).days
            strikes = count_user_strikes(user_id)
            if age_days >= 14 and strikes == 0:
                # Trusted creator — no limit, but still record for burst detection
                _record_burst(user_id)
                return True, ''
    except Exception:
        pass

    return check_rate(user_id, 'book_create')


# ── IP Registration Limiter ──────────────────────────────────────────────────

def check_registration_ip(ip_address):
    """Check if an IP has exceeded registration limits.

    Returns (allowed: bool, message: str)
    """
    if not ip_address:
        return True, ''

    limits = _get_limits()
    max_per_hour = limits.get('registration_per_ip_per_hour', 5)

    _prune(_reg_store[ip_address], 3600)
    if len(_reg_store[ip_address]) >= max_per_hour:
        log.warning("IP registration limit: %s blocked (%d registrations/hr)",
                     ip_address, len(_reg_store[ip_address]))
        return False, 'Too many accounts created from this network. Please try again later.'

    _reg_store[ip_address].append(time.time())
    return True, ''


# ── Periodic cleanup (call from before_request or scheduler) ─────────────────

_last_cleanup = 0

def cleanup_stale_entries():
    """Remove entries older than 2 hours to prevent memory growth."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < 600:  # every 10 min max
        return
    _last_cleanup = now

    cutoff = now - 7200  # 2 hours
    for key in list(_action_store.keys()):
        _action_store[key] = [t for t in _action_store[key] if t > cutoff]
        if not _action_store[key]:
            del _action_store[key]

    for uid in list(_burst_store.keys()):
        _burst_store[uid] = [t for t in _burst_store[uid] if t > cutoff]
        if not _burst_store[uid]:
            del _burst_store[uid]

    for ip in list(_reg_store.keys()):
        _reg_store[ip] = [t for t in _reg_store[ip] if t > cutoff]
        if not _reg_store[ip]:
            del _reg_store[ip]

    for uid in list(_cooldown_store.keys()):
        if _cooldown_store[uid] < now:
            del _cooldown_store[uid]
