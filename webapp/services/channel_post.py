"""Auto-post to Telegram channel when a book is approved on the web."""
import os
import logging
import requests as http_requests

log = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
CHANNEL_ID = os.environ.get('CHANNEL_ID', '')
APP_URL = os.environ.get('APP_URL', '')


def post_book_to_channel(book):
    """Post a book's cover + info to the Telegram channel.

    Args:
        book: a Content model instance (must have id, title, author,
              genre, description, cover_file_id, creator_wiam_id).
    """
    if not BOT_TOKEN or not CHANNEL_ID:
        log.warning("Channel post skipped — BOT_TOKEN or CHANNEL_ID not set.")
        return False

    try:
        channel_id = int(CHANNEL_ID)
    except (ValueError, TypeError):
        log.warning("Invalid CHANNEL_ID: %s", CHANNEL_ID)
        return False

    # Build caption
    title = book.title or 'Untitled'
    author = book.author or ''
    genre = book.genre or ''
    desc = (book.description or '')[:200]
    if len(book.description or '') > 200:
        desc += '...'

    caption = f"📖 *{title}*"
    if author:
        caption += f"\n✍️ {author}"
    if genre:
        caption += f"\n🏷 {genre}"
    if desc:
        caption += f"\n\n{desc}"

    book_url = f"{APP_URL}/book/{book.id}" if APP_URL else ''
    if book_url:
        caption += f"\n\n👉 [Read on WiamApp]({book_url})"

    # Build inline keyboard with "Read Now" button
    reply_markup = None
    if book_url:
        reply_markup = {
            'inline_keyboard': [
                [{'text': '📖 Read Now', 'url': book_url}]
            ]
        }

    api_base = f"https://api.telegram.org/bot{BOT_TOKEN}"

    try:
        if book.cover_file_id and not book.cover_file_id.startswith('web_'):
            # Send photo with caption
            payload = {
                'chat_id': channel_id,
                'photo': book.cover_file_id,
                'caption': caption,
                'parse_mode': 'Markdown',
            }
            if reply_markup:
                import json
                payload['reply_markup'] = json.dumps(reply_markup)
            resp = http_requests.post(f"{api_base}/sendPhoto", data=payload, timeout=10)
        else:
            # No cover — send text message
            payload = {
                'chat_id': channel_id,
                'text': caption,
                'parse_mode': 'Markdown',
                'disable_web_page_preview': False,
            }
            if reply_markup:
                import json
                payload['reply_markup'] = json.dumps(reply_markup)
            resp = http_requests.post(f"{api_base}/sendMessage", data=payload, timeout=10)

        if resp.status_code == 200:
            log.info("Channel post success for book %s: %s", book.id, title)
            return True
        else:
            log.warning("Channel post failed (%s): %s", resp.status_code, resp.text[:200])
            return False

    except Exception as e:
        log.warning("Channel post error: %s", str(e)[:200])
        return False


def post_announcement_to_channel(title, message=''):
    """Post a founder announcement to the Telegram channel."""
    if not BOT_TOKEN or not CHANNEL_ID:
        return False

    try:
        channel_id = int(CHANNEL_ID)
    except (ValueError, TypeError):
        return False

    text = f"📢 *{title}*"
    if message:
        text += f"\n\n{message}"

    api_base = f"https://api.telegram.org/bot{BOT_TOKEN}"
    try:
        payload = {
            'chat_id': channel_id,
            'text': text,
            'parse_mode': 'Markdown',
        }
        resp = http_requests.post(f"{api_base}/sendMessage", data=payload, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        log.warning("Announcement channel post error: %s", str(e)[:200])
        return False
