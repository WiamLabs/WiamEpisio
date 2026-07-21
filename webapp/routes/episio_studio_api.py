"""
WiamEpisio Studio + Apply + Search + Remind APIs.
Every mobile Studio/Apply button wires here — no dead ends.
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

from ..extensions import db, csrf
from ..models import (
    Content, Episode, EpisioCreatorApplication, SeriesReminder, User,
    CreatorVideoUploadJob, EpisioCreatorInvite, EpisioCreatorInviteRedemption,
    EpisioCreatorPublicProfile, CreatorProfile, CreatorPayoutSettings,
    Feedback,
)
from .api_v1 import jwt_required, jwt_optional, _abs_url, _creator_api_forbidden
from ..services.video_service import get_video_service
from ..services.coin_pricing import resolve_unlock_coins
from ..services.episode_access import free_episode_count_for
from ..services.series_publish_gate import (
    can_go_live, can_submit_for_review, refresh_completeness,
    build_completeness_gates, soft_interest_counts, count_ready_episodes,
    pre_live_fix_window, parse_change_items, _has_cover, _has_banner,
)
from ..services.trailer_qa import gate_enabled
from ..services.platform_notify import notify_episio_series_submitted
from ..services.season_quality_pipeline import (
    enqueue_season_qc, run_season_qc_job, process_queued_jobs, pipeline_enabled,
    estimate_season_review, review_tool_catalog,
)

log = logging.getLogger(__name__)

episio_studio_api = Blueprint('episio_studio_api', __name__, url_prefix='/api/v1')
csrf.exempt(episio_studio_api)

MEDIA_SPECS = {
    'episode': {
        'aspect': '9:16',
        'preferred_resolution': '1080x1920',
        'min_resolution': '720x1280',
        # Product law (Specs Guide): 4–5 minutes only
        'duration_target_seconds': [240, 300],
        'duration_band_seconds': [240, 300],
        'container': 'mp4',
        'codec': 'h264',
        'max_file_mb': 500,
    },
    'trailer': {
        'aspect': '9:16',
        # Product law (Specs Guide): 15–60 seconds — NOT 1–2 minutes
        'duration_band_seconds': [15, 60],
        'preferred_resolution': '1080x1920',
        'min_resolution': '720x1280',
    },
    'cover': {
        'aspect': '2:3',
        'min_resolution': '600x900',
        'preferred_resolution': '1080x1620',
        'max_file_mb': 5,
    },
}


def _drama_q():
    return Content.query.filter(
        Content.deleted_at.is_(None),
        db.or_(Content.format == 'drama', Content.format == 'anime', Content.format == 'Drama'),
    )


def _card_cover_url(c: Content):
    """Return cover URL for API cards only — null when no real upload (not default art)."""
    if not _has_cover(c):
        return None
    poster = getattr(c, 'poster_url', None)
    if poster and 'default_cover' not in str(poster).lower():
        return _abs_url(poster)
    try:
        raw = c.cover_url
    except Exception:
        raw = None
    if raw and 'default_cover' not in str(raw).lower():
        return _abs_url(raw)
    return None


def _series_card(c: Content, user=None):
    ep_count = Episode.query.filter_by(content_id=c.id).count()
    ready = Episode.query.filter_by(content_id=c.id, transcode_status='ready').count()
    final_n = Episode.query.filter_by(content_id=c.id, is_final=True).count()
    failed_eps = Episode.query.filter(
        Episode.content_id == c.id,
        Episode.transcode_status == 'failed',
    ).count()
    qc_failed = Episode.query.filter(
        Episode.content_id == c.id,
        Episode.asset_qc_status == 'failed',
    ).count()
    change_items = parse_change_items(c)
    fix_open = pre_live_fix_window(c)
    return {
        'id': c.id,
        'title': c.title,
        'description': c.description or '',
        'genre': c.genre or '',
        'status': c.status,
        'review_status': getattr(c, 'review_status', None) or 'unreviewed',
        'format': getattr(c, 'format', None) or 'drama',
        'cover_url': _card_cover_url(c),
        'poster_url': _card_cover_url(c),
        'banner_url': _abs_url(getattr(c, 'banner_url', None)) if _has_banner(c) else None,
        'has_cover': _has_cover(c),
        'has_banner': _has_banner(c),
        'planned_episode_count': int(getattr(c, 'planned_episode_count', 0) or 0),
        'structure_mode': getattr(c, 'structure_mode', None) or 'series',
        'season_number': int(getattr(c, 'season_number', 1) or 1),
        'show_group_key': getattr(c, 'show_group_key', None),
        'unit_label': 'season' if (getattr(c, 'structure_mode', None) or 'series') == 'season' else 'series',
        'uploaded_episodes': ep_count,
        'ready_episodes': ready,
        'final_episodes': final_n,
        'failed_episodes': failed_eps + qc_failed,
        'is_series_complete': bool(getattr(c, 'is_series_complete', False)),
        'season_locked': bool(getattr(c, 'season_locked', False)),
        'season_locked_at': c.season_locked_at.isoformat() if getattr(c, 'season_locked_at', None) else None,
        'rights_confirmed': bool(getattr(c, 'rights_confirmed', False)),
        'season_qc_status': getattr(c, 'season_qc_status', None) or 'none',
        'trailer_qa_status': getattr(c, 'trailer_qa_status', None) or 'none',
        'trailer_duration_seconds': int(getattr(c, 'trailer_duration_seconds', 0) or 0),
        'trailer_url': _abs_url(getattr(c, 'trailer_url', None) or getattr(c, 'trailer_hls_url', None)),
        'unlock_price_coins': resolve_unlock_coins(c),
        'free_episode_count': free_episode_count_for(c),
        'creator_wiam_id': c.creator_wiam_id,
        'published_at': c.published_at.isoformat() if c.published_at else None,
        'submitted_for_review_at': (
            c.submitted_for_review_at.isoformat()
            if getattr(c, 'submitted_for_review_at', None) else None
        ),
        'change_items_count': len(change_items),
        'fix_window_open': fix_open,
        'pipeline_state': _pipeline_state(c),
    }


def _pipeline_state(c: Content) -> str:
    """Creator-facing state for Studio Home / Dashboard routing."""
    if c.status in Content.PUBLISHED_STATUSES:
        return 'live'
    rev = (getattr(c, 'review_status', None) or '').lower()
    qc = (getattr(c, 'season_qc_status', None) or '').lower()
    if qc in ('needs_changes', 'failed') or rev == 'revision_requested':
        return 'needs_changes'
    if rev == 'under_review' or qc in ('queued', 'pending', 'running', 'borderline'):
        return 'in_review'
    if getattr(c, 'season_locked', False):
        return 'locked'
    return 'building'


def _locked_blocks_write(c: Content, user) -> bool:
    """True when season lock blocks create/replace (founders always pass)."""
    if getattr(user, 'is_founder', False):
        return False
    if not getattr(c, 'season_locked', False):
        return False
    # Pre-live Needs Changes: allow replace of existing assets
    if pre_live_fix_window(c):
        return False
    return True


def _ep_json(e: Episode):
    return {
        'id': e.id,
        'episode_number': e.episode_number,
        'title': e.title,
        'synopsis': e.synopsis or '',
        'duration_seconds': e.duration_seconds or 0,
        'transcode_status': e.transcode_status,
        'published': bool(e.published),
        'poster_url': _abs_url(e.poster_url),
        'is_final': bool(getattr(e, 'is_final', False)),
        'asset_qc_status': getattr(e, 'asset_qc_status', None) or 'none',
        'asset_qc_band': getattr(e, 'asset_qc_band', None),
        'rejected': (e.transcode_status == 'failed') or (
            (getattr(e, 'asset_qc_status', None) or '') == 'failed'
        ),
    }


def _owns(user, c: Content) -> bool:
    if getattr(user, 'is_founder', False):
        return True
    uid = user.wiam_id or user.id
    return c.creator_wiam_id in (uid, user.wiam_id, user.id)


def _validate_aspect(width, height):
    try:
        w, h = int(width or 0), int(height or 0)
    except (TypeError, ValueError):
        return False, 'Missing width/height'
    if w < 720 or h < 1280:
        return False, f'Resolution too low ({w}x{h}). Min 720x1280, prefer 1080x1920.'
    ratio = w / float(h) if h else 0
    # 9:16 = 0.5625; allow small tolerance
    if abs(ratio - 9 / 16) > 0.05:
        return False, f'Video must be 9:16 vertical. Got {w}x{h}.'
    return True, None


def _validate_duration(seconds, kind='episode'):
    try:
        s = int(seconds or 0)
    except (TypeError, ValueError):
        return False, 'Missing duration'
    band = MEDIA_SPECS['trailer' if kind == 'trailer' else 'episode']['duration_band_seconds']
    if s < band[0] or s > band[1]:
        return False, f'Duration {s}s outside allowed band {band[0]}–{band[1]}s for {kind}.'
    return True, None


# ---------------------------------------------------------------------------
# Public media specs (Studio UI)
# ---------------------------------------------------------------------------

@episio_studio_api.route('/episio/media-specs', methods=['GET'])
def media_specs():
    return jsonify({'ok': True, 'specs': MEDIA_SPECS})


# ---------------------------------------------------------------------------
# Search + Remind
# ---------------------------------------------------------------------------

@episio_studio_api.route('/watch/search', methods=['GET'])
@jwt_optional
def watch_search():
    q = (request.args.get('q') or '').strip()
    if len(q) < 1:
        return jsonify({'series': [], 'q': q})
    like = f'%{q}%'
    rows = (
        _drama_q()
        .filter(Content.status.in_(Content.PUBLISHED_STATUSES))
        .filter(db.or_(Content.title.ilike(like), Content.genre.ilike(like), Content.description.ilike(like)))
        .order_by(Content.ranking_score.desc().nullslast(), Content.id.desc())
        .limit(40)
        .all()
    )
    user = getattr(request, 'api_user', None)
    return jsonify({'q': q, 'series': [_series_card(c, user) for c in rows]})


@episio_studio_api.route('/series/<int:series_id>/remind', methods=['POST', 'DELETE'])
@jwt_required
def series_remind(series_id):
    user = request.api_user
    uid = user.wiam_id or user.id
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    existing = SeriesReminder.query.filter_by(user_id=uid, content_id=series_id).first()
    if request.method == 'DELETE':
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify({'ok': True, 'reminded': False})
    if not existing:
        db.session.add(SeriesReminder(user_id=uid, content_id=series_id))
        db.session.commit()
    count = SeriesReminder.query.filter_by(content_id=series_id).count()
    return jsonify({'ok': True, 'reminded': True, 'remind_count': count})


@episio_studio_api.route('/watch/reminders', methods=['GET'])
@jwt_required
def list_reminders():
    user = request.api_user
    uid = user.wiam_id or user.id
    rows = SeriesReminder.query.filter_by(user_id=uid).order_by(SeriesReminder.created_at.desc()).limit(50).all()
    out = []
    for r in rows:
        c = Content.query.get(r.content_id)
        if c and not c.is_deleted:
            card = _series_card(c, user)
            card['reminded_at'] = r.created_at.isoformat() if r.created_at else None
            out.append(card)
    return jsonify({'reminders': out})


# ---------------------------------------------------------------------------
# Creator apply (Episio quality gate)
# ---------------------------------------------------------------------------

@episio_studio_api.route('/creator/episio/apply', methods=['GET', 'POST'])
@jwt_required
def episio_apply():
    user = request.api_user
    uid = user.wiam_id or user.id
    latest = (
        EpisioCreatorApplication.query
        .filter_by(user_id=uid)
        .order_by(EpisioCreatorApplication.id.desc())
        .first()
    )
    invite_only = (os.environ.get('EPISIO_CREATOR_INVITE_ONLY') or '1').strip() != '0'
    if request.method == 'GET':
        payload = {
            'application': _apply_json(latest) if latest else None,
            'is_creator': bool(user.is_creator),
            'studio_unlocked': bool(user.is_creator or (latest and latest.status == 'accepted')),
            'invite_only': invite_only and not bool(user.is_creator),
        }
        return jsonify(payload)

    data = request.get_json(silent=True) or {}
    # Stage 1 curated: waitlist only unless already creator / has invite code
    invite_code = (data.get('invite_code') or '').strip().upper().replace(' ', '')
    allowed_code = (os.environ.get('EPISIO_CREATOR_INVITE_CODE') or '').strip().upper().replace(' ', '')
    has_invite = bool(allowed_code and invite_code and invite_code == allowed_code)
    if not has_invite and invite_code:
        inv = EpisioCreatorInvite.query.filter_by(code=invite_code).first()
        if inv:
            ok, _err = _invite_valid(inv)
            has_invite = ok
    if invite_only and not user.is_creator and not has_invite:
        if data.get('waitlist'):
            email = (data.get('email') or user.email or '').strip()
            work_link = (data.get('work_link') or data.get('sample_url') or '').strip()
            if not email:
                return jsonify({'error': 'Email required for waitlist'}), 400
            app_row = EpisioCreatorApplication(
                user_id=uid,
                legal_name=(data.get('legal_name') or user.display_name or '').strip(),
                country='',
                phone='',
                channel_name=(data.get('channel_name') or 'Waitlist').strip()[:80],
                bio='',
                genres_json='[]',
                pitch=f'Waitlist: {work_link}'[:500] or 'Waitlist signup',
                planned_episode_count=20,
                sample_type='link',
                sample_url=work_link or 'waitlist',
                rights_attested=False,
                complete_series_attested=False,
                status='waitlist',
            )
            db.session.add(app_row)
            db.session.commit()
            return jsonify({'ok': True, 'waitlist': True, 'application': _apply_json(app_row)}), 201
        return jsonify({
            'error': 'invite_only',
            'message': 'WiamStudio is invite-only right now. Join the waitlist or enter an invite code.',
            'invite_only': True,
        }), 403

    if latest and latest.status == 'pending':
        return jsonify({'error': 'Application already pending review', 'application': _apply_json(latest)}), 400
    if latest and latest.status == 'accepted':
        return jsonify({'error': 'Already accepted', 'application': _apply_json(latest)}), 400

    channel = (data.get('channel_name') or '').strip()
    pitch = (data.get('pitch') or '').strip()
    if len(channel) < 2:
        return jsonify({'error': 'Channel name required'}), 400
    if len(pitch) < 10:
        return jsonify({'error': 'Pitch must be at least 10 characters'}), 400
    if not data.get('rights_attested') or not data.get('complete_series_attested'):
        return jsonify({'error': 'You must attest rights and complete-series commitment'}), 400
    sample_url = (data.get('sample_url') or '').strip()
    sample_type = (data.get('sample_type') or 'link').strip()
    if not sample_url:
        return jsonify({'error': 'Sample clip URL, past-work link, or trailer draft URL required'}), 400

    planned = int(data.get('planned_episode_count') or 20)
    if planned < 5:
        return jsonify({'error': 'First series must plan at least 5 episodes'}), 400

    genres = data.get('genres') or []
    if isinstance(genres, str):
        genres = [g.strip() for g in genres.split(',') if g.strip()]

    app_row = EpisioCreatorApplication(
        user_id=uid,
        legal_name=(data.get('legal_name') or '').strip(),
        country=(data.get('country') or '').strip(),
        phone=(data.get('phone') or '').strip(),
        channel_name=channel,
        bio=(data.get('bio') or '').strip(),
        genres_json=json.dumps(genres[:3]),
        pitch=pitch,
        planned_episode_count=planned,
        sample_type=sample_type,
        sample_url=sample_url,
        rights_attested=True,
        complete_series_attested=True,
        status='pending',
    )
    db.session.add(app_row)
    db.session.commit()
    return jsonify({'ok': True, 'application': _apply_json(app_row)}), 201


def _apply_json(a: EpisioCreatorApplication):
    try:
        genres = json.loads(a.genres_json or '[]')
    except Exception:
        genres = []
    return {
        'id': a.id,
        'status': a.status,
        'channel_name': a.channel_name,
        'legal_name': a.legal_name,
        'country': a.country,
        'phone': a.phone,
        'bio': a.bio,
        'genres': genres,
        'pitch': a.pitch,
        'planned_episode_count': a.planned_episode_count,
        'sample_type': a.sample_type,
        'sample_url': a.sample_url,
        'reviewer_note': a.reviewer_note or '',
        'created_at': a.created_at.isoformat() if a.created_at else None,
        'decided_at': a.decided_at.isoformat() if a.decided_at else None,
    }


@episio_studio_api.route('/founder/episio/applications', methods=['GET'])
@jwt_required
def founder_list_applications():
    if not getattr(request.api_user, 'is_founder', False):
        return jsonify({'error': 'Forbidden'}), 403
    status = (request.args.get('status') or 'pending').strip()
    q = EpisioCreatorApplication.query
    if status != 'all':
        q = q.filter_by(status=status)
    rows = q.order_by(EpisioCreatorApplication.id.desc()).limit(100).all()
    return jsonify({'applications': [_apply_json(a) for a in rows]})


@episio_studio_api.route('/founder/episio/applications/<int:app_id>/decide', methods=['POST'])
@jwt_required
def founder_decide_application(app_id):
    founder = request.api_user
    if not getattr(founder, 'is_founder', False):
        return jsonify({'error': 'Forbidden'}), 403
    app_row = EpisioCreatorApplication.query.get(app_id)
    if not app_row:
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    decision = (data.get('decision') or '').strip().lower()
    if decision not in ('accepted', 'rejected'):
        return jsonify({'error': 'decision must be accepted or rejected'}), 400
    app_row.status = decision
    app_row.reviewer_note = (data.get('note') or '')[:2000]
    app_row.decided_by = founder.wiam_id or founder.id
    app_row.decided_at = datetime.utcnow()

    if decision == 'accepted':
        user = User.query.filter(
            db.or_(User.id == app_row.user_id, User.wiam_id == app_row.user_id)
        ).first()
        if user and not user.is_creator:
            try:
                from ..services.creator_activation import finalize_creator_upgrade
                finalize_creator_upgrade(user, pen_name_hint=app_row.channel_name or user.username)
            except Exception as exc:
                log.warning('finalize_creator_upgrade failed: %s', exc)
                user.is_creator = True
    db.session.commit()
    return jsonify({'ok': True, 'application': _apply_json(app_row)})


def _public_profile_json(p: EpisioCreatorPublicProfile | None, user: User | None = None):
    if not p:
        return {
            'channel_name': (user.display_name if user else '') or '',
            'tagline': '',
            'bio': (user.bio if user else '') or '',
            'country': '',
            'city': '',
            'website_url': '',
            'instagram': '',
            'tiktok': '',
            'youtube': '',
            'twitter_x': '',
            'facebook': '',
            'avatar_url': _abs_url(user.avatar_url) if user and user.avatar_url else '',
            'banner_url': '',
            'genres': [],
            'contact_email_public': '',
        }
    try:
        genres = json.loads(p.genres_json or '[]')
    except Exception:
        genres = []
    return {
        'channel_name': p.channel_name or '',
        'tagline': p.tagline or '',
        'bio': p.bio or '',
        'country': p.country or '',
        'city': p.city or '',
        'website_url': p.website_url or '',
        'instagram': p.instagram or '',
        'tiktok': p.tiktok or '',
        'youtube': p.youtube or '',
        'twitter_x': p.twitter_x or '',
        'facebook': p.facebook or '',
        'avatar_url': _abs_url(p.avatar_url) if p.avatar_url else (
            _abs_url(user.avatar_url) if user and user.avatar_url else ''
        ),
        'banner_url': _abs_url(p.banner_url) if p.banner_url else '',
        'genres': genres if isinstance(genres, list) else [],
        'contact_email_public': p.contact_email_public or '',
    }


def _unlock_studio_for_user(user: User, channel_hint: str = ''):
    """Invite / accept → creator flag + public profile shell."""
    if not user.is_creator:
        try:
            from ..services.creator_activation import finalize_creator_upgrade
            finalize_creator_upgrade(user, pen_name_hint=channel_hint or user.username or user.display_name)
        except Exception as exc:
            log.warning('finalize_creator_upgrade failed: %s', exc)
            user.is_creator = True
    uid = user.wiam_id or user.id
    pub = EpisioCreatorPublicProfile.query.get(uid)
    if not pub:
        pub = EpisioCreatorPublicProfile(
            user_id=uid,
            channel_name=(channel_hint or user.display_name or user.username or '').strip()[:80],
            bio=(user.bio or '')[:2000],
        )
        db.session.add(pub)
    return pub


def _invite_valid(inv: EpisioCreatorInvite) -> tuple[bool, str]:
    if not inv or not inv.active:
        return False, 'Invite code is not active'
    if inv.expires_at and inv.expires_at < datetime.utcnow():
        return False, 'Invite code has expired'
    if inv.use_count >= (inv.max_uses or 1):
        return False, 'Invite code has no uses left'
    return True, ''


@episio_studio_api.route('/founder/episio/invites', methods=['GET', 'POST'])
@jwt_required
def founder_episio_invites():
    """Generate or list invite codes (founder only)."""
    if not getattr(request.api_user, 'is_founder', False):
        return jsonify({'error': 'Forbidden'}), 403
    founder = request.api_user
    if request.method == 'GET':
        rows = EpisioCreatorInvite.query.order_by(EpisioCreatorInvite.id.desc()).limit(100).all()
        return jsonify({
            'invites': [{
                'id': r.id,
                'code': r.code,
                'note': r.note or '',
                'max_uses': r.max_uses,
                'use_count': r.use_count,
                'active': bool(r.active),
                'expires_at': r.expires_at.isoformat() if r.expires_at else None,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            } for r in rows]
        })

    data = request.get_json(silent=True) or {}
    raw = (data.get('code') or '').strip().upper().replace(' ', '')
    if not raw:
        raw = f'WIAM-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}'
    if EpisioCreatorInvite.query.filter_by(code=raw).first():
        return jsonify({'error': 'Code already exists'}), 400
    # Single-use only — code dies after one redeem (cannot be shared widely)
    max_uses = 1
    days = data.get('expires_days')
    expires = None
    if days is not None and str(days).strip() != '':
        from datetime import timedelta
        expires = datetime.utcnow() + timedelta(days=max(1, int(days)))
    inv = EpisioCreatorInvite(
        code=raw,
        created_by=founder.wiam_id or founder.id,
        note=(data.get('note') or '')[:500],
        max_uses=1,
        expires_at=expires,
        active=True,
    )
    db.session.add(inv)
    db.session.commit()
    return jsonify({
        'ok': True,
        'invite': {
            'id': inv.id,
            'code': inv.code,
            'max_uses': inv.max_uses,
            'expires_at': inv.expires_at.isoformat() if inv.expires_at else None,
            'note': inv.note,
        },
    }), 201


@episio_studio_api.route('/creator/episio/redeem-invite', methods=['POST'])
@jwt_required
def redeem_creator_invite():
    """
    Valid invite → unlock WiamStudio immediately (no waitlist / no pending apply).
    User must already have a normal WiamEpisio account (register/login).
    """
    user = request.api_user
    data = request.get_json(silent=True) or {}
    code = (data.get('invite_code') or data.get('code') or '').strip().upper().replace(' ', '')
    if not code:
        return jsonify({'error': 'invite_code required'}), 400

    uid = user.wiam_id or user.id
    if user.is_creator:
        return jsonify({
            'ok': True,
            'already_creator': True,
            'studio_unlocked': True,
            'message': 'Studio already unlocked — open WiamStudio and edit your public profile.',
        })

    inv = EpisioCreatorInvite.query.filter_by(code=code).first()
    env_code = (os.environ.get('EPISIO_CREATOR_INVITE_CODE') or '').strip().upper().replace(' ', '')
    used_env = False
    if not inv and env_code and code == env_code:
        used_env = True
    elif inv:
        ok, err = _invite_valid(inv)
        if not ok:
            return jsonify({'error': err}), 400
        if EpisioCreatorInviteRedemption.query.filter_by(invite_id=inv.id, user_id=uid).first():
            return jsonify({'error': 'You already used this invite'}), 400
    else:
        return jsonify({'error': 'Invalid invite code'}), 404

    channel_hint = (data.get('channel_name') or user.display_name or user.username or '').strip()
    _unlock_studio_for_user(user, channel_hint)

    if inv and not used_env:
        db.session.add(EpisioCreatorInviteRedemption(invite_id=inv.id, user_id=uid))
        inv.use_count = int(inv.use_count or 0) + 1
        if inv.use_count >= (inv.max_uses or 1):
            inv.active = False

    # Mark application accepted so StudioHome doesn't bounce to invite gate
    app_row = EpisioCreatorApplication(
        user_id=uid,
        legal_name=user.display_name or '',
        channel_name=channel_hint[:80],
        bio='',
        pitch='Unlocked via invite code',
        planned_episode_count=20,
        sample_type='invite',
        sample_url='invite',
        rights_attested=True,
        complete_series_attested=True,
        status='accepted',
        decided_at=datetime.utcnow(),
    )
    db.session.add(app_row)
    db.session.commit()

    return jsonify({
        'ok': True,
        'studio_unlocked': True,
        'is_creator': True,
        'message': 'Welcome to WiamStudio — complete your public channel profile next.',
        'next': 'StudioSettings',
    })


@episio_studio_api.route('/creator/studio/profile', methods=['GET', 'PATCH'])
@jwt_required
def studio_public_profile():
    """Full public channel profile — every field shown on Creator Public Profile."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id
    pub = EpisioCreatorPublicProfile.query.get(uid)

    if request.method == 'GET':
        return jsonify({'profile': _public_profile_json(pub, user), 'user_id': user.id})

    data = request.get_json(silent=True) or {}
    if not pub:
        pub = EpisioCreatorPublicProfile(user_id=uid)
        db.session.add(pub)

    def _s(key, maxlen=500):
        if key in data and data[key] is not None:
            return str(data[key]).strip()[:maxlen]
        return None

    for key, maxlen in (
        ('channel_name', 80), ('tagline', 160), ('bio', 2000), ('country', 80),
        ('city', 80), ('website_url', 300), ('instagram', 120), ('tiktok', 120),
        ('youtube', 120), ('twitter_x', 120), ('facebook', 120),
        ('avatar_url', 500), ('banner_url', 500), ('contact_email_public', 120),
    ):
        val = _s(key, maxlen)
        if val is not None:
            setattr(pub, key, val)

    if 'genres' in data:
        genres = data.get('genres') or []
        if isinstance(genres, str):
            genres = [g.strip() for g in genres.split(',') if g.strip()]
        pub.genres_json = json.dumps([str(g)[:40] for g in genres[:8]])

    # Mirror primary identity onto CreatorProfile + user for older surfaces
    if pub.channel_name:
        cp = CreatorProfile.query.filter_by(wiam_id=uid).first()
        if not cp and user.wiam_id:
            cp = CreatorProfile.query.filter_by(wiam_id=user.wiam_id).first()
        if cp:
            cp.pen_name = pub.channel_name
            cp.bio = pub.bio
            cp.country = pub.country
        if hasattr(user, 'bio'):
            user.bio = pub.bio

    pub.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'profile': _public_profile_json(pub, user)})


@episio_studio_api.route('/creator/studio/profile/avatar', methods=['POST', 'DELETE'])
@jwt_required
def studio_profile_avatar():
    """Creator channel avatar → Cloudinary (deletes previous asset)."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id
    pub = EpisioCreatorPublicProfile.query.get(uid)
    if not pub:
        pub = EpisioCreatorPublicProfile(user_id=uid)
        db.session.add(pub)

    from ..services.image_service import (
        upload_creator_channel_avatar, delete_image_url, delete_image,
    )

    if request.method == 'DELETE':
        if pub.avatar_url:
            delete_image_url(pub.avatar_url)
        delete_image(f'wiamapp/creator_avatars/channel_avatar_{uid}')
        pub.avatar_url = ''
        if user.avatar_url:
            delete_image_url(user.avatar_url)
            user.avatar_url = None
        db.session.commit()
        return jsonify({'ok': True, 'avatar_url': None})

    f = request.files.get('avatar') or request.files.get('file')
    if not f:
        return jsonify({'error': 'avatar file required'}), 400
    raw = f.read()
    if len(raw) > 8 * 1024 * 1024:
        return jsonify({'error': 'Max 8 MB'}), 400
    if pub.avatar_url:
        delete_image_url(pub.avatar_url)
    ct = f.content_type or 'image/jpeg'
    url = upload_creator_channel_avatar(raw, uid, ct)
    if not url:
        return jsonify({'error': 'Cloudinary upload failed'}), 500
    pub.avatar_url = url
    user.avatar_url = url
    db.session.commit()
    return jsonify({'ok': True, 'avatar_url': _abs_url(url)})


@episio_studio_api.route('/creator/studio/profile/banner', methods=['POST', 'DELETE'])
@jwt_required
def studio_profile_banner():
    """Creator channel banner → Cloudinary (required for professional channel look)."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id
    pub = EpisioCreatorPublicProfile.query.get(uid)
    if not pub:
        pub = EpisioCreatorPublicProfile(user_id=uid)
        db.session.add(pub)

    from ..services.image_service import (
        upload_creator_channel_banner, delete_image_url, delete_image,
    )

    if request.method == 'DELETE':
        if pub.banner_url:
            delete_image_url(pub.banner_url)
        delete_image(f'wiamapp/creator_banners/channel_banner_{uid}')
        pub.banner_url = ''
        db.session.commit()
        return jsonify({'ok': True, 'banner_url': None})

    f = request.files.get('banner') or request.files.get('file')
    if not f:
        return jsonify({'error': 'banner file required'}), 400
    raw = f.read()
    if len(raw) > 8 * 1024 * 1024:
        return jsonify({'error': 'Max 8 MB'}), 400
    if pub.banner_url:
        delete_image_url(pub.banner_url)
    ct = f.content_type or 'image/jpeg'
    url = upload_creator_channel_banner(raw, uid, ct)
    if not url:
        return jsonify({'error': 'Cloudinary upload failed'}), 500
    pub.banner_url = url
    db.session.commit()
    return jsonify({'ok': True, 'banner_url': _abs_url(url)})


# ---------------------------------------------------------------------------
# Studio series CRUD
# ---------------------------------------------------------------------------

@episio_studio_api.route('/creator/studio/payout-kyc', methods=['POST'])
@jwt_required
def studio_payout_kyc():
    """Bank-only payout KYC + live selfie holding ID (Cloudinary)."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id
    full_name = (request.form.get('full_name') or '').strip()
    dob = (request.form.get('date_of_birth') or '').strip()
    id_type = (request.form.get('id_type') or 'national_id').strip()
    account_name = (request.form.get('account_name') or '').strip()
    account_number = (request.form.get('account_number') or '').strip()
    bank_name = (request.form.get('bank_name') or '').strip()
    routing = (request.form.get('routing_or_swift') or '').strip()
    if not full_name or not account_number or not bank_name:
        return jsonify({'error': 'full_name, account_number, and bank_name required'}), 400

    selfie_url = None
    f = request.files.get('selfie_with_id')
    if f:
        from ..services.image_service import upload_image, delete_image_url
        raw = f.read()
        if len(raw) > 10 * 1024 * 1024:
            return jsonify({'error': 'Selfie max 10 MB'}), 400
        selfie_url = upload_image(
            raw,
            folder='kyc_selfie',
            public_id=f'kyc_{uid}',
            content_type=f.content_type or 'image/jpeg',
            scan_nsfw=False,
        )
        if not selfie_url:
            return jsonify({'error': 'Cloudinary upload failed for selfie'}), 500

    settings = CreatorPayoutSettings.query.get(uid)
    if not settings:
        settings = CreatorPayoutSettings(creator_id=uid)
        db.session.add(settings)
    settings.provider = 'bank'
    settings.account_number = account_number[:80]
    settings.account_name = f'{account_name} · {bank_name}'[:160]
    settings.is_verified = False
    settings.updated_at = datetime.utcnow()
    # Store KYC meta on public profile note fields if needed
    pub = EpisioCreatorPublicProfile.query.get(uid)
    if pub is not None:
        # keep channel; stash KYC status lightly in contact field unused path
        pass
    db.session.commit()
    return jsonify({
        'ok': True,
        'provider': 'bank',
        'selfie_uploaded': bool(selfie_url),
        'id_type': id_type,
        'dob': dob,
        'routing_or_swift': routing,
        'message': 'KYC submitted for review. Bank payouts only.',
    })


@episio_studio_api.route('/founder/episio/auto-payouts/run', methods=['POST'])
@jwt_required
def founder_run_auto_payouts():
    if not getattr(request.api_user, 'is_founder', False):
        return jsonify({'error': 'Forbidden'}), 403
    from ..services.creator_auto_payout import run_automatic_payouts
    force = bool((request.get_json(silent=True) or {}).get('force'))
    return jsonify(run_automatic_payouts(force=force))


@episio_studio_api.route('/creator/studio/genre-requests', methods=['GET', 'POST'])
@jwt_required
def studio_genre_requests():
    """Creators can request a genre missing from the catalog."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id

    if request.method == 'GET':
        rows = db.session.execute(
            db.text(
                'SELECT id, name, note, status, created_at FROM w_genre_requests '
                'WHERE creator_id=:u ORDER BY id DESC LIMIT 40'
            ),
            {'u': uid},
        ).mappings().all()
        return jsonify({
            'requests': [
                {
                    'id': r['id'],
                    'name': r['name'],
                    'note': r['note'] or '',
                    'status': r['status'],
                    'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                }
                for r in rows
            ],
        })

    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    note = (data.get('note') or '').strip()[:500]
    if len(name) < 2:
        return jsonify({'error': 'Genre name required'}), 400
    from ..models import Genre
    exists = Genre.query.filter(
        db.func.lower(Genre.name) == name.lower(),
        Genre.product == 'episio',
        Genre.is_active.is_(True),
    ).first()
    if exists:
        return jsonify({'error': f'Genre "{exists.name}" already exists', 'genre': exists.name}), 409
    db.session.execute(
        db.text(
            'INSERT INTO w_genre_requests (creator_id, name, note, status) '
            'VALUES (:u, :n, :note, \'pending\')'
        ),
        {'u': uid, 'n': name[:80], 'note': note},
    )
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Genre request submitted for review'}), 201


@episio_studio_api.route('/creator/studio/series', methods=['GET', 'POST'])
@jwt_required
def studio_series_list_or_create():
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id

    if request.method == 'GET':
        rows = (
            _drama_q()
            .filter(Content.creator_wiam_id.in_([uid, user.id, user.wiam_id]))
            .order_by(Content.id.desc())
            .limit(50)
            .all()
        )
        return jsonify({'series': [_series_card(c, user) for c in rows]})

    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if len(title) < 2:
        return jsonify({'error': 'Title required'}), 400
    planned = int(data.get('planned_episode_count') or 20)
    if planned < 5:
        return jsonify({'error': 'planned_episode_count must be at least 5'}), 400
    if planned > 200:
        return jsonify({'error': 'planned_episode_count max is 200 for one unit'}), 400

    structure = (data.get('structure_mode') or 'series').strip().lower()
    if structure not in ('series', 'season'):
        return jsonify({'error': 'structure_mode must be series or season'}), 400
    season_number = max(1, int(data.get('season_number') or 1))
    show_group = (data.get('show_group_key') or '').strip() or None
    if structure == 'season' and not show_group:
        # Link future seasons of the same show
        show_group = f'show_{uid}_{uuid.uuid4().hex[:10]}'

    c = Content(
        title=title,
        description=(data.get('description') or data.get('synopsis') or '').strip(),
        genre=(data.get('genre') or '').strip() or ','.join(data.get('genres') or []),
        format='drama',
        status='draft',
        type='series',
        source='episio_studio',
        creator_wiam_id=uid,
        planned_episode_count=planned,
        free_episode_count=5,
        coin_band=(data.get('coin_band') or 'standard').lower(),
        catalog_shelf='standard',
        structure_mode=structure,
        season_number=season_number,
        show_group_key=show_group,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'ok': True, 'series': _series_card(c, user)}), 201


def _unit_is_live(c: Content) -> bool:
    st = (c.status or '').lower()
    if st in Content.PUBLISHED_STATUSES or st in ('live', 'upcoming', 'coming_soon', 'scheduled'):
        return True
    return False


@episio_studio_api.route('/creator/studio/series/<int:series_id>', methods=['GET', 'PATCH', 'DELETE'])
@jwt_required
def studio_series_detail(series_id):
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403

    if request.method == 'DELETE':
        if _unit_is_live(c):
            return jsonify({
                'error': 'live_locked',
                'message': (
                    'This series/season is live (or listed for viewers). '
                    'You cannot delete it yourself. Send a removal request to the WiamEpisio team.'
                ),
                'can_request_removal': True,
            }), 403
        # Soft-delete draft / building / in-review / needs-changes units completely from creator view
        c.deleted_at = datetime.utcnow()
        c.status = 'deleted'
        for ep in Episode.query.filter_by(content_id=c.id).all():
            ep.published = False
        db.session.commit()
        log.info('Creator soft-deleted series id=%s by user=%s', series_id, user.id)
        return jsonify({'ok': True, 'deleted': True, 'series_id': series_id})

    if request.method == 'PATCH':
        # Metadata edits blocked when locked unless pre-live fix window (assets only)
        if getattr(c, 'season_locked', False) and not getattr(user, 'is_founder', False):
            data = request.get_json(silent=True) or {}
            # Allow rights_confirmed / banner_url / cover during fix window only
            if not pre_live_fix_window(c) and not (
                set(data.keys()) <= {'rights_confirmed'}
            ):
                return jsonify({
                    'error': 'season_locked',
                    'message': 'Season is locked. After live, use a Revision Request for fixes.',
                }), 400
        data = request.get_json(silent=True) or {}
        if not getattr(c, 'season_locked', False) or getattr(user, 'is_founder', False):
            if 'title' in data and data['title']:
                c.title = str(data['title']).strip()
            if 'description' in data or 'synopsis' in data:
                c.description = (data.get('description') or data.get('synopsis') or '').strip()
            if 'genre' in data:
                c.genre = str(data.get('genre') or '').strip()
            if data.get('planned_episode_count') is not None:
                c.planned_episode_count = max(1, int(data['planned_episode_count']))
        if data.get('cover_url') and (not getattr(c, 'season_locked', False) or pre_live_fix_window(c) or getattr(user, 'is_founder', False)):
            url = str(data['cover_url']).strip()
            c.cover_file_id = f'ext_{url}' if not url.startswith('ext_') else url
            c.poster_url = data.get('poster_url') or url
        if data.get('poster_url') and (not getattr(c, 'season_locked', False) or pre_live_fix_window(c) or getattr(user, 'is_founder', False)):
            c.poster_url = data['poster_url']
        if data.get('banner_url') and (not getattr(c, 'season_locked', False) or pre_live_fix_window(c) or getattr(user, 'is_founder', False)):
            c.banner_url = str(data['banner_url']).strip()
        if 'rights_confirmed' in data:
            c.rights_confirmed = bool(data['rights_confirmed'])
        db.session.commit()

    refresh_completeness(c)
    ok_hard, reason_hard, details = can_go_live(c)
    soft_required = (os.environ.get('EPISIO_SOFT_INTEREST') or '0').strip() == '1'
    if getattr(user, 'is_founder', False):
        soft_required = False
    ok_submit, reason_submit, details_submit = can_submit_for_review(c, soft_required=soft_required)
    soft = soft_interest_counts(c)
    gates = build_completeness_gates(c)
    green = sum(1 for g in gates if g['ok'])
    eps = Episode.query.filter_by(content_id=c.id).order_by(Episode.episode_number.asc()).all()
    return jsonify({
        'series': _series_card(c, user),
        'change_items': parse_change_items(c),
        'readiness': {
            'can_submit': ok_submit,
            'can_lock': ok_hard and not getattr(c, 'season_locked', False),
            'reason_code': reason_submit if not ok_submit else 'ok',
            'hard_reason': reason_hard if not ok_hard else 'ok',
            'reasons': [] if ok_submit else [reason_submit],
            'details': details_submit,
            'trailer_gate_on': gate_enabled(),
            'gates': gates,
            'gates_green': green,
            'gates_total': len(gates),
            'soft_interest': soft,
        },
        'episodes': [_ep_json(e) for e in eps],
    })


@episio_studio_api.route('/creator/studio/series/<int:series_id>/cover', methods=['POST'])
@jwt_required
def studio_series_cover(series_id):
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if _locked_blocks_write(c, user):
        return jsonify({'error': 'season_locked', 'message': 'Season locked.'}), 400

    f = request.files.get('cover') or request.files.get('file')
    if not f:
        data = request.get_json(silent=True) or {}
        url = (data.get('cover_url') or data.get('url') or '').strip()
        if not url:
            return jsonify({'error': 'cover file or cover_url required'}), 400
        c.cover_file_id = f'ext_{url}' if not url.startswith('ext_') else url
        c.poster_url = url
        db.session.commit()
        return jsonify({'ok': True, 'cover_url': _abs_url(c.cover_url), 'series': _series_card(c, user)})

    from ..services.episio_image_validate import validate_poster_image
    from ..services.image_service import upload_episio_cover, delete_image_url
    ok, err, raw = validate_poster_image(f, kind='cover')
    if not ok:
        return jsonify({'error': err}), 400

    # Replace previous Cloudinary asset if present
    old = getattr(c, 'poster_url', None) or getattr(c, 'cover_url', None)
    if old and 'res.cloudinary.com' in str(old):
        delete_image_url(old)

    ct = getattr(f, 'content_type', None) or 'image/jpeg'
    cloud_url = upload_episio_cover(raw, series_id, ct)
    if not cloud_url:
        return jsonify({'error': 'Cloudinary upload failed. Check CLOUDINARY_* env on server.'}), 500
    c.cover_file_id = f'ext_{cloud_url}'
    c.poster_url = cloud_url
    db.session.commit()
    return jsonify({'ok': True, 'cover_url': _abs_url(c.cover_url), 'series': _series_card(c, user)})


# ---------------------------------------------------------------------------
# Episode create + upload (aspect/duration enforced)
# ---------------------------------------------------------------------------

@episio_studio_api.route('/creator/studio/series/<int:series_id>/lock', methods=['POST'])
@jwt_required
def studio_lock_season(series_id):
    """Explicit season lock — full story confirmed. Irreversible for creators."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403

    data = request.get_json(silent=True) or {}
    if not data.get('confirm'):
        return jsonify({
            'error': 'confirm_required',
            'message': 'Send confirm: true after the creator checks the complete-story box.',
        }), 400

    if getattr(c, 'season_locked', False):
        return jsonify({'ok': True, 'already_locked': True, 'series': _series_card(c, user)})

    # Rights only when explicitly confirmed by creator (never forced on lock)
    if data.get('rights_confirmed'):
        c.rights_confirmed = True

    planned = int(getattr(c, 'planned_episode_count', 0) or 0)
    ready = count_ready_episodes(c.id)
    if planned <= 0 or ready < planned:
        return jsonify({
            'error': 'episodes_incomplete',
            'message': f'Upload all {planned} planned episodes before locking ({ready} ready).',
            'details': {
                'planned_episode_count': planned,
                'ready_episodes': ready,
            },
            'gates': build_completeness_gates(c),
        }), 400

    ok, reason, details = can_go_live(c)
    if not ok:
        return jsonify({
            'error': 'not_ready',
            'reason': reason,
            'message': 'Finish all episodes, trailer QA, cover, metadata, and rights before locking.',
            'details': details,
            'gates': build_completeness_gates(c),
        }), 400

    # Lock commits the full story — every ready episode becomes final
    for ep in Episode.query.filter_by(content_id=c.id, transcode_status='ready').all():
        ep.is_final = True
    c.season_locked = True
    c.season_locked_at = datetime.utcnow()
    c.season_locked_by = user.wiam_id or user.id
    c.season_qc_status = 'pending'
    db.session.commit()
    return jsonify({
        'ok': True,
        'locked': True,
        'message': 'Season locked. Next: soft interest (if needed), then Submit for Live. WiamEpisio publishes — not you.',
        'series': _series_card(c, user),
        'gates': build_completeness_gates(c),
    })


@episio_studio_api.route('/creator/studio/series/<int:series_id>/completeness', methods=['GET'])
@jwt_required
def studio_completeness(series_id):
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    refresh_completeness(c)
    gates = build_completeness_gates(c)
    soft = soft_interest_counts(c)
    soft_required = (os.environ.get('EPISIO_SOFT_INTEREST') or '0').strip() == '1'
    if getattr(user, 'is_founder', False):
        soft_required = False
    ok_submit, reason, _ = can_submit_for_review(c, soft_required=soft_required)
    green = sum(1 for g in gates if g['ok'])
    return jsonify({
        'series': _series_card(c, user),
        'gates': gates,
        'gates_green': green,
        'gates_total': len(gates),
        'soft_interest': soft,
        'can_submit': ok_submit,
        'can_lock': can_go_live(c)[0] and not getattr(c, 'season_locked', False),
        'reason_code': reason,
    })


@episio_studio_api.route('/creator/studio/trust-tier', methods=['GET'])
@jwt_required
def studio_trust_tier():
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    uid = user.wiam_id or user.id
    live_count = Content.query.filter(
        Content.deleted_at.is_(None),
        Content.creator_wiam_id.in_([uid, user.wiam_id, user.id]),
        Content.format.in_(['drama', 'anime', 'Drama']),
        Content.status.in_(Content.PUBLISHED_STATUSES),
    ).count()
    if live_count >= 6:
        tier, next_need = 'elite', 0
    elif live_count >= 3:
        tier, next_need = 'trusted', max(0, 6 - live_count)
    elif live_count >= 1:
        tier, next_need = 'rising', max(0, 3 - live_count)
    else:
        tier, next_need = 'new', 1
    return jsonify({
        'tier': tier,
        'live_seasons': live_count,
        'progress_to_next': {'need': next_need, 'label': {
            'new': 'Complete 1 full season',
            'rising': 'Complete 3 full seasons',
            'trusted': 'Complete 6 full seasons',
            'elite': 'Sustained excellence',
        }.get(tier)},
        'sla_hours': {'new': 72, 'rising': 48, 'trusted': 24, 'elite': 12}.get(tier, 72),
        'tiers': [
            {'id': 'new', 'name': 'New Creator', 'sub': 'First season · Always full review'},
            {'id': 'rising', 'name': 'Rising Creator', 'sub': '1+ complete seasons · Priority queue'},
            {'id': 'trusted', 'name': 'Trusted Creator', 'sub': '3+ complete seasons · Fast-lane review'},
            {'id': 'elite', 'name': 'Elite Creator', 'sub': 'Sustained excellence · Near-instant publish'},
        ],
    })


@episio_studio_api.route('/creator/studio/series/<int:series_id>/episodes', methods=['POST'])
@jwt_required
def studio_create_episode(series_id):
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    # New episode slots only while building; locked seasons never add new numbers
    if getattr(c, 'season_locked', False) and not getattr(user, 'is_founder', False):
        return jsonify({
            'error': 'season_locked',
            'message': 'Season locked — no new episodes. Fix rejected assets or use Revision Request after live.',
        }), 400

    data = request.get_json(silent=True) or {}
    num = data.get('episode_number')
    if num is None:
        last = Episode.query.filter_by(content_id=c.id).order_by(Episode.episode_number.desc()).first()
        num = (last.episode_number + 1) if last else 1
    num = int(num)
    planned = int(getattr(c, 'planned_episode_count', 0) or 0)
    if planned and num > planned:
        return jsonify({'error': 'beyond_planned', 'message': f'Planned season is {planned} episodes.'}), 400
    if Episode.query.filter_by(content_id=c.id, episode_number=num).first():
        return jsonify({'error': f'Episode {num} already exists'}), 400

    ep = Episode(
        content_id=c.id,
        episode_number=num,
        title=(data.get('title') or f'Episode {num}').strip(),
        synopsis=(data.get('synopsis') or '').strip(),
        unlock_price_coins=resolve_unlock_coins(c),
        transcode_status='queued',
        published=False,
        is_final=False,
    )
    db.session.add(ep)
    db.session.flush()

    vs = get_video_service()
    upload = vs.create_upload(
        episode_id=ep.id,
        creator_id=user.wiam_id or user.id,
        content_id=c.id,
        asset_kind='episode',
        meta=data.get('meta') or {},
    )
    ep.video_url = upload.get('storage_key')
    ep.hls_manifest_url = upload.get('hls_manifest_url')
    job = CreatorVideoUploadJob(
        creator_id=user.wiam_id or user.id,
        content_id=c.id,
        episode_id=ep.id,
        asset_kind='episode',
        upload_status=upload.get('status') or 'pending',
        transcode_job_id=upload.get('storage_key'),
    )
    db.session.add(job)
    db.session.commit()
    return jsonify({
        'ok': True,
        'episode': {
            'id': ep.id,
            'episode_number': ep.episode_number,
            'title': ep.title,
            'transcode_status': ep.transcode_status,
        },
        'upload': upload,
        'specs': MEDIA_SPECS['episode'],
    }), 201


@episio_studio_api.route('/creator/studio/episodes/<int:episode_id>/complete-upload', methods=['POST'])
@jwt_required
def studio_complete_episode_upload(episode_id):
    """Client finished PUT to upload_url (or stub). Validates 9:16 + duration."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    ep = Episode.query.get(episode_id)
    if not ep:
        return jsonify({'error': 'not_found'}), 404
    c = Content.query.get(ep.content_id)
    if not c or not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if _locked_blocks_write(c, user):
        return jsonify({
            'error': 'season_locked',
            'message': 'Season locked — episode files cannot be replaced. Use Revision Request after live.',
        }), 400

    data = request.get_json(silent=True) or {}
    width = data.get('width')
    height = data.get('height')
    duration = data.get('duration_seconds')
    ok_a, err_a = _validate_aspect(width, height)
    if not ok_a:
        ep.transcode_status = 'failed'
        ep.is_final = False
        db.session.commit()
        return jsonify({'error': 'wrong_size', 'message': err_a, 'specs': MEDIA_SPECS['episode']}), 400
    ok_d, err_d = _validate_duration(duration, 'episode')
    if not ok_d:
        ep.transcode_status = 'failed'
        ep.is_final = False
        db.session.commit()
        return jsonify({'error': 'bad_duration', 'message': err_d, 'specs': MEDIA_SPECS['episode']}), 400

    if data.get('storage_key'):
        ep.video_url = data['storage_key']
    if data.get('hls_manifest_url'):
        ep.hls_manifest_url = data['hls_manifest_url']
    ep.duration_seconds = int(duration)
    ep.transcode_status = 'ready'
    ep.is_final = bool(data.get('is_final', False))
    # Persist probe meta for full-season QC (trailer + every episode)
    ep.upload_probe_json = json.dumps({
        'width': int(width or 0),
        'height': int(height or 0),
        'duration_seconds': int(duration or 0),
        'bitrate_kbps': int(data.get('bitrate_kbps') or 0),
        'black_frame_ratio': float(data.get('black_frame_ratio') or 0),
        'mood_label': data.get('mood_label') or 'serious',
        'audio_lufs': data.get('audio_lufs'),
    })
    ep.asset_qc_status = 'pending'
    # Stub provider: mark ready for local QA even without real bytes
    if get_video_service().name == 'stub' and not ep.hls_manifest_url:
        ep.hls_manifest_url = f'https://stub.local/hls/{ep.video_url}/master.m3u8'
    refresh_completeness(c)
    db.session.commit()
    return jsonify({
        'ok': True,
        'episode': _ep_json(ep),
        'series': _series_card(c, user),
    })


@episio_studio_api.route('/creator/studio/episodes/<int:episode_id>', methods=['PATCH'])
@jwt_required
def studio_patch_episode(episode_id):
    """Edit episode title/synopsis while building (or pre-live fix window)."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    ep = Episode.query.get(episode_id)
    if not ep:
        return jsonify({'error': 'not_found'}), 404
    c = Content.query.get(ep.content_id)
    if not c or not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if _locked_blocks_write(c, user):
        return jsonify({
            'error': 'season_locked',
            'message': 'Series/season locked — metadata frozen until Needs Changes or Revision Request.',
        }), 400
    data = request.get_json(silent=True) or {}
    if 'title' in data and data['title']:
        ep.title = str(data['title']).strip()[:200]
    if 'synopsis' in data or 'description' in data:
        ep.synopsis = (data.get('synopsis') or data.get('description') or '').strip()
    if 'is_final' in data:
        if ep.transcode_status != 'ready' and data.get('is_final'):
            return jsonify({'error': 'not_ready', 'message': 'Upload a valid file before marking final.'}), 400
        ep.is_final = bool(data['is_final'])
    db.session.commit()
    return jsonify({'ok': True, 'episode': _ep_json(ep), 'series': _series_card(c, user)})


@episio_studio_api.route('/creator/studio/episodes/<int:episode_id>/mark-final', methods=['POST'])
@jwt_required
def studio_mark_episode_final(episode_id):
    """Mark uploaded episode as final (required before season lock)."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    ep = Episode.query.get(episode_id)
    if not ep:
        return jsonify({'error': 'not_found'}), 404
    c = Content.query.get(ep.content_id)
    if not c or not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if _locked_blocks_write(c, user):
        return jsonify({
            'error': 'season_locked',
            'message': 'Season locked — finals are frozen.',
        }), 400
    if ep.transcode_status != 'ready':
        return jsonify({'error': 'not_ready', 'message': 'Upload a valid episode file before marking final.'}), 400
    data = request.get_json(silent=True) or {}
    ep.is_final = bool(data.get('is_final', True))
    refresh_completeness(c)
    db.session.commit()
    return jsonify({'ok': True, 'episode': _ep_json(ep), 'series': _series_card(c, user)})


@episio_studio_api.route('/creator/studio/series/<int:series_id>/banner', methods=['POST'])
@jwt_required
def studio_series_banner(series_id):
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if _locked_blocks_write(c, user):
        return jsonify({'error': 'season_locked', 'message': 'Season locked.'}), 400

    f = request.files.get('banner') or request.files.get('file')
    if not f:
        data = request.get_json(silent=True) or {}
        url = (data.get('banner_url') or data.get('url') or '').strip()
        if not url:
            return jsonify({'error': 'banner file or banner_url required'}), 400
        c.banner_url = url
        db.session.commit()
        return jsonify({'ok': True, 'banner_url': _abs_url(c.banner_url), 'series': _series_card(c, user)})

    from ..services.episio_image_validate import validate_poster_image
    from ..services.image_service import upload_episio_banner, delete_image_url
    ok, err, raw = validate_poster_image(f, kind='banner')
    if not ok:
        return jsonify({'error': err}), 400

    old = getattr(c, 'banner_url', None)
    if old and 'res.cloudinary.com' in str(old):
        delete_image_url(old)

    ct = getattr(f, 'content_type', None) or 'image/jpeg'
    cloud_url = upload_episio_banner(raw, series_id, ct)
    if not cloud_url:
        return jsonify({'error': 'Cloudinary upload failed. Check CLOUDINARY_* env on server.'}), 500
    c.banner_url = cloud_url
    db.session.commit()
    return jsonify({'ok': True, 'banner_url': _abs_url(c.banner_url), 'series': _series_card(c, user)})


@episio_studio_api.route('/creator/studio/series/<int:series_id>/review-status', methods=['GET'])
@jwt_required
def studio_review_status(series_id):
    """Submit-Pending / Needs-Changes payload for creator Studio."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403

    # SLA auto-decide first if review window already expired
    try:
        from ..services.season_sla_auto import process_expired_review_slas
        process_expired_review_slas(limit=10)
        c = Content.query.get(series_id)
    except Exception:
        pass

    from ..models import SeasonQualityJob
    job = (
        SeasonQualityJob.query.filter_by(content_id=c.id)
        .order_by(SeasonQualityJob.id.desc())
        .first()
    )
    state = _pipeline_state(c)
    change_items = parse_change_items(c)
    submitted_at = getattr(c, 'submitted_for_review_at', None) or (job.created_at if job else None)
    sla_hours = 72
    try:
        # Align SLA with trust tier when available
        live_count = Content.query.filter(
            Content.deleted_at.is_(None),
            Content.creator_wiam_id.in_([user.wiam_id or user.id, user.wiam_id, user.id]),
            Content.format.in_(['drama', 'anime', 'Drama']),
            Content.status.in_(Content.PUBLISHED_STATUSES),
        ).count()
        sla_hours = 12 if live_count >= 6 else (24 if live_count >= 3 else (48 if live_count >= 1 else 72))
    except Exception:
        sla_hours = 72

    elapsed_h = 0.0
    if submitted_at:
        elapsed_h = max(0.0, (datetime.utcnow() - submitted_at).total_seconds() / 3600.0)
    remaining_h = max(0.0, sla_hours - elapsed_h)

    stages = [
        {
            'key': 'submitted',
            'title': 'Submitted for review',
            'status': 'done' if submitted_at else 'wait',
            'detail': submitted_at.isoformat() + 'Z' if submitted_at else 'Not submitted',
        },
        {
            'key': 'system_qc',
            'title': 'System QC — trailer + every episode + assets',
            'status': (
                'done' if job and job.status in ('passed', 'failed', 'needs_changes', 'borderline')
                else ('active' if job and job.status in ('queued', 'running') else 'wait')
            ),
            'detail': (job.status if job else 'Waiting') + (
                f' · band {job.overall_band}' if job and job.overall_band else ''
            ),
        },
        {
            'key': 'human',
            'title': 'Founder light check on website',
            'status': (
                'done' if job and job.founder_decision
                else ('active' if job and job.status in ('borderline', 'passed') and not job.founder_decision else 'wait')
            ),
            'detail': job.founder_decision if job and job.founder_decision else 'Pending',
        },
        {
            'key': 'decision',
            'title': 'Decision — Live or Needs Changes',
            'status': (
                'done' if state in ('live', 'needs_changes')
                else ('active' if state == 'in_review' else 'wait')
            ),
            'detail': state,
        },
    ]

    planned = int(getattr(c, 'planned_episode_count', 0) or 0)
    timing = estimate_season_review(planned or Episode.query.filter_by(content_id=c.id).count(), True)
    return jsonify({
        'series': _series_card(c, user),
        'pipeline_state': state,
        'change_items': change_items,
        'sla_hours': sla_hours,
        'sla_remaining_hours': round(remaining_h, 1),
        'submitted_at': submitted_at.isoformat() if submitted_at else None,
        'timing': timing,
        'tools': review_tool_catalog(),
        'qc_job': None if not job else {
            'id': job.id,
            'status': job.status,
            'overall_band': job.overall_band,
            'overall_score': job.overall_score,
            'failure_reasons': job.failure_reasons or '',
            'founder_note': job.founder_note or '',
            'founder_decision': job.founder_decision,
        },
        'stages': stages,
        'message': {
            'in_review': 'In review queue. WiamEpisio publishes after system QC + founder check — not you.',
            'needs_changes': 'Fix the items below, then resubmit. Only failed pieces need re-upload.',
            'live': 'WiamEpisio has published your series.',
            'locked': 'Season locked — finish soft interest, then submit.',
            'building': 'Keep uploading until every planned episode is final.',
        }.get(state, ''),
    })


@episio_studio_api.route('/creator/studio/series/<int:series_id>/submit-review', methods=['POST'])
@jwt_required
def studio_submit_review(series_id):
    """
    Creator submits locked full season for system QC + founder final check.
    Publish happens only on the website (founder) — never by the creator.
    """
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403

    refresh_completeness(c)
    soft_required = (os.environ.get('EPISIO_SOFT_INTEREST') or '0').strip() == '1'
    if getattr(user, 'is_founder', False):
        soft_required = False
    ok, reason_code, details = can_submit_for_review(c, soft_required=soft_required)
    if not ok:
        msg = {
            'season_lock_required': 'Lock the complete season before submit.',
            'soft_interest': 'Need 50 followers or 200 Remind-me before submit.',
            'series_incomplete': 'Upload every planned episode before submit.',
        }.get(reason_code, 'Series is not ready to submit.')
        return jsonify({
            'error': 'not_ready',
            'reasons': [reason_code],
            'message': msg,
            'details': details,
            'gates': build_completeness_gates(c),
        }), 400

    c.review_status = 'under_review'
    c.status = 'draft'
    c.season_qc_status = 'queued'  # full season: trailer + ALL episodes + cover/banner
    c.submitted_for_review_at = datetime.utcnow()
    c.review_change_items = '[]'  # clear prior Needs-Changes list on resubmit
    job = enqueue_season_qc(c)
    db.session.commit()

    # Run QC now when pipeline ON (also processable via founder "Run queue")
    qc_result = None
    if pipeline_enabled():
        try:
            qc_result = run_season_qc_job(job.id)
        except Exception as e:
            log.exception('season QC run after submit: %s', e)

    try:
        notify_episio_series_submitted(
            c.title or f'Series {c.id}',
            c.id,
            user.display_name or user.username or 'Creator',
            count_ready_episodes(c.id),
        )
    except Exception:
        pass

    db.session.refresh(c)
    return jsonify({
        'ok': True,
        'status': 'under_review',
        'season_qc_status': c.season_qc_status,
        'qc_job_id': job.id,
        'qc_job_status': qc_result.status if qc_result else 'queued',
        'qc_overall_band': qc_result.overall_band if qc_result else None,
        'pipeline_enabled': pipeline_enabled(),
        'sla_hours': 72,
        'message': (
            'Submitted to the WiamEpisio team. We check your trailer and every episode '
            '(picture, sound, light, frame). When everything looks good, our team publishes it for viewers — '
            'you cannot publish yourself.'
        ),
        'series': _series_card(c, user),
    })


@episio_studio_api.route('/creator/studio/series/<int:series_id>/removal-request', methods=['POST'])
@jwt_required
def studio_series_removal_request(series_id):
    """Live series cannot be self-deleted — creator messages the team instead."""
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    if not _unit_is_live(c):
        return jsonify({
            'error': 'not_live',
            'message': 'This unit is not live — use Delete in workspace to remove it completely.',
        }), 400
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or data.get('reason') or '').strip()
    if len(message) < 10:
        return jsonify({'error': 'message_required', 'message': 'Tell the team why you need this removed (min 10 characters).'}), 400
    unit = 'season' if (getattr(c, 'structure_mode', None) or 'series') == 'season' else 'series'
    fb = Feedback(
        user_id=user.wiam_id or user.id,
        user_name=(user.display_name or user.username or '')[:120],
        user_email=(user.email or '')[:200],
        category='series_removal_request',
        message=(
            f'[Episio {unit} removal request]\n'
            f'Series ID: {c.id}\n'
            f'Title: {c.title}\n'
            f'Status: {c.status}\n\n'
            f'{message}'
        )[:4000],
        status='new',
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({
        'ok': True,
        'message': 'Request sent to the WiamEpisio team. They will review take-down from the founder dashboard.',
        'feedback_id': fb.id,
    })


# ---------------------------------------------------------------------------
# Wave 2 — Revision Request (LIVE series only · legal/rights/factual)
# ---------------------------------------------------------------------------

@episio_studio_api.route('/creator/studio/series/<int:series_id>/revision-requests', methods=['GET', 'POST'])
@jwt_required
def studio_revision_requests(series_id):
    from ..models import SeriesRevisionRequest
    forbid = _creator_api_forbidden()
    if forbid:
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _owns(user, c):
        return jsonify({'error': 'forbidden'}), 403

    if request.method == 'GET':
        rows = (
            SeriesRevisionRequest.query.filter_by(content_id=c.id)
            .order_by(SeriesRevisionRequest.id.desc())
            .limit(40)
            .all()
        )
        return jsonify({
            'series': _series_card(c, user),
            'requests': [{
                'id': r.id,
                'target_kind': r.target_kind,
                'episode_id': r.episode_id,
                'episode_number': r.episode_number,
                'category': r.category,
                'reason': r.reason,
                'status': r.status,
                'reviewer_note': r.reviewer_note or '',
                'created_at': r.created_at.isoformat() if r.created_at else None,
            } for r in rows],
            'note': (
                'Revision Requests are only for LIVE series, and only for legal, rights, or factual corrections. '
                'Video/audio quality must be caught before live — use Needs Changes before publish.'
            ),
        })

    # POST — create
    if c.status not in Content.PUBLISHED_STATUSES:
        return jsonify({
            'error': 'not_live',
            'message': 'Revision Requests are only for series the WiamEpisio team has already published. '
                       'Before live, fix via Needs Changes and resubmit the full series.',
        }), 400
    if not getattr(c, 'season_locked', False):
        return jsonify({'error': 'not_locked', 'message': 'Series must be locked.'}), 400

    data = request.get_json(silent=True) or {}
    category = (data.get('category') or '').strip().lower()
    if category not in ('legal', 'rights', 'factual'):
        return jsonify({
            'error': 'bad_category',
            'message': 'Category must be legal, rights, or factual — not quality.',
        }), 400
    reason = (data.get('reason') or '').strip()
    if len(reason) < 12:
        return jsonify({'error': 'reason_required', 'message': 'Please explain what you are fixing (min 12 characters).'}), 400

    target_kind = (data.get('target_kind') or 'episode').strip().lower()
    if target_kind not in ('trailer', 'episode'):
        return jsonify({'error': 'bad_target'}), 400
    ep_id = data.get('episode_id')
    ep_num = data.get('episode_number')
    if target_kind == 'episode':
        ep = None
        if ep_id:
            ep = Episode.query.get(int(ep_id))
        elif ep_num:
            ep = Episode.query.filter_by(content_id=c.id, episode_number=int(ep_num)).first()
        if not ep or ep.content_id != c.id:
            return jsonify({'error': 'episode_required', 'message': 'Pick one episode to revise.'}), 400
        ep_id, ep_num = ep.id, ep.episode_number
    else:
        ep_id, ep_num = None, None

    row = SeriesRevisionRequest(
        content_id=c.id,
        requested_by=user.wiam_id or user.id,
        target_kind=target_kind,
        episode_id=ep_id,
        episode_number=ep_num,
        category=category,
        reason=reason,
        replacement_storage_key=(data.get('replacement_storage_key') or '').strip() or None,
        replacement_meta_json=json.dumps(data.get('meta') or {}),
        status='pending',
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({
        'ok': True,
        'message': (
            'Revision request sent to the WiamEpisio team. '
            'Only the piece you selected goes back through review — the rest of your series stays live.'
        ),
        'request': {
            'id': row.id,
            'target_kind': row.target_kind,
            'episode_number': row.episode_number,
            'category': row.category,
            'status': row.status,
        },
    }), 201
