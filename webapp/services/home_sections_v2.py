"""
Home Sections V2 — daily-rotating section registry.

Replaces the hard-coded 9-rail mobile Home with a 24-section catalog that:

* **Pins** essential sections (Continue Reading, For You, Spotlight, Top
  Rated, From Creators You Follow) so users always land on something
  familiar and personal.
* **Rotates** ~16 supporting sections (Hidden Gems, Quick Reads, Long
  Reads, Completed Stories, Most Favorited This Week, Recently Updated,
  Premium Picks, Editor's Pick, Wiam Originals, Because You Read X,
  Popular in <Genre>, Mood themes…) — picking 4-6 per day with a
  per-user, per-day deterministic seed so the home feels fresh without
  feeling random.
* **Skips empty sections** automatically — anything with fewer than
  ``min_books`` is dropped before the rotator sees it.
* **Cross-section dedup** — a book never lands in two sections in the
  same response. Continue Reading is exempt (the user's library is
  independent of the public feed).

Public surface:

* ``build_home(user, target_count=8)`` — the one-shot call used by
  ``api_v1.home_feed``. Returns ``{ sections: [...], legacy_pools: {...},
  continue_reading: [...] }``. Runs every fetcher exactly once.
* ``SECTION_REGISTRY`` — list of :class:`Section` definitions. Add new
  sections here; do not modify ``home_feed`` directly.
* ``daily_rotation(user, target_count)`` — pure rotation logic; useful
  for tests.

Design notes
------------

* Fetchers return raw ``Content`` objects (not dicts). The endpoint
  layer is responsible for ``_book_json`` serialization with batched
  creator/stats caches.
* All fetchers accept ``(user, exclude_ids: set, limit: int)`` and must
  be safe to call with ``exclude_ids=set()``. The same fetcher is
  invoked once per user per request (Pass 1 in :func:`build_home`); the
  result is reused for both the new ``sections[]`` array and the legacy
  pool keys.
* Daily rotation uses ``f"{user.id}:{date.today()}"`` as the RNG seed —
  identical mix within a day, different mix tomorrow.
"""
from __future__ import annotations

import logging
import random
from collections import Counter
from datetime import date as _date, datetime, timedelta
from typing import Callable, List, Optional, Set

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

# How many candidates each fetcher pulls. Caps below trim per layout.
_FETCH_LIMIT = 24

# Per-layout display caps (mobile UI limits).
_LAYOUT_CAPS = {
    'continue': 10,
    'spotlight': 3,
    'pulse': 8,
    'mosaic': 8,
    'stream': 12,
}

# Legacy pool caps (match the pre-V2 home_feed contract exactly).
_LEGACY_CAPS = {
    'spotlight': 3,
    'pulse': 8,
    'stream': 12,
    'latest': 6,
    'top_rated': 8,
    'premium_picks': 6,
}

# Daily rotation order — these keys are pinned (always shown if eligible).
# Rendered in this exact order at the top of the home screen.
PINNED_ORDER = [
    'continue_reading',
    'for_you',
    'spotlight',
    'top_rated',
    'from_creators_you_follow',
]

# Assembly order — used during the cross-section dedup pass so
# engagement-driven rails (pulse, stream, top_rated) claim books BEFORE
# date-based rails (latest) and personalized-genre rails. Without this,
# ``latest`` (which fetches 24 books by published_at) would drain the
# scored-book pool and leave nothing for pulse/stream on small catalogues.
# Render order is independent of assembly order — see ``build_home``.
ASSEMBLY_PRIORITY = [
    # Personal first (the user's own data, no overlap with feed)
    'continue_reading',
    'for_you',
    # Score-based (highest-engagement first)
    'spotlight',
    'pulse',
    'stream',
    'top_rated',
    'premium_picks',
    'wiam_originals',
    'editor_pick',
    'hidden_gems',
    'completed_stories',
    'most_favorited_week',
    # Personalized
    'because_you_read',
    'popular_in_genre_1',
    'popular_in_genre_2',
    'popular_in_genre_3',
    'from_creators_you_follow',
    # Length-based (filtered slices of the score pool)
    'quick_reads',
    'long_reads',
    # Date-based last so they don't drain the score pool
    'recently_updated',
    'latest',
]


# ---------------------------------------------------------------------------
# Registry types
# ---------------------------------------------------------------------------

class Section:
    """Declarative section definition.

    Add new sections by appending to :data:`SECTION_REGISTRY`. The endpoint
    layer never needs to know about new section types — it just iterates
    the rotator output and serializes each book.
    """

    __slots__ = ('key', 'title', 'subtitle', 'icon', 'layout', 'fetcher',
                 'min_books', 'pinned', 'requires_user')

    def __init__(self, key: str, title: str, subtitle: str, icon: str,
                 layout: str, fetcher: Callable,
                 min_books: int = 4, pinned: bool = False,
                 requires_user: bool = False):
        self.key = key
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.layout = layout  # 'continue' | 'spotlight' | 'pulse' | 'mosaic' | 'stream'
        self.fetcher = fetcher
        self.min_books = min_books
        self.pinned = pinned
        self.requires_user = requires_user


# ---------------------------------------------------------------------------
# Fetchers
#
# Every fetcher returns a list of Content objects. They must:
#   * never raise (caller wraps in try/except, but defense-in-depth wins)
#   * respect ``exclude_ids`` (drop any id in the set)
#   * never run more than 2-3 SQL queries (we run up to 24 fetchers per
#     home request — keep them cheap)
# ---------------------------------------------------------------------------

def _published_filter(query):
    """Apply the standard ``published + not soft-deleted`` filter."""
    from ..models import Content
    return query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    )


def _fetch_continue_reading(user, exclude_ids: Set[int], limit: int = 10):
    if not user:
        return []
    from ..extensions import db
    from ..models import Content, ReadingProgress, UserLibrary

    prog_uid = user.wiam_id or user.id
    wiam_id = user.wiam_id or user.id

    # Library entries first (preserves user-curated order).
    lib_entries = (
        UserLibrary.query
        .filter_by(user_id=wiam_id)
        .order_by(UserLibrary.added_at.desc())
        .limit(40)
        .all()
    )
    lib_ids = [e.content_id for e in lib_entries]
    if not lib_ids:
        return []

    progress_rows = (
        ReadingProgress.query
        .filter_by(user_id=prog_uid)
        .filter(ReadingProgress.content_id.in_(lib_ids))
        .filter(ReadingProgress.current_chapter > 0)
        .all()
    )
    progressed_ids = {p.content_id for p in progress_rows}

    # Only books the user actually started reading.
    keep_ids = [cid for cid in lib_ids if cid in progressed_ids]
    if not keep_ids:
        return []

    rows = (
        _published_filter(Content.query)
        .filter(Content.id.in_(keep_ids))
        .all()
    )
    by_id = {b.id: b for b in rows}
    ordered = [by_id[cid] for cid in keep_ids if cid in by_id]
    # Note: continue_reading is intentionally exempt from cross-section dedup
    # at the rotator level. We still respect ``exclude_ids`` here for
    # symmetry but in practice it's always empty for this fetcher.
    return [b for b in ordered if b.id not in exclude_ids][:limit]


def _fetch_for_you(user, exclude_ids: Set[int], limit: int = 12):
    if not user:
        return []
    from ..models import Content
    from .recommendation_service import (
        _build_user_profile, _score_book, _build_collab_scores,
    )

    profile = _build_user_profile(user)
    if not profile.get('genre_counts'):
        return []

    collab = _build_collab_scores(profile) if profile.get('read_book_ids') else {}

    candidates = (
        _published_filter(Content.query)
        .limit(400)
        .all()
    )
    interacted = profile.get('all_interacted_ids', set())

    scored = []
    for book in candidates:
        if book.id in interacted or book.id in exclude_ids:
            continue
        try:
            s = _score_book(book, profile, collab)
        except Exception:
            continue
        if s <= 0:
            continue
        scored.append((s, book))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [b for _, b in scored[:limit]]


def _fetch_spotlight(user, exclude_ids: Set[int], limit: int = 3):
    from .popularity import top_books_by_score

    pool = top_books_by_score(limit=8)
    pool = [b for b in pool if b.id not in exclude_ids]
    if not pool:
        return []

    seed = _daily_seed(user, suffix='spotlight')
    rng = random.Random(seed)
    head = pool[:1]
    tail = pool[1:8]
    rng.shuffle(tail)
    return (head + tail)[:limit]


def _fetch_pulse(user, exclude_ids: Set[int], limit: int = 8):
    from .popularity import top_books_by_score

    pool = top_books_by_score(limit=24, exclude=exclude_ids)
    seed = _daily_seed(user, suffix='pulse')
    rng = random.Random(seed)
    rng.shuffle(pool)
    return pool[:limit]


def _fetch_stream(user, exclude_ids: Set[int], limit: int = 12):
    from .popularity import top_books_by_score

    pool = top_books_by_score(limit=40, exclude=exclude_ids)
    seed = _daily_seed(user, suffix='stream')
    rng = random.Random(seed)
    rng.shuffle(pool)
    return pool[:limit]


def _fetch_top_rated(user, exclude_ids: Set[int], limit: int = 8):
    from .popularity import top_books_by_rating

    return top_books_by_rating(limit=limit + len(exclude_ids), exclude=exclude_ids)[:limit]


def _fetch_latest(user, exclude_ids: Set[int], limit: int = 6):
    """Most recently *published* books (uses ``published_at`` not ``created_at``).

    The pre-V2 home used ``created_at`` which leaked draft creation time
    into the public feed. ``published_at`` is the truthful "fresh off the
    press" signal.
    """
    from ..models import Content

    rows = (
        _published_filter(Content.query)
        .order_by(
            Content.published_at.desc().nullslast(),
            Content.created_at.desc(),
        )
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_premium_picks(user, exclude_ids: Set[int], limit: int = 6):
    from .popularity import premium_books

    try:
        return premium_books(limit=limit + len(exclude_ids), exclude=exclude_ids)[:limit]
    except Exception as exc:
        log.warning("premium_books fetch failed: %s", exc)
        return []


def _fetch_hidden_gems(user, exclude_ids: Set[int], limit: int = 8):
    """High rating, low view count — books deserving of attention."""
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    rows = (
        db.session.query(Content)
        .join(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
            BookPopularityScore.rating_count >= 3,
            BookPopularityScore.avg_rating >= 4.0,
            BookPopularityScore.total_views <= 200,
        )
        .order_by(BookPopularityScore.rating_score.desc().nullslast())
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_quick_reads(user, exclude_ids: Set[int], limit: int = 8):
    """Books with 10 or fewer published chapters — perfect for short sessions."""
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    rows = (
        db.session.query(Content)
        .join(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
            BookPopularityScore.chapter_count > 0,
            BookPopularityScore.chapter_count <= 10,
        )
        .order_by(BookPopularityScore.score.desc().nullslast())
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_long_reads(user, exclude_ids: Set[int], limit: int = 8):
    """Books with 30+ chapters — for readers who want to commit."""
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    rows = (
        db.session.query(Content)
        .join(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
            BookPopularityScore.chapter_count >= 30,
        )
        .order_by(BookPopularityScore.score.desc().nullslast())
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_completed_stories(user, exclude_ids: Set[int], limit: int = 8):
    from ..extensions import db
    from ..models import Content, BookPopularityScore

    rows = (
        db.session.query(Content)
        .outerjoin(BookPopularityScore, Content.id == BookPopularityScore.content_id)
        .filter(
            Content.status == 'complete',
            Content.deleted_at.is_(None),
        )
        .order_by(
            BookPopularityScore.score.desc().nullslast(),
            Content.views.desc().nullslast(),
        )
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_most_favorited_week(user, exclude_ids: Set[int], limit: int = 8):
    """Books with the most favorites added in the last 7 days."""
    from sqlalchemy import func
    from ..extensions import db
    from ..models import Content, Favorite

    cutoff = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.session.query(
            Favorite.content_id,
            func.count(Favorite.id).label('cnt'),
        )
        .filter(Favorite.created_at >= cutoff)
        .group_by(Favorite.content_id)
        .order_by(func.count(Favorite.id).desc())
        .limit(limit + len(exclude_ids) + 5)
        .all()
    )
    if not rows:
        return []
    ranked_ids = [r[0] for r in rows]

    books = (
        _published_filter(Content.query)
        .filter(Content.id.in_(ranked_ids))
        .all()
    )
    by_id = {b.id: b for b in books}
    ordered = [by_id[cid] for cid in ranked_ids if cid in by_id]
    return [b for b in ordered if b.id not in exclude_ids][:limit]


def _fetch_recently_updated(user, exclude_ids: Set[int], limit: int = 8):
    """Books that received a freshly-published chapter in the last 7 days."""
    from sqlalchemy import func
    from ..extensions import db
    from ..models import Content, WebBookContent

    cutoff = datetime.utcnow() - timedelta(days=7)
    rows = (
        db.session.query(
            WebBookContent.content_id,
            func.max(WebBookContent.published_at).label('latest'),
        )
        .filter(
            WebBookContent.status == 'published',
            WebBookContent.published_at >= cutoff,
        )
        .group_by(WebBookContent.content_id)
        .order_by(func.max(WebBookContent.published_at).desc())
        .limit(limit + len(exclude_ids) + 5)
        .all()
    )
    if not rows:
        return []
    ranked_ids = [r[0] for r in rows]

    books = (
        _published_filter(Content.query)
        .filter(Content.id.in_(ranked_ids))
        .all()
    )
    by_id = {b.id: b for b in books}
    ordered = [by_id[cid] for cid in ranked_ids if cid in by_id]
    return [b for b in ordered if b.id not in exclude_ids][:limit]


def _fetch_from_creators_you_follow(user, exclude_ids: Set[int], limit: int = 12):
    if not user:
        return []
    from ..models import Content, Follow

    followed = Follow.query.filter_by(user_id=user.id).limit(200).all()
    creator_ids = [f.creator_id for f in followed]
    if not creator_ids:
        return []

    rows = (
        _published_filter(Content.query)
        .filter(Content.creator_wiam_id.in_(creator_ids))
        .order_by(
            Content.published_at.desc().nullslast(),
            Content.created_at.desc(),
        )
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_wiam_originals(user, exclude_ids: Set[int], limit: int = 8):
    """Editorially-promoted Elite stories — admin curated."""
    from ..extensions import db
    from ..models import Content, EliteStory

    rows = (
        db.session.query(Content)
        .join(EliteStory, EliteStory.content_id == Content.id)
        .filter(
            EliteStory.is_active.is_(True),
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at.is_(None),
        )
        .order_by(EliteStory.promoted_at.desc().nullslast())
        .limit(limit + len(exclude_ids))
        .all()
    )
    return [b for b in rows if b.id not in exclude_ids][:limit]


def _fetch_editor_pick(user, exclude_ids: Set[int], limit: int = 8):
    """Admin-curated BookSection rows (display_order < 100 = top picks)."""
    from ..extensions import db
    from ..models import BookSection

    sections = (
        BookSection.query
        .filter(BookSection.is_active.is_(True), BookSection.display_order < 100)
        .order_by(BookSection.display_order.asc())
        .limit(3)
        .all()
    )
    if not sections:
        return []

    out = []
    seen = set(exclude_ids)
    for sec in sections:
        try:
            books = sec.fetch_books() or []
        except Exception:
            continue
        for b in books:
            if b.id in seen:
                continue
            seen.add(b.id)
            out.append(b)
            if len(out) >= limit:
                return out
    return out


def _fetch_because_you_read(user, exclude_ids: Set[int], limit: int = 8):
    """Top section from ``recommendation_service.because_you_read`` — single
    rail variant. (Multi-rail variant is layered on top in the endpoint
    once we have the user's per-source recs.)
    """
    if not user:
        return []
    from ..models import Content, ReadingProgress

    prog_uid = user.wiam_id or user.id
    recent = (
        ReadingProgress.query
        .filter_by(user_id=prog_uid)
        .order_by(ReadingProgress.last_read_at.desc().nullslast())
        .limit(5)
        .all()
    )
    if not recent:
        return []

    for prog in recent:
        source = Content.query.get(prog.content_id)
        if not source or source.is_deleted:
            continue
        genre = (source.genre or '').strip().lower()
        if not genre:
            continue
        rows = (
            _published_filter(Content.query)
            .filter(
                Content.genre.ilike(f'%{genre}%'),
                Content.id != source.id,
            )
            .order_by(Content.views.desc().nullslast())
            .limit(limit + len(exclude_ids))
            .all()
        )
        filtered = [b for b in rows if b.id not in exclude_ids][:limit]
        if len(filtered) >= 4:
            return filtered
    return []


def _fetch_popular_in_user_genre(suffix: str):
    """Factory: returns a fetcher that picks the user's Nth top genre and
    returns popular books in that genre. ``suffix`` is one of '1', '2', '3'.
    """
    idx = int(suffix) - 1

    def _fetcher(user, exclude_ids: Set[int], limit: int = 10):
        if not user:
            return []
        from ..models import Content
        from .recommendation_service import _build_user_profile

        profile = _build_user_profile(user)
        top_genres = [g for g, _ in profile.get('genre_counts', Counter()).most_common(3)]
        if idx >= len(top_genres):
            return []
        genre = top_genres[idx]
        rows = (
            _published_filter(Content.query)
            .filter(Content.genre.ilike(f'%{genre}%'))
            .order_by(Content.views.desc().nullslast())
            .limit(limit + len(exclude_ids))
            .all()
        )
        return [b for b in rows if b.id not in exclude_ids][:limit]

    return _fetcher


# ---------------------------------------------------------------------------
# Registry
#
# Order matters only for the rotation pool — the tail of this list ends up
# in the rotating pool and is daily-shuffled by the rotator.
# ---------------------------------------------------------------------------

SECTION_REGISTRY: List[Section] = [
    # ── Pinned core ─────────────────────────────────────────────────
    Section(
        key='continue_reading',
        title='Pick up where you left off',
        subtitle='Stories from your library',
        icon='Clock3',
        layout='continue',
        fetcher=_fetch_continue_reading,
        min_books=1,
        pinned=True,
        requires_user=True,
    ),
    Section(
        key='for_you',
        title='For you',
        subtitle='Personalized picks based on what you read',
        icon='Sparkles',
        layout='stream',
        fetcher=_fetch_for_you,
        min_books=4,
        pinned=True,
        requires_user=True,
    ),
    Section(
        key='spotlight',
        title='Spotlight',
        subtitle='Stories everyone is talking about',
        icon='Star',
        layout='spotlight',
        fetcher=_fetch_spotlight,
        min_books=3,
        pinned=True,
    ),
    Section(
        key='top_rated',
        title='Top rated',
        subtitle='Reader favourites',
        icon='Trophy',
        layout='stream',
        fetcher=_fetch_top_rated,
        min_books=4,
        pinned=True,
    ),
    Section(
        key='from_creators_you_follow',
        title='From creators you follow',
        subtitle='Latest from your favourite writers',
        icon='Users',
        layout='stream',
        fetcher=_fetch_from_creators_you_follow,
        min_books=3,
        pinned=True,
        requires_user=True,
    ),
    # ── Rotating pool: engagement / discovery ───────────────────────
    Section(
        key='pulse',
        title='Pulse right now',
        subtitle='Stories with momentum',
        icon='Zap',
        layout='pulse',
        fetcher=_fetch_pulse,
        min_books=4,
    ),
    Section(
        key='stream',
        title='Keep the stream going',
        subtitle='Fresh recommendations',
        icon='Sparkles',
        layout='stream',
        fetcher=_fetch_stream,
        min_books=4,
    ),
    Section(
        key='latest',
        title='Fresh off the press',
        subtitle='Just published',
        icon='Sparkles',
        layout='stream',
        fetcher=_fetch_latest,
        min_books=3,
    ),
    Section(
        key='premium_picks',
        title='Premium picks',
        subtitle='Stories with exclusive chapters',
        icon='Crown',
        layout='stream',
        fetcher=_fetch_premium_picks,
        min_books=3,
    ),
    Section(
        key='hidden_gems',
        title='Hidden gems',
        subtitle='Highly rated, waiting to be discovered',
        icon='Gem',
        layout='mosaic',
        fetcher=_fetch_hidden_gems,
        min_books=3,
    ),
    Section(
        key='quick_reads',
        title='Quick reads',
        subtitle='Short stories for short breaks',
        icon='Coffee',
        layout='stream',
        fetcher=_fetch_quick_reads,
        min_books=3,
    ),
    Section(
        key='long_reads',
        title='Long reads',
        subtitle='Stories you can sink into',
        icon='BookOpen',
        layout='stream',
        fetcher=_fetch_long_reads,
        min_books=3,
    ),
    Section(
        key='completed_stories',
        title='Completed stories',
        subtitle='Read from start to finish',
        icon='CheckCircle',
        layout='stream',
        fetcher=_fetch_completed_stories,
        min_books=3,
    ),
    Section(
        key='most_favorited_week',
        title='Most loved this week',
        subtitle='Trending favourites',
        icon='Heart',
        layout='mosaic',
        fetcher=_fetch_most_favorited_week,
        min_books=3,
    ),
    Section(
        key='recently_updated',
        title='Just updated',
        subtitle='New chapters this week',
        icon='RefreshCw',
        layout='stream',
        fetcher=_fetch_recently_updated,
        min_books=3,
    ),
    # ── Rotating pool: editorial / themed ───────────────────────────
    Section(
        key='wiam_originals',
        title='WiamApp originals',
        subtitle='Stories we love',
        icon='Award',
        layout='stream',
        fetcher=_fetch_wiam_originals,
        min_books=3,
    ),
    Section(
        key='editor_pick',
        title="Editor's pick",
        subtitle='Hand-picked this week',
        icon='Bookmark',
        layout='stream',
        fetcher=_fetch_editor_pick,
        min_books=3,
    ),
    # ── Rotating pool: personalized ─────────────────────────────────
    Section(
        key='because_you_read',
        title='Because you read recently',
        subtitle='Stories matched to your last reads',
        icon='Heart',
        layout='stream',
        fetcher=_fetch_because_you_read,
        min_books=3,
        requires_user=True,
    ),
    Section(
        key='popular_in_genre_1',
        title='Popular in your top genre',
        subtitle='Stories matched to what you love',
        icon='Flame',
        layout='stream',
        fetcher=_fetch_popular_in_user_genre('1'),
        min_books=3,
        requires_user=True,
    ),
    Section(
        key='popular_in_genre_2',
        title='More from another genre you love',
        subtitle='Branching out a little',
        icon='Flame',
        layout='stream',
        fetcher=_fetch_popular_in_user_genre('2'),
        min_books=3,
        requires_user=True,
    ),
    Section(
        key='popular_in_genre_3',
        title='And another favourite genre',
        subtitle='Mixing things up',
        icon='Flame',
        layout='stream',
        fetcher=_fetch_popular_in_user_genre('3'),
        min_books=3,
        requires_user=True,
    ),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _daily_seed(user, suffix: str = '') -> str:
    uid = user.id if user else 'anon'
    return f"{uid}:{_date.today().isoformat()}:{suffix}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_home(user, target_count: int = 8) -> dict:
    """Single-pass home assembly used by ``api_v1.home_feed``.

    Returns::

        {
          'sections': [{'section': Section, 'books': [Content,...]}, ...],
          'legacy_pools': {'spotlight': [...], 'pulse': [...], ...},
          'continue_reading': [Content, ...],   # always exposed for legacy key
          'all_book_ids': set(int),             # union for batch caches
        }

    Runs each fetcher exactly once; the same fetched lists feed both the
    new ``sections[]`` array (with pin + rotate logic) and the legacy
    pools (with fixed-order dedup so old clients keep their dedup
    invariant).
    """
    section_map = {s.key: s for s in SECTION_REGISTRY}

    # Pass 1 — prefetch every eligible section (no dedup yet).
    fetched: dict = {}
    for section in SECTION_REGISTRY:
        if section.requires_user and not user:
            continue
        try:
            books = section.fetcher(user, set(), _FETCH_LIMIT)
        except Exception as exc:
            log.warning("home section %s fetch failed: %s", section.key, exc)
            continue
        if len(books) >= section.min_books:
            fetched[section.key] = books

    # Pass 2 — legacy pools (fixed order, cross-section dedup).
    # This preserves the pre-V2 contract for older mobile builds that read
    # ``spotlight`` / ``pulse`` / ``stream`` / ``latest`` / ``top_rated`` /
    # ``premium_picks`` directly. New ``sections[]`` clients will ignore
    # these. Removal target: once Render telemetry shows zero clients on
    # the old shape (track via a mobile build version header).
    legacy_pools: dict = {}
    legacy_placed: Set[int] = set()
    for key in ('spotlight', 'pulse', 'stream', 'latest', 'top_rated', 'premium_picks'):
        if key not in fetched:
            legacy_pools[key] = []
            continue
        books = [b for b in fetched[key] if b.id not in legacy_placed]
        cap = _LEGACY_CAPS.get(key, 12)
        books = books[:cap]
        legacy_pools[key] = books
        legacy_placed.update(b.id for b in books)

    # Pass 3 — new sections[] with pin + rotate.
    #
    # Two-stage process:
    #   a) PICK which sections appear today: pinned + N from a daily-shuffled
    #      rotating pool. The shuffle answers "which 4-6 supporting sections
    #      does this user see today vs tomorrow".
    #   b) ASSEMBLE in ASSEMBLY_PRIORITY order so engagement-driven rails
    #      (pulse, stream, top_rated) claim books BEFORE date-based rails
    #      (latest). On thin catalogues the "latest" rail can otherwise
    #      drain the score pool and leave nothing for pulse/stream.
    #   c) RENDER in user-facing order: pinned in PINNED_ORDER first, then
    #      the daily-shuffled rotating sections after. The user sees their
    #      familiar pinned rails up top, then today's surprise mix below.
    pinned_keys = [k for k in PINNED_ORDER if k in fetched]
    rotating_pool = [
        s.key for s in SECTION_REGISTRY
        if s.key in fetched and s.key not in pinned_keys
    ]
    seed = _daily_seed(user)
    rng = random.Random(seed)
    rng.shuffle(rotating_pool)

    rotating_count = max(0, target_count - len(pinned_keys))
    picked_rotating = rotating_pool[:rotating_count]

    # (b) Assembly with cross-section dedup, in ASSEMBLY_PRIORITY order.
    included = set(pinned_keys + picked_rotating)
    assembly_order = [k for k in ASSEMBLY_PRIORITY if k in included]
    # Defensive: any section not in ASSEMBLY_PRIORITY (shouldn't happen,
    # but guards against forgetting to register a new key) goes last so
    # the dedup pass still hits it.
    leftovers = [k for k in (pinned_keys + picked_rotating) if k not in assembly_order]
    assembly_order = assembly_order + leftovers

    sections_placed: Set[int] = set()
    sections_built: dict = {}
    for key in assembly_order:
        section = section_map[key]
        books = fetched[key]
        if key != 'continue_reading':
            books = [b for b in books if b.id not in sections_placed]
        if len(books) < section.min_books:
            continue
        cap = _LAYOUT_CAPS.get(section.layout, 12)
        books = books[:cap]
        if key != 'continue_reading':
            sections_placed.update(b.id for b in books)
        sections_built[key] = {'section': section, 'books': books}

    # (c) Render order: pinned first (in PINNED_ORDER), then rotating in
    # the daily-shuffled order (so today's picks appear in a fresh sequence
    # tomorrow even if the same sections survive both days).
    sections_out = []
    for key in pinned_keys:
        if key in sections_built:
            sections_out.append(sections_built[key])
    for key in picked_rotating:
        if key in sections_built:
            sections_out.append(sections_built[key])

    # Union of every book we touched — the endpoint uses this to batch-load
    # creator caches in two queries instead of N+1.
    all_ids: Set[int] = set()
    for entry in sections_out:
        all_ids.update(b.id for b in entry['books'])
    for pool in legacy_pools.values():
        all_ids.update(b.id for b in pool)

    return {
        'sections': sections_out,
        'legacy_pools': legacy_pools,
        'continue_reading': fetched.get('continue_reading', []),
        'all_book_ids': all_ids,
    }


def daily_rotation(user, target_count: int = 8) -> List[dict]:
    """Lightweight wrapper exposing only the new ``sections[]`` list.

    Useful for tests and the dedup audit script. The endpoint uses
    :func:`build_home` directly because it also needs the legacy pools.
    """
    return build_home(user, target_count=target_count)['sections']
