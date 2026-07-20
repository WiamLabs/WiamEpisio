"""Ratings system: 1-5 stars, only verified readers can rate."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection
from content.access_control import can_user_access_content


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)


def ensure_ratings_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
    )''')
    conn.commit()
    conn.close()


def get_book_rating(content_id: int) -> dict:
    """Get average rating and count for a book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*), COALESCE(AVG(rating), 0) FROM ratings WHERE content_id=%s",
        (content_id,),
    )
    row = cur.fetchone()
    conn.close()
    return {
        'count': row[0] or 0,
        'average': round(float(row[1] or 0), 1),
    }


def get_user_rating(user_id: int, content_id: int) -> int | None:
    """Get a user's rating for a book. Returns None if not rated."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT rating FROM ratings WHERE user_id=%s AND content_id=%s",
        (user_id, content_id),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def set_rating(user_id: int, content_id: int, rating: int) -> bool:
    """Set or update a user's rating for a book. Returns True on success."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO ratings (user_id, content_id, rating) "
        "VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, content_id) "
        "DO UPDATE SET rating=%s, updated_at=CURRENT_TIMESTAMP",
        (user_id, content_id, rating, rating),
    )
    conn.commit()
    conn.close()
    return True


def stars_display(avg: float, count: int) -> str:
    """Format rating as stars string."""
    if count == 0:
        return "No ratings yet"
    full = int(avg)
    half = 1 if (avg - full) >= 0.5 else 0
    empty = 5 - full - half
    stars = "\u2b50" * full + ("\u2b50" if half else "") + "\u2606" * (empty - (0 if half else 0))
    # Simpler approach: just show numeric
    return f"\u2b50 {avg}/5 ({count} ratings)"


# ── Callbacks ─────────────────────────────────────────────────────

async def rate_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show rating buttons. Only verified readers can rate."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    # Check if user has access (bought or rented)
    has_access = can_user_access_content(user_id, book_id)
    # Also check chapter access
    if not has_access:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM chapter_access WHERE user_id=%s AND content_id=%s LIMIT 1",
            (user_id, book_id),
        )
        has_access = cur.fetchone() is not None
        conn.close()

    if not has_access:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\u26a0\ufe0f You need to buy or rent this book before you can rate it.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
            ]),
        )
        return

    current = get_user_rating(user_id, book_id)
    info = get_book_rating(book_id)
    text = f"\u2b50 *Rate this book*\n\n"
    text += f"Current average: {stars_display(info['average'], info['count'])}\n"
    if current:
        text += f"Your rating: {'⭐' * current}\n"
    text += "\nTap a star to rate:"

    keyboard = [[
        InlineKeyboardButton("1⭐", callback_data=f'setrate_{book_id}_1'),
        InlineKeyboardButton("2⭐", callback_data=f'setrate_{book_id}_2'),
        InlineKeyboardButton("3⭐", callback_data=f'setrate_{book_id}_3'),
        InlineKeyboardButton("4⭐", callback_data=f'setrate_{book_id}_4'),
        InlineKeyboardButton("5⭐", callback_data=f'setrate_{book_id}_5'),
    ]]
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def set_rate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User taps a star rating."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        parts = query.data.split('_')
        book_id = int(parts[1])
        rating = int(parts[2])
    except (IndexError, ValueError):
        return

    if rating < 1 or rating > 5:
        return

    # Verify access again
    has_access = can_user_access_content(user_id, book_id)
    if not has_access:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM chapter_access WHERE user_id=%s AND content_id=%s LIMIT 1",
            (user_id, book_id),
        )
        has_access = cur.fetchone() is not None
        conn.close()

    if not has_access:
        try:
            await _safe_edit(query, 
                "\u26a0\ufe0f Access required to rate.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'book_{book_id}')]]),
            )
        except Exception:
            await query.message.chat.send_message(
                "\u26a0\ufe0f Access required to rate.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'book_{book_id}')]]),
            )
        return

    set_rating(user_id, book_id, rating)
    info = get_book_rating(book_id)

    try:
        await _safe_edit(query, 
            f"\u2705 You rated this book {'⭐' * rating}\n\n"
            f"New average: {stars_display(info['average'], info['count'])}",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')]]),
            parse_mode='Markdown',
        )
    except Exception:
        await query.message.chat.send_message(
            f"\u2705 You rated this book {'⭐' * rating}\n\n"
            f"New average: {stars_display(info['average'], info['count'])}",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')]]),
            parse_mode='Markdown',
        )
