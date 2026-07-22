"""
Trailer asset QA — Founder toggles PlatformConfig.ff_trailer_quality_gate.

NOTE: Go-live is NOT trailer-only. Full-season QC (trailer + EVERY episode +
cover/banner) lives in season_quality_pipeline.py and is controlled by
ff_season_quality_pipeline on the founder dashboard.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from ..extensions import db
from ..models import Content, PlatformConfig, TrailerQualityReport

log = logging.getLogger(__name__)

# Serious short-drama trailer bands (Specs Guide: 15–60s inclusive)
MIN_DURATION_SEC = 15
MAX_DURATION_SEC = 60
MIN_SCORE_PASS = 0.72


def gate_enabled() -> bool:
    cfg = PlatformConfig.get()
    return bool(getattr(cfg, 'ff_trailer_quality_gate', False))


def validate_trailer_placement(meta: Optional[dict]) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Hard checks for every surface trailers appear on (home, series, soft-interest).
    Returns (ok, message, checks).
    """
    meta = meta or {}
    checks: Dict[str, Any] = {}
    try:
        duration = float(meta.get('duration_seconds') or 0)
    except (TypeError, ValueError):
        duration = 0.0
    try:
        width = int(meta.get('width') or 0)
        height = int(meta.get('height') or 0)
    except (TypeError, ValueError):
        width, height = 0, 0

    if duration <= 0:
        checks['duration'] = {'ok': False, 'value': duration, 'reason': 'missing_duration'}
        return False, f'Trailer duration unknown. Export {MIN_DURATION_SEC}–{MAX_DURATION_SEC} seconds.', checks

    # Strict band — anything over 60.0s (e.g. 1:00.1 / rounded phone probes) fails
    if duration < MIN_DURATION_SEC or duration > MAX_DURATION_SEC:
        checks['duration'] = {'ok': False, 'value': duration, 'reason': 'out_of_band'}
        return (
            False,
            f'Trailer must be {MIN_DURATION_SEC}–{MAX_DURATION_SEC} seconds for every placement. '
            f'Yours is {duration:.1f}s — re-export shorter/longer and try again.',
            checks,
        )
    checks['duration'] = {'ok': True, 'value': int(round(duration))}

    if width < 1 or height < 1:
        checks['aspect'] = {'ok': False, 'reason': 'missing_size'}
        return False, 'Trailer width/height missing. Export 9:16 or 16:9.', checks

    ratio = width / float(height)
    vertical = abs(ratio - 9 / 16) <= 0.06
    landscape = abs(ratio - 16 / 9) <= 0.06
    if not vertical and not landscape:
        checks['aspect'] = {'ok': False, 'width': width, 'height': height, 'reason': 'bad_aspect'}
        return (
            False,
            f'Trailer must be 9:16 vertical or 16:9 landscape so it fits every trailer place. '
            f'Got {width}×{height}.',
            checks,
        )
    if vertical and (width < 720 or height < 1280):
        checks['resolution'] = {'ok': False, 'width': width, 'height': height}
        return False, f'Resolution too low ({width}×{height}). Vertical min 720×1280.', checks
    if landscape and (width < 1280 or height < 720):
        checks['resolution'] = {'ok': False, 'width': width, 'height': height}
        return False, f'Resolution too low ({width}×{height}). Landscape min 1280×720.', checks

    checks['aspect'] = {
        'ok': True,
        'width': width,
        'height': height,
        'mode': '9:16' if vertical else '16:9',
    }
    checks['resolution'] = {'ok': True, 'width': width, 'height': height}
    return True, 'ok', checks


def _score_trailer_meta(meta: Optional[dict]) -> Tuple[float, Dict[str, Any], list]:
    """Score from metadata. Placement hard-fails always force failed status."""
    meta = meta or {}
    ok_place, place_msg, place_checks = validate_trailer_placement(meta)
    checks = dict(place_checks)
    fails = []
    score = 1.0

    if not ok_place:
        fails.append(place_msg)
        score -= 0.45

    bitrate = int(meta.get('bitrate_kbps') or 0)
    audio_lufs = meta.get('audio_lufs')
    black_ratio = float(meta.get('black_frame_ratio') or 0)
    mood = (meta.get('mood_label') or 'serious').lower()

    if bitrate and bitrate < 1200:
        checks['bitrate'] = {'ok': False, 'bitrate_kbps': bitrate}
        fails.append('Bitrate too low for serious trailer quality')
        score -= 0.15
    elif bitrate:
        checks['bitrate'] = {'ok': True, 'bitrate_kbps': bitrate}

    if black_ratio > 0.15:
        checks['black_frames'] = {'ok': False, 'ratio': black_ratio}
        fails.append('Too many black/blank frames')
        score -= 0.2
    else:
        checks['black_frames'] = {'ok': True, 'ratio': black_ratio}

    if mood in ('meme', 'random', 'low_effort', 'tiktok_noise'):
        checks['mood'] = {'ok': False, 'label': mood}
        fails.append('Trailer mood not serious enough for WiamEpisio')
        score -= 0.3
    else:
        checks['mood'] = {'ok': True, 'label': mood}

    if audio_lufs is not None:
        try:
            lufs = float(audio_lufs)
            ok = -20.0 <= lufs <= -6.0
            checks['audio'] = {'ok': ok, 'lufs': lufs}
            if not ok:
                fails.append('Audio levels out of range')
                score -= 0.15
        except (TypeError, ValueError):
            checks['audio'] = {'ok': None}

    score = max(0.0, min(1.0, score))
    # Tag hard placement failure for callers
    checks['placement_ok'] = ok_place
    return score, checks, fails


def run_trailer_qa(content: Content, meta: Optional[dict] = None) -> TrailerQualityReport:
    score, checks, fails = _score_trailer_meta(meta)
    if not content.trailer_url and not content.trailer_storage_key and not content.trailer_hls_url:
        fails.append('No trailer uploaded')
        score = 0.0
        checks['present'] = {'ok': False}
    else:
        checks['present'] = {'ok': True}

    placement_failed = checks.get('placement_ok') is False
    if placement_failed or (fails and score < MIN_SCORE_PASS):
        status = 'failed'
    elif score >= MIN_SCORE_PASS and not fails:
        status = 'passed'
    elif score >= MIN_SCORE_PASS:
        status = 'needs_review'
    else:
        status = 'failed'

    report = TrailerQualityReport(
        content_id=content.id,
        status=status,
        overall_score=score,
        checks_json=json.dumps(checks),
        failure_reasons='; '.join(fails),
        auto_checked=True,
    )
    db.session.add(report)
    content.trailer_qa_status = status
    content.trailer_qa_score = score
    content.trailer_qa_checked_at = datetime.utcnow()
    if meta and meta.get('duration_seconds'):
        try:
            content.trailer_duration_seconds = int(round(float(meta['duration_seconds'])))
        except (TypeError, ValueError):
            pass
    return report


def trailer_allows_publish(content: Content) -> Tuple[bool, str]:
    if not gate_enabled():
        return True, 'gate_off'
    status = (content.trailer_qa_status or 'none').lower()
    if status == 'passed':
        return True, 'trailer_passed'
    if status == 'needs_review':
        return False, 'trailer_needs_review'
    if status == 'failed':
        return False, 'trailer_failed'
    return False, 'trailer_not_checked'
