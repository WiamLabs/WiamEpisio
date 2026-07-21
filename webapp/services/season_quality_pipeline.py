"""
WiamEpisio full-season quality pipeline — complete toolkit from plan.

Checks TRAILER + EVERY EPISODE + cover/banner (not trailer-only).

Layers (all free / open-source; graceful fallback if binary/lib missing):
  1. FFprobe          — technical compliance
  2. Watermark        — OpenCV corner-region heuristic (TikTok/CapCut-style)
  3. PySceneDetect    — scene-aware frame sampling
  4. OpenCV           — sharpness / exposure / stability
  5. FFmpeg           — blackdetect + freezedetect
  6. VMAF (Netflix)   — source vs delivery re-encode integrity
  7. SSIM             — OpenCV structural similarity cross-check
  8. EBU R128         — loudness (ebur128)
  9. WebRTC VAD       — dialogue presence / silence gaps
 10. pHash            — duplicate / stolen-content against catalog

Bands (Netflix-style routing): excellent / good / borderline / poor
Founder toggles master + each stage on /founder/episio-quality.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
import wave
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..extensions import db
from ..models import (
    Content, Episode, PlatformConfig, SeasonQualityJob, SeasonAssetQualityReport,
    ContentFingerprint,
)

log = logging.getLogger(__name__)

BAND_RANK = {'excellent': 4, 'good': 3, 'borderline': 2, 'poor': 1, None: 0}

# Rough compute budget used for creator SLA messaging (minutes per asset)
EST_MINUTES = {
    'technical': 0.1,
    'scene': 0.5,
    'visual': 1.5,
    'blackdetect': 0.8,
    'vmaf': 3.0,
    'ssim': 1.0,
    'audio': 1.5,
    'vad': 1.0,
    'phash': 0.4,
    'watermark': 0.3,
}


def pipeline_enabled() -> bool:
    cfg = PlatformConfig.get()
    return bool(getattr(cfg, 'ff_season_quality_pipeline', True))


def _flag(name: str, default: bool = True) -> bool:
    cfg = PlatformConfig.get()
    return bool(getattr(cfg, name, default))


def _band_from_score(score: float) -> str:
    if score >= 0.80:
        return 'excellent'
    if score >= 0.60:
        return 'good'
    if score >= 0.40:
        return 'borderline'
    return 'poor'


def _worst_band(bands: List[str]) -> str:
    worst = 'excellent'
    for b in bands:
        if BAND_RANK.get(b, 0) < BAND_RANK.get(worst, 0):
            worst = b
    return worst


def _run_cmd(cmd: List[str], timeout: int = 60) -> Tuple[bool, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = (p.stdout or '') + (p.stderr or '')
        return p.returncode == 0, out
    except Exception as e:
        return False, str(e)


def tool_availability() -> Dict[str, Any]:
    """What the host can actually run right now (for founder dashboard)."""
    tools = {}
    tools['ffprobe'] = {'installed': bool(shutil.which('ffprobe')), 'layer': 'Technical', 'role': 'Resolution, aspect, codec, duration'}
    tools['ffmpeg'] = {'installed': bool(shutil.which('ffmpeg')), 'layer': 'Black/freeze + loudness + VMAF encode', 'role': 'FFmpeg filters'}
    try:
        import cv2  # noqa: F401
        tools['opencv'] = {'installed': True, 'layer': 'Visual', 'role': 'Blur, exposure, shake, watermark, SSIM'}
    except Exception:
        tools['opencv'] = {'installed': False, 'layer': 'Visual', 'role': 'Blur, exposure, shake, watermark, SSIM'}
    try:
        import scenedetect  # noqa: F401
        tools['pyscenedetect'] = {'installed': True, 'layer': 'Sampling', 'role': 'Cut-aware frame sampling'}
    except Exception:
        tools['pyscenedetect'] = {'installed': False, 'layer': 'Sampling', 'role': 'Cut-aware frame sampling'}
    try:
        import webrtcvad  # noqa: F401
        tools['webrtcvad'] = {'installed': True, 'layer': 'Audio', 'role': 'Dialogue presence / silence gaps'}
    except Exception:
        tools['webrtcvad'] = {'installed': False, 'layer': 'Audio', 'role': 'Dialogue presence / silence gaps'}
    try:
        import imagehash  # noqa: F401
        from PIL import Image  # noqa: F401
        tools['phash'] = {'installed': True, 'layer': 'Integrity', 'role': 'Duplicate / stolen content fingerprint'}
    except Exception:
        tools['phash'] = {'installed': False, 'layer': 'Integrity', 'role': 'Duplicate / stolen content fingerprint'}
    # VMAF = ffmpeg + libvmaf filter
    vmaf_ok = False
    if shutil.which('ffmpeg'):
        ok, out = _run_cmd(['ffmpeg', '-hide_banner', '-filters'], timeout=15)
        vmaf_ok = ok and 'libvmaf' in out
    tools['vmaf_netflix'] = {
        'installed': vmaf_ok,
        'layer': 'Transcode integrity',
        'role': 'Netflix VMAF — source vs delivery re-encode',
        'flag': 'ff_season_qc_vmaf',
    }
    tools['ebur128'] = {
        'installed': bool(shutil.which('ffmpeg')),
        'layer': 'Audio loudness',
        'role': 'EBU R128 integrated loudness (same family Netflix delivery uses)',
    }
    return tools


def review_tool_catalog() -> List[Dict[str, Any]]:
    """Human-readable catalog: what we tell the system to review."""
    avail = tool_availability()
    return [
        {'id': 'ffprobe', 'name': 'FFprobe', 'catches': 'Wrong resolution, aspect, codec, duration, corrupt file', 'when': 'Stage 1 — instant reject', 'installed': avail['ffprobe']['installed']},
        {'id': 'watermark', 'name': 'Watermark detector', 'catches': 'TikTok/CapCut corner watermarks used as final', 'when': 'Stage 1', 'installed': avail['opencv']['installed']},
        {'id': 'pyscenedetect', 'name': 'PySceneDetect', 'catches': 'Missed quality at real cuts (smart sampling)', 'when': 'Stage 2', 'installed': avail['pyscenedetect']['installed']},
        {'id': 'opencv_visual', 'name': 'OpenCV visual', 'catches': 'Blur, dark/blown exposure, unusable shake', 'when': 'Stage 3', 'installed': avail['opencv']['installed']},
        {'id': 'blackdetect', 'name': 'FFmpeg blackdetect/freezedetect', 'catches': 'Black/frozen frames, broken exports', 'when': 'Stage 3', 'installed': avail['ffmpeg']['installed']},
        {'id': 'vmaf', 'name': 'VMAF (Netflix)', 'catches': 'Our delivery encode degrading creator footage', 'when': 'Stage 3', 'installed': avail['vmaf_netflix']['installed']},
        {'id': 'ssim', 'name': 'SSIM', 'catches': 'Structural damage VMAF alone might miss', 'when': 'Stage 3', 'installed': avail['opencv']['installed']},
        {'id': 'ebur128', 'name': 'EBU R128 loudness', 'catches': 'Too quiet, clipping, inconsistent volume', 'when': 'Stage 4', 'installed': avail['ebur128']['installed']},
        {'id': 'webrtcvad', 'name': 'WebRTC VAD', 'catches': 'Dead air / missing dialogue where speech expected', 'when': 'Stage 4', 'installed': avail['webrtcvad']['installed']},
        {'id': 'phash', 'name': 'Perceptual hash', 'catches': 'Re-uploads / stolen content vs catalog', 'when': 'Stage 5', 'installed': avail['phash']['installed']},
        {'id': 'ai_safety', 'name': 'AI visual safety (Gemini)', 'catches': 'Explicit genitals / open sex — romance/kissing allowed', 'when': 'Stage 3', 'installed': bool((os.environ.get('GEMINI_API_KEY') or '').strip())},
    ]


def estimate_season_review(episode_count: int, has_trailer: bool = True) -> Dict[str, Any]:
    """
    Timing truth for creators/founders.
    Compute is minutes; human SLA is hours/days by trust tier.
    """
    n = max(0, int(episode_count or 0)) + (1 if has_trailer else 0)
    # Per-asset sequential estimate when all tools ON
    per = sum(EST_MINUTES.values())  # ~10 min worst-case with VMAF
    compute_min = max(2.0, n * per * 0.55)  # overlap/sampling discount
    # Human review window (promise) — plan default 24h; trust tiers shorter
    return {
        'assets': n,
        'compute_minutes_estimate': round(compute_min, 1),
        'compute_hours_estimate': round(compute_min / 60.0, 2),
        'human_sla_hours_default': 24,
        'human_sla_hours_by_tier': {'new': 72, 'rising': 48, 'trusted': 24, 'elite': 12},
        'note': (
            'Machines need minutes–a few hours for a full season. '
            'The creator-facing promise is up to 24h (or tier SLA) because of queue + human borderline review — not because each file takes days.'
        ),
    }


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def _ffprobe_meta(path: str) -> Dict[str, Any]:
    if not path or not os.path.isfile(path) or not shutil.which('ffprobe'):
        return {}
    ok, out = _run_cmd([
        'ffprobe', '-v', 'quiet', '-print_format', 'json',
        '-show_format', '-show_streams', path,
    ], timeout=45)
    if not ok:
        return {}
    try:
        data = json.loads(out)
    except Exception:
        return {}
    meta: Dict[str, Any] = {}
    for s in data.get('streams') or []:
        if s.get('codec_type') == 'video' and 'width' not in meta:
            meta['width'] = int(s.get('width') or 0)
            meta['height'] = int(s.get('height') or 0)
            meta['codec'] = s.get('codec_name')
            try:
                num, den = (s.get('avg_frame_rate') or '0/1').split('/')
                meta['fps'] = float(num) / float(den) if float(den) else 0
            except Exception:
                meta['fps'] = 0
        if s.get('codec_type') == 'audio' and 'audio_codec' not in meta:
            meta['audio_codec'] = s.get('codec_name')
    fmt = data.get('format') or {}
    try:
        meta['duration_seconds'] = int(float(fmt.get('duration') or 0))
    except Exception:
        pass
    try:
        meta['bitrate_kbps'] = int(int(fmt.get('bit_rate') or 0) / 1000)
    except Exception:
        pass
    meta['container'] = (fmt.get('format_name') or '').split(',')[0]
    return meta


def _scene_sample_indexes(path: str, total_frames: int) -> List[int]:
    """PySceneDetect cut points → frame indexes; else fixed percentiles."""
    if total_frames <= 10:
        return [0]
    if _flag('ff_season_qc_scenedetect', True):
        try:
            from scenedetect import open_video, SceneManager
            from scenedetect.detectors import ContentDetector
            video = open_video(path)
            sm = SceneManager()
            sm.add_detector(ContentDetector(threshold=27.0))
            sm.detect_scenes(video, show_progress=False)
            scenes = sm.get_scene_list()
            idxs = []
            for start, end in scenes[:40]:
                mid = (start.get_frames() + end.get_frames()) // 2
                idxs.append(int(mid))
            if idxs:
                return idxs
        except Exception as e:
            log.debug('PySceneDetect fallback: %s', e)
    return [int(total_frames * p) for p in (0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92)]


def _opencv_visual(path: str) -> Dict[str, Any]:
    if not path or not os.path.isfile(path):
        return {}
    try:
        import cv2
        import numpy as np
    except Exception:
        return {'opencv': False, 'reason': 'opencv_not_installed'}

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return {'opencv': False, 'reason': 'cannot_open'}
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    sample_idxs = _scene_sample_indexes(path, total)
    blurs, brights, contrasts, flows = [], [], [], []
    frames_bgr = []
    prev_gray = None
    for idx in sample_idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, idx))
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        frames_bgr.append(frame)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blurs.append(float(cv2.Laplacian(gray, cv2.CV_64F).var()))
        brights.append(float(np.mean(gray)))
        contrasts.append(float(np.std(gray)))
        if prev_gray is not None:
            flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            flows.append(float(np.mean(np.linalg.norm(flow, axis=2))))
        prev_gray = gray
    cap.release()
    if not blurs:
        return {'opencv': False, 'reason': 'no_frames'}
    return {
        'opencv': True,
        'samples': len(blurs),
        'scene_aware': _flag('ff_season_qc_scenedetect', True),
        'sharpness': sum(blurs) / len(blurs),
        'brightness': sum(brights) / len(brights),
        'contrast': sum(contrasts) / len(contrasts),
        'shake': (sum(flows) / len(flows)) if flows else 0.0,
        '_frames': frames_bgr,  # internal, stripped before save
    }


def _watermark_corners(frames_bgr: List[Any]) -> Dict[str, Any]:
    """Heuristic: high-contrast logos clustered in corners (CapCut/TikTok style)."""
    if not frames_bgr or not _flag('ff_season_qc_watermark', True):
        return {'checked': False}
    try:
        import cv2
        import numpy as np
    except Exception:
        return {'checked': False, 'reason': 'opencv_missing'}

    hits = 0
    for frame in frames_bgr[:8]:
        h, w = frame.shape[:2]
        corners = [
            frame[0:int(h * 0.12), 0:int(w * 0.28)],
            frame[0:int(h * 0.12), int(w * 0.72):w],
            frame[int(h * 0.88):h, 0:int(w * 0.28)],
            frame[int(h * 0.88):h, int(w * 0.72):w],
        ]
        for c in corners:
            if c.size == 0:
                continue
            gray = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 80, 160)
            edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
            # Dense small edges in corner often = watermark text/logo
            if edge_ratio > 0.12 and float(np.std(gray)) > 35:
                hits += 1
                break
    suspect = hits >= 2
    return {
        'checked': True,
        'corner_hits': hits,
        'suspect_watermark': suspect,
        'band': 'poor' if suspect else 'good',
    }


def _ffmpeg_black_freeze(path: str) -> Dict[str, Any]:
    if not path or not shutil.which('ffmpeg') or not os.path.isfile(path):
        return {'checked': False}
    if not _flag('ff_season_qc_blackdetect', True):
        return {'checked': False, 'skipped': True}
    ok, out = _run_cmd([
        'ffmpeg', '-i', path,
        '-vf', 'blackdetect=d=0.4:pix_th=0.10,freezedetect=n=0.003:d=0.8',
        '-an', '-f', 'null', '-',
    ], timeout=120)
    text = out or ''
    black_events = text.count('black_start')
    freeze_events = text.count('freeze_start')
    # crude duration from probe
    dur = 0.0
    try:
        dur = float(_ffprobe_meta(path).get('duration_seconds') or 1)
    except Exception:
        dur = 1.0
    black_ratio = min(1.0, (black_events * 0.5) / max(dur, 1.0))
    return {
        'checked': True,
        'black_events': black_events,
        'freeze_events': freeze_events,
        'black_ratio_est': black_ratio,
        'ok': black_events <= 2 and freeze_events <= 2 and black_ratio <= 0.12,
    }


def _ffmpeg_audio_loudness(path: str) -> Dict[str, Any]:
    if not path or not shutil.which('ffmpeg') or not os.path.isfile(path):
        return {}
    ok, out = _run_cmd([
        'ffmpeg', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-',
    ], timeout=120)
    text = out
    integrated = None
    true_peak = None
    for line in text.splitlines():
        if 'I:' in line and 'LUFS' in line:
            try:
                integrated = float(line.split('I:')[1].split('LUFS')[0].strip())
            except Exception:
                pass
        if 'Peak:' in line and 'dBFS' in line:
            try:
                true_peak = float(line.split('Peak:')[1].split('dBFS')[0].strip())
            except Exception:
                pass
    if integrated is None:
        return {'ebur128': False}
    return {'ebur128': True, 'integrated_lufs': integrated, 'true_peak_dbfs': true_peak}


def _extract_pcm_wav(path: str, out_wav: str, seconds: int = 90) -> bool:
    if not shutil.which('ffmpeg'):
        return False
    ok, _ = _run_cmd([
        'ffmpeg', '-y', '-i', path, '-t', str(seconds),
        '-ac', '1', '-ar', '16000', '-f', 'wav', out_wav,
    ], timeout=90)
    return ok and os.path.isfile(out_wav)


def _webrtc_vad_dialogue(path: str) -> Dict[str, Any]:
    if not path or not _flag('ff_season_qc_vad', True):
        return {'checked': False}
    try:
        import webrtcvad
    except Exception:
        return {'checked': False, 'reason': 'webrtcvad_not_installed'}

    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        wav_path = tmp.name
    try:
        if not _extract_pcm_wav(path, wav_path, seconds=120):
            return {'checked': False, 'reason': 'audio_extract_failed'}
        with wave.open(wav_path, 'rb') as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                return {'checked': False, 'reason': 'bad_wav'}
            pcm = wf.readframes(wf.getnframes())
        vad = webrtcvad.Vad(2)
        frame_ms = 30
        bytes_per = int(16000 * 2 * frame_ms / 1000)
        voiced = 0
        total = 0
        silence_run = 0
        long_silences = 0
        for i in range(0, len(pcm) - bytes_per, bytes_per):
            frame = pcm[i:i + bytes_per]
            total += 1
            try:
                is_speech = vad.is_speech(frame, 16000)
            except Exception:
                continue
            if is_speech:
                voiced += 1
                silence_run = 0
            else:
                silence_run += 1
                # ~1.5s of silence
                if silence_run == int(1500 / frame_ms):
                    long_silences += 1
        speech_ratio = voiced / float(total or 1)
        # Short drama should have meaningful dialogue; trailers can be lower
        return {
            'checked': True,
            'speech_ratio': round(speech_ratio, 3),
            'long_silence_gaps': long_silences,
            'ok': speech_ratio >= 0.08 and long_silences <= 12,
        }
    finally:
        try:
            os.unlink(wav_path)
        except Exception:
            pass


def _make_delivery_proxy(src: str) -> Optional[str]:
    """Re-encode a short delivery proxy for VMAF/SSIM (Netflix use: source vs our compress)."""
    if not shutil.which('ffmpeg') or not os.path.isfile(src):
        return None
    out = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False).name
    ok, _ = _run_cmd([
        'ffmpeg', '-y', '-i', src, '-t', '20',
        '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264', '-b:v', '1200k', '-an', out,
    ], timeout=120)
    if ok and os.path.isfile(out) and os.path.getsize(out) > 1000:
        return out
    try:
        os.unlink(out)
    except Exception:
        pass
    return None


def _vmaf_score(src: str, distorted: str) -> Optional[float]:
    """Netflix VMAF — full-reference. Flag-gated; needs libvmaf."""
    if not _flag('ff_season_qc_vmaf', True):
        return None
    if not (src and distorted and os.path.isfile(src) and os.path.isfile(distorted)):
        return None
    if not shutil.which('ffmpeg'):
        return None
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as tmp:
        out_path = tmp.name
    try:
        # Scale both to same size for libvmaf
        filt = (
            '[0:v]scale=720:1280:force_original_aspect_ratio=decrease,'
            'pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1[ref];'
            '[1:v]scale=720:1280:force_original_aspect_ratio=decrease,'
            'pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1[dist];'
            f'[ref][dist]libvmaf=log_path={out_path}:log_fmt=json'
        )
        ok, _ = _run_cmd([
            'ffmpeg', '-i', src, '-i', distorted,
            '-lavfi', filt, '-f', 'null', '-',
        ], timeout=240)
        if not os.path.isfile(out_path):
            return None
        with open(out_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        mean = data.get('pooled_metrics', {}).get('vmaf', {}).get('mean')
        if mean is None:
            # some builds nest differently
            frames = data.get('frames') or []
            if frames:
                vals = [fr.get('metrics', {}).get('vmaf') for fr in frames if fr.get('metrics')]
                vals = [v for v in vals if v is not None]
                mean = sum(vals) / len(vals) if vals else None
        return float(mean) if mean is not None else None
    except Exception as e:
        log.debug('VMAF failed: %s', e)
        return None
    finally:
        try:
            os.unlink(out_path)
        except Exception:
            pass


def _ssim_score(src: str, distorted: str) -> Optional[float]:
    if not _flag('ff_season_qc_ssim', True):
        return None
    try:
        import cv2
        import numpy as np
    except Exception:
        return None
    if not (os.path.isfile(src) and os.path.isfile(distorted)):
        return None
    cap_a = cv2.VideoCapture(src)
    cap_b = cv2.VideoCapture(distorted)
    scores = []
    for _ in range(6):
        oka, fa = cap_a.read()
        okb, fb = cap_b.read()
        if not (oka and okb):
            break
        ga = cv2.cvtColor(cv2.resize(fa, (360, 640)), cv2.COLOR_BGR2GRAY)
        gb = cv2.cvtColor(cv2.resize(fb, (360, 640)), cv2.COLOR_BGR2GRAY)
        # OpenCV SSIM if available; else correlation proxy
        try:
            score, _ = cv2.quality.QualitySSIM_compute(ga, gb)  # type: ignore
            scores.append(float(score[0]))
        except Exception:
            scores.append(float(np.corrcoef(ga.flatten(), gb.flatten())[0, 1]))
    cap_a.release()
    cap_b.release()
    if not scores:
        return None
    return sum(scores) / len(scores)


def _phash_fingerprint(path: str, frames_bgr: Optional[List[Any]] = None) -> Dict[str, Any]:
    if not _flag('ff_season_qc_phash', True):
        return {'checked': False}
    try:
        import imagehash
        from PIL import Image
        import cv2
    except Exception:
        return {'checked': False, 'reason': 'imagehash_or_pillow_missing'}

    hashes: List[str] = []
    try:
        if frames_bgr:
            for fr in frames_bgr[:5]:
                rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb)
                hashes.append(str(imagehash.phash(img)))
        else:
            return {'checked': False, 'reason': 'no_frames'}
    except Exception as e:
        return {'checked': False, 'reason': str(e)[:80]}

    if not hashes:
        return {'checked': False}
    primary = hashes[0]
    # Compare against catalog
    dupes = []
    rows = ContentFingerprint.query.order_by(ContentFingerprint.id.desc()).limit(500).all()
    for row in rows:
        try:
            dist = imagehash.hex_to_hash(primary) - imagehash.hex_to_hash(row.phash_value)
        except Exception:
            continue
        if dist <= 8:
            dupes.append({
                'content_id': row.content_id,
                'episode_id': row.episode_id,
                'distance': int(dist),
            })
    return {
        'checked': True,
        'phash': primary,
        'hashes': hashes,
        'duplicate_matches': dupes[:5],
        'ok': len(dupes) == 0,
    }


def _store_fingerprint(content_id: int, episode_id: Optional[int], phash: str, asset_kind: str):
    if not phash:
        return
    # Avoid exact duplicate rows for same episode
    existing = ContentFingerprint.query.filter_by(
        content_id=content_id, episode_id=episode_id, phash_value=phash,
    ).first()
    if existing:
        return
    db.session.add(ContentFingerprint(
        content_id=content_id,
        episode_id=episode_id,
        asset_kind=asset_kind,
        phash_value=phash,
    ))


def _resolve_local_path(url_or_key: Optional[str]) -> Optional[str]:
    if not url_or_key:
        return None
    if url_or_key.startswith('/static/'):
        try:
            from flask import current_app
            root = current_app.root_path
            candidate = os.path.join(root, url_or_key.lstrip('/').replace('/', os.sep))
            if os.path.isfile(candidate):
                return candidate
        except Exception:
            pass
    if os.path.isfile(url_or_key):
        return url_or_key
    return None


def _score_asset(
    kind: str,
    meta: Dict[str, Any],
    path: Optional[str] = None,
    content_id: Optional[int] = None,
    episode_id: Optional[int] = None,
) -> Tuple[float, str, Dict, List[str]]:
    """Score one asset with the full toolkit. kind=trailer|episode|cover|banner."""
    checks: Dict[str, Any] = {'tools_run': []}
    fails: List[str] = []
    score = 1.0
    cfg_tech = _flag('ff_season_qc_technical', True)
    cfg_vis = _flag('ff_season_qc_visual', True)
    cfg_aud = _flag('ff_season_qc_audio', True)
    cfg_int = _flag('ff_season_qc_integrity', True)

    if path and cfg_tech:
        probed = _ffprobe_meta(path)
        if probed:
            meta = {**meta, **{k: v for k, v in probed.items() if v}}
            checks['tools_run'].append('ffprobe')
            checks['ffprobe'] = {k: probed[k] for k in probed if k != 'fps'}

    duration = int(meta.get('duration_seconds') or 0)
    width = int(meta.get('width') or 0)
    height = int(meta.get('height') or 0)

    # --- Stage 1 technical ---
    if kind in ('trailer', 'episode') and cfg_tech:
        if kind == 'trailer':
            lo, hi = 15, 60  # Specs: 15–60 seconds (not 1–2 min)
        else:
            lo, hi = 240, 300  # Specs: 4–5 minutes only
        if duration <= 0:
            checks['duration'] = {'ok': False, 'band': 'poor', 'value': duration}
            fails.append(f'{kind}: missing duration')
            score -= 0.35
        elif duration < lo or duration > hi:
            checks['duration'] = {'ok': False, 'band': 'poor', 'value': duration, 'band_s': [lo, hi]}
            fails.append(f'{kind}: duration {duration}s outside {lo}-{hi}s')
            score -= 0.3
        else:
            checks['duration'] = {'ok': True, 'band': 'excellent', 'value': duration}

        codec = (meta.get('codec') or '').lower()
        if codec and codec not in ('h264', 'avc1', 'hev1', 'h265', 'hevc'):
            checks['codec'] = {'ok': False, 'band': 'borderline', 'value': codec}
            fails.append(f'{kind}: prefer H.264/H.265 (got {codec})')
            score -= 0.08
        elif codec:
            checks['codec'] = {'ok': True, 'band': 'good', 'value': codec}

        if width and height:
            ratio = width / float(height)
            vertical = abs(ratio - 9 / 16) <= 0.06
            landscape = abs(ratio - 16 / 9) <= 0.06
            aspect_ok = vertical or landscape
            if vertical:
                res_ok = width >= 720 and height >= 1280
                pref = width >= 1080 and height >= 1920
                orient = '9:16'
            elif landscape:
                res_ok = width >= 1280 and height >= 720
                pref = width >= 1920 and height >= 1080
                orient = '16:9'
            else:
                res_ok = False
                pref = False
                orient = f'{width}x{height}'
            if not aspect_ok:
                checks['aspect'] = {'ok': False, 'band': 'poor', 'w': width, 'h': height}
                fails.append(f'{kind}: must be 9:16 vertical or 16:9 landscape')
                score -= 0.35
            elif not res_ok:
                checks['resolution'] = {
                    'ok': False, 'band': 'borderline', 'w': width, 'h': height, 'orient': orient,
                }
                fails.append(f'{kind}: resolution below minimum for {orient}')
                score -= 0.2
            else:
                checks['resolution'] = {
                    'ok': True,
                    'band': 'excellent' if pref else 'good',
                    'w': width, 'h': height,
                    'orient': orient,
                }
                checks['aspect'] = {'ok': True, 'band': 'good', 'orient': orient}
        else:
            checks['resolution'] = {'ok': None, 'band': 'borderline', 'reason': 'not_probed'}
            score -= 0.08

    frames_bgr = None
    # --- Stages 2–3 visual ---
    if kind in ('trailer', 'episode') and cfg_vis and path:
        vis = _opencv_visual(path)
        frames_bgr = vis.pop('_frames', None) if isinstance(vis, dict) else None
        checks['visual'] = {k: v for k, v in vis.items() if k != '_frames'}
        if vis.get('opencv'):
            checks['tools_run'].append('opencv')
            if vis.get('scene_aware'):
                checks['tools_run'].append('pyscenedetect')
            sharp = float(vis.get('sharpness') or 0)
            bright = float(vis.get('brightness') or 0)
            contrast = float(vis.get('contrast') or 0)
            shake = float(vis.get('shake') or 0)
            # Phone-friendly thresholds — score output, not cinema cameras
            if sharp < 28:
                fails.append(f'{kind}: footage too soft/blurry — clean lens, more light, tap to focus')
                score -= 0.25
                checks['sharpness_band'] = 'poor'
            elif sharp < 55:
                score -= 0.06
                checks['sharpness_band'] = 'borderline'
            else:
                checks['sharpness_band'] = 'good' if sharp < 120 else 'excellent'
            if bright < 28 or bright > 230:
                fails.append(f'{kind}: exposure too dark or blown out — face a window / avoid harsh backlight')
                score -= 0.15
                checks['exposure_band'] = 'poor'
            else:
                checks['exposure_band'] = 'good'
            if contrast < 12:
                fails.append(f'{kind}: flat/lifeless contrast — add a bit more light on faces')
                score -= 0.06
                checks['contrast_band'] = 'borderline'
            # Phone-friendly: light handheld is OK; only unwatchable shake is Poor
            if shake > 14.0:
                fails.append(f'{kind}: camera shake too high — brace phone or use a simple tripod/stand')
                score -= 0.15
                checks['stability_band'] = 'poor'
            elif shake > 9.0:
                score -= 0.04
                checks['stability_band'] = 'borderline'
            else:
                checks['stability_band'] = 'good'

        wm = _watermark_corners(frames_bgr or [])
        checks['watermark'] = {k: v for k, v in wm.items()}
        if wm.get('checked'):
            checks['tools_run'].append('watermark')
        if wm.get('suspect_watermark'):
            fails.append(f'{kind}: possible platform watermark in corner — re-export clean')
            score -= 0.3

        # AI visual safety (Gemini free) — romance OK; explicit genitals hard-fail
        try:
            from .episio_visual_safety import check_visual_safety
            safety = check_visual_safety(path=path, frames_bgr=frames_bgr or [], kind=kind)
            checks['ai_safety'] = {k: v for k, v in safety.items() if k != 'frames'}
            if safety.get('checked'):
                checks['tools_run'].append('ai_safety')
            if safety.get('hard_fail'):
                fails.append(
                    f'{kind}: explicit sexual content with genitals detected — not allowed '
                    f'({safety.get("reason") or "remove explicit shots"})'
                )
                score -= 0.5
                checks['ai_safety_band'] = 'poor'
            elif safety.get('founder_attention'):
                score -= 0.05
                checks['ai_safety_band'] = 'borderline'
                checks['founder_attention'] = True
            elif safety.get('checked'):
                checks['ai_safety_band'] = 'good'
        except Exception as e:
            checks['ai_safety'] = {'checked': False, 'error': str(e)[:120]}

        bf = _ffmpeg_black_freeze(path)
        checks['black_freeze'] = bf
        if bf.get('checked'):
            checks['tools_run'].append('blackdetect')
            if not bf.get('ok'):
                fails.append(f'{kind}: black/frozen frames detected')
                score -= 0.2

        # VMAF + SSIM vs delivery proxy (Netflix integrity use)
        proxy = None
        try:
            if _flag('ff_season_qc_vmaf', True) or _flag('ff_season_qc_ssim', True):
                proxy = _make_delivery_proxy(path)
            if proxy and _flag('ff_season_qc_vmaf', True):
                vmaf = _vmaf_score(path, proxy)
                if vmaf is not None:
                    checks['tools_run'].append('vmaf')
                    checks['vmaf'] = {'score': round(vmaf, 2), 'source': 'delivery_proxy'}
                    # Netflix bands: 80+ excellent, 60–79 good, 40–59 borderline, <40 poor
                    if vmaf < 40:
                        fails.append(f'{kind}: VMAF {vmaf:.0f} — video quality below threshold')
                        score -= 0.35
                        checks['vmaf_band'] = 'poor'
                    elif vmaf < 60:
                        fails.append(f'{kind}: VMAF {vmaf:.0f} — quality borderline — re-export cleaner')
                        score -= 0.12
                        checks['vmaf_band'] = 'borderline'
                    elif vmaf < 80:
                        checks['vmaf_band'] = 'good'
                    else:
                        checks['vmaf_band'] = 'excellent'
                else:
                    checks['vmaf'] = {'score': None, 'note': 'libvmaf unavailable or failed — skipped'}
            if proxy and _flag('ff_season_qc_ssim', True):
                ssim = _ssim_score(path, proxy)
                if ssim is not None:
                    checks['tools_run'].append('ssim')
                    checks['ssim'] = {'score': round(ssim, 3)}
                    if ssim < 0.75:
                        fails.append(f'{kind}: SSIM {ssim:.2f} — structural quality weak after delivery encode')
                        score -= 0.15
                        checks['ssim_band'] = 'poor'
                    elif ssim < 0.88:
                        score -= 0.05
                        checks['ssim_band'] = 'borderline'
                    else:
                        checks['ssim_band'] = 'good'
        finally:
            if proxy:
                try:
                    os.unlink(proxy)
                except Exception:
                    pass

    # --- Stage 4 audio ---
    if kind in ('trailer', 'episode') and cfg_aud and path:
        aud = _ffmpeg_audio_loudness(path)
        checks['audio'] = aud
        if aud.get('ebur128'):
            checks['tools_run'].append('ebur128')
            lufs = float(aud['integrated_lufs'])
            if lufs < -28 or lufs > -6:
                fails.append(f'{kind}: audio loudness out of range ({lufs:.1f} LUFS)')
                score -= 0.2
                checks['loudness_band'] = 'poor'
            elif lufs < -24 or lufs > -8:
                score -= 0.06
                checks['loudness_band'] = 'borderline'
            else:
                checks['loudness_band'] = 'good'
            peak = aud.get('true_peak_dbfs')
            if peak is not None and peak > -1.0:
                fails.append(f'{kind}: audio clipping / true peak too hot')
                score -= 0.1

        vad = _webrtc_vad_dialogue(path)
        checks['dialogue_vad'] = {k: v for k, v in vad.items()}
        if vad.get('checked'):
            checks['tools_run'].append('webrtcvad')
            # Trailers: looser dialogue expectation
            min_speech = 0.04 if kind == 'trailer' else 0.08
            if float(vad.get('speech_ratio') or 0) < min_speech:
                fails.append(f'{kind}: little/no dialogue detected — voices may be missing or buried')
                score -= 0.18
                checks['dialogue_band'] = 'poor'
            elif int(vad.get('long_silence_gaps') or 0) > (8 if kind == 'trailer' else 12):
                fails.append(f'{kind}: long silence gaps — possible edit mistake')
                score -= 0.1
                checks['dialogue_band'] = 'borderline'
            else:
                checks['dialogue_band'] = 'good'

    # --- Stage 5 integrity / duplicates ---
    if kind in ('trailer', 'episode') and cfg_int:
        mood = (meta.get('mood_label') or '').lower()
        if mood in ('meme', 'tiktok_noise', 'low_effort'):
            fails.append(f'{kind}: export style not acceptable')
            score -= 0.25
        if float(meta.get('black_frame_ratio') or 0) > 0.15 and 'black_freeze' not in checks:
            fails.append(f'{kind}: too many black/frozen frames (upload meta)')
            score -= 0.2

        if path and frames_bgr:
            ph = _phash_fingerprint(path, frames_bgr)
            checks['phash'] = {k: v for k, v in ph.items() if k != 'hashes'}
            if ph.get('checked'):
                checks['tools_run'].append('phash')
                if not ph.get('ok'):
                    fails.append(f'{kind}: possible duplicate/stolen match in catalog')
                    score -= 0.4
                    checks['duplicate_band'] = 'poor'
                else:
                    checks['duplicate_band'] = 'good'
                if content_id and ph.get('phash'):
                    _store_fingerprint(content_id, episode_id, ph['phash'], kind)
        checks['integrity'] = {'ok': len(fails) == 0, 'band': 'good' if not fails else 'borderline'}

    if kind in ('cover', 'banner'):
        if meta.get('present'):
            checks['present'] = {'ok': True, 'band': 'good'}
        else:
            fails.append(f'{kind} missing')
            score -= 0.5
            checks['present'] = {'ok': False, 'band': 'poor'}

    score = max(0.0, min(1.0, score))
    band = _band_from_score(score)
    if fails and band in ('excellent', 'good'):
        band = 'borderline'
    # Hard creator-facing fails: aspect, duration, watermark, VMAF, stolen, explicit safety.
    if any('must be 9:16' in f or '16:9' in f or 'missing duration' in f or 'outside' in f for f in fails):
        if score < 0.4:
            band = 'poor'
    if any('VMAF' in f and ('below threshold' in f or 'borderline' in f) for f in fails):
        if any('below threshold' in f for f in fails):
            band = 'poor'
    if any('watermark' in f for f in fails):
        band = 'poor' if score < 0.45 else 'borderline'
    if any('explicit sexual' in f or 'genitals' in f for f in fails):
        band = 'poor'
    if any('duplicate/stolen' in f for f in fails):
        band = 'poor'
    return score, band, checks, fails


def enqueue_season_qc(content: Content) -> SeasonQualityJob:
    job = SeasonQualityJob(
        content_id=content.id,
        status='queued',
        summary_json='{}',
    )
    db.session.add(job)
    content.season_qc_status = 'queued'
    db.session.flush()
    return job


def run_season_qc_job(job_id: int) -> SeasonQualityJob:
    """Process trailer + all ready episodes + cover/banner through full toolkit."""
    job = SeasonQualityJob.query.get(job_id)
    if not job:
        raise ValueError('job not found')
    content = Content.query.get(job.content_id)
    if not content:
        job.status = 'failed'
        job.failure_reasons = 'series missing'
        db.session.commit()
        return job

    if not pipeline_enabled():
        job.status = 'passed'
        job.overall_band = 'good'
        job.overall_score = 1.0
        job.summary_json = json.dumps({'pipeline': 'off', 'note': 'Founder turned pipeline OFF — skipped auto QC'})
        job.completed_at = datetime.utcnow()
        content.season_qc_status = 'passed'
        db.session.commit()
        return job

    job.status = 'running'
    job.started_at = datetime.utcnow()
    db.session.commit()

    SeasonAssetQualityReport.query.filter_by(job_id=job.id).delete()

    asset_bands: List[str] = []
    all_fails: List[str] = []
    passed = failed = borderline = 0
    tools_seen: List[str] = []

    def _save_asset(kind, episode, score, band, checks, fails):
        nonlocal passed, failed, borderline
        ep_id = episode.id if episode else None
        ep_num = episode.episode_number if episode else None
        status = 'passed' if band in ('excellent', 'good') else ('borderline' if band == 'borderline' else 'failed')
        if status == 'passed':
            passed += 1
        elif status == 'borderline':
            borderline += 1
        else:
            failed += 1
        asset_bands.append(band)
        all_fails.extend(fails)
        for t in checks.get('tools_run') or []:
            if t not in tools_seen:
                tools_seen.append(t)
        row = SeasonAssetQualityReport(
            job_id=job.id,
            content_id=content.id,
            asset_kind=kind,
            episode_id=ep_id,
            episode_number=ep_num,
            status=status,
            band=band,
            score=score,
            checks_json=json.dumps(checks),
            failure_reasons='; '.join(fails),
        )
        db.session.add(row)
        if episode:
            episode.asset_qc_status = status
            episode.asset_qc_band = band

    try:
        cover_present = bool(content.cover_url or content.poster_url or content.cover_file_id)
    except Exception:
        cover_present = bool(getattr(content, 'poster_url', None))
    score, band, checks, fails = _score_asset('cover', {'present': cover_present}, content_id=content.id)
    _save_asset('cover', None, score, band, checks, fails)

    banner_present = bool(getattr(content, 'banner_url', None) or getattr(content, 'poster_url', None) or cover_present)
    score, band, checks, fails = _score_asset('banner', {'present': banner_present}, content_id=content.id)
    _save_asset('banner', None, score, band, checks, fails)

    trailer_meta = {
        'duration_seconds': int(getattr(content, 'trailer_duration_seconds', 0) or 0),
        'width': 1080,
        'height': 1920,
    }
    trailer_path = _resolve_local_path(
        getattr(content, 'trailer_url', None) or getattr(content, 'trailer_storage_key', None)
    )
    score, band, checks, fails = _score_asset(
        'trailer', trailer_meta, trailer_path, content_id=content.id,
    )
    _save_asset('trailer', None, score, band, checks, fails)
    content.trailer_qa_status = 'passed' if band in ('excellent', 'good') else (
        'needs_review' if band == 'borderline' else 'failed'
    )
    content.trailer_qa_score = score

    episodes = (
        Episode.query.filter_by(content_id=content.id)
        .order_by(Episode.episode_number.asc())
        .all()
    )
    founder_attention_hits = 0
    for ep in episodes:
        probe = {}
        try:
            probe = json.loads(ep.upload_probe_json or '{}')
        except Exception:
            probe = {}
        meta = {
            'duration_seconds': int(ep.duration_seconds or probe.get('duration_seconds') or 0),
            'width': int(probe.get('width') or 0),
            'height': int(probe.get('height') or 0),
            'bitrate_kbps': int(probe.get('bitrate_kbps') or 0),
            'black_frame_ratio': float(probe.get('black_frame_ratio') or 0),
            'mood_label': probe.get('mood_label') or 'serious',
            'codec': probe.get('codec'),
        }
        path = _resolve_local_path(ep.video_url or ep.hls_manifest_url)
        score, band, checks, fails = _score_asset(
            'episode', meta, path, content_id=content.id, episode_id=ep.id,
        )
        if checks.get('founder_attention') or (checks.get('ai_safety') or {}).get('founder_attention'):
            founder_attention_hits += 1
        _save_asset('episode', ep, score, band, checks, fails)

    overall_band = _worst_band(asset_bands) if asset_bands else 'poor'
    overall_score = sum(
        {'excellent': 1.0, 'good': 0.75, 'borderline': 0.5, 'poor': 0.2}.get(b, 0) for b in asset_bands
    ) / max(1, len(asset_bands))

    auto_reject = _flag('ff_season_qc_auto_reject_poor', True)
    auto_clear = _flag('ff_season_qc_auto_clear_good', False)
    # Founder-first: never push Needs Changes to creators until founder decides or SLA fires.
    founder_first = _flag('ff_season_qc_founder_first', True)
    # System must flag + pull founder attention; never silent-pass safety concerns
    needs_founder_eye = overall_band in ('poor', 'borderline') or founder_attention_hits > 0

    if overall_band == 'poor' and auto_reject and not founder_first:
        job.status = 'failed'
        content.season_qc_status = 'failed'
        content.review_status = 'revision_requested'
    elif overall_band in ('excellent', 'good') and auto_clear and not needs_founder_eye:
        job.status = 'passed'
        content.season_qc_status = 'passed'
        content.review_status = 'under_review'
    elif founder_first and needs_founder_eye:
        # Hold for founder/team final check — creator stays "in review"
        job.status = 'borderline' if overall_band == 'borderline' else ('failed' if overall_band == 'poor' else 'borderline')
        content.season_qc_status = 'pending_founder'
        content.review_status = 'under_review'
    elif overall_band == 'borderline' or (overall_band in ('excellent', 'good') and not auto_clear):
        job.status = 'borderline'
        content.season_qc_status = 'needs_changes' if overall_band == 'borderline' else 'pending'
        content.review_status = 'under_review'
    else:
        job.status = 'borderline'
        content.season_qc_status = 'pending'
        content.review_status = 'under_review'

    job.overall_band = overall_band
    job.overall_score = overall_score
    job.assets_total = len(asset_bands)
    job.assets_passed = passed
    job.assets_failed = failed
    job.assets_borderline = borderline
    job.failure_reasons = '; '.join(all_fails[:40])

    # Draft fix cards for founder — only publish to creator review_change_items when not founder-first
    draft_items = []
    if content.season_qc_status in ('failed', 'needs_changes', 'pending_founder') or overall_band in ('poor', 'borderline'):
        for a in SeasonAssetQualityReport.query.filter_by(job_id=job.id).all():
            if (a.status or '') not in ('failed', 'borderline'):
                continue
            kind = (a.asset_kind or 'episode').lower()
            if kind == 'episode' and a.episode_number:
                title = f'Episode {a.episode_number} needs a fix'
                fix = 'episodes'
            elif kind == 'trailer':
                title = 'Trailer needs a fix'
                fix = 'trailer'
            else:
                title = f'{kind.title()} needs a fix'
                fix = 'cover' if kind in ('cover', 'banner') else 'episodes'
            draft_items.append({
                'tag': kind.upper(),
                'title': title,
                'text': (a.failure_reasons or 'Re-export and re-upload.').strip(),
                'fix_target': fix,
                'episode_id': a.episode_id,
                'episode_number': a.episode_number,
                'band': a.band,
            })
        if draft_items and not founder_first:
            content.review_change_items = json.dumps(draft_items)

    timing = estimate_season_review(len(episodes), has_trailer=True)
    job.summary_json = json.dumps({
        'pipeline': 'on',
        'checks_trailer_and_all_episodes': True,
        'overall_band': overall_band,
        'episodes_checked': len(episodes),
        'tools_run': tools_seen,
        'tool_catalog': review_tool_catalog(),
        'timing': timing,
        'founder_first': founder_first,
        'founder_attention_hits': founder_attention_hits,
        'draft_change_items': draft_items,
        'flags': {
            'technical': _flag('ff_season_qc_technical', True),
            'visual': _flag('ff_season_qc_visual', True),
            'audio': _flag('ff_season_qc_audio', True),
            'vmaf': _flag('ff_season_qc_vmaf', True),
            'ssim': _flag('ff_season_qc_ssim', True),
            'scenedetect': _flag('ff_season_qc_scenedetect', True),
            'vad': _flag('ff_season_qc_vad', True),
            'phash': _flag('ff_season_qc_phash', True),
            'watermark': _flag('ff_season_qc_watermark', True),
            'blackdetect': _flag('ff_season_qc_blackdetect', True),
            'integrity': _flag('ff_season_qc_integrity', True),
            'ai_safety': _flag('ff_season_qc_ai_safety', True),
        },
    })
    job.completed_at = datetime.utcnow()
    db.session.commit()

    if founder_first and needs_founder_eye:
        try:
            from .platform_notify import notify_episio_qc_flags_ready
            notify_episio_qc_flags_ready(
                getattr(content, 'title', None) or f'Series {content.id}',
                content.id,
                overall_band,
                len(draft_items) or founder_attention_hits,
            )
        except Exception:
            pass

    return job


def process_queued_jobs(limit: int = 5) -> int:
    if not pipeline_enabled():
        # Still process SLA auto-decide even if QC master is OFF
        try:
            from .season_sla_auto import process_expired_review_slas
            process_expired_review_slas(limit=40)
        except Exception:
            pass
        return 0
    rows = (
        SeasonQualityJob.query.filter_by(status='queued')
        .order_by(SeasonQualityJob.id.asc())
        .limit(limit)
        .all()
    )
    n = 0
    for job in rows:
        try:
            run_season_qc_job(job.id)
            n += 1
        except Exception as e:
            log.exception('season QC job %s failed: %s', job.id, e)
            job.status = 'failed'
            job.failure_reasons = str(e)[:500]
            job.completed_at = datetime.utcnow()
            c = Content.query.get(job.content_id)
            if c:
                c.season_qc_status = 'failed'
            db.session.commit()
    try:
        from .season_sla_auto import process_expired_review_slas
        process_expired_review_slas(limit=40)
    except Exception as e:
        log.exception('SLA auto-decide failed: %s', e)
    return n
