"""
Creator Subscription Service — business logic for reader-to-creator subscriptions.

Provides:
  - subscribe_to_creator(reader, creator, tier) — subscribe with gating checks
  - cancel_subscription(subscription) — cancel a subscription
  - check_subscription(reader_id, creator_id) — check active subscription
  - get_subscriber_perks(reader_id, creator_id) — what perks does this reader get
  - record_subscription_earning(subscription) — record monthly earning with 70/30 split
  - is_creator_eligible_for_subs(creator) — check if creator can offer subscriptions
  - get_creator_eligibility_progress(creator) — progress towards eligibility thresholds
"""
import logging
from datetime import datetime, timedelta

log = logging.getLogger(__name__)

# Revenue split for creator subscriptions
CREATOR_SUB_SHARE_PCT = 70.0
PLATFORM_SUB_SHARE_PCT = 30.0

# Grace period: paused subs auto-cancel after this many days
PAUSE_GRACE_DAYS = 30

# Creator eligibility thresholds
MIN_FOLLOWERS = 150
MIN_PUBLISHED_BOOKS = 1
MIN_TOTAL_VIEWS = 500
MIN_ACCOUNT_AGE_DAYS = 30


def _db():
    from ..extensions import db
    return db


# ---------------------------------------------------------------------------
# Eligibility checks
# ---------------------------------------------------------------------------

def _get_creator_metrics(creator):
    """Compute follower count, published books, total views, and account age for a creator."""
    from ..models import Follow, Content
    creator_pk = creator.id
    wiam_id = creator.wiam_id or creator_pk

    follower_count = Follow.query.filter_by(creator_id=creator_pk).count()
    published_books = Content.query.filter(
        Content.creator_wiam_id == wiam_id,
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    ).count()
    total_views = _db().session.query(
        _db().func.coalesce(_db().func.sum(Content.views), 0)
    ).filter(
        Content.creator_wiam_id == wiam_id,
        Content.deleted_at.is_(None),
    ).scalar() or 0

    account_age_days = 0
    if creator.date_joined:
        account_age_days = (datetime.utcnow() - creator.date_joined).days

    return {
        'follower_count': follower_count,
        'published_books': published_books,
        'total_views': int(total_views),
        'account_age_days': account_age_days,
    }


def is_creator_eligible_for_subs(creator):
    """
    Check if a creator can offer subscriptions.
    Requirements:
      1. Must be a creator (role = creator or founder)
      2. Must have 150+ followers
      3. Must have at least 1 published book
      4. Must have 500+ total views
      5. Account must be 30+ days old
    Returns (eligible: bool, reason: str)
    """
    if not creator:
        return False, 'User not found'
    if not creator.is_creator:
        return False, 'User is not a creator'

    m = _get_creator_metrics(creator)

    if m['follower_count'] < MIN_FOLLOWERS:
        return False, f'Need {MIN_FOLLOWERS} followers (currently {m["follower_count"]})'
    if m['published_books'] < MIN_PUBLISHED_BOOKS:
        return False, f'Need at least {MIN_PUBLISHED_BOOKS} published story'
    if m['total_views'] < MIN_TOTAL_VIEWS:
        return False, f'Need {MIN_TOTAL_VIEWS} total views (currently {m["total_views"]})'
    if m['account_age_days'] < MIN_ACCOUNT_AGE_DAYS:
        return False, f'Account must be at least {MIN_ACCOUNT_AGE_DAYS} days old'

    return True, 'eligible'


def get_creator_eligibility_progress(creator):
    """
    Get detailed progress towards subscription eligibility.
    Returns dict with current values, thresholds, and overall eligibility.
    """
    if not creator or not creator.is_creator:
        return {'eligible': False, 'is_creator': False, 'checks': []}

    m = _get_creator_metrics(creator)
    checks = [
        {
            'key': 'followers',
            'label': 'Followers',
            'current': m['follower_count'],
            'required': MIN_FOLLOWERS,
            'met': m['follower_count'] >= MIN_FOLLOWERS,
        },
        {
            'key': 'published_books',
            'label': 'Published Stories',
            'current': m['published_books'],
            'required': MIN_PUBLISHED_BOOKS,
            'met': m['published_books'] >= MIN_PUBLISHED_BOOKS,
        },
        {
            'key': 'total_views',
            'label': 'Total Views',
            'current': m['total_views'],
            'required': MIN_TOTAL_VIEWS,
            'met': m['total_views'] >= MIN_TOTAL_VIEWS,
        },
        {
            'key': 'account_age',
            'label': 'Account Age (days)',
            'current': m['account_age_days'],
            'required': MIN_ACCOUNT_AGE_DAYS,
            'met': m['account_age_days'] >= MIN_ACCOUNT_AGE_DAYS,
        },
    ]
    eligible = all(c['met'] for c in checks)
    return {'eligible': eligible, 'is_creator': True, 'checks': checks}


def can_reader_subscribe(reader):
    """
    Check if a reader can subscribe to creators.
    Any authenticated user can subscribe — no premium gate.
    Returns (can_subscribe: bool, reason: str)
    """
    if not reader:
        return False, 'User not found'
    if reader.status == 'banned':
        return False, 'Account is banned'
    return True, 'eligible'


# ---------------------------------------------------------------------------
# Subscribe / Cancel / Check
# ---------------------------------------------------------------------------

def subscribe_to_creator(reader, creator_id, tier_id):
    """
    Subscribe a reader to a creator's tier.
    Returns (success: bool, result: dict)
    """
    from ..models import (
        CreatorSubTier, CreatorSubscription, CreatorSubEarning, User
    )
    db = _db()

    # 1. Reader eligibility
    can_sub, reason = can_reader_subscribe(reader)
    if not can_sub:
        return False, {'error': reason}

    # 2. Creator eligibility (creator_id is wiam_id)
    creator = User.query.filter_by(wiam_id=creator_id).first() or User.query.get(creator_id)
    if not creator:
        return False, {'error': 'Creator not found'}
    eligible, reason = is_creator_eligible_for_subs(creator)
    if not eligible:
        return False, {'error': reason}

    # 3. Tier exists and is active
    tier = CreatorSubTier.query.get(tier_id)
    if not tier or tier.creator_id != creator_id or not tier.is_active:
        return False, {'error': 'Subscription tier not available'}

    # 4. Already subscribed?
    existing = CreatorSubscription.query.filter_by(
        subscriber_id=reader.id, creator_id=creator_id, status='active'
    ).first()
    if existing:
        return False, {'error': 'Already subscribed to this creator'}

    # 5. Check for paused subscription (re-activate)
    paused = CreatorSubscription.query.filter_by(
        subscriber_id=reader.id, creator_id=creator_id, status='paused'
    ).first()
    if paused:
        paused.status = 'active'
        paused.tier_id = tier_id
        paused.paused_reason = None
        period_days = 365 if getattr(tier, 'billing_period', 'monthly') == 'yearly' else 30
        paused.expires_at = datetime.utcnow() + timedelta(days=period_days)
        db.session.commit()
        log.info("Resumed paused subscription %d (reader=%d creator=%d)",
                 paused.id, reader.id, creator_id)
        return True, {
            'subscription_id': paused.id,
            'status': 'active',
            'resumed': True,
            'tier': tier.name,
            'expires_at': paused.expires_at.isoformat(),
        }

    # 6. Create new subscription
    now = datetime.utcnow()
    period_days = 365 if getattr(tier, 'billing_period', 'monthly') == 'yearly' else 30
    sub = CreatorSubscription(
        subscriber_id=reader.id,
        creator_id=creator_id,
        tier_id=tier_id,
        status='active',
        started_at=now,
        expires_at=now + timedelta(days=period_days),
    )
    db.session.add(sub)
    db.session.flush()  # get sub.id

    # 7. Record first earning
    _record_earning(sub, tier)

    db.session.commit()
    billing = getattr(tier, 'billing_period', 'monthly')
    price = tier.yearly_price_ghs if billing == 'yearly' and getattr(tier, 'yearly_price_ghs', None) else tier.price_ghs
    log.info("New creator subscription %d: reader=%d -> creator=%d tier='%s' GHS%.2f (%s)",
             sub.id, reader.id, creator_id, tier.name, price, billing)

    return True, {
        'subscription_id': sub.id,
        'status': 'active',
        'resumed': False,
        'tier': tier.name,
        'price_ghs': price,
        'billing_period': billing,
        'expires_at': sub.expires_at.isoformat(),
    }


def cancel_subscription(reader_id, creator_id):
    """Cancel a reader's subscription to a creator."""
    from ..models import CreatorSubscription
    db = _db()

    sub = CreatorSubscription.query.filter_by(
        subscriber_id=reader_id, creator_id=creator_id
    ).filter(CreatorSubscription.status.in_(['active', 'paused'])).first()

    if not sub:
        return False, {'error': 'No active subscription found'}

    sub.status = 'cancelled'
    sub.cancelled_at = datetime.utcnow()
    sub.auto_renew = False
    db.session.commit()

    log.info("Cancelled creator subscription %d (reader=%d creator=%d)",
             sub.id, reader_id, creator_id)
    return True, {'subscription_id': sub.id, 'status': 'cancelled'}


def check_subscription(reader_id, creator_id):
    """
    Check if reader has an active subscription to creator.
    Returns the subscription object or None.
    """
    from ..models import CreatorSubscription
    return CreatorSubscription.query.filter_by(
        subscriber_id=reader_id, creator_id=creator_id, status='active'
    ).first()


def get_subscriber_perks(reader_id, creator_id):
    """
    Get the perks a reader has for a specific creator.
    Returns dict of perk flags, or empty dict if not subscribed.
    """
    sub = check_subscription(reader_id, creator_id)
    if not sub or not sub.tier:
        return {}

    tier = sub.tier
    return {
        'is_subscribed': True,
        'tier_name': tier.name,
        'subscriber_posts': bool(tier.perk_subscriber_posts),
        'early_access_hours': tier.perk_early_access_hours or 0,
        'badge': bool(tier.perk_badge),
        'author_notes': bool(tier.perk_author_notes),
        'no_ads': bool(tier.perk_no_ads),
        'priority_comments': bool(tier.perk_priority_comments),
    }


def has_perk(reader_id, creator_id, perk_name):
    """Quick check: does this reader have a specific perk for this creator?"""
    perks = get_subscriber_perks(reader_id, creator_id)
    return perks.get(perk_name, False)


# ---------------------------------------------------------------------------
# Subscription pause / resume utilities
# ---------------------------------------------------------------------------

def pause_subscriber_subs(user_id, reason='manual'):
    """Pause all creator subscriptions where user is the subscriber."""
    from ..models import CreatorSubscription
    db = _db()
    subs = CreatorSubscription.query.filter_by(
        subscriber_id=user_id, status='active'
    ).all()
    for s in subs:
        s.status = 'paused'
        s.paused_reason = reason
    if subs:
        db.session.commit()
        log.info("Paused %d creator subs for subscriber %d (%s)", len(subs), user_id, reason)
    return len(subs)


def pause_creator_offerings(creator_id, reason='creator_premium_expired'):
    """Pause all subscription tiers for a creator whose premium expired."""
    from ..models import CreatorSubTier
    db = _db()
    tiers = CreatorSubTier.query.filter_by(creator_id=creator_id, is_active=True).all()
    for t in tiers:
        t.is_active = False
        t.paused_reason = reason
    if tiers:
        db.session.commit()
        log.info("Paused %d tiers for creator %d (%s)", len(tiers), creator_id, reason)
    return len(tiers)


def resume_subscriber_subs(user_id):
    """Resume paused subs when reader renews premium (within grace period)."""
    from ..models import CreatorSubscription
    db = _db()
    cutoff = datetime.utcnow() - timedelta(days=PAUSE_GRACE_DAYS)
    subs = CreatorSubscription.query.filter(
        CreatorSubscription.subscriber_id == user_id,
        CreatorSubscription.status == 'paused',
        CreatorSubscription.paused_reason == 'subscriber_premium_expired',
        CreatorSubscription.cancelled_at.is_(None),
        CreatorSubscription.started_at >= cutoff,
    ).all()
    for s in subs:
        s.status = 'active'
        s.paused_reason = None
        s.expires_at = datetime.utcnow() + timedelta(days=30)
    if subs:
        db.session.commit()
        log.info("Resumed %d paused subs for subscriber %d", len(subs), user_id)
    return len(subs)


def resume_creator_offerings(creator_id):
    """Resume paused tiers when creator renews premium."""
    from ..models import CreatorSubTier
    db = _db()
    tiers = CreatorSubTier.query.filter_by(
        creator_id=creator_id, is_active=False
    ).filter(CreatorSubTier.paused_reason == 'creator_premium_expired').all()
    for t in tiers:
        t.is_active = True
        t.paused_reason = None
    if tiers:
        db.session.commit()
        log.info("Resumed %d tiers for creator %d", len(tiers), creator_id)
    return len(tiers)


# ---------------------------------------------------------------------------
# Earnings
# ---------------------------------------------------------------------------

def _record_earning(subscription, tier):
    """Record a subscription earning for one billing period."""
    from ..models import CreatorSubEarning
    db = _db()
    now = datetime.utcnow()
    billing = getattr(tier, 'billing_period', 'monthly')
    amount = tier.yearly_price_ghs if billing == 'yearly' and getattr(tier, 'yearly_price_ghs', None) else tier.price_ghs
    creator_share = round(amount * CREATOR_SUB_SHARE_PCT / 100, 2)
    platform_share = round(amount * PLATFORM_SUB_SHARE_PCT / 100, 2)

    period_days = 365 if billing == 'yearly' else 30
    earning = CreatorSubEarning(
        creator_id=subscription.creator_id,
        subscriber_id=subscription.subscriber_id,
        subscription_id=subscription.id,
        amount_ghs=amount,
        creator_share_ghs=creator_share,
        platform_share_ghs=platform_share,
        period_start=now,
        period_end=now + timedelta(days=period_days),
        status='pending',
    )
    db.session.add(earning)

    # Also update the creator's monthly earnings total
    try:
        from ..models import CreatorEarnings
        year, month = now.year, now.month
        ce = CreatorEarnings.query.filter_by(
            creator_id=subscription.creator_id, year=year, month=month
        ).first()
        if ce:
            ce.total_coins += int(creator_share * 20)  # rough coin equivalent
            ce.updated_at = now
        else:
            ce = CreatorEarnings(
                creator_id=subscription.creator_id,
                year=year, month=month,
                total_coins=int(creator_share * 20),
            )
            db.session.add(ce)
    except Exception as e:
        log.warning("Could not update CreatorEarnings for sub earning: %s", e)

    return earning


# ---------------------------------------------------------------------------
# Tier management (for creators)
# ---------------------------------------------------------------------------

def create_tier(creator_id, name, price_ghs, description='', billing_period='monthly', yearly_price_ghs=None, **perks):
    """Create a new subscription tier for a creator."""
    from ..models import CreatorSubTier, User
    db = _db()

    # Verify creator eligibility (creator_id is wiam_id)
    creator = User.query.filter_by(wiam_id=creator_id).first() or User.query.get(creator_id)
    eligible, reason = is_creator_eligible_for_subs(creator)
    if not eligible:
        return None, reason

    # Max 3 tiers per creator
    count = CreatorSubTier.query.filter_by(creator_id=creator_id).count()
    if count >= 3:
        return None, 'Maximum 3 tiers allowed'

    tier = CreatorSubTier(
        creator_id=creator_id,
        name=name,
        price_ghs=max(1.0, min(price_ghs, 100.0)),  # GHS 1-100 range
        billing_period=billing_period if billing_period in ('monthly', 'yearly') else 'monthly',
        yearly_price_ghs=max(1.0, min(yearly_price_ghs, 1000.0)) if yearly_price_ghs else None,
        description=description,
        perk_subscriber_posts=perks.get('subscriber_posts', True),
        perk_early_access_hours=perks.get('early_access_hours', 0),
        perk_badge=perks.get('badge', True),
        perk_author_notes=perks.get('author_notes', False),
        perk_no_ads=perks.get('no_ads', True),
        perk_priority_comments=perks.get('priority_comments', False),
        sort_order=count,
    )
    db.session.add(tier)
    db.session.commit()
    log.info("Created tier %d for creator %d: '%s' GHS%.2f (%s)",
             tier.id, creator_id, name, tier.price_ghs, billing_period)
    return tier, 'created'


def update_tier(tier_id, creator_id, **fields):
    """Update an existing tier. Only the owning creator can update."""
    from ..models import CreatorSubTier
    db = _db()

    tier = CreatorSubTier.query.get(tier_id)
    if not tier or tier.creator_id != creator_id:
        return None, 'Tier not found'

    if 'name' in fields:
        tier.name = fields['name']
    if 'price_ghs' in fields:
        tier.price_ghs = max(1.0, min(fields['price_ghs'], 100.0))
    if 'description' in fields:
        tier.description = fields['description']
    if 'billing_period' in fields and fields['billing_period'] in ('monthly', 'yearly'):
        tier.billing_period = fields['billing_period']
    if 'yearly_price_ghs' in fields:
        val = fields['yearly_price_ghs']
        tier.yearly_price_ghs = max(1.0, min(val, 1000.0)) if val else None
    for perk in ('subscriber_posts', 'early_access_hours', 'badge',
                 'author_notes', 'no_ads', 'priority_comments'):
        if perk in fields:
            setattr(tier, f'perk_{perk}', fields[perk])
    if 'is_active' in fields:
        tier.is_active = fields['is_active']

    db.session.commit()
    return tier, 'updated'


def get_creator_tiers(creator_id, active_only=True):
    """Get all subscription tiers for a creator."""
    from ..models import CreatorSubTier
    q = CreatorSubTier.query.filter_by(creator_id=creator_id)
    if active_only:
        q = q.filter_by(is_active=True)
    return q.order_by(CreatorSubTier.sort_order).all()


def get_subscriber_count(creator_id):
    """Get total active subscriber count for a creator."""
    from ..models import CreatorSubscription
    return CreatorSubscription.query.filter_by(
        creator_id=creator_id, status='active'
    ).count()


def tier_to_dict(tier):
    """Serialize a CreatorSubTier to dict."""
    return {
        'id': tier.id,
        'creator_id': tier.creator_id,
        'name': tier.name,
        'description': tier.description,
        'price_ghs': tier.price_ghs,
        'billing_period': getattr(tier, 'billing_period', 'monthly') or 'monthly',
        'yearly_price_ghs': getattr(tier, 'yearly_price_ghs', None),
        'perks': {
            'subscriber_posts': bool(tier.perk_subscriber_posts),
            'early_access_hours': tier.perk_early_access_hours or 0,
            'badge': bool(tier.perk_badge),
            'author_notes': bool(tier.perk_author_notes),
            'no_ads': bool(tier.perk_no_ads),
            'priority_comments': bool(tier.perk_priority_comments),
        },
        'is_active': tier.is_active,
        'subscriber_count': tier.subscriptions.count() if hasattr(tier, 'subscriptions') else 0,
    }


def subscription_to_dict(sub):
    """Serialize a CreatorSubscription to dict."""
    from ..models import User
    creator = User.query.filter_by(wiam_id=sub.creator_id).first() or User.query.get(sub.creator_id)
    return {
        'id': sub.id,
        'creator_id': sub.creator_id,
        'creator_name': creator.display_name if creator else 'Unknown',
        'creator_username': creator.username if creator else '',
        'creator_avatar': creator.avatar_url if creator else None,
        'tier': tier_to_dict(sub.tier) if sub.tier else None,
        'status': sub.status,
        'paused_reason': sub.paused_reason,
        'started_at': sub.started_at.isoformat() if sub.started_at else None,
        'expires_at': sub.expires_at.isoformat() if sub.expires_at else None,
        'auto_renew': sub.auto_renew,
    }
