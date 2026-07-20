"""
WiamEpisio drama Series / Episode / Watch APIs (Phase 1).

Mounted at /api/v1. \"Series\" here means Content(format='drama') + Episode rows.
Legacy book-list bundles live at /api/v1/story-bundles (studio_v2).
"""
from __future__ import annotations

import logging
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..extensions import db, csrf
from ..models import (
    Content, Episode, WatchProgress, EpisodeUnlock, CoinBalance,
    CreatorEarnings, RevenueRule, User, Follow,
)
from .api_v1 import jwt_required, jwt_optional, _abs_url
from ..services.episode_access import (
    can_watch, ensure_free_unlock_row, free_episode_count_for,
    is_within_free_tier, _uid,
)
from ..services.video_service import get_video_service
from ..services.analytics import track

log = logging.getLogger(__name__)

episode_api = Blueprint('episode_api', __name__, url_prefix='/api/v1')
csrf.exempt(episode_api)


def _drama_filter():
    return Content.query.filter(
        Content.deleted_at.is_(None),
        db.or_(Content.format == 'drama', Content.format == 'Drama'),
    )


def _series_json(c: Content, user=None):
    ep_count = Episode.query.filter_by(content_id=c.id, published=True).count()
    free_n = free_episode_count_for(c)
    poster = getattr(c, 'poster_url', None) or c.cover_url
    try:
        from ..services.coin_pricing import resolve_unlock_coins
        band_price = resolve_unlock_coins(c)
    except Exception:
        band_price = 10
    creator_user = User.query.filter_by(wiam_id=c.creator_wiam_id).first() if c.creator_wiam_id else None
    creator_user_id = creator_user.id if creator_user else None
    is_following = False
    if user and creator_user_id:
        is_following = Follow.query.filter_by(
            user_id=user.id, creator_id=creator_user_id
        ).first() is not None
    return {
        'id': c.id,
        'title': c.title,
        'description': c.description or '',
        'genre': c.genre or '',
        'format': getattr(c, 'format', None) or 'drama',
        'status': c.status,
        'catalog_shelf': getattr(c, 'catalog_shelf', None) or 'standard',
        'is_wiam_origin': bool(getattr(c, 'is_wiam_origin', False)),
        'is_vip_series': bool(getattr(c, 'is_vip_series', False)),
        'coin_band': getattr(c, 'coin_band', None) or 'standard',
        'unlock_price_coins': band_price,
        'cover_url': _abs_url(c.cover_url),
        'poster_url': _abs_url(poster),
        'trailer_url': getattr(c, 'trailer_url', None),
        'trailer_hls_url': getattr(c, 'trailer_hls_url', None),
        'trailer_poster_url': _abs_url(getattr(c, 'trailer_poster_url', None)),
        'trailer_qa_status': getattr(c, 'trailer_qa_status', None) or 'none',
        'planned_episode_count': int(getattr(c, 'planned_episode_count', 0) or 0),
        'is_series_complete': bool(getattr(c, 'is_series_complete', False)),
        'total_episodes': getattr(c, 'total_episodes', None) or ep_count,
        'free_episode_count': free_n,
        'ranking_score': float(getattr(c, 'ranking_score', 0) or 0),
        'creator_wiam_id': c.creator_wiam_id,
        'creator_id': creator_user_id,
        'is_following': is_following,
        'published_at': c.published_at.isoformat() if c.published_at else None,
    }


def _episode_json(ep: Episode, content: Content = None, user=None, include_lock=True):
    content = content or Content.query.get(ep.content_id)
    allowed, reason = can_watch(user, ep, content) if include_lock else (True, 'skip')
    free = is_within_free_tier(ep, content) if content else False
    return {
        'id': ep.id,
        'content_id': ep.content_id,
        'episode_number': ep.episode_number,
        'title': ep.title,
        'synopsis': ep.synopsis or '',
        'poster_url': _abs_url(ep.poster_url),
        'trailer_url': ep.trailer_url,
        'duration_seconds': ep.duration_seconds or 0,
        'transcode_status': ep.transcode_status or 'queued',
        'published': bool(ep.published),
        'is_free_tier': free,
        'unlock_price_coins': int(ep.unlock_price_coins or 0),
        'locked': not allowed,
        'access_reason': reason,
        'view_count': ep.view_count or 0,
    }


@episode_api.route('/series', methods=['GET'])
@jwt_optional
def list_drama_series():
    """List published drama Series (Content.format=drama)."""
    q = _drama_filter().filter(Content.status.in_(Content.PUBLISHED_STATUSES))
    genre = (request.args.get('genre') or '').strip()
    if genre:
        q = q.filter(Content.genre.ilike(genre))
    search_q = (request.args.get('q') or '').strip()
    if search_q:
        like = f'%{search_q}%'
        q = q.filter(db.or_(
            Content.title.ilike(like),
            Content.genre.ilike(like),
            Content.description.ilike(like),
        ))
    rows = q.order_by(Content.published_at.desc().nullslast(), Content.id.desc()).limit(50).all()
    user = getattr(request, 'api_user', None)
    return jsonify({'series': [_series_json(c, user) for c in rows]})


@episode_api.route('/series/<int:series_id>', methods=['GET'])
@jwt_optional
def get_drama_series(series_id):
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    fmt = (getattr(c, 'format', None) or 'novel').lower()
    if fmt != 'drama':
        return jsonify({
            'error': 'not_a_drama_series',
            'hint': 'Use /api/v1/books/<id> for novels; /api/v1/story-bundles for book lists',
        }), 404
    user = getattr(request, 'api_user', None)
    creator = User.query.filter_by(wiam_id=c.creator_wiam_id).first() if c.creator_wiam_id else None
    return jsonify({
        'series': _series_json(c, user),
        'creator': {
            'id': creator.id,
            'wiam_id': c.creator_wiam_id,
            'username': creator.username if creator else None,
            'display_name': creator.display_name if creator else None,
            'avatar_url': _abs_url(getattr(creator, 'avatar_url', None)) if creator else None,
        } if creator else None,
    })


@episode_api.route('/series/<int:series_id>/episodes', methods=['GET'])
@jwt_optional
def list_episodes(series_id):
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    user = getattr(request, 'api_user', None)
    q = Episode.query.filter_by(content_id=series_id)
    # Creators see drafts; public sees published only
    if not (user and c.creator_wiam_id in (_uid(user), getattr(user, 'wiam_id', None), getattr(user, 'id', None))):
        q = q.filter_by(published=True)
    rows = q.order_by(Episode.episode_number.asc()).all()
    return jsonify({
        'series_id': series_id,
        'free_episode_count': free_episode_count_for(c),
        'episodes': [_episode_json(ep, c, user) for ep in rows],
    })


@episode_api.route('/episodes/<int:episode_id>/stream', methods=['GET'])
@jwt_optional
def episode_stream(episode_id):
    """Return short-TTL signed playback URL. Free-tier works for guests; paywall needs login."""
    user = getattr(request, 'api_user', None)
    ep = Episode.query.get(episode_id)
    if not ep:
        return jsonify({'error': 'not_found'}), 404
    content = Content.query.get(ep.content_id)
    if not content or content.is_deleted:
        return jsonify({'error': 'not_found'}), 404

    allowed, reason = can_watch(user, ep, content)
    if not allowed:
        status = 401 if reason == 'deny_login' else 402
        return jsonify({
            'error': 'login_required' if reason == 'deny_login' else 'locked',
            'reason': reason,
            'unlock_price_coins': int(ep.unlock_price_coins or 0),
            'free_episode_count': free_episode_count_for(content),
        }), status

    if reason == 'free' and user:
        ensure_free_unlock_row(user, ep, content)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()

    vs = get_video_service()
    signed = vs.sign_playback_url(
        storage_key=ep.video_url,
        episode_id=ep.id,
        hls_manifest_url=ep.hls_manifest_url,
        ttl=300,
    )
    try:
        track('watch_start', user, content_id=ep.content_id, chapter_number=ep.episode_number,
              episode_id=ep.id, provider=signed.get('provider'))
        db.session.commit()
    except Exception:
        pass

    return jsonify({
        'episode_id': ep.id,
        'series_id': ep.content_id,
        'access_reason': reason,
        'stream': signed,
    })


@episode_api.route('/episodes/<int:episode_id>/unlock', methods=['POST'])
@jwt_required
def unlock_episode(episode_id):
    user = request.api_user
    ep = Episode.query.get(episode_id)
    if not ep:
        return jsonify({'error': 'not_found'}), 404
    content = Content.query.get(ep.content_id)
    if not content or content.is_deleted:
        return jsonify({'error': 'not_found'}), 404

    uid = _uid(user)
    existing = EpisodeUnlock.query.filter(
        EpisodeUnlock.episode_id == ep.id,
        db.or_(EpisodeUnlock.user_id == user.id, EpisodeUnlock.user_id == user.wiam_id),
    ).first()
    if existing:
        return jsonify({'ok': True, 'already_unlocked': True, 'unlock_method': existing.unlock_method})

    # Free-first-N — grant without coins
    if is_within_free_tier(ep, content):
        ensure_free_unlock_row(user, ep, content)
        db.session.commit()
        track('episode_unlock', user, content_id=ep.content_id, chapter_number=ep.episode_number,
              episode_id=ep.id, method='free')
        db.session.commit()
        return jsonify({'ok': True, 'unlock_method': 'free', 'coins_spent': 0})

    if content.creator_wiam_id in (uid, user.wiam_id, user.id):
        return jsonify({'ok': True, 'already_unlocked': True, 'unlock_method': 'creator'})

    try:
        from ..services.coin_pricing import resolve_unlock_coins
        coins_needed = resolve_unlock_coins(content, ep)
    except Exception:
        coins_needed = int(ep.unlock_price_coins or 0)
    if coins_needed <= 0:
        return jsonify({'error': 'Episode has no unlock price'}), 400

    try:
        from ..services.ledger import record_episode_unlock
        result = record_episode_unlock(
            uid, content.creator_wiam_id,
            ep.content_id, ep.id, ep.episode_number, coins_needed,
        )
        if result.get('error'):
            bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
            return jsonify({
                'error': result['error'],
                'need_coins': 'Not enough' in (result.get('error') or ''),
                'balance': bal.balance if bal else 0,
            }), 402
    except Exception as e:
        log.exception('episode unlock failed: %s', e)
        return jsonify({'error': 'Unlock failed. Please try again.'}), 500

    unlock = EpisodeUnlock(
        user_id=uid,
        episode_id=ep.id,
        content_id=ep.content_id,
        coins_spent=coins_needed,
        creator_id=content.creator_wiam_id or 0,
        unlock_method='coins',
    )
    db.session.add(unlock)

    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=content.creator_wiam_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(creator_id=content.creator_wiam_id, year=now.year, month=now.month)
        db.session.add(earn)
    earn.coins_from_unlocks = (earn.coins_from_unlocks or 0) + coins_needed
    earn.total_coins = (earn.coins_from_unlocks or 0) + (earn.coins_from_tips or 0)
    from ..services.monetization import COIN_TO_GHS
    share_pct = RevenueRule.get_creator_share(content.creator_wiam_id) or 50.0
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = now

    db.session.commit()
    track('episode_unlock', user, content_id=ep.content_id, chapter_number=ep.episode_number,
          episode_id=ep.id, method='coins', coins=coins_needed)
    db.session.commit()
    return jsonify({
        'ok': True,
        'unlock_method': 'coins',
        'coins_spent': coins_needed,
        'balance': result.get('balance'),
    })


@episode_api.route('/watch/save-progress', methods=['POST'])
@jwt_required
def save_watch_progress():
    user = request.api_user
    data = request.get_json(silent=True) or {}
    episode_id = data.get('episode_id')
    if not episode_id:
        return jsonify({'error': 'episode_id required'}), 400
    ep = Episode.query.get(int(episode_id))
    if not ep:
        return jsonify({'error': 'not_found'}), 404

    content = Content.query.get(ep.content_id)
    allowed, reason = can_watch(user, ep, content)
    if not allowed:
        return jsonify({'error': 'locked', 'reason': reason}), 402

    uid = _uid(user)
    seconds = max(0, int(data.get('seconds_watched') or 0))
    completed = bool(data.get('completed'))
    if ep.duration_seconds and seconds >= int(ep.duration_seconds * 0.9):
        completed = True

    row = WatchProgress.query.filter_by(user_id=uid, episode_id=ep.id).first()
    if not row:
        # also try user.id if different
        row = WatchProgress.query.filter_by(user_id=user.id, episode_id=ep.id).first()
    if not row:
        row = WatchProgress(user_id=uid, episode_id=ep.id)
        db.session.add(row)
    row.seconds_watched = max(row.seconds_watched or 0, seconds)
    row.completed = bool(row.completed or completed)
    row.last_watched_at = datetime.utcnow()
    db.session.commit()

    if row.completed:
        try:
            track('watch_complete', user, content_id=ep.content_id,
                  chapter_number=ep.episode_number, episode_id=ep.id)
            db.session.commit()
        except Exception:
            pass

    return jsonify({
        'ok': True,
        'episode_id': ep.id,
        'seconds_watched': row.seconds_watched,
        'completed': row.completed,
    })


@episode_api.route('/watch/continue-watching', methods=['GET'])
@jwt_required
def continue_watching():
    user = request.api_user
    uid = _uid(user)
    ids = {uid}
    if user.id:
        ids.add(user.id)
    if user.wiam_id:
        ids.add(user.wiam_id)

    rows = (
        WatchProgress.query
        .filter(WatchProgress.user_id.in_(list(ids)), WatchProgress.completed.is_(False))
        .order_by(WatchProgress.last_watched_at.desc())
        .limit(20)
        .all()
    )
    items = []
    for wp in rows:
        ep = Episode.query.get(wp.episode_id)
        if not ep or not ep.published:
            continue
        content = Content.query.get(ep.content_id)
        if not content or content.is_deleted:
            continue
        items.append({
            'series': _series_json(content, user),
            'episode': _episode_json(ep, content, user),
            'seconds_watched': wp.seconds_watched,
            'last_watched_at': wp.last_watched_at.isoformat() if wp.last_watched_at else None,
        })
    return jsonify({'continue_watching': items})
