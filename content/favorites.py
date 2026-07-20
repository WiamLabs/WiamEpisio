from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.db import get_db_connection

_HOME_KB = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])


async def save_fav(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    content_id = int(query.data.split('_')[2])

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO favorites (user_id, content_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (user_id, content_id),
    )
    conn.commit()
    conn.close()
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message("\u2b50 Saved to favorites!", reply_markup=_HOME_KB)


async def favorites(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, c.title FROM favorites f "
        "JOIN content c ON f.content_id = c.id "
        "WHERE f.user_id=%s AND c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL",
        (user_id,),
    )
    favs = cur.fetchall()
    conn.close()
    if not favs:
        await update.message.reply_text("No favorites yet.", reply_markup=_HOME_KB)
        return
    keyboard = []
    for cid, title in favs:
        keyboard.append([InlineKeyboardButton(f"\U0001f4d6 {title}", callback_data=f'book_{cid}')])
        keyboard.append([InlineKeyboardButton(f"\u274c Remove", callback_data=f'rm_fav_{cid}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await update.message.reply_text(
        "\u2b50 *Your Favorites:*",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def remove_fav(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM favorites WHERE user_id=%s AND content_id=%s", (user_id, content_id))
    conn.commit()
    conn.close()
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        "\u2705 Removed from favorites.",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
    )
