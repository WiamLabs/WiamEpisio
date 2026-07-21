"""
SLA auto-decision after trust-tier review window expires.

If founder has not Publish / Changes Required by SLA deadline:
  - Good/Excellent (clean QC) → auto-publish (platform publish)
  - Poor / failed / borderline with problems → auto Needs Changes (reject-for-fix)

Tier windows: new 72h · rising 48h · trusted 24h · elite 12h
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from ..extensions import db
from ..models import (
    Content, Episode, PlatformConfig, SeasonQualityJob, SeasonAssetQualityReport,
)
from .series_publish_gate import can_go_live, refresh_completeness
from .coin_pricing import apply_band_to_unpublished_episodes
from .episode_access import free_episode_count_for

log = logging.getLogger(__name__)

TIER_SLA_HOURS = {
    'new': 72,
    'rising': 48,
    'trusted': 24,
    'elite': 12,
}


def sla_auto_enabled() -> bool:
    cfg = PlatformConfig.get()
    return bool(getattr(cfg, 'ff_season_qc_sla_auto_decide', True))


def creator_trust_tier(creator_wiam_id) -> str:
    if not creator_wiam_id:
        return 'new'
    live_count = Content.query.filter(
        Content.deleted_at.is_(None),
        Content.creator_wiam_id == creator_wiam_id,
        Content.format.in_(['drama', 'anime', 'Drama']),
        Content.status.in_(Content.PUBLISHED_STATUSES),
    ).count()
    if live_count >= 6:
        return 'elite'
    if live_count >= 3:
        return 'trusted'
    if live_count >= 1:
        return 'rising'
    return 'new'


def sla_hours_for_content(content: Content) -> int:
    return TIER_SLA_HOURS.get(creator_trust_tier(content.creator_wiam_id), 72)


def _latest_job(content_id: int) -> Optional[SeasonQualityJob]:
    return (
        SeasonQualityJob.query.filter_by(content_id=content_id)
        .order_by(SeasonQualityJob.id.desc())
        .first()
    )


def _is_good_enough(content: Content, job: Optional[SeasonQualityJob]) -> bool:
    """Auto-publish only when QC is clean — no poor/failed/borderline/pending_founder."""
    qc = (getattr(content, 'season_qc_status', None) or '').lower()
    if qc in ('failed', 'needs_changes', 'pending_founder'):
        return False
    if job:
        if job.founder_decision:
            return False  # already decided
        band = (job.overall_band or '').lower()
        status = (job.status or '').lower()
        if status in ('failed', 'needs_changes'):
            return False
        if band in ('poor', 'borderline'):
            return False
        if band in ('excellent', 'good') or status == 'passed':
            return True
        # pending after good auto-clear path
        if status == 'borderline' and band in ('excellent', 'good'):
            return True
    # No job but QC marked passed
    return qc == 'passed'


def platform_publish_series(content: Content, job: Optional[SeasonQualityJob] = None, *, note: str = '') -> Tuple[bool, str]:
    """Shared platform publish (founder or SLA auto). Creator never calls this."""
    refresh_completeness(content)
    ok, reason, _ = can_go_live(content)
    if not ok:
        return False, reason
    if (content.season_qc_status or '').lower() == 'failed':
        return False, 'season_qc_failed'

    apply_band_to_unpublished_episodes(content)
    content.status = 'published'
    content.review_status = 'approved'
    content.season_qc_status = 'passed'
    if not content.published_at:
        content.published_at = datetime.utcnow()
    now = datetime.utcnow()
    free_n = free_episode_count_for(content)
    # Whole unit goes live together (free-first-N drip still applies)
    for ep in Episode.query.filter_by(content_id=content.id).order_by(Episode.episode_number.asc()).all():
        if ep.episode_number <= free_n:
            ep.published = True
            if not ep.publish_at:
                ep.publish_at = now
    if job:
        job.founder_decision = 'approved'
        job.status = 'passed'
        job.founder_note = (job.founder_note or '') + (note or ' [team auto-publish after clean review]')
        job.decided_at = datetime.utcnow()
        job.decided_by = 0  # system
    unit = 'season' if (getattr(content, 'structure_mode', None) or 'series') == 'season' else 'series'
    content.review_change_items = json.dumps([{
        'tag': 'LIVE',
        'title': f'The WiamEpisio team has published your {unit}',
        'text': (
            f'Great news — our team reviewed your full {unit} (trailer + every episode). '
            f'Everything looked Good/Excellent, so we published it for viewers. '
            f'You can share it and grow. Earnings only count after this live moment.'
        ),
        'fix_target': None,
    }])
    db.session.commit()
    return True, 'ok'


def unpublish_whole_series(content: Content) -> None:
    """
    Whole-series reject law: NEVER leave EP1 live + EP2 rejected + EP3 live.
    On Needs Changes / reject, the entire unit stays unpublished until resubmit + approve.
    """
    content.status = 'draft'
    content.published_at = None
    for ep in Episode.query.filter_by(content_id=content.id).all():
        ep.published = False
        ep.publish_at = None


def _build_fix_items_from_job(job: Optional[SeasonQualityJob], note: str = '') -> list:
    """
    Track WHERE the problem is — one card per failed/borderline asset
    so the creator opens Trailer / EP N / Cover, not a vague reject.
    Prefer draft_change_items held for founder-first when present.
    """
    items = []
    if job:
        try:
            summary = json.loads(job.summary_json or '{}')
            draft = summary.get('draft_change_items') or []
            if draft:
                items = list(draft)
        except Exception:
            items = []
        if not items:
            assets = (
                SeasonAssetQualityReport.query.filter_by(job_id=job.id)
                .order_by(SeasonAssetQualityReport.id.asc())
                .all()
            )
            for a in assets:
                if (a.status or '') not in ('failed', 'borderline'):
                    continue
                kind = (a.asset_kind or 'episode').lower()
                reasons = (a.failure_reasons or '').strip()
                if kind == 'episode' and a.episode_number:
                    title = f'Episode {a.episode_number} — fix this file'
                    fix = 'episodes'
                    tag = 'EPISODE'
                elif kind == 'trailer':
                    title = 'Trailer — fix this file'
                    fix = 'trailer'
                    tag = 'TRAILER'
                elif kind == 'cover':
                    title = 'Cover / poster — replace this image'
                    fix = 'cover'
                    tag = 'COVER'
                elif kind == 'banner':
                    title = 'Banner — replace this image'
                    fix = 'cover'
                    tag = 'BANNER'
                else:
                    title = f'{kind.title()} — needs a fix'
                    fix = 'episodes'
                    tag = kind.upper()
                text = reasons or f'{kind} scored {(a.band or "poor").upper()} — re-export clean 9:16 and re-upload.'
                items.append({
                    'tag': tag,
                    'title': title,
                    'text': text,
                    'fix_target': fix,
                    'episode_id': a.episode_id,
                    'episode_number': a.episode_number,
                    'band': a.band,
                    'asset_kind': kind,
                })
    if note:
        items.insert(0, {
            'tag': 'REVIEW',
            'title': 'Why you are seeing this',
            'text': note,
            'fix_target': 'episodes',
            'episode_id': None,
            'episode_number': None,
        })
    if not items:
        items = [{
            'tag': 'REVIEW',
            'title': 'Changes required before going live',
            'text': (
                (job.failure_reasons if job and job.failure_reasons else None)
                or 'Quality was not clear enough to publish. Open Episodes and Trailer, fix flagged files, then resubmit.'
            ),
            'fix_target': 'episodes',
        }]
    return items


def platform_reject_series(content: Content, job: Optional[SeasonQualityJob] = None, *, note: str = '') -> None:
    """
    Whole-series reject: unpublish every episode + series.
    Still list WHICH files to fix — but nothing is live until the full unit passes again.
    """
    unpublish_whole_series(content)
    content.season_qc_status = 'needs_changes'
    content.review_status = 'revision_requested'
    unit = 'season' if (getattr(content, 'structure_mode', None) or 'series') == 'season' else 'series'
    default_note = note or (
        f'The WiamEpisio team has reviewed your {unit} and flagged problems. '
        f'Your whole {unit} stays offline (no episode goes live until everything is fixed). '
        f'Open each item below, fix that file, then resubmit the full {unit}.'
    )
    content.review_change_items = json.dumps(_build_fix_items_from_job(job, note=default_note))
    if job:
        job.founder_decision = 'changes_required'
        job.status = 'needs_changes'
        job.founder_note = (job.founder_note or '') + ' [team Needs Changes — whole unit unpublished]'
        job.decided_at = datetime.utcnow()
        job.decided_by = 0
    db.session.commit()


def process_expired_review_slas(limit: int = 40) -> dict:
    """
    Scan under-review seasons past trust-tier SLA.
    Good → auto-publish. Not good → auto Needs Changes.
    """
    if not sla_auto_enabled():
        return {'enabled': False, 'published': 0, 'rejected': 0, 'skipped': 0}

    now = datetime.utcnow()
    # Candidates: submitted, not published, no founder decision yet
    rows = (
        Content.query.filter(
            Content.deleted_at.is_(None),
            Content.format.in_(['drama', 'anime', 'Drama']),
            Content.review_status == 'under_review',
            Content.submitted_for_review_at.isnot(None),
            ~Content.status.in_(Content.PUBLISHED_STATUSES),
        )
        .order_by(Content.submitted_for_review_at.asc())
        .limit(200)
        .all()
    )

    published = rejected = skipped = 0
    actions = []
    for c in rows:
        if published + rejected >= limit:
            break
        job = _latest_job(c.id)
        if job and job.founder_decision:
            skipped += 1
            continue
        hours = sla_hours_for_content(c)
        deadline = c.submitted_for_review_at + timedelta(hours=hours)
        if now < deadline:
            skipped += 1
            continue
        # Still running QC — wait
        if job and (job.status or '') in ('queued', 'running'):
            skipped += 1
            continue

        tier = creator_trust_tier(c.creator_wiam_id)
        if _is_good_enough(c, job):
            ok, reason = platform_publish_series(
                c, job,
                note=f' SLA auto-publish after {hours}h ({tier} tier).',
            )
            if ok:
                published += 1
                actions.append({'content_id': c.id, 'action': 'auto_publish', 'tier': tier, 'hours': hours})
                log.info('SLA auto-publish content=%s tier=%s', c.id, tier)
            else:
                # Could not publish cleanly → treat as reject-for-fix
                platform_reject_series(
                    c, job,
                note=(
                    f'The WiamEpisio team’s review window ended ({hours}h, {tier} tier) and we could not publish yet ({reason}). '
                    f'Your whole series/season stays offline. Fix the items below, then resubmit everything as one unit.'
                ),
                )
                rejected += 1
                actions.append({'content_id': c.id, 'action': 'auto_reject', 'reason': reason, 'tier': tier})
        else:
            platform_reject_series(
                c, job,
                note=(
                    f'The WiamEpisio team has reviewed your series and flagged problems '
                    f'(review window {hours}h, {tier} tier ended without a publish). '
                    f'Nothing is live — not even Episode 1 — until the full series/season passes. '
                    f'Fix each item below, then resubmit.'
                ),
            )
            rejected += 1
            actions.append({'content_id': c.id, 'action': 'auto_reject', 'tier': tier, 'hours': hours})
            log.info('SLA auto-reject content=%s tier=%s', c.id, tier)

    return {
        'enabled': True,
        'published': published,
        'rejected': rejected,
        'skipped': skipped,
        'actions': actions,
    }
