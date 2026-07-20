"""
WiamEpisio coin pricing.

Law (Martin 2026-07-20): platform charges a flat **10 coins per episode**.
Creators never set unlock price. Episode length does not matter.
CoinPriceBand rows remain for founder reporting / future VIP discounts only —
resolve_unlock_coins always returns PLATFORM_UNLOCK_COINS.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..extensions import db
from ..models import CoinPriceBand, Content, Episode

log = logging.getLogger(__name__)

PLATFORM_UNLOCK_COINS = 10

DEFAULT_BANDS = [
    {'band_key': 'standard', 'label': 'Standard', 'unlock_coins': 10, 'min_coins': 10, 'max_coins': 10, 'sort_order': 1},
    {'band_key': 'premium', 'label': 'Premium', 'unlock_coins': 10, 'min_coins': 10, 'max_coins': 10, 'sort_order': 2},
    {'band_key': 'origin', 'label': 'Wiam Origin', 'unlock_coins': 10, 'min_coins': 10, 'max_coins': 10, 'sort_order': 3},
    {'band_key': 'vip', 'label': 'VIP', 'unlock_coins': 10, 'min_coins': 10, 'max_coins': 10, 'sort_order': 4},
]


def ensure_default_bands():
    for row in DEFAULT_BANDS:
        existing = CoinPriceBand.query.filter_by(band_key=row['band_key']).first()
        if existing:
            # Keep flat-10 law even if older rows had tiered prices
            existing.unlock_coins = PLATFORM_UNLOCK_COINS
            existing.min_coins = PLATFORM_UNLOCK_COINS
            existing.max_coins = PLATFORM_UNLOCK_COINS
            continue
        db.session.add(CoinPriceBand(**row))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()


def get_band(band_key: str) -> Optional[CoinPriceBand]:
    ensure_default_bands()
    return CoinPriceBand.query.filter_by(band_key=(band_key or 'standard'), is_active=True).first()


def list_bands():
    ensure_default_bands()
    rows = CoinPriceBand.query.order_by(CoinPriceBand.sort_order.asc()).all()
    return [{
        'band_key': b.band_key,
        'label': b.label,
        'unlock_coins': PLATFORM_UNLOCK_COINS,
        'min_coins': PLATFORM_UNLOCK_COINS,
        'max_coins': PLATFORM_UNLOCK_COINS,
        'is_active': bool(b.is_active),
        'sort_order': b.sort_order,
        'locked_flat': True,
    } for b in rows]


def resolve_unlock_coins(content: Content = None, episode: Optional[Episode] = None) -> int:
    """Always 10 — platform law. content/episode args kept for call-site compat."""
    return PLATFORM_UNLOCK_COINS


def apply_band_to_unpublished_episodes(content: Content) -> int:
    """Stamp flat platform unlock price onto unpublished episodes."""
    price = PLATFORM_UNLOCK_COINS
    updated = 0
    for ep in Episode.query.filter_by(content_id=content.id, published=False).all():
        ep.unlock_price_coins = price
        updated += 1
    return updated
