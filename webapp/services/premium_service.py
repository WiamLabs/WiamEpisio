"""
Premium subscription service — access logic, credit grant/spend, status helpers.

Provides:
  - is_premium_active(user): Check if user has active premium
  - has_premium_access(user, cfg): Check if user needs premium (respects feature flags)
  - grant_monthly_credits(user): Grant monthly unlock credits on subscription activation/renewal
  - spend_premium_credit(user, chapter): Spend credits to unlock a premium-locked chapter
  - activate_premium(user, plan, provider, expires_at): Set premium fields on user
  - expire_premium(user): Mark premium as expired
"""
import logging
from datetime import datetime, timedelta

log = logging.getLogger(__name__)


def _get_config():
    from ..models import PlatformConfig
    return PlatformConfig.get()


# ---------------------------------------------------------------------------
# Access logic helpers (spec sections 5.1–5.3)
# ---------------------------------------------------------------------------

def is_premium_active(user):
    """Check if user currently has an active premium subscription (including trial)."""
    if not user:
        return False
    if user.premium_status not in ('active', 'trial'):
        return False
    if user.premium_expires_at and datetime.utcnow() > user.premium_expires_at:
        return False
    return True


def has_premium_access(user):
    """
    Returns True if the user can access premium-gated content.
    When FF_PREMIUM_ENABLED is off, everyone has access (no paywall).
    """
    cfg = _get_config()
    if not cfg.ff_premium_enabled:
        return True  # paywall off — everyone can access
    return is_premium_active(user)


def can_access_elite(user):
    """Check if user can access WiamElite premium content."""
    cfg = _get_config()
    if not cfg.ff_elite_paywall_enabled:
        return True  # Elite paywall off — visible to all
    return is_premium_active(user)


def can_access_apex(user):
    """Check if user can access WiamApex content."""
    cfg = _get_config()
    if not cfg.ff_apex_paywall_enabled:
        return True  # Apex paywall off — visible to all
    return is_premium_active(user)


def can_access_chapter(user, chapter):
    """
    Check if user can read a specific chapter.
    Returns (can_access, reason) tuple.
    Reasons: 'free', 'unlocked', 'premium_active', 'needs_credit', 'needs_premium', 'needs_coins'
    """
    from ..models import ChapterUnlock

    # Not premium-locked — free to read
    if not chapter.is_premium_locked and not chapter.is_locked:
        return True, 'free'

    if not user or not hasattr(user, 'wiam_id'):
        if chapter.is_premium_locked:
            return False, 'needs_premium'
        return False, 'needs_coins'

    # Already unlocked by this user
    uid = user.wiam_id or user.id
    existing = ChapterUnlock.query.filter_by(
        user_id=uid,
        content_id=chapter.content_id,
        chapter_number=chapter.chapter_number,
    ).first()
    if existing:
        return True, 'unlocked'

    cfg = _get_config()

    # Premium-locked chapter
    if chapter.is_premium_locked:
        if not cfg.ff_premium_enabled:
            return True, 'free'  # paywall off
        if is_premium_active(user):
            if cfg.ff_monthly_unlocks_enabled and user.premium_credits_balance >= chapter.unlock_cost_credits:
                return True, 'needs_credit'  # can unlock with credit (show button)
            return True, 'premium_active'  # premium user, can read
        return False, 'needs_premium'

    # Coin-locked chapter (is_locked=True)
    if chapter.is_locked:
        return False, 'needs_coins'

    return True, 'free'


# ---------------------------------------------------------------------------
# Premium activation / expiry
# ---------------------------------------------------------------------------

def activate_premium(user, plan='monthly', provider='paystack', expires_at=None):
    """Activate premium status on a user. Called when subscription starts/renews."""
    from ..extensions import db

    now = datetime.utcnow()
    if not expires_at:
        expires_at = now + timedelta(days=30)

    was_active = user.premium_status == 'active'

    user.premium_status = 'active'
    user.premium_plan = plan
    user.premium_provider = provider
    user.premium_expires_at = expires_at
    if not was_active:
        user.premium_started_at = now

    db.session.commit()
    log.info("Premium activated for user %s (plan=%s, provider=%s, expires=%s)",
             user.wiam_id, plan, provider, expires_at)
    return user


def expire_premium(user, commit=True):
    """Mark premium as expired and revoke all premium benefits instantly."""
    from ..extensions import db

    user.premium_status = 'expired'
    user.premium_plan = None
    user.premium_credits_balance = 0
    if commit:
        db.session.commit()
    log.info("Premium expired for user %s — plan cleared, credits zeroed",
             user.wiam_id or user.id)


def check_and_expire_premium(user):
    """
    Centralized premium expiry check.  Call on every authenticated request.
    If the user's premium_expires_at has passed:
      1. Expire premium status, clear plan & credits
      2. Pause all creator subscriptions where this user is subscriber
      3. If user is a creator: pause their subscription offering
    Returns True if the user was expired (or was already expired), False if still active.
    """
    if not user:
        return False
    if user.premium_status not in ('active', 'trial'):
        return False  # nothing to expire
    if not user.premium_expires_at:
        return False  # no expiry set — treat as perpetual
    from datetime import datetime as _dt
    if _dt.utcnow() <= user.premium_expires_at:
        return False  # still valid

    from ..extensions import db
    # ── 1. Expire the user's own premium ──
    expire_premium(user, commit=False)

    # Note: Creator subscriptions are no longer tied to premium status.
    # Readers and creators no longer need premium to use creator subscriptions.

    db.session.commit()
    return True


# ---------------------------------------------------------------------------
# Premium tier helpers
# ---------------------------------------------------------------------------

PREMIUM_CREATOR_SUB_TIERS = ('plus', 'unlimited')


def is_premium_plus_or_unlimited(user):
    """
    Check if user has Premium Plus or Premium Unlimited (active).
    Note: No longer required for creator subscriptions (now uses follower/views thresholds).
    """
    if not is_premium_active(user):
        return False
    return (user.premium_plan or '').lower() in PREMIUM_CREATOR_SUB_TIERS


# ---------------------------------------------------------------------------
# Monthly credit system (spec section 5.4)
# ---------------------------------------------------------------------------

def grant_monthly_credits(user):
    """
    Grant monthly premium unlock credits to a user.
    Called when subscription activates or billing cycle renews.
    Resets balance to the configured amount (credits don't carry over).
    """
    from ..extensions import db
    from ..models import PremiumCreditsLedger

    cfg = _get_config()
    if not cfg.ff_monthly_unlocks_enabled:
        log.debug("Monthly unlocks disabled, skipping credit grant for user %s", user.wiam_id)
        return

    credits = cfg.premium_monthly_unlock_credits
    now = datetime.utcnow()
    cycle_end = now + timedelta(days=30)

    user.premium_credits_balance = credits
    user.premium_credits_cycle_start = now
    user.premium_credits_cycle_end = cycle_end

    # Ledger entry
    entry = PremiumCreditsLedger(
        user_id=user.wiam_id or user.id,
        type='grant',
        amount=credits,
        balance_after=credits,
        reason='monthly_grant',
    )
    db.session.add(entry)
    db.session.commit()

    log.info("Granted %d monthly credits to user %s (cycle ends %s)",
             credits, user.wiam_id, cycle_end)
    return credits


def spend_premium_credit(user, chapter):
    """
    Spend premium credits to unlock a chapter.
    Returns (success, message) tuple.
    """
    from ..extensions import db
    from ..models import PremiumCreditsLedger, ChapterUnlock, Content

    cfg = _get_config()
    if not cfg.ff_monthly_unlocks_enabled:
        return False, 'Monthly unlocks are not enabled.'

    if not is_premium_active(user):
        return False, 'Premium subscription required.'

    cost = chapter.unlock_cost_credits or 1
    if user.premium_credits_balance < cost:
        return False, f'Not enough credits ({user.premium_credits_balance} available, {cost} needed).'

    # Check if already unlocked
    uid = user.wiam_id or user.id
    existing = ChapterUnlock.query.filter_by(
        user_id=uid,
        content_id=chapter.content_id,
        chapter_number=chapter.chapter_number,
    ).first()
    if existing:
        return True, 'Chapter already unlocked.'

    # Get creator id
    story = Content.query.get(chapter.content_id)
    creator_id = story.creator_wiam_id if story else 0

    # Deduct credits
    user.premium_credits_balance -= cost
    new_balance = user.premium_credits_balance

    # Ledger entry
    ledger = PremiumCreditsLedger(
        user_id=uid,
        type='spend',
        amount=-cost,
        balance_after=new_balance,
        reason=f'unlock_chapter:{chapter.content_id}:{chapter.chapter_number}',
        related_chapter_id=chapter.id,
    )
    db.session.add(ledger)

    # Create unlock record
    unlock = ChapterUnlock(
        user_id=uid,
        content_id=chapter.content_id,
        chapter_number=chapter.chapter_number,
        coins_spent=0,
        creator_id=creator_id,
        unlock_method='premium_credit',
    )
    db.session.add(unlock)
    db.session.commit()

    log.info("User %s spent %d credit(s) to unlock ch %d of story %d (balance: %d)",
             user.wiam_id, cost, chapter.chapter_number, chapter.content_id, new_balance)
    return True, f'Chapter unlocked! {new_balance} credits remaining.'


def admin_grant_credits(user, amount, reason='admin_grant'):
    """Admin manually grants credits to a user."""
    from ..extensions import db
    from ..models import PremiumCreditsLedger

    user.premium_credits_balance = (user.premium_credits_balance or 0) + amount
    new_balance = user.premium_credits_balance

    entry = PremiumCreditsLedger(
        user_id=user.wiam_id or user.id,
        type='adjust',
        amount=amount,
        balance_after=new_balance,
        reason=reason,
    )
    db.session.add(entry)
    db.session.commit()

    log.info("Admin granted %d credits to user %s (balance: %d, reason: %s)",
             amount, user.wiam_id, new_balance, reason)
    return new_balance
