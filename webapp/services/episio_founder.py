"""Shared helpers for Episio founder HTML + JSON control surfaces."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, or_

from ..extensions import db
from ..models import (
    User, Content, Episode, EpisodeUnlock, CoinBalance, CoinTransaction,
    PlatformConfig, FeaturedTrailerSlot, CoinPriceBand,
    EpisioCreatorInvite, EpisioCreatorInviteRedemption,
    EpisioCreatorApplication, EpisioCreatorPublicProfile,
    SeasonQualityJob, PremiumSubscription,
)

log = logging.getLogger(__name__)


def _safe(default, fn):
    try:
        return fn()
    except Exception:
        db.session.rollback()
        log.exception('episio_founder helper failed')
        return default


def overview_stats():
    """KPIs for Episio founder home."""
    from .coin_pricing import ensure_default_bands

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    def drama_q():
        return Content.query.filter(
            Content.deleted_at.is_(None),
            or_(Content.format == 'drama', Content.format == 'anime', Content.type == 'drama'),
        )

    stats = {
        'watchers': _safe(0, lambda: User.query.filter(~User.status.in_(['deleted', 'deactivated'])).count()),
        'creators': _safe(0, lambda: User.query.filter(
            or_(User.role.in_(['creator', 'founder']), User.creator_application_status == 'approved')
        ).count()),
        'live_series': _safe(0, lambda: drama_q().filter(
            Content.status.in_(getattr(Content, 'PUBLISHED_STATUSES', ['published', 'live']) or ['published'])
        ).count()),
        'all_series': _safe(0, lambda: drama_q().count()),
        'pending_qc': _safe(0, lambda: SeasonQualityJob.query.filter(
            SeasonQualityJob.status.in_(['queued', 'running', 'borderline'])
        ).count()),
        'pending_applications': _safe(0, lambda: EpisioCreatorApplication.query.filter_by(status='pending').count()),
        'active_invites': _safe(0, lambda: EpisioCreatorInvite.query.filter_by(active=True).count()),
        'coins_circulating': _safe(0, lambda: db.session.query(
            func.coalesce(func.sum(CoinBalance.balance), 0)
        ).scalar() or 0),
        'coin_purchases_month': _safe(0, lambda: CoinTransaction.query.filter(
            CoinTransaction.type == 'purchase',
            CoinTransaction.created_at >= month_start,
        ).count()),
        'vip_active': _safe(0, lambda: PremiumSubscription.query.filter_by(status='active').count()),
    }
    try:
        ensure_default_bands()
    except Exception:
        db.session.rollback()
    return stats


def list_drama_series(status=None, q=None, limit=80):
    query = Content.query.filter(
        Content.deleted_at.is_(None),
        or_(Content.format.in_(['drama', 'anime']), Content.type == 'drama'),
    )
    if status:
        query = query.filter(Content.status == status)
    if q:
        like = f'%{q}%'
        query = query.filter(or_(Content.title.ilike(like), Content.author.ilike(like)))
    return query.order_by(Content.id.desc()).limit(limit).all()


def series_episodes(content_id):
    return (
        Episode.query.filter_by(content_id=content_id)
        .order_by(Episode.episode_number.asc())
        .all()
    )


def set_series_flags(content: Content, *, is_wiam_origin=None, is_vip_series=None,
                     catalog_shelf=None, coin_band=None, status=None):
    from .coin_pricing import apply_band_to_unpublished_episodes
    if is_wiam_origin is not None:
        content.is_wiam_origin = bool(is_wiam_origin)
        if content.is_wiam_origin:
            content.catalog_shelf = 'origin'
            content.coin_band = coin_band or 'origin'
    if is_vip_series is not None:
        content.is_vip_series = bool(is_vip_series)
        if content.is_vip_series:
            content.catalog_shelf = 'vip'
            content.coin_band = coin_band or 'vip'
    if catalog_shelf is not None:
        content.catalog_shelf = str(catalog_shelf).lower()
    if coin_band is not None:
        content.coin_band = str(coin_band).lower()
    if status is not None:
        content.status = status
    apply_band_to_unpublished_episodes(content)
    db.session.commit()
    return content


def publish_whole_unit(content: Content, publish=True):
    """Publish or unpublish entire series unit (all episodes)."""
    eps = series_episodes(content.id)
    if publish:
        content.status = 'published'
        content.published_at = content.published_at or datetime.utcnow()
        for ep in eps:
            ep.published = True
            if not ep.publish_at:
                ep.publish_at = datetime.utcnow()
    else:
        content.status = 'draft'
        for ep in eps:
            ep.published = False
    db.session.commit()
    return content


def create_invite(*, created_by, code=None, note='', max_uses=1, expires_days=None):
    """One-time invite — expires after first use so it cannot be shared widely."""
    raw = (code or '').strip().upper().replace(' ', '')
    if not raw:
        raw = f'WIAM-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}'
    if EpisioCreatorInvite.query.filter_by(code=raw).first():
        raise ValueError('Code already exists')
    expires = None
    if expires_days is not None and str(expires_days).strip() != '':
        expires = datetime.utcnow() + timedelta(days=max(1, int(expires_days)))
    inv = EpisioCreatorInvite(
        code=raw,
        created_by=created_by,
        note=(note or '')[:500],
        max_uses=1,  # always single-use
        expires_at=expires,
        active=True,
    )
    db.session.add(inv)
    db.session.commit()
    return inv


def revoke_invite(invite_id):
    inv = EpisioCreatorInvite.query.get(invite_id)
    if not inv:
        return None
    inv.active = False
    db.session.commit()
    return inv


def decide_application(app_id, *, founder, decision, note=''):
    from .creator_activation import finalize_creator_upgrade
    app_row = EpisioCreatorApplication.query.get(app_id)
    if not app_row:
        raise ValueError('not_found')
    decision = (decision or '').strip().lower()
    if decision not in ('accepted', 'rejected'):
        raise ValueError('decision must be accepted or rejected')
    app_row.status = decision
    app_row.reviewer_note = (note or '')[:2000]
    app_row.decided_by = founder.wiam_id or founder.id
    app_row.decided_at = datetime.utcnow()
    if decision == 'accepted':
        user = User.query.filter(
            or_(User.id == app_row.user_id, User.wiam_id == app_row.user_id)
        ).first()
        if user and not user.is_creator:
            try:
                finalize_creator_upgrade(user, pen_name_hint=app_row.channel_name or user.username)
            except Exception as exc:
                log.warning('finalize_creator_upgrade failed: %s', exc)
                if user.role not in ('founder', 'admin'):
                    user.role = 'creator'
                user.creator_application_status = 'approved'
    db.session.commit()
    return app_row


def unlock_studio_for_user(user: User, channel_hint=''):
    user.role = 'creator' if user.role not in ('founder', 'admin') else user.role
    user.creator_application_status = 'approved'
    uid = user.wiam_id or user.id
    prof = EpisioCreatorPublicProfile.query.filter_by(user_id=uid).first()
    if not prof:
        prof = EpisioCreatorPublicProfile(
            user_id=uid,
            channel_name=(channel_hint or user.display_name or user.username or '')[:80],
        )
        db.session.add(prof)
    db.session.commit()
    return user


def adjust_coins(user_id, delta, *, reason='founder_adjust', founder_id=None):
    user = User.query.get(user_id)
    if not user:
        raise ValueError('user_not_found')
    bal = CoinBalance.query.get(user.id)
    if not bal:
        bal = CoinBalance(user_id=user.id, balance=0, total_purchased=0, total_spent=0)
        db.session.add(bal)
        db.session.flush()
    delta = int(delta)
    bal.balance = int(bal.balance or 0) + delta
    if delta > 0:
        bal.total_purchased = int(bal.total_purchased or 0) + delta
    else:
        bal.total_spent = int(bal.total_spent or 0) + abs(delta)
    tx = CoinTransaction(
        user_id=user.wiam_id or user.id,
        type='bonus' if delta >= 0 else 'refund',
        amount=delta,
        balance_after=int(bal.balance),
        description=(reason or 'founder_adjust')[:200],
        reference=f'founder:{founder_id}' if founder_id else 'founder',
    )
    db.session.add(tx)
    db.session.commit()
    return bal.balance


def user_unlocks(user, limit=40):
    uid = user.wiam_id or user.id
    return (
        EpisodeUnlock.query.filter(
            or_(EpisodeUnlock.user_id == uid, EpisodeUnlock.user_id == user.id)
        )
        .order_by(EpisodeUnlock.id.desc())
        .limit(limit)
        .all()
    )


def list_invites(limit=100):
    return EpisioCreatorInvite.query.order_by(EpisioCreatorInvite.id.desc()).limit(limit).all()


def list_applications(status='pending', limit=100):
    q = EpisioCreatorApplication.query
    if status and status != 'all':
        q = q.filter_by(status=status)
    return q.order_by(EpisioCreatorApplication.id.desc()).limit(limit).all()


def list_featured(slot_key=None, limit=200):
    q = FeaturedTrailerSlot.query
    if slot_key:
        q = q.filter_by(slot_key=slot_key)
    return q.order_by(FeaturedTrailerSlot.slot_key.asc(), FeaturedTrailerSlot.sort_order.asc()).limit(limit).all()


def add_featured(*, content_id, slot_key='home_featured', sort_order=0, note='',
                 badge_label='', media_mode='trailer', curated_by=None):
    c = Content.query.get(int(content_id))
    if not c:
        raise ValueError('series_not_found')
    mode = (media_mode or 'trailer').lower()
    if mode not in ('trailer', 'image'):
        mode = 'trailer'
    label = (badge_label or '').strip()[:40]
    slot = FeaturedTrailerSlot(
        slot_key=(slot_key or 'home_featured').lower(),
        content_id=int(content_id),
        sort_order=int(sort_order or 0),
        is_active=True,
        curated_by=curated_by,
        note=(note or '')[:500],
        badge_label=label,
        media_mode=mode,
    )
    db.session.add(slot)
    db.session.commit()
    return slot


def delete_featured(slot_id):
    slot = FeaturedTrailerSlot.query.get(slot_id)
    if slot:
        db.session.delete(slot)
        db.session.commit()
    return slot


def get_flags():
    cfg = PlatformConfig.get()
    keys = (
        'ff_trailer_quality_gate', 'ff_require_complete_series', 'ff_vip_enabled',
        'ff_season_quality_pipeline', 'ff_season_qc_auto_reject_poor',
        'ff_season_qc_auto_clear_good', 'ff_season_qc_sla_auto_decide',
    )
    out = {k: bool(getattr(cfg, k, False)) for k in keys}
    out['vip_daily_stipend_coins'] = int(getattr(cfg, 'vip_daily_stipend_coins', 30) or 30)
    out['vip_unlock_discount_pct'] = float(getattr(cfg, 'vip_unlock_discount_pct', 25) or 25)
    out['money_base_currency'] = (cfg.money_base_currency or 'USD')
    return out, cfg


def save_flags(form_data: dict):
    cfg = PlatformConfig.get()
    bool_keys = (
        'ff_trailer_quality_gate', 'ff_require_complete_series', 'ff_vip_enabled',
        'ff_season_quality_pipeline', 'ff_season_qc_auto_reject_poor',
        'ff_season_qc_auto_clear_good', 'ff_season_qc_sla_auto_decide',
    )
    for k in bool_keys:
        setattr(cfg, k, form_data.get(k) == 'on' or form_data.get(k) is True)
    if 'vip_daily_stipend_coins' in form_data and str(form_data['vip_daily_stipend_coins']).strip() != '':
        cfg.vip_daily_stipend_coins = int(form_data['vip_daily_stipend_coins'])
    if 'vip_unlock_discount_pct' in form_data and str(form_data['vip_unlock_discount_pct']).strip() != '':
        cfg.vip_unlock_discount_pct = float(form_data['vip_unlock_discount_pct'])
    if form_data.get('money_base_currency'):
        cfg.money_base_currency = str(form_data['money_base_currency']).upper()[:8]
    cfg.updated_at = datetime.utcnow()
    db.session.commit()
    return cfg
