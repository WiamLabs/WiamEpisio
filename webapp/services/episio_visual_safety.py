"""
WiamEpisio visual safety — Gemini (free) vision check on episode/trailer frames.

Policy (product law):
  - Romance / kissing / hugging / clothed intimacy = ALLOWED (drama).
  - Explicit genitals / open sex showing private parts = HARD FAIL + founder attention.
  - Uncertain borderline = flag founder_attention, do not auto-pass as clean.

Uses GEMINI_API_KEY (same free stack as old WiamApp AI fallback).
Graceful skip if key/model unavailable — other QC layers still run.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

_SAFETY_SYSTEM = """You are WiamEpisio season safety QC for short drama.
Return ONLY JSON with keys:
  explicit_genitals (bool) — true ONLY if real penis/vagina/anus clearly visible or open sex with genitals shown
  romance_ok (bool) — true if content is kissing/hugging/romance/intimacy WITHOUT genitals
  confidence (0-1 number)
  reason (short string)
  founder_attention (bool) — true if you are unsure OR explicit_genitals OR stolen-looking overlays

Rules:
- Kissing, hugging, romance, clothed scenes, suggestive but covered = romance_ok true, explicit_genitals false
- Do NOT flag kissing as explicit
- Only set explicit_genitals true for clear genital visibility / open pornographic sex
- Watermark logos alone are NOT your job (other detectors handle that)
"""


def _flag_on() -> bool:
    try:
        from ..models import PlatformConfig
        cfg = PlatformConfig.get()
        return bool(getattr(cfg, 'ff_season_qc_ai_safety', True))
    except Exception:
        return True


def _frames_to_jpeg_b64(frames_bgr: List[Any], limit: int = 4) -> List[str]:
    out = []
    try:
        import cv2
    except Exception:
        return out
    for frame in (frames_bgr or [])[:limit]:
        try:
            ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 72])
            if ok:
                out.append(base64.b64encode(buf.tobytes()).decode('ascii'))
        except Exception:
            continue
    return out


def _extract_frames_ffmpeg(path: str, count: int = 4) -> List[str]:
    """Return list of base64 JPEGs via ffmpeg when OpenCV frames unavailable."""
    if not path or not os.path.isfile(path):
        return []
    import shutil
    import subprocess
    if not shutil.which('ffmpeg'):
        return []
    out = []
    with tempfile.TemporaryDirectory(prefix='episio_safe_') as td:
        pattern = os.path.join(td, 'f_%02d.jpg')
        # sample ~evenly
        cmd = [
            'ffmpeg', '-y', '-i', path,
            '-vf', f'fps=1/{max(1, count)}',
            '-frames:v', str(count),
            pattern,
        ]
        try:
            subprocess.run(cmd, capture_output=True, timeout=90)
        except Exception as e:
            log.debug('ffmpeg frame extract failed: %s', e)
            return []
        for i in range(1, count + 1):
            fp = os.path.join(td, f'f_{i:02d}.jpg')
            if not os.path.isfile(fp):
                continue
            try:
                with open(fp, 'rb') as f:
                    out.append(base64.b64encode(f.read()).decode('ascii'))
            except Exception:
                pass
    return out


def _call_gemini_vision(images_b64: List[str]) -> Optional[Dict[str, Any]]:
    if not images_b64:
        return None
    api_key = (os.environ.get('GEMINI_API_KEY') or '').strip()
    if not api_key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-lite',
            system_instruction=_SAFETY_SYSTEM,
            generation_config={
                'temperature': 0.1,
                'max_output_tokens': 400,
                'response_mime_type': 'application/json',
            },
        )
        parts = [
            'Review these drama episode/trailer frames for WiamEpisio safety. JSON only.',
        ]
        for b64 in images_b64[:4]:
            parts.append({'mime_type': 'image/jpeg', 'data': base64.b64decode(b64)})
        resp = model.generate_content(parts)
        text = (resp.text or '').strip() if resp else ''
        if not text:
            return None
        data = json.loads(text)
        if not isinstance(data, dict):
            return None
        return {
            'explicit_genitals': bool(data.get('explicit_genitals')),
            'romance_ok': bool(data.get('romance_ok', True)),
            'confidence': float(data.get('confidence') or 0),
            'reason': str(data.get('reason') or '')[:400],
            'founder_attention': bool(data.get('founder_attention')),
            'provider': 'gemini-2.0-flash-lite',
        }
    except Exception as e:
        log.warning('Gemini visual safety failed: %s', e)
        return None


def check_visual_safety(
    *,
    path: Optional[str] = None,
    frames_bgr: Optional[List[Any]] = None,
    kind: str = 'episode',
) -> Dict[str, Any]:
    """
    Run AI safety on sampled frames.
    Returns checked/skipped + verdict fields for QC pipeline.
    """
    if not _flag_on():
        return {'checked': False, 'skipped': True, 'reason': 'ff_season_qc_ai_safety_off'}

    images = _frames_to_jpeg_b64(frames_bgr or [], limit=4)
    if len(images) < 2 and path:
        images = _extract_frames_ffmpeg(path, count=4)
    if not images:
        return {
            'checked': False,
            'skipped': True,
            'reason': 'no_frames',
            'founder_attention': True,
        }

    verdict = _call_gemini_vision(images)
    if not verdict:
        return {
            'checked': False,
            'skipped': True,
            'reason': 'gemini_unavailable',
            'founder_attention': True,
            'note': 'Set GEMINI_API_KEY for free vision safety. Other QC layers still run.',
        }

    explicit = bool(verdict.get('explicit_genitals'))
    conf = float(verdict.get('confidence') or 0)
    # High-confidence explicit = hard fail; low confidence = founder attention
    hard_fail = explicit and conf >= 0.55
    founder = bool(verdict.get('founder_attention')) or (explicit and conf < 0.55) or hard_fail

    return {
        'checked': True,
        'kind': kind,
        'ok': not hard_fail,
        'band': 'poor' if hard_fail else ('borderline' if founder else 'good'),
        'explicit_genitals': explicit,
        'romance_ok': bool(verdict.get('romance_ok', True)),
        'confidence': conf,
        'reason': verdict.get('reason') or '',
        'founder_attention': founder,
        'provider': verdict.get('provider'),
        'hard_fail': hard_fail,
    }
