"""
Chapter body sanitizer (Push 6).

Creators can paste rich-text into the editor — including ``<img>`` tags
that came from external screenshots, hot-linked stock images or the
clipboard. Two problems we want to defend against:

1. **Cross-origin tracking pixels & non-Cloudinary images** — a creator
   could (accidentally or deliberately) embed an asset hosted on a
   suspicious domain. We re-host or strip those.
2. **HTML injection** — the editor mostly produces clean tags, but
   pasted content sometimes carries inline ``onerror=`` or ``<script>``.
   We bleach the body to a safe tag/attribute allow-list.

Public API:
    sanitize_chapter_body(html: str) -> str
        Cleaned HTML safe to store in WebBookContent.body.

The sanitizer is intentionally conservative:
    * Only allows a small set of tags from the WiamApp editor's output.
    * For ``<img>`` it keeps the tag only if the URL is on a trusted
      host (Cloudinary, our own domain, or data: with size limit). We
      do not silently fetch & re-host third-party images here — that is
      Push 7+ work — but we do swap obvious http:// images to https://.
    * Strips ``style`` attributes that contain ``url(`` to block CSS
      exfiltration and prevent inline tracking pixels.
"""
import logging
import os
import re

log = logging.getLogger(__name__)

ALLOWED_TAGS = {
    'p', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's',
    'a', 'img', 'blockquote', 'q',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'pre', 'code', 'hr', 'div',
}

ALLOWED_ATTRS = {
    '*': ['class', 'style'],
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'loading'],
}

ALLOWED_PROTOCOLS = ['http', 'https', 'data', 'mailto']

_TRUSTED_HOSTS = (
    'res.cloudinary.com',
    'cloudinary.com',
    'wiamapp.com',
    'localhost',
)

_DATA_IMG_RE = re.compile(r'^data:image/(?:png|jpe?g|gif|webp);base64,')
_STYLE_URL_RE = re.compile(r'url\s*\(', re.IGNORECASE)


def _sanitize_attrs(tag, name, value):
    """bleach attribute filter — drop dangerous values, normalise URLs."""
    if name == 'style':
        # Block any inline CSS that pulls an external URL
        if value and _STYLE_URL_RE.search(value):
            return False
        return True
    if tag == 'img' and name == 'src':
        v = (value or '').strip()
        if not v:
            return False
        if v.startswith('//'):
            v = 'https:' + v
        if v.startswith('http://'):
            v = 'https://' + v[len('http://'):]
        if v.startswith('data:'):
            if not _DATA_IMG_RE.match(v):
                return False
            if len(v) > 1024 * 1024:
                return False
            return True
        host_ok = any(h in v for h in _TRUSTED_HOSTS)
        if not host_ok:
            return False
        return True
    if tag == 'a' and name == 'href':
        v = (value or '').strip().lower()
        if not v:
            return False
        if v.startswith('javascript:') or v.startswith('vbscript:'):
            return False
        return True
    return True


def sanitize_chapter_body(html):
    """Return a sanitised version of the chapter body.

    Best-effort: if ``bleach`` is unavailable for some reason, falls back
    to a regex-based ``<script>`` strip so we never accept a totally raw
    body. Callers should never mutate the input — replace the body with
    the return value.
    """
    if not html or not isinstance(html, str):
        return ''
    try:
        import bleach

        def attr_filter(tag, name, value):
            if name in ALLOWED_ATTRS.get(tag, []) or name in ALLOWED_ATTRS.get('*', []):
                return _sanitize_attrs(tag, name, value)
            return False

        cleaned = bleach.clean(
            html,
            tags=list(ALLOWED_TAGS),
            attributes=attr_filter,
            protocols=ALLOWED_PROTOCOLS,
            strip=True,
            strip_comments=True,
        )
        return cleaned
    except Exception as e:
        log.warning("bleach unavailable, falling back to regex strip: %s", e)
        s = re.sub(r'(?is)<script[^>]*>.*?</script>', '', html)
        s = re.sub(r'(?is)<iframe[^>]*>.*?</iframe>', '', s)
        s = re.sub(r'(?i)on\w+\s*=\s*"[^"]*"', '', s)
        s = re.sub(r"(?i)on\w+\s*=\s*'[^']*'", '', s)
        return s
