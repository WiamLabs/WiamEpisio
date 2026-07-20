"""Reading Progress: track last page read per user/book, 'Continue Reading (Page X)'."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection

_TEXT_INPUT_FLAGS = [
    'editing_payment', 'editing_prices_for', 'awaiting_search',
    'awaiting_commission_rate', 'awaiting_sub_price_edit',
    'cr_editing_profile', 'awaiting_comment', 'awaiting_page_progress',
    'awaiting_replace_pdf', 'awaiting_replace_cover', 'awaiting_sub_proof',
    'adding_genre',
]

def _clear_text_input_flags(context, keep=None):
    for flag in _TEXT_INPUT_FLAGS:
        if flag != keep:
            context.user_data.pop(flag, None)


def ensure_reading_progress_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS reading_progress (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        last_page INTEGER NOT NULL DEFAULT 1,
        total_pages INTEGER,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
    )''')
    conn.commit()
    conn.close()


def get_progress(user_id: int, content_id: int) -> dict | None:
    """Get reading progress for a user/book. Returns None if no progress."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT last_page, total_pages FROM reading_progress "
        "WHERE user_id=%s AND content_id=%s",
        (user_id, content_id),
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return {'last_page': row[0], 'total_pages': row[1]}
    return None


def set_progress(user_id: int, content_id: int, last_page: int, total_pages: int = None):
    """Save or update reading progress."""
    conn = get_db_connection()
    cur = conn.cursor()
    if total_pages:
        cur.execute(
            "INSERT INTO reading_progress (user_id, content_id, last_page, total_pages) "
            "VALUES (%s, %s, %s, %s) "
            "ON CONFLICT (user_id, content_id) "
            "DO UPDATE SET last_page=%s, total_pages=%s, updated_at=CURRENT_TIMESTAMP",
            (user_id, content_id, last_page, total_pages, last_page, total_pages),
        )
    else:
        cur.execute(
            "INSERT INTO reading_progress (user_id, content_id, last_page) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (user_id, content_id) "
            "DO UPDATE SET last_page=%s, updated_at=CURRENT_TIMESTAMP",
            (user_id, content_id, last_page, last_page),
        )
    conn.commit()
    conn.close()


def get_progress_text(user_id: int, content_id: int) -> str:
    """Get a short progress label for display."""
    p = get_progress(user_id, content_id)
    if not p:
        return ""
    if p['total_pages']:
        pct = min(100, int(p['last_page'] / p['total_pages'] * 100))
        return f"Page {p['last_page']}/{p['total_pages']} ({pct}%)"
    return f"Page {p['last_page']}"


# ── Callbacks ─────────────────────────────────────────────────────

async def update_progress_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show current progress and prompt to update page number."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    progress = get_progress(user_id, book_id)
    text = "\U0001f4d6 *Reading Progress*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    if progress:
        text += f"Current: *{get_progress_text(user_id, book_id)}*\n\n"
    else:
        text += "No progress saved yet.\n\n"
    text += "Enter the page number you're on:"

    _clear_text_input_flags(context, keep='awaiting_page_progress')
    context.user_data['awaiting_page_progress'] = book_id
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        text,
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 Cancel", callback_data=f'book_{book_id}')],
        ]),
    )


async def progress_page_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for page number."""
    book_id = context.user_data.get('awaiting_page_progress')
    if not book_id:
        return
    context.user_data.pop('awaiting_page_progress', None)

    text = update.message.text.strip()
    try:
        page = int(text)
        if page < 1:
            raise ValueError
    except ValueError:
        await update.message.reply_text(
            "\u26a0\ufe0f Enter a valid page number (e.g., 42).",
        )
        context.user_data['awaiting_page_progress'] = book_id
        return

    user_id = update.effective_user.id

    # Try to get total pages from the PDF metadata
    total = None
    try:
        from content.book_browser import get_book_by_id
        book = get_book_by_id(book_id)
        if book and book[6]:  # pdf_file_id
            # Check if we already have total_pages stored
            existing = get_progress(user_id, book_id)
            if existing and existing['total_pages']:
                total = existing['total_pages']
    except Exception:
        pass

    set_progress(user_id, book_id, page, total)
    progress_text = get_progress_text(user_id, book_id)

    await update.message.reply_text(
        f"\u2705 Progress saved: *{progress_text}*",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f4d6 Back to Book", callback_data=f'book_{book_id}')],
            [InlineKeyboardButton("\U0001f4da My Library", callback_data='my_library')],
        ]),
    )
