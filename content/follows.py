"""Creator Follow System: users follow creators, get notified on new books."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection


def ensure_follows_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS follows (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        creator_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, creator_id)
    )''')
    conn.commit()
    conn.close()


def follow_creator(user_id: int, creator_id: int) -> bool:
    """Follow a creator. Returns True on success."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO follows (user_id, creator_id) VALUES (%s, %s) "
            "ON CONFLICT (user_id, creator_id) DO NOTHING",
            (user_id, creator_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        return False
    conn.close()
    return True


def unfollow_creator(user_id: int, creator_id: int) -> bool:
    """Unfollow a creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM follows WHERE user_id=%s AND creator_id=%s",
        (user_id, creator_id),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def is_following(user_id: int, creator_id: int) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM follows WHERE user_id=%s AND creator_id=%s",
        (user_id, creator_id),
    )
    row = cur.fetchone()
    conn.close()
    return row is not None


def get_follower_count(creator_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM follows WHERE creator_id=%s", (creator_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] or 0


def get_follower_ids(creator_id: int) -> list[int]:
    """Get all user IDs following a creator (for notifications)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM follows WHERE creator_id=%s", (creator_id,))
    rows = cur.fetchall()
    conn.close()
    return [r[0] for r in rows]


def get_following_count(user_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM follows WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] or 0


# ── Callbacks ─────────────────────────────────────────────────────

async def follow_creator_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle follow/unfollow a creator from book detail."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        creator_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    # Don't let creators follow themselves
    if user_id == creator_id:
        await query.answer("You can't follow yourself.", show_alert=True)
        return

    if is_following(user_id, creator_id):
        unfollow_creator(user_id, creator_id)
        await query.answer("\u2705 Unfollowed!", show_alert=True)
    else:
        follow_creator(user_id, creator_id)
        await query.answer("\u2705 Following! You'll be notified of new books.", show_alert=True)
