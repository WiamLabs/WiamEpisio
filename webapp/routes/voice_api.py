"""
WiamVox API — voice stories under /api/v1/voice.
Uses the same JWT as /api/v1 (see api_v1.jwt_required). Does not touch book routes.
"""
import logging
from datetime import datetime, timedelta
import os
import uuid
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from sqlalchemy import func, desc

from ..extensions import csrf, db
from ..models import (
    User,
    VoiceStory,
    VoiceMoment,
    VoiceMomentLike,
    VoiceMomentComment,
    VoiceStorySave,
    VoiceStoryUnlock,
    VoiceListenDayBucket,
    VoiceListenProgress,
    VoiceListenPresence,
    VoiceStoryRoomMessage,
    CreatorEarnings,
    RevenueRule,
    CoinBalance,
)
from ..routes.api_v1 import jwt_optional, jwt_required, _abs_url
from ..services.ledger import record_voice_story_unlock, record_voice_tip
from ..services.monetization import COIN_TO_GHS
from ..services.image_service import upload_image, delete_image_url

log = logging.getLogger(__name__)

voice_bp = Blueprint('voice_api', __name__, url_prefix='/api/v1/voice')
csrf.exempt(voice_bp)
VOICE_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'voice_uploads')
ALLOWED_VOICE_EXTS = {'.m4a', '.aac', '.mp3', '.wav', '.ogg'}
ALLOWED_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def _uid(user):
    return user.wiam_id or user.id


def _creator_wiam(user):
    return user.wiam_id or user.id


def _creator_user(creator_wiam_id):
    u = User.query.filter_by(wiam_id=creator_wiam_id).first()
    if u:
        return u
    try:
        pk = int(creator_wiam_id)
    except (TypeError, ValueError):
        return None
    return User.query.get(pk)


def _voice_public_url(filename):
    return request.host_url.rstrip('/') + '/static/voice_uploads/' + filename


def _normalize_cover_url(raw):
    v = (raw or '').strip()[:2000] or None
    if not v:
        return None
    low = v.lower()
    if low.startswith('file://') or low.startswith('content://'):
        return None
    return v


def _is_cloudinary_url(url):
    if not url:
        return False
    return 'res.cloudinary.com' in str(url).lower()


def _upload_cover_bytes_to_cloudinary(user_id, image_bytes, content_type='image/jpeg', story_id=None):
    """Upload a voice cover to Cloudinary.

    If ``story_id`` is provided we use a stable ``voice_cover_<id>`` public
    id so re-uploads overwrite the previous asset and we never leak orphan
    files. For drafts that don't have a story id yet we still fall back to
    a UUID so two simultaneous draft creations don't collide.
    """
    if story_id:
        public_id = f'voice_cover_{int(story_id)}'
    else:
        public_id = f'voice_cover_user{user_id}_{uuid.uuid4().hex[:12]}'
    return upload_image(
        image_bytes,
        folder='voice_covers',
        public_id=public_id,
        content_type=content_type,
        scan_nsfw=True,
    )


def _has_unlock(story_id, viewer_uid):
    if viewer_uid is None:
        return False
    return (
        VoiceStoryUnlock.query.filter_by(story_id=story_id, user_id=viewer_uid).first()
        is not None
    )


def _can_listen(story, viewer_uid):
    if story.status != 'published':
        return False
    if not story.is_locked:
        return True
    if viewer_uid is not None and story.creator_wiam_id == viewer_uid:
        return True
    return _has_unlock(story.id, viewer_uid)


def _moment_json(m, story, viewer_uid, include_meta=False):
    listen = _can_listen(story, viewer_uid)
    row = {
        'id': m.id,
        'story_id': m.story_id,
        'duration_seconds': m.duration_seconds,
        'sort_order': m.sort_order,
        'created_at': m.created_at.isoformat() + 'Z' if m.created_at else None,
    }
    if listen:
        row['audio_url'] = m.audio_url
    else:
        row['audio_url'] = None
    if include_meta and viewer_uid is not None:
        row['liked'] = (
            VoiceMomentLike.query.filter_by(moment_id=m.id, user_id=viewer_uid).first()
            is not None
        )
    if include_meta:
        row['like_count'] = VoiceMomentLike.query.filter_by(moment_id=m.id).count()
    return row


def _story_json(story, viewer_uid=None, include_moments=False, moment_detail=False):
    creator = _creator_user(story.creator_wiam_id)
    unlocked = _has_unlock(story.id, viewer_uid)
    owner = viewer_uid is not None and story.creator_wiam_id == viewer_uid
    listen = _can_listen(story, viewer_uid)

    data = {
        'id': story.id,
        'title': story.title,
        'description': story.description or '',
        'cover_url': _abs_url(story.cover_url),
        'emotion_tag': story.emotion_tag or '',
        'status': story.status,
        'is_locked': story.is_locked,
        'unlock_price_coins': story.unlock_price_coins,
        'creator_wiam_id': story.creator_wiam_id,
        'creator_display_name': creator.display_name if creator else None,
        'creator_avatar_url': _abs_url(getattr(creator, 'avatar_url', None)) if creator else None,
        'created_at': story.created_at.isoformat() + 'Z' if story.created_at else None,
        'published_at': story.published_at.isoformat() + 'Z' if story.published_at else None,
        'is_owner': owner,
        'unlocked': unlocked or owner,
        'can_listen': listen,
        'listen_count': int(getattr(story, 'listen_count', None) or 0),
    }
    if viewer_uid is not None:
        data['saved'] = (
            VoiceStorySave.query.filter_by(story_id=story.id, user_id=viewer_uid).first()
            is not None
        )
    else:
        data['saved'] = False

    if include_moments and viewer_uid is not None and moment_detail:
        pr = VoiceListenProgress.query.filter_by(user_id=viewer_uid, story_id=story.id).first()
        if pr:
            data['listen_progress'] = {
                'moment_id': pr.moment_id,
                'position_seconds': float(pr.position_seconds or 0),
            }
        else:
            data['listen_progress'] = None

    if include_moments:
        moments = (
            VoiceMoment.query.filter_by(story_id=story.id)
            .order_by(VoiceMoment.sort_order, VoiceMoment.id)
            .all()
        )
        data['moments'] = [
            _moment_json(m, story, viewer_uid, include_meta=moment_detail) for m in moments
        ]
    return data


def _story_home_item(story, viewer_uid, moment_count, total_duration_seconds):
    """Light story payload for home rails + duration stats for bucketing."""
    j = _story_json(story, viewer_uid, include_moments=False)
    j['moment_count'] = int(moment_count or 0)
    j['total_duration_seconds'] = float(total_duration_seconds or 0)
    return j


@voice_bp.route('/home', methods=['GET'])
@jwt_optional
def voice_home():
    """Single payload for Vox home: many horizontal sections (WiamApp /home pattern)."""
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None

    stories = (
        VoiceStory.query.filter_by(status='published')
        .order_by(VoiceStory.published_at.desc().nullslast(), VoiceStory.id.desc())
        .limit(100)
        .all()
    )
    if not stories:
        return jsonify({'sections': []})

    story_ids = [s.id for s in stories]
    agg_rows = (
        db.session.query(
            VoiceMoment.story_id,
            func.count(VoiceMoment.id).label('mc'),
            func.coalesce(func.sum(VoiceMoment.duration_seconds), 0).label('td'),
        )
        .filter(VoiceMoment.story_id.in_(story_ids))
        .group_by(VoiceMoment.story_id)
        .all()
    )
    meta = {
        int(row.story_id): {'moment_count': int(row.mc), 'total_duration_seconds': float(row.td or 0)}
        for row in agg_rows
    }

    items = []
    for st in stories:
        m = meta.get(st.id, {'moment_count': 0, 'total_duration_seconds': 0})
        items.append(_story_home_item(st, viewer_uid, m['moment_count'], m['total_duration_seconds']))

    id_to_item = {x['id']: x for x in items}

    if viewer_uid:
        prog_rows = (
            VoiceListenProgress.query.filter_by(user_id=viewer_uid)
            .order_by(desc(VoiceListenProgress.updated_at))
            .limit(25)
            .all()
        )
        extra_ids = []
        for pr in prog_rows:
            if pr.story_id not in story_ids and pr.story_id not in extra_ids:
                extra_ids.append(pr.story_id)
        if extra_ids:
            agg_extra = (
                db.session.query(
                    VoiceMoment.story_id,
                    func.count(VoiceMoment.id).label('mc'),
                    func.coalesce(func.sum(VoiceMoment.duration_seconds), 0).label('td'),
                )
                .filter(VoiceMoment.story_id.in_(extra_ids))
                .group_by(VoiceMoment.story_id)
                .all()
            )
            for row in agg_extra:
                meta[int(row.story_id)] = {
                    'moment_count': int(row.mc),
                    'total_duration_seconds': float(row.td or 0),
                }
            for sid in extra_ids:
                meta.setdefault(sid, {'moment_count': 0, 'total_duration_seconds': 0})

        continue_stories = []
        seen_c = set()
        for pr in prog_rows:
            if pr.story_id in seen_c:
                continue
            st = VoiceStory.query.get(pr.story_id)
            if not st or st.status != 'published':
                continue
            seen_c.add(pr.story_id)
            if pr.story_id in id_to_item:
                continue_stories.append(id_to_item[pr.story_id])
            else:
                m = meta.get(pr.story_id, {'moment_count': 0, 'total_duration_seconds': 0})
                continue_stories.append(_story_home_item(st, viewer_uid, m['moment_count'], m['total_duration_seconds']))
            if len(continue_stories) >= 12:
                break
    else:
        continue_stories = []

    def pick(predicate, limit=15):
        return [x for x in items if predicate(x)][:limit]

    sections = []
    if continue_stories:
        sections.append({'key': 'continue_listening', 'title': 'Continue listening', 'stories': continue_stories})
    sections.append({'key': 'new_in_vox', 'title': 'New in Vox', 'stories': items[:15]})
    sections.append(
        {
            'key': 'quick_listens',
            'title': 'Quick listens',
            'stories': pick(lambda x: 0 < x['total_duration_seconds'] < 180, 12),
        }
    )
    sections.append(
        {
            'key': 'long_journeys',
            'title': 'Long journeys',
            'stories': pick(lambda x: x['total_duration_seconds'] >= 600, 12),
        }
    )
    sections.append(
        {
            'key': 'multi_moment',
            'title': 'Episodes & arcs',
            'stories': pick(lambda x: x['moment_count'] >= 2, 12),
        }
    )
    sections.append(
        {
            'key': 'locked_picks',
            'title': 'Coin‑unlocked picks',
            'stories': pick(lambda x: x['is_locked'], 10),
        }
    )
    sections.append(
        {
            'key': 'free_to_hear',
            'title': 'Free to hear',
            'stories': pick(lambda x: not x['is_locked'], 15),
        }
    )

    tags_ordered = []
    seen = set()
    for x in items:
        raw = (x.get('emotion_tag') or '').strip()
        if not raw:
            continue
        key = raw.lower()
        if key in seen:
            continue
        seen.add(key)
        tags_ordered.append(raw)
        if len(tags_ordered) >= 8:
            break
    for raw in tags_ordered:
        key_l = raw.lower()
        title = raw[:1].upper() + raw[1:] if raw else 'Mood'
        sections.append(
            {
                'key': f'emotion_{key_l.replace(" ", "_")[:40]}',
                'title': f'{title} vibes',
                'stories': [x for x in items if key_l in (x.get('emotion_tag') or '').lower()][:12],
            }
        )

    sections = [s for s in sections if s.get('stories')]
    return jsonify({'sections': sections})


@voice_bp.route('/feed', methods=['GET'])
@jwt_optional
def voice_feed():
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None

    q = (
        VoiceStory.query.filter_by(status='published')
        .order_by(VoiceStory.published_at.desc().nullslast(), VoiceStory.id.desc())
    )
    total = q.count()
    stories = q.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify(
        {
            'stories': [_story_json(s, viewer_uid, include_moments=True) for s in stories],
            'page': page,
            'per_page': per_page,
            'total': total,
        }
    )


@voice_bp.route('/explore', methods=['GET'])
@jwt_optional
def voice_explore():
    """Same as feed with optional emotion_tag filter."""
    tag = (request.args.get('emotion') or request.args.get('emotion_tag') or '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 20))))
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None

    q = VoiceStory.query.filter_by(status='published')
    if tag:
        q = q.filter(VoiceStory.emotion_tag.ilike(f'%{tag}%'))
    q = q.order_by(VoiceStory.published_at.desc().nullslast(), VoiceStory.id.desc())
    total = q.count()
    stories = q.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify(
        {
            'stories': [_story_json(s, viewer_uid, include_moments=True) for s in stories],
            'page': page,
            'per_page': per_page,
            'total': total,
            'emotion_filter': tag or None,
        }
    )


@voice_bp.route('/story/<int:story_id>', methods=['GET'])
@jwt_optional
def voice_story_detail(story_id):
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.status == 'draft' and (viewer_uid is None or story.creator_wiam_id != viewer_uid):
        return jsonify({'error': 'Story not found'}), 404
    return jsonify(_story_json(story, viewer_uid, include_moments=True, moment_detail=True))


@voice_bp.route('/story', methods=['POST'])
@jwt_required
def voice_story_create():
    user = request.api_user
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or 'Untitled').strip()[:500]
    description = (data.get('description') or '').strip()[:8000]
    cover_url = _normalize_cover_url(data.get('cover_url'))
    if cover_url and not _is_cloudinary_url(cover_url):
        return jsonify({'error': 'cover_url must be a Cloudinary URL'}), 400
    emotion_tag = (data.get('emotion_tag') or '').strip()[:120]
    is_locked = bool(data.get('is_locked'))
    price = data.get('unlock_price_coins')
    try:
        unlock_price_coins = int(price) if price is not None and str(price).strip() != '' else None
    except (TypeError, ValueError):
        unlock_price_coins = None
    if is_locked and (not unlock_price_coins or unlock_price_coins < 1):
        return jsonify({'error': 'Locked stories require unlock_price_coins >= 1'}), 400

    cw = _creator_wiam(user)
    story = VoiceStory(
        creator_wiam_id=cw,
        title=title,
        description=description,
        cover_url=cover_url,
        emotion_tag=emotion_tag,
        status='draft',
        is_locked=is_locked,
        unlock_price_coins=unlock_price_coins if is_locked else None,
    )
    db.session.add(story)
    db.session.commit()
    return jsonify(_story_json(story, _uid(user), include_moments=True)), 201


@voice_bp.route('/story/<int:story_id>', methods=['PATCH'])
@jwt_required
def voice_story_patch(story_id):
    user = request.api_user
    uid = _uid(user)
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.creator_wiam_id != uid:
        return jsonify({'error': 'Forbidden'}), 403
    if story.status == 'published':
        return jsonify({'error': 'Cannot edit published story'}), 400

    data = request.get_json(silent=True) or {}
    if 'title' in data:
        story.title = (data.get('title') or 'Untitled').strip()[:500]
    if 'description' in data:
        story.description = (data.get('description') or '').strip()[:8000]
    if 'cover_url' in data:
        next_cover = _normalize_cover_url(data.get('cover_url'))
        if next_cover and not _is_cloudinary_url(next_cover):
            return jsonify({'error': 'cover_url must be a Cloudinary URL'}), 400
        previous_cover = story.cover_url
        story.cover_url = next_cover
        if previous_cover and previous_cover != next_cover:
            try:
                delete_image_url(previous_cover)
            except Exception:
                pass
    if 'emotion_tag' in data:
        story.emotion_tag = (data.get('emotion_tag') or '').strip()[:120]
    if 'is_locked' in data:
        story.is_locked = bool(data.get('is_locked'))
    if 'unlock_price_coins' in data:
        p = data.get('unlock_price_coins')
        try:
            story.unlock_price_coins = int(p) if p is not None and str(p).strip() != '' else None
        except (TypeError, ValueError):
            story.unlock_price_coins = None
    if story.is_locked and (not story.unlock_price_coins or story.unlock_price_coins < 1):
        return jsonify({'error': 'Locked stories require unlock_price_coins >= 1'}), 400
    if not story.is_locked:
        story.unlock_price_coins = None

    db.session.commit()
    return jsonify(_story_json(story, uid, include_moments=True))


@voice_bp.route('/story/<int:story_id>/publish', methods=['POST'])
@jwt_required
def voice_story_publish(story_id):
    user = request.api_user
    uid = _uid(user)
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.creator_wiam_id != uid:
        return jsonify({'error': 'Forbidden'}), 403
    if story.status == 'published':
        return jsonify(_story_json(story, uid, include_moments=True))

    if VoiceMoment.query.filter_by(story_id=story.id).count() < 1:
        return jsonify({'error': 'Add at least one moment before publishing'}), 400
    if story.is_locked and (not story.unlock_price_coins or story.unlock_price_coins < 1):
        return jsonify({'error': 'Locked stories require unlock_price_coins >= 1'}), 400

    story.status = 'published'
    story.published_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_story_json(story, uid, include_moments=True))


@voice_bp.route('/moment', methods=['POST'])
@jwt_required
def voice_moment_create():
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    story_id = data.get('story_id')
    audio_url = (data.get('audio_url') or '').strip()
    if not story_id or not audio_url:
        return jsonify({'error': 'story_id and audio_url required'}), 400
    try:
        story_id = int(story_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid story_id'}), 400

    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.creator_wiam_id != uid:
        return jsonify({'error': 'Forbidden'}), 403
    if story.status == 'published':
        return jsonify({'error': 'Cannot add moments to published story'}), 400

    duration = float(data.get('duration_seconds') or 0)
    sort_order = int(data.get('sort_order') or 0)
    m = VoiceMoment(
        story_id=story.id,
        audio_url=audio_url[:4000],
        duration_seconds=duration,
        sort_order=sort_order,
    )
    db.session.add(m)
    db.session.commit()
    return jsonify(_moment_json(m, story, uid, include_meta=True)), 201


@voice_bp.route('/upload', methods=['POST'])
@jwt_required
def voice_upload():
    """
    Store uploaded voice clip in /static/voice_uploads and return public URL.
    This is V1 filesystem storage for fast delivery.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'file required'}), 400
    f = request.files['file']
    if not f or not f.filename:
        return jsonify({'error': 'Invalid file'}), 400

    original_name = secure_filename(f.filename)
    _, ext = os.path.splitext(original_name.lower())
    if ext not in ALLOWED_VOICE_EXTS:
        return jsonify({'error': f'Unsupported format: {ext or "unknown"}'}), 400

    # Hard safety cap for V1 mobile uploads.
    content_length = request.content_length or 0
    if content_length > 25 * 1024 * 1024:
        return jsonify({'error': 'File too large (max 25MB)'}), 413

    os.makedirs(VOICE_UPLOAD_DIR, exist_ok=True)
    out_name = f"voice_{uuid.uuid4().hex}{ext}"
    out_path = os.path.join(VOICE_UPLOAD_DIR, out_name)
    f.save(out_path)

    return jsonify({'ok': True, 'audio_url': _voice_public_url(out_name), 'filename': out_name})


@voice_bp.route('/upload-cover', methods=['POST'])
@jwt_required
def voice_upload_cover():
    """
    Upload a story cover image to Cloudinary (shared WiamApp image pipeline).
    Returns a Cloudinary URL to be stored in VoiceStory.cover_url.
    """
    user = request.api_user
    if 'cover' not in request.files:
        return jsonify({'error': 'cover file required'}), 400
    f = request.files['cover']
    if not f or not f.filename:
        return jsonify({'error': 'Invalid cover file'}), 400

    original_name = secure_filename(f.filename)
    _, ext = os.path.splitext(original_name.lower())
    if ext not in ALLOWED_IMAGE_EXTS:
        return jsonify({'error': f'Unsupported image format: {ext or "unknown"}'}), 400

    content_length = request.content_length or 0
    if content_length > 8 * 1024 * 1024:
        return jsonify({'error': 'Image too large (max 8MB)'}), 413

    content_type = (f.mimetype or '').strip() or 'image/jpeg'
    raw = f.read()
    if not raw:
        return jsonify({'error': 'Empty cover file'}), 400

    story_id = None
    raw_sid = request.form.get('story_id') or request.values.get('story_id')
    if raw_sid:
        try:
            story_id = int(raw_sid)
        except (TypeError, ValueError):
            story_id = None
    if story_id:
        owned = VoiceStory.query.filter_by(id=story_id, creator_wiam_id=_uid(user)).first()
        if not owned:
            story_id = None

    cloud_url = _upload_cover_bytes_to_cloudinary(
        _uid(user), raw, content_type=content_type, story_id=story_id,
    )
    if not cloud_url:
        return jsonify({
            'error': (
                'Cover could not be accepted. Please make sure it follows '
                'community guidelines and try a different image.'
            ),
        }), 400

    return jsonify({'ok': True, 'cover_url': _abs_url(cloud_url)})


@voice_bp.route('/upload-cover-from-url', methods=['POST'])
@jwt_required
def voice_upload_cover_from_url():
    """
    Ingest external image URL and re-host on Cloudinary.
    Ensures VoiceStory.cover_url points to platform-controlled CDN assets.
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    src = (data.get('source_url') or '').strip()
    if not src:
        return jsonify({'error': 'source_url required'}), 400
    parsed = urlparse(src)
    if parsed.scheme not in ('http', 'https'):
        return jsonify({'error': 'Only http/https URLs are allowed'}), 400

    try:
        req = Request(src, headers={'User-Agent': 'WiamVox/1.0 CoverIngest'})
        with urlopen(req, timeout=12) as resp:
            content_type = (resp.headers.get('Content-Type') or 'image/jpeg').lower()
            if not content_type.startswith('image/'):
                return jsonify({'error': 'URL does not point to an image'}), 400
            raw = resp.read(8 * 1024 * 1024 + 1)
            if not raw:
                return jsonify({'error': 'Empty image'}), 400
            if len(raw) > 8 * 1024 * 1024:
                return jsonify({'error': 'Image too large (max 8MB)'}), 413
    except Exception:
        return jsonify({'error': 'Could not fetch image URL'}), 400

    story_id = None
    raw_sid = data.get('story_id')
    if raw_sid:
        try:
            story_id = int(raw_sid)
        except (TypeError, ValueError):
            story_id = None
    if story_id:
        owned = VoiceStory.query.filter_by(id=story_id, creator_wiam_id=_uid(user)).first()
        if not owned:
            story_id = None

    cloud_url = _upload_cover_bytes_to_cloudinary(
        _uid(user), raw, content_type=content_type, story_id=story_id,
    )
    if not cloud_url:
        return jsonify({
            'error': (
                'Cover could not be accepted. Please make sure it follows '
                'community guidelines and try a different image.'
            ),
        }), 400
    return jsonify({'ok': True, 'cover_url': _abs_url(cloud_url)})


@voice_bp.route('/like/toggle', methods=['POST'])
@jwt_required
def voice_like_toggle():
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    moment_id = data.get('moment_id')
    try:
        moment_id = int(moment_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'moment_id required'}), 400

    m = VoiceMoment.query.get(moment_id)
    if not m:
        return jsonify({'error': 'Moment not found'}), 404
    story = VoiceStory.query.get(m.story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Not found'}), 404
    if not _can_listen(story, uid):
        return jsonify({'error': 'Unlock required'}), 403

    existing = VoiceMomentLike.query.filter_by(moment_id=m.id, user_id=uid).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'liked': False})
    db.session.add(VoiceMomentLike(moment_id=m.id, user_id=uid))
    db.session.commit()
    return jsonify({'liked': True})


@voice_bp.route('/comment', methods=['POST'])
@jwt_required
def voice_comment_create():
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    moment_id = data.get('moment_id')
    text = (data.get('text') or '').strip()
    try:
        moment_id = int(moment_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'moment_id required'}), 400
    if not text:
        return jsonify({'error': 'text required'}), 400

    m = VoiceMoment.query.get(moment_id)
    if not m:
        return jsonify({'error': 'Moment not found'}), 404
    story = VoiceStory.query.get(m.story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Not found'}), 404
    if not _can_listen(story, uid):
        return jsonify({'error': 'Unlock required'}), 403

    c = VoiceMomentComment(moment_id=m.id, user_id=uid, text=text[:4000])
    db.session.add(c)
    db.session.commit()
    return jsonify({'id': c.id, 'moment_id': c.moment_id, 'created_at': c.created_at.isoformat() + 'Z'}), 201


@voice_bp.route('/story/<int:story_id>/comments', methods=['GET'])
@jwt_optional
def voice_story_comments(story_id):
    """List comments for all moments of a story (newest first)."""
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.status == 'draft' and (viewer_uid is None or story.creator_wiam_id != viewer_uid):
        return jsonify({'error': 'Story not found'}), 404
    if not _can_listen(story, viewer_uid):
        return jsonify({'error': 'Unlock required'}), 403

    moment_ids = [mid for (mid,) in db.session.query(VoiceMoment.id).filter_by(story_id=story.id).all()]
    if not moment_ids:
        return jsonify({'comments': []})
    rows = (
        VoiceMomentComment.query.filter(
            VoiceMomentComment.moment_id.in_(moment_ids),
            VoiceMomentComment.is_deleted.is_(False),
        )
        .order_by(VoiceMomentComment.created_at.desc())
        .limit(100)
        .all()
    )
    out = []
    for c in rows:
        u = User.query.filter_by(wiam_id=c.user_id).first()
        if not u and c.user_id is not None:
            try:
                u = User.query.get(int(c.user_id))
            except (TypeError, ValueError):
                u = None
        out.append(
            {
                'id': c.id,
                'moment_id': c.moment_id,
                'user_id': c.user_id,
                'display_name': u.display_name if u else None,
                'text': c.text,
                'created_at': c.created_at.isoformat() + 'Z' if c.created_at else None,
            }
        )
    return jsonify({'comments': out})


@voice_bp.route('/save/toggle', methods=['POST'])
@jwt_required
def voice_save_toggle():
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    try:
        story_id = int(data.get('story_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'story_id required'}), 400

    story = VoiceStory.query.get(story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404

    existing = VoiceStorySave.query.filter_by(story_id=story.id, user_id=uid).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'saved': False})
    db.session.add(VoiceStorySave(story_id=story.id, user_id=uid))
    db.session.commit()
    return jsonify({'saved': True})


@voice_bp.route('/tip', methods=['POST'])
@jwt_required
def voice_tip():
    """Tip voice story creator with coins (same limits as book tips)."""
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    amount = data.get('amount', 0)
    if not isinstance(amount, int) or amount < 1:
        return jsonify({'error': 'Invalid tip amount'}), 400
    if amount > 100:
        return jsonify({'error': 'Maximum tip is 100 coins'}), 400
    try:
        story_id = int(data.get('story_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'story_id required'}), 400

    moment_id_raw = data.get('moment_id')
    moment_id = None
    if moment_id_raw is not None and str(moment_id_raw).strip() != '':
        try:
            moment_id = int(moment_id_raw)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid moment_id'}), 400

    story = VoiceStory.query.get(story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404
    if story.creator_wiam_id == uid:
        return jsonify({'error': 'You cannot tip yourself'}), 400

    if moment_id is not None:
        m = VoiceMoment.query.get(moment_id)
        if not m or m.story_id != story.id:
            return jsonify({'error': 'Moment not found'}), 404
        if not _can_listen(story, uid):
            return jsonify({'error': 'Unlock required to tip on a moment'}), 403

    try:
        result = record_voice_tip(uid, story.creator_wiam_id, story_id, moment_id, amount)
        if result.get('error'):
            if 'Not enough' in result['error']:
                bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
                return jsonify(
                    {'error': result['error'], 'need_coins': True, 'balance': bal.balance if bal else 0}
                ), 402
            return jsonify({'error': result['error']}), 400
        new_balance = result['balance']
    except Exception as e:
        log.exception('voice tip ledger: %s', e)
        return jsonify({'error': 'Tip failed'}), 500

    creator_user = User.query.filter_by(wiam_id=story.creator_wiam_id).first()
    share_key = creator_user.id if creator_user else story.creator_wiam_id
    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=story.creator_wiam_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(creator_id=story.creator_wiam_id, year=now.year, month=now.month)
        db.session.add(earn)
    earn.coins_from_tips = (earn.coins_from_tips or 0) + amount
    earn.total_coins = (earn.coins_from_unlocks or 0) + (earn.coins_from_tips or 0)
    share_pct = RevenueRule.get_creator_share(share_key) or 50.0
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = now
    db.session.commit()
    return jsonify({'ok': True, 'balance': new_balance, 'amount': amount})


@voice_bp.route('/unlock', methods=['POST'])
@jwt_required
def voice_unlock():
    user = request.api_user
    uid = _uid(user)
    data = request.get_json(silent=True) or {}
    try:
        story_id = int(data.get('story_id'))
    except (TypeError, ValueError):
        return jsonify({'error': 'story_id required'}), 400

    story = VoiceStory.query.get(story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404
    if not story.is_locked:
        return jsonify({'error': 'Story is not locked'}), 400
    if story.creator_wiam_id == uid:
        return jsonify({'ok': True, 'already_unlocked': True})
    if _has_unlock(story_id, uid):
        return jsonify({'ok': True, 'already_unlocked': True})

    coins_needed = int(story.unlock_price_coins or 0)
    if coins_needed < 1:
        return jsonify({'error': 'Invalid price'}), 400

    try:
        result = record_voice_story_unlock(uid, story.creator_wiam_id, story_id, coins_needed)
        if result.get('error'):
            bal = CoinBalance.query.get(user.wiam_id) or CoinBalance.query.get(user.id)
            return jsonify(
                {
                    'error': result['error'],
                    'need_coins': 'Not enough' in result['error'],
                    'balance': bal.balance if bal else 0,
                }
            ), 402
    except Exception as e:
        log.exception('voice unlock ledger: %s', e)
        return jsonify({'error': 'Unlock failed'}), 500

    unlock = VoiceStoryUnlock(
        user_id=uid,
        story_id=story_id,
        coins_spent=coins_needed,
        creator_wiam_id=story.creator_wiam_id,
    )
    db.session.add(unlock)

    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=story.creator_wiam_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(creator_id=story.creator_wiam_id, year=now.year, month=now.month)
        db.session.add(earn)
    earn.coins_from_unlocks = (earn.coins_from_unlocks or 0) + coins_needed
    earn.total_coins = (earn.coins_from_unlocks or 0) + (earn.coins_from_tips or 0)
    share_pct = RevenueRule.get_creator_share(story.creator_wiam_id) or 50.0
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = now

    db.session.commit()
    return jsonify({'ok': True, 'balance': result['balance'], 'coins_spent': coins_needed})


@voice_bp.route('/library/saved', methods=['GET'])
@jwt_required
def voice_library_saved():
    user = request.api_user
    uid = _uid(user)
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(50, max(1, int(request.args.get('per_page', 30))))

    q = (
        VoiceStory.query.join(VoiceStorySave, VoiceStorySave.story_id == VoiceStory.id)
        .filter(VoiceStorySave.user_id == uid, VoiceStory.status == 'published')
        .order_by(VoiceStorySave.created_at.desc())
    )
    total = q.count()
    stories = q.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify(
        {
            'stories': [_story_json(s, uid, include_moments=True) for s in stories],
            'page': page,
            'per_page': per_page,
            'total': total,
        }
    )


@voice_bp.route('/me/stories', methods=['GET'])
@jwt_required
def voice_my_stories():
    user = request.api_user
    uid = _uid(user)
    status = (request.args.get('status') or '').strip().lower()
    q = VoiceStory.query.filter(VoiceStory.creator_wiam_id == uid, VoiceStory.status != 'deleted')
    if status in ('draft', 'published'):
        q = q.filter_by(status=status)
    q = q.order_by(VoiceStory.id.desc())
    stories = q.limit(100).all()
    return jsonify({'stories': [_story_json(s, uid, include_moments=True) for s in stories]})


@voice_bp.route('/story/<int:story_id>/register_listen', methods=['POST'])
@jwt_optional
def voice_register_listen(story_id):
    """Increment story.listen_count at most once per identity per UTC day (logged-in or guest session_key)."""
    story = VoiceStory.query.get(story_id)
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404
    if not _can_listen(story, viewer_uid):
        return jsonify({'error': 'Unlock required'}), 403

    today = datetime.utcnow().strftime('%Y-%m-%d')
    if viewer_uid:
        bucket_key = f'u:{viewer_uid}:{today}'
    else:
        session_key = (request.get_json(silent=True) or {}).get('session_key') or ''
        session_key = str(session_key).strip()[:160]
        if len(session_key) < 12:
            return jsonify({'error': 'session_key (12+ chars) required for guests'}), 400
        bucket_key = f's:{session_key}:{today}'

    if VoiceListenDayBucket.query.filter_by(story_id=story.id, bucket_key=bucket_key).first():
        return jsonify({'counted': False, 'listen_count': int(getattr(story, 'listen_count', None) or 0)})

    db.session.add(VoiceListenDayBucket(story_id=story.id, bucket_key=bucket_key))
    story.listen_count = int(getattr(story, 'listen_count', None) or 0) + 1
    db.session.commit()
    return jsonify({'counted': True, 'listen_count': story.listen_count})


@voice_bp.route('/story/<int:story_id>/progress', methods=['POST'])
@jwt_required
def voice_story_progress(story_id):
    """Save listen resume position (moment + seconds into moment)."""
    user = request.api_user
    uid = _uid(user)
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if story.status == 'draft' and story.creator_wiam_id != uid:
        return jsonify({'error': 'Story not found'}), 404

    data = request.get_json(silent=True) or {}
    try:
        moment_id = int(data['moment_id']) if data.get('moment_id') is not None else None
    except (TypeError, ValueError):
        moment_id = None
    try:
        position_seconds = float(data.get('position_seconds') or 0)
    except (TypeError, ValueError):
        position_seconds = 0.0

    if moment_id is not None:
        m = VoiceMoment.query.get(moment_id)
        if not m or m.story_id != story.id:
            return jsonify({'error': 'Invalid moment'}), 400

    row = VoiceListenProgress.query.filter_by(user_id=uid, story_id=story_id).first()
    now = datetime.utcnow()
    if not row:
        row = VoiceListenProgress(
            user_id=uid,
            story_id=story_id,
            moment_id=moment_id,
            position_seconds=position_seconds,
            updated_at=now,
        )
        db.session.add(row)
    else:
        row.moment_id = moment_id
        row.position_seconds = position_seconds
        row.updated_at = now
    db.session.commit()
    return jsonify({'ok': True})


@voice_bp.route('/story/<int:story_id>/presence', methods=['GET'])
@jwt_optional
def voice_story_presence(story_id):
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    cutoff = datetime.utcnow() - timedelta(seconds=55)
    n = (
        VoiceListenPresence.query.filter(
            VoiceListenPresence.story_id == story_id,
            VoiceListenPresence.last_seen_at >= cutoff,
        ).count()
    )
    return jsonify({'listener_count': n})


@voice_bp.route('/story/<int:story_id>/presence/heartbeat', methods=['POST'])
@jwt_optional
def voice_story_presence_heartbeat(story_id):
    story = VoiceStory.query.get(story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404
    data = request.get_json(silent=True) or {}
    client_id = str(data.get('client_id') or '').strip()[:120]
    if len(client_id) < 8:
        return jsonify({'error': 'client_id required'}), 400
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None
    now = datetime.utcnow()
    row = VoiceListenPresence.query.filter_by(story_id=story_id, client_id=client_id).first()
    if row:
        row.last_seen_at = now
        if viewer_uid:
            row.user_id = viewer_uid
    else:
        db.session.add(
            VoiceListenPresence(story_id=story_id, client_id=client_id, user_id=viewer_uid, last_seen_at=now)
        )
    db.session.commit()
    cutoff = now - timedelta(seconds=55)
    n = (
        VoiceListenPresence.query.filter(
            VoiceListenPresence.story_id == story_id,
            VoiceListenPresence.last_seen_at >= cutoff,
        ).count()
    )
    return jsonify({'listener_count': n})


@voice_bp.route('/story/<int:story_id>/room/messages', methods=['GET'])
@jwt_optional
def voice_room_messages(story_id):
    viewer = getattr(request, 'api_user', None)
    viewer_uid = _uid(viewer) if viewer else None
    story = VoiceStory.query.get(story_id)
    if not story or story.status == 'deleted':
        return jsonify({'error': 'Story not found'}), 404
    if not _can_listen(story, viewer_uid):
        return jsonify({'error': 'Unlock required'}), 403
    rows = (
        VoiceStoryRoomMessage.query.filter_by(story_id=story_id)
        .order_by(desc(VoiceStoryRoomMessage.created_at))
        .limit(80)
        .all()
    )
    out = []
    for r in reversed(rows):
        u = User.query.filter_by(wiam_id=r.user_id).first() if r.user_id else None
        if not u and r.user_id is not None:
            try:
                u = User.query.get(int(r.user_id))
            except (TypeError, ValueError):
                u = None
        out.append(
            {
                'id': r.id,
                'user_id': r.user_id,
                'display_name': u.display_name if u else None,
                'text': r.text,
                'created_at': r.created_at.isoformat() + 'Z' if r.created_at else None,
            }
        )
    return jsonify({'messages': out})


@voice_bp.route('/story/<int:story_id>/room/messages', methods=['POST'])
@jwt_required
def voice_room_messages_post(story_id):
    user = request.api_user
    uid = _uid(user)
    story = VoiceStory.query.get(story_id)
    if not story or story.status != 'published':
        return jsonify({'error': 'Story not found'}), 404
    if not _can_listen(story, uid):
        return jsonify({'error': 'Unlock required'}), 403
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'text required'}), 400
    text = text[:500]
    msg = VoiceStoryRoomMessage(story_id=story_id, user_id=uid, text=text)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'id': msg.id, 'created_at': msg.created_at.isoformat() + 'Z' if msg.created_at else None}), 201
