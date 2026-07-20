"""Comments system: verified readers only, one comment per user per book, short text."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection
from content.access_control import can_user_access_content

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


MAX_COMMENT_LENGTH = 300


def ensure_comments_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
    )''')
    # Add comments_disabled column to content table
    try:
        cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN DEFAULT FALSE")
    except Exception:
        pass
    conn.commit()
    conn.close()


def are_comments_disabled(content_id: int) -> bool:
    """Check if comments are disabled for a book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT comments_disabled FROM content WHERE id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    return bool(row[0]) if row and row[0] else False


def toggle_comments(content_id: int, disabled: bool):
    """Enable or disable comments for a book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET comments_disabled=%s WHERE id=%s",
        (disabled, content_id),
    )
    conn.commit()
    conn.close()


def get_book_comments(content_id: int, limit: int = 10) -> list:
    """Get comments for a book. Returns list of (username, first_name, text, created_at)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT u.username, u.first_name, c.text, c.created_at "
        "FROM comments c JOIN users u ON c.user_id = u.telegram_id "
        "WHERE c.content_id=%s ORDER BY c.created_at DESC LIMIT %s",
        (content_id, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_user_comment(user_id: int, content_id: int) -> str | None:
    """Get a user's comment for a book. Returns None if not commented."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT text FROM comments WHERE user_id=%s AND content_id=%s",
        (user_id, content_id),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def add_comment(user_id: int, content_id: int, text: str) -> bool:
    """Add or update a user's comment for a book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO comments (user_id, content_id, text) "
        "VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id, content_id) "
        "DO UPDATE SET text=%s, created_at=CURRENT_TIMESTAMP",
        (user_id, content_id, text, text),
    )
    conn.commit()
    conn.close()
    return True


def get_comment_count(content_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM comments WHERE content_id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] or 0


# ── Callbacks ─────────────────────────────────────────────────────

async def view_comments_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show comments for a book + option to add comment."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    if are_comments_disabled(book_id):
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\U0001f4ac Comments are disabled for this book.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')]]),
        )
        return

    comments = get_book_comments(book_id, limit=10)
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

    text = "\U0001f4ac *Reader Comments*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    if not comments:
        text += "_No comments yet. Be the first!_\n"
    else:
        for uname, fname, ctext, created in comments:
            name = uname or fname or "Reader"
            date_str = str(created)[:10] if created else ""
            text += f"\U0001f464 *{name}* ({date_str})\n{ctext}\n\n"

    keyboard = []
    if has_access:
        existing = get_user_comment(user_id, book_id)
        if existing:
            keyboard.append([InlineKeyboardButton("\u270f\ufe0f Edit Your Comment", callback_data=f'addcomment_{book_id}')])
        else:
            keyboard.append([InlineKeyboardButton("\U0001f4dd Add Comment", callback_data=f'addcomment_{book_id}')])
    else:
        text += "\n_Buy or rent this book to leave a comment._"
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def add_comment_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt user to type their comment."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

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
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\u26a0\ufe0f You need to buy or rent this book before commenting.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'book_{book_id}')]]),
        )
        return

    _clear_text_input_flags(context, keep='awaiting_comment')
    context.user_data['awaiting_comment'] = book_id
    existing = get_user_comment(user_id, book_id)
    prompt = "\U0001f4dd *Write your comment* (max 300 characters):\n\n"
    if existing:
        prompt += f"Your current comment:\n_{existing}_\n\nType a new one to replace it:"
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        prompt,
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data=f'comments_{book_id}')]]),
    )


async def comment_text_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for comments."""
    book_id = context.user_data.get('awaiting_comment')
    if not book_id:
        return
    context.user_data.pop('awaiting_comment', None)

    text = update.message.text.strip()
    if len(text) < 3:
        await update.message.reply_text("\u26a0\ufe0f Comment too short. Write at least 3 characters.")
        context.user_data['awaiting_comment'] = book_id
        return
    if len(text) > MAX_COMMENT_LENGTH:
        text = text[:MAX_COMMENT_LENGTH]

    user_id = update.effective_user.id
    add_comment(user_id, book_id, text)

    await update.message.reply_text(
        f"\u2705 Comment saved!\n\n\"{text}\"",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f4ac View Comments", callback_data=f'comments_{book_id}')],
            [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
        ]),
    )
