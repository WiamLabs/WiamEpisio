"""
Monetization services — eligibility checker + monthly payout processor.

These functions are designed to be called:
  - By a scheduled job (e.g. cron, APScheduler, or scheduled task)
  - Or manually via admin route / CLI command
"""
import logging
import requests
from datetime import datetime, timedelta
from flask import current_app

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Monetization Eligibility Checker
# ---------------------------------------------------------------------------

ELIGIBILITY_REQUIREMENTS = {
    'min_account_age_days': 30,
    'min_published_stories': 1,
    'min_chapters_in_story': 10,
    'min_unique_readers': 500,
    'min_followers': 100,
    'min_avg_rating': 3.5,
    'min_rating_count': 20,
    'max_violations_60d': 0,
    'min_trust_score': 50,
}


def check_creator_eligibility(creator_id):
    """
    Evaluate a single creator's monetization eligibility.
    Updates MonetizationStatus row.  Returns (is_eligible, status_obj).
    """
    from ..extensions import db
    from ..models import (
        MonetizationStatus, Content, User, Follow, Rating,
        ReadingProgress, WebBookContent,
    )
    from sqlalchemy import func

    user = User.query.filter_by(wiam_id=creator_id).first()
    if not user or not user.is_creator:
        return False, None

    now = datetime.utcnow()

    # Account age
    account_age_days = (now - user.created_at).days if user.created_at else 0

    # Published stories
    published = Content.query.filter(
        Content.creator_wiam_id == creator_id,
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at == None,
    ).all()
    story_count = len(published)
    book_ids = [b.id for b in published]

    # Max chapters in any single story
    max_chapters = 0
    for bid in book_ids:
        ch_count = WebBookContent.query.filter_by(content_id=bid).count()
        if ch_count > max_chapters:
            max_chapters = ch_count

    # Unique readers (from ReadingProgress)
    total_readers = 0
    if book_ids:
        total_readers = db.session.query(
            func.count(func.distinct(ReadingProgress.user_id))
        ).filter(ReadingProgress.content_id.in_(book_ids)).scalar() or 0

    # Followers
    followers = Follow.query.filter_by(creator_id=user.id).count()

    # Ratings
    avg_rating = 0.0
    rating_count = 0
    if book_ids:
        rating_agg = db.session.query(
            func.avg(Rating.rating), func.count(Rating.id)
        ).filter(Rating.content_id.in_(book_ids)).first()
        avg_rating = float(rating_agg[0] or 0)
        rating_count = int(rating_agg[1] or 0)

    # Violations in last 60 days (from UserWarning system)
    violations_60d = 0
    try:
        from ..models import UserWarning
        cutoff_60 = now - timedelta(days=60)
        violations_60d = UserWarning.query.filter(
            UserWarning.user_id == user.id,
            UserWarning.severity.in_(['warning', 'strike']),
            UserWarning.created_at >= cutoff_60,
        ).count()
    except Exception:
        pass

    # Trust score (from trust engine — 0.0-1.0 scaled to 0-100)
    try:
        from .trust_engine import compute_reader_trust
        trust_score = int(compute_reader_trust(user.id, save=True) * 100)
    except Exception:
        trust_score = min(100, 50 + (story_count * 5) + (followers // 10))

    # Evaluate eligibility
    reqs = ELIGIBILITY_REQUIREMENTS
    is_eligible = (
        account_age_days >= reqs['min_account_age_days']
        and story_count >= reqs['min_published_stories']
        and max_chapters >= reqs['min_chapters_in_story']
        and total_readers >= reqs['min_unique_readers']
        and followers >= reqs['min_followers']
        and rating_count >= reqs['min_rating_count']
        and avg_rating >= reqs['min_avg_rating']
        and violations_60d <= reqs['max_violations_60d']
        and trust_score >= reqs['min_trust_score']
    )

    # Update or create status
    status = MonetizationStatus.query.get(creator_id)
    if not status:
        status = MonetizationStatus(creator_id=creator_id)
        db.session.add(status)

    was_eligible = status.is_eligible
    status.is_eligible = is_eligible
    status.cached_account_age_days = account_age_days
    status.cached_story_count = story_count
    status.cached_max_chapters = max_chapters
    status.cached_total_readers = total_readers
    status.cached_followers = followers
    status.cached_avg_rating = round(avg_rating, 2)
    status.cached_rating_count = rating_count
    status.cached_violations_60d = violations_60d
    status.cached_trust_score = trust_score
    status.last_checked = now

    if is_eligible and not was_eligible:
        status.eligible_since = now
        status.revoked_at = None
        status.revoke_reason = None
        log.info("Creator %s is now ELIGIBLE for monetization", creator_id)
        # Send branded eligibility email
        try:
            if user and getattr(user, 'email', None):
                from .email_service import send_creator_eligible_email
                send_creator_eligible_email(user.email, user.display_name)
        except Exception as e:
            log.warning("Failed to send eligibility email to creator %s: %s", creator_id, e)
    elif not is_eligible and was_eligible:
        status.revoked_at = now
        status.revoke_reason = 'No longer meets requirements'
        log.info("Creator %s monetization REVOKED", creator_id)

    db.session.commit()
    return is_eligible, status


def run_eligibility_check_all():
    """Check eligibility for ALL creators. Call from scheduled job."""
    from ..models import User
    creators = User.query.filter_by(is_creator=True).all()
    results = {'checked': 0, 'eligible': 0, 'ineligible': 0}
    for creator in creators:
        try:
            eligible, _ = check_creator_eligibility(creator.wiam_id)
            results['checked'] += 1
            if eligible:
                results['eligible'] += 1
            else:
                results['ineligible'] += 1
        except Exception as e:
            log.error("Error checking eligibility for %s: %s", creator.wiam_id, e)
    log.info("Eligibility check complete: %s", results)
    return results


# ---------------------------------------------------------------------------
# Monthly Payout Processor (Paystack Transfer API)
# ---------------------------------------------------------------------------

COIN_TO_GHS = 0.05
COIN_TO_USD = 0.01  # 100 coins = $1.00 USD (internal base currency)

COIN_PACKAGES = [
    {'coins': 100, 'bonus': 0, 'price_ghs': 5.00, 'label': '100 Coins'},
    {'coins': 300, 'bonus': 20, 'price_ghs': 12.00, 'label': '300 Coins'},
    {'coins': 500, 'bonus': 50, 'price_ghs': 18.00, 'label': '500 Coins'},
    {'coins': 1000, 'bonus': 150, 'price_ghs': 30.00, 'label': '1,000 Coins'},
]


def _get_payout_config():
    """Get payout settings from PlatformConfig (dynamic, not hardcoded)."""
    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    return {
        'min_payout_ghs': cfg.min_payout_ghs,
        'creator_share_pct': cfg.creator_revenue_pct,
    }


def _get_or_create_recipient(settings):
    """Get cached Paystack recipient code, or create one and cache it."""
    if settings.paystack_recipient_code:
        return settings.paystack_recipient_code, None

    code, err = _paystack_create_transfer_recipient(
        settings.provider, settings.account_number, settings.account_name
    )
    if code:
        from ..extensions import db
        settings.paystack_recipient_code = code
        db.session.commit()
        log.info("Cached recipient code %s for creator %s", code, settings.creator_id)
    return code, err


def _paystack_create_transfer_recipient(provider, account_number, account_name):
    """Create a Paystack Transfer Recipient for Mobile Money."""
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        return None, 'Paystack not configured'

    # Map provider to Paystack bank codes for Ghana MoMo
    provider_map = {
        'MTN': 'MTN',
        'Vodafone': 'VOD',
        'AirtelTigo': 'ATL',
    }

    payload = {
        'type': 'mobile_money',
        'name': account_name,
        'account_number': account_number,
        'bank_code': provider_map.get(provider, 'MTN'),
        'currency': 'GHS',
    }

    try:
        resp = requests.post(
            'https://api.paystack.co/transferrecipient',
            json=payload,
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        data = resp.json()
        if data.get('status'):
            return data['data']['recipient_code'], None
        return None, data.get('message', 'Unknown error')
    except Exception as e:
        log.error("Paystack create recipient error: %s", e)
        return None, str(e)


def _paystack_initiate_transfer(recipient_code, amount_pesewas, reference, reason=''):
    """Initiate a Paystack transfer."""
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        return None, 'Paystack not configured'

    payload = {
        'source': 'balance',
        'amount': amount_pesewas,
        'recipient': recipient_code,
        'reason': reason or 'WiamApp creator payout',
        'currency': 'GHS',
        'reference': reference,
    }

    try:
        resp = requests.post(
            'https://api.paystack.co/transfer',
            json=payload,
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        data = resp.json()
        if data.get('status'):
            return data['data'], None
        return None, data.get('message', 'Transfer failed')
    except Exception as e:
        log.error("Paystack transfer error: %s", e)
        return None, str(e)


def process_monthly_payouts(year=None, month=None):
    """
    Process payouts for all eligible creators for a given month.
    Accumulates rolled-over earnings from previous months.
    Typically called on the 1st of the following month.
    """
    from ..extensions import db
    from ..models import CreatorEarnings, CreatorPayout, CreatorPayoutSettings
    from sqlalchemy import func
    import uuid

    cfg = _get_payout_config()
    min_payout = cfg['min_payout_ghs']

    now = datetime.utcnow()
    if year is None or month is None:
        first_of_this_month = now.replace(day=1)
        prev_month = first_of_this_month - timedelta(days=1)
        year = prev_month.year
        month = prev_month.month

    log.info("Processing payouts for %d-%02d (min GHS %.2f)", year, month, min_payout)

    # Find all unpaid earnings up to and including this month (handles roll-overs)
    unpaid = CreatorEarnings.query.filter(
        CreatorEarnings.is_paid == False,
        (CreatorEarnings.year < year) |
        ((CreatorEarnings.year == year) & (CreatorEarnings.month <= month))
    ).all()

    # Group by creator
    creator_earnings = {}
    for earn in unpaid:
        cid = earn.creator_id
        if cid not in creator_earnings:
            creator_earnings[cid] = []
        creator_earnings[cid].append(earn)

    results = {'processed': 0, 'paid': 0, 'below_minimum': 0, 'failed': 0, 'no_settings': 0}

    for cid, earn_list in creator_earnings.items():
        results['processed'] += 1
        total_ghs = sum(e.creator_share_ghs for e in earn_list)
        total_coins = sum(e.total_coins for e in earn_list)

        # Below minimum — mark as rolled over
        if total_ghs < min_payout:
            for e in earn_list:
                e.rolled_over = True
            results['below_minimum'] += 1
            log.info("Creator %s: GHS %.2f below min (%.2f), rolling over",
                     cid, total_ghs, min_payout)
            db.session.commit()
            continue

        # Get payout settings
        settings = CreatorPayoutSettings.query.get(cid)
        if not settings or not settings.account_number:
            results['no_settings'] += 1
            log.warning("Creator %s: no payout settings, skipping", cid)
            continue

        # Create payout record
        ref = f'wiam-payout-{cid}-{year}{month:02d}-{uuid.uuid4().hex[:8]}'
        payout = CreatorPayout(
            creator_id=cid,
            amount_ghs=total_ghs,
            total_coins=total_coins,
            year=year,
            month=month,
            status='pending',
            paystack_reference=ref,
        )
        db.session.add(payout)
        db.session.flush()

        # Get or create Paystack transfer recipient (cached)
        recipient_code, err = _get_or_create_recipient(settings)
        if err:
            payout.status = 'failed'
            payout.failure_reason = f'Recipient error: {err}'
            results['failed'] += 1
            log.error("Creator %s: recipient creation failed: %s", cid, err)
            db.session.commit()
            continue

        # Initiate transfer
        amount_pesewas = int(total_ghs * 100)
        transfer_data, err = _paystack_initiate_transfer(
            recipient_code, amount_pesewas, ref,
            reason=f'WiamApp creator payout for {year}-{month:02d}'
        )
        if err:
            payout.status = 'failed'
            payout.failure_reason = f'Transfer error: {err}'
            results['failed'] += 1
            log.error("Creator %s: transfer failed: %s", cid, err)
            db.session.commit()
            continue

        # Success — mark all accumulated earnings as paid
        payout.status = 'processing'
        payout.paystack_transfer_code = transfer_data.get('transfer_code', '')
        payout.provider = settings.provider
        for e in earn_list:
            e.is_paid = True
            e.rolled_over = False
        results['paid'] += 1
        log.info("Creator %s: payout GHS %.2f initiated (ref=%s, %d months)",
                 cid, total_ghs, ref, len(earn_list))
        db.session.commit()

        # Send branded payout email
        try:
            from ..models import User
            creator = User.query.filter_by(wiam_id=cid).first()
            if creator and getattr(creator, 'email', None):
                from .email_service import send_payout_email
                send_payout_email(
                    creator.email, creator.display_name,
                    f'{total_ghs:.2f}', 'GHS',
                    f'{year}-{month:02d}'
                )
        except Exception as e:
            log.warning("Failed to send payout email to %s: %s", cid, e)

    log.info("Payout processing complete: %s", results)
    return results


def retry_failed_payout(payout_id):
    """Retry a single failed payout."""
    from ..extensions import db
    from ..models import CreatorPayout, CreatorPayoutSettings
    import uuid

    payout = CreatorPayout.query.get(payout_id)
    if not payout or payout.status != 'failed':
        return False, 'Payout not found or not failed'

    settings = CreatorPayoutSettings.query.get(payout.creator_id)
    if not settings or not settings.account_number:
        return False, 'No payout settings for this creator'

    # New reference for retry
    ref = f'wiam-retry-{payout.creator_id}-{uuid.uuid4().hex[:8]}'
    payout.paystack_reference = ref
    payout.failure_reason = None

    recipient_code, err = _get_or_create_recipient(settings)
    if err:
        payout.failure_reason = f'Recipient error (retry): {err}'
        db.session.commit()
        return False, err

    amount_pesewas = int(payout.amount_ghs * 100)
    transfer_data, err = _paystack_initiate_transfer(
        recipient_code, amount_pesewas, ref,
        reason=f'WiamApp payout retry for {payout.year}-{payout.month:02d}'
    )
    if err:
        payout.failure_reason = f'Transfer error (retry): {err}'
        db.session.commit()
        return False, err

    payout.status = 'processing'
    payout.paystack_transfer_code = transfer_data.get('transfer_code', '')
    payout.provider = settings.provider
    db.session.commit()
    log.info("Retry payout %d for creator %s: GHS %.2f (ref=%s)",
             payout_id, payout.creator_id, payout.amount_ghs, ref)
    return True, 'Transfer initiated'
