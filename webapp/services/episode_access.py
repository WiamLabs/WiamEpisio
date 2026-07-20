"""
Episode access — WiamEpisio free-first-N server-side law.

Free-first-5 (or Content.free_episode_count) is enforced here, never only on clients.
"""
from __future__ import annotations

from typing import Optional, Tuple

from ..extensions import db
from ..models import Content, Episode, EpisodeUnlock


DEFAULT_FREE_EPISODE_COUNT = 5


def _uid(user) -> Optional[int]:
    if user is None:
        return None
    return getattr(user, 'wiam_id', None) or getattr(user, 'id', None)


def free_episode_count_for(content: Content) -> int:
    n = getattr(content, 'free_episode_count', None)
    if n is None:
        return DEFAULT_FREE_EPISODE_COUNT
    try:
        return max(0, int(n))
    except (TypeError, ValueError):
        return DEFAULT_FREE_EPISODE_COUNT


def is_within_free_tier(episode: Episode, content: Optional[Content] = None) -> bool:
    content = content or Content.query.get(episode.content_id)
    if not content:
        return episode.episode_number <= DEFAULT_FREE_EPISODE_COUNT
    if episode.is_free:
        return True
    return int(episode.episode_number or 0) <= free_episode_count_for(content)


def has_episode_unlock(user, episode: Episode) -> bool:
    uid = _uid(user)
    if uid is None:
        return False
    ids = {uid}
    if getattr(user, 'id', None):
        ids.add(user.id)
    if getattr(user, 'wiam_id', None):
        ids.add(user.wiam_id)
    return EpisodeUnlock.query.filter(
        EpisodeUnlock.episode_id == episode.id,
        EpisodeUnlock.user_id.in_(list(ids)),
    ).first() is not None


def is_series_creator(user, content: Content) -> bool:
    uid = _uid(user)
    if uid is None or not content:
        return False
    return content.creator_wiam_id in (uid, getattr(user, 'wiam_id', None), getattr(user, 'id', None))


def can_watch(user, episode: Episode, content: Optional[Content] = None) -> Tuple[bool, str]:
    """
    Returns (allowed, reason).
    reason: free | unlocked | creator | deny_login | deny_locked
    """
    content = content or Content.query.get(episode.content_id)
    if not episode.published and not (user and content and is_series_creator(user, content)):
        return False, 'deny_unpublished'

    if user and content and is_series_creator(user, content):
        return True, 'creator'

    if is_within_free_tier(episode, content):
        return True, 'free'

    if user is None:
        return False, 'deny_login'

    if has_episode_unlock(user, episode):
        return True, 'unlocked'

    # Hook for premium/elite later — do not grant by default
    return False, 'deny_locked'


def ensure_free_unlock_row(user, episode: Episode, content: Content) -> Optional[EpisodeUnlock]:
    """Idempotently record a free unlock for free-tier episodes (audit trail)."""
    if not user or not is_within_free_tier(episode, content):
        return None
    uid = _uid(user)
    existing = EpisodeUnlock.query.filter_by(user_id=uid, episode_id=episode.id).first()
    if existing:
        return existing
    row = EpisodeUnlock(
        user_id=uid,
        episode_id=episode.id,
        content_id=episode.content_id,
        coins_spent=0,
        creator_id=content.creator_wiam_id or 0,
        unlock_method='free',
    )
    db.session.add(row)
    return row
