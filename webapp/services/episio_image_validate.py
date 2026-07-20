"""Validate Episio Studio cover / banner image uploads."""
from __future__ import annotations

import io
from typing import Tuple


def validate_poster_image(file_storage, *, kind: str = 'cover') -> Tuple[bool, str, bytes]:
    """
    kind=cover → prefer tall portrait (~2:3 to 9:16)
    kind=banner → prefer wide (~16:9) or tall promo
    Returns (ok, error_message, raw_bytes).
    """
    raw = file_storage.read()
    if hasattr(file_storage, 'seek'):
        try:
            file_storage.seek(0)
        except Exception:
            pass
    if not raw:
        return False, 'Empty file', b''
    if len(raw) > 8 * 1024 * 1024:
        return False, 'Max file size is 8 MB', b''

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(raw))
        img.load()
        w, h = img.size
    except Exception:
        return False, 'File must be a valid JPG, PNG, or WebP image', b''

    if w < 400 or h < 400:
        return False, 'Image too small — use at least 400×400', b''

    ratio = w / float(h) if h else 0
    if kind == 'cover':
        # Portrait: 9:16 ≈ 0.56, 2:3 ≈ 0.67 — allow 0.45–0.85
        if ratio > 0.95:
            return False, 'Cover must be portrait (taller than wide), ideally 9:16 or 2:3', b''
        if ratio < 0.4:
            return False, 'Cover is too narrow — use ~9:16 vertical', b''
    elif kind == 'banner':
        # Allow portrait promo or landscape strip
        if ratio < 0.4:
            return False, 'Banner aspect looks wrong — use 16:9 landscape or 9:16 promo', b''

    fmt = (img.format or '').upper()
    if fmt not in ('JPEG', 'JPG', 'PNG', 'WEBP'):
        return False, 'Use JPG, PNG, or WebP', b''

    return True, '', raw
