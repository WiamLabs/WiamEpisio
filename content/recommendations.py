"""Basic Recommendations: suggest books based on genre + collaborative filtering."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)


def get_recommendations(user_id: int, limit: int = 5) -> list:
    """Get recommended books for a user based on:
    1. Same genres as books they've purchased/rented
    2. Books that other buyers of their books also bought
    Returns list of (id, title, author, genre, cover_file_id, price_buy_now, views).
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Get books user already has access to (to exclude)
    cur.execute("SELECT content_id FROM access WHERE user_id=%s", (user_id,))
    owned_ids = [r[0] for r in cur.fetchall()]
    if not owned_ids:
        # User has no books — return trending instead
        cur.execute(
            "SELECT c.id, c.title, c.author, c.genre, c.cover_file_id, c.price_buy_now, c.views "
            "FROM content c WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL "
            "ORDER BY c.views DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
        conn.close()
        return rows

    owned_str = ','.join(str(i) for i in owned_ids)

    # Strategy 1: Same genres as books user owns
    cur.execute(
        f"SELECT DISTINCT genre FROM content WHERE id IN ({owned_str}) AND genre IS NOT NULL"
    )
    genres = [r[0] for r in cur.fetchall()]

    # Strategy 2: Collaborative — other users who bought same books also bought
    cur.execute(
        f"SELECT DISTINCT a2.content_id "
        f"FROM access a1 "
        f"JOIN access a2 ON a1.user_id = a2.user_id AND a2.content_id != a1.content_id "
        f"WHERE a1.content_id IN ({owned_str}) AND a1.user_id != %s "
        f"AND a2.content_id NOT IN ({owned_str}) "
        f"LIMIT 50",
        (user_id,),
    )
    collab_ids = [r[0] for r in cur.fetchall()]

    # Build recommendation query combining both strategies
    conditions = []
    params = []
    if genres:
        placeholders = ','.join(['%s'] * len(genres))
        conditions.append(f"c.genre IN ({placeholders})")
        params.extend(genres)
    if collab_ids:
        collab_str = ','.join(str(i) for i in collab_ids)
        conditions.append(f"c.id IN ({collab_str})")

    if not conditions:
        conn.close()
        return []

    where_recs = ' OR '.join(conditions)
    owned_exclude = ','.join(str(i) for i in owned_ids)

    cur.execute(
        f"SELECT c.id, c.title, c.author, c.genre, c.cover_file_id, c.price_buy_now, c.views "
        f"FROM content c WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL "
        f"AND c.id NOT IN ({owned_exclude}) "
        f"AND ({where_recs}) "
        f"ORDER BY c.views DESC LIMIT %s",
        (*params, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


# ── Callback ──────────────────────────────────────────────────────

async def recommendations_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show personalized book recommendations."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    recs = get_recommendations(user_id, limit=8)
    if not recs:
        await _safe_edit(query, 
            "\U0001f4a1 *Recommendations*\n\nNo recommendations yet. Browse and buy some books first!",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f4da Browse Books", callback_data='browse_books')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    text = "\U0001f4a1 *Recommended For You*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    keyboard = []
    for bid, title, author, genre, cover_fid, price, views in recs:
        label = f"\U0001f4d6 {title}"
        if author:
            label += f" - {author}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{bid}')])

    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, text + "_Based on your reading history:_",
        parse_mode='Markdown', reply_markup=InlineKeyboardMarkup(keyboard))
