"""
WiamApp — AI Home Curation Service
====================================
Runs once per day (05:00 UTC). SQL gathers top 300 books with metadata,
sends to Gemini in a single API call, gets back curated book IDs for
11 home page sections. Results cached in PlatformSetting as JSON.

Home page reads from cache — zero AI calls per request.
If cache is missing or stale, existing SQL queries run as fallback.
"""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import (
    Content, Rating, Favorite, WebBookContent, ReadingProgress,
    ChapterLike, ChapterComment, PlatformSetting, Genre,
)

log = logging.getLogger(__name__)

CACHE_KEY = 'ai_home_curation'
CACHE_MAX_AGE_HOURS = 25  # Slightly over 24h so daily job always refreshes

_PUB = ['ongoing', 'complete', 'approved', 'published']


def _gather_book_metadata(limit=300):
    """Gather top books with metadata for AI curation. Pure SQL, zero AI cost."""

    # Sub-queries for aggregated metrics
    rating_sq = db.session.query(
        Rating.content_id,
        func.avg(Rating.rating).label('avg_rating'),
        func.count(Rating.id).label('num_ratings'),
    ).group_by(Rating.content_id).subquery()

    fav_sq = db.session.query(
        Favorite.content_id,
        func.count(Favorite.id).label('fav_count'),
    ).group_by(Favorite.content_id).subquery()

    chapter_sq = db.session.query(
        WebBookContent.content_id,
        func.count(WebBookContent.id).label('ch_count'),
    ).filter(
        WebBookContent.status == 'published',
    ).group_by(WebBookContent.content_id).subquery()

    like_sq = db.session.query(
        ChapterLike.content_id,
        func.count(ChapterLike.id).label('like_count'),
    ).group_by(ChapterLike.content_id).subquery()

    comment_sq = db.session.query(
        ChapterComment.content_id,
        func.count(ChapterComment.id).label('comment_count'),
    ).filter(ChapterComment.is_deleted == False).group_by(ChapterComment.content_id).subquery()

    # Recent activity (last 48h)
    cutoff_48h = datetime.utcnow() - timedelta(hours=48)
    recent_ch_sq = db.session.query(
        WebBookContent.content_id,
        func.count(WebBookContent.id).label('recent_chapters'),
    ).filter(
        WebBookContent.created_at >= cutoff_48h,
        WebBookContent.status == 'published',
    ).group_by(WebBookContent.content_id).subquery()

    # Composite engagement score for sorting
    eng_score = (
        func.coalesce(Content.views, 0) +
        func.coalesce(rating_sq.c.num_ratings, 0) * 5 +
        func.coalesce(fav_sq.c.fav_count, 0) * 3 +
        func.coalesce(like_sq.c.like_count, 0) * 2 +
        func.coalesce(comment_sq.c.comment_count, 0) * 2
    )

    rows = (
        db.session.query(
            Content.id,
            Content.title,
            Content.genre,
            Content.status,
            Content.views,
            Content.created_at,
            Content.cover_file_id,
            Content.is_apex,
            func.coalesce(rating_sq.c.avg_rating, 0).label('avg_rating'),
            func.coalesce(rating_sq.c.num_ratings, 0).label('num_ratings'),
            func.coalesce(fav_sq.c.fav_count, 0).label('fav_count'),
            func.coalesce(chapter_sq.c.ch_count, 0).label('ch_count'),
            func.coalesce(like_sq.c.like_count, 0).label('like_count'),
            func.coalesce(comment_sq.c.comment_count, 0).label('comment_count'),
            func.coalesce(recent_ch_sq.c.recent_chapters, 0).label('recent_chapters'),
        )
        .outerjoin(rating_sq, rating_sq.c.content_id == Content.id)
        .outerjoin(fav_sq, fav_sq.c.content_id == Content.id)
        .outerjoin(chapter_sq, chapter_sq.c.content_id == Content.id)
        .outerjoin(like_sq, like_sq.c.content_id == Content.id)
        .outerjoin(comment_sq, comment_sq.c.content_id == Content.id)
        .outerjoin(recent_ch_sq, recent_ch_sq.c.content_id == Content.id)
        .filter(
            Content.status.in_(_PUB),
            Content.deleted_at == None,
        )
        .order_by(eng_score.desc())
        .limit(limit)
        .all()
    )

    books = []
    now = datetime.utcnow()
    for r in rows:
        age_days = max((now - r.created_at).days, 1) if r.created_at else 1
        books.append({
            'id': r.id,
            'title': r.title or 'Untitled',
            'genre': r.genre or 'Unknown',
            'status': r.status,
            'views': int(r.views or 0),
            'avg_rating': round(float(r.avg_rating), 1),
            'num_ratings': int(r.num_ratings),
            'favorites': int(r.fav_count),
            'chapters': int(r.ch_count),
            'likes': int(r.like_count),
            'comments': int(r.comment_count),
            'recent_chapters': int(r.recent_chapters),
            'age_days': age_days,
            'has_cover': bool(r.cover_file_id),
            'is_complete': r.status == 'complete',
            'is_apex': bool(r.is_apex),
        })

    return books


def _build_curation_prompt():
    """Build the system prompt for AI curation."""
    # Get available genres
    genres = [g.name for g in Genre.query.all()]
    genre_list = ', '.join(genres[:20]) if genres else 'Romance, Fantasy, Mystery, Thriller, Sci-Fi'

    return f"""You are the WiamApp Content Curator — an expert at selecting the best books for readers.

You will receive a JSON list of books with their metadata. Your job is to pick the best books for each home page section.

AVAILABLE GENRES: {genre_list}

SECTIONS TO CURATE (return book IDs for each):

1. "hero_picks" — 5 books for the hero banner. Must have covers (has_cover=true), high engagement, variety of genres.
2. "trending" — 10 books with the most recent activity (recent_chapters > 0, high views/age ratio). These are HOT right now.
3. "popular_week" — 10 books that are popular this week. High views + ratings + favorites.
4. "top_rated" — 10 books with the best avg_rating AND enough ratings (num_ratings >= 3). Quality matters most.
5. "staff_picks" — 8 books YOU think are the best quality overall. Mix of genres, strong engagement, good writing indicators.
6. "hidden_gems" — 8 books with LOW views but HIGH favorites/ratings ratio. Underrated treasures.
7. "rising_stars" — 8 NEW books (age_days < 30) gaining traction fast. High views-per-day.
8. "completed" — 8 completed books (is_complete=true) with good ratings.
9. "long_reads" — 6 books with many chapters (chapters >= 15). Immersive epics.
10. "quick_reads" — 6 books with few chapters (chapters <= 5). Fast reads.
11. "recently_updated" — 8 books with recent_chapters > 0. Fresh content.

RULES:
- Each section must contain ONLY valid book IDs from the input list.
- A book can appear in MULTIPLE sections if it qualifies.
- Prioritise quality and diversity — don't fill sections with the same genre.
- If a section can't be filled (not enough qualifying books), return fewer IDs.
- Return ONLY a JSON object mapping section names to arrays of book IDs.
- No explanations, no markdown, just the JSON."""


def run_daily_curation():
    """Run the daily AI curation job. Called by the scheduler.

    Returns: dict with results or error info.
    """
    from .ai_service import json_completion

    log.info("Starting daily AI home curation...")

    # Step 1: Gather book metadata (SQL, free)
    books = _gather_book_metadata(limit=300)
    if not books:
        log.warning("No books found for curation — skipping")
        return {'status': 'skipped', 'reason': 'no_books'}

    log.info("Gathered %d books for curation", len(books))

    # Step 2: Send to AI (1 Gemini call)
    system_prompt = _build_curation_prompt()
    user_message = json.dumps(books, default=str)

    curation = json_completion(system_prompt, user_message, max_tokens=4096, temperature=0.3)

    if not curation or not isinstance(curation, dict):
        log.error("AI curation failed — no valid response")
        return {'status': 'failed', 'reason': 'ai_error'}

    # Step 3: Validate — ensure all IDs are real book IDs
    valid_ids = {b['id'] for b in books}
    validated = {}
    for section, ids in curation.items():
        if isinstance(ids, list):
            clean_ids = [int(i) for i in ids if isinstance(i, (int, float)) and int(i) in valid_ids]
            if clean_ids:
                validated[section] = clean_ids

    if not validated:
        log.error("AI curation returned no valid sections")
        return {'status': 'failed', 'reason': 'no_valid_sections'}

    # Step 4: Store in PlatformSetting
    cache_data = {
        'sections': validated,
        'curated_at': datetime.utcnow().isoformat(),
        'book_count': len(books),
    }

    setting = PlatformSetting.query.filter_by(key=CACHE_KEY).first()
    if not setting:
        setting = PlatformSetting(
            key=CACHE_KEY,
            value_type='json',
            description='AI-curated home page sections (auto-refreshed daily)',
        )
        db.session.add(setting)

    setting.set_value(cache_data)
    setting.updated_at = datetime.utcnow()
    db.session.commit()

    log.info("AI home curation complete — %d sections curated", len(validated))
    return {'status': 'success', 'sections': list(validated.keys()), 'book_count': len(books)}


def get_cached_curation():
    """Read the cached AI curation. Returns dict of section→[book_ids] or None.

    Home page calls this — zero AI cost.
    """
    try:
        setting = PlatformSetting.query.filter_by(key=CACHE_KEY).first()
        if not setting:
            return None

        data = setting.value
        if not isinstance(data, dict) or 'sections' not in data:
            return None

        # Check freshness
        curated_at = data.get('curated_at', '')
        if curated_at:
            try:
                ts = datetime.fromisoformat(curated_at)
                age_hours = (datetime.utcnow() - ts).total_seconds() / 3600
                if age_hours > CACHE_MAX_AGE_HOURS:
                    log.warning("AI curation cache is stale (%.1fh old)", age_hours)
                    return None
            except (ValueError, TypeError):
                pass

        return data['sections']
    except Exception as e:
        log.error("Error reading AI curation cache: %s", e)
        return None


def get_ai_books_for_section(section_name, fallback_books=None):
    """Get AI-curated books for a specific section.

    Returns the AI-picked books if available, otherwise returns fallback_books.
    This is the function home.py should call for AI-controlled sections.
    """
    curation = get_cached_curation()
    if not curation:
        return fallback_books or []

    book_ids = curation.get(section_name)
    if not book_ids:
        return fallback_books or []

    # Fetch actual Content objects, preserving AI's ordering
    books = Content.query.filter(
        Content.id.in_(book_ids),
        Content.status.in_(_PUB),
        Content.deleted_at == None,
    ).all()

    # Preserve AI ordering
    id_to_book = {b.id: b for b in books}
    ordered = [id_to_book[bid] for bid in book_ids if bid in id_to_book]

    return ordered if ordered else (fallback_books or [])
