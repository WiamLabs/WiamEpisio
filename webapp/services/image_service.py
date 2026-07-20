"""
Cloudinary Image Service — every user-uploaded image (avatar, book cover,
voice cover, chapter inline image) goes through this module.

Storage strategy:

* All assets live in folder ``wiamapp/<kind>`` with a stable ``public_id`` so
  replacing an image overwrites the previous Cloudinary asset rather than
  leaking new ones.
* Avatars: ``wiamapp/avatars/avatar_<user_id>``
* Book covers: ``wiamapp/covers/cover_<book_id>``
* Voice covers (Push 6): ``wiamapp/voice_covers/voice_cover_<story_id>``
* Chapter inline (Push 6): ``wiamapp/chapter_inline/inline_<book>_<ch>_<hash>``

Delete-on-destroy:

* ``delete_avatar(user_id)``, ``delete_cover(book_id)``, etc. are called from
  account-delete and book-hard-delete paths so we never leave orphan assets.
* ``delete_image_url(url)`` parses any Cloudinary secure URL back to its
  public_id and destroys it — used for legacy UUID-named voice covers.

If ``CLOUDINARY_*`` env vars are unset, every helper logs a warning and
returns ``None`` / ``False``. Routes treat that as a hard failure (no silent
fallback) — see ``upload_avatar`` / ``upload_cover`` callers for 500s.
"""
import io
import logging
import os

log = logging.getLogger(__name__)

_configured = False
_cloud_name = None


def _ensure_configured():
    """Lazy-init Cloudinary SDK from env vars."""
    global _configured, _cloud_name
    if _configured:
        return bool(_cloud_name)

    _configured = True
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', '').strip()
    api_key = os.environ.get('CLOUDINARY_API_KEY', '').strip()
    api_secret = os.environ.get('CLOUDINARY_API_SECRET', '').strip()

    if not all([cloud_name, api_key, api_secret]):
        log.warning("Cloudinary not configured — image uploads will return None")
        return False

    try:
        import cloudinary
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
        )
        _cloud_name = cloud_name
        log.info("Cloudinary configured: cloud_name=%s", cloud_name)
        return True
    except ImportError:
        log.warning("cloudinary package not installed — uploads disabled")
        return False
    except Exception as e:
        log.error("Cloudinary config failed: %s", e)
        return False


def upload_image(image_bytes, folder='general', public_id=None, content_type='image/jpeg', scan_nsfw=False):
    """
    Upload image bytes to Cloudinary.

    Args:
        image_bytes: Raw image bytes
        folder: Cloudinary folder (e.g. 'covers', 'avatars')
        public_id: Optional public ID (e.g. 'cover_123')
        content_type: MIME type
        scan_nsfw: When True (covers from mobile / web), the upload is sent
            with a moderation parameter so Cloudinary's add-on (configured
            via the ``CLOUDINARY_MODERATION`` env, e.g. ``aws_rek``,
            ``webpurify`` or ``manual``) can flag explicit content. If the
            moderation status comes back as ``rejected`` we destroy the
            asset and return None so the calling route can show a friendly
            error to the user. If the env is unset, this is a no-op and
            uploads proceed unmoderated (fail-open).

    Returns:
        Cloudinary secure URL string, or None if upload fails / not
        configured / rejected by moderation.
    """
    if not _ensure_configured():
        return None

    try:
        import cloudinary.uploader

        # Determine resource type and format
        fmt = 'jpg'
        if 'png' in content_type:
            fmt = 'png'
        elif 'webp' in content_type:
            fmt = 'webp'
        elif 'gif' in content_type:
            fmt = 'gif'

        upload_opts = {
            'folder': f'wiamapp/{folder}',
            'resource_type': 'image',
            'format': fmt,
            'overwrite': True,
            'quality': 'auto:good',
            'fetch_format': 'auto',
        }
        if public_id:
            upload_opts['public_id'] = public_id

        moderation_kind = ''
        if scan_nsfw:
            moderation_kind = (os.environ.get('CLOUDINARY_MODERATION') or '').strip()
            if moderation_kind:
                upload_opts['moderation'] = moderation_kind

        result = cloudinary.uploader.upload(
            io.BytesIO(image_bytes),
            **upload_opts,
        )

        if scan_nsfw and moderation_kind:
            mod_block = result.get('moderation') or []
            rejected = False
            for entry in mod_block:
                status = (entry or {}).get('status', '')
                if status == 'rejected':
                    rejected = True
                    break
            if rejected:
                pid = result.get('public_id')
                log.warning("Cover rejected by moderation (%s): %s", moderation_kind, pid)
                if pid:
                    try:
                        cloudinary.uploader.destroy(pid, invalidate=True)
                    except Exception:
                        pass
                return None

        url = result.get('secure_url', '')
        if url:
            log.info("Uploaded to Cloudinary: %s (%d bytes)", url, len(image_bytes))
            return url
        log.error("Cloudinary upload returned no URL: %s", result)
        return None

    except Exception as e:
        log.error("Cloudinary upload failed: %s", e)
        return None


def delete_image(public_id):
    """Delete an image from Cloudinary by its full public ID.

    Pass the FULL public_id including the ``wiamapp/<folder>/`` prefix that
    ``upload_image`` adds — e.g. ``wiamapp/covers/cover_42``. Returns True if
    Cloudinary acknowledged a successful destroy, False otherwise. ``not_found``
    is treated as success because an idempotent delete is what callers want.
    """
    if not _ensure_configured():
        return False
    if not public_id:
        return False
    try:
        import cloudinary.uploader
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        outcome = result.get('result')
        if outcome in ('ok', 'not found'):
            log.info("Cloudinary delete %s -> %s", public_id, outcome)
            return True
        log.warning("Cloudinary delete %s -> %s", public_id, outcome)
        return False
    except Exception as e:
        log.error("Cloudinary delete failed for %s: %s", public_id, e)
        return False


def extract_public_id_from_url(url):
    """Best-effort parse of a Cloudinary secure URL back to its public_id.

    Handles URLs of the shape::

        https://res.cloudinary.com/<cloud>/image/upload/v1234567/wiamapp/covers/cover_42.jpg
        https://res.cloudinary.com/<cloud>/image/upload/wiamapp/avatars/avatar_7

    Returns the public_id (e.g. ``wiamapp/covers/cover_42``) or ``None`` if the
    URL does not look like a Cloudinary asset we own.
    """
    if not url or not isinstance(url, str):
        return None
    if 'res.cloudinary.com' not in url:
        return None
    try:
        clean = url.split('?', 1)[0]
        marker = '/upload/'
        idx = clean.find(marker)
        if idx == -1:
            return None
        rest = clean[idx + len(marker):]
        # Optional version segment v1234567/
        first, _, remainder = rest.partition('/')
        if first.startswith('v') and first[1:].isdigit() and remainder:
            rest = remainder
        # Drop file extension if present
        dot = rest.rfind('.')
        if dot != -1 and '/' not in rest[dot:]:
            rest = rest[:dot]
        return rest or None
    except Exception as e:
        log.warning("extract_public_id_from_url(%s) failed: %s", url, e)
        return None


def delete_image_url(url):
    """Destroy a Cloudinary asset given its secure URL.

    Convenience wrapper: parses the URL, calls ``delete_image``. Returns True on
    success or ``not found``, False otherwise (including when the URL is not
    a Cloudinary URL at all, in which case there's nothing to delete).
    """
    public_id = extract_public_id_from_url(url)
    if not public_id:
        return False
    return delete_image(public_id)


def upload_cover(image_bytes, book_id, content_type='image/jpeg', scan_nsfw=True):
    """Upload a book cover to Cloudinary.

    NSFW scanning is on by default (Push 6) — when ``CLOUDINARY_MODERATION``
    env is set, rejected covers are destroyed and ``None`` is returned so
    the calling route can show a friendly error.
    """
    url = upload_image(
        image_bytes,
        folder='covers',
        public_id=f'cover_{book_id}',
        content_type=content_type,
        scan_nsfw=scan_nsfw,
    )
    if url:
        return f'ext_{url}'
    return None


def upload_avatar(image_bytes, user_id, content_type='image/png', scan_nsfw=True):
    """Upload a user avatar to Cloudinary. Returns the URL string, or None."""
    return upload_image(
        image_bytes,
        folder='avatars',
        public_id=f'avatar_{user_id}',
        content_type=content_type,
        scan_nsfw=scan_nsfw,
    )


def upload_episio_cover(image_bytes, series_id, content_type='image/jpeg'):
    return upload_image(
        image_bytes,
        folder='episio_covers',
        public_id=f'cover_{series_id}',
        content_type=content_type,
        scan_nsfw=True,
    )


def upload_episio_banner(image_bytes, series_id, content_type='image/jpeg'):
    return upload_image(
        image_bytes,
        folder='episio_banners',
        public_id=f'banner_{series_id}',
        content_type=content_type,
        scan_nsfw=True,
    )


def upload_creator_channel_banner(image_bytes, user_id, content_type='image/jpeg'):
    return upload_image(
        image_bytes,
        folder='creator_banners',
        public_id=f'channel_banner_{user_id}',
        content_type=content_type,
        scan_nsfw=True,
    )


def upload_creator_channel_avatar(image_bytes, user_id, content_type='image/jpeg'):
    return upload_image(
        image_bytes,
        folder='creator_avatars',
        public_id=f'channel_avatar_{user_id}',
        content_type=content_type,
        scan_nsfw=True,
    )


def delete_avatar(user_id):
    """Destroy the Cloudinary avatar belonging to ``user_id``. Idempotent."""
    if user_id is None:
        return False
    return delete_image(f'wiamapp/avatars/avatar_{user_id}')


def delete_cover(book_id):
    """Destroy the Cloudinary cover belonging to ``book_id``. Idempotent."""
    if book_id is None:
        return False
    return delete_image(f'wiamapp/covers/cover_{book_id}')


def delete_voice_cover(story_id_or_url):
    """Destroy a Cloudinary voice cover.

    Accepts either a stable story id (Push 6+ uploads use ``voice_cover_<id>``)
    or a full Cloudinary URL (legacy UUID-named uploads). Returns True if any
    asset was destroyed.
    """
    if story_id_or_url is None:
        return False
    if isinstance(story_id_or_url, str) and 'res.cloudinary.com' in story_id_or_url:
        return delete_image_url(story_id_or_url)
    return delete_image(f'wiamapp/voice_covers/voice_cover_{story_id_or_url}')


def migrate_db_image(image_store_obj, target_folder='covers', public_id=None):
    """
    Migrate a single ImageStore record to Cloudinary.

    Args:
        image_store_obj: ImageStore model instance with .data, .content_type, .id
        target_folder: 'covers' or 'avatars'
        public_id: Optional public ID

    Returns:
        Cloudinary URL string, or None on failure.
    """
    if not image_store_obj or not image_store_obj.data:
        return None

    pid = public_id or f'migrated_{image_store_obj.id}'
    ct = image_store_obj.content_type or 'image/jpeg'
    return upload_image(image_store_obj.data, folder=target_folder, public_id=pid, content_type=ct)
