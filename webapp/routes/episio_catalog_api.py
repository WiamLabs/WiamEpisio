"""
WiamEpisio catalog / trailer / rankings / coins / novel hub / founder controls.

Mounted at /api/v1. Complements episode_api.py.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, current_app

from ..extensions import db, csrf
from ..models import (
    Content, Episode, PlatformConfig, FeaturedTrailerSlot, TrailerQualityReport,
    CreatorVideoUploadJob, CoinPriceBand, PremiumSubscription, Follow,
)
from .api_v1 import jwt_required, jwt_optional, _abs_url, _creator_api_forbidden
from ..services.coin_pricing import list_bands, resolve_unlock_coins, ensure_default_bands, apply_band_to_unpublished_episodes
from ..services.currency_display import ensure_default_fx
from ..services.trailer_qa import run_trailer_qa, gate_enabled
from ..services.series_publish_gate import can_go_live, refresh_completeness
from ..services.rankings import list_rankings, recompute_rankings
from ..services.video_service import get_video_service
from ..services.episode_access import free_episode_count_for

log = logging.getLogger(__name__)

episio_catalog_api = Blueprint('episio_catalog_api', __name__, url_prefix='/api/v1')
csrf.exempt(episio_catalog_api)


def _founder_forbidden():
    u = getattr(request, 'api_user', None)
    if not u or not getattr(u, 'is_founder', False):
        return jsonify({'error': 'Founder access required'}), 403
    return None


def _drama_q():
    return Content.query.filter(
        Content.deleted_at.is_(None),
        db.or_(Content.format == 'drama', Content.format == 'anime', Content.format == 'Drama'),
    )


def _series_card(c: Content, user=None):
    ep_count = Episode.query.filter_by(content_id=c.id).count()
    free_n = free_episode_count_for(c)
    poster = getattr(c, 'poster_url', None) or c.cover_url
    band_price = resolve_unlock_coins(c)
    creator_user = None
    try:
        creator_user = c.creator  # resolves User via creator_wiam_id
    except Exception:
        creator_user = None
    creator_user_id = creator_user.id if creator_user else None
    is_following = False
    if user and creator_user_id:
        try:
            is_following = Follow.query.filter_by(
                user_id=user.id, creator_id=creator_user_id
            ).first() is not None
        except Exception:
            is_following = False
    return {
        'id': c.id,
        'title': c.title,
        'description': c.description or '',
        'genre': c.genre or '',
        'format': getattr(c, 'format', None) or 'drama',
        'status': c.status,
        'catalog_shelf': getattr(c, 'catalog_shelf', None) or 'standard',
        'is_wiam_origin': bool(getattr(c, 'is_wiam_origin', False)),
        'is_vip_series': bool(getattr(c, 'is_vip_series', False)),
        'coin_band': getattr(c, 'coin_band', None) or 'standard',
        'unlock_price_coins': band_price,
        'cover_url': _abs_url(c.cover_url),
        'poster_url': _abs_url(poster),
        'trailer_url': getattr(c, 'trailer_url', None),
        'trailer_hls_url': getattr(c, 'trailer_hls_url', None),
        'trailer_poster_url': _abs_url(getattr(c, 'trailer_poster_url', None)),
        'trailer_duration_seconds': int(getattr(c, 'trailer_duration_seconds', 0) or 0),
        'trailer_qa_status': getattr(c, 'trailer_qa_status', None) or 'none',
        'planned_episode_count': int(getattr(c, 'planned_episode_count', 0) or 0),
        'total_episodes': getattr(c, 'total_episodes', None) or ep_count,
        'is_series_complete': bool(getattr(c, 'is_series_complete', False)),
        'free_episode_count': free_n,
        'ranking_score': float(getattr(c, 'ranking_score', 0) or 0),
        'creator_wiam_id': c.creator_wiam_id,
        'creator_id': creator_user_id,  # User.id for POST /creators/:id/follow
        'is_following': is_following,
        'published_at': c.published_at.isoformat() if c.published_at else None,
    }


def _active_featured(slot_key: str, limit: int = 12):
    now = datetime.utcnow()
    q = FeaturedTrailerSlot.query.filter_by(slot_key=slot_key, is_active=True)
    rows = q.order_by(FeaturedTrailerSlot.sort_order.asc(), FeaturedTrailerSlot.id.desc()).limit(40).all()
    out = []
    for slot in rows:
        if slot.starts_at and slot.starts_at > now:
            continue
        if slot.ends_at and slot.ends_at < now:
            continue
        c = Content.query.get(slot.content_id)
        if not c or c.is_deleted:
            continue
        if c.status not in Content.PUBLISHED_STATUSES:
            continue
        card = _series_card(c)
        card['featured_slot_id'] = slot.id
        card['featured_note'] = slot.note or ''
        out.append(card)
        if len(out) >= limit:
            break
    return out


def _published_drama():
    return _drama_q().filter(Content.status.in_(Content.PUBLISHED_STATUSES))


# ---------------------------------------------------------------------------
# Watch home / shelves / rankings
# ---------------------------------------------------------------------------

@episio_catalog_api.route('/watch/home', methods=['GET'])
@jwt_optional
def watch_home():
    """Popular / Fresh rails + founder-curated featured trailers (max 6 on home)."""
    user = getattr(request, 'api_user', None)
    popular = (
        _published_drama()
        .order_by(Content.ranking_score.desc().nullslast(), Content.views.desc().nullslast(), Content.id.desc())
        .limit(20).all()
    )
    fresh = (
        _published_drama()
        .order_by(Content.published_at.desc().nullslast(), Content.id.desc())
        .limit(20).all()
    )
    # Coming Soon = not yet live (upcoming / scheduled) — Remind Me + featured fill
    coming = (
        _drama_q()
        .filter(Content.status.in_(['upcoming', 'scheduled', 'coming_soon']))
        .order_by(Content.id.desc())
        .limit(20)
        .all()
    )
    # Top Searched ≈ highest views (until dedicated search-analytics exists)
    top_searched = (
        _published_drama()
        .order_by(Content.views.desc().nullslast(), Content.ranking_score.desc().nullslast())
        .limit(20)
        .all()
    )
    return jsonify({
        'chips': ['Popular', 'Fresh', 'Rankings', 'Categories', 'Wiam Origin', 'Anime', 'VIP'],
        'featured_trailers': {
            'home_featured': _active_featured('home_featured', limit=6),
            'origin': _active_featured('origin', limit=6),
            'vip': _active_featured('vip', limit=6),
            'anime': _active_featured('anime', limit=6),
            'ranking': _active_featured('ranking', limit=6),
        },
        'popular': [_series_card(c, user) for c in popular],
        'fresh': [_series_card(c, user) for c in fresh],
        'coming_soon': [_series_card(c, user) for c in coming],
        'top_searched': [_series_card(c, user) for c in top_searched],
        'shelves': {
            'origin': [_series_card(c, user) for c in _published_drama().filter_by(is_wiam_origin=True).limit(20).all()],
            'vip': [_series_card(c, user) for c in _published_drama().filter_by(is_vip_series=True).limit(20).all()],
            'anime': [_series_card(c, user) for c in _published_drama().filter(
                db.or_(Content.format == 'anime', Content.catalog_shelf == 'anime')
            ).limit(20).all()],
        },
        'trailer_quality_gate_on': gate_enabled(),
        'vip_enabled': bool(getattr(PlatformConfig.get(), 'ff_vip_enabled', False)),
    })


@episio_catalog_api.route('/watch/rankings', methods=['GET'])
@jwt_optional
def watch_rankings():
    period = (request.args.get('period') or 'weekly').lower()
    limit = min(100, max(1, request.args.get('limit', 50, type=int) or 50))
    rows = list_rankings(period=period, limit=limit)
    user = getattr(request, 'api_user', None)
    items = []
    for r in rows:
        c = Content.query.get(r['content_id'])
        if not c or c.is_deleted:
            continue
        card = _series_card(c, user)
        card['rank_position'] = r['rank_position']
        card['ranking_metrics'] = r.get('metrics') or {}
        items.append(card)
    return jsonify({'period': period, 'rankings': items})


@episio_catalog_api.route('/watch/shelf/<shelf>', methods=['GET'])
@jwt_optional
def watch_shelf(shelf):
    shelf = (shelf or 'standard').lower()
    user = getattr(request, 'api_user', None)
    q = _published_drama()
    if shelf == 'origin':
        q = q.filter(db.or_(Content.is_wiam_origin.is_(True), Content.catalog_shelf == 'origin'))
    elif shelf == 'vip':
        q = q.filter(db.or_(Content.is_vip_series.is_(True), Content.catalog_shelf == 'vip'))
    elif shelf == 'anime':
        q = q.filter(db.or_(Content.format == 'anime', Content.catalog_shelf == 'anime'))
    else:
        q = q.filter(Content.catalog_shelf == 'standard')
    rows = q.order_by(Content.published_at.desc().nullslast()).limit(50).all()
    return jsonify({
        'shelf': shelf,
        'featured_trailers': _active_featured(shelf if shelf in ('origin', 'vip', 'anime') else 'home_featured'),
        'series': [_series_card(c, user) for c in rows],
    })


# ---------------------------------------------------------------------------
# Trailer stream / creator trailer upload + QA + publish
# ---------------------------------------------------------------------------

@episio_catalog_api.route('/series/<int:series_id>/trailer/stream', methods=['GET'])
@jwt_optional
def trailer_stream(series_id):
    """Trailers are always free to preview."""
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    key = c.trailer_storage_key or c.trailer_url
    if not key and not c.trailer_hls_url:
        return jsonify({'error': 'no_trailer'}), 404
    vs = get_video_service()
    signed = vs.sign_playback_url(
        storage_key=key,
        episode_id=None,
        hls_manifest_url=c.trailer_hls_url,
        ttl=300,
    )
    return jsonify({
        'series_id': c.id,
        'trailer_qa_status': c.trailer_qa_status,
        'duration_seconds': c.trailer_duration_seconds or 0,
        'poster_url': _abs_url(c.trailer_poster_url or c.poster_url or c.cover_url),
        'stream': signed,
    })


def _creator_owns(user, content: Content) -> bool:
    if getattr(user, 'is_founder', False):
        return True
    uid = user.wiam_id or user.id
    return content.creator_wiam_id in (uid, user.wiam_id, user.id)


@episio_catalog_api.route('/creator/series/<int:series_id>/trailer/upload', methods=['POST'])
@jwt_required
def creator_trailer_upload(series_id):
    forbid = _creator_api_forbidden()
    if forbid and not getattr(request.api_user, 'is_founder', False):
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _creator_owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    # Season lock blocks trailer replace unless pre-live Needs Changes fix window
    if getattr(c, 'season_locked', False) and not getattr(user, 'is_founder', False):
        from ..services.series_publish_gate import pre_live_fix_window
        if not pre_live_fix_window(c):
            return jsonify({
                'error': 'season_locked',
                'message': 'Season locked — trailer replace only after Needs Changes (pre-live) or Revision Request (live).',
            }), 400

    data = request.get_json(silent=True) or {}
    vs = get_video_service()
    upload = vs.create_upload(
        creator_id=user.wiam_id or user.id,
        content_id=c.id,
        asset_kind='trailer',
        meta=data.get('meta') or {},
    )
    c.trailer_storage_key = upload.get('storage_key')
    c.trailer_hls_url = upload.get('hls_manifest_url') or c.trailer_hls_url
    c.trailer_url = upload.get('storage_key') or c.trailer_url
    if data.get('poster_url'):
        c.trailer_poster_url = data['poster_url']
    if data.get('duration_seconds'):
        c.trailer_duration_seconds = int(data['duration_seconds'])
    c.trailer_qa_status = 'pending'

    job = CreatorVideoUploadJob(
        creator_id=user.wiam_id or user.id,
        content_id=c.id,
        asset_kind='trailer',
        upload_status=upload.get('status') or 'pending',
        transcode_job_id=upload.get('storage_key'),
    )
    db.session.add(job)
    db.session.commit()

    # Auto-run QA with provided meta (stub-friendly)
    report = run_trailer_qa(c, meta=data.get('meta') or {
        'duration_seconds': c.trailer_duration_seconds or 45,
        'width': data.get('width') or 1080,
        'height': data.get('height') or 1920,
        'bitrate_kbps': data.get('bitrate_kbps') or 2500,
        'mood_label': data.get('mood_label') or 'serious',
        'black_frame_ratio': data.get('black_frame_ratio') or 0.02,
    })
    db.session.commit()

    return jsonify({
        'ok': True,
        'upload': upload,
        'job_id': job.id,
        'trailer_qa': {
            'status': report.status,
            'score': report.overall_score,
            'failure_reasons': report.failure_reasons,
        },
        'series': _series_card(c, user),
    })


@episio_catalog_api.route('/creator/series/<int:series_id>/trailer/qa', methods=['POST'])
@jwt_required
def creator_trailer_qa(series_id):
    forbid = _creator_api_forbidden()
    if forbid and not getattr(request.api_user, 'is_founder', False):
        return forbid
    user = request.api_user
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    if not _creator_owns(user, c):
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json(silent=True) or {}
    report = run_trailer_qa(c, meta=data.get('meta') or data)
    db.session.commit()
    return jsonify({
        'ok': True,
        'status': report.status,
        'score': report.overall_score,
        'failure_reasons': report.failure_reasons,
        'checks': report.checks_json,
        'gate_on': gate_enabled(),
    })


@episio_catalog_api.route('/creator/series/<int:series_id>/publish', methods=['POST'])
@jwt_required
def creator_series_publish(series_id):
    """Publish is PLATFORM-only (founder/team). Creators must submit-review instead."""
    user = request.api_user
    if not getattr(user, 'is_founder', False):
        return jsonify({
            'error': 'platform_publishes',
            'message': 'WiamEpisio publishes series after full-season QC. Creators submit for review — they cannot publish.',
        }), 403
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404

    data = request.get_json(silent=True) or {}
    if data.get('planned_episode_count') is not None:
        c.planned_episode_count = int(data['planned_episode_count'])
    if data.get('coin_band'):
        c.coin_band = str(data['coin_band']).lower()
        apply_band_to_unpublished_episodes(c)

    # Mark stub episodes ready if still queued
    for ep in Episode.query.filter_by(content_id=c.id).all():
        if (ep.transcode_status or '') in ('queued', 'pending', ''):
            ep.transcode_status = 'ready'

    ok, reason, details = can_go_live(c)
    if not ok:
        db.session.commit()
        return jsonify({'ok': False, 'error': reason, 'details': details}), 400

    # Full-season QC must not be hard-failed
    qc = (getattr(c, 'season_qc_status', None) or 'none').lower()
    if qc == 'failed':
        return jsonify({
            'ok': False,
            'error': 'season_qc_failed',
            'message': 'Full-season QC failed (trailer + episodes). Request changes before publish.',
            'details': details,
        }), 400

    c.status = 'published'
    c.review_status = 'approved'
    if not c.published_at:
        c.published_at = datetime.utcnow()
    refresh_completeness(c)

    # Optionally publish first free episodes now; rest can drip via publish_at
    publish_all = bool(data.get('publish_all_episodes'))
    now = datetime.utcnow()
    for ep in Episode.query.filter_by(content_id=c.id).order_by(Episode.episode_number.asc()).all():
        ep.unlock_price_coins = resolve_unlock_coins(c, ep)
        if publish_all or (ep.publish_at and ep.publish_at <= now) or ep.episode_number <= free_episode_count_for(c):
            ep.published = True
            if not ep.publish_at:
                ep.publish_at = now
    db.session.commit()
    return jsonify({'ok': True, 'reason': reason, 'details': details, 'series': _series_card(c, user)})


# ---------------------------------------------------------------------------
# Coins / FX
# ---------------------------------------------------------------------------

@episio_catalog_api.route('/coins/bands', methods=['GET'])
def coins_bands():
    return jsonify({'bands': list_bands()})


@episio_catalog_api.route('/fx', methods=['GET'])
def fx_list():
    ensure_default_fx()
    from ..models import FxRate
    rows = FxRate.query.order_by(FxRate.currency_code.asc()).all()
    return jsonify({
        'base': 'USD',
        'rates': [{
            'currency': r.currency_code,
            'rate_per_usd': r.rate_per_usd,
            'symbol': r.symbol,
            'updated_at': r.updated_at.isoformat() if r.updated_at else None,
        } for r in rows],
    })


# ---------------------------------------------------------------------------
# Novel hub (V2 sections wrapper)
# ---------------------------------------------------------------------------

@episio_catalog_api.route('/novel/hub', methods=['GET'])
@jwt_optional
def novel_hub():
    """Thin wrapper over home_sections_v2 for the future Novel top-button screen."""
    user = getattr(request, 'api_user', None)
    try:
        from ..services.home_sections_v2 import build_home
        from .api_v1 import _book_json
        home = build_home(user, target_count=8)
        sections = []
        for sec in home.get('sections') or []:
            books = sec.get('books') or []
            # books may already be Content objects
            serialized = []
            for b in books:
                try:
                    serialized.append(_book_json(b) if not isinstance(b, dict) else b)
                except Exception:
                    if hasattr(b, 'id'):
                        serialized.append({'id': b.id, 'title': getattr(b, 'title', '')})
            sections.append({
                'key': sec.get('key'),
                'title': sec.get('title') or sec.get('key'),
                'layout': sec.get('layout'),
                'books': serialized,
            })
        return jsonify({
            'hub': 'novel',
            'sections': sections,
            'continue_reading': home.get('continue_reading') or [],
            'legacy_pools': home.get('legacy_pools') or {},
        })
    except Exception as e:
        log.exception('novel hub failed: %s', e)
        return jsonify({'hub': 'novel', 'sections': [], 'error': 'hub_unavailable'}), 200


# ---------------------------------------------------------------------------
# Membership / VIP (HTML Membership screen) — Paystack + PremiumSubscription
# ---------------------------------------------------------------------------

# Plan catalog (GHS). Pesewas = GHS * 100. Matches WiamEpisio-Membership.html.
_VIP_PLANS = {
    'weekly': {
        'id': 'weekly',
        'name': 'Weekly Membership',
        'price_ghs': 24.99,
        'price_pesewas': 2499,
        'old_price_ghs': 34.99,
        'badge': 'Save 29%',
        'detail': 'GHS 24.99/week for the first 3 weeks, then GHS 34.99/week',
        'duration_days': 7,
        'display_price': 'GHS 24.99',
        'display_old': 'GHS 34.99',
    },
    'annual': {
        'id': 'annual',
        'name': 'Annual Membership',
        'price_ghs': 299.0,
        'price_pesewas': 29900,
        'old_price_ghs': None,
        'badge': None,
        'detail': 'Best value — less than GHS 6 per week',
        'duration_days': 365,
        'display_price': 'GHS 299/year',
        'display_old': None,
    },
}


def _user_is_vip(user) -> bool:
    status = (getattr(user, 'premium_status', None) or '').lower()
    if status in ('active', 'trial'):
        exp = getattr(user, 'premium_expires_at', None)
        if exp is None or exp > datetime.utcnow():
            return True
    return bool(getattr(user, 'is_elite', False))


def _activate_vip(user, plan_id: str, reference: str, amount_ghs: float):
    plan = _VIP_PLANS.get(plan_id) or _VIP_PLANS['weekly']
    days = int(plan['duration_days'])
    now = datetime.utcnow()
    user.premium_status = 'active'
    user.premium_plan = plan_id
    user.premium_expires_at = now + timedelta(days=days)
    uid = user.wiam_id or user.id
    sub = PremiumSubscription(
        user_id=uid,
        plan=plan_id,
        amount_ghs=float(amount_ghs),
        status='active',
        store='paystack',
        store_product_id=f'wiamepisio_membership_{plan_id}',
        store_transaction_id=reference,
        paystack_reference=reference,
        started_at=now,
        expires_at=user.premium_expires_at,
    )
    db.session.add(sub)


@episio_catalog_api.route('/vip/plans', methods=['GET'])
@jwt_optional
def vip_plans():
    """Public plan list for Membership HTML screen."""
    cfg = PlatformConfig.get()
    plans = []
    for p in (_VIP_PLANS['weekly'], _VIP_PLANS['annual']):
        plans.append({
            'id': p['id'],
            'name': p['name'],
            'price_ghs': p['price_ghs'],
            'display_price': p['display_price'],
            'display_old': p['display_old'],
            'badge': p['badge'],
            'detail': p['detail'],
            'duration_days': p['duration_days'],
        })
    return jsonify({
        'vip_enabled': bool(getattr(cfg, 'ff_vip_enabled', True)),
        'currency': 'GHS',
        'plans': plans,
        'benefits': [
            {'title': 'Unlimited access to every series', 'sub': 'No coins needed, ever'},
            {'title': 'Download for offline watching', 'sub': None},
            {'title': 'Daily member coin bonus', 'sub': None},
            {'title': 'Ad-free experience', 'sub': None},
        ],
    })


@episio_catalog_api.route('/vip/status', methods=['GET'])
@jwt_required
def vip_status():
    cfg = PlatformConfig.get()
    user = request.api_user
    is_vip = _user_is_vip(user)
    return jsonify({
        'vip_enabled': bool(getattr(cfg, 'ff_vip_enabled', True)),
        'is_vip': is_vip,
        'plan': getattr(user, 'premium_plan', None) or None,
        'status': getattr(user, 'premium_status', None) or 'none',
        'expires_at': user.premium_expires_at.isoformat() if getattr(user, 'premium_expires_at', None) else None,
        'daily_stipend_coins': int(getattr(cfg, 'vip_daily_stipend_coins', 30) or 30),
        'unlock_discount_pct': float(getattr(cfg, 'vip_unlock_discount_pct', 25) or 25),
        'claim_available': bool(getattr(cfg, 'ff_vip_enabled', True) and is_vip),
    })


@episio_catalog_api.route('/vip/initialize', methods=['POST'])
@jwt_required
def vip_initialize():
    """Start Paystack checkout for weekly/annual membership (native app)."""
    import requests as http_requests
    user = request.api_user
    data = request.get_json(silent=True) or {}
    plan_id = (data.get('plan_id') or 'weekly').lower()
    plan = _VIP_PLANS.get(plan_id)
    if not plan:
        return jsonify({'error': 'Invalid plan'}), 400
    if _user_is_vip(user) and (getattr(user, 'premium_status', None) or '') == 'active':
        return jsonify({'error': 'Membership already active', 'is_vip': True}), 400

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        return jsonify({'error': 'Payment system not configured'}), 500

    email = user.email or f'user{user.wiam_id or user.id}@wiamapp.com'
    payload = {
        'email': email,
        'amount': plan['price_pesewas'],
        'currency': 'GHS',
        'metadata': {
            'user_id': user.wiam_id or user.id,
            'product_type': 'membership',
            'plan_id': plan_id,
            'duration_days': plan['duration_days'],
            'source': 'native_app_episio',
        },
    }
    try:
        resp = http_requests.post(
            'https://api.paystack.co/transaction/initialize',
            json=payload,
            headers={'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'},
            timeout=15,
        )
        result = resp.json()
        if result.get('status') and result.get('data', {}).get('authorization_url'):
            return jsonify({
                'ok': True,
                'authorization_url': result['data']['authorization_url'],
                'reference': result['data']['reference'],
                'access_code': result['data'].get('access_code', ''),
                'plan_id': plan_id,
            })
        return jsonify({'error': result.get('message', 'Payment init failed')}), 500
    except Exception as e:
        log.error('VIP Paystack init error: %s', e)
        return jsonify({'error': 'Payment service unavailable'}), 503


@episio_catalog_api.route('/vip/verify', methods=['POST'])
@jwt_required
def vip_verify():
    """Verify Paystack membership payment and activate PremiumSubscription."""
    import requests as http_requests
    user = request.api_user
    data = request.get_json(silent=True) or {}
    reference = (data.get('reference') or '').strip()
    if not reference:
        return jsonify({'error': 'reference required'}), 400

    existing = PremiumSubscription.query.filter_by(paystack_reference=reference).first()
    if existing and existing.is_valid:
        return jsonify({'ok': True, 'already_activated': True, 'is_vip': True, 'plan': existing.plan})

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    try:
        resp = http_requests.get(
            f'https://api.paystack.co/transaction/verify/{reference}',
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        payload = resp.json()
        if not (payload.get('status') and payload['data'].get('status') == 'success'):
            return jsonify({'error': 'Payment not successful'}), 400
    except Exception:
        return jsonify({'error': 'Could not verify payment'}), 503

    pdata = payload['data']
    meta = pdata.get('metadata') or {}
    uid = meta.get('user_id')
    plan_id = (meta.get('plan_id') or data.get('plan_id') or 'weekly').lower()
    if not uid or int(uid) not in (user.wiam_id, user.id):
        return jsonify({'error': 'Payment metadata mismatch'}), 400
    if meta.get('product_type') and meta.get('product_type') != 'membership':
        return jsonify({'error': 'Not a membership payment'}), 400

    plan = _VIP_PLANS.get(plan_id) or _VIP_PLANS['weekly']
    _activate_vip(user, plan_id, reference, plan['price_ghs'])
    db.session.commit()
    return jsonify({
        'ok': True,
        'is_vip': True,
        'plan': plan_id,
        'expires_at': user.premium_expires_at.isoformat() if user.premium_expires_at else None,
    })


@episio_catalog_api.route('/vip/claim-stipend', methods=['POST'])
@jwt_required
def vip_claim_stipend():
    cfg = PlatformConfig.get()
    if not getattr(cfg, 'ff_vip_enabled', True):
        return jsonify({'error': 'vip_disabled'}), 400
    user = request.api_user
    if not _user_is_vip(user):
        return jsonify({'error': 'not_vip'}), 403
    # Ledger for daily stipend ships next; keep honest stub for active members.
    return jsonify({
        'ok': True,
        'stub': True,
        'message': 'Daily member coin bonus claim is queued; membership is active.',
        'amount': int(getattr(cfg, 'vip_daily_stipend_coins', 30) or 30),
    })


# ---------------------------------------------------------------------------
# Founder controls
# ---------------------------------------------------------------------------

@episio_catalog_api.route('/founder/episio/flags', methods=['GET', 'PATCH'])
@jwt_required
def founder_episio_flags():
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    cfg = PlatformConfig.get()
    if request.method == 'GET':
        return jsonify({
            'ff_trailer_quality_gate': bool(cfg.ff_trailer_quality_gate),
            'ff_require_complete_series': bool(cfg.ff_require_complete_series),
            'ff_vip_enabled': bool(cfg.ff_vip_enabled),
            'ff_season_quality_pipeline': bool(getattr(cfg, 'ff_season_quality_pipeline', True)),
            'ff_season_qc_technical': bool(getattr(cfg, 'ff_season_qc_technical', True)),
            'ff_season_qc_visual': bool(getattr(cfg, 'ff_season_qc_visual', True)),
            'ff_season_qc_audio': bool(getattr(cfg, 'ff_season_qc_audio', True)),
            'ff_season_qc_vmaf': bool(getattr(cfg, 'ff_season_qc_vmaf', True)),
            'ff_season_qc_ssim': bool(getattr(cfg, 'ff_season_qc_ssim', True)),
            'ff_season_qc_scenedetect': bool(getattr(cfg, 'ff_season_qc_scenedetect', True)),
            'ff_season_qc_vad': bool(getattr(cfg, 'ff_season_qc_vad', True)),
            'ff_season_qc_phash': bool(getattr(cfg, 'ff_season_qc_phash', True)),
            'ff_season_qc_watermark': bool(getattr(cfg, 'ff_season_qc_watermark', True)),
            'ff_season_qc_blackdetect': bool(getattr(cfg, 'ff_season_qc_blackdetect', True)),
            'ff_season_qc_integrity': bool(getattr(cfg, 'ff_season_qc_integrity', True)),
            'ff_season_qc_auto_reject_poor': bool(getattr(cfg, 'ff_season_qc_auto_reject_poor', True)),
            'ff_season_qc_auto_clear_good': bool(getattr(cfg, 'ff_season_qc_auto_clear_good', False)),
            'money_base_currency': cfg.money_base_currency or 'USD',
            'vip_daily_stipend_coins': int(getattr(cfg, 'vip_daily_stipend_coins', 30) or 30),
            'vip_unlock_discount_pct': float(getattr(cfg, 'vip_unlock_discount_pct', 25) or 25),
        })
    data = request.get_json(silent=True) or {}
    for key in (
        'ff_trailer_quality_gate', 'ff_require_complete_series', 'ff_vip_enabled',
        'ff_season_quality_pipeline', 'ff_season_qc_technical', 'ff_season_qc_visual',
        'ff_season_qc_audio', 'ff_season_qc_vmaf', 'ff_season_qc_ssim',
        'ff_season_qc_scenedetect', 'ff_season_qc_vad', 'ff_season_qc_phash',
        'ff_season_qc_watermark', 'ff_season_qc_blackdetect', 'ff_season_qc_integrity',
        'ff_season_qc_auto_reject_poor', 'ff_season_qc_auto_clear_good',
    ):
        if key in data:
            setattr(cfg, key, bool(data[key]))
    if 'vip_daily_stipend_coins' in data:
        cfg.vip_daily_stipend_coins = int(data['vip_daily_stipend_coins'])
    if 'vip_unlock_discount_pct' in data:
        cfg.vip_unlock_discount_pct = float(data['vip_unlock_discount_pct'])
    if 'money_base_currency' in data:
        cfg.money_base_currency = str(data['money_base_currency']).upper()[:8]
    cfg.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True})


@episio_catalog_api.route('/founder/episio/featured', methods=['GET', 'POST'])
@jwt_required
def founder_featured():
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    if request.method == 'GET':
        slot = request.args.get('slot_key')
        q = FeaturedTrailerSlot.query
        if slot:
            q = q.filter_by(slot_key=slot)
        rows = q.order_by(FeaturedTrailerSlot.slot_key.asc(), FeaturedTrailerSlot.sort_order.asc()).limit(200).all()
        return jsonify({'slots': [{
            'id': s.id,
            'slot_key': s.slot_key,
            'content_id': s.content_id,
            'sort_order': s.sort_order,
            'is_active': s.is_active,
            'note': s.note,
            'starts_at': s.starts_at.isoformat() if s.starts_at else None,
            'ends_at': s.ends_at.isoformat() if s.ends_at else None,
        } for s in rows]})

    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id')
    slot_key = (data.get('slot_key') or 'home_featured').lower()
    if not content_id:
        return jsonify({'error': 'content_id required'}), 400
    c = Content.query.get(int(content_id))
    if not c:
        return jsonify({'error': 'series_not_found'}), 404
    slot = FeaturedTrailerSlot(
        slot_key=slot_key,
        content_id=int(content_id),
        sort_order=int(data.get('sort_order') or 0),
        is_active=bool(data.get('is_active', True)),
        curated_by=request.api_user.wiam_id or request.api_user.id,
        note=data.get('note') or '',
    )
    db.session.add(slot)
    db.session.commit()
    return jsonify({'ok': True, 'id': slot.id})


@episio_catalog_api.route('/founder/episio/featured/<int:slot_id>', methods=['PATCH', 'DELETE'])
@jwt_required
def founder_featured_item(slot_id):
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    slot = FeaturedTrailerSlot.query.get(slot_id)
    if not slot:
        return jsonify({'error': 'not_found'}), 404
    if request.method == 'DELETE':
        db.session.delete(slot)
        db.session.commit()
        return jsonify({'ok': True})
    data = request.get_json(silent=True) or {}
    for key in ('slot_key', 'note'):
        if key in data:
            setattr(slot, key, data[key])
    if 'sort_order' in data:
        slot.sort_order = int(data['sort_order'])
    if 'is_active' in data:
        slot.is_active = bool(data['is_active'])
    if 'content_id' in data:
        slot.content_id = int(data['content_id'])
    db.session.commit()
    return jsonify({'ok': True})


@episio_catalog_api.route('/founder/episio/series/<int:series_id>', methods=['PATCH'])
@jwt_required
def founder_series_flags(series_id):
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    c = Content.query.get(series_id)
    if not c or c.is_deleted:
        return jsonify({'error': 'not_found'}), 404
    data = request.get_json(silent=True) or {}
    if 'is_wiam_origin' in data:
        c.is_wiam_origin = bool(data['is_wiam_origin'])
        if c.is_wiam_origin:
            c.catalog_shelf = 'origin'
            c.coin_band = data.get('coin_band') or 'origin'
    if 'is_vip_series' in data:
        c.is_vip_series = bool(data['is_vip_series'])
        if c.is_vip_series:
            c.catalog_shelf = 'vip'
            c.coin_band = data.get('coin_band') or 'vip'
    if 'catalog_shelf' in data:
        c.catalog_shelf = str(data['catalog_shelf']).lower()
    if 'coin_band' in data:
        c.coin_band = str(data['coin_band']).lower()
    if 'format' in data:
        c.format = str(data['format']).lower()
    if 'planned_episode_count' in data:
        c.planned_episode_count = int(data['planned_episode_count'])
    if 'trailer_qa_status' in data:
        # Manual override
        status = str(data['trailer_qa_status']).lower()
        if status in ('passed', 'failed', 'needs_review', 'pending', 'none'):
            c.trailer_qa_status = status
            c.trailer_qa_checked_at = datetime.utcnow()
            db.session.add(TrailerQualityReport(
                content_id=c.id,
                status=status,
                overall_score=float(data.get('score') or (1.0 if status == 'passed' else 0.0)),
                failure_reasons=data.get('note') or 'founder_override',
                auto_checked=False,
                reviewed_by=request.api_user.wiam_id or request.api_user.id,
            ))
    apply_band_to_unpublished_episodes(c)
    db.session.commit()
    return jsonify({'ok': True, 'series': _series_card(c)})


@episio_catalog_api.route('/founder/episio/coin-bands', methods=['GET', 'PATCH'])
@jwt_required
def founder_coin_bands():
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    ensure_default_bands()
    if request.method == 'GET':
        return jsonify({'bands': list_bands()})
    data = request.get_json(silent=True) or {}
    band_key = (data.get('band_key') or '').lower()
    band = CoinPriceBand.query.filter_by(band_key=band_key).first()
    if not band:
        return jsonify({'error': 'band_not_found'}), 404
    if 'unlock_coins' in data:
        band.unlock_coins = int(data['unlock_coins'])
    if 'min_coins' in data:
        band.min_coins = int(data['min_coins'])
    if 'max_coins' in data:
        band.max_coins = int(data['max_coins'])
    if 'label' in data:
        band.label = str(data['label'])
    if 'is_active' in data:
        band.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({'ok': True, 'bands': list_bands()})


@episio_catalog_api.route('/internal/rankings/recompute', methods=['POST'])
@jwt_required
def internal_rankings_recompute():
    forbid = _founder_forbidden()
    if forbid:
        return forbid
    results = recompute_rankings()
    return jsonify({'ok': True, 'periods': results})
