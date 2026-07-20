"""
Automatic creator payouts at ~02:00 in each creator's local timezone.

Rules (founder product law):
- Run when local hour == 2 (AM), not afternoon.
- Only pay if unpaid earnings ≥ minimum threshold for the month.
- If under threshold, roll forward (gather) until next month's check.
- Keep a retention hold on the wallet (not disclosed in creator UI).
- Bank transfer path only for mobile Studio KYC (no MoMo in Expo).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from ..extensions import db
from ..models import (
    PlatformConfig, CreatorEarnings, CreatorPayout, CreatorPayoutSettings, User,
)

log = logging.getLogger(__name__)

# Default retention: leave this fraction unpaid so balance stays sticky
DEFAULT_RETENTION_PCT = 15.0
# Fallback country → IANA timezone
COUNTRY_TZ = {
    'GH': 'Africa/Accra', 'Ghana': 'Africa/Accra',
    'NG': 'Africa/Lagos', 'Nigeria': 'Africa/Lagos',
    'KE': 'Africa/Nairobi', 'Kenya': 'Africa/Nairobi',
    'ZA': 'Africa/Johannesburg', 'South Africa': 'Africa/Johannesburg',
    'US': 'America/New_York', 'USA': 'America/New_York', 'United States': 'America/New_York',
    'GB': 'Europe/London', 'UK': 'Europe/London', 'United Kingdom': 'Europe/London',
    'DE': 'Europe/Berlin', 'FR': 'Europe/Paris', 'IN': 'Asia/Kolkata',
    'AE': 'Asia/Dubai', 'EG': 'Africa/Cairo', 'BR': 'America/Sao_Paulo',
    'CA': 'America/Toronto', 'AU': 'Australia/Sydney', 'JP': 'Asia/Tokyo',
}


def _tz_for_creator(user: Optional[User], settings: Optional[CreatorPayoutSettings]) -> ZoneInfo:
    raw = None
    if settings and getattr(settings, 'timezone', None):
        raw = settings.timezone
    if not raw and user:
        raw = COUNTRY_TZ.get(getattr(user, 'country', None) or '') or COUNTRY_TZ.get(
            getattr(user, 'account_region', None) or ''
        )
    try:
        return ZoneInfo(raw or 'UTC')
    except Exception:
        return ZoneInfo('UTC')


def _is_local_2am(tz: ZoneInfo, now_utc: Optional[datetime] = None) -> bool:
    now = now_utc or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(tz)
    return local.hour == 2


def run_automatic_payouts(force: bool = False, now_utc: Optional[datetime] = None):
    """
    Pay eligible creators whose local time is 02:00 (or force=True for founder/cron test).
    Returns summary dict.
    """
    from .monetization import _get_payout_config

    cfg = _get_payout_config()
    min_payout = float(cfg.get('min_payout_ghs') or 15.0)
    plat = PlatformConfig.get()
    retention_pct = float(getattr(plat, 'creator_payout_retention_pct', None) or DEFAULT_RETENTION_PCT)
    retention_pct = max(0.0, min(50.0, retention_pct))

    now = now_utc or datetime.utcnow()
    year, month = now.year, now.month

    unpaid = CreatorEarnings.query.filter_by(is_paid=False).all()
    by_creator = {}
    for row in unpaid:
        by_creator.setdefault(row.creator_id, []).append(row)

    paid = 0
    skipped_time = 0
    skipped_min = 0
    skipped_bank = 0

    for cid, rows in by_creator.items():
        user = User.query.filter(
            db.or_(User.wiam_id == cid, User.id == cid)
        ).first()
        settings = CreatorPayoutSettings.query.get(cid)
        tz = _tz_for_creator(user, settings)
        if not force and not _is_local_2am(tz, now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now):
            skipped_time += 1
            continue

        # Suspended / banned creators never auto-pay
        status = (getattr(user, 'status', None) or '').lower() if user else ''
        if status in ('banned', 'suspended', 'frozen', 'deleted'):
            continue

        total_ghs = sum(float(r.creator_share_ghs or 0) for r in rows)
        if total_ghs < min_payout:
            skipped_min += 1
            continue

        if not settings or not (settings.account_number or '').strip():
            skipped_bank += 1
            continue
        # Prefer bank provider for automatic app payouts
        if (settings.provider or '').lower() in ('mtn', 'vodafone', 'airteltigo', 'momo'):
            # Legacy MoMo on file — skip auto until they update to bank in Studio KYC
            skipped_bank += 1
            continue

        pay_amount = round(total_ghs * (1.0 - retention_pct / 100.0), 2)
        if pay_amount <= 0:
            continue

        total_coins = int(sum(int(r.total_coins or 0) for r in rows))
        payout = CreatorPayout(
            creator_id=cid,
            amount_ghs=pay_amount,
            total_coins=max(1, total_coins),
            year=year,
            month=month,
            provider='bank',
            status='pending',
            created_at=datetime.utcnow(),
        )
        db.session.add(payout)

        remaining_hold = round(total_ghs - pay_amount, 2)
        for r in rows:
            r.is_paid = True
            r.updated_at = datetime.utcnow()

        if remaining_hold > 0.01:
            ny, nm = (year, month + 1) if month < 12 else (year + 1, 1)
            carry = CreatorEarnings.query.filter_by(
                creator_id=cid, year=ny, month=nm
            ).first()
            if not carry:
                carry = CreatorEarnings(
                    creator_id=cid, year=ny, month=nm,
                    coins_from_unlocks=0, coins_from_tips=0, total_coins=0,
                )
                db.session.add(carry)
            carry.ghs_value = float(carry.ghs_value or 0) + remaining_hold
            carry.creator_share_ghs = float(carry.creator_share_ghs or 0) + remaining_hold
            carry.is_paid = False
            carry.rolled_over = True
            carry.updated_at = datetime.utcnow()

        paid += 1
        log.info(
            'Auto payout queued creator=%s amount=%.2f retention=%.2f local_tz=%s',
            cid, pay_amount, remaining_hold, str(tz),
        )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        log.exception('auto payout commit failed')
        return {'ok': False, 'error': 'commit_failed'}

    return {
        'ok': True,
        'paid': paid,
        'skipped_time': skipped_time,
        'skipped_min': skipped_min,
        'skipped_bank': skipped_bank,
        'min_payout_ghs': min_payout,
        'retention_pct': retention_pct,
    }
