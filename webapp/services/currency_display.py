"""
Money is accounted in USD on the backend.

- Coin packages store price_usd_cents (and legacy price_ghs).
- Ledger / analytics can report USD.
- Clients send Accept-Currency or ?currency=GHS to get local display amounts.
Coins themselves are platform units, not fiat.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from ..extensions import db
from ..models import FxRate, CoinPackage

DEFAULT_RATES = [
    {'currency_code': 'USD', 'rate_per_usd': 1.0, 'symbol': '$'},
    {'currency_code': 'GHS', 'rate_per_usd': 15.5, 'symbol': 'GH₵'},
    {'currency_code': 'NGN', 'rate_per_usd': 1600.0, 'symbol': '₦'},
    {'currency_code': 'KES', 'rate_per_usd': 129.0, 'symbol': 'KSh'},
    {'currency_code': 'ZAR', 'rate_per_usd': 18.5, 'symbol': 'R'},
    {'currency_code': 'EUR', 'rate_per_usd': 0.92, 'symbol': '€'},
    {'currency_code': 'GBP', 'rate_per_usd': 0.79, 'symbol': '£'},
]


def ensure_default_fx():
    for row in DEFAULT_RATES:
        if FxRate.query.filter_by(currency_code=row['currency_code']).first():
            continue
        db.session.add(FxRate(**row, updated_at=datetime.utcnow()))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()


def get_fx(currency_code: str) -> Optional[FxRate]:
    ensure_default_fx()
    code = (currency_code or 'USD').upper().strip()
    return FxRate.query.filter_by(currency_code=code).first() or FxRate.query.filter_by(currency_code='USD').first()


def usd_cents_to_local(usd_cents: int, currency_code: str) -> dict:
    fx = get_fx(currency_code)
    rate = float(fx.rate_per_usd) if fx else 1.0
    usd = (usd_cents or 0) / 100.0
    local = round(usd * rate, 2)
    return {
        'currency': fx.currency_code if fx else 'USD',
        'symbol': fx.symbol if fx else '$',
        'amount': local,
        'amount_minor': int(round(local * 100)),
        'usd_cents': int(usd_cents or 0),
        'usd': round(usd, 2),
        'rate_per_usd': rate,
    }


def package_display(pkg: CoinPackage, currency_code: str = 'USD') -> dict:
    usd_cents = int(pkg.price_usd_cents or 0)
    if usd_cents <= 0 and pkg.price_ghs:
        # legacy fallback: approximate from GHS via FX table
        ghs = get_fx('GHS')
        rate = float(ghs.rate_per_usd) if ghs else 15.5
        usd_cents = int(round((float(pkg.price_ghs) / rate) * 100))
    local = usd_cents_to_local(usd_cents, currency_code)
    return {
        'id': pkg.id,
        'coins': pkg.coins,
        'bonus_coins': pkg.bonus_coins or 0,
        'total_coins': pkg.total_coins,
        'label': pkg.label or '',
        'store_product_id': pkg.store_product_id,
        'price_usd_cents': usd_cents,
        'display': local,
    }


def list_packages_for_currency(currency_code: str = 'USD'):
    pkgs = CoinPackage.query.filter_by(is_active=True).order_by(CoinPackage.sort_order.asc()).all()
    return [package_display(p, currency_code) for p in pkgs]
