"""Featured Placement System: Founder can feature books for promoted placement."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection
from core.role_manager import ROLE_FOUNDER, get_user_role


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)


def ensure_featured_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS featured_books (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL UNIQUE,
        featured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        featured_by BIGINT NOT NULL
    )''')
    conn.commit()
    conn.close()


def is_featured(content_id: int) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM featured_books WHERE content_id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    return row is not None


def feature_book(content_id: int, featured_by: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO featured_books (content_id, featured_by) VALUES (%s, %s) "
        "ON CONFLICT (content_id) DO UPDATE SET featured_at=CURRENT_TIMESTAMP, featured_by=%s",
        (content_id, featured_by, featured_by),
    )
    conn.commit()
    conn.close()


def unfeature_book(content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM featured_books WHERE content_id=%s", (content_id,))
    conn.commit()
    conn.close()


def get_featured_books(limit: int = 10) -> list:
    """Get featured books. Returns list of (id, title, author, genre, cover_file_id, price_buy_now, views)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, c.title, c.author, c.genre, c.cover_file_id, c.price_buy_now, c.views "
        "FROM featured_books fb JOIN content c ON fb.content_id = c.id "
        "WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL "
        "ORDER BY fb.featured_at DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_featured_count() -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) FROM featured_books fb "
        "JOIN content c ON fb.content_id = c.id "
        "WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL"
    )
    row = cur.fetchone()
    conn.close()
    return row[0] or 0


# ── Callbacks ─────────────────────────────────────────────────────

async def featured_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show featured books to users."""
    query = update.callback_query
    await query.answer()

    books = get_featured_books(limit=10)
    if not books:
        await _safe_edit(query, 
            "\u2b50 *Featured Books*\n\nNo featured books right now. Check back soon!",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f4da Browse Books", callback_data='browse_books')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    keyboard = []
    for bid, title, author, genre, cover_fid, price, views in books:
        label = f"\u2b50 {title}"
        if author:
            label += f" - {author}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{bid}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, 
        "\u2b50 *Featured Books*\n_Hand-picked by WiamApp Team_",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def manage_featured_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: manage featured books."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return

    books = get_featured_books(limit=20)
    text = "\u2b50 *Manage Featured Books*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    keyboard = []
    if books:
        text += f"Currently {len(books)} featured books:\n\n"
        for bid, title, author, genre, _, _, views in books:
            text += f"\u2b50 *{title}* ({views} views)\n"
            keyboard.append([InlineKeyboardButton(f"\u274c Remove: {title[:30]}", callback_data=f'unfeature_{bid}')])
    else:
        text += "No featured books yet.\n"

    text += "\n_To add a book, use 'Feature Book' from Manage All Books._"
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')])
    await _safe_edit(query, text, parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))


async def feature_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: feature a specific book."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        return
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return
    feature_book(book_id, query.from_user.id)
    await _safe_edit(query, 
        "\u2b50 Book is now *featured*!",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u2b50 Manage Featured", callback_data='manage_featured')],
            [InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')],
        ]),
    )


async def unfeature_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: remove a book from featured."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        return
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return
    unfeature_book(book_id)
    await _safe_edit(query, 
        "\u274c Book removed from featured.",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u2b50 Manage Featured", callback_data='manage_featured')],
            [InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')],
        ]),
    )
