"""
Cover Image Scanner — Phase 5 (Improved)
Validates cover uploads: format, dimensions, file size, NSFW detection, duplicate hash.

IMPORTANT: The skin-pixel approach alone is NOT reliable for NSFW detection on book
covers. Book covers legitimately feature people of all skin tones, warm color palettes,
and artistic illustrations. The previous algorithm (Phase 4) had an extremely high
false-positive rate — flagging normal covers as "pornographic".

Phase 5 changes:
  - Switched to proper HSV-based skin detection (much more accurate).
  - Added edge-density analysis: covers with lots of text/graphics have high edge density
    and are almost never NSFW.
  - Added color-variance check: uniform large skin regions vs. varied textures.
  - Raised thresholds dramatically: 55% skin + low edge density = flag, 75%+ = severe.
  - The scanner now only flags truly extreme cases. Borderline cases are logged but allowed.
  - Removed aggressive "pornographic" language from error messages.

Uses only Pillow (already installed) — no external AI APIs needed.
"""
import hashlib
import logging
import math
from io import BytesIO

from PIL import Image, ImageFilter

log = logging.getLogger(__name__)

# --- Config ---
MAX_FILE_SIZE_MB = 5
MIN_WIDTH = 400
MIN_HEIGHT = 600
MAX_WIDTH = 4000
MAX_HEIGHT = 6000

# Skin ratio thresholds — only trigger AFTER edge-density adjustment
SKIN_THRESHOLD = 0.55        # 55% adjusted skin = flag for review (not auto-reject)
SKIN_SEVERE_THRESHOLD = 0.75  # 75%+ adjusted = reject and warn

# Edge density: book covers with text/graphics typically have >15% edge pixels
EDGE_DENSITY_SAFE = 0.12  # Covers with 12%+ edge density are almost certainly safe


def validate_cover(file_stream):
    """
    Full cover validation pipeline.
    file_stream: file-like object (e.g. request.files['cover'])
    Returns: {
        'valid': bool,
        'error': str or None,
        'nsfw': bool,
        'skin_ratio': float,
        'hash': str,
        'width': int,
        'height': int,
    }
    """
    result = {
        'valid': True,
        'error': None,
        'nsfw': False,
        'skin_ratio': 0.0,
        'hash': '',
        'width': 0,
        'height': 0,
    }

    # Read file bytes
    file_stream.seek(0)
    data = file_stream.read()
    file_stream.seek(0)  # Reset for later use

    # 1. File size check
    size_mb = len(data) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        result['valid'] = False
        result['error'] = f'Image too large ({size_mb:.1f}MB). Maximum is {MAX_FILE_SIZE_MB}MB.'
        return result

    # 2. Open and validate image
    try:
        img = Image.open(BytesIO(data))
        img.verify()
        img = Image.open(BytesIO(data))
    except Exception as e:
        result['valid'] = False
        result['error'] = 'Invalid or corrupted image file.'
        return result

    # 3. Format check
    if img.format and img.format.upper() not in ('PNG', 'JPEG', 'JPG', 'GIF', 'WEBP'):
        result['valid'] = False
        result['error'] = f'Unsupported image format: {img.format}. Use PNG, JPG, GIF, or WebP.'
        return result

    # 4. Dimension check
    w, h = img.size
    result['width'] = w
    result['height'] = h

    if w < MIN_WIDTH or h < MIN_HEIGHT:
        result['valid'] = False
        result['error'] = f'Image too small ({w}x{h}). Minimum is {MIN_WIDTH}x{MIN_HEIGHT}.'
        return result

    if w > MAX_WIDTH or h > MAX_HEIGHT:
        result['valid'] = False
        result['error'] = f'Image too large ({w}x{h}). Maximum is {MAX_WIDTH}x{MAX_HEIGHT}.'
        return result

    # 4b. Aspect ratio check — must be portrait (2:3 ± tolerance)
    ratio = w / h
    target_ratio = 2 / 3  # 0.667
    if abs(ratio - target_ratio) > 0.15:
        result['valid'] = False
        result['error'] = f'Wrong aspect ratio ({w}x{h}). Cover must be portrait (2:3 ratio). Use 600×900px. Try a Canva Book Cover template.'
        return result

    # 5. Compute hash for duplicate detection
    result['hash'] = hashlib.sha256(data).hexdigest()

    # 6. Multi-factor NSFW analysis
    analysis = _analyze_cover_content(img)
    result['skin_ratio'] = analysis['raw_skin_ratio']

    if analysis['flagged']:
        result['nsfw'] = True
        result['valid'] = False
        result['severe'] = analysis['severe']
        if analysis['severe']:
            result['error'] = (
                'This cover image has been flagged by our content safety system. '
                'Please use a different cover image that meets our community guidelines. '
                'If you believe this is an error, please contact support.'
            )
        else:
            result['error'] = (
                'This cover image was flagged by our content safety review. '
                'Please try a different image. If you believe this is a mistake, '
                'contact support and we will review it manually.'
            )
    elif analysis['raw_skin_ratio'] > 0.40:
        # Log borderline cases for manual review but ALLOW the upload
        log.info(
            "Cover scan borderline: skin=%.2f edge=%.2f adjusted=%.2f — ALLOWED",
            analysis['raw_skin_ratio'], analysis['edge_density'],
            analysis['adjusted_skin_ratio']
        )

    return result


def _analyze_cover_content(img):
    """
    Multi-factor content analysis for book covers.
    Combines skin detection, edge density, and color variance to reduce false positives.
    """
    result = {
        'raw_skin_ratio': 0.0,
        'edge_density': 0.0,
        'adjusted_skin_ratio': 0.0,
        'flagged': False,
        'severe': False,
    }

    try:
        # Resize for analysis (200px max dimension for speed)
        max_dim = 200
        scale = max_dim / max(img.size)
        if scale < 1:
            new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
            img_small = img.resize(new_size, Image.LANCZOS)
        else:
            img_small = img.copy()

        img_rgb = img_small.convert('RGB')

        # --- Factor 1: Skin pixel ratio (improved HSV-based) ---
        raw_skin = _detect_skin_ratio_hsv(img_rgb)
        result['raw_skin_ratio'] = raw_skin

        # --- Factor 2: Edge density (text/graphics detection) ---
        edge_density = _compute_edge_density(img_small)
        result['edge_density'] = edge_density

        # --- Factor 3: Color variance (uniform skin vs. varied art) ---
        color_variance = _compute_color_variance(img_rgb)

        # --- Combine factors ---
        # If the cover has high edge density (text, graphics), it's almost certainly
        # a designed book cover, not a problematic photo. Reduce skin score.
        adjusted = raw_skin
        if edge_density >= EDGE_DENSITY_SAFE:
            # High edge density = lots of text/graphics → reduce risk score by 40%
            adjusted *= 0.6
        if edge_density >= 0.20:
            # Very high edge density → reduce by 60%
            adjusted *= 0.5

        # High color variance = artistic/illustrated cover → reduce risk
        if color_variance > 3000:
            adjusted *= 0.7

        result['adjusted_skin_ratio'] = round(adjusted, 3)

        # Only flag if adjusted ratio exceeds threshold
        if adjusted >= SKIN_THRESHOLD:
            result['flagged'] = True
            result['severe'] = adjusted >= SKIN_SEVERE_THRESHOLD

    except Exception as e:
        log.warning("Cover content analysis error: %s", str(e)[:120])

    return result


def _detect_skin_ratio_hsv(img_rgb):
    """
    Detect skin-toned pixels using HSV color space — much more accurate than
    pure RGB rules. HSV separates color (hue) from brightness, which makes it
    robust across different skin tones from light to dark.
    """
    try:
        img_hsv = img_rgb.convert('HSV')
        pixels_rgb = list(img_rgb.getdata())
        pixels_hsv = list(img_hsv.getdata())

        total = len(pixels_rgb)
        if total == 0:
            return 0.0

        skin_count = 0

        for (r, g, b), (h, s, v) in zip(pixels_rgb, pixels_hsv):
            # Pillow HSV: H=0-255 (mapped from 0-360), S=0-255, V=0-255
            # Skin hue range: roughly 0-50° in 360° scale → 0-35 in Pillow's 0-255 scale
            # Plus the red wrap-around at ~340-360° → 240-255 in Pillow scale

            hue_ok = (h <= 35) or (h >= 240)

            # Saturation: skin has moderate saturation (not gray, not neon)
            # For light skin: S 30-170, for dark skin: S 20-160
            sat_ok = 15 <= s <= 180

            # Value/brightness: not too dark (shadows) and not blown out
            val_ok = 40 <= v <= 240

            # Additional RGB sanity checks to filter out non-skin warm colors
            # (wooden textures, leather, food, sunsets, etc.)
            rgb_ok = (
                r > 50 and g > 25 and b > 15 and  # Not too dark
                r > b and                            # Red channel dominant
                abs(r - g) > 8 and                   # Not gray
                max(r, g, b) - min(r, g, b) > 20     # Has color spread
            )

            # Exclude common false positives:
            # - Pure reds/oranges (sunset, fire) → very high saturation
            # - Browns (leather, wood) → low saturation + specific hue
            # - Yellows (gold, parchment) → hue too high
            not_false_positive = True
            if s > 170:  # Very saturated = not skin (neon, sunset, etc.)
                not_false_positive = False
            if v < 50:  # Very dark = shadow, not skin
                not_false_positive = False
            if h > 25 and h < 240:  # Outside skin hue range
                not_false_positive = False

            if hue_ok and sat_ok and val_ok and rgb_ok and not_false_positive:
                skin_count += 1

        return round(skin_count / total, 3)

    except Exception as e:
        log.warning("HSV skin detection error: %s", str(e)[:100])
        return 0.0


def _compute_edge_density(img):
    """
    Compute edge density — ratio of edge pixels to total pixels.
    Book covers with text, titles, borders, and graphic elements have high edge density.
    A plain photo of a person has very low edge density.
    """
    try:
        gray = img.convert('L')
        edges = gray.filter(ImageFilter.FIND_EDGES)
        pixels = list(edges.getdata())
        total = len(pixels)
        if total == 0:
            return 0.0
        # Count pixels with significant edge response (threshold: 30 out of 255)
        edge_count = sum(1 for p in pixels if p > 30)
        return round(edge_count / total, 3)
    except Exception as e:
        log.warning("Edge density error: %s", str(e)[:80])
        return 0.0


def _compute_color_variance(img_rgb):
    """
    Compute color variance across the image.
    Artistic/illustrated covers have high variance; plain photos of skin have lower variance.
    Returns a variance score (higher = more varied colors).
    """
    try:
        pixels = list(img_rgb.getdata())
        if len(pixels) < 10:
            return 0.0

        # Sample every 4th pixel for speed
        sample = pixels[::4]
        n = len(sample)

        avg_r = sum(p[0] for p in sample) / n
        avg_g = sum(p[1] for p in sample) / n
        avg_b = sum(p[2] for p in sample) / n

        var_r = sum((p[0] - avg_r) ** 2 for p in sample) / n
        var_g = sum((p[1] - avg_g) ** 2 for p in sample) / n
        var_b = sum((p[2] - avg_b) ** 2 for p in sample) / n

        return round(var_r + var_g + var_b, 1)
    except Exception as e:
        log.warning("Color variance error: %s", str(e)[:80])
        return 0.0


STANDARD_WIDTH = 600
STANDARD_HEIGHT = 900


def normalize_cover(file_bytes, content_type='image/jpeg'):
    """
    Resize any cover image to a uniform 600x900 (2:3 portrait) size.
    Uses center-crop + resize to avoid distortion.
    Returns: (new_bytes, content_type)
    """
    try:
        img = Image.open(BytesIO(file_bytes))
        img = img.convert('RGB')

        # Calculate crop box to get 2:3 aspect ratio from center
        src_w, src_h = img.size
        target_ratio = STANDARD_WIDTH / STANDARD_HEIGHT  # 0.667

        src_ratio = src_w / src_h
        if src_ratio > target_ratio:
            # Image is wider than target — crop sides
            new_w = int(src_h * target_ratio)
            offset = (src_w - new_w) // 2
            img = img.crop((offset, 0, offset + new_w, src_h))
        elif src_ratio < target_ratio:
            # Image is taller than target — crop top/bottom
            new_h = int(src_w / target_ratio)
            offset = (src_h - new_h) // 2
            img = img.crop((0, offset, src_w, offset + new_h))

        # Resize to standard dimensions
        img = img.resize((STANDARD_WIDTH, STANDARD_HEIGHT), Image.LANCZOS)

        # Save to bytes
        output = BytesIO()
        fmt = 'JPEG'
        if 'png' in content_type.lower():
            fmt = 'PNG'
        elif 'webp' in content_type.lower():
            fmt = 'WEBP'
        img.save(output, format=fmt, quality=90)
        return output.getvalue(), content_type
    except Exception as e:
        log.warning("Cover normalize error: %s", str(e)[:100])
        return file_bytes, content_type


def issue_cover_strike(user_id, skin_ratio, severe=False):
    """
    Issue a content guard warning/strike for inappropriate cover upload.
    Severe (75%+ adjusted) = immediate strike. Moderate (55-75%) = escalating warning.
    Founders are exempt.
    """
    try:
        from .content_guard import _is_founder, issue_warning
        if _is_founder(user_id):
            log.info("Skipping cover strike for founder user_id=%s", user_id)
            return None, False

        severity = 'strike' if severe else 'warning'
        message = (
            f'Book cover flagged by content safety system '
            f'(confidence: {skin_ratio:.0%}). '
            f'{"Severe — automatic strike issued." if severe else "Review warning issued."}'
        )
        warning, was_banned = issue_warning(
            user_id=user_id,
            category='nsfw_cover',
            message=message,
            severity=severity,
            issued_by=0,
        )
        log.warning(
            "Cover safety flag: user_id=%s score=%.2f severe=%s banned=%s",
            user_id, skin_ratio, severe, was_banned
        )
        return warning, was_banned
    except Exception as e:
        log.error("Failed to issue cover strike for user %s: %s", user_id, str(e)[:120])
        return None, False


def check_duplicate_cover(cover_hash, exclude_book_id=None):
    """
    Check if this cover hash already exists (another book using same image).
    Returns the book using this cover, or None.
    """
    from ..models import Content
    from ..extensions import db

    # We store hash in a simple way: check all covers
    # For performance, we only check books with web-uploaded covers
    books = Content.query.filter(
        Content.cover_file_id.like('web_%'),
        Content.deleted_at == None,
    ).all()

    import os
    from flask import current_app

    upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'covers')

    for book in books:
        if exclude_book_id and book.id == exclude_book_id:
            continue

        cover_filename = book.cover_file_id[4:]  # Remove 'web_' prefix
        cover_path = os.path.join(upload_dir, cover_filename)

        if os.path.exists(cover_path):
            try:
                with open(cover_path, 'rb') as f:
                    existing_hash = hashlib.sha256(f.read()).hexdigest()
                if existing_hash == cover_hash:
                    return book
            except Exception:
                continue

    return None
