import logging
from flask import Blueprint, render_template, request
from flask_login import current_user
from sqlalchemy import func
from ..models import Content, Genre, Favorite
from ..extensions import db

log = logging.getLogger(__name__)

_PUB = Content.PUBLISHED_STATUSES

browse_bp = Blueprint('browse', __name__)

# Browse home cache — refreshes every 5 minutes (reduces Neon DB calls)
from datetime import datetime
_browse_cache = {'ts': None, 'data': None}
_BROWSE_TTL = 300


def _apply_sort(query, sort):
    """Apply sort order to a Content query."""
    if sort == 'popular':
        return query.order_by(Content.views.desc().nullslast())
    return query.order_by(func.coalesce(Content.published_at, Content.created_at).desc())


@browse_bp.route('/')
def browse_home():
    now = datetime.utcnow()
    if _browse_cache['ts'] and (now - _browse_cache['ts']).total_seconds() < _BROWSE_TTL:
        return _browse_cache['data']
    try:
        genres = Genre.query.order_by(Genre.name).all()
        trending = Content.query.filter(
            Content.status.in_(_PUB), Content.deleted_at == None,
        ).order_by(Content.views.desc().nullslast()).limit(8).all()
        recent = Content.query.filter(
            Content.status.in_(_PUB), Content.deleted_at == None,
        ).order_by(func.coalesce(Content.published_at, Content.created_at).desc()).limit(8).all()
    except Exception as e:
        log.error('Browse page error: %s', e, exc_info=True)
        genres, trending, recent = [], [], []
    html = render_template('browse.html', genres=genres, trending=trending, recent=recent)
    _browse_cache['ts'] = now
    _browse_cache['data'] = html
    return html


@browse_bp.route('/genre/<genre_name>')
def genre_books(genre_name):
    page = request.args.get('page', 1, type=int)
    sort = request.args.get('sort', 'newest')

    q = Content.query.filter(
        Content.genre == genre_name,
        Content.status.in_(_PUB),
        Content.deleted_at == None,
    )
    q = _apply_sort(q, sort)
    books = q.paginate(page=page, per_page=12, error_out=False)

    fav_ids = set()
    if current_user.is_authenticated:
        favs = Favorite.query.filter_by(user_id=current_user.wiam_id).all()
        fav_ids = {f.content_id for f in favs}

    return render_template('genre_books.html', genre_name=genre_name, books=books,
                           fav_ids=fav_ids, sort=sort)


@browse_bp.route('/search')
def search():
    q = request.args.get('q', '').strip()
    sort = request.args.get('sort', 'newest')
    results = []
    top_books = []
    if q:
        query = Content.query.filter(
            Content.status.in_(_PUB),
            Content.deleted_at == None,
            (Content.title.ilike(f'%{q}%') | Content.description.ilike(f'%{q}%') | Content.author.ilike(f'%{q}%'))
        )
        query = _apply_sort(query, sort)
        results = query.limit(50).all()
    else:
        # Show top books when no search query
        top_books = Content.query.filter(
            Content.status.in_(_PUB),
            Content.deleted_at == None,
        ).order_by(Content.views.desc().nullslast()).limit(12).all()

    return render_template('search_results.html', query=q, results=results,
                           sort=sort, top_books=top_books)
