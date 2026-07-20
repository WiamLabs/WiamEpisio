"""API routes — serves file IDs as images/PDFs for the web."""
import requests
from datetime import datetime
from flask import Blueprint, redirect, abort, current_app, Response, stream_with_context, request, jsonify
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import Content, Access, ReaderPreferences, PushSubscription, ReadingStreak, Bookmark, Shelf, ShelfItem

api_bp = Blueprint('api', __name__)


@api_bp.route('/api/health')
def health_check():
    """Simple health endpoint for monitoring and load tests."""
    return jsonify(ok=True, status='healthy'), 200


@api_bp.route('/api/bug-report', methods=['POST'])
@csrf.exempt
@login_required
def bug_report():
    """C2: In-app bug report submission."""
    import logging
    log = logging.getLogger('bug_report')
    data = request.get_json(silent=True) or {}
    text = (data.get('text') or '').strip()[:2000]
    bug_type = (data.get('type') or 'bug')[:50]
    page_url = (data.get('url') or '')[:500]
    ua = (data.get('ua') or '')[:300]
    if not text or len(text) < 5:
        return jsonify(ok=False, error='Too short'), 400
    uid = current_user.wiam_id
    log.info("BUG_REPORT user=%s type=%s url=%s ua=%s — %s", uid, bug_type, page_url, ua, text)
    return jsonify(ok=True)


def _get_telegram_file_url(file_id):
    """Resolve a Telegram file_id to a download URL."""
    bot_token = current_app.config.get('BOT_TOKEN', '')
    if not bot_token or not file_id:
        return None
    try:
        resp = requests.get(
            f'https://api.telegram.org/bot{bot_token}/getFile',
            params={'file_id': file_id},
            timeout=5,
        )
        data = resp.json()
        if data.get('ok'):
            file_path = data['result']['file_path']
            return f'https://api.telegram.org/file/bot{bot_token}/{file_path}'
    except Exception:
        pass
    return None


@api_bp.route('/api/cover/<file_id>')
def serve_cover(file_id):
    """Fetch a Telegram file by file_id and redirect to its URL."""
    url = _get_telegram_file_url(file_id)
    if url:
        return redirect(url)
    # Telegram file ID expired or bot token missing — show default cover
    return redirect('/static/img/default_cover.png')


@api_bp.route('/api/pdf/<int:book_id>')
@login_required
def serve_pdf(book_id):
    """Stream PDF for a purchased book. Access check enforced."""
    book = Content.query.get_or_404(book_id)

    # Check access
    has_access = Access.query.filter_by(
        user_id=current_user.wiam_id, content_id=book_id, status='active'
    ).first() is not None

    # Free books are always accessible
    is_free = not book.price or book.price == 0

    if not has_access and not is_free:
        abort(403)

    if not book.pdf_file_id:
        abort(404)

    url = _get_telegram_file_url(book.pdf_file_id)
    if not url:
        abort(404)

    # Stream the PDF through our server (avoids exposing bot token URL)
    try:
        r = requests.get(url, stream=True, timeout=30)
        return Response(
            stream_with_context(r.iter_content(chunk_size=8192)),
            content_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{book.title}.pdf"'}
        )
    except Exception:
        abort(502)


@api_bp.route('/api/reader-pref', methods=['POST'])
@csrf.exempt
@login_required
def save_reader_pref():
    """Save reader preferences (theme, font_size) via AJAX."""
    data = request.get_json(silent=True) or {}
    prefs = ReaderPreferences.query.filter_by(user_id=current_user.wiam_id).first()
    if not prefs:
        prefs = ReaderPreferences(user_id=current_user.wiam_id)
        db.session.add(prefs)
    if 'theme' in data and data['theme'] in ('light', 'dark', 'sepia'):
        prefs.theme = data['theme']
    if 'font_size' in data and data['font_size'] in ('small', 'medium', 'large', 'xlarge'):
        prefs.font_size = data['font_size']
    if 'font_family' in data and data['font_family'] in ('serif', 'sans', 'mono'):
        prefs.font_family = data['font_family']
    if 'line_spacing' in data and data['line_spacing'] in ('tight', 'normal', 'spacious'):
        prefs.line_spacing = data['line_spacing']
    prefs.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# F6: Push Notification Subscriptions
# ---------------------------------------------------------------------------

@api_bp.route('/api/push/subscribe', methods=['POST'])
@csrf.exempt
@login_required
def push_subscribe():
    """Save a browser push subscription."""
    data = request.get_json(silent=True) or {}
    endpoint = data.get('endpoint', '')
    keys = data.get('keys', {})
    p256dh = keys.get('p256dh', '')
    auth = keys.get('auth', '')
    if not endpoint or not p256dh or not auth:
        return jsonify({'ok': False, 'error': 'Missing subscription data'}), 400

    uid = current_user.wiam_id
    existing = PushSubscription.query.filter_by(user_id=uid, endpoint=endpoint).first()
    if not existing:
        sub = PushSubscription(user_id=uid, endpoint=endpoint, p256dh=p256dh, auth=auth)
        db.session.add(sub)
        db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/api/push/unsubscribe', methods=['POST'])
@csrf.exempt
@login_required
def push_unsubscribe():
    """Remove a push subscription."""
    data = request.get_json(silent=True) or {}
    endpoint = data.get('endpoint', '')
    if endpoint:
        PushSubscription.query.filter_by(
            user_id=current_user.wiam_id, endpoint=endpoint
        ).delete()
        db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/api/push/vapid-key')
@login_required
def vapid_public_key():
    """Return VAPID public key for push subscription."""
    import os
    key = os.environ.get('VAPID_PUBLIC_KEY', '')
    return jsonify({'key': key})


# ---------------------------------------------------------------------------
# F7: Reading Streaks
# ---------------------------------------------------------------------------

@api_bp.route('/api/reading/log', methods=['POST'])
@csrf.exempt
@login_required
def log_reading():
    """Log reading activity — called from the reader periodically."""
    data = request.get_json(silent=True) or {}
    minutes = max(0, min(data.get('minutes', 0), 120))
    pages = max(0, min(data.get('pages', 0), 200))
    today = datetime.utcnow().date()
    uid = current_user.wiam_id

    streak = ReadingStreak.query.filter_by(user_id=uid, date=today).first()
    if streak:
        streak.minutes_read += minutes
        streak.pages_read += pages
    else:
        streak = ReadingStreak(user_id=uid, date=today, minutes_read=minutes, pages_read=pages)
        db.session.add(streak)
    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/api/reading/streak')
@login_required
def get_streak():
    """Get current reading streak info for the user."""
    from datetime import timedelta
    uid = current_user.wiam_id
    today = datetime.utcnow().date()

    # Count consecutive days with reading
    streak_days = 0
    check_date = today
    while True:
        entry = ReadingStreak.query.filter_by(user_id=uid, date=check_date).first()
        if entry and entry.minutes_read > 0:
            streak_days += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Total stats
    from sqlalchemy import func
    totals = db.session.query(
        func.sum(ReadingStreak.minutes_read),
        func.sum(ReadingStreak.pages_read)
    ).filter_by(user_id=uid).first()

    return jsonify({
        'streak_days': streak_days,
        'total_minutes': totals[0] or 0,
        'total_pages': totals[1] or 0,
    })


# ---------------------------------------------------------------------------
# F12: Bookmarks & Highlights
# ---------------------------------------------------------------------------

@api_bp.route('/api/bookmarks', methods=['GET'])
@login_required
def get_bookmarks():
    """Get bookmarks for a book."""
    content_id = request.args.get('content_id', 0, type=int)
    uid = current_user.wiam_id
    bms = Bookmark.query.filter_by(user_id=uid, content_id=content_id).order_by(Bookmark.created_at.desc()).all()
    return jsonify([{
        'id': b.id, 'chapter_id': b.chapter_id, 'position': b.position,
        'highlight_text': b.highlight_text, 'note': b.note, 'color': b.color,
    } for b in bms])


@api_bp.route('/api/bookmarks', methods=['POST'])
@csrf.exempt
@login_required
def add_bookmark():
    """Add a bookmark or highlight."""
    data = request.get_json(silent=True) or {}
    bm = Bookmark(
        user_id=current_user.wiam_id,
        content_id=data.get('content_id', 0),
        chapter_id=data.get('chapter_id'),
        position=data.get('position'),
        highlight_text=data.get('highlight_text'),
        note=data.get('note'),
        color=data.get('color', 'yellow'),
    )
    db.session.add(bm)
    db.session.commit()
    return jsonify({'ok': True, 'id': bm.id})


@api_bp.route('/api/bookmarks/<int:bm_id>', methods=['DELETE'])
@csrf.exempt
@login_required
def delete_bookmark(bm_id):
    """Delete a bookmark."""
    bm = Bookmark.query.get_or_404(bm_id)
    if bm.user_id != current_user.wiam_id:
        abort(403)
    db.session.delete(bm)
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# F18: Shelves
# ---------------------------------------------------------------------------

@api_bp.route('/api/shelves')
@login_required
def get_shelves():
    """Get user's shelves."""
    uid = current_user.wiam_id
    shelves = Shelf.query.filter_by(user_id=uid).order_by(Shelf.created_at.desc()).all()
    results = []
    for s in shelves:
        count = ShelfItem.query.filter_by(shelf_id=s.id).count()
        results.append({'id': s.id, 'name': s.name, 'description': s.description, 'is_public': s.is_public, 'count': count})
    return jsonify(results)


@api_bp.route('/api/shelves', methods=['POST'])
@csrf.exempt
@login_required
def create_shelf():
    """Create a new shelf."""
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'ok': False, 'error': 'Name required'}), 400
    shelf = Shelf(
        user_id=current_user.wiam_id,
        name=name,
        description=(data.get('description') or '').strip(),
        is_public=bool(data.get('is_public', False)),
    )
    db.session.add(shelf)
    db.session.commit()
    return jsonify({'ok': True, 'id': shelf.id})


@api_bp.route('/api/shelves/<int:shelf_id>/add', methods=['POST'])
@csrf.exempt
@login_required
def add_to_shelf(shelf_id):
    """Add a book to a shelf."""
    shelf = Shelf.query.get_or_404(shelf_id)
    if shelf.user_id != current_user.wiam_id:
        abort(403)
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    existing = ShelfItem.query.filter_by(shelf_id=shelf_id, content_id=content_id).first()
    if not existing:
        db.session.add(ShelfItem(shelf_id=shelf_id, content_id=content_id))
        db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/api/shelves/<int:shelf_id>/remove', methods=['POST'])
@csrf.exempt
@login_required
def remove_from_shelf(shelf_id):
    """Remove a book from a shelf."""
    shelf = Shelf.query.get_or_404(shelf_id)
    if shelf.user_id != current_user.wiam_id:
        abort(403)
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    ShelfItem.query.filter_by(shelf_id=shelf_id, content_id=content_id).delete()
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Bot Unmatched — Web Bot forwards unrecognized messages for training
# ---------------------------------------------------------------------------

@api_bp.route('/api/bot-unmatched', methods=['POST'])
@csrf.exempt
def bot_unmatched():
    """Receive unmatched messages from the web WiamBot and forward to training queue."""
    import logging
    log = logging.getLogger(__name__)
    data = request.get_json(silent=True) or {}
    message = (data.get('message') or '').strip()
    if not message or len(message) < 2 or len(message) > 2000:
        return jsonify({'ok': False}), 400

    user_id = None
    user_name = 'Web Visitor'
    if current_user and hasattr(current_user, 'is_authenticated') and current_user.is_authenticated:
        user_id = current_user.wiam_id
        user_name = current_user.display_name or current_user.username or 'User'

    try:
        from ..models import BotUnmatchedMessage
        unmatched = BotUnmatchedMessage(
            user_message=message[:500],
            user_id=user_id,
        )
        db.session.add(unmatched)
        db.session.commit()
        unmatched_id = unmatched.id

        from ..services.platform_notify import notify_training_queue
        confidence = data.get('confidence', 0)
        notify_training_queue(
            message[:500], str(user_id or 'web_anonymous'),
            user_name=user_name, confidence=confidence, unmatched_id=unmatched_id
        )
    except Exception as e:
        log.warning("bot-unmatched forward error: %s", e)

    return jsonify({'ok': True})
