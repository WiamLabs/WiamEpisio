import logging
import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto, Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)

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


def ensure_channel_posts_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS channel_posts (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL,
        channel_message_id BIGINT NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS channel_carousels (
        id SERIAL PRIMARY KEY,
        creator_wiam_id BIGINT NOT NULL UNIQUE,
        channel_message_id BIGINT NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()


def get_channel_id() -> int | None:
    raw = (os.getenv("CHANNEL_ID") or "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _get_bot_username() -> str:
    return os.getenv("BOT_USERNAME", "WiamAppBot")


# --------------- Carousel helpers ---------------

def _get_creator_approved_books(creator_wiam_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, author, description, cover_file_id, price_buy_now, price_1_day "
        "FROM content WHERE creator_wiam_id=%s AND status IN ('approved','ongoing','complete') AND deleted_at IS NULL ORDER BY id",
        (creator_wiam_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def _get_creator_name(creator_wiam_id: int) -> str:
    from creators.profile_service import get_creator_pen_name
    pen = get_creator_pen_name(creator_wiam_id)
    if pen:
        return pen
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT username, first_name FROM users WHERE wiam_id=%s",
        (creator_wiam_id,),
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return row[0] or row[1] or str(creator_wiam_id)
    return str(creator_wiam_id)


def _build_carousel_caption(creator_name, book, index, total):
    content_id, title, author, description, cover_file_id, price_buy_now, price_1_day = book
    lines = [f"\u270d\ufe0f *{creator_name}* \u00b7 \U0001f4da {index + 1}/{total}"]
    lines.append(f"\U0001f4d6 *{title}*")
    if author:
        lines.append(f"_{author}_")
    if description:
        desc = description.strip()
        if len(desc) > 80:
            desc = desc[:77].rstrip() + "..."
        lines.append(desc)
    price_parts = []
    if price_buy_now is not None:
        try:
            price_parts.append(f"Buy GH\u20b5{float(price_buy_now):,.0f}")
        except (TypeError, ValueError):
            pass
    if price_1_day is not None:
        try:
            price_parts.append(f"From GH\u20b5{float(price_1_day):,.0f}/day")
        except (TypeError, ValueError):
            pass
    if price_parts:
        lines.append(f"\U0001f4b0 {' \u00b7 '.join(price_parts)}")
    return "\n".join(lines)


def _build_carousel_keyboard(creator_wiam_id, content_id, index, total):
    bot_username = _get_bot_username()
    book_link = f"https://t.me/{bot_username}?start=book_{content_id}"
    all_books_link = f"https://t.me/{bot_username}?start=creator_{creator_wiam_id}"
    nav_row = []
    if total > 1:
        prev_idx = (index - 1) % total
        next_idx = (index + 1) % total
        nav_row = [
            InlineKeyboardButton("◀️", callback_data=f"ch_nav_{creator_wiam_id}_{prev_idx}"),
            InlineKeyboardButton(f"{index + 1}/{total}", callback_data="noop"),
            InlineKeyboardButton("▶️", callback_data=f"ch_nav_{creator_wiam_id}_{next_idx}"),
        ]
    keyboard = []
    if nav_row:
        keyboard.append(nav_row)
    keyboard.append([InlineKeyboardButton("\U0001f4cb See Full Details & Buy", url=book_link)])
    keyboard.append([InlineKeyboardButton("\U0001f4da See All Books", url=all_books_link)])
    return InlineKeyboardMarkup(keyboard)


def _save_carousel(creator_wiam_id: int, channel_message_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO channel_carousels (creator_wiam_id, channel_message_id) "
        "VALUES (%s, %s) "
        "ON CONFLICT (creator_wiam_id) DO UPDATE SET channel_message_id=%s",
        (creator_wiam_id, channel_message_id, channel_message_id),
    )
    conn.commit()
    conn.close()


def _get_carousel_message_id(creator_wiam_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT channel_message_id FROM channel_carousels WHERE creator_wiam_id=%s",
        (creator_wiam_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


# --------------- Post / update carousel ---------------

async def post_creator_carousel(bot, creator_wiam_id: int, index: int = 0):
    channel_id = get_channel_id()
    if channel_id is None:
        return False, "CHANNEL_ID not set"

    books = _get_creator_approved_books(creator_wiam_id)
    if not books:
        return False, "No approved books for this creator"

    if index >= len(books):
        index = 0
    book = books[index]
    creator_name = _get_creator_name(creator_wiam_id)
    caption = _build_carousel_caption(creator_name, book, index, len(books))
    keyboard = _build_carousel_keyboard(creator_wiam_id, book[0], index, len(books))
    cover_file_id = book[4]

    try:
        if cover_file_id:
            msg = await bot.send_photo(
                chat_id=channel_id,
                photo=cover_file_id,
                caption=caption,
                reply_markup=keyboard,
                parse_mode='Markdown',
                protect_content=True,
            )
        else:
            msg = await bot.send_message(
                chat_id=channel_id,
                text=caption,
                reply_markup=keyboard,
                parse_mode='Markdown',
                protect_content=True,
            )
        _save_carousel(creator_wiam_id, msg.message_id)
        return True, None
    except Exception as e:
        logger.error(f"Failed to post carousel: {e}")
        # Retry without Markdown
        try:
            if cover_file_id:
                msg = await bot.send_photo(
                    chat_id=channel_id, photo=cover_file_id,
                    caption=caption, reply_markup=keyboard,
                    protect_content=True,
                )
            else:
                msg = await bot.send_message(
                    chat_id=channel_id, text=caption, reply_markup=keyboard,
                    protect_content=True,
                )
            _save_carousel(creator_wiam_id, msg.message_id)
            return True, None
        except Exception as e2:
            return False, str(e2)


async def update_carousel(bot, creator_wiam_id: int, index: int):
    channel_id = get_channel_id()
    if not channel_id:
        return

    msg_id = _get_carousel_message_id(creator_wiam_id)
    if not msg_id:
        return

    books = _get_creator_approved_books(creator_wiam_id)
    if not books:
        return
    if index >= len(books):
        index = 0

    book = books[index]
    creator_name = _get_creator_name(creator_wiam_id)
    caption = _build_carousel_caption(creator_name, book, index, len(books))
    keyboard = _build_carousel_keyboard(creator_wiam_id, book[0], index, len(books))
    cover_file_id = book[4]

    try:
        if cover_file_id:
            await bot.edit_message_media(
                chat_id=channel_id,
                message_id=msg_id,
                media=InputMediaPhoto(media=cover_file_id, caption=caption, parse_mode='Markdown'),
                reply_markup=keyboard,
            )
        else:
            await bot.edit_message_text(
                chat_id=channel_id,
                message_id=msg_id,
                text=caption,
                reply_markup=keyboard,
                parse_mode='Markdown',
            )
    except Exception as e:
        err_msg = str(e).lower()
        if 'message is not modified' in err_msg:
            return  # content unchanged, nothing to do
        if 'message to edit not found' in err_msg or 'message not found' in err_msg:
            # Stale message — clear old record and post a fresh carousel
            logger.info(f"Carousel message gone for creator {creator_wiam_id}, re-posting.")
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("DELETE FROM channel_carousels WHERE creator_wiam_id=%s", (creator_wiam_id,))
            conn.commit()
            conn.close()
            await post_creator_carousel(bot, creator_wiam_id, index)
            return
        logger.error(f"Failed to update carousel: {e}")
        # Retry without Markdown
        try:
            if cover_file_id:
                await bot.edit_message_media(
                    chat_id=channel_id,
                    message_id=msg_id,
                    media=InputMediaPhoto(media=cover_file_id, caption=caption),
                    reply_markup=keyboard,
                )
            else:
                await bot.edit_message_text(
                    chat_id=channel_id, message_id=msg_id,
                    text=caption, reply_markup=keyboard,
                )
        except Exception:
            pass


# --------------- Carousel navigation callback (from channel) ---------------

async def carousel_nav_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split("_")
        creator_id = int(parts[2])
        index = int(parts[3])
    except (IndexError, ValueError):
        return
    await update_carousel(context.bot, creator_id, index)


# --------------- Channel update handler ---------------

async def channel_update_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.channel_post and update.channel_post.chat:
        chat = update.channel_post.chat
        logger.info(f"Channel update from: {chat.title} (ID: {chat.id})")
    return


def _is_channel_chat(update: Update) -> bool:
    chat = update.effective_chat
    if not chat:
        return False
    return chat.type == "channel"


# --------------- Admin UI: list creators to post ---------------

def _get_creators_with_approved_books():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT DISTINCT c.creator_wiam_id, u.username, u.first_name, "
        "  (SELECT COUNT(*) FROM content WHERE creator_wiam_id=c.creator_wiam_id AND status IN ('approved','ongoing','complete') AND deleted_at IS NULL) "
        "FROM content c "
        "LEFT JOIN users u ON c.creator_wiam_id = u.wiam_id "
        "WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL AND c.creator_wiam_id IS NOT NULL "
        "ORDER BY u.username"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


async def channel_post_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if _is_channel_chat(update):
        await _safe_edit(query, "Not available in channels.")
        return
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    creators = _get_creators_with_approved_books()
    if not creators:
        await _safe_edit(query, "No creators with approved books to post.")
        return

    keyboard = []
    for creator_id, username, first_name, book_count in creators:
        name = username or first_name or str(creator_id)
        label = f"✍️ {name} ({book_count} books)"
        keyboard.append([InlineKeyboardButton(label, callback_data=f"channel_post_{creator_id}")])
    back_cb = 'open_founder_dashboard' if role == ROLE_FOUNDER else 'open_admin_panel'
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back", callback_data=back_cb)])

    await _safe_edit(query, 
        "Choose a creator to post/update their carousel in the channel:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def curated_feedback_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show books that have comments, for selecting curated feedback to post."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.content_id, co.title, COUNT(*) as cnt "
        "FROM comments c JOIN content co ON c.content_id = co.id "
        "GROUP BY c.content_id, co.title "
        "HAVING COUNT(*) > 0 ORDER BY cnt DESC LIMIT 20"
    )
    rows = cur.fetchall()
    conn.close()
    back_cb = 'open_founder_dashboard' if role == ROLE_FOUNDER else 'open_admin_panel'
    if not rows:
        await _safe_edit(query, "No books with comments yet.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)]]))
        return
    keyboard = []
    for cid, title, cnt in rows:
        keyboard.append([InlineKeyboardButton(f"\U0001f4ac {title} ({cnt} comments)", callback_data=f'curated_book_{cid}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)])
    await _safe_edit(query, "\U0001f4ac *Select a book to post curated feedback:*",
        reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def curated_book_comments_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show comments for a book — tap to post to channel."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, u.username, u.first_name, c.text "
        "FROM comments c JOIN users u ON c.user_id = u.wiam_id "
        "WHERE c.content_id=%s ORDER BY c.created_at DESC LIMIT 10",
        (book_id,),
    )
    rows = cur.fetchall()
    cur.execute("SELECT title FROM content WHERE id=%s", (book_id,))
    title_row = cur.fetchone()
    conn.close()
    book_title = title_row[0] if title_row else f"Book #{book_id}"
    if not rows:
        await _safe_edit(query, "No comments for this book.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')]]))
        return
    text = f"\U0001f4ac *Comments for: {book_title}*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
    keyboard = []
    for cid, uname, fname, ctext in rows:
        name = uname or fname or "Reader"
        text += f"\U0001f464 *{name}*: {ctext}\n\n"
        keyboard.append([InlineKeyboardButton(f"\U0001f4e2 Post \"{ctext[:30]}...\"", callback_data=f'postfeedback_{book_id}_{cid}')])
    keyboard.append([InlineKeyboardButton("\U0001f4e2 Post ALL to Channel", callback_data=f'postfeedback_all_{book_id}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def post_feedback_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Post selected comment(s) to channel as curated feedback."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return
    channel_id = get_channel_id()
    if not channel_id:
        await _safe_edit(query, "\u26a0\ufe0f Channel not configured.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')]]))
        return

    data = query.data
    conn = get_db_connection()
    cur = conn.cursor()

    if data.startswith('postfeedback_all_'):
        # Post all comments for a book
        book_id = int(data.split('_')[2])
        cur.execute("SELECT title FROM content WHERE id=%s", (book_id,))
        title_row = cur.fetchone()
        book_title = title_row[0] if title_row else f"Book #{book_id}"
        cur.execute(
            "SELECT u.username, u.first_name, c.text "
            "FROM comments c JOIN users u ON c.user_id = u.wiam_id "
            "WHERE c.content_id=%s ORDER BY c.created_at DESC LIMIT 5",
            (book_id,),
        )
        rows = cur.fetchall()
        conn.close()
        if not rows:
            await _safe_edit(query, "No comments to post.")
            return
        bot_user = _get_bot_username()
        msg = f"\U0001f4ac *Reader Reviews \u2014 {book_title}*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        for uname, fname, ctext in rows:
            name = uname or fname or "Reader"
            msg += f"\u2b50 _{name}_: \"{ctext}\"\n\n"
        msg += f"\U0001f449 Read it now: @{bot_user}"
        try:
            await context.bot.send_message(chat_id=channel_id, text=msg, parse_mode='Markdown')
            await _safe_edit(query, "\u2705 Curated feedback posted to channel!",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')]]))
        except Exception as e:
            await _safe_edit(query, f"\u274c Failed to post: {e}",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')]]))
    else:
        # Post single comment
        parts = data.split('_')
        book_id = int(parts[1])
        comment_id = int(parts[2])
        cur.execute("SELECT title FROM content WHERE id=%s", (book_id,))
        title_row = cur.fetchone()
        book_title = title_row[0] if title_row else f"Book #{book_id}"
        cur.execute(
            "SELECT u.username, u.first_name, c.text "
            "FROM comments c JOIN users u ON c.user_id = u.wiam_id "
            "WHERE c.id=%s",
            (comment_id,),
        )
        row = cur.fetchone()
        conn.close()
        if not row:
            await _safe_edit(query, "Comment not found.")
            return
        uname, fname, ctext = row
        name = uname or fname or "Reader"
        bot_user = _get_bot_username()
        msg = (
            f"\U0001f4ac *Reader Review \u2014 {book_title}*\n\n"
            f"\u2b50 _{name}_: \"{ctext}\"\n\n"
            f"\U0001f449 Read it now: @{bot_user}"
        )
        try:
            await context.bot.send_message(chat_id=channel_id, text=msg, parse_mode='Markdown')
            await _safe_edit(query, "\u2705 Feedback posted to channel!",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'curated_book_{book_id}')]]))
        except Exception as e:
            await _safe_edit(query, f"\u274c Failed: {e}",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='curated_feedback')]]))


async def channel_post_action_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if _is_channel_chat(update):
        await _safe_edit(query, "Not available in channels.")
        return
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    try:
        creator_id = int(query.data.split("_", 2)[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid selection.")
        return

    back_cb = 'open_founder_dashboard' if role == ROLE_FOUNDER else 'open_admin_panel'
    back_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("\U0001f4e2 Post More", callback_data='channel_post_list')],
        [InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)],
    ])

    existing_msg = _get_carousel_message_id(creator_id)
    if existing_msg:
        # Update existing carousel
        await update_carousel(context.bot, creator_id, 0)
        await _safe_edit(query, "\u2705 Carousel updated in channel!", reply_markup=back_kb)
    else:
        # Post new carousel
        ok, err = await post_creator_carousel(context.bot, creator_id)
        if ok:
            await _safe_edit(query, "\u2705 Carousel posted to channel!", reply_markup=back_kb)
        else:
            msg = "\u26a0\ufe0f Could not post to channel."
            if err:
                msg += f"\n\nError: {err}"
            await _safe_edit(query, msg, reply_markup=back_kb)
