"""
WiamEpisio coin pricing bands.

Creators do not invent arbitrary prices. They pick a band (or Origin/VIP
is founder-locked). Episodes inherit series.coin_band unless overridden.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..extensions import db
from ..models import CoinPriceBand, Content, Episode

log = logging.getLogger(__name__)

DEFAULT_BANDS = [
    {'band_key': 'standard', 'label': 'Standard', 'unlock_coins': 8, 'min_coins': 5, 'max_coins': 12, 'sort_order': 1},
    {'band_key': 'premium', 'label': 'Premium', 'unlock_coins': 12, 'min_coins': 10, 'max_coins': 18, 'sort_order': 2},
    {'band_key': 'origin', 'label': 'Wiam Origin', 'unlock_coins': 15, 'min_coins': 12, 'max_coins': 25, 'sort_order': 3},
    {'band_key': 'vip', 'label': 'VIP', 'unlock_coins': 20, 'min_coins': 15, 'max_coins': 30, 'sort_order': 4},
]


def ensure_default_bands():
    for row in DEFAULT_BANDS:
        existing = CoinPriceBand.query.filter_by(band_key=row['band_key']).first()
        if existing:
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
        'unlock_coins': b.unlock_coins,
        'min_coins': b.min_coins,
        'max_coins': b.max_coins,
        'is_active': bool(b.is_active),
        'sort_order': b.sort_order,
    } for b in rows]


def resolve_unlock_coins(content: Content, episode: Optional[Episode] = None) -> int:
    """Episode override > series band > default 10."""
    if episode is not None and episode.unlock_price_coins and int(episode.unlock_price_coins) > 0:
        # If still at generic default and series has a band, prefer band
        band = get_band(getattr(content, 'coin_band', None) or 'standard')
        if band and int(episode.unlock_price_coins) == 10 and band.unlock_coins != 10:
            return int(band.unlock_coins)
        return int(episode.unlock_price_coins)
    band = get_band(getattr(content, 'coin_band', None) or 'standard')
    return int(band.unlock_coins) if band else 10


def apply_band_to_unpublished_episodes(content: Content) -> int:
    """Stamp unlock_price_coins from series band onto unpublished episodes."""
    band = get_band(getattr(content, 'coin_band', None) or 'standard')
    if not band:
        return 0
    price = int(band.unlock_coins)
    updated = 0
    for ep in Episode.query.filter_by(content_id=content.id, published=False).all():
        ep.unlock_price_coins = price
        updated += 1
    return updated
