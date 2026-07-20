"""
Episio genre catalog — founder-managed, not hardcoded in the app.

product:
  episio  = short-drama genres (Studio create, Home, onboarding, search)
  legacy  = old novel-era rows (parked Text Edition; hidden from Episio by default)
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import func as sa_func

from ..extensions import db
from ..models import Genre

log = logging.getLogger(__name__)

# Drama taxonomy for WiamEpisio (global — not Africa-only labels)
EPISIO_GENRES = [
    'Drama',
    'Romance',
    'Revenge',
    'Hidden Identity',
    'Royal & Palace',
    'Family Feud',
    'Comedy',
    'Thriller',
    'Action',
    'Fantasy',
    'Anime',
    'Coming of Age',
]


def ensure_genre_columns():
    """Additive columns if missing (also covered by _run_safe_migrations)."""
    try:
        db.session.execute(db.text(
            "ALTER TABLE genres ADD COLUMN IF NOT EXISTS product TEXT DEFAULT 'legacy'"
        ))
        db.session.execute(db.text(
            "ALTER TABLE genres ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0"
        ))
        db.session.execute(db.text(
            "ALTER TABLE genres ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()


def seed_episio_genres():
    """Idempotent: ensure Episio drama genres exist; mark novel-only rows as legacy."""
    ensure_genre_columns()
    # Mark any existing rows without product as legacy once
    try:
        for g in Genre.query.all():
            product = getattr(g, 'product', None) or 'legacy'
            if not getattr(g, 'product', None):
                g.product = 'legacy'
            # Promote known drama names to episio if still legacy
            if g.name in EPISIO_GENRES and product == 'legacy':
                g.product = 'episio'
                g.is_active = True
        db.session.commit()
    except Exception:
        db.session.rollback()

    for i, name in enumerate(EPISIO_GENRES, start=1):
        existing = Genre.query.filter(sa_func.lower(Genre.name) == name.lower()).first()
        if existing:
            existing.product = 'episio'
            existing.is_active = True if existing.is_active is None else existing.is_active
            existing.sort_order = existing.sort_order or i
            continue
        db.session.add(Genre(
            name=name,
            product='episio',
            sort_order=i,
            is_active=True,
        ))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        log.exception('seed_episio_genres failed')


def list_episio_genres(active_only: bool = True):
    seed_episio_genres()
    q = Genre.query.filter(Genre.product == 'episio')
    if active_only:
        q = q.filter(db.or_(Genre.is_active.is_(True), Genre.is_active.is_(None)))
    rows = q.order_by(Genre.sort_order.asc(), Genre.name.asc()).all()
    return [{
        'id': g.id,
        'name': g.name,
        'product': 'episio',
        'sort_order': int(g.sort_order or 0),
        'is_active': bool(g.is_active if g.is_active is not None else True),
    } for g in rows]


def list_legacy_genres():
    ensure_genre_columns()
    rows = Genre.query.filter(
        db.or_(Genre.product == 'legacy', Genre.product.is_(None))
    ).order_by(Genre.name.asc()).all()
    return [{'id': g.id, 'name': g.name, 'product': 'legacy'} for g in rows]


def add_genre(name: str, product: str = 'episio') -> Genre:
    name = (name or '').strip()
    if not name:
        raise ValueError('name_required')
    product = (product or 'episio').lower()
    if product not in ('episio', 'legacy'):
        product = 'episio'
    existing = Genre.query.filter(sa_func.lower(Genre.name) == name.lower()).first()
    if existing:
        existing.product = product
        existing.is_active = True
        db.session.commit()
        return existing
    max_sort = db.session.query(db.func.max(Genre.sort_order)).scalar() or 0
    g = Genre(name=name, product=product, sort_order=int(max_sort) + 1, is_active=True)
    db.session.add(g)
    db.session.commit()
    return g
