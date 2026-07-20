from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes, ConversationHandler

from core.db import get_db_connection
from core.role_manager import ROLE_ADMIN, ROLE_FOUNDER, get_user_role


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)

ADMIN_ADD_ID = 10
ADMIN_REMOVE_ID = 11


async def show_admin_management(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    keyboard = [
        [InlineKeyboardButton("List Admins", callback_data='admin_mgmt_list')],
        [InlineKeyboardButton("Add Admin", callback_data='admin_mgmt_add')],
        [InlineKeyboardButton("Remove Admin", callback_data='admin_mgmt_remove')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')],
    ]
    await _safe_edit(query, "Admin Management:", reply_markup=InlineKeyboardMarkup(keyboard))


async def list_admins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT telegram_id, username FROM users WHERE role=%s ORDER BY telegram_id", (ROLE_ADMIN,))
    admins = cur.fetchall()
    conn.close()

    if not admins:
        await _safe_edit(query, "No admins yet.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_admins')]]))
        return

    text = "Admins:\n" + "\n".join(f"- {u or tid} ({tid})" for tid, u in admins)
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_admins')]]))


async def add_admin_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return ConversationHandler.END
    await _safe_edit(query, 
        "Send the Telegram ID of the user you want to make Admin:",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='dash_admins')]]),
    )
    return ADMIN_ADD_ID


async def remove_admin_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return ConversationHandler.END
    await _safe_edit(query, 
        "Send the Telegram ID of the Admin you want to remove:",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='dash_admins')]]),
    )
    return ADMIN_REMOVE_ID


async def add_admin_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    actor_role = get_user_role(update.effective_user.id)
    if actor_role != ROLE_FOUNDER:
        await update.message.reply_text("Access denied.")
        return ConversationHandler.END

    raw = (update.message.text or "").strip()
    try:
        target_id = int(raw)
    except ValueError:
        await update.message.reply_text("Invalid Telegram ID.")
        return ConversationHandler.END

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE telegram_id=%s", (target_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text("That user is not in the database yet. Ask them to press /start first.")
        return ConversationHandler.END
    if row[0] == ROLE_FOUNDER:
        conn.close()
        await update.message.reply_text("This user's role cannot be changed.")
        return ConversationHandler.END

    cur.execute("UPDATE users SET role=%s WHERE telegram_id=%s", (ROLE_ADMIN, target_id))
    conn.commit()
    conn.close()
    await update.message.reply_text(
        f"\u2705 Admin added: {target_id}",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_admins')]]),
    )
    return ConversationHandler.END


async def remove_admin_id(update: Update, context: ContextTypes.DEFAULT_TYPE):
    actor_role = get_user_role(update.effective_user.id)
    if actor_role != ROLE_FOUNDER:
        await update.message.reply_text("Access denied.")
        return ConversationHandler.END

    raw = (update.message.text or "").strip()
    try:
        target_id = int(raw)
    except ValueError:
        await update.message.reply_text("Invalid Telegram ID.")
        return ConversationHandler.END

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE telegram_id=%s", (target_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text("User not found.")
        return ConversationHandler.END
    if row[0] == ROLE_FOUNDER:
        conn.close()
        await update.message.reply_text("This user's role cannot be changed.")
        return ConversationHandler.END

    cur.execute("UPDATE users SET role='user' WHERE telegram_id=%s AND role=%s", (target_id, ROLE_ADMIN))
    conn.commit()
    conn.close()
    await update.message.reply_text(
        f"\u2705 Admin removed: {target_id}",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_admins')]]),
    )
    return ConversationHandler.END
