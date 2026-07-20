"""
WiamStudio V2 API blueprint (Push 8).

Mounted at ``/api/v1`` on top of the main api_v1 prefix. Houses every
new V2 surface: Universe / StoryBundle / Arc CRUD, CreatorSettings,
StudioProSubscription IAP receipt validation, scheduled-publish queue
and the search V2 extension.

Conventions:
    * All write routes use ``@jwt_required`` and ``_creator_api_forbidden``.
    * Pro-gated routes additionally use ``@studio_pro_required`` from
      ``services.studio_pro``.
    * All best-effort analytics events go through ``services.analytics.track``.
"""
import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from ..extensions import db, csrf
from ..models import (
    Content, User, WebBookContent,
    Universe, StoryBundle, StoryBundleItem, Arc,
    StudioProSubscription, CreatorSettings,
)
from .api_v1 import jwt_required, jwt_optional, _creator_api_forbidden, _abs_url
from ..services.studio_pro import (
    is_studio_pro, studio_pro_required, get_or_create_settings,
)
from ..services.analytics import track

log = logging.getLogger(__name__)

studio_v2_bp = Blueprint('studio_v2_api', __name__, url_prefix='/api/v1')
csrf.exempt(studio_v2_bp)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _wiam(user):
    return user.wiam_id or user.id


def _universe_json(u, include_story_bundle_count=True):
    out = {
        'id': u.id,
        'title': u.title,
        'slug': u.slug,
        'description': u.description or '',
        'cover_url': _abs_url(u.cover_url),
        'accent_color': u.accent_color,
        'visibility': u.visibility,
        'is_locked': bool(u.is_locked),
        'unlock_price_coins': u.unlock_price_coins,
        'sort_order': u.sort_order or 0,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'updated_at': u.updated_at.isoformat() if u.updated_at else None,
    }
    if include_story_bundle_count:
        try:
            out['story_bundle_count'] = StoryBundle.query.filter_by(universe_id=u.id).count()
        except Exception:
            out['story_bundle_count'] = 0
    return out


def _story_bundle_json(s, include_book_count=True):
    out = {
        'id': s.id,
        'title': s.title,
        'slug': s.slug,
        'description': s.description or '',
        'cover_url': _abs_url(s.cover_url),
        'accent_color': s.accent_color,
        'visibility': s.visibility,
        'is_locked': bool(s.is_locked),
        'unlock_price_coins': s.unlock_price_coins,
        'sort_order': s.sort_order or 0,
        'status': s.status or 'ongoing',
        'universe_id': s.universe_id,
        'created_at': s.created_at.isoformat() if s.created_at else None,
        'updated_at': s.updated_at.isoformat() if s.updated_at else None,
    }
    if include_book_count:
        try:
            out['book_count'] = StoryBundleItem.query.filter_by(story_bundle_id=s.id).count()
        except Exception:
            out['book_count'] = 0
    return out


def _arc_json(a):
    return {
        'id': a.id,
        'content_id': a.content_id,
        'title': a.title,
        'description': a.description or '',
        'sort_order': a.sort_order or 0,
        'start_chapter': a.start_chapter,
        'end_chapter': a.end_chapter,
        'created_at': a.created_at.isoformat() if a.created_at else None,
        'updated_at': a.updated_at.isoformat() if a.updated_at else None,
    }


def _settings_json(s):
    if not s:
        return None
    return {
        'default_unit_label': s.default_unit_label or 'chapter',
        'show_universes': bool(s.show_universes),
        'show_story_bundles': bool(
            getattr(s, 'show_story_bundles', None)
            if getattr(s, 'show_story_bundles', None) is not None
            else getattr(s, 'show_series', False)
        ),
        'show_arcs': bool(s.show_arcs),
        'show_scheduling': bool(s.show_scheduling),
        'show_premium_lock': bool(s.show_premium_lock),
        'show_ai_tools': bool(s.show_ai_tools),
        'beta_studio_v2': bool(s.beta_studio_v2),
        'has_seen_v2_tour': bool(s.has_seen_v2_tour),
        'notif_scheduled_publish': bool(s.notif_scheduled_publish),
        'ai_waitlist': bool(getattr(s, 'ai_waitlist', False)),
    }


# ---------------------------------------------------------------------------
# UNIVERSES
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/universes', methods=['GET'])
@jwt_required
def list_universes():
    """List the authenticated creator's universes."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    rows = Universe.query.filter_by(creator_wiam_id=_wiam(user)).order_by(
        Universe.sort_order.asc(), Universe.created_at.desc()
    ).all()
    return jsonify({'universes': [_universe_json(u) for u in rows]})


@studio_v2_bp.route('/universes', methods=['POST'])
@jwt_required
@studio_pro_required
def create_universe():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    u = Universe(
        creator_wiam_id=_wiam(user),
        title=title[:200],
        slug=(data.get('slug') or '').strip()[:200] or None,
        description=(data.get('description') or '').strip()[:5000],
        cover_url=(data.get('cover_url') or '').strip() or None,
        accent_color=(data.get('accent_color') or '').strip()[:32] or None,
        visibility=(data.get('visibility') or 'public'),
        is_locked=bool(data.get('is_locked')),
        unlock_price_coins=data.get('unlock_price_coins'),
        sort_order=int(data.get('sort_order') or 0),
    )
    db.session.add(u)
    db.session.commit()
    track('universe_create', user, universe_id=u.id)
    db.session.commit()
    return jsonify({'universe': _universe_json(u)}), 201


@studio_v2_bp.route('/universes/<int:universe_id>', methods=['GET'])
@jwt_required
def get_universe(universe_id):
    user = request.api_user
    u = Universe.query.get(universe_id)
    if not u:
        return jsonify({'error': 'not_found'}), 404
    if u.visibility != 'public' and u.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'forbidden'}), 403
    series_rows = StoryBundle.query.filter_by(universe_id=u.id).order_by(
        StoryBundle.sort_order.asc(), StoryBundle.created_at.desc()
    ).all()
    return jsonify({
        'universe': _universe_json(u),
        'story_bundles': [_story_bundle_json(s) for s in series_rows],
    })


@studio_v2_bp.route('/universes/<int:universe_id>', methods=['PATCH'])
@jwt_required
@studio_pro_required
def update_universe(universe_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    u = Universe.query.get(universe_id)
    if not u or u.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    for k in ('title', 'slug', 'description', 'cover_url', 'accent_color', 'visibility'):
        if k in data:
            setattr(u, k, (data.get(k) or '').strip() or None if k != 'description' else (data.get(k) or ''))
    if 'is_locked' in data:
        u.is_locked = bool(data['is_locked'])
    if 'unlock_price_coins' in data:
        u.unlock_price_coins = data['unlock_price_coins']
    if 'sort_order' in data:
        try:
            u.sort_order = int(data['sort_order'])
        except (TypeError, ValueError):
            pass
    db.session.commit()
    return jsonify({'universe': _universe_json(u)})


@studio_v2_bp.route('/universes/<int:universe_id>', methods=['DELETE'])
@jwt_required
@studio_pro_required
def delete_universe(universe_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    u = Universe.query.get(universe_id)
    if not u or u.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    db.session.delete(u)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# STORY BUNDLES
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/story-bundles', methods=['GET'])
@jwt_required
def list_story_bundles():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    universe_id = request.args.get('universe_id', type=int)
    q = StoryBundle.query.filter_by(creator_wiam_id=_wiam(user))
    if universe_id:
        q = q.filter_by(universe_id=universe_id)
    rows = q.order_by(StoryBundle.sort_order.asc(), StoryBundle.created_at.desc()).all()
    return jsonify({'story_bundles': [_story_bundle_json(s) for s in rows]})


@studio_v2_bp.route('/story-bundles', methods=['POST'])
@jwt_required
@studio_pro_required
def create_story_bundle():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400
    universe_id = data.get('universe_id')
    if universe_id:
        u = Universe.query.get(int(universe_id))
        if not u or u.creator_wiam_id != _wiam(user):
            return jsonify({'error': 'invalid universe_id'}), 400

    s = StoryBundle(
        creator_wiam_id=_wiam(user),
        universe_id=int(universe_id) if universe_id else None,
        title=title[:200],
        slug=(data.get('slug') or '').strip()[:200] or None,
        description=(data.get('description') or '').strip()[:5000],
        cover_url=(data.get('cover_url') or '').strip() or None,
        accent_color=(data.get('accent_color') or '').strip()[:32] or None,
        visibility=(data.get('visibility') or 'public'),
        is_locked=bool(data.get('is_locked')),
        unlock_price_coins=data.get('unlock_price_coins'),
        sort_order=int(data.get('sort_order') or 0),
        status=(data.get('status') or 'ongoing'),
    )
    db.session.add(s)
    db.session.commit()
    track('story_bundle_create', user, story_bundle_id=s.id)
    db.session.commit()
    return jsonify({'story_bundle': _story_bundle_json(s)}), 201


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>', methods=['GET'])
@jwt_required
def get_story_bundle(story_bundle_id):
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s:
        return jsonify({'error': 'not_found'}), 404
    if s.visibility != 'public' and s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'forbidden'}), 403
    rows = StoryBundleItem.query.filter_by(story_bundle_id=s.id).order_by(
        StoryBundleItem.sort_order.asc(), StoryBundleItem.created_at.asc()
    ).all()
    book_ids = [r.content_id for r in rows]
    books = []
    if book_ids:
        books_rows = Content.query.filter(Content.id.in_(book_ids)).all()
        book_map = {b.id: b for b in books_rows}
        for r in rows:
            b = book_map.get(r.content_id)
            if not b:
                continue
            books.append({
                'id': b.id,
                'title': b.title,
                'cover_url': _abs_url(b.cover_url),
                'genre': b.genre or '',
                'status': b.status or 'draft',
                'sort_order': r.sort_order,
            })
    return jsonify({'story_bundle': _story_bundle_json(s), 'books': books})


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>', methods=['PATCH'])
@jwt_required
@studio_pro_required
def update_story_bundle(story_bundle_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    for k in ('title', 'slug', 'cover_url', 'accent_color', 'visibility', 'status'):
        if k in data:
            setattr(s, k, (data.get(k) or '').strip() or None)
    if 'description' in data:
        s.description = (data.get('description') or '')[:5000]
    if 'universe_id' in data:
        if data['universe_id'] is None:
            s.universe_id = None
        else:
            u = Universe.query.get(int(data['universe_id']))
            if u and u.creator_wiam_id == _wiam(user):
                s.universe_id = u.id
    if 'is_locked' in data:
        s.is_locked = bool(data['is_locked'])
    if 'unlock_price_coins' in data:
        s.unlock_price_coins = data['unlock_price_coins']
    if 'sort_order' in data:
        try:
            s.sort_order = int(data['sort_order'])
        except (TypeError, ValueError):
            pass
    db.session.commit()
    return jsonify({'story_bundle': _story_bundle_json(s)})


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>', methods=['DELETE'])
@jwt_required
@studio_pro_required
def delete_story_bundle(story_bundle_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    db.session.delete(s)
    db.session.commit()
    return jsonify({'ok': True})


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>/books', methods=['POST'])
@jwt_required
@studio_pro_required
def add_book_to_story_bundle(story_bundle_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404

    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id')
    try:
        content_id = int(content_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'content_id required'}), 400

    book = Content.query.filter_by(id=content_id).first()
    if not book or book.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'content not found'}), 404

    existing = StoryBundleItem.query.filter_by(story_bundle_id=s.id, content_id=content_id).first()
    if existing:
        return jsonify({'error': 'already in series'}), 409

    last_order = db.session.query(db.func.max(StoryBundleItem.sort_order)).filter_by(story_bundle_id=s.id).scalar() or 0
    sc = StoryBundleItem(
        story_bundle_id=s.id,
        content_id=content_id,
        sort_order=int(data.get('sort_order') or (last_order + 1)),
    )
    db.session.add(sc)
    db.session.commit()
    return jsonify({'ok': True, 'sort_order': sc.sort_order}), 201


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>/books/<int:content_id>', methods=['DELETE'])
@jwt_required
@studio_pro_required
def remove_book_from_story_bundle(story_bundle_id, content_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    sc = StoryBundleItem.query.filter_by(story_bundle_id=s.id, content_id=content_id).first()
    if not sc:
        return jsonify({'error': 'not in series'}), 404
    db.session.delete(sc)
    db.session.commit()
    return jsonify({'ok': True})


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>/books/reorder', methods=['POST'])
@jwt_required
@studio_pro_required
def reorder_story_bundle_books(story_bundle_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.creator_wiam_id != _wiam(user):
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    order = data.get('order') or []
    if not isinstance(order, list):
        return jsonify({'error': 'order must be a list of content_ids'}), 400
    rows = StoryBundleItem.query.filter_by(story_bundle_id=s.id).all()
    by_id = {r.content_id: r for r in rows}
    for idx, cid in enumerate(order):
        try:
            cid = int(cid)
        except (TypeError, ValueError):
            continue
        if cid in by_id:
            by_id[cid].sort_order = idx + 1
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# ARCS
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/stories/<int:book_id>/arcs', methods=['GET'])
@jwt_required
def list_arcs(book_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter_by(id=book_id, creator_wiam_id=_wiam(user)).first()
    if not book:
        return jsonify({'error': 'not_found'}), 404
    rows = Arc.query.filter_by(content_id=book.id).order_by(
        Arc.sort_order.asc(), Arc.created_at.asc()
    ).all()
    return jsonify({'arcs': [_arc_json(a) for a in rows]})


@studio_v2_bp.route('/stories/<int:book_id>/arcs', methods=['POST'])
@jwt_required
@studio_pro_required
def create_arc(book_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter_by(id=book_id, creator_wiam_id=_wiam(user)).first()
    if not book:
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title required'}), 400
    last_order = db.session.query(db.func.max(Arc.sort_order)).filter_by(content_id=book.id).scalar() or 0
    a = Arc(
        content_id=book.id,
        title=title[:200],
        description=(data.get('description') or '')[:5000],
        sort_order=int(data.get('sort_order') or (last_order + 1)),
        start_chapter=data.get('start_chapter'),
        end_chapter=data.get('end_chapter'),
    )
    db.session.add(a)
    db.session.commit()
    return jsonify({'arc': _arc_json(a)}), 201


@studio_v2_bp.route('/arcs/<int:arc_id>', methods=['PATCH'])
@jwt_required
@studio_pro_required
def update_arc(arc_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    a = Arc.query.get(arc_id)
    if not a:
        return jsonify({'error': 'not_found'}), 404
    book = Content.query.filter_by(id=a.content_id, creator_wiam_id=_wiam(user)).first()
    if not book:
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json(silent=True) or {}
    if 'title' in data:
        a.title = (data.get('title') or a.title)[:200]
    if 'description' in data:
        a.description = (data.get('description') or '')[:5000]
    if 'sort_order' in data:
        try:
            a.sort_order = int(data['sort_order'])
        except (TypeError, ValueError):
            pass
    if 'start_chapter' in data:
        a.start_chapter = data['start_chapter']
    if 'end_chapter' in data:
        a.end_chapter = data['end_chapter']
    db.session.commit()
    return jsonify({'arc': _arc_json(a)})


@studio_v2_bp.route('/arcs/<int:arc_id>', methods=['DELETE'])
@jwt_required
@studio_pro_required
def delete_arc(arc_id):
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    a = Arc.query.get(arc_id)
    if not a:
        return jsonify({'error': 'not_found'}), 404
    book = Content.query.filter_by(id=a.content_id, creator_wiam_id=_wiam(user)).first()
    if not book:
        return jsonify({'error': 'forbidden'}), 403
    db.session.delete(a)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# CHAPTER SCHEDULING
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/studio/stories/<int:book_id>/chapter/<int:ch_num>/schedule', methods=['POST'])
@jwt_required
def schedule_chapter(book_id, ch_num):
    """Schedule a chapter to publish in the future. Free for everyone."""
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    book = Content.query.filter_by(id=book_id, creator_wiam_id=_wiam(user)).first()
    if not book:
        return jsonify({'error': 'not_found'}), 404
    ch = WebBookContent.query.filter_by(content_id=book.id, chapter_number=ch_num).first()
    if not ch:
        return jsonify({'error': 'chapter_not_found'}), 404

    data = request.get_json(silent=True) or {}
    when = data.get('publish_at')
    if not when:
        ch.scheduled_publish_at = None
        db.session.commit()
        return jsonify({'ok': True, 'scheduled_publish_at': None})

    try:
        if isinstance(when, str):
            target = datetime.fromisoformat(when.replace('Z', '+00:00'))
            if target.tzinfo:
                target = target.astimezone().replace(tzinfo=None)
        else:
            return jsonify({'error': 'publish_at must be ISO 8601 string'}), 400
    except Exception:
        return jsonify({'error': 'invalid publish_at format'}), 400

    if target < datetime.utcnow() + timedelta(minutes=2):
        return jsonify({'error': 'publish_at must be at least 2 minutes in the future'}), 400

    ch.scheduled_publish_at = target
    db.session.commit()
    track('chapter_scheduled', user, content_id=book.id, chapter_number=ch_num)
    db.session.commit()
    return jsonify({'ok': True, 'scheduled_publish_at': target.isoformat()})


# ---------------------------------------------------------------------------
# CREATOR SETTINGS
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/studio/settings', methods=['GET'])
@jwt_required
def get_studio_settings():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = get_or_create_settings(user)
    return jsonify({
        'settings': _settings_json(s),
        'is_pro': is_studio_pro(user),
    })


@studio_v2_bp.route('/studio/settings', methods=['PATCH'])
@jwt_required
def update_studio_settings():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    s = get_or_create_settings(user)
    if not s:
        return jsonify({'error': 'settings_unavailable'}), 500
    data = request.get_json(silent=True) or {}

    if 'default_unit_label' in data:
        v = (data.get('default_unit_label') or 'chapter').strip().lower()
        s.default_unit_label = v[:32] or 'chapter'
    for k in (
        'show_universes', 'show_story_bundles', 'show_arcs',
        'show_scheduling', 'show_premium_lock', 'show_ai_tools',
        'beta_studio_v2', 'has_seen_v2_tour', 'notif_scheduled_publish',
        'ai_waitlist',
    ):
        if k in data:
            setattr(s, k, bool(data.get(k)))
    # Legacy client key → StoryBundle flag
    if 'show_series' in data and 'show_story_bundles' not in data:
        s.show_story_bundles = bool(data.get('show_series'))
        s.show_series = bool(data.get('show_series'))
    elif 'show_story_bundles' in data:
        s.show_series = bool(data.get('show_story_bundles'))
    db.session.commit()
    return jsonify({'settings': _settings_json(s)})


# ---------------------------------------------------------------------------
# STUDIO PRO — products / status / IAP receipt validation
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/studio/pro/status', methods=['GET'])
@jwt_required
def studio_pro_status():
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    pro = is_studio_pro(user)
    sub = StudioProSubscription.query.filter_by(user_id=user.id).order_by(
        StudioProSubscription.id.desc()
    ).first()
    return jsonify({
        'is_pro': pro,
        'subscription': {
            'plan': sub.plan if sub else None,
            'status': sub.status if sub else None,
            'source': sub.source if sub else None,
            'started_at': sub.started_at.isoformat() if sub and sub.started_at else None,
            'current_period_end': sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        } if sub else None,
    })


@studio_v2_bp.route('/studio/pro/products', methods=['GET'])
def studio_pro_products():
    """Return the SKU catalogue. Static for now — Push 9/10 will move
    this to PlatformConfig so admins can A/B price without a deploy."""
    return jsonify({
        'products': [
            {
                'id': 'wiamstudio_pro_monthly',
                'plan': 'monthly',
                'price_label': 'GHS 30 / month',
                'period_days': 30,
                'description': 'Monthly subscription. Cancel anytime.',
            },
            {
                'id': 'wiamstudio_pro_yearly',
                'plan': 'yearly',
                'price_label': 'GHS 300 / year',
                'period_days': 365,
                'description': 'Save 17% vs monthly.',
                'badge': 'Best value',
            },
            {
                'id': 'wiamstudio_pro_lifetime',
                'plan': 'lifetime',
                'price_label': 'GHS 1500 once',
                'period_days': None,
                'description': 'Lifetime access. Pay once.',
            },
        ],
    })


@studio_v2_bp.route('/studio/pro/iap-receipt', methods=['POST'])
@jwt_required
def studio_pro_iap_receipt():
    """Mobile client posts an IAP receipt; we record + activate.

    Real signature validation happens via RevenueCat webhook (Push 9
    follow-up) — here we just record what the client sent and trust
    RevenueCat as the system of record. The webhook will reconcile the
    row later.
    """
    deny = _creator_api_forbidden()
    if deny:
        return deny
    user = request.api_user
    data = request.get_json(silent=True) or {}
    plan = (data.get('plan') or '').strip()
    if plan not in ('monthly', 'yearly', 'lifetime'):
        return jsonify({'error': 'invalid plan'}), 400

    period_end = None
    if plan == 'monthly':
        period_end = datetime.utcnow() + timedelta(days=31)
    elif plan == 'yearly':
        period_end = datetime.utcnow() + timedelta(days=366)

    sub = StudioProSubscription(
        user_id=user.id,
        plan=plan,
        status='active',
        source=(data.get('source') or 'revenuecat').strip()[:64],
        revenuecat_user_id=(data.get('revenuecat_user_id') or '').strip()[:128] or None,
        current_period_end=period_end,
        raw_receipt_json=json.dumps(data)[:4096],
    )
    db.session.add(sub)
    db.session.commit()
    track('studio_pro_activated', user, plan=plan, source=sub.source)
    db.session.commit()
    return jsonify({
        'ok': True,
        'is_pro': True,
        'subscription': {
            'id': sub.id,
            'plan': sub.plan,
            'status': sub.status,
            'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None,
        },
    })


# ---------------------------------------------------------------------------
# SCHEDULED PUBLISH QUEUE
# ---------------------------------------------------------------------------

def publish_due_now():
    """Promote every WebBookContent whose ``scheduled_publish_at`` has passed.

    Idempotent. Returns the number of chapters actually published.
    """
    from ..services.notifications import notify_new_chapter, notify_creator_scheduled_chapter_live

    now = datetime.utcnow()
    due = WebBookContent.query.filter(
        WebBookContent.scheduled_publish_at.isnot(None),
        WebBookContent.scheduled_publish_at <= now,
        WebBookContent.status != 'published',
    ).limit(50).all()

    if not due:
        return 0

    published = 0
    for ch in due:
        try:
            book = Content.query.get(ch.content_id)
            if not book or book.deleted_at:
                ch.scheduled_publish_at = None
                continue
            ch.status = 'published'
            ch.scheduled_publish_at = None
            if not ch.published_at:
                ch.published_at = now
            db.session.commit()
            try:
                notify_new_chapter(book.id, ch.chapter_number, ch.chapter_title or '')
            except Exception as exc:
                log.warning("notify_new_chapter failed for %s/%s: %s",
                            book.id, ch.chapter_number, exc)
            try:
                notify_creator_scheduled_chapter_live(
                    book, ch.chapter_number, ch.chapter_title or '')
            except Exception as exc:
                log.warning("notify_creator_scheduled_chapter_live failed for %s/%s: %s",
                            book.id, ch.chapter_number, exc)
            published += 1
        except Exception as exc:
            log.warning("publish_due tick failed for ch=%s: %s", ch.id, exc)
            try:
                db.session.rollback()
            except Exception:
                pass
    return published


@studio_v2_bp.route('/internal/publish-due', methods=['POST'])
def internal_publish_due():
    """Internal cron-style endpoint. Protected by a shared secret env."""
    import os
    expected = (os.environ.get('SCHEDULER_SHARED_SECRET') or '').strip()
    provided = (request.headers.get('X-Scheduler-Secret') or '').strip()
    if not expected or provided != expected:
        return jsonify({'error': 'forbidden'}), 403
    n = publish_due_now()
    return jsonify({'ok': True, 'published': n})


# ---------------------------------------------------------------------------
# SEARCH V2 — extension that also surfaces Universes + Series
# ---------------------------------------------------------------------------

@studio_v2_bp.route('/search/v2', methods=['GET'])
def search_v2():
    """Combined search: returns books, universes and series.

    The mobile app keeps using ``/api/v1/search`` for plain book search
    and switches to this endpoint when the user explicitly searches
    "everywhere".
    """
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'books': [], 'universes': [], 'story_bundles': []})
    like = f'%{q}%'

    books_rows = Content.query.filter(
        Content.deleted_at.is_(None),
        Content.title.ilike(like),
    ).limit(20).all()
    universes_rows = Universe.query.filter(
        Universe.visibility == 'public',
        Universe.title.ilike(like),
    ).limit(10).all()
    series_rows = StoryBundle.query.filter(
        StoryBundle.visibility == 'public',
        StoryBundle.title.ilike(like),
    ).limit(10).all()

    return jsonify({
        'books': [{
            'id': b.id,
            'title': b.title,
            'genre': b.genre or '',
            'cover_url': _abs_url(b.cover_url),
        } for b in books_rows],
        'universes': [_universe_json(u) for u in universes_rows],
        'story_bundles': [_story_bundle_json(s) for s in series_rows],
    })


# ---------------------------------------------------------------------------
# READER V2 — series progression + book-context lookups (Push 10)
# ---------------------------------------------------------------------------

def _book_card_json(b):
    """Compact reader-friendly book card."""
    if not b:
        return None
    return {
        'id': b.id,
        'title': b.title,
        'genre': b.genre or '',
        'cover_url': _abs_url(b.cover_url),
        'status': b.status or 'draft',
        'creator_wiam_id': b.creator_wiam_id,
        'description': (b.description or '')[:300],
        'avg_rating': float(getattr(b, 'avg_rating', 0) or 0),
        'views': int(b.views or 0),
        'rating_count': int(getattr(b, 'rating_count', 0) or 0),
    }


@studio_v2_bp.route('/books/<int:book_id>/story-bundle-context', methods=['GET'])
def book_story_bundle_context(book_id):
    """Return the series this book belongs to (if any) plus reading-order siblings.

    Free for everyone — used by ReaderScreen to render "You're on book X of Y"
    and the next-in-story-bundle CTA. The series itself must be public for non-creators
    to see it.
    """
    b = Content.query.get(book_id)
    if not b or b.is_deleted:
        return jsonify({'story_bundle': None, 'books': [], 'position': None})

    sc_rows = StoryBundleItem.query.filter_by(content_id=book_id).all()
    if not sc_rows:
        return jsonify({'story_bundle': None, 'books': [], 'position': None})

    # Pick the first public (or self-owned) series this book belongs to.
    chosen = None
    chosen_sc = None
    for sc in sc_rows:
        s = StoryBundle.query.get(sc.story_bundle_id)
        if not s:
            continue
        if s.visibility == 'public':
            chosen, chosen_sc = s, sc
            break
        chosen = chosen or s
        chosen_sc = chosen_sc or sc
    if not chosen:
        return jsonify({'story_bundle': None, 'books': [], 'position': None})

    if chosen.visibility != 'public':
        return jsonify({'story_bundle': None, 'books': [], 'position': None})

    rows = StoryBundleItem.query.filter_by(story_bundle_id=chosen.id).order_by(
        StoryBundleItem.sort_order.asc(), StoryBundleItem.created_at.asc()
    ).all()
    book_ids = [r.content_id for r in rows]
    books_rows = Content.query.filter(Content.id.in_(book_ids)).all() if book_ids else []
    book_map = {x.id: x for x in books_rows}

    ordered_books = []
    position = None
    for idx, r in enumerate(rows):
        x = book_map.get(r.content_id)
        if not x or x.is_deleted:
            continue
        if x.id == book_id:
            position = idx + 1  # 1-indexed for humans
        ordered_books.append({
            **_book_card_json(x),
            'sort_order': r.sort_order,
        })

    return jsonify({
        'story_bundle': _story_bundle_json(chosen),
        'books': ordered_books,
        'position': position,
        'total': len(ordered_books),
    })


@studio_v2_bp.route('/books/<int:book_id>/next-in-story-bundle', methods=['GET'])
def next_in_series(book_id):
    """Return the next book in any public series this book belongs to.

    Used by the reader's "Read the next book" CTA after finishing a story.
    """
    b = Content.query.get(book_id)
    if not b or b.is_deleted:
        return jsonify({'next': None})

    sc_rows = StoryBundleItem.query.filter_by(content_id=book_id).all()
    for sc in sc_rows:
        s = StoryBundle.query.get(sc.story_bundle_id)
        if not s or s.visibility != 'public':
            continue
        sibling_rows = StoryBundleItem.query.filter_by(story_bundle_id=s.id).order_by(
            StoryBundleItem.sort_order.asc(), StoryBundleItem.created_at.asc()
        ).all()
        sibling_ids = [r.content_id for r in sibling_rows]
        if book_id in sibling_ids:
            cur = sibling_ids.index(book_id)
            for nxt_id in sibling_ids[cur + 1:]:
                nxt = Content.query.get(nxt_id)
                if nxt and not nxt.is_deleted:
                    return jsonify({
                        'next': _book_card_json(nxt),
                        'story_bundle': _story_bundle_json(s),
                    })
    return jsonify({'next': None})


@studio_v2_bp.route('/universes/<int:universe_id>/public', methods=['GET'])
def universe_public_detail(universe_id):
    """Reader-facing universe detail: universe + public series + sample books.

    Open to anyone (no JWT). Hidden universes return 404 instead of 403 so
    we don't leak existence.
    """
    u = Universe.query.get(universe_id)
    if not u or u.visibility != 'public':
        return jsonify({'error': 'not_found'}), 404

    series_rows = StoryBundle.query.filter_by(
        universe_id=u.id, visibility='public'
    ).order_by(StoryBundle.sort_order.asc(), StoryBundle.created_at.desc()).all()

    series_payload = []
    for s in series_rows:
        sc_rows = StoryBundleItem.query.filter_by(story_bundle_id=s.id).order_by(
            StoryBundleItem.sort_order.asc(), StoryBundleItem.created_at.asc()
        ).limit(6).all()
        sample_ids = [r.content_id for r in sc_rows]
        sample_books = []
        if sample_ids:
            books_rows = Content.query.filter(Content.id.in_(sample_ids)).all()
            book_map = {x.id: x for x in books_rows}
            for r in sc_rows:
                x = book_map.get(r.content_id)
                if x and not x.is_deleted:
                    sample_books.append(_book_card_json(x))
        payload = _story_bundle_json(s)
        payload['sample_books'] = sample_books
        series_payload.append(payload)

    creator = User.query.filter_by(wiam_id=u.creator_wiam_id).first()
    return jsonify({
        'universe': _universe_json(u),
        'story_bundles': series_payload,
        'creator': {
            'wiam_id': u.creator_wiam_id,
            'username': creator.username if creator else None,
            'creator_pen_name': getattr(creator, 'creator_pen_name', None) if creator else None,
            'avatar_url': _abs_url(getattr(creator, 'profile_picture_url', None)) if creator else None,
        } if creator else None,
    })


@studio_v2_bp.route('/story-bundles/<int:story_bundle_id>/public', methods=['GET'])
def series_public_detail(story_bundle_id):
    """Reader-facing series detail: series + ordered book list.

    Open to anyone (no JWT). Hidden series return 404 to avoid existence leak.
    """
    s = StoryBundle.query.get(story_bundle_id)
    if not s or s.visibility != 'public':
        return jsonify({'error': 'not_found'}), 404

    rows = StoryBundleItem.query.filter_by(story_bundle_id=s.id).order_by(
        StoryBundleItem.sort_order.asc(), StoryBundleItem.created_at.asc()
    ).all()
    book_ids = [r.content_id for r in rows]
    books = []
    if book_ids:
        books_rows = Content.query.filter(Content.id.in_(book_ids)).all()
        book_map = {x.id: x for x in books_rows}
        for r in rows:
            x = book_map.get(r.content_id)
            if x and not x.is_deleted:
                books.append({
                    **_book_card_json(x),
                    'sort_order': r.sort_order,
                })

    creator = User.query.filter_by(wiam_id=s.creator_wiam_id).first()
    universe_payload = None
    if s.universe_id:
        u = Universe.query.get(s.universe_id)
        if u and u.visibility == 'public':
            universe_payload = _universe_json(u, include_story_bundle_count=False)

    return jsonify({
        'story_bundle': _story_bundle_json(s),
        'books': books,
        'universe': universe_payload,
        'creator': {
            'wiam_id': s.creator_wiam_id,
            'username': creator.username if creator else None,
            'creator_pen_name': getattr(creator, 'creator_pen_name', None) if creator else None,
            'avatar_url': _abs_url(getattr(creator, 'profile_picture_url', None)) if creator else None,
        } if creator else None,
    })


@studio_v2_bp.route('/books/<int:book_id>/chapter/<int:ch_num>/access', methods=['GET'])
@jwt_optional
def chapter_access_state(book_id, ch_num):
    """Return per-user lock state for a chapter without exposing its body.

    Mobile reader calls this BEFORE pulling the chapter so we can render a
    helpful unlock UI (free / coin / premium / Pro) instead of bouncing on a
    403. Authenticated users see whether they already have access.
    """
    book = Content.query.get(book_id)
    if not book or book.is_deleted:
        return jsonify({'error': 'not_found'}), 404

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num, status='published'
    ).first()
    if not chapter:
        return jsonify({'error': 'not_found'}), 404

    is_coin_locked = bool(chapter.is_locked and chapter.chapter_price)
    is_premium_locked = bool(getattr(chapter, 'is_premium_locked', False))

    user = getattr(request, 'api_user', None)
    is_creator = False
    has_access = False
    has_unlock = False
    user_is_premium = False
    bal = 0

    if user:
        uid = user.id
        wiam_id = user.wiam_id or uid
        is_creator = (book.creator_wiam_id == wiam_id)
        if is_creator:
            has_access = True
        else:
            try:
                from ..models import Access, ChapterUnlock, CoinBalance
                has_access = Access.query.filter_by(
                    user_id=uid, content_id=book_id, status='active'
                ).first() is not None
                has_unlock = ChapterUnlock.query.filter(
                    ChapterUnlock.content_id == book_id,
                    ChapterUnlock.chapter_number == ch_num,
                    db.or_(ChapterUnlock.user_id == uid, ChapterUnlock.user_id == wiam_id),
                ).first() is not None
                bal_row = CoinBalance.query.get(wiam_id) or CoinBalance.query.get(uid)
                bal = bal_row.balance if bal_row else 0
            except Exception:
                pass
            user_is_premium = (user.premium_status in ('active', 'trial'))
            if user_is_premium and user.premium_expires_at:
                if datetime.utcnow() > user.premium_expires_at:
                    user_is_premium = False

    can_read = (
        not (is_coin_locked or is_premium_locked)
        or is_creator or has_access or has_unlock
        or (is_premium_locked and user_is_premium)
    )

    return jsonify({
        'book_id': book_id,
        'chapter_number': ch_num,
        'coin_locked': is_coin_locked,
        'premium_locked': is_premium_locked,
        'price_coins': int(chapter.chapter_price or 0) if is_coin_locked else 0,
        'is_creator': is_creator,
        'has_access': has_access,
        'has_unlock': has_unlock,
        'is_premium_subscriber': user_is_premium,
        'coin_balance': int(bal),
        'can_read': bool(can_read),
        'unlock_method_hint': (
            'free' if not (is_coin_locked or is_premium_locked)
            else 'coins' if is_coin_locked and not is_premium_locked
            else 'premium' if is_premium_locked and not is_coin_locked
            else 'coins_or_premium'
        ),
    })


# ---------------------------------------------------------------------------
# DEPRECATED — old Studio V2 book-list mutations on /series*
# GET /series and GET /series/<id> are now WiamEpisio drama Series (episode_api).
# ---------------------------------------------------------------------------

_DEPRECATED_SERIES = {
    'error': 'deprecated',
    'message': (
        'Studio V2 book lists moved to /api/v1/story-bundles. '
        'GET /api/v1/series is the WiamEpisio drama Series API.'
    ),
    'replacement': '/api/v1/story-bundles',
}


@studio_v2_bp.route('/series', methods=['POST'])
def deprecated_series_create():
    return jsonify(_DEPRECATED_SERIES), 410


@studio_v2_bp.route('/series/<int:story_bundle_id>', methods=['PATCH', 'DELETE'])
def deprecated_series_mutate(story_bundle_id):
    return jsonify({
        **_DEPRECATED_SERIES,
        'replacement': f'/api/v1/story-bundles/{story_bundle_id}',
    }), 410


@studio_v2_bp.route('/series/<int:story_bundle_id>/books', methods=['POST', 'DELETE'])
@studio_v2_bp.route('/series/<int:story_bundle_id>/books/<path:rest>', methods=['POST', 'DELETE'])
@studio_v2_bp.route('/series/<int:story_bundle_id>/books/reorder', methods=['POST'])
@studio_v2_bp.route('/series/<int:story_bundle_id>/public', methods=['GET'])
def deprecated_series_books(story_bundle_id, rest=None):
    return jsonify({
        **_DEPRECATED_SERIES,
        'replacement': f'/api/v1/story-bundles/{story_bundle_id}',
    }), 410


@studio_v2_bp.route('/books/<int:book_id>/series-context', methods=['GET'])
def deprecated_series_context(book_id):
    return jsonify({
        **_DEPRECATED_SERIES,
        'replacement': f'/api/v1/books/{book_id}/story-bundle-context',
    }), 410


@studio_v2_bp.route('/books/<int:book_id>/next-in-series', methods=['GET'])
def deprecated_next_in_series(book_id):
    return jsonify({
        **_DEPRECATED_SERIES,
        'replacement': f'/api/v1/books/{book_id}/next-in-story-bundle',
    }), 410
