"""
Soft DramaBox-style rankings — NOT ultra-hard WiamElite thresholds.

Score ≈ unlocks*3 + watch_starts + completions*2 + recent velocity boost.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from collections import defaultdict

from ..extensions import db
from ..models import (
    Content, Episode, EpisodeUnlock, WatchProgress, AnalyticsEvent,
    SeriesRankingSnapshot,
)

log = logging.getLogger(__name__)


def _drama_ids():
    return [
        c.id for c in Content.query.filter(
            Content.deleted_at.is_(None),
            db.or_(Content.format == 'drama', Content.format == 'anime', Content.format == 'Drama'),
            Content.status.in_(Content.PUBLISHED_STATUSES),
        ).all()
    ]


def compute_scores(days: int = 7) -> dict:
    """Return {content_id: {score, unlocks, starts, completions}}."""
    since = datetime.utcnow() - timedelta(days=days)
    ids = set(_drama_ids())
    if not ids:
        return {}

    stats = defaultdict(lambda: {'unlocks': 0, 'starts': 0, 'completions': 0, 'score': 0.0})

    unlocks = (
        db.session.query(EpisodeUnlock.content_id, db.func.count(EpisodeUnlock.id))
        .filter(EpisodeUnlock.content_id.in_(list(ids)), EpisodeUnlock.unlocked_at >= since)
        .group_by(EpisodeUnlock.content_id)
        .all()
    )
    for cid, n in unlocks:
        stats[cid]['unlocks'] = int(n or 0)

    # Watch progress completions
    ep_map = {
        e.id: e.content_id
        for e in Episode.query.filter(Episode.content_id.in_(list(ids))).all()
    }
    if ep_map:
        wps = WatchProgress.query.filter(
            WatchProgress.episode_id.in_(list(ep_map.keys())),
            WatchProgress.last_watched_at >= since,
        ).all()
        for wp in wps:
            cid = ep_map.get(wp.episode_id)
            if not cid:
                continue
            stats[cid]['starts'] += 1
            if wp.completed:
                stats[cid]['completions'] += 1

    # Analytics watch_start if present
    try:
        events = (
            db.session.query(AnalyticsEvent.content_id, db.func.count(AnalyticsEvent.id))
            .filter(
                AnalyticsEvent.content_id.in_(list(ids)),
                AnalyticsEvent.event_type.in_(['watch_start', 'episode_unlock']),
                AnalyticsEvent.created_at >= since,
            )
            .group_by(AnalyticsEvent.content_id)
            .all()
        )
        for cid, n in events:
            if cid in stats or cid in ids:
                stats[cid]['starts'] = max(stats[cid]['starts'], int(n or 0))
    except Exception as e:
        log.debug('rankings analytics skip: %s', e)

    for cid, s in stats.items():
        s['score'] = float(s['unlocks'] * 3 + s['starts'] + s['completions'] * 2)
    # Include zero-score published series so charts fill
    for cid in ids:
        if cid not in stats:
            stats[cid] = {'unlocks': 0, 'starts': 0, 'completions': 0, 'score': 0.0}
    return dict(stats)


def recompute_rankings(periods=None) -> dict:
    periods = periods or ['weekly', 'daily', 'rising']
    now = datetime.utcnow()
    results = {}

    for period in periods:
        days = 1 if period == 'daily' else (3 if period == 'rising' else 7)
        scores = compute_scores(days=days)
        ranked = sorted(scores.items(), key=lambda x: x[1]['score'], reverse=True)

        # Clear old snapshots for period
        SeriesRankingSnapshot.query.filter_by(period_key=period).delete()

        for pos, (cid, metrics) in enumerate(ranked[:100], start=1):
            db.session.add(SeriesRankingSnapshot(
                content_id=cid,
                period_key=period,
                rank_position=pos,
                score=metrics['score'],
                metrics_json=json.dumps(metrics),
                computed_at=now,
            ))
            if period == 'weekly':
                c = Content.query.get(cid)
                if c:
                    c.ranking_score = metrics['score']
                    c.ranking_updated_at = now

        results[period] = len(ranked)

    db.session.commit()
    return results


def list_rankings(period: str = 'weekly', limit: int = 50):
    period = (period or 'weekly').lower()
    rows = (
        SeriesRankingSnapshot.query
        .filter_by(period_key=period)
        .order_by(SeriesRankingSnapshot.rank_position.asc())
        .limit(limit)
        .all()
    )
    if not rows:
        # Fallback: live score without snapshot
        scores = compute_scores(days=7 if period != 'daily' else 1)
        ranked = sorted(scores.items(), key=lambda x: x[1]['score'], reverse=True)[:limit]
        out = []
        for pos, (cid, m) in enumerate(ranked, start=1):
            out.append({
                'content_id': cid,
                'rank_position': pos,
                'score': m['score'],
                'metrics': m,
            })
        return out

    return [{
        'content_id': r.content_id,
        'rank_position': r.rank_position,
        'score': r.score,
        'metrics': json.loads(r.metrics_json or '{}'),
        'computed_at': r.computed_at.isoformat() if r.computed_at else None,
    } for r in rows]
