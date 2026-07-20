from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

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

USERS_PER_PAGE = 10

_BACK_ADMIN = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_users')]])


def ensure_user_status_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'")
    conn.commit()
    conn.close()


# ── Main Users Dashboard ─────────────────────────────────────────

async def dash_users_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    total_users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE role='user'")
    regular_users = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE role='creator'")
    creators = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE role='admin'")
    admins = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE last_active >= CURRENT_TIMESTAMP - INTERVAL '24 hours'")
    active_24h = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM users WHERE date_joined >= CURRENT_TIMESTAMP - INTERVAL '7 days'")
    new_7d = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT user_id) FROM orders WHERE status='approved'")
    paying_users = cur.fetchone()[0]
    conn.close()

    text = (
        f"\U0001f465 *Users Dashboard*\n\n"
        f"\U0001f4ca *Stats:*\n"
        f"Total users: *{total_users}*\n"
        f"Regular users: *{regular_users}*\n"
        f"Creators: *{creators}*\n"
        f"Admins: *{admins}*\n\n"
        f"\U0001f4c8 *Activity:*\n"
        f"Active (24h): *{active_24h}*\n"
        f"New (7 days): *{new_7d}*\n"
        f"Paying customers: *{paying_users}*"
    )

    back_cb = 'open_founder_dashboard' if role == ROLE_FOUNDER else 'open_admin_panel'
    keyboard = [
        [InlineKeyboardButton("\U0001f4cb Browse All Users", callback_data='users_browse_0')],
        [InlineKeyboardButton("\U0001f31f Recent Users", callback_data='users_recent_0')],
        [InlineKeyboardButton("\U0001f4b0 Paying Customers", callback_data='users_paying_0')],
        [InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


# ── Browse Users (paginated) ─────────────────────────────────────

async def users_browse_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    data = query.data  # users_browse_0, users_recent_0, users_paying_0
    try:
        page = int(data.rsplit('_', 1)[1])
    except (IndexError, ValueError):
        page = 0

    mode = 'browse'
    if 'recent' in data:
        mode = 'recent'
    elif 'paying' in data:
        mode = 'paying'

    conn = get_db_connection()
    cur = conn.cursor()

    if mode == 'recent':
        cur.execute("SELECT COUNT(*) FROM users WHERE date_joined >= CURRENT_TIMESTAMP - INTERVAL '30 days'")
        total = cur.fetchone()[0]
        offset = page * USERS_PER_PAGE
        cur.execute(
            "SELECT telegram_id, username, first_name, role, date_joined, last_active "
            "FROM users WHERE date_joined >= CURRENT_TIMESTAMP - INTERVAL '30 days' "
            "ORDER BY date_joined DESC LIMIT %s OFFSET %s",
            (USERS_PER_PAGE, offset),
        )
        title = "\U0001f31f Recent Users (30 days)"
        prefix = 'users_recent'
    elif mode == 'paying':
        cur.execute(
            "SELECT COUNT(DISTINCT o.user_id) FROM orders o WHERE o.status='approved'"
        )
        total = cur.fetchone()[0]
        offset = page * USERS_PER_PAGE
        cur.execute(
            "SELECT DISTINCT u.telegram_id, u.username, u.first_name, u.role, u.date_joined, u.last_active "
            "FROM users u JOIN orders o ON u.telegram_id = o.user_id "
            "WHERE o.status='approved' "
            "ORDER BY u.last_active DESC LIMIT %s OFFSET %s",
            (USERS_PER_PAGE, offset),
        )
        title = "\U0001f4b0 Paying Customers"
        prefix = 'users_paying'
    else:
        cur.execute("SELECT COUNT(*) FROM users")
        total = cur.fetchone()[0]
        offset = page * USERS_PER_PAGE
        cur.execute(
            "SELECT telegram_id, username, first_name, role, date_joined, last_active "
            "FROM users ORDER BY date_joined DESC LIMIT %s OFFSET %s",
            (USERS_PER_PAGE, offset),
        )
        title = "\U0001f4cb All Users"
        prefix = 'users_browse'

    rows = cur.fetchall()
    conn.close()

    if not rows:
        await _safe_edit(query, "No users found.", reply_markup=_BACK_ADMIN)
        return

    total_pages = max(1, (total + USERS_PER_PAGE - 1) // USERS_PER_PAGE)

    keyboard = []
    for tid, uname, fname, urole, joined, last_act in rows:
        name = uname or fname or str(tid)
        role_icon = {"founder": "\U0001f451", "admin": "\U0001f6e0\ufe0f", "creator": "\u270d\ufe0f"}.get(urole, "\U0001f464")
        keyboard.append([InlineKeyboardButton(
            f"{role_icon} {name}",
            callback_data=f'user_detail_{tid}',
        )])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("\u25c0 Prev", callback_data=f'{prefix}_{page - 1}'))
    if page < total_pages - 1:
        nav.append(InlineKeyboardButton("Next \u25b6", callback_data=f'{prefix}_{page + 1}'))
    if nav:
        keyboard.append(nav)
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='dash_users')])

    await _safe_edit(query, 
        f"{title} \u2014 Page {page + 1}/{total_pages}  ({total} total)",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# ── User Detail ───────────────────────────────────────────────────

async def user_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    try:
        target_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid user.", reply_markup=_BACK_ADMIN)
        return

    conn = get_db_connection()
    cur = conn.cursor()

    # User info
    cur.execute(
        "SELECT telegram_id, username, first_name, last_name, role, date_joined, last_active, source, "
        "COALESCE(status, 'active') "
        "FROM users WHERE telegram_id=%s",
        (target_id,),
    )
    user = cur.fetchone()
    if not user:
        conn.close()
        await _safe_edit(query, "User not found.", reply_markup=_BACK_ADMIN)
        return

    tid, uname, fname, lname, urole, joined, last_act, source, ustatus = user

    # Favorites count
    cur.execute("SELECT COUNT(*) FROM favorites WHERE user_id=%s", (target_id,))
    fav_count = cur.fetchone()[0]

    # Active access count
    cur.execute(
        "SELECT COUNT(*) FROM access WHERE user_id=%s AND status='active'",
        (target_id,),
    )
    access_count = cur.fetchone()[0]

    # Orders count
    cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=%s", (target_id,))
    order_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM orders WHERE user_id=%s AND status='approved'", (target_id,))
    approved_orders = cur.fetchone()[0]

    conn.close()

    name = fname or ""
    if lname:
        name += f" {lname}"
    name = name.strip() or "N/A"
    role_label = urole.title() if urole else "User"
    joined_str = str(joined)[:10] if joined else "N/A"
    last_str = str(last_act)[:10] if last_act else "N/A"

    status_icon = {"active": "\u2705", "banned": "\U0001f6ab", "blocked": "\U0001f6d1"}.get(ustatus, "\u2705")
    status_label = ustatus.title() if ustatus else "Active"

    text = (
        f"\U0001f464 *User Profile*\n\n"
        f"*Name:* {name}\n"
    )
    if uname:
        text += f"*Username:* @{uname}\n"
    text += (
        f"*Telegram ID:* `{tid}`\n"
        f"*Role:* {role_label}\n"
        f"*Status:* {status_icon} {status_label}\n"
        f"*Joined:* {joined_str}\n"
        f"*Last Active:* {last_str}\n"
        f"*Source:* {source or 'private'}\n\n"
        f"\u2764\ufe0f Favorites: *{fav_count}*\n"
        f"\U0001f4da Library (active): *{access_count}*\n"
    )
    # Only founder sees order/payment info
    if role == ROLE_FOUNDER:
        text += f"\U0001f4b0 Orders: *{approved_orders}/{order_count}* approved\n"

    keyboard = [
        [InlineKeyboardButton("\u2764\ufe0f View Favorites", callback_data=f'user_favs_{target_id}')],
        [InlineKeyboardButton("\U0001f4da View Library", callback_data=f'user_lib_{target_id}')],
    ]
    if role == ROLE_FOUNDER:
        keyboard.append([InlineKeyboardButton("\U0001f4b0 View Orders", callback_data=f'user_orders_{target_id}')])

    # Ban/Block buttons — for regular users and creators (not admins/founder)
    if urole in ('user', 'creator'):
        if ustatus == 'banned':
            keyboard.append([InlineKeyboardButton("\u2705 Unban User", callback_data=f'user_unban_{target_id}')])
        else:
            keyboard.append([InlineKeyboardButton("\U0001f6ab Ban User", callback_data=f'user_ban_{target_id}')])
        if ustatus == 'blocked':
            keyboard.append([InlineKeyboardButton("\u2705 Unblock User", callback_data=f'user_unblock_{target_id}')])
        else:
            keyboard.append([InlineKeyboardButton("\U0001f6d1 Block User", callback_data=f'user_block_{target_id}')])

    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='users_browse_0')])

    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


# ── User Favorites ────────────────────────────────────────────────

async def user_favs_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    try:
        target_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, c.title, c.author FROM favorites f "
        "JOIN content c ON f.content_id = c.id "
        "WHERE f.user_id=%s AND c.deleted_at IS NULL ORDER BY c.title",
        (target_id,),
    )
    rows = cur.fetchall()
    conn.close()

    back_btn = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]])

    if not rows:
        await _safe_edit(query, "This user has no favorites.", reply_markup=back_btn)
        return

    keyboard = []
    for cid, title, author in rows:
        label = f"\u2b50 {title}"
        if author:
            label += f" \u2014 {author}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{cid}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')])

    await _safe_edit(query, 
        f"\u2764\ufe0f *Favorites* ({len(rows)} books)",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


# ── User Library (Access) ────────────────────────────────────────

async def user_lib_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    try:
        target_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT a.content_id, c.title, a.access_type, a.status, a.end_date "
        "FROM access a JOIN content c ON a.content_id = c.id "
        "WHERE a.user_id=%s ORDER BY a.start_date DESC",
        (target_id,),
    )
    rows = cur.fetchall()
    conn.close()

    back_btn = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]])

    if not rows:
        await _safe_edit(query, "This user has no library items.", reply_markup=back_btn)
        return

    lines = [f"\U0001f4da *User Library* ({len(rows)} items)\n"]
    for cid, title, atype, astatus, end_date in rows:
        status_icon = "\u2705" if astatus == 'active' else "\u274c"
        access_label = atype.title() if atype else "Unknown"
        end_str = f" (until {str(end_date)[:10]})" if end_date else ""
        lines.append(f"{status_icon} *{title}* \u2014 {access_label}{end_str}")

    keyboard = [[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]]
    await _safe_edit(query, 
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


# ── User Orders ───────────────────────────────────────────────────

async def user_orders_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return

    try:
        target_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT o.id, c.title, o.status, o.reference_code, o.payment_method "
        "FROM orders o JOIN content c ON o.content_id = c.id "
        "WHERE o.user_id=%s ORDER BY o.id DESC LIMIT 15",
        (target_id,),
    )
    rows = cur.fetchall()
    conn.close()

    back_btn = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]])

    if not rows:
        await _safe_edit(query, "This user has no orders.", reply_markup=back_btn)
        return

    lines = [f"\U0001f4b0 *User Orders* ({len(rows)} shown)\n"]
    for oid, title, ostatus, ref, method in rows:
        status_icon = {
            'approved': '\u2705', 'rejected': '\u274c',
            'pending_review': '\U0001f4f8', 'awaiting_payment': '\u23f3',
        }.get(ostatus, '\u2753')
        lines.append(f"{status_icon} #{oid} *{title}* \u2014 {ostatus.replace('_', ' ').title()}")
        if ref:
            lines.append(f"   Ref: `{ref}` | {method or 'N/A'}")

    keyboard = [[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]]
    await _safe_edit(query, 
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


# ── Ban / Unban / Block / Unblock ────────────────────────────────

async def user_ban_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ban a regular user — they cannot use the bot at all."""
    await _set_user_status(update, context, 'banned', "\U0001f6ab User has been *banned*. They cannot use the bot.")


async def user_unban_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Unban a user — restore to active."""
    await _set_user_status(update, context, 'active', "\u2705 User has been *unbanned* and restored to active.")


async def user_block_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Block a user — they can browse but cannot purchase or access content."""
    await _set_user_status(update, context, 'blocked', "\U0001f6d1 User has been *blocked*. They can browse but cannot purchase.")


async def user_unblock_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Unblock a user — restore to active."""
    await _set_user_status(update, context, 'active', "\u2705 User has been *unblocked* and restored to active.")


async def _set_user_status(update: Update, context: ContextTypes.DEFAULT_TYPE, new_status: str, message: str):
    query = update.callback_query
    try:
        await query.answer()
    except Exception:
        pass
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    try:
        target_id = int(query.data.rsplit('_', 1)[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid user.", reply_markup=_BACK_ADMIN)
        return

    # Only allow banning/blocking regular users and creators (not admins/founder)
    target_role = get_user_role(target_id)
    if target_role not in ('user', 'creator'):
        await _safe_edit(query, 
            f"Cannot change status of a {target_role}. Only users and creators can be banned/blocked.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'user_detail_{target_id}')]]),
        )
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET status=%s WHERE telegram_id=%s", (new_status, target_id))
    conn.commit()
    conn.close()

    # Notify the target user
    notifications = {
        'banned': (
            "\U0001f6ab *Your account has been banned.*\n\n"
            "You can no longer use this bot.\n\n"
            "If you believe this is an error, contact support:\n"
            "\U0001f4e7 support@wiamapp.com"
        ),
        'blocked': (
            "\U0001f6d1 *Your account has been blocked.*\n\n"
            "You can still browse books but cannot make purchases.\n\n"
            "If you believe this is an error, contact support:\n"
            "\U0001f4e7 support@wiamapp.com"
        ),
        'active': (
            "\u2705 *Your account has been restored!*\n\n"
            "You now have full access to the bot again.\n"
            "Use /start to continue."
        ),
    }
    try:
        await context.bot.send_message(
            chat_id=target_id,
            text=notifications.get(new_status, "Your account status has been updated."),
            parse_mode='Markdown',
        )
    except Exception:
        pass

    keyboard = [
        [InlineKeyboardButton("\U0001f464 View User", callback_data=f'user_detail_{target_id}')],
        [InlineKeyboardButton("\u25c0 Back to Users", callback_data='dash_users')],
    ]
    await _safe_edit(query, message, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


def get_user_status(telegram_id: int) -> str:
    """Check if a user is banned or blocked. Returns 'active', 'banned', or 'blocked'."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(status, 'active') FROM users WHERE telegram_id=%s", (telegram_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 'active'
