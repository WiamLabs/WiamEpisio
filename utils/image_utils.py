import io
from PIL import Image

MAX_COVER_WIDTH = 600
MAX_COVER_HEIGHT = 900
JPEG_QUALITY = 85


def resize_cover(image_bytes: bytes) -> bytes:
    """Resize a cover image to fit within MAX_COVER_WIDTH x MAX_COVER_HEIGHT.
    
    Maintains aspect ratio. Returns JPEG bytes.
    If the image is already within limits, it is still re-encoded
    as JPEG to ensure consistent format and compression.
    """
    img = Image.open(io.BytesIO(image_bytes))

    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    orig_w, orig_h = img.size
    if orig_w > MAX_COVER_WIDTH or orig_h > MAX_COVER_HEIGHT:
        ratio = min(MAX_COVER_WIDTH / orig_w, MAX_COVER_HEIGHT / orig_h)
        new_w = int(orig_w * ratio)
        new_h = int(orig_h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    buf.seek(0)
    return buf.read()
