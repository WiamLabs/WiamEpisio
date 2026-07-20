import logging
import random
from datetime import datetime, timedelta
from flask import Blueprint, render_template, redirect, url_for, jsonify, request
from flask_login import login_required, current_user
from sqlalchemy import func, case, literal

log = logging.getLogger(__name__)
from ..models import (
    Content, Genre, Favorite, FeaturedBook, ReadingProgress, Access,
    BookCollection, CollectionItem, Announcement, Rating, SectionSettings,
    WebBookContent, ShareEvent, EliteStory, UserGenrePreference,
    ChapterLike, ChapterComment, ChapterVote,
)
from ..extensions import db

_PUB = Content.PUBLISHED_STATUSES

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AUTO-SCALING THRESHOLDS — adjusts automatically as the platform grows.
# Uses real platform metrics: total users, average views, total books.
# You never need to touch this. It scales from 10 users to 1 million.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_threshold_cache = {'ts': None, 'data': None}

def _get_thresholds():
    """Compute thresholds from live platform data. Cached for 10 minutes."""
    from ..models import User
    now = datetime.utcnow()

    # Return cached if fresh (< 10 min old)
    if _threshold_cache['ts'] and (now - _threshold_cache['ts']).total_seconds() < 600:
        return _threshold_cache['data']

    # ── Gather platform metrics ──
    total_users = db.session.query(func.count(User.id)).scalar() or 1
    total_books = db.session.query(func.count(Content.id)).filter(
        Content.status.in_(_PUB), Content.deleted_at == None
    ).scalar() or 1
    avg_views = float(db.session.query(func.coalesce(func.avg(Content.views), 0)).filter(
        Content.status.in_(_PUB), Content.deleted_at == None
    ).scalar() or 0)
    total_ratings = db.session.query(func.count(Rating.id)).scalar() or 0
    total_favs = db.session.query(func.count(Favorite.id)).scalar() or 0

    # ── Scale factor based on user count ──
    # <100 users = 1.0, 500 users = 2.0, 2000 = 3.5, 10000 = 5.0
    import math
    scale = max(1.0, math.log10(max(total_users, 10)))  # 1.0 → 5.0

    # ── Average engagement per book ──
    avg_ratings_per_book = total_ratings / max(total_books, 1)
    avg_favs_per_book = total_favs / max(total_books, 1)

    # ── Calculate thresholds ──
    # Views: use average * multiplier, with sensible minimums
    trending_views = max(1, int(avg_views * 1.5 * scale))
    popular_views = max(1, int(avg_views * 0.8 * scale))
    for_you_views = max(0, int(avg_views * 0.3))
    rising_views = max(0, int(avg_views * 0.5))
    completed_views = max(0, int(avg_views * 0.3))
    genre_views = max(0, int(avg_views * 0.2))
    gems_ceiling = max(500, int(avg_views * 1.0))

    # Favorites: scale with engagement
    min_favs = max(1, int(avg_favs_per_book * 1.5))
    gems_favs = max(0, int(avg_favs_per_book * 0.5))

    # Ratings: scale with engagement
    min_ratings = max(1, int(avg_ratings_per_book * 1.5))

    t = {
        'trending_min_views':       trending_views,
        'for_you_min_views':        for_you_views,
        'popular_week_min_views':   popular_views,
        'rising_stars_max_age_days': 30,
        'rising_stars_min_views':   rising_views,
        'completed_min_views':      completed_views,
        'most_favorited_min_favs':  min_favs,
        'hidden_gems_max_views':    gems_ceiling,
        'hidden_gems_min_favs':     gems_favs,
        'top_rated_min_ratings':    min_ratings,
        'top_rated_min_avg':        3.5,
        'long_reads_min_chapters':  10,
        'quick_reads_max_chapters': 5,
        'recently_updated_days':    7,
        'genre_section_min_views':  genre_views,
    }

    _threshold_cache['ts'] = now
    _threshold_cache['data'] = t
    return t

home_bp = Blueprint('home', __name__)


@home_bp.route('/debug/books')
@login_required
def debug_books():
    """Diagnostic: show book statuses in the DB (founder only)."""
    if not (current_user.is_admin or current_user.is_founder):
        return jsonify(error='forbidden'), 403
    # Use count() queries instead of loading ALL rows (saves huge DB bandwidth)
    total_in_db = Content.query.count()
    total_not_deleted = Content.query.filter(Content.deleted_at == None).count()
    total_published = Content.query.filter(Content.status.in_(_PUB), Content.deleted_at == None).count()
    total_deleted = Content.query.filter(Content.deleted_at != None).count()

    # Status breakdown via GROUP BY (1 query instead of loading all rows)
    status_rows = db.session.query(
        Content.status, func.count(Content.id)
    ).group_by(Content.status).all()
    statuses = {(s or 'NULL'): c for s, c in status_rows}

    # Only load recent 50 books for the detail list (not ALL)
    recent = Content.query.order_by(Content.created_at.desc()).limit(50).all()
    data = {
        'total_in_db': total_in_db,
        'total_books_not_deleted': total_not_deleted,
        'total_published': total_published,
        'total_deleted': total_deleted,
        'PUBLISHED_STATUSES': _PUB,
        'statuses': statuses,
        'books': [{
            'id': b.id, 'title': b.title, 'status': b.status,
            'views': b.views, 'genre': b.genre,
            'cover': bool(b.cover_file_id),
            'deleted': b.deleted_at is not None,
            'published_at': str(b.published_at) if b.published_at else None,
        } for b in recent],
    }
    return jsonify(data)


@home_bp.route('/.well-known/apple-developer-merchantid-domain-association')
def apple_pay_verification():
    """Serve Apple Pay domain verification file for Paystack."""
    import os
    from flask import send_from_directory, current_app
    well_known_dir = os.path.join(current_app.static_folder, '.well-known')
    return send_from_directory(well_known_dir, 'apple-developer-merchantid-domain-association',
                               mimetype='text/plain')


_landing_cache = {'ts': None, 'covers': []}

# Per-user home page HTML cache — avoids re-running 20+ queries within 5 min
_home_html_cache = {}          # {uid: {'ts': datetime, 'html': str}}
_HOME_CACHE_TTL = 300          # seconds (5 min — reduces Neon DB calls)

# Global cache for non-personalized sections (same for ALL users)
_global_sections_cache = {'ts': None, 'data': None}
_GLOBAL_SECTIONS_TTL = 600     # 10 minutes — trending/popular/genres rarely change

# Genre list cache (genres almost never change)
_genre_cache = {'ts': None, 'genres': []}

@home_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('home.home'))
    # Cache landing covers for 5 minutes (most-hit public page)
    now = datetime.utcnow()
    if _landing_cache['ts'] is None or (now - _landing_cache['ts']).total_seconds() > 300:
        _pub = Content.PUBLISHED_STATUSES if hasattr(Content, 'PUBLISHED_STATUSES') else ['published', 'approved']
        cover_books = Content.query.filter(
            Content.status.in_(_pub),
            Content.deleted_at == None,
            Content.cover_file_id != None, Content.cover_file_id != '',
        ).order_by(Content.views.desc()).limit(30).all()
        _landing_cache['covers'] = [b.cover_url for b in cover_books if b.cover_url and '/default_cover' not in b.cover_url]
        _landing_cache['ts'] = now
    landing_covers = _landing_cache['covers']
    return render_template('landing.html', landing_covers=landing_covers)


@home_bp.route('/home')
@login_required
def home():
    uid = current_user.wiam_id or current_user.id
    now = datetime.utcnow()

    # Serve from cache if fresh (< 60s old)
    cached = _home_html_cache.get(uid)
    if cached and (now - cached['ts']).total_seconds() < _HOME_CACHE_TTL:
        return cached['html']

    # Evict stale entries (keep cache from growing unbounded)
    stale_uids = [k for k, v in _home_html_cache.items()
                  if (now - v['ts']).total_seconds() > _HOME_CACHE_TTL * 5]
    for k in stale_uids:
        _home_html_cache.pop(k, None)

    try:
        html = _home_render()
        _home_html_cache[uid] = {'ts': now, 'html': html}
        return html
    except Exception as e:
        log.error("Home page error: %s", e, exc_info=True)
        db.session.rollback()
        try:
            return render_template('home.html',
                featured=[], latest=[], trending=[], popular_week=[], top_rated=[],
                genres=[], fav_ids=set(), continue_reading=[], recommended=[],
                collections=[], wiam_top_picks=[], whats_new=[],
                latest_announcement=None, sec_featured=None, sec_collections=None,
                sec_top_picks=None, elite_stories=[], elite_ids=set(),
                completed_stories=[], hidden_gems=[], most_favorited=[],
                recently_updated=[], genre_sections=[], long_reads=[], quick_reads=[],
                hero_books=[], because_you_read=[], byr_book=None,
                because_you_love=[], byl_genre=None, rising_stars=[], for_you=[],
                section_order=[], total_published=0,
            )
        except Exception:
            db.session.rollback()
            return '<html><body style="background:#08081a;color:#fff;font-family:sans-serif;text-align:center;padding:80px 20px"><h2>WiamApp</h2><p>Temporarily unable to load the home page. Please refresh.</p></body></html>', 200


def _cap_classics(books, max_classics=2):
    """Ensure creator books come first, with at most `max_classics` classic supplements."""
    creators = [b for b in books if getattr(b, 'source', 'web') != 'gutenberg']
    classics = [b for b in books if getattr(b, 'source', 'web') == 'gutenberg']
    return creators + classics[:max_classics]


def _home_render():
    uid = current_user.wiam_id
    now = datetime.utcnow()

    # ── Base ──
    # Cache genres globally (they almost never change)
    if _genre_cache['ts'] is None or (now - _genre_cache['ts']).total_seconds() > 3600:
        _genre_cache['genres'] = Genre.query.order_by(Genre.name).all()
        _genre_cache['ts'] = now
    genres = _genre_cache['genres']
    base_filter = [Content.status.in_(_PUB), Content.deleted_at == None]

    # Total published count — drives which sections are possible
    total_published = Content.query.filter(*base_filter).count()

    # ALL published books — newest first (the backbone)
    all_published = Content.query.filter(
        *base_filter
    ).order_by(func.coalesce(Content.published_at, Content.created_at).desc()).limit(60).all()

    # ── Hero covers (scrolling banner) ──
    hero_books = []
    if total_published >= 1:
        hero_books = Content.query.filter(
            *base_filter,
            Content.cover_file_id != None, Content.cover_file_id != '',
        ).order_by(Content.views.desc().nullslast()).limit(20).all()

    # ── New Releases — only books published in the last 30 days ──
    # Books graduate out of New Releases once they have 50+ views OR are older than 30 days
    cutoff_new = now - timedelta(days=30)
    new_releases = Content.query.filter(
        *base_filter,
        Content.views < 50,
        db.or_(
            Content.published_at >= cutoff_new,
            db.and_(Content.published_at == None, Content.created_at >= cutoff_new),
        ),
    ).order_by(func.coalesce(Content.published_at, Content.created_at).desc()).limit(15).all()

    # ── Trending — books with real engagement (5+ views) ──
    trending = []
    if total_published >= 1:
        trending = Content.query.filter(
            *base_filter,
            Content.views >= 5,
        ).order_by(Content.algorithm_weight.desc(), Content.views.desc()).limit(14).all()
    trending = _cap_classics(trending)

    # ── Recently updated (chapters added in last 14 days) ──
    recently_updated = []
    try:
        if total_published >= 1:
            cutoff_14d = now - timedelta(days=14)
            recent_cids = [r[0] for r in db.session.query(
                WebBookContent.content_id
            ).filter(
                WebBookContent.created_at >= cutoff_14d,
                WebBookContent.status == 'published',
            ).distinct().limit(20).all()]
            if recent_cids:
                recently_updated = Content.query.filter(
                    Content.id.in_(recent_cids), *base_filter
                ).order_by(Content.created_at.desc()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Completed stories ──
    completed_stories = Content.query.filter(
        Content.status == 'complete', Content.deleted_at == None,
    ).order_by(Content.views.desc().nullslast()).limit(15).all()

    # ── Top rated — need at least 1 rating (scales up as platform grows) ──
    top_rated = []
    try:
        min_ratings = 1 if total_published < 50 else 3
        rated_sq = db.session.query(
            Rating.content_id,
            func.avg(Rating.rating).label('avg_r'),
            func.count(Rating.id).label('cnt'),
        ).group_by(Rating.content_id).having(
            func.count(Rating.id) >= min_ratings
        ).subquery()
        top_rated = db.session.query(Content).join(
            rated_sq, rated_sq.c.content_id == Content.id
        ).filter(*base_filter).order_by(
            rated_sq.c.avg_r.desc(), rated_sq.c.cnt.desc()
        ).limit(15).all()
        top_rated = _cap_classics(top_rated)
    except Exception:
        db.session.rollback()

    # ── Most favorited — need at least 1 favorite (scales up later) ──
    most_favorited = []
    try:
        min_favs = 1 if total_published < 50 else 3
        fav_sq = db.session.query(
            Favorite.content_id,
            func.count(Favorite.id).label('fav_cnt'),
        ).group_by(Favorite.content_id).having(
            func.count(Favorite.id) >= min_favs
        ).subquery()
        most_favorited = db.session.query(Content).join(
            fav_sq, fav_sq.c.content_id == Content.id
        ).filter(*base_filter).order_by(
            fav_sq.c.fav_cnt.desc()
        ).limit(15).all()
        most_favorited = _cap_classics(most_favorited)
    except Exception:
        db.session.rollback()

    # ── Hidden Gems — books with low views but at least 1 favorite ──
    hidden_gems = []
    try:
        hg_fav_sq = db.session.query(
            Favorite.content_id,
            func.count(Favorite.id).label('fav_cnt'),
        ).group_by(Favorite.content_id).having(
            func.count(Favorite.id) >= 1
        ).subquery()
        hidden_gems = db.session.query(Content).join(
            hg_fav_sq, hg_fav_sq.c.content_id == Content.id
        ).filter(
            *base_filter,
            Content.views < 20,
        ).order_by(hg_fav_sq.c.fav_cnt.desc(), func.random()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Popular This Week — most viewed among recent books ──
    popular_week = []
    try:
        week_ago = now - timedelta(days=7)
        popular_week = Content.query.filter(
            *base_filter,
            Content.views >= 3,
        ).order_by(Content.views.desc()).limit(15).all()
        popular_week = _cap_classics(popular_week)
    except Exception:
        db.session.rollback()

    # ── What's New — books published in the last 7 days ──
    whats_new = []
    try:
        week_ago = now - timedelta(days=7)
        whats_new = Content.query.filter(
            *base_filter,
            db.or_(
                Content.published_at >= week_ago,
                db.and_(Content.published_at == None, Content.created_at >= week_ago),
            ),
        ).order_by(func.coalesce(Content.published_at, Content.created_at).desc()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Rising Stars — new books gaining traction fast (created in last 14 days with views) ──
    rising_stars = []
    try:
        cutoff_rising = now - timedelta(days=14)
        rising_stars = Content.query.filter(
            *base_filter,
            Content.created_at >= cutoff_rising,
            Content.views >= 2,
        ).order_by(Content.views.desc()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Genre sections — need 2+ books in a genre to show it ──
    genre_sections = []
    try:
        min_genre_books = 2 if total_published < 50 else 3
        if total_published >= 3:
            genre_counts = db.session.query(
                Content.genre, func.count(Content.id).label('cnt')
            ).filter(
                *base_filter, Content.genre != None, Content.genre != ''
            ).group_by(Content.genre).having(
                func.count(Content.id) >= min_genre_books
            ).order_by(func.count(Content.id).desc()).limit(4).all()

            genre_names = [g[0] for g in genre_counts]
            genre_objs = {g.name: g for g in Genre.query.filter(Genre.name.in_(genre_names)).all()}
            for genre_name, cnt in genre_counts:
                books = Content.query.filter(
                    *base_filter, Content.genre == genre_name
                ).order_by(Content.views.desc().nullslast()).limit(12).all()
                if books:
                    genre_obj = genre_objs.get(genre_name)
                    if not genre_obj:
                        class _G:
                            pass
                        genre_obj = _G()
                        genre_obj.name = genre_name
                    genre_sections.append({'genre': genre_obj, 'books': books})
    except Exception:
        db.session.rollback()

    # ── User favorites ──
    fav_ids = set()
    try:
        fav_ids = {f.content_id for f in Favorite.query.filter_by(user_id=uid).all()}
    except Exception:
        db.session.rollback()

    # ── Continue reading (batch query instead of N+1) ──
    continue_reading = []
    try:
        progresses = ReadingProgress.query.filter_by(user_id=uid).order_by(
            ReadingProgress.last_read_at.desc()
        ).limit(6).all()
        if progresses:
            prog_ids = [p.content_id for p in progresses]
            books_map = {b.id: b for b in Content.query.filter(
                Content.id.in_(prog_ids), Content.deleted_at == None
            ).all()}
            for p in progresses:
                book = books_map.get(p.content_id)
                if book:
                    continue_reading.append({'book': book, 'progress': p})
    except Exception:
        db.session.rollback()

    # ── Featured (from FeaturedBook table) ──
    featured = []
    try:
        feat_ids = [f.content_id for f in FeaturedBook.query.filter_by(is_active=True).all()]
        if feat_ids:
            featured = Content.query.filter(
                Content.id.in_(feat_ids), *base_filter
            ).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Collections ──
    collections_data = []
    try:
        colls = BookCollection.query.filter_by(is_active=True).order_by(
            BookCollection.sort_order
        ).limit(3).all()
        for coll in colls:
            coll_items = db.session.query(Content).join(
                CollectionItem, CollectionItem.content_id == Content.id
            ).filter(
                CollectionItem.collection_id == coll.id, *base_filter
            ).limit(12).all()
            if coll_items:
                collections_data.append({'collection': coll, 'books': coll_items})
    except Exception:
        db.session.rollback()

    # ── Announcement ──
    latest_announcement = None
    try:
        latest_announcement = Announcement.query.filter_by(is_active=True).order_by(
            Announcement.created_at.desc()
        ).first()
    except Exception:
        db.session.rollback()

    # ── Section settings ──
    sec_featured = sec_collections = sec_top_picks = None
    try:
        sec_featured = SectionSettings.get('featured')
        sec_collections = SectionSettings.get('collections')
        sec_top_picks = SectionSettings.get('wiam_top_picks')
    except Exception:
        db.session.rollback()

    # ── Long Reads — books with 50,000+ words ──
    long_reads = []
    try:
        long_reads = Content.query.filter(
            *base_filter,
            Content.word_count >= 50000,
        ).order_by(Content.word_count.desc()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Quick Reads — books with fewer than 10,000 words ──
    quick_reads = []
    try:
        quick_reads = Content.query.filter(
            *base_filter,
            Content.word_count > 0,
            Content.word_count < 10000,
        ).order_by(Content.views.desc().nullslast()).limit(15).all()
    except Exception:
        db.session.rollback()

    # ── Because You Read — find last-read book's genre, show similar ──
    because_you_read = []
    byr_book = None
    because_you_love = []
    byl_genre = None
    try:
        last_progress = ReadingProgress.query.filter_by(user_id=uid).order_by(
            ReadingProgress.last_read_at.desc()
        ).first()
        if last_progress:
            last_book = Content.query.get(last_progress.content_id)
            if last_book and last_book.genre:
                byr_book = last_book
                byl_genre = last_book.genre
                because_you_read = Content.query.filter(
                    *base_filter,
                    Content.genre == last_book.genre,
                    Content.id != last_book.id,
                ).order_by(Content.views.desc().nullslast()).limit(12).all()
                because_you_love = because_you_read  # same genre, same data
    except Exception:
        db.session.rollback()

    # ── For You — personalized: books user hasn't read, prefer higher rated ──
    for_you_deduped = []
    try:
        read_ids = {p.content_id for p in ReadingProgress.query.filter_by(user_id=uid).all()}
        # Try rating-based selection first
        rated_sq = db.session.query(
            Rating.content_id,
            func.avg(Rating.rating).label('avg_r'),
        ).group_by(Rating.content_id).subquery()
        for_you_q = db.session.query(Content).outerjoin(
            rated_sq, rated_sq.c.content_id == Content.id
        ).filter(*base_filter)
        if read_ids:
            for_you_q = for_you_q.filter(~Content.id.in_(read_ids))
        for_you_deduped = for_you_q.order_by(
            rated_sq.c.avg_r.desc().nullslast(), Content.views.desc().nullslast()
        ).limit(15).all()
    except Exception:
        db.session.rollback()
    # Fallback if rating query returned nothing
    if not for_you_deduped:
        for_you_deduped = all_published[5:20] if len(all_published) > 5 else []

    # ── Deduplication — ONLY for larger catalogs (50+ books) ──
    # For small catalogs, allow overlap so sections aren't starved
    if total_published >= 50:
        _shown_ids = set()
        def _dedup(books):
            result = []
            for b in books:
                if b.id not in _shown_ids:
                    result.append(b)
                    _shown_ids.add(b.id)
            return result

        new_releases = _dedup(new_releases)
        trending = _dedup(trending)
        top_rated = _dedup(top_rated)
        most_favorited = _dedup(most_favorited)
        completed_stories = _dedup(completed_stories)
        recently_updated = _dedup(recently_updated)
        featured = _dedup(featured)
        for_you_deduped = _dedup(for_you_deduped)
        popular_week = _dedup(popular_week)
        hidden_gems = _dedup(hidden_gems)
        whats_new = _dedup(whats_new)
        rising_stars = _dedup(rising_stars)
        long_reads = _dedup(long_reads)
        quick_reads = _dedup(quick_reads)
        because_you_read = _dedup(because_you_read)
        because_you_love = _dedup(because_you_love)
        for gs in genre_sections:
            gs['books'] = _dedup(gs['books'])
        genre_sections = [gs for gs in genre_sections if gs['books']]

    # ── Build smart section order — only sections with real data ──
    section_order = []
    if whats_new:
        section_order.append('whats_new')
    if recently_updated:
        section_order.append('recently_updated')
    if featured:
        section_order.append('featured')
    if len(for_you_deduped) > 2:
        section_order.append('for_you')
    if popular_week:
        section_order.append('popular_week')
    if most_favorited:
        section_order.append('most_favorited')
    if rising_stars:
        section_order.append('rising_stars')
    if completed_stories:
        section_order.append('completed_stories')
    if hidden_gems:
        section_order.append('hidden_gems')
    if top_rated:
        section_order.append('top_rated')
    if long_reads:
        section_order.append('long_reads')
    if quick_reads:
        section_order.append('quick_reads')
    if because_you_read:
        section_order.append('because_you_read')
    if because_you_love and not because_you_read:
        section_order.append('because_you_love')
    if genre_sections:
        section_order.append('genre_sections')
    if collections_data:
        section_order.append('collections')

    # ── Elite stories (from EliteStory model) ──
    elite_stories_list = []
    elite_ids_set = set()
    try:
        active_elite = EliteStory.query.filter_by(status='active').all()
        elite_ids_set = {e.content_id for e in active_elite}
        if elite_ids_set:
            elite_stories_list = Content.query.filter(
                Content.id.in_(elite_ids_set), Content.deleted_at == None
            ).order_by(Content.views.desc().nullslast()).limit(12).all()
    except Exception:
        db.session.rollback()

    # ── Wiam Top Picks — from recommendation engine's premium picks ──
    wiam_top_picks_list = []
    try:
        from ..services.recommendation_service import premium_picks as _pp
        _picks = _pp(limit=12)
        if _picks:
            pick_ids = [p['id'] for p in _picks]
            wiam_top_picks_list = Content.query.filter(
                Content.id.in_(pick_ids), Content.deleted_at == None
            ).limit(12).all()
    except Exception:
        db.session.rollback()

    # Daily shuffle — vary section order per user per day for freshness
    if len(section_order) > 2:
        daily_seed = int(now.strftime('%Y%m%d')) + (uid % 1000)
        rng = random.Random(daily_seed)
        rng.shuffle(section_order)

    log.info('Home page: %d published, %d trending, %d sections for user %s',
             total_published, len(trending), len(section_order), uid)

    return render_template(
        'home.html',
        featured=featured,
        latest=new_releases,
        trending=trending,
        popular_week=popular_week,
        top_rated=top_rated,
        genres=genres,
        fav_ids=fav_ids,
        continue_reading=continue_reading,
        recommended=for_you_deduped,
        collections=collections_data,
        wiam_top_picks=wiam_top_picks_list,
        whats_new=whats_new,
        latest_announcement=latest_announcement,
        sec_featured=sec_featured,
        sec_collections=sec_collections,
        sec_top_picks=sec_top_picks,
        elite_stories=elite_stories_list, elite_ids=elite_ids_set,
        completed_stories=completed_stories,
        hidden_gems=hidden_gems,
        most_favorited=most_favorited,
        recently_updated=recently_updated,
        genre_sections=genre_sections,
        long_reads=long_reads, quick_reads=quick_reads,
        hero_books=hero_books,
        because_you_read=because_you_read, byr_book=byr_book,
        because_you_love=because_you_love, byl_genre=byl_genre,
        rising_stars=rising_stars, for_you=for_you_deduped,
        section_order=section_order,
        total_published=total_published,
    )


# _home_full was removed — it was 500+ lines of dead code never called by any route.
