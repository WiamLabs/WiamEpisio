"""
Book popularity scoring — Push 4 of the deep_tracking_and_home_fix plan.

Replaces the per-request "ORDER BY views DESC" passes that previously powered
Home / Trending / Top Rated with a denormalized score table
(``w_book_popularity``) that the home feed can read in one indexed query.

Why a separate table?

* The previous home feed pulled 60 rows ordered by ``created_at`` and
  derived every section by re-sorting that same list — which is exactly
  why the same book appeared in 5 different rails ("Trending", "Popular",
  "Top Rated", "Premium Picks", "Latest"). With a real popularity score
  per book we can rank by *signals* (recent views, ratings, favorites,
  freshness, chapter momentum) instead of insert order.
* Wilson's lower bound smooths ratings so a single 5-star rating doesn't
  out-rank a book with 200 ratings averaging 4.6.
* Recomputing on every home request would be wasteful — the table is
  refreshed at most once every ``RECOMPUTE_INTERVAL_SECONDS`` (default
  30 minutes) by ``recompute_if_stale``. The ``before_request`` hook
  installed in ``__init__.py`` triggers it lazily.

The scoring formula is intentionally simple — no ML — because the input
signals are the result of engagement instrumentation in Push 3 and the
formula needs to remain auditable. Tune weights by adjusting the
``_WEIGHTS`` dict.
"""
from __future__ import annotations

import math
import logging
import threading
from datetime import datetime, timedelta

log = logging.getLogger(__name__)

# Re-run cadence. 30 minutes balances freshness against recompute cost on
# the 100-ish-book platform we currently serve.
RECOMPUTE_INTERVAL_SECONDS = 30 * 60

# Lookback window for "recent" views in the view_score formula.
RECENT_VIEW_WINDOW_DAYS = 30

# Final composite weights. Must sum to ~1 — keep tunable but document any
# rebalance in the AGENT_MEMORY plan progress note.
_WEIGHTS = {
    'view': 0.35,
    'rating': 0.25,
    'favorite': 0.15,
    'freshness': 0.15,
    'chapter': 0.10,
}

_recompute_lock = threading.Lock()
_last_recompute_at: datetime | None = None


def _wilson_lower_bound(positive: int, total: int, z: float = 1.96) -> float:
    """Wilson score lower bound for a Bernoulli proportion at 95% confidence.

    A 5-rating book with 1 vote scores below a 4.6-rating book with 200
    votes — exactly what we want for ranking trustworthy "great reads" vs
    statistical noise.
    """
    if total <= 0:
        return 0.0
    p = positive / total
    denom = 1.0 + z * z / total
    base = p + z * z / (2.0 * total)
    spread = z * math.sqrt(p * (1.0 - p) / total + z * z / (4.0 * total * total))
    return max(0.0, (base - spread) / denom)


def _normalize_view_score(raw: float, max_raw: float) -> float:
    """Squash log-scaled view contribution into [0, 1] given the corpus max."""
    if max_raw <= 0:
        return 0.0
    return min(1.0, raw / max_raw)


def _book_age_days(book) -> int:
    """How many days since the book was first published / created."""
    base = book.published_at or book.created_at
    if not base:
        return 1
    delta = datetime.utcnow() - base
    return max(1, delta.days)


def compute_all() -> int:
    """Recompute the score table for every published book.

    Pulls four batched queries (recent views, lifetime views, rating
    aggregates, favorite counts, chapter counts) so we don't N+1 the
    database. Returns the number of rows upserted.
    """
    from ..extensions import db
    from ..models import (
        Content,
        Rating,
        Favorite,
        AnalyticsEvent,
        WebBookContent,
        BookPopularityScore,
    )
    from sqlalchemy import func

    now = datetime.utcnow()
    cutoff = now - timedelta(days=RECENT_VIEW_WINDOW_DAYS)

    books = (
        Content.query
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .all()
    )
    if not books:
        return 0

    book_ids = [b.id for b in books]

    # 1) Recent views from analytics_events (Push 1 / 3 instrumentation).
    recent_view_rows = (
        db.session.query(AnalyticsEvent.content_id, func.count(AnalyticsEvent.id))
        .filter(
            AnalyticsEvent.event_type == 'book_view',
            AnalyticsEvent.content_id.in_(book_ids),
            AnalyticsEvent.created_at >= cutoff,
        )
        .group_by(AnalyticsEvent.content_id)
        .all()
    )
    recent_view_map = {cid: int(cnt) for cid, cnt in recent_view_rows}

    # 2) Rating aggregates (avg + count + #high). #high feeds Wilson LB.
    rating_rows = (
        db.session.query(
            Rating.content_id,
            func.avg(Rating.rating).label('avg'),
            func.count(Rating.id).label('total'),
            func.sum(
                db.case((Rating.rating >= 4, 1), else_=0)
            ).label('high'),
        )
        .filter(Rating.content_id.in_(book_ids))
        .group_by(Rating.content_id)
        .all()
    )
    rating_map = {
        r.content_id: {
            'avg': float(r.avg or 0.0),
            'total': int(r.total or 0),
            'high': int(r.high or 0),
        }
        for r in rating_rows
    }

    # 3) Favorite counts.
    favorite_rows = (
        db.session.query(Favorite.content_id, func.count(Favorite.id))
        .filter(Favorite.content_id.in_(book_ids))
        .group_by(Favorite.content_id)
        .all()
    )
    favorite_map = {cid: int(cnt) for cid, cnt in favorite_rows}

    # 4) Chapter counts (only published chapters count toward momentum).
    chapter_rows = (
        db.session.query(
            WebBookContent.content_id,
            func.count(WebBookContent.id),
        )
        .filter(
            WebBookContent.content_id.in_(book_ids),
            WebBookContent.status == 'published',
        )
        .group_by(WebBookContent.content_id)
        .all()
    )
    chapter_map = {cid: int(cnt) for cid, cnt in chapter_rows}

    # Pre-compute the corpus max for raw view scores so we can normalise.
    raw_view_scores: dict[int, float] = {}
    for b in books:
        age = _book_age_days(b)
        recent = recent_view_map.get(b.id, 0)
        raw = math.log1p(recent) / max(1.0, math.log(age + 10))
        raw_view_scores[b.id] = raw
    max_raw_view = max(raw_view_scores.values()) if raw_view_scores else 0.0

    # Same for raw favorite scores so they're comparable across the corpus.
    raw_favorite_scores: dict[int, float] = {}
    for b in books:
        age = _book_age_days(b)
        favs = favorite_map.get(b.id, 0)
        raw = math.log1p(favs) / max(1.0, math.log(age + 10))
        raw_favorite_scores[b.id] = raw
    max_raw_favorite = max(raw_favorite_scores.values()) if raw_favorite_scores else 0.0

    upserted = 0
    for b in books:
        age_days = _book_age_days(b)

        view_score = _normalize_view_score(raw_view_scores[b.id], max_raw_view)
        favorite_score = _normalize_view_score(raw_favorite_scores[b.id], max_raw_favorite)

        rstats = rating_map.get(b.id, {'avg': 0.0, 'total': 0, 'high': 0})
        rating_score = _wilson_lower_bound(rstats['high'], rstats['total'])

        # Freshness decays gently — we don't want to bury well-loved older
        # work, just give recent work a tailwind.
        freshness_score = 1.0 / (age_days ** 0.3)
        freshness_score = min(1.0, freshness_score)

        chapter_count = chapter_map.get(b.id, 0)
        chapter_score = math.log1p(chapter_count) / math.log(50.0)
        chapter_score = min(1.0, chapter_score)

        composite = (
            _WEIGHTS['view'] * view_score
            + _WEIGHTS['rating'] * rating_score
            + _WEIGHTS['favorite'] * favorite_score
            + _WEIGHTS['freshness'] * freshness_score
            + _WEIGHTS['chapter'] * chapter_score
        )

        row = BookPopularityScore.query.get(b.id)
        if row is None:
            row = BookPopularityScore(content_id=b.id)
            db.session.add(row)
        row.score = float(composite)
        row.view_score = float(view_score)
        row.rating_score = float(rating_score)
        row.favorite_score = float(favorite_score)
        row.freshness_score = float(freshness_score)
        row.chapter_score = float(chapter_score)
        row.recent_views_30d = int(recent_view_map.get(b.id, 0))
        row.total_views = int(b.views or 0)
        row.rating_count = int(rstats['total'])
        row.avg_rating = float(rstats['avg'])
        row.favorite_count = int(favorite_map.get(b.id, 0))
        row.chapter_count = int(chapter_count)
        row.age_days = int(age_days)
        row.computed_at = now
        upserted += 1

    db.session.commit()
    log.info("popularity.compute_all: refreshed %d row(s)", upserted)
    return upserted


def recompute_if_stale(force: bool = False) -> bool:
    """Refresh the popularity table if more than ``RECOMPUTE_INTERVAL_SECONDS``
    have elapsed since the last refresh.

    Returns True if a recompute actually ran. Uses a non-blocking try-acquire
    on the global lock so concurrent requests don't pile up; only the first
    caller does the work and subsequent ones return immediately.
    """
    global _last_recompute_at

    now = datetime.utcnow()
    if not force and _last_recompute_at is not None:
        if (now - _last_recompute_at).total_seconds() < RECOMPUTE_INTERVAL_SECONDS:
            return False

    if not _recompute_lock.acquire(blocking=False):
        return False
    try:
        compute_all()
        _last_recompute_at = datetime.utcnow()
        return True
    except Exception as exc:
        log.warning("popularity.recompute_if_stale failed: %s", exc)
        try:
            from ..extensions import db
            db.session.rollback()
        except Exception:
            pass
        return False
    finally:
        _recompute_lock.release()


def top_books_by_score(limit: int = 60, exclude: set[int] | None = None):
    """Return the highest-scored books, optionally excluding ids already placed.

    The home_feed handler uses this to sequentially fill spotlight -> pulse ->
    stream from a single ranked list, building the ``placed_ids`` set as it
    goes. Falls back to ``Content`` ordering by ``views`` if the popularity
    table is empty (cold start before the first recompute).
    """
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    exclude = set(exclude or ())
    rows = (
        db.session.query(Content)
        .join(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .order_by(BookPopularityScore.score.desc().nullslast())
        .limit(limit + len(exclude))
        .all()
    )
    if rows:
        return [b for b in rows if b.id not in exclude][:limit]

    # Cold start fallback — popularity table not populated yet.
    fallback = (
        Content.query
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .order_by(Content.views.desc().nullslast(), Content.created_at.desc())
        .limit(limit + len(exclude))
        .all()
    )
    return [b for b in fallback if b.id not in exclude][:limit]


def top_books_by_rating(limit: int = 12, exclude: set[int] | None = None):
    """Best-rated books (Wilson lower bound) for the Top Rated rail."""
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    exclude = set(exclude or ())
    rows = (
        db.session.query(Content)
        .join(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
            BookPopularityScore.rating_count >= 3,
        )
        .order_by(BookPopularityScore.rating_score.desc().nullslast())
        .limit(limit + len(exclude))
        .all()
    )
    return [b for b in rows if b.id not in exclude][:limit]


def fresh_books(limit: int = 6, exclude: set[int] | None = None):
    """Newest books — strict recency, used for the "Latest" rail."""
    from ..models import Content

    exclude = set(exclude or ())
    rows = (
        Content.query
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .order_by(Content.created_at.desc())
        .limit(limit + len(exclude))
        .all()
    )
    return [b for b in rows if b.id not in exclude][:limit]


def premium_books(limit: int = 6, exclude: set[int] | None = None):
    """Books that contain at least one locked / premium-gated chapter.

    Powers the "Premium Picks" rail. We deliberately do NOT slice the stream
    pool here (that was the bug that made the same book appear in both Stream
    and Premium Picks). Instead we query for books that actually have paid or
    premium-locked chapters and order them by popularity score so the most
    appealing premium offerings surface first. If there are no such books
    yet (early-platform state) we return an empty list and the rail simply
    won't render — which is the correct UX rather than fake-promoting the
    same books twice.
    """
    from ..extensions import db
    from ..models import Content, WebBookContent, BookPopularityScore

    exclude = set(exclude or ())

    locked_ids_subq = (
        db.session.query(WebBookContent.content_id)
        .filter(
            WebBookContent.status == 'published',
            db.or_(
                WebBookContent.is_locked.is_(True),
                WebBookContent.is_premium_locked.is_(True),
            ),
        )
        .distinct()
        .subquery()
    )

    rows = (
        db.session.query(Content)
        .join(locked_ids_subq, Content.id == locked_ids_subq.c.content_id)
        .outerjoin(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .order_by(
            BookPopularityScore.score.desc().nullslast(),
            Content.views.desc().nullslast(),
            Content.created_at.desc(),
        )
        .limit(limit + len(exclude))
        .all()
    )
    return [b for b in rows if b.id not in exclude][:limit]
