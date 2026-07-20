"""
Soft Rankings (replaces ultra-hard WiamElite Hall of Fame).

DramaBox-style: watch velocity, unlocks, completion — reachable charts.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import List

from ..extensions import db
from ..models import Content, Episode, EpisodeUnlock, WatchProgress, SeriesRankingSnapshot

log = logging.getLogger(__name__)


def compute_series_score(content: Content, since: datetime) -> dict:
    eps = Episode.query.filter_by(content_id=content.id, published=True).all()
    ep_ids = [e.id for e in eps]
    watches = 0
    completes = 0
    if ep_ids:
        watches = WatchProgress.query.filter(
            WatchProgress.episode_id.in_(ep_ids),
            WatchProgress.last_watched_at >= since,
        ).count()
        completes = WatchProgress.query.filter(
            WatchProgress.episode_id.in_(ep_ids),
            WatchProgress.completed.is_(True),
            WatchProgress.last_watched_at >= since,
        ).count()
    unlocks = EpisodeUnlock.query.filter(
        EpisodeUnlock.content_id == content.id,
        EpisodeUnlock.unlocked_at >= since,
        EpisodeUnlock.unlock_method == 'coins',
    ).count()
    # Soft weighted score — not Elite 50k gates
    score = watches * 1.0 + completes * 2.5 + unlocks * 4.0
    if getattr(content, 'is_wiam_origin', False):
        score *= 1.05
    return {
        'watches': watches,
        'completes': completes,
        'unlocks': unlocks,
        'score': round(score, 2),
    }


def recompute_rankings(period_key: str = 'weekly', limit: int = 50) -> int:
    if period_key == 'daily':
        since = datetime.utcnow() - timedelta(days=1)
    elif period_key == 'rising':
        since = datetime.utcnow() - timedelta(days=3)
    else:
        since = datetime.utcnow() - timedelta(days=7)
        period_key = 'weekly'

    series = Content.query.filter(
        Content.deleted_at.is_(None),
        Content.format.in_(['drama', 'anime', 'Drama', 'Anime']),
        Content.status.in_(Content.PUBLISHED_STATUSES),
    ).all()

    scored = []
    for c in series:
        m = compute_series_score(c, since)
        c.ranking_score = m['score']
        c.ranking_updated_at = datetime.utcnow()
        scored.append((c, m))

    scored.sort(key=lambda x: x[1]['score'], reverse=True)

    SeriesRankingSnapshot.query.filter_by(period_key=period_key).delete()
    now = datetime.utcnow()
    for i, (c, m) in enumerate(scored[:limit], start=1):
        db.session.add(SeriesRankingSnapshot(
            content_id=c.id,
            period_key=period_key,
            rank_position=i,
            score=m['score'],
            metrics_json=json.dumps(m),
            computed_at=now,
        ))
    db.session.commit()
    return min(limit, len(scored))


def list_rankings(period_key: str = 'weekly', limit: int = 30) -> List[dict]:
    rows = (
        SeriesRankingSnapshot.query.filter_by(period_key=period_key)
        .order_by(SeriesRankingSnapshot.rank_position.asc())
        .limit(limit)
        .all()
    )
    if not rows:
        recompute_rankings(period_key, limit=limit)
        rows = (
            SeriesRankingSnapshot.query.filter_by(period_key=period_key)
            .order_by(SeriesRankingSnapshot.rank_position.asc())
            .limit(limit)
            .all()
        )
    out = []
    for r in rows:
        c = Content.query.get(r.content_id)
        if not c or c.is_deleted:
            continue
        out.append({
            'rank': r.rank_position,
            'score': r.score,
            'series_id': c.id,
            'title': c.title,
            'poster_url': getattr(c, 'poster_url', None) or c.cover_url,
            'trailer_url': c.trailer_url or c.trailer_hls_url,
            'catalog_shelf': getattr(c, 'catalog_shelf', 'standard'),
            'is_wiam_origin': bool(getattr(c, 'is_wiam_origin', False)),
            'is_vip_series': bool(getattr(c, 'is_vip_series', False)),
        })
    return out
