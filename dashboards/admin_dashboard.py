from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram import Update
from telegram.ext import ContextTypes

from core.db import get_db_connection
from core.role_manager import ROLE_ADMIN, ROLE_FOUNDER, get_user_role
from channel.channel_integration import channel_post_list_callback, post_creator_carousel


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)


def admin_menu():
    keyboard = [
        [InlineKeyboardButton("Users Dashboard", callback_data="dash_users")],
        [InlineKeyboardButton("Creators Dashboard", callback_data="dash_creators")],
    ]
    return InlineKeyboardMarkup(keyboard)


async def show_admin_panel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("Access denied.")
        return

    keyboard = [
        [InlineKeyboardButton("\U0001f4e4 Upload Book", callback_data='admin_upload_pdf')],
        [InlineKeyboardButton("\u2705 Approve Content", callback_data='admin_approve')],
        [InlineKeyboardButton("\U0001f4e2 Post to Channel", callback_data='channel_post_list')],
        [InlineKeyboardButton("\U0001f4c2 My Drafts", callback_data='my_drafts')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("\U0001f6e0 Admin Panel:", reply_markup=reply_markup)


async def approve_content_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, title, author, genre FROM content WHERE status='pending' ORDER BY id DESC")
    pendings = cur.fetchall()
    conn.close()

    back_cb = 'open_founder_dashboard' if role == ROLE_FOUNDER else 'open_admin_panel'
    if not pendings:
        await _safe_edit(query, "No pending books to review.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)]]))
        return

    keyboard = []
    for row in pendings:
        content_id, title, author, genre = row
        label = f"\U0001f4d6 {title}"
        if author:
            label += f" — {author}"
        keyboard.append([InlineKeyboardButton(f"\u2705 {label}", callback_data=f'approve_{content_id}')])
        keyboard.append([InlineKeyboardButton(f"\u274c {label}", callback_data=f'reject_{content_id}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back", callback_data=back_cb)])
    reply_markup = InlineKeyboardMarkup(keyboard)
    await _safe_edit(query, "Pending books for review:", reply_markup=reply_markup)


async def approve_content_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    action, id_ = query.data.split('_', 1)
    status = 'approved' if action == 'approve' else 'rejected'
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE content SET status=%s WHERE id=%s", (status, id_))
    conn.commit()
    conn.close()

    # Get book info for notifications
    conn_info = get_db_connection()
    cur_info = conn_info.cursor()
    cur_info.execute("SELECT creator_telegram_id, title FROM content WHERE id=%s", (id_,))
    info_row = cur_info.fetchone()
    conn_info.close()
    creator_id = info_row[0] if info_row else None
    book_title = info_row[1] if info_row else f"Book #{id_}"

    if status == 'approved':
        if creator_id:
            try:
                ok, err = await post_creator_carousel(context.bot, creator_id)
            except Exception as e:
                ok, err = False, str(e)
            _back = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='admin_approve')]])
            if ok:
                await _safe_edit(query, "\u2705 Book approved and carousel updated in channel.", reply_markup=_back)
            else:
                msg = "\u2705 Book approved.\n\u26a0\ufe0f Could not update channel carousel."
                if err:
                    msg += f"\n\nError: {err}"
                await _safe_edit(query, msg, reply_markup=_back)
        else:
            await _safe_edit(query, "\u2705 Book approved.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='admin_approve')]]))

        # --- Notification #12: Notify Creator their book was approved ---
        if creator_id:
            try:
                await context.bot.send_message(
                    chat_id=creator_id,
                    text=(
                        f"\u2705 *Book Approved!*\n\n"
                        f"\U0001f4d6 *{book_title}* is now live in the store!\n\n"
                        f"Readers can discover and purchase your book."
                    ),
                    parse_mode='Markdown',
                )
            except Exception:
                pass

            # --- Notification: Notify followers about new book ---
            try:
                from content.follows import get_follower_ids
                from creators.profile_service import get_creator_profile
                follower_ids = get_follower_ids(creator_id)
                profile = get_creator_profile(creator_id)
                creator_name = profile['pen_name'] if profile else "A creator you follow"
                for fid in follower_ids:
                    try:
                        await context.bot.send_message(
                            chat_id=fid,
                            text=(
                                f"\U0001f514 *New Book from {creator_name}!*\n\n"
                                f"\U0001f4d6 *{book_title}* is now available.\n\n"
                                f"Check it out in the store!"
                            ),
                            parse_mode='Markdown',
                            reply_markup=InlineKeyboardMarkup([
                                [InlineKeyboardButton("\U0001f4d6 View Book", callback_data=f'book_{id_}')],
                            ]),
                        )
                    except Exception:
                        pass
            except Exception:
                pass
    else:
        await _safe_edit(query, "\u274c Book rejected.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='admin_approve')]]))

        # --- Notification #13: Notify Creator their book was rejected ---
        if creator_id:
            try:
                await context.bot.send_message(
                    chat_id=creator_id,
                    text=(
                        f"\u274c *Book Rejected*\n\n"
                        f"\U0001f4d6 *{book_title}* was not approved.\n\n"
                        f"Please review your submission and try again."
                    ),
                    parse_mode='Markdown',
                )
            except Exception:
                pass


# ── Founder: Manage All Books ──────────────────────────────────────

async def admin_manage_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: list all approved books with delete options."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, c.title, u.username, c.status "
        "FROM content c LEFT JOIN users u ON c.creator_telegram_id = u.telegram_id "
        "WHERE c.deleted_at IS NULL ORDER BY c.id DESC LIMIT 30"
    )
    rows = cur.fetchall()
    conn.close()
    if not rows:
        await _safe_edit(query, "No books.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')]]))
        return
    keyboard = []
    for cid, title, creator, status in rows:
        label = f"\U0001f4d6 {title}"
        if creator:
            label += f" (@{creator})"
        if status != 'approved':
            label += f" [{status}]"
        keyboard.append([
            InlineKeyboardButton(label, callback_data=f'book_{cid}'),
            InlineKeyboardButton("\U0001f5d1", callback_data=f'fdel_book_{cid}'),
        ])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')])
    await _safe_edit(query, 
        "\U0001f4da *All Books*\n\nTap \U0001f5d1 to delete:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def founder_del_book_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: confirm delete for any book."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT title FROM content WHERE id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    title = row[0] if row else f"Book #{content_id}"
    keyboard = [
        [InlineKeyboardButton("\U0001f5d1 Soft Delete (recoverable)", callback_data=f'fsdel_{content_id}')],
        [InlineKeyboardButton("\U0001f6a8 Permanent Delete (forever)", callback_data=f'fpdel_{content_id}')],
        [InlineKeyboardButton("\u274c Cancel", callback_data='admin_manage_books')],
    ]
    await _safe_edit(query, 
        f"\u26a0\ufe0f *Delete \"{title}\"?*\n\n"
        f"Choose deletion type:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def founder_soft_del_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: soft-delete any book."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    try:
        content_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    from content.deletion_service import soft_delete_book
    ok = soft_delete_book(content_id)
    msg = "\U0001f5d1 Book soft-deleted. Creator can recover it." if ok else "\u274c Failed."
    await _safe_edit(query, msg, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='admin_manage_books')]]))


async def founder_perm_del_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: permanently delete any book."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    try:
        content_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    from content.deletion_service import permanent_delete_book
    ok = permanent_delete_book(content_id)
    msg = "\U0001f6a8 Book permanently deleted." if ok else "\u274c Failed."
    await _safe_edit(query, msg, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='admin_manage_books')]]))


async def founder_del_order_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder: delete an order."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    try:
        order_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    from content.deletion_service import founder_delete_order
    ok = founder_delete_order(order_id)
    msg = "\U0001f5d1 Order deleted." if ok else "\u274c Failed."
    await _safe_edit(query, msg, reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Orders", callback_data='admin_review_orders')]]))
