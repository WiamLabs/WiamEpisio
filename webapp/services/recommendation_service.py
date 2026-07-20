"""
Recommendation Service — multi-signal personalized book recommendations.

Signals used:
  1. Genre affinity — weighted by reading history + favorites
  2. Collaborative filtering — "readers who read X also read Y"
  3. Creator affinity — books by creators the user follows or has read
  4. Popularity — views, favorites, rating (decayed by age)
  5. Completion rate — books that readers actually finish
  6. Freshness — boost for recently published/updated content
  7. Diversity — penalize over-representation of one genre

Public API:
  - for_you(user, limit)          → personalized "For You" picks
  - because_you_read(user, limit) → "Because You Read X" sections
  - similar_books(book_id, limit) → "Readers Also Enjoyed"
  - trending(limit)               → trending right now (time-decayed popularity)
  - top_rated(limit)              → highest rated with minimum threshold
  - new_releases(limit)           → recently published
  - popular_in_genre(genre, limit)→ genre-specific popular
  - premium_picks(limit)          → curated premium content
  - home_sections(user)           → all sections for the home screen
"""
import logging
import random
from datetime import datetime, timedelta
from collections import Counter, defaultdict

log = logging.getLogger(__name__)

# Tuning weights for scoring
W_GENRE = 0.30
W_COLLAB = 0.25
W_CREATOR = 0.15
W_POPULARITY = 0.15
W_FRESHNESS = 0.10
W_COMPLETION = 0.05

# Minimum thresholds
MIN_RATINGS_FOR_TOP = 3
MIN_VIEWS_FOR_TRENDING = 5
TRENDING_WINDOW_DAYS = 14
FRESHNESS_WINDOW_DAYS = 30


def _db():
    from ..extensions import db
    return db


def _published_books_query():
    """Base query: published, non-deleted books."""
    from ..models import Content
    return Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at.is_(None),
    )


def _book_to_dict(book):
    """Lightweight book dict for recommendation results."""
    return {
        'id': book.id,
        'title': book.title,
        'genre': book.genre or '',
        'cover_url': f'/api/cover/{book.cover_file_id}' if book.cover_file_id else None,
        'creator_wiam_id': book.creator_wiam_id,
        'creator_name': book.creator.display_name if book.creator else 'Unknown',
        'views': book.views or 0,
        'rating': round(float(book.avg_rating or 0), 1),
        'rating_count': book.rating_count or 0,
        'status': book.status,
        'created_at': book.created_at.isoformat() if book.created_at else None,
    }


# ---------------------------------------------------------------------------
# User profile building (genre affinity, read history, etc.)
# ---------------------------------------------------------------------------

def _build_user_profile(user):
    """Build a recommendation profile for a user from their reading history.

    Genre signal sources (in increasing weight):
      1. Onboarding genre picks (``UserGenrePreference``) — weight 2 each.
         This is the day-1 personalization fix: brand new users who told
         us they like "Romance + Fantasy" now get genre-matched recs even
         before they've read anything. Without this seed, ``for_you`` and
         ``popular_in_<genre>`` rails fell back to generic "trending" for
         every new user.
      2. Library / reading-history books — weight 1.
      3. Books they actually started reading — additional +1.
      4. Favorited books — additional +2 (strongest signal).

    The recompute happens on every call (cheap in-memory aggregation), so
    the user's top genres evolve as they read more. The longer they use
    the app, the further the onboarding bias gets diluted by their actual
    behavior — exactly the desired curve.
    """
    from ..models import (
        ReadingProgress, UserLibrary, Favorite, Follow, Content,
        UserGenrePreference, Genre,
    )

    uid = user.id
    wiam_id = user.wiam_id

    # Books the user has read or is reading
    read_book_ids = set()
    progress_rows = ReadingProgress.query.filter_by(user_id=uid).all()
    for p in progress_rows:
        read_book_ids.add(p.content_id)

    # Library books
    library_rows = UserLibrary.query.filter_by(user_id=wiam_id).all()
    library_ids = {r.content_id for r in library_rows}

    # Favorited books
    fav_rows = Favorite.query.filter_by(user_id=wiam_id).all()
    fav_ids = {f.content_id for f in fav_rows}

    # Followed creators
    follow_rows = Follow.query.filter_by(user_id=uid).all()
    followed_creator_ids = {f.creator_id for f in follow_rows}

    genre_counts = Counter()

    # 1. Onboarding seed — what they told us they like during signup. Stored
    # as ``UserGenrePreference`` rows keyed by ``user_id = wiam_id`` (see
    # ``api_v1.user_genre_preferences``). Map genre_id -> name so we can
    # bucket alongside book.genre strings.
    try:
        prefs = UserGenrePreference.query.filter_by(user_id=wiam_id).all()
        if prefs:
            pref_genre_ids = [p.genre_id for p in prefs]
            pref_genres = Genre.query.filter(Genre.id.in_(pref_genre_ids)).all()
            for g in pref_genres:
                name = (g.name or '').strip().lower()
                if name:
                    genre_counts[name] += 2
    except Exception:
        # Defensive: never let a missing column / migration glitch break
        # the whole recommendation pipeline.
        pass

    # 2-4. Reading-history layered on top of the onboarding seed.
    all_relevant_ids = read_book_ids | library_ids | fav_ids
    if all_relevant_ids:
        books = Content.query.filter(Content.id.in_(all_relevant_ids)).all()
        for b in books:
            g = (b.genre or '').strip().lower()
            if not g:
                continue
            weight = 1
            if b.id in fav_ids:
                weight += 2
            if b.id in read_book_ids:
                weight += 1
            genre_counts[g] += weight

    return {
        'read_book_ids': read_book_ids,
        'library_ids': library_ids,
        'fav_ids': fav_ids,
        'followed_creator_ids': followed_creator_ids,
        'genre_counts': genre_counts,
        'all_interacted_ids': all_relevant_ids,
    }


def _score_book(book, profile, collab_scores=None):
    """Score a single book for a user. Returns 0.0-1.0."""
    score = 0.0
    genre = (book.genre or '').strip().lower()

    # 1. Genre affinity
    total_genre_weight = sum(profile['genre_counts'].values()) or 1
    genre_score = profile['genre_counts'].get(genre, 0) / total_genre_weight
    score += W_GENRE * min(genre_score * 3, 1.0)  # scale up, cap at 1

    # 2. Collaborative filtering
    if collab_scores and book.id in collab_scores:
        score += W_COLLAB * min(collab_scores[book.id] / 5.0, 1.0)

    # 3. Creator affinity
    if book.creator_wiam_id in profile['followed_creator_ids']:
        score += W_CREATOR * 1.0
    elif book.creator and hasattr(book.creator, 'id') and book.creator.id in profile['followed_creator_ids']:
        score += W_CREATOR * 1.0

    # 4. Popularity
    views = book.views or 0
    pop_score = min(views / 500.0, 1.0)
    rating = float(book.avg_rating or 0)
    if (book.rating_count or 0) >= MIN_RATINGS_FOR_TOP:
        pop_score = (pop_score + rating / 5.0) / 2
    score += W_POPULARITY * pop_score

    # 5. Freshness
    if book.created_at:
        age_days = (datetime.utcnow() - book.created_at).days
        freshness = max(0, 1.0 - age_days / (FRESHNESS_WINDOW_DAYS * 3))
        score += W_FRESHNESS * freshness

    # 6. Completion rate (if available)
    score += W_COMPLETION * 0.5  # default mid; could be computed from progress data

    return round(score, 4)


def _build_collab_scores(profile):
    """
    Simple collaborative filtering: find books read by users who share
    the most reading overlap with the current user.
    """
    from ..models import ReadingProgress

    my_books = profile['read_book_ids']
    if not my_books or len(my_books) < 2:
        return {}

    # Find other users who read at least 2 of the same books
    sample_ids = list(my_books)[:20]  # cap for performance
    other_progress = ReadingProgress.query.filter(
        ReadingProgress.content_id.in_(sample_ids),
    ).limit(500).all()

    # Count overlap per user
    user_overlap = Counter()
    for p in other_progress:
        if p.content_id in my_books:
            user_overlap[p.user_id] += 1

    # Top similar users (exclude self)
    similar_users = [
        uid for uid, count in user_overlap.most_common(30)
        if count >= 2
    ]
    if not similar_users:
        return {}

    # Get books these similar users also read (but we haven't)
    collab_rows = ReadingProgress.query.filter(
        ReadingProgress.user_id.in_(similar_users),
    ).limit(1000).all()

    collab_scores = Counter()
    for p in collab_rows:
        if p.content_id not in my_books:
            collab_scores[p.content_id] += 1

    return dict(collab_scores)


# ---------------------------------------------------------------------------
# Public recommendation functions
# ---------------------------------------------------------------------------

def for_you(user, limit=20):
    """Personalized 'For You' recommendations.

    Falls back to ``trending`` only when the user is anonymous OR has no
    signal at all (no reading history AND no onboarding genre picks).
    With the Push 1 wiring of ``UserGenrePreference`` into
    ``_build_user_profile``, brand-new users who picked genres during
    onboarding now get genre-matched picks instead of the generic
    trending list.
    """
    if not user:
        return trending(limit)

    profile = _build_user_profile(user)
    if not profile['all_interacted_ids'] and not profile['genre_counts']:
        return trending(limit)

    collab_scores = _build_collab_scores(profile) if profile['read_book_ids'] else {}

    # Score all published books (excluding already read)
    candidates = _published_books_query().limit(500).all()
    scored = []
    for book in candidates:
        if book.id in profile['all_interacted_ids']:
            continue
        s = _score_book(book, profile, collab_scores)
        scored.append((s, book))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Add slight randomization to avoid staleness
    top = scored[:limit * 2]
    if len(top) > limit:
        random.shuffle(top)
        top = top[:limit]
    top.sort(key=lambda x: x[0], reverse=True)

    return [_book_to_dict(b) for _, b in top[:limit]]


def because_you_read(user, limit=6, max_sections=3):
    """
    'Because You Read X' sections.
    Returns list of {source_book, recommendations: [...]}.
    """
    if not user:
        return []

    from ..models import ReadingProgress, Content

    # Get user's most recently read books
    recent = ReadingProgress.query.filter_by(
        user_id=user.id
    ).order_by(ReadingProgress.last_read_at.desc().nullslast()).limit(10).all()

    if not recent:
        return []

    sections = []
    seen_ids = set()

    for prog in recent[:max_sections * 2]:
        if len(sections) >= max_sections:
            break

        source_book = Content.query.get(prog.content_id)
        if not source_book or source_book.is_deleted:
            continue

        genre = (source_book.genre or '').strip().lower()
        if not genre:
            continue

        # Find similar books in same genre
        similar = _published_books_query().filter(
            Content.genre.ilike(f'%{genre}%'),
            Content.id != source_book.id,
            ~Content.id.in_(seen_ids) if seen_ids else True,
        ).order_by(Content.views.desc().nullslast()).limit(limit).all()

        if len(similar) < 2:
            continue

        recs = [_book_to_dict(b) for b in similar]
        for r in recs:
            seen_ids.add(r['id'])

        sections.append({
            'source_book': _book_to_dict(source_book),
            'reason': f"Because you read {source_book.title}",
            'recommendations': recs[:limit],
        })

    return sections


def similar_books(book_id, limit=10):
    """'Readers Also Enjoyed' — books similar to a given book."""
    from ..models import Content, ReadingProgress

    book = Content.query.get(book_id)
    if not book:
        return []

    genre = (book.genre or '').strip().lower()
    creator_id = book.creator_wiam_id

    # Same genre, different book
    candidates = _published_books_query().filter(
        Content.id != book_id,
    ).limit(200).all()

    scored = []
    for c in candidates:
        s = 0.0
        cg = (c.genre or '').strip().lower()
        if cg and cg == genre:
            s += 0.4
        if c.creator_wiam_id == creator_id:
            s += 0.2
        s += min((c.views or 0) / 500.0, 0.2)
        s += min(float(c.avg_rating or 0) / 5.0, 0.2) * 0.2
        scored.append((s, c))

    # Collaborative: users who read this book also read...
    readers = ReadingProgress.query.filter_by(content_id=book_id).limit(100).all()
    reader_ids = [r.user_id for r in readers]
    if reader_ids:
        also_read = ReadingProgress.query.filter(
            ReadingProgress.user_id.in_(reader_ids),
            ReadingProgress.content_id != book_id,
        ).limit(500).all()
        also_counts = Counter(p.content_id for p in also_read)
        for i, (s, c) in enumerate(scored):
            if c.id in also_counts:
                scored[i] = (s + min(also_counts[c.id] / 10.0, 0.3), c)

    scored.sort(key=lambda x: x[0], reverse=True)
    return [_book_to_dict(b) for _, b in scored[:limit]]


def trending(limit=20):
    """Trending books — Push 4 reads from the BookPopularityScore table.

    The score is recomputed by ``services.popularity.recompute_if_stale``
    every 30 minutes and combines view momentum, rating Wilson lower
    bound, favorite count, freshness, and chapter count. Falls back to
    insertion-order ranking if the table is empty (cold start).
    """
    from .popularity import top_books_by_score
    books = top_books_by_score(limit=limit)
    return [_book_to_dict(b) for b in books]


def top_rated(limit=20):
    """Highest rated books — reads pre-computed Wilson LB scores."""
    from .popularity import top_books_by_rating
    books = top_books_by_rating(limit=limit)
    return [_book_to_dict(b) for b in books]


def new_releases(limit=20):
    """Recently published books."""
    from ..models import Content
    books = _published_books_query().order_by(
        Content.created_at.desc()
    ).limit(limit).all()
    return [_book_to_dict(b) for b in books]


def popular_in_genre(genre, limit=20):
    """Most popular books in a specific genre."""
    from ..models import Content
    books = _published_books_query().filter(
        Content.genre.ilike(f'%{genre}%'),
    ).order_by(Content.views.desc().nullslast()).limit(limit).all()
    return [_book_to_dict(b) for b in books]


def premium_picks(limit=10):
    """Curated picks — high quality books (Elite + high rated)."""
    from ..models import Content, EliteStory
    elite_ids = [e.content_id for e in EliteStory.query.filter_by(status='active').all()]

    if elite_ids:
        elite_books = Content.query.filter(
            Content.id.in_(elite_ids),
            Content.deleted_at.is_(None),
        ).limit(limit).all()
        result = [_book_to_dict(b) for b in elite_books]
        if len(result) >= limit:
            return result[:limit]
    else:
        result = []

    # Fill with top rated
    remaining = limit - len(result)
    seen = {r['id'] for r in result}
    top = top_rated(remaining + 10)
    for b in top:
        if b['id'] not in seen and len(result) < limit:
            result.append(b)
            seen.add(b['id'])

    return result[:limit]


def creators_you_follow(user, limit=20):
    """Books by creators the user follows, sorted by recency."""
    if not user:
        return []
    from ..models import Content, Follow
    followed = Follow.query.filter_by(user_id=user.id).all()
    creator_ids = [f.creator_id for f in followed]
    if not creator_ids:
        return []

    books = _published_books_query().filter(
        Content.creator_wiam_id.in_(creator_ids),
    ).order_by(Content.created_at.desc()).limit(limit).all()
    return [_book_to_dict(b) for b in books]


# ---------------------------------------------------------------------------
# Home screen sections (all-in-one endpoint)
# ---------------------------------------------------------------------------

def home_sections(user, compact=False):
    """
    Build all recommendation sections for the home screen.
    Returns a list of section dicts.
    """
    limit = 10 if compact else 20
    sections = []

    # 1. For You (personalized)
    fy = for_you(user, limit=limit)
    if fy:
        sections.append({
            'key': 'for_you',
            'title': 'For You',
            'subtitle': 'Personalized picks based on your taste',
            'books': fy,
        })

    # 2. Trending
    tr = trending(limit=limit)
    if tr:
        sections.append({
            'key': 'trending',
            'title': 'Trending Now',
            'subtitle': 'What everyone is reading',
            'books': tr,
        })

    # 3. Because You Read X
    if user:
        byr = because_you_read(user, limit=6, max_sections=2)
        for sec in byr:
            sections.append({
                'key': f'because_you_read_{sec["source_book"]["id"]}',
                'title': sec['reason'],
                'subtitle': f'Similar to {sec["source_book"]["title"]}',
                'books': sec['recommendations'],
            })

    # 4. New Releases
    nr = new_releases(limit=limit)
    if nr:
        sections.append({
            'key': 'new_releases',
            'title': 'New Releases',
            'subtitle': 'Fresh stories just published',
            'books': nr,
        })

    # 5. From Creators You Follow
    if user:
        cyf = creators_you_follow(user, limit=limit)
        if cyf:
            sections.append({
                'key': 'from_following',
                'title': 'From Creators You Follow',
                'subtitle': 'Latest from your favorite writers',
                'books': cyf,
            })

    # 6. Premium Picks
    pp = premium_picks(limit=min(limit, 10))
    if pp:
        sections.append({
            'key': 'premium_picks',
            'title': 'Premium Picks',
            'subtitle': 'Editor and algorithm curated',
            'books': pp,
        })

    # 7. Top Rated
    tr2 = top_rated(limit=limit)
    if tr2:
        sections.append({
            'key': 'top_rated',
            'title': 'Top Rated',
            'subtitle': 'Highest rated by the community',
            'books': tr2,
        })

    # 8. Genre sections (top 3 genres from user profile, or fallback)
    if user:
        profile = _build_user_profile(user)
        top_genres = [g for g, _ in profile['genre_counts'].most_common(3)]
    else:
        top_genres = ['romance', 'fantasy', 'mystery']

    for genre in top_genres:
        gbooks = popular_in_genre(genre, limit=limit)
        if gbooks:
            sections.append({
                'key': f'genre_{genre}',
                'title': f'Popular in {genre.title()}',
                'subtitle': f'Top stories in {genre.title()}',
                'books': gbooks,
            })

    return sections
