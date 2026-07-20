"""
Analytics — single source of truth for engagement events.

Every engagement endpoint should call ``track('event_type', user, ...)`` so we
get an append-only history in ``w_analytics_events`` in addition to whatever
denormalized counter the endpoint already maintains. Events feed:

* per-book / per-chapter creator analytics (Workstream F)
* the popularity score recompute that powers Home rails (Workstream E)
* dedupe + per-user shuffle of the home feed (Workstream C)
* future cohort / retention reports without a re-instrumentation pass

Design rules:

* ``user_id`` is **always** ``User.id`` (PK), never ``wiam_id``. The legacy
  split between those identifiers is what made follower counts and
  reading progress drift; ``_canonical_user_id`` enforces this once.
* ``track()`` is best-effort. If anything raises, it is swallowed so the
  parent request finishes normally.
* No commit inside ``track()`` — the row goes into the parent transaction
  and is persisted (or rolled back) with the endpoint's normal commit. This
  keeps tracking transactionally consistent with whatever side effect
  triggered it (e.g. the view counter bump and its event row commit
  together).
"""
import json
import logging

log = logging.getLogger(__name__)


def _canonical_user_id(user):
    """Return ``User.id`` (PK) for any input shape, never ``wiam_id``.

    Accepts a ``User`` model instance, an integer id, or ``None``. Returns
    ``None`` if the input is anonymous so we still log with ``user_id IS NULL``.
    """
    if user is None:
        return None
    if isinstance(user, int):
        return user
    pk = getattr(user, 'id', None)
    if isinstance(pk, int):
        return pk
    return None


def _detect_client():
    """Cheap client classification from the current request's User-Agent."""
    try:
        from flask import request
        ua = (request.headers.get('User-Agent') or '').lower()
        if 'wiamapp-mobile' in ua or 'expo' in ua or 'okhttp' in ua:
            return 'mobile'
        if 'wiambot' in ua or 'qa-bot' in ua:
            return 'bot'
        if ua:
            return 'web'
        return 'unknown'
    except Exception:
        return 'unknown'


def track(
    event_type,
    user=None,
    *,
    content_id=None,
    chapter_number=None,
    section_key=None,
    client=None,
    **metadata,
):
    """Record an engagement event. Best-effort; never raises.

    Args:
        event_type: One of the documented event keys (book_view, chapter_open,
            chapter_complete, like, comment, rating, follow, share,
            home_impression, home_click, push_open, search, ...).
        user: ``User`` instance, integer id, or ``None`` for anonymous.
        content_id: Book id (``Content.id``) when relevant.
        chapter_number: Chapter sequence within the book.
        section_key: Home rail name for impression/click events.
        client: Override for client detection ('web' / 'mobile' / 'bot').
        **metadata: Any extra context, JSON-serialised into ``metadata_json``.

    The row is added to the current ``db.session`` and travels with the
    parent transaction — callers do not need to commit explicitly.
    """
    try:
        from ..models import AnalyticsEvent
        from ..extensions import db

        meta_str = None
        if metadata:
            try:
                meta_str = json.dumps(metadata, default=str)[:4000]
            except Exception:
                meta_str = None

        evt = AnalyticsEvent(
            event_type=str(event_type)[:60],
            user_id=_canonical_user_id(user),
            content_id=content_id if isinstance(content_id, int) else None,
            chapter_number=chapter_number if isinstance(chapter_number, int) else None,
            section_key=str(section_key)[:80] if section_key else None,
            metadata_json=meta_str,
            client=(client or _detect_client()),
        )
        db.session.add(evt)
    except Exception as exc:
        # Tracking must never break a real request.
        try:
            log.warning("analytics.track(%s) skipped: %s", event_type, exc)
        except Exception:
            pass


def track_batch(events):
    """Bulk-record events from a single client batch (e.g. home impressions).

    ``events`` is an iterable of dicts with the same keys ``track()`` accepts.
    Used by the impression/click batch endpoints to keep request count low.
    """
    if not events:
        return
    for e in events:
        if not isinstance(e, dict):
            continue
        et = e.pop('event_type', None) if isinstance(e, dict) else None
        if not et:
            continue
        try:
            track(et, **e)
        except Exception:
            continue
