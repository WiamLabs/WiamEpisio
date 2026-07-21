"""Hard-purge a non-live Episio series/season unit from DB + cloud media."""
from __future__ import annotations

import logging

from ..extensions import db
from ..models import (
    Content, Episode, EpisodeUnlock, SeriesReminder, SeriesComment,
    SeasonQualityJob, SeasonAssetQualityReport,
)

log = logging.getLogger(__name__)


def purge_series_unit(content: Content) -> dict:
    """
    Permanently delete a draft/building unit and related rows + media.
    Caller must already block live / published units.
    """
    cid = content.id
    media_targets = []  # list of {url?, storage_key?}
    for attr in ('poster_url', 'cover_url', 'banner_url', 'trailer_url',
                 'trailer_poster_url', 'trailer_hls_url'):
        u = getattr(content, attr, None)
        if u:
            media_targets.append({'url': u})

    trailer_key = getattr(content, 'trailer_storage_key', None) or getattr(content, 'storage_key', None)
    if trailer_key and isinstance(trailer_key, str):
        media_targets.append({'storage_key': trailer_key})

    eps = Episode.query.filter_by(content_id=cid).all()
    for ep in eps:
        for attr in ('poster_url', 'video_url', 'hls_manifest_url'):
            u = getattr(ep, attr, None)
            if u and isinstance(u, str) and (u.startswith('http') or '/' in u):
                media_targets.append({'url': u if u.startswith('http') else None, 'storage_key': None if u.startswith('http') else u})
        sk = getattr(ep, 'storage_key', None)
        if sk:
            media_targets.append({'storage_key': sk})
        # video_url sometimes stores the R2 key directly
        vu = getattr(ep, 'video_url', None)
        if vu and isinstance(vu, str) and not vu.startswith('http'):
            media_targets.append({'storage_key': vu})

    job_ids = [j.id for j in SeasonQualityJob.query.filter_by(content_id=cid).all()]
    if job_ids:
        SeasonAssetQualityReport.query.filter(
            SeasonAssetQualityReport.job_id.in_(job_ids)
        ).delete(synchronize_session=False)
        SeasonQualityJob.query.filter_by(content_id=cid).delete(synchronize_session=False)

    SeriesReminder.query.filter_by(content_id=cid).delete(synchronize_session=False)
    SeriesComment.query.filter_by(content_id=cid).delete(synchronize_session=False)
    EpisodeUnlock.query.filter_by(content_id=cid).delete(synchronize_session=False)

    ep_ids = [e.id for e in eps]
    if ep_ids:
        try:
            from ..models import VideoAsset
            VideoAsset.query.filter(VideoAsset.episode_id.in_(ep_ids)).delete(synchronize_session=False)
        except Exception:
            pass
        try:
            from ..models import CreatorVideoUploadJob
            CreatorVideoUploadJob.query.filter_by(content_id=cid).delete(synchronize_session=False)
        except Exception:
            pass
        Episode.query.filter(Episode.id.in_(ep_ids)).delete(synchronize_session=False)
    else:
        Episode.query.filter_by(content_id=cid).delete(synchronize_session=False)

    db.session.delete(content)
    db.session.commit()

    # Cloud images (Cloudinary)
    try:
        from .image_service import delete_image_url
        for t in media_targets:
            u = t.get('url')
            if u and str(u).startswith('http'):
                try:
                    delete_image_url(u)
                except Exception:
                    pass
    except Exception:
        pass

    # R2 / video objects
    try:
        from .video_service import get_video_service
        vs = get_video_service()
        deleter = getattr(vs, 'delete_object', None)
        if callable(deleter):
            for t in media_targets:
                try:
                    deleter(storage_key=t.get('storage_key'), public_url=t.get('url'))
                except Exception:
                    pass
    except Exception:
        pass

    log.info('Hard-purged Episio series content_id=%s episodes=%s', cid, len(ep_ids))
    return {'ok': True, 'deleted': True, 'series_id': cid, 'episodes_removed': len(ep_ids)}
