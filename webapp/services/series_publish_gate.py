"""
Publish gates for WiamEpisio drama series.

Law: full season (every planned episode) + trailer + cover/banner/metadata
must clear before submit. Creator locks season; platform (website founder)
publishes after system QC + light human check. No half stories go live.
"""
from __future__ import annotations

import json
from typing import List, Tuple

from ..models import Content, Episode, PlatformConfig, SeriesReminder, Follow
from .trailer_qa import trailer_allows_publish


def require_complete_series() -> bool:
    cfg = PlatformConfig.get()
    return bool(getattr(cfg, 'ff_require_complete_series', True))


def count_ready_episodes(content_id: int) -> int:
    """Episodes uploaded and ready to stream (may still be unpublished for drip)."""
    return Episode.query.filter(
        Episode.content_id == content_id,
        Episode.transcode_status == 'ready',
    ).count()


def refresh_completeness(content: Content) -> bool:
    planned = int(getattr(content, 'planned_episode_count', 0) or 0)
    ready = count_ready_episodes(content.id)
    published = Episode.query.filter_by(content_id=content.id, published=True).count()
    total_rows = Episode.query.filter_by(content_id=content.id).count()
    effective_ready = max(ready, published if ready == 0 else ready)
    content.total_episodes = max(total_rows, published)
    complete = planned > 0 and effective_ready >= planned
    content.is_series_complete = complete
    return complete


def _has_cover(content: Content) -> bool:
    try:
        cover = content.cover_url
    except Exception:
        cover = None
    return bool(cover or getattr(content, 'poster_url', None) or getattr(content, 'cover_file_id', None))


def _has_banner(content: Content) -> bool:
    return bool(getattr(content, 'banner_url', None) or getattr(content, 'poster_url', None) or _has_cover(content))


def _has_metadata(content: Content) -> bool:
    title = (content.title or '').strip()
    desc = (content.description or '').strip()
    genre = (content.genre or '').strip()
    return len(title) >= 2 and len(desc) >= 10 and len(genre) >= 2


def soft_interest_counts(content: Content) -> dict:
    remind_count = SeriesReminder.query.filter_by(content_id=content.id).count()
    follow_count = 0
    try:
        follow_count = Follow.query.filter_by(creator_id=content.creator_wiam_id).count()
        # Also try User.id if creator_wiam_id maps poorly
        if follow_count == 0 and content.creator_wiam_id:
            from ..models import User
            u = User.query.filter_by(wiam_id=content.creator_wiam_id).first()
            if u:
                follow_count = Follow.query.filter_by(creator_id=u.id).count()
    except Exception:
        follow_count = 0
    soft_ok = follow_count >= 50 or remind_count >= 200 or (follow_count + remind_count) >= 200
    return {
        'followers': follow_count,
        'remind_count': remind_count,
        'combined': follow_count + remind_count,
        'soft_ok': soft_ok,
        'need_followers': 50,
        'need_reminds': 200,
    }


def build_completeness_gates(content: Content) -> List[dict]:
    """Full-season checklist: episodes + trailer + cover/banner + meta + rights + lock."""
    refresh_completeness(content)
    planned = int(getattr(content, 'planned_episode_count', 0) or 0)
    ready = count_ready_episodes(content.id)
    has_trailer = bool(
        content.trailer_url or content.trailer_storage_key or content.trailer_hls_url
    )
    ok_trailer, trailer_reason = trailer_allows_publish(content)
    trailer_pass = has_trailer and ok_trailer
    cover_ok = _has_cover(content)
    banner_ok = _has_banner(content)
    meta_ok = _has_metadata(content)
    rights_ok = bool(getattr(content, 'rights_confirmed', False))
    locked = bool(getattr(content, 'season_locked', False))
    soft = soft_interest_counts(content)
    qc = (getattr(content, 'season_qc_status', None) or 'none')
    final_n = Episode.query.filter_by(content_id=content.id, is_final=True).count()
    finals_ok = planned > 0 and final_n >= planned and ready >= planned

    gates = [
        {
            'key': 'episodes',
            'title': 'All planned episodes uploaded',
            'ok': bool(content.is_series_complete),
            'detail': f'{ready} of {planned or "?"} episodes — Ready' if planned else 'Set planned episode count',
            'fix': 'episodes',
        },
        {
            'key': 'finals',
            'title': 'Every episode marked final',
            'ok': finals_ok,
            'detail': f'{final_n} of {planned or "?"} marked final' if planned else 'Mark each episode final',
            'fix': 'episodes',
        },
        {
            'key': 'trailer',
            'title': 'Trailer QA passed',
            'ok': trailer_pass,
            'detail': 'Trailer passed' if trailer_pass else (
                'Trailer not uploaded yet' if not has_trailer else (trailer_reason or 'Trailer failed QA')
            ),
            'fix': 'trailer',
        },
        {
            'key': 'cover',
            'title': 'Cover & poster set',
            'ok': cover_ok,
            'detail': 'Cover uploaded' if cover_ok else 'Upload a 2:3 cover',
            'fix': 'cover',
        },
        {
            'key': 'banner',
            'title': 'Banner / hero art',
            'ok': banner_ok,
            'detail': 'Banner or poster set' if banner_ok else 'Add banner or poster art',
            'fix': 'cover',
        },
        {
            'key': 'metadata',
            'title': 'Synopsis & metadata',
            'ok': meta_ok,
            'detail': 'Title, genres, synopsis complete' if meta_ok else 'Fill title, genre, and synopsis',
            'fix': 'metadata',
        },
        {
            'key': 'rights',
            'title': 'Rights confirmed',
            'ok': rights_ok,
            'detail': 'Ownership confirmed' if rights_ok else 'Confirm rights before lock',
            'fix': 'rights',
        },
        {
            'key': 'season_lock',
            'title': 'Season locked (complete story)',
            'ok': locked,
            'detail': 'Season locked — no edits without revision' if locked else 'Confirm full season lock',
            'fix': 'lock',
        },
        {
            'key': 'soft_interest',
            'title': 'Soft interest threshold',
            'ok': soft['soft_ok'],
            'detail': f"{soft['followers']} followers · {soft['remind_count']} remind-me",
            'fix': 'soft_interest',
        },
        {
            'key': 'season_qc',
            'title': 'Full-season quality pipeline',
            'ok': qc in ('passed', 'queued', 'pending', 'needs_changes'),
            'detail': (
                'Queued/running: trailer + EVERY episode + cover/banner'
                if qc in ('queued', 'pending')
                else (
                    'Passed full-season QC' if qc == 'passed'
                    else ('Changes required after QC' if qc == 'needs_changes'
                          else ('Failed QC' if qc == 'failed' else 'Runs on submit — not trailer-only'))
                )
            ),
            'fix': None,
        },
    ]
    return gates


def can_go_live(content: Content) -> Tuple[bool, str, dict]:
    """Hard quality for founder publish (website). Creator never calls publish."""
    details = {
        'planned_episode_count': int(getattr(content, 'planned_episode_count', 0) or 0),
        'ready_episodes': count_ready_episodes(content.id),
        'episode_rows': Episode.query.filter_by(content_id=content.id).count(),
        'published_episodes': Episode.query.filter_by(content_id=content.id, published=True).count(),
        'is_series_complete': bool(getattr(content, 'is_series_complete', False)),
        'trailer_qa_status': getattr(content, 'trailer_qa_status', 'none'),
        'season_locked': bool(getattr(content, 'season_locked', False)),
        'season_qc_status': getattr(content, 'season_qc_status', 'none') or 'none',
        'has_cover': _has_cover(content),
        'has_banner': _has_banner(content),
        'has_metadata': _has_metadata(content),
        'rights_confirmed': bool(getattr(content, 'rights_confirmed', False)),
    }

    if (getattr(content, 'format', None) or '').lower() not in ('drama', 'anime'):
        return False, 'not_drama', details

    refresh_completeness(content)
    details['is_series_complete'] = bool(content.is_series_complete)
    details['ready_episodes'] = count_ready_episodes(content.id)

    if require_complete_series():
        planned = details['planned_episode_count']
        if planned <= 0:
            return False, 'planned_episode_count_required', details
        if not content.is_series_complete:
            return False, 'series_incomplete', details

    if not _has_cover(content):
        return False, 'cover_required', details
    if not _has_metadata(content):
        return False, 'metadata_required', details
    if not getattr(content, 'rights_confirmed', False):
        return False, 'rights_required', details

    planned = details['planned_episode_count']
    final_n = Episode.query.filter_by(content_id=content.id, is_final=True).count()
    details['final_episodes'] = final_n
    if planned > 0 and final_n < planned:
        return False, 'episodes_not_final', details

    has_trailer = bool(
        content.trailer_url or content.trailer_storage_key or content.trailer_hls_url
    )
    if not has_trailer:
        return False, 'trailer_required', details

    ok_trailer, trailer_reason = trailer_allows_publish(content)
    details['trailer_gate'] = trailer_reason
    if not ok_trailer:
        return False, trailer_reason, details

    return True, 'ok', details


def pre_live_fix_window(content: Content) -> bool:
    """
    After Needs Changes (pre-publish), creator may replace failed assets
    even though season_locked stays True. Live seasons use Revision Request (Wave 2).
    """
    if content.status in Content.PUBLISHED_STATUSES:
        return False
    qc = (getattr(content, 'season_qc_status', None) or '').lower()
    rev = (getattr(content, 'review_status', None) or '').lower()
    return qc in ('needs_changes', 'failed') or rev == 'revision_requested'


def parse_change_items(content: Content) -> list:
    raw = getattr(content, 'review_change_items', None) or '[]'
    try:
        items = json.loads(raw) if isinstance(raw, str) else (raw or [])
        return items if isinstance(items, list) else []
    except Exception:
        return []


def can_submit_for_review(content: Content, soft_required: bool = True) -> Tuple[bool, str, dict]:
    """Creator submit path: hard gates + season lock + soft interest."""
    ok, reason, details = can_go_live(content)
    if not ok:
        return False, reason, details
    if not getattr(content, 'season_locked', False):
        return False, 'season_lock_required', details
    soft = soft_interest_counts(content)
    details['soft_interest'] = soft
    if soft_required and not soft['soft_ok']:
        return False, 'soft_interest', details
    qc = (getattr(content, 'season_qc_status', None) or '').lower()
    rev = (getattr(content, 'review_status', None) or '').lower()
    details['season_qc_status'] = qc
    details['review_status'] = rev
    # Block double-submit while QC is actively running
    if rev == 'under_review' and qc in ('queued', 'pending', 'running'):
        return False, 'already_in_review', details
    return True, 'ok', details
