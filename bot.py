import os
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, ApplicationHandlerStop, CommandHandler, CallbackQueryHandler, ContextTypes, ConversationHandler, MessageHandler, filters
 
from core.db import get_db_connection
from core.role_manager import get_user_role, ROLE_ADMIN, ROLE_CREATOR, ROLE_FOUNDER
from core.user_tracker import ensure_user_tracking_schema, upsert_user
from creators.applications import apply_for_creator, ensure_creator_application_schema, get_creator_application_status
from creators.profile_service import ensure_creator_profile_schema
from creators.app_handlers import (
    apply_creator_callback, apply_status_callback,
    apply_pen_name, apply_bio, apply_country, apply_profile_pic, apply_skip_pic, apply_confirm_callback,
    APPLY_PEN_NAME, APPLY_BIO, APPLY_COUNTRY, APPLY_PROFILE_PIC, APPLY_CONFIRM,
)
from dashboards.admin_dashboard import approve_content_action, approve_content_list, show_admin_panel
from dashboards.admin_management import (
    ADMIN_ADD_ID,
    ADMIN_REMOVE_ID,
    add_admin_id,
    add_admin_start,
    list_admins,
    remove_admin_id,
    remove_admin_start,
    show_admin_management,
)
from dashboards.creator_dashboard import (
    creator_content_item_callback,
    creator_edit_payment_input,
    creator_edit_payment_start,
    creator_edit_profile_callback,
    creator_my_content_callback,
    creator_my_plan_callback,
    creator_my_stats_callback,
    creator_payment_details_callback,
    creator_profile_callback,
    creator_profile_edit_input,
    edit_prices_input,
    edit_prices_start,
    show_creator_dashboard,
    toggle_comments_callback,
    replace_pdf_callback,
    replace_cover_callback,
    replace_pdf_input,
    replace_cover_input,
    creator_my_orders_callback,
    creator_platform_fee_callback,
    pay_platform_fee_callback,
)
from dashboards.founder_dashboard import founder_menu
from dashboards.users_dashboard import (
    dash_users_callback,
    ensure_user_status_schema,
    get_user_status,
    users_browse_callback,
    user_ban_callback,
    user_block_callback,
    user_detail_callback,
    user_favs_callback,
    user_lib_callback,
    user_orders_callback,
    user_unban_callback,
    user_unblock_callback,
)
from content.book_browser import (
    back_to_menu_callback,
    book_detail_callback,
    browse_books_callback,
    browse_list_callback,
    buy_chapter_callback,
    buy_now_callback,
    chapters_list_callback,
    choose_days_callback,
    listen_book_callback,
    listen_book_lang_callback,
    listen_book_voice_callback,
    listen_chapter_callback,
    listen_chapter_lang_callback,
    listen_chapter_voice_callback,
    new_releases_callback,
    preview_callback,
    read_book_callback,
    read_chapter_callback,
    read_orig_callback,
    read_trans_callback,
    read_translang_callback,
    rent_callback,
    search_books,
    trending_books_callback,
)
from content.favorites import favorites, save_fav, remove_fav
from content.deletion_service import ensure_deletion_schema
from content.drafts_service import ensure_drafts_schema
from content.feedback_service import ensure_feedback_schema
from content.audio_service import ensure_audio_schema
from content.ratings import ensure_ratings_schema, rate_book_callback, set_rate_callback
from content.comments import ensure_comments_schema, view_comments_callback, add_comment_callback, comment_text_input
from content.follows import ensure_follows_schema, follow_creator_callback
from content.book_browser import view_creator_profile_callback
from content.reading_progress import ensure_reading_progress_schema, update_progress_callback, progress_page_input
from content.recommendations import recommendations_callback
from content.featured import (
    ensure_featured_schema, featured_books_callback, manage_featured_callback,
    feature_book_callback, unfeature_book_callback,
)
from payments.commission_service import ensure_commission_schema
from payments.order_service import ensure_orders_schema
from payments.platform_fee_service import ensure_platform_fee_schema
from payments.subscription_proof_service import ensure_subscription_proofs_schema
from payments.handlers import (
    handle_photo,
    order_action,
    order_detail_callback,
    order_proof_callback,
    pay_method_callback,
    review_orders_callback,
    view_order_proof_callback,
)
from payments.payment_evidence import ensure_payment_evidence_schema
from creators.approvals import (
    approve_creator,
    list_pending_creator_applications,
    reject_creator,
    set_payment_required,
)
from creators.content_service import ensure_book_product_schema, ensure_content_owner_schema, ensure_creator_payment_schema
from content.chapter_service import ensure_chapter_schema
from dashboards.creator_dashboard import (
    del_book_confirm,
    del_book_execute,
    creator_deleted_books_callback,
    restore_book_callback,
    permdel_book_confirm,
    permdel_book_execute,
    cancel_sub_warn,
    cancel_sub_execute,
)
from dashboards.admin_dashboard import (
    admin_manage_books_callback,
    founder_del_book_confirm,
    founder_soft_del_execute,
    founder_perm_del_execute,
    founder_del_order_callback,
)
from content.access_control import expire_old_access, ensure_access_notification_column, get_expiring_soon_access, mark_access_expiry_notified
from creators.subscription_service import (
    ensure_subscription_schema,
    ensure_subscription_notification_columns,
    expire_old_subscriptions,
    get_expiring_soon_creator_ids,
    get_just_expired_creator_ids,
    has_active_subscription,
    get_active_subscription,
    hide_books_for_expired_creators,
)
from channel.channel_integration import (
    carousel_nav_callback,
    channel_post_action_callback,
    channel_post_list_callback,
    channel_update_handler,
    curated_feedback_list_callback,
    curated_book_comments_callback,
    post_feedback_callback,
    ensure_channel_posts_schema,
)

TOKEN = os.environ.get('BOT_TOKEN')
if not TOKEN:
    raise RuntimeError("BOT_TOKEN environment variable is required. Set it in .env or your hosting provider's environment settings.")

UPLOAD_TITLE = 1
UPLOAD_AUTHOR = 2
UPLOAD_DESCRIPTION = 3
UPLOAD_GENRE = 4
UPLOAD_PRICE_BUY_NOW = 5
UPLOAD_PRICE_1_DAY = 6
UPLOAD_PRICE_2_DAYS = 7
UPLOAD_PRICE_3_DAYS = 8
UPLOAD_PRICE_4_DAYS = 9
UPLOAD_PRICE_5_DAYS = 10
UPLOAD_PRICE_30_DAYS = 11
UPLOAD_COVER = 12
UPLOAD_PDF = 13
UPLOAD_LANGUAGE = 14
UPLOAD_ALLOW_TRANSLATION = 15
UPLOAD_CHAPTERS_CHOICE = 30
UPLOAD_CHAPTER_TITLE = 31
UPLOAD_CHAPTER_PAGES = 32
UPLOAD_CHAPTER_PRICE = 33
UPLOAD_CONFIRM_CANCEL = 40
GENRE_ADD_NAME = 20
FEEDBACK_CATEGORY = 50
FEEDBACK_MESSAGE = 51
FEEDBACK_SCREENSHOT = 52

# All global text-input flags used by non-ConversationHandler MessageHandlers.
# Every "start" function that expects text input must clear all OTHER flags first.
_TEXT_INPUT_FLAGS = [
    'editing_payment', 'editing_prices_for', 'awaiting_search',
    'awaiting_commission_rate', 'awaiting_sub_price_edit',
    'awaiting_pf_rate', 'awaiting_pf_cycle',
    'cr_editing_profile', 'awaiting_comment', 'awaiting_page_progress',
    'awaiting_replace_pdf', 'awaiting_replace_cover', 'awaiting_sub_proof',
    'adding_genre',
]

def _clear_text_input_flags(context, keep=None):
    """Clear all global text-input flags except 'keep', preventing handler conflicts."""
    for flag in _TEXT_INPUT_FLAGS:
        if flag != keep:
            context.user_data.pop(flag, None)

async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    """Edit message text, gracefully handling photo messages by deleting and resending."""
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)

def get_db():
    return get_db_connection()

def _esc_md(text: str) -> str:
    """Escape Markdown V1 special characters in user-generated text."""
    if not text:
        return ''
    for ch in ('*', '_', '`', '['):
        text = text.replace(ch, '')
    return text

async def cancel_conversation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.clear()
    await update.message.reply_text("\u274c Cancelled.")
    return ConversationHandler.END

# ─── Global Error Handler ───────────────────────────────────────────
async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Log errors internally but never expose stack traces to users."""
    logger.error("Exception while handling an update:", exc_info=context.error)
    if isinstance(update, Update) and update.effective_chat:
        try:
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text="\u26a0\ufe0f Something went wrong. Please try again.\nIf this persists, use \U0001f4e8 Send Feedback to report it (add WiamLabs Team at the end).",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
            )
        except Exception:
            pass

# ─── Panic Lock ─────────────────────────────────────────────────────
_panic_lock = {'active': False}

def is_panic_locked() -> bool:
    return _panic_lock['active']

async def founder_panic_lock_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder can toggle panic lock to disable critical actions."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    _panic_lock['active'] = not _panic_lock['active']
    status = "\U0001f534 LOCKED" if _panic_lock['active'] else "\U0001f7e2 UNLOCKED"
    log_founder_action(query.from_user.id, f"Panic lock toggled: {status}")
    await _safe_edit(query,
        f"\U0001f6a8 *Panic Lock: {status}*\n\n"
        f"{'Critical actions (payments, role changes, approvals) are DISABLED.' if _panic_lock['active'] else 'All actions are enabled.'}",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton(
                "\U0001f513 Unlock" if _panic_lock['active'] else "\U0001f512 Lock",
                callback_data='founder_panic_toggle')],
            [InlineKeyboardButton("\U0001f451 Back to Control Panel", callback_data='open_founder_dashboard')],
        ]),
        parse_mode='Markdown')

# ─── Founder Action Logging ─────────────────────────────────────────
def log_founder_action(founder_id: int, action: str):
    """Log Founder-only actions to internal log and database."""
    logger.info(f"[FOUNDER ACTION] user={founder_id} action={action}")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "CREATE TABLE IF NOT EXISTS founder_action_log ("
            "id SERIAL PRIMARY KEY, founder_id BIGINT, action TEXT, "
            "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
        cur.execute(
            "INSERT INTO founder_action_log (founder_id, action) VALUES (%s, %s)",
            (founder_id, action))
        conn.commit()
        conn.close()
    except Exception:
        logger.warning(f"Could not log founder action to DB: {action}")

def _build_start_keyboard(telegram_id: int) -> list:
    """Minimal soft bot menu — web app is the main experience."""
    app_url = os.environ.get('APP_URL', '')

    keyboard = []
    if app_url:
        keyboard.append([InlineKeyboardButton("\U0001f310 Open WiamApp", url=app_url)])
    keyboard.append([InlineKeyboardButton("\U0001f4e8 Send Feedback", callback_data="send_feedback")])
    keyboard.append([InlineKeyboardButton("\U0001f4ac Help", callback_data="bot_help")])

    # Founder/Admin gets a Train Bot button
    role = get_user_role(telegram_id)
    if role in [ROLE_FOUNDER, ROLE_ADMIN]:
        keyboard.append([InlineKeyboardButton("\U0001f9e0 Train Bot", callback_data="train_bot_menu")])

    return keyboard


def _get_creator_books(creator_id: int):
    """Fetch approved books for a creator."""
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT id, title, author, description, genre, cover_file_id, "
        "price_buy_now, price_1_day, views, created_at "
        "FROM content WHERE creator_telegram_id=%s AND status IN ('approved','ongoing','complete') AND deleted_at IS NULL ORDER BY id",
        (creator_id,),
    )
    rows = c.fetchall()
    conn.close()
    return rows


def _get_creator_name(creator_id: int) -> str:
    from creators.profile_service import get_creator_pen_name
    pen = get_creator_pen_name(creator_id)
    if pen:
        return pen
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, first_name FROM users WHERE telegram_id=%s", (creator_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return row[0] or row[1] or str(creator_id)
    return str(creator_id)


def _creator_carousel_kb(creator_id, book, index, total):
    """Build carousel keyboard for a creator's book."""
    from content.book_browser import _book_card_text
    book_id = book[0]
    keyboard = []
    if total > 1:
        prev_idx = (index - 1) % total
        next_idx = (index + 1) % total
        keyboard.append([
            InlineKeyboardButton("◀️", callback_data=f'cr_nav_{creator_id}_{prev_idx}'),
            InlineKeyboardButton(f"📖 {index + 1}/{total}", callback_data='noop'),
            InlineKeyboardButton("▶️", callback_data=f'cr_nav_{creator_id}_{next_idx}'),
        ])
    keyboard.append([InlineKeyboardButton("📖 Get Book", callback_data=f'book_{book_id}')])
    keyboard.append([InlineKeyboardButton("📚 See All Books", callback_data=f'cr_all_{creator_id}')])
    keyboard.append([InlineKeyboardButton("🏠 Back to Menu", callback_data='back_to_menu')])
    return InlineKeyboardMarkup(keyboard)


async def _show_creator_books(update: Update, context: ContextTypes.DEFAULT_TYPE, creator_id: int):
    from content.book_browser import _book_card_text
    creator_name = _get_creator_name(creator_id)
    books = _get_creator_books(creator_id)

    if not books:
        await update.message.reply_text(
            f"No books available from {creator_name} at the moment.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    book = books[0]
    book_id, title, author, description, genre, cover_file_id, price_buy_now, price_1_day, views, created_at = book
    caption = f"\u270d\ufe0f *{creator_name}*\n" + _book_card_text(title, author, description, genre, price_buy_now, price_1_day, views)
    reply_markup = _creator_carousel_kb(creator_id, book, 0, len(books))

    if cover_file_id:
        try:
            await update.message.reply_photo(
                photo=cover_file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await update.message.reply_text(caption, reply_markup=reply_markup, parse_mode='Markdown')


async def creator_carousel_nav_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle ◀/▶ navigation for creator book carousel."""
    query = update.callback_query
    await query.answer()
    from content.book_browser import _book_card_text
    try:
        parts = query.data.split('_')  # cr_nav_{creator_id}_{index}
        creator_id = int(parts[2])
        index = int(parts[3])
    except (IndexError, ValueError):
        return

    creator_name = _get_creator_name(creator_id)
    books = _get_creator_books(creator_id)
    if not books:
        await _safe_edit(query, "No books available.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    if index < 0 or index >= len(books):
        index = 0

    book = books[index]
    book_id, title, author, description, genre, cover_file_id, price_buy_now, price_1_day, views, created_at = book
    caption = f"\u270d\ufe0f *{creator_name}*\n" + _book_card_text(title, author, description, genre, price_buy_now, price_1_day, views)
    reply_markup = _creator_carousel_kb(creator_id, book, index, len(books))

    if cover_file_id:
        try:
            await query.message.delete()
            await query.message.chat.send_photo(
                photo=cover_file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, caption, reply_markup=reply_markup, parse_mode='Markdown')


async def creator_books_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show text list of all a creator's books."""
    query = update.callback_query
    await query.answer()
    try:
        creator_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    creator_name = _get_creator_name(creator_id)
    books = _get_creator_books(creator_id)
    if not books:
        await _safe_edit(query, "No books available.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    keyboard = []
    for b in books:
        bid, btitle, bauthor = b[0], b[1], b[2]
        label = f"📖 {btitle}"
        if bauthor:
            label += f" — {bauthor}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{bid}')])
    keyboard.append([InlineKeyboardButton("◀️ Back to Carousel", callback_data=f'cr_nav_{creator_id}_0')])
    keyboard.append([InlineKeyboardButton("🏠 Back to Menu", callback_data='back_to_menu')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"📚 *{creator_name}'s Books* ({len(books)})",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    upsert_user(
        telegram_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )

    # Check if user is banned or blocked
    user_status = get_user_status(user.id)
    if user_status == 'banned':
        try:
            await update.message.reply_text(
                "\U0001f6ab Your account has been banned. You cannot use this bot.\n\n"
                "If you believe this is an error, contact support:\n"
                "\U0001f4e7 support@wiamapp.com"
            )
        except Exception:
            pass
        return
    if user_status == 'blocked':
        try:
            await update.message.reply_text(
                "\U0001f6d1 Your account has been temporarily blocked.\n\n"
                "If you believe this is an error, contact support:\n"
                "\U0001f4e7 support@wiamapp.com"
            )
        except Exception:
            pass
        # Don't return — let them see the menu but they'll be blocked at purchase time

    if context.args and len(context.args) > 0:
        payload = context.args[0]
        if payload.startswith('book_'):
            try:
                book_id = int(payload.split('_')[1])
                from content.book_browser import get_book_by_id, _book_card_text, _book_buttons
                book = get_book_by_id(book_id)
                if book:
                    (bid, title, author, description, genre, cover_file_id, pdf_file_id,
                     price_buy_now, price_1_day, price_2_days, price_3_days,
                     price_4_days, price_5_days, price_30_days, views, status,
                     _pf, _ps, _pe, _lang, _allow_trans) = book
                    from content.access_control import can_user_access_content
                    _viewer_access = can_user_access_content(user.id, book_id)
                    all_prices = {
                        'buy': price_buy_now, '1d': price_1_day, '2d': price_2_days,
                        '3d': price_3_days, '4d': price_4_days, '5d': price_5_days, '30d': price_30_days,
                    }
                    caption = _book_card_text(title, author, description, genre, price_buy_now, price_1_day, views,
                                              book_id=book_id, has_access=_viewer_access, all_prices=all_prices)
                    keyboard = _book_buttons(book_id, user_id=user.id)
                    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
                    reply_markup = InlineKeyboardMarkup(keyboard)
                    if cover_file_id:
                        try:
                            await update.message.reply_photo(
                                photo=cover_file_id,
                                caption=caption,
                                reply_markup=reply_markup,
                                parse_mode='Markdown',
                                protect_content=True,
                            )
                            return
                        except Exception:
                            pass
                    try:
                        await update.message.reply_text(caption, reply_markup=reply_markup, parse_mode='Markdown')
                    except Exception:
                        pass
                    return
            except (IndexError, ValueError):
                pass
        elif payload.startswith('creator_'):
            try:
                creator_id = int(payload.split('_')[1])
                await _show_creator_books(update, context, creator_id)
                return
            except (IndexError, ValueError):
                pass

    keyboard = _build_start_keyboard(user.id)
    reply_markup = InlineKeyboardMarkup(keyboard)
    display_name = user.first_name or "there"
    try:
        await update.message.reply_text(
            f"\U0001f4d6 *Welcome to WiamApp, {display_name}!*\n\n"
            f"Your personal reading space.\n"
            f"Discover, read, and support creators.\n\n"
            f"\U0001f449 Tap *Open WiamApp* to start reading.",
            reply_markup=reply_markup,
            parse_mode='Markdown',
        )
    except Exception:
        pass



async def user_my_orders_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user's recent orders with payment status."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    app_url = os.environ.get('APP_URL', '')

    try:
        conn = get_db()
        c = conn.cursor()
        c.execute(
            "SELECT o.id, c.title, o.status, o.price, o.access_type "
            "FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE o.user_id=%s ORDER BY o.id DESC LIMIT 10",
            (user_id,),
        )
        orders = c.fetchall()
        conn.close()
    except Exception:
        orders = []

    if not orders:
        text = "\U0001f4b3 *My Orders*\n\nYou have no orders yet.\nBrowse books on the web app to get started!"
    else:
        status_emoji = {
            'approved': '\u2705', 'awaiting_payment': '\u23f3',
            'pending_review': '\U0001f50d', 'rejected': '\u274c',
        }
        lines = ["\U0001f4b3 *My Orders*\n"]
        for oid, title, status, price, access_type in orders:
            emoji = status_emoji.get(status, '\u2022')
            price_str = f" — {price:.0f} ETB" if price else ""
            lines.append(f"{emoji} _{title}_{price_str}\n   Status: *{status.replace('_', ' ').title()}*")
        text = '\n'.join(lines)

    keyboard = []
    if app_url:
        keyboard.append([InlineKeyboardButton("\U0001f310 View on Web", url=f"{app_url}/profile")])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def bot_help_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show simple help / FAQ."""
    query = update.callback_query
    await query.answer()
    app_url = os.environ.get('APP_URL', '')

    text = (
        "\U0001f4ac *Help & FAQ*\n\n"
        "\U0001f4d6 *How do I read stories?*\n"
        "Open WiamApp and browse the library. All stories are free to start reading!\n\n"
        "\U0001f4b0 *What are Wiam Coins?*\n"
        "Coins let you unlock premium chapters. Buy coins in the web app.\n\n"
        "\u270d\ufe0f *How do I become a creator?*\n"
        "Apply on the web app. Once approved, you can publish stories using the Writing Studio.\n\n"
        "\U0001f4e8 *Need more help?*\n"
        "Tap Send Feedback from the main menu to reach us!"
    )

    keyboard = []
    if app_url:
        keyboard.append([InlineKeyboardButton("\U0001f310 Open WiamApp", url=app_url)])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def web_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send the user a one-click login link for the web app."""
    app_url = os.environ.get('APP_URL', '')
    if not app_url:
        await update.message.reply_text("Web app is not configured yet.")
        return

    user_id = update.effective_user.id
    # Generate a one-time login token
    import secrets
    from datetime import datetime, timezone
    token = secrets.token_urlsafe(32)

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "CREATE TABLE IF NOT EXISTS w_sessions ("
        "id SERIAL PRIMARY KEY, telegram_id BIGINT NOT NULL, "
        "token TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
    )
    # Clean old tokens for this user
    c.execute("DELETE FROM w_sessions WHERE telegram_id=%s", (user_id,))
    c.execute(
        "INSERT INTO w_sessions (telegram_id, token) VALUES (%s, %s)",
        (user_id, token),
    )
    conn.commit()
    conn.close()

    login_url = f"{app_url}/auth/bot-login?token={token}"
    keyboard = [
        [InlineKeyboardButton("\U0001f310 Open Web App (auto-login)", url=login_url)],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    await update.message.reply_text(
        "\U0001f310 *WiamApp Web*\n\n"
        "Tap the button below to open the web app.\n"
        "You'll be logged in automatically — no password needed!\n\n"
        "\u23f3 This link expires in 10 minutes.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def search_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User taps Search — prompt them to type a query."""
    query = update.callback_query
    await query.answer()
    _clear_text_input_flags(context, keep='awaiting_search')
    context.user_data['awaiting_search'] = True
    await _safe_edit(query, 
        "\U0001f50d *Search Books*\n\n"
        "Type a book title or author name to search:",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
    )


async def search_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for book search."""
    if not context.user_data.get('awaiting_search'):
        return
    context.user_data.pop('awaiting_search', None)
    query_text = update.message.text.strip()
    if len(query_text) < 2:
        await update.message.reply_text(
            "\u26a0\ufe0f Search too short. Type at least 2 characters:",
        )
        context.user_data['awaiting_search'] = True
        return

    from content.book_browser import search_books as _search, _book_card_text
    results = _search(query_text, limit=10)

    if not results:
        await update.message.reply_text(
            f"\U0001f50d No results for \"{query_text}\"\n\n"
            "Try a different title or author name.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f50d Search Again", callback_data='search_books')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    # Show results as a list of buttons
    keyboard = []
    for book in results:
        bid, title, author = book[0], book[1], book[2]
        label = f"\U0001f4d6 {title}"
        if author:
            label += f" \u2014 {author}"
        if len(label) > 60:
            label = label[:57] + "..."
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{bid}')])
    keyboard.append([InlineKeyboardButton("\U0001f50d Search Again", callback_data='search_books')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    await update.message.reply_text(
        f"\U0001f50d *Results for \"{query_text}\"* ({len(results)} found)",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def global_ban_guard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Block ALL bot interactions for banned users. Runs before every callback."""
    query = update.callback_query
    if not query or not query.from_user:
        return
    # Skip channel callbacks
    chat = query.message.chat if query.message else None
    if chat and chat.type == "channel":
        return
    ustatus = get_user_status(query.from_user.id)
    if ustatus == 'banned':
        try:
            await query.answer("\U0001f6ab Your account has been banned. Contact: support@wiamapp.com", show_alert=True)
        except Exception:
            pass
        raise ApplicationHandlerStop()
    if ustatus == 'blocked':
        # Blocked users can browse but not purchase — check if this is a payment action
        if query.data and query.data.startswith(('pay_', 'buy_now_', 'rent_', 'choose_days_')):
            try:
                await query.answer("\U0001f6d1 Your account is blocked. Contact: support@wiamapp.com", show_alert=True)
            except Exception:
                pass
            raise ApplicationHandlerStop()


async def channel_callback_guard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    chat = query.message.chat if query.message else None
    if chat and chat.type == "channel":
        # Allow carousel navigation in channel
        if query.data and query.data.startswith("ch_nav_"):
            return
        await query.answer()
        return


async def open_founder_dashboard_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    await _safe_edit(query, "\U0001f451 WiamApp Control Panel:", reply_markup=founder_menu())


async def open_admin_panel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    keyboard = [
        [InlineKeyboardButton("\U0001f4e4 Upload Book", callback_data='admin_upload_pdf')],
        [InlineKeyboardButton("\u2705 Approve Content", callback_data='admin_approve')],
        [InlineKeyboardButton("\U0001f4e2 Post to Channel", callback_data='channel_post_list')],
        [InlineKeyboardButton("\U0001f4ac Curated Feedback", callback_data='curated_feedback')],
        [InlineKeyboardButton("\U0001f465 Users Dashboard", callback_data='dash_users')],
        [InlineKeyboardButton("\u270d\ufe0f Creators Dashboard", callback_data='dash_creators')],
    ]
    if role == ROLE_FOUNDER:
        keyboard.append([InlineKeyboardButton("\U0001f4da Manage All Books", callback_data='admin_manage_books')])
        keyboard.append([InlineKeyboardButton("\U0001f3ad Manage Genres", callback_data='founder_genres')])
    keyboard.append([InlineKeyboardButton("\U0001f4c2 My Drafts", callback_data='my_drafts')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, "\U0001f6e0 Admin Panel:", reply_markup=InlineKeyboardMarkup(keyboard))


async def open_creator_dashboard_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    # No subscription gating — creators are free now (coin-based monetization)
    keyboard = [
        [InlineKeyboardButton("\U0001f464 My Profile", callback_data='creator_profile')],
        [InlineKeyboardButton("\U0001f4e4 Upload Book", callback_data='creator_upload')],
        [InlineKeyboardButton("\U0001f4da My Books", callback_data='creator_my_content')],
        [InlineKeyboardButton("\U0001f4ca My Stats", callback_data='creator_my_stats')],
    ]
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, 
        f"\u270d\ufe0f *Creator Dashboard*",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )

async def admin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await show_admin_panel(update, context)

# ── Upload flow navigation helpers ──────────────────────────────────

def _upload_nav_kb(show_back=True):
    """Return inline keyboard row with Back and Stop Uploading buttons."""
    buttons = []
    if show_back:
        buttons.append(InlineKeyboardButton("\u25c0 Back", callback_data='upload_back'))
    buttons.append(InlineKeyboardButton("\U0001f6d1 Stop Uploading", callback_data='cancel_upload'))
    return InlineKeyboardMarkup([buttons])


_UPLOAD_SIMPLE_PROMPTS = {
    UPLOAD_TITLE: "\U0001f4dd *Enter book title:*",
    UPLOAD_AUTHOR: "\u270d\ufe0f *Enter author name:*",
    UPLOAD_DESCRIPTION: "\U0001f4c4 *Enter book synopsis:*\n_A short description of what the book is about._",
    UPLOAD_GENRE: "\U0001f3f7 *Enter genre/category:*",
    UPLOAD_PRICE_BUY_NOW: "\U0001f4b0 *Enter price for Buy Now* (number):",
    UPLOAD_PRICE_1_DAY: "\U0001f4b0 *Enter price for 1 day access* (number):",
    UPLOAD_PRICE_2_DAYS: "\U0001f4b0 *Enter price for 2 days access* (number):",
    UPLOAD_PRICE_3_DAYS: "\U0001f4b0 *Enter price for 3 days access* (number):",
    UPLOAD_PRICE_4_DAYS: "\U0001f4b0 *Enter price for 4 days access* (number):",
    UPLOAD_PRICE_5_DAYS: "\U0001f4b0 *Enter price for 5 days access* (number):",
    UPLOAD_PRICE_30_DAYS: "\U0001f4b0 *Enter price for 30 days access* (number):",
    UPLOAD_COVER: "\U0001f5bc *Send the cover image* (JPG/PNG):",
    UPLOAD_PDF: "\U0001f4ce *Now send the PDF file:*",
}


async def _send_upload_prompt(target, context, state):
    """Send the upload prompt for a given state with nav buttons.
    target: CallbackQuery (will _safe_edit) or Message (will reply_text).
    Pushes state onto the navigation stack.
    """
    stack = context.user_data.setdefault('_upload_state_stack', [])
    if not stack or stack[-1] != state:
        stack.append(state)
    context.user_data['_upload_state'] = state
    is_query = hasattr(target, 'data')
    show_back = state != UPLOAD_TITLE

    # Simple text/photo/doc prompt states
    if state in _UPLOAD_SIMPLE_PROMPTS:
        text = _UPLOAD_SIMPLE_PROMPTS[state]
        kb = _upload_nav_kb(show_back=show_back)
        if is_query:
            await _safe_edit(target, text, reply_markup=kb, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=kb, parse_mode='Markdown')
        return

    # Language selection
    if state == UPLOAD_LANGUAGE:
        from content.audio_service import LANGUAGES
        keyboard = []
        for code, info in LANGUAGES.items():
            keyboard.append([InlineKeyboardButton(
                f"{info['flag']} {info['name']}", callback_data=f'uplang_{code}')])
        keyboard.append([
            InlineKeyboardButton("\u25c0 Back", callback_data='upload_back'),
            InlineKeyboardButton("\U0001f6d1 Stop Uploading", callback_data='cancel_upload'),
        ])
        text = "\U0001f30d *What language is this book written in?*"
        if is_query:
            await _safe_edit(target, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
        return

    # Translation choice
    if state == UPLOAD_ALLOW_TRANSLATION:
        lang_code = context.user_data.get('book_language', 'en')
        from content.audio_service import LANGUAGES
        lang_name = LANGUAGES.get(lang_code, {}).get('name', lang_code)
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("\u2705 Yes \u2014 Allow Translation", callback_data='allow_trans_yes')],
            [InlineKeyboardButton("\u274c No \u2014 Original Language Only", callback_data='allow_trans_no')],
            [InlineKeyboardButton("\u25c0 Back", callback_data='upload_back'),
             InlineKeyboardButton("\U0001f6d1 Stop Uploading", callback_data='cancel_upload')],
        ])
        text = (f"\U0001f30d Book language: *{lang_name}*\n\n"
                "\U0001f4d6 *Allow readers to get this book in other languages?*\n\n"
                "If yes, readers can request a translated PDF and audio in their language.\n"
                "If no, readers will only get the original version.")
        if is_query:
            await _safe_edit(target, text, reply_markup=keyboard, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')
        return

    # Chapters choice
    if state == UPLOAD_CHAPTERS_CHOICE:
        existing = context.user_data.get('chapters', [])
        if existing:
            ch_count = len(existing)
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("\u2795 Add Another Chapter", callback_data='chapters_yes')],
                [InlineKeyboardButton("\u2705 Done \u2014 Finish Upload", callback_data='chapters_no')],
                [InlineKeyboardButton("\u25c0 Back", callback_data='upload_back'),
                 InlineKeyboardButton("\U0001f6d1 Stop Uploading", callback_data='cancel_upload')],
            ])
            text = f"\u2705 {ch_count} chapter(s) defined so far.\n\nAdd another chapter or finish?"
        else:
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("\u2705 Yes \u2014 Define Chapters", callback_data='chapters_yes')],
                [InlineKeyboardButton("\u274c No \u2014 Upload as Full Book", callback_data='chapters_no')],
                [InlineKeyboardButton("\u25c0 Back", callback_data='upload_back'),
                 InlineKeyboardButton("\U0001f6d1 Stop Uploading", callback_data='cancel_upload')],
            ])
            text = ("\U0001f4d1 *Does this book have chapters?*\n\n"
                    "If yes, you can define chapters and set some as *free* "
                    "and others as *premium* (paid per chapter).\n\n"
                    "If no, it will be uploaded as a single full book.")
        if is_query:
            await _safe_edit(target, text, reply_markup=keyboard, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')
        return

    # Chapter title
    if state == UPLOAD_CHAPTER_TITLE:
        ch_num = context.user_data.get('chapter_number', 1)
        text = f"\U0001f4d6 *Chapter {ch_num}*\n\nEnter the chapter title:"
        kb = _upload_nav_kb(show_back=True)
        if is_query:
            await _safe_edit(target, text, reply_markup=kb, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=kb, parse_mode='Markdown')
        return

    # Chapter pages
    if state == UPLOAD_CHAPTER_PAGES:
        ch_num = context.user_data.get('chapter_number', 1)
        ch_title = context.user_data.get('current_chapter_title', '')
        text = f"\U0001f4d6 *Chapter {ch_num}: {ch_title}*\n\nEnter page range (e.g. `1-15`):"
        kb = _upload_nav_kb(show_back=True)
        if is_query:
            await _safe_edit(target, text, reply_markup=kb, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=kb, parse_mode='Markdown')
        return

    # Chapter price
    if state == UPLOAD_CHAPTER_PRICE:
        text = "\U0001f4b0 Is this chapter *free* or *premium*?\n\nType `free` or enter a price in GH\u20b5 (e.g. `500`):"
        kb = _upload_nav_kb(show_back=True)
        if is_query:
            await _safe_edit(target, text, reply_markup=kb, parse_mode='Markdown')
        else:
            await target.reply_text(text, reply_markup=kb, parse_mode='Markdown')
        return


_UPLOAD_DATA_KEYS = [
    'title', 'author', 'description', 'genre',
    'price_buy_now', 'price_1_day', 'price_2_days', 'price_3_days',
    'price_4_days', 'price_5_days', 'price_30_days',
    'cover_file_id', 'pdf_file_id', 'book_language', 'allow_translation',
    'chapters', 'upload_type', 'is_creator_upload',
    '_upload_state', '_upload_state_stack',
    'chapter_number', 'current_chapter_title',
    'current_chapter_start', 'current_chapter_end',
]


def _clear_upload_data(context):
    """Remove all upload-related keys from user_data."""
    for key in _UPLOAD_DATA_KEYS:
        context.user_data.pop(key, None)


async def cancel_upload_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle the Stop Uploading button — offer Save to Drafts or Stop Completely."""
    query = update.callback_query
    await query.answer()
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("\U0001f4be Save to Drafts", callback_data='upload_save_draft')],
        [InlineKeyboardButton("\U0001f5d1 Stop Completely", callback_data='upload_stop_completely')],
        [InlineKeyboardButton("\u21a9 Continue Uploading", callback_data='upload_resume')],
    ])
    await _safe_edit(query, "\u23f8 *Upload paused.*\n\nWhat would you like to do?",
        reply_markup=keyboard, parse_mode='Markdown')
    return UPLOAD_CONFIRM_CANCEL


async def upload_save_draft_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save current upload data as a draft."""
    query = update.callback_query
    await query.answer()
    from content.drafts_service import save_draft
    user_id = query.from_user.id
    draft_data = {k: context.user_data[k] for k in _UPLOAD_DATA_KEYS if k in context.user_data}
    draft_id = save_draft(user_id, draft_data)
    title = draft_data.get('title', 'Untitled')
    _clear_upload_data(context)
    await _safe_edit(query,
        f"\U0001f4be *Draft saved!*\n\n\"{title}\" saved to your drafts.\n"
        "You can resume it anytime from your dashboard.",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        parse_mode='Markdown')
    return ConversationHandler.END


async def upload_stop_completely_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Stop upload completely without saving."""
    query = update.callback_query
    await query.answer()
    _clear_upload_data(context)
    await _safe_edit(query, "\u274c Upload cancelled.",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
    return ConversationHandler.END


async def upload_resume_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Resume upload from where we left off."""
    query = update.callback_query
    await query.answer()
    state = context.user_data.get('_upload_state')
    if state is not None:
        await _send_upload_prompt(query, context, state)
        return state
    await _send_upload_prompt(query, context, UPLOAD_TITLE)
    return UPLOAD_TITLE


async def upload_back_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Go back to the previous upload step."""
    query = update.callback_query
    await query.answer()
    stack = context.user_data.get('_upload_state_stack', [])
    if len(stack) > 1:
        stack.pop()
        prev_state = stack[-1]
    else:
        prev_state = UPLOAD_TITLE
    await _send_upload_prompt(query, context, prev_state)
    return prev_state


async def upload_resume_draft_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Resume an upload from a saved draft — entry point for upload_conv."""
    query = update.callback_query
    await query.answer()
    _clear_text_input_flags(context)
    draft_id = int(query.data.replace('resume_draft_', ''))
    from content.drafts_service import load_draft, delete_draft, get_draft_owner
    owner = get_draft_owner(draft_id)
    if owner != query.from_user.id:
        await _safe_edit(query, "\u26a0\ufe0f Draft not found.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return ConversationHandler.END
    data = load_draft(draft_id)
    if not data:
        await _safe_edit(query, "\u26a0\ufe0f Draft not found.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return ConversationHandler.END
    # Load draft data into user_data
    for k, v in data.items():
        context.user_data[k] = v
    context.user_data['_upload_state_stack'] = data.get('_upload_state_stack', [])
    # Delete the draft since we're resuming it
    delete_draft(draft_id)
    # Determine which state to resume from
    state = data.get('_upload_state')
    if state is not None:
        await _safe_edit(query, "\U0001f4c2 *Draft loaded!* Resuming your upload...", parse_mode='Markdown')
        await _send_upload_prompt(query, context, state)
        return state
    # If no state saved, start from where data ends
    if not data.get('title'):
        await _send_upload_prompt(query, context, UPLOAD_TITLE)
        return UPLOAD_TITLE
    if not data.get('author'):
        await _send_upload_prompt(query, context, UPLOAD_AUTHOR)
        return UPLOAD_AUTHOR
    if not data.get('description'):
        await _send_upload_prompt(query, context, UPLOAD_DESCRIPTION)
        return UPLOAD_DESCRIPTION
    if not data.get('genre'):
        await _send_upload_prompt(query, context, UPLOAD_GENRE)
        return UPLOAD_GENRE
    if data.get('price_buy_now') is None:
        await _send_upload_prompt(query, context, UPLOAD_PRICE_BUY_NOW)
        return UPLOAD_PRICE_BUY_NOW
    # Default: start from title
    await _send_upload_prompt(query, context, UPLOAD_TITLE)
    return UPLOAD_TITLE


async def my_drafts_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the user's saved upload drafts."""
    query = update.callback_query
    await query.answer()
    from content.drafts_service import list_drafts
    user_id = query.from_user.id
    drafts = list_drafts(user_id)
    if not drafts:
        await _safe_edit(query, "\U0001f4c2 *No drafts found.*\n\nYou have no saved upload drafts.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='back_to_menu')]]),
            parse_mode='Markdown')
        return
    keyboard = []
    for d_id, d_title, d_updated in drafts:
        keyboard.append([
            InlineKeyboardButton(f"\U0001f4d6 {d_title or 'Untitled'}", callback_data=f'resume_draft_{d_id}'),
            InlineKeyboardButton("\U0001f5d1", callback_data=f'delete_draft_{d_id}'),
        ])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='back_to_menu')])
    await _safe_edit(query, "\U0001f4c2 *Your Drafts*\n\nTap a draft to resume uploading, or \U0001f5d1 to delete it.",
        reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def delete_draft_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Delete a saved draft."""
    query = update.callback_query
    await query.answer()
    draft_id = int(query.data.replace('delete_draft_', ''))
    from content.drafts_service import delete_draft, get_draft_owner
    owner = get_draft_owner(draft_id)
    if owner != query.from_user.id:
        await query.answer("\u26a0\ufe0f Draft not found.", show_alert=True)
        return
    delete_draft(draft_id)
    await query.answer("\u2705 Draft deleted.", show_alert=True)
    # Refresh the drafts list
    await my_drafts_callback(update, context)


async def upload_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    _clear_text_input_flags(context)
    context.user_data['_upload_state_stack'] = []
    if 'admin' in query.data:
        context.user_data['is_creator_upload'] = False
        context.user_data['upload_type'] = 'book'
        await _send_upload_prompt(query, context, UPLOAD_TITLE)
        return UPLOAD_TITLE
    else:  # creator
        context.user_data['is_creator_upload'] = True
        context.user_data['upload_type'] = 'book'
        await _send_upload_prompt(query, context, UPLOAD_TITLE)
        return UPLOAD_TITLE


async def upload_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['title'] = update.message.text
    # For creator uploads, auto-fill author from their profile pen name
    if context.user_data.get('is_creator_upload'):
        from creators.profile_service import get_creator_pen_name
        pen_name = get_creator_pen_name(update.effective_user.id)
        if pen_name:
            context.user_data['author'] = pen_name
            await _send_upload_prompt(update.message, context, UPLOAD_DESCRIPTION)
            return UPLOAD_DESCRIPTION
    await _send_upload_prompt(update.message, context, UPLOAD_AUTHOR)
    return UPLOAD_AUTHOR

async def upload_author(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['author'] = update.message.text
    await _send_upload_prompt(update.message, context, UPLOAD_DESCRIPTION)
    return UPLOAD_DESCRIPTION

async def upload_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['description'] = update.message.text
    await _send_upload_prompt(update.message, context, UPLOAD_GENRE)
    return UPLOAD_GENRE

async def upload_genre(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data['genre'] = update.message.text
    # Skip all price steps — books are free now (coin-based monetization on web)
    context.user_data['price_buy_now'] = 0
    context.user_data['price_1_day'] = 0
    context.user_data['price_2_days'] = 0
    context.user_data['price_3_days'] = 0
    context.user_data['price_4_days'] = 0
    context.user_data['price_5_days'] = 0
    context.user_data['price_30_days'] = 0
    await _send_upload_prompt(update.message, context, UPLOAD_COVER)
    return UPLOAD_COVER

def _parse_price(text: str) -> float | None:
    try:
        return float(text.strip())
    except (TypeError, ValueError):
        return None

async def upload_price_buy_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_BUY_NOW
    context.user_data['price_buy_now'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_1_DAY)
    return UPLOAD_PRICE_1_DAY

async def upload_price_1_day(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_1_DAY
    context.user_data['price_1_day'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_2_DAYS)
    return UPLOAD_PRICE_2_DAYS

async def upload_price_2_days(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_2_DAYS
    context.user_data['price_2_days'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_3_DAYS)
    return UPLOAD_PRICE_3_DAYS

async def upload_price_3_days(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_3_DAYS
    context.user_data['price_3_days'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_4_DAYS)
    return UPLOAD_PRICE_4_DAYS

async def upload_price_4_days(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_4_DAYS
    context.user_data['price_4_days'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_5_DAYS)
    return UPLOAD_PRICE_5_DAYS

async def upload_price_5_days(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_5_DAYS
    context.user_data['price_5_days'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_PRICE_30_DAYS)
    return UPLOAD_PRICE_30_DAYS

async def upload_price_30_days(update: Update, context: ContextTypes.DEFAULT_TYPE):
    val = _parse_price(update.message.text)
    if val is None:
        await update.message.reply_text("\u26a0\ufe0f Invalid price. Please enter a number:")
        return UPLOAD_PRICE_30_DAYS
    context.user_data['price_30_days'] = val
    await _send_upload_prompt(update.message, context, UPLOAD_COVER)
    return UPLOAD_COVER

async def upload_cover(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.photo:
        await update.message.reply_text("Please send a photo for the cover image.")
        return UPLOAD_COVER
    photo = update.message.photo[-1]

    # Download, resize, and re-upload the cover
    try:
        from utils.image_utils import resize_cover
        file = await context.bot.get_file(photo.file_id)
        raw_bytes = await file.download_as_bytearray()
        resized_bytes = resize_cover(bytes(raw_bytes))
        import io
        resized_msg = await update.message.reply_photo(protect_content=True,
            photo=io.BytesIO(resized_bytes),
            caption="\u2705 Cover resized to fit platform standards.",
        )
        context.user_data['cover_file_id'] = resized_msg.photo[-1].file_id
    except Exception:
        # Fallback: use the original if resize fails
        context.user_data['cover_file_id'] = photo.file_id

    await _send_upload_prompt(update.message, context, UPLOAD_PDF)
    return UPLOAD_PDF

async def upload_pdf(update: Update, context: ContextTypes.DEFAULT_TYPE):
    doc = update.message.document
    if not doc:
        await update.message.reply_text("Please send the PDF as a document.")
        return UPLOAD_PDF
    if doc.mime_type and doc.mime_type != 'application/pdf':
        await update.message.reply_text("Invalid file type. Please send a PDF document.")
        return UPLOAD_PDF
    context.user_data['pdf_file_id'] = doc.file_id
    context.user_data['chapters'] = []

    # Check if creator's tier supports translation
    user_id = update.effective_user.id
    is_admin_upload = not context.user_data.get('is_creator_upload', False)
    from creators.subscription_service import can_use_translation as _can_trans
    show_lang = is_admin_upload or _can_trans(user_id)

    if show_lang:
        await _send_upload_prompt(update.message, context, UPLOAD_LANGUAGE)
        return UPLOAD_LANGUAGE
    else:
        # Starter: skip language + translation, go straight to chapters check
        context.user_data['book_language'] = 'en'
        context.user_data['allow_translation'] = False
        from creators.subscription_service import can_use_chapters as _can_ch
        if is_admin_upload or _can_ch(user_id):
            await _send_upload_prompt(update.message, context, UPLOAD_CHAPTERS_CHOICE)
            return UPLOAD_CHAPTERS_CHOICE
        else:
            # Starter: skip chapters too, finalize
            context.user_data['chapters'] = []
            await _finalize_book_upload(update, context)
            return ConversationHandler.END


async def upload_language(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Creator selects what language the book is written in."""
    query = update.callback_query
    await query.answer()
    lang_code = query.data.replace('uplang_', '')
    context.user_data['book_language'] = lang_code
    await _send_upload_prompt(query, context, UPLOAD_ALLOW_TRANSLATION)
    return UPLOAD_ALLOW_TRANSLATION


async def upload_allow_translation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Creator decides whether to allow translation for readers."""
    query = update.callback_query
    await query.answer()
    context.user_data['allow_translation'] = query.data == 'allow_trans_yes'

    # Check if tier supports chapters
    user_id = query.from_user.id
    is_admin_upload = not context.user_data.get('is_creator_upload', False)
    from creators.subscription_service import can_use_chapters as _can_ch
    if is_admin_upload or _can_ch(user_id):
        await _send_upload_prompt(query, context, UPLOAD_CHAPTERS_CHOICE)
        return UPLOAD_CHAPTERS_CHOICE
    else:
        # Tier doesn't support chapters, finalize directly
        context.user_data['chapters'] = []
        await _finalize_book_upload(update, context)
        return ConversationHandler.END


async def upload_chapters_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == 'chapters_no':
        await _safe_edit(query, "\u2705 Uploading as full book...")
        await _finalize_book_upload(update, context)
        return ConversationHandler.END
    # chapters_yes — start a new chapter
    ch_num = len(context.user_data.get('chapters', [])) + 1
    context.user_data['chapter_number'] = ch_num
    await _send_upload_prompt(query, context, UPLOAD_CHAPTER_TITLE)
    return UPLOAD_CHAPTER_TITLE


async def upload_chapter_title(update: Update, context: ContextTypes.DEFAULT_TYPE):
    title = update.message.text.strip()
    if not title:
        await update.message.reply_text("Please enter a valid chapter title:")
        return UPLOAD_CHAPTER_TITLE
    context.user_data['current_chapter_title'] = title
    await _send_upload_prompt(update.message, context, UPLOAD_CHAPTER_PAGES)
    return UPLOAD_CHAPTER_PAGES


async def upload_chapter_pages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    try:
        parts = text.split('-')
        start = int(parts[0].strip())
        end = int(parts[1].strip())
        if start < 1 or end < start:
            raise ValueError
    except (ValueError, IndexError):
        await update.message.reply_text(
            "\u26a0\ufe0f Invalid format. Enter page range like `1-15`:",
            parse_mode='Markdown',
        )
        return UPLOAD_CHAPTER_PAGES
    context.user_data['current_chapter_start'] = start
    context.user_data['current_chapter_end'] = end
    await _send_upload_prompt(update.message, context, UPLOAD_CHAPTER_PRICE)
    return UPLOAD_CHAPTER_PRICE


async def upload_chapter_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip().lower()
    if text == 'free':
        is_free = True
        price = 0
    else:
        try:
            price = float(text)
            if price < 0:
                raise ValueError
            is_free = (price == 0)
        except ValueError:
            await update.message.reply_text(
                "\u26a0\ufe0f Invalid. Type `free` or a price number (e.g. `500`):",
                parse_mode='Markdown',
            )
            return UPLOAD_CHAPTER_PRICE

    ch_num = context.user_data.get('chapter_number', 1)
    chapter = {
        'number': ch_num,
        'title': context.user_data['current_chapter_title'],
        'start_page': context.user_data['current_chapter_start'],
        'end_page': context.user_data['current_chapter_end'],
        'is_free': is_free,
        'price': price,
    }
    context.user_data['chapters'].append(chapter)

    price_label = "Free" if is_free else f"GH\u20b5 {price:,.0f}"
    await update.message.reply_text(
        f"\u2705 Chapter {ch_num} added:\n"
        f"  \U0001f4d6 {chapter['title']}\n"
        f"  \U0001f4c4 Pages {chapter['start_page']}-{chapter['end_page']}\n"
        f"  \U0001f4b0 {price_label}"
    )
    # Show add more / done via chapters choice prompt
    await _send_upload_prompt(update.message, context, UPLOAD_CHAPTERS_CHOICE)
    return UPLOAD_CHAPTERS_CHOICE

# ─── Feedback System ────────────────────────────────────────────────
_FEEDBACK_CATEGORIES = [
    ("bug", "\U0001f41b Bug Report"),
    ("feature", "\U0001f4a1 Feature Request"),
    ("problem", "\u26a0\ufe0f Problem / Challenge"),
    ("question", "\u2753 Question"),
    ("other", "\U0001f4ac Other"),
]

async def feedback_start_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point — show category selection."""
    query = update.callback_query
    await query.answer()
    keyboard = []
    for cat_id, cat_label in _FEEDBACK_CATEGORIES:
        keyboard.append([InlineKeyboardButton(cat_label, callback_data=f'fb_cat_{cat_id}')])
    keyboard.append([InlineKeyboardButton("\u274c Cancel", callback_data='fb_cancel')])
    await _safe_edit(query,
        "\U0001f4e8 *Send Feedback*\n\n"
        "What type of feedback would you like to send?\n"
        "Choose a category below:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )
    return FEEDBACK_CATEGORY

async def feedback_category_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User selected a category — ask for message."""
    query = update.callback_query
    await query.answer()
    cat_id = query.data.replace('fb_cat_', '')
    context.user_data['fb_category'] = cat_id
    cat_label = dict(_FEEDBACK_CATEGORIES).get(cat_id, cat_id)
    keyboard = [[InlineKeyboardButton("\u274c Cancel", callback_data='fb_cancel')]]
    await _safe_edit(query,
        f"\U0001f4e8 Category: *{cat_label}*\n\n"
        "Now type your feedback message.\n"
        "Describe your issue, suggestion, or question in detail:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )
    return FEEDBACK_MESSAGE

async def feedback_message_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User typed their feedback message — ask for optional screenshot."""
    context.user_data['fb_message'] = update.message.text
    keyboard = [
        [InlineKeyboardButton("\u2705 Submit Without Screenshot", callback_data='fb_skip_screenshot')],
        [InlineKeyboardButton("\u274c Cancel", callback_data='fb_cancel')],
    ]
    await update.message.reply_text(
        "\U0001f4f8 *Optional: Send a screenshot*\n\n"
        "If you have a screenshot that helps explain the issue, send it now as a photo.\n\n"
        "Or tap the button below to submit without one.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )
    return FEEDBACK_SCREENSHOT

async def feedback_screenshot_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User sent a screenshot photo — save and submit."""
    if update.message.photo:
        context.user_data['fb_screenshot'] = update.message.photo[-1].file_id
    return await _submit_feedback(update, context)

async def feedback_skip_screenshot_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User chose to skip screenshot — submit feedback."""
    query = update.callback_query
    await query.answer()
    context.user_data['fb_screenshot'] = None
    return await _submit_feedback(update, context)

async def _submit_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Save feedback to DB and confirm to the user."""
    from content.feedback_service import save_feedback
    user = update.effective_user
    role = get_user_role(user.id)
    role_label = {ROLE_FOUNDER: 'founder', ROLE_ADMIN: 'admin', ROLE_CREATOR: 'creator'}.get(role, 'user')
    username = user.username or user.first_name or str(user.id)
    category = context.user_data.get('fb_category', 'other')
    message = context.user_data.get('fb_message', '')
    screenshot = context.user_data.get('fb_screenshot')
    fid = save_feedback(user.id, username, role_label, category, message, screenshot)
    # Clean up
    for k in ['fb_category', 'fb_message', 'fb_screenshot']:
        context.user_data.pop(k, None)
    cat_label = dict(_FEEDBACK_CATEGORIES).get(category, category)
    target = update.callback_query if update.callback_query else None
    text = (
        f"\u2705 *Feedback Submitted!*\n\n"
        f"\U0001f4e8 ID: `#{fid}`\n"
        f"\U0001f4cb Category: {cat_label}\n\n"
        "Thank you! The WiamApp team will review your feedback."
    )
    kb = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])
    if target:
        await _safe_edit(target, text, reply_markup=kb, parse_mode='Markdown')
    else:
        await update.message.reply_text(text, reply_markup=kb, parse_mode='Markdown')
    return ConversationHandler.END

async def feedback_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel feedback submission."""
    query = update.callback_query
    await query.answer()
    for k in ['fb_category', 'fb_message', 'fb_screenshot']:
        context.user_data.pop(k, None)
    await _safe_edit(query, "\u274c Feedback cancelled.",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
    return ConversationHandler.END

# ─── Founder: View Feedback ─────────────────────────────────────────
async def founder_feedback_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder views list of open feedback."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    if get_user_role(user_id) != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    from content.feedback_service import list_feedback, count_open_feedback
    show_all = context.user_data.get('fb_show_all', False)
    feedbacks = list_feedback(status='all' if show_all else 'open')
    open_count = count_open_feedback()
    if not feedbacks:
        await _safe_edit(query,
            "\U0001f4e8 *Feedback Inbox*\n\nNo feedback found.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f451 Back to Control Panel", callback_data='open_founder_dashboard')],
            ]),
            parse_mode='Markdown')
        return
    keyboard = []
    for fb in feedbacks:
        fid, uid, uname, role, cat, msg, created, status = fb
        icon = "\U0001f534" if status == 'open' else "\u2705"
        short_msg = (msg[:30] + '...') if len(msg) > 30 else msg
        keyboard.append([InlineKeyboardButton(
            f"{icon} #{fid} [{cat}] {short_msg}",
            callback_data=f'fb_view_{fid}',
        )])
    toggle_label = "\U0001f4cb Show Open Only" if show_all else "\U0001f4cb Show All"
    toggle_data = 'fb_toggle_all' if not show_all else 'fb_toggle_open'
    keyboard.append([InlineKeyboardButton(toggle_label, callback_data=toggle_data)])
    keyboard.append([InlineKeyboardButton("\U0001f451 Back to Control Panel", callback_data='open_founder_dashboard')])
    await _safe_edit(query,
        f"\U0001f4e8 *Feedback Inbox* ({open_count} open)\n\nTap an item to view details:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown')

async def founder_feedback_toggle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle between showing all vs open-only feedback."""
    query = update.callback_query
    await query.answer()
    if 'all' in query.data:
        context.user_data['fb_show_all'] = True
    else:
        context.user_data['fb_show_all'] = False
    await founder_feedback_list_callback(update, context)

async def founder_feedback_view_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder views a single feedback detail."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    fid = int(query.data.replace('fb_view_', ''))
    from content.feedback_service import get_feedback
    fb = get_feedback(fid)
    if not fb:
        await _safe_edit(query, "\u26a0\ufe0f Feedback not found.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_feedback')]]))
        return
    status_icon = "\U0001f534 Open" if fb['status'] == 'open' else "\u2705 Resolved"
    cat_label = dict(_FEEDBACK_CATEGORIES).get(fb['category'], fb['category'])
    text = (
        f"\U0001f4e8 *Feedback #{fb['id']}*\n\n"
        f"\U0001f464 From: @{fb['username']} (ID: `{fb['user_id']}`)\n"
        f"\U0001f3ad Role: {fb['role']}\n"
        f"\U0001f4cb Category: {cat_label}\n"
        f"\U0001f4c5 Date: {fb['created_at']}\n"
        f"Status: {status_icon}\n\n"
        f"\U0001f4ac *Message:*\n{fb['message']}"
    )
    keyboard = []
    if fb['screenshot_file_id']:
        keyboard.append([InlineKeyboardButton("\U0001f4f8 View Screenshot", callback_data=f'fb_screenshot_{fid}')])
    if fb['status'] == 'open':
        keyboard.append([InlineKeyboardButton("\u2705 Mark Resolved", callback_data=f'fb_resolve_{fid}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Feedback List", callback_data='founder_feedback')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')

async def founder_feedback_screenshot_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send the feedback screenshot to the founder."""
    query = update.callback_query
    await query.answer()
    fid = int(query.data.replace('fb_screenshot_', ''))
    from content.feedback_service import get_feedback
    fb = get_feedback(fid)
    if not fb or not fb['screenshot_file_id']:
        await query.answer("\u26a0\ufe0f No screenshot available.", show_alert=True)
        return
    await query.message.reply_photo(
        photo=fb['screenshot_file_id'],
        caption=f"\U0001f4f8 Screenshot for Feedback #{fid}",
    )

async def founder_feedback_resolve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Mark a feedback entry as resolved."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    fid = int(query.data.replace('fb_resolve_', ''))
    from content.feedback_service import resolve_feedback
    resolve_feedback(fid)
    await query.answer("\u2705 Feedback marked as resolved!", show_alert=True)
    # Refresh the detail view
    context.user_data['_fb_view_id'] = fid
    query.data = f'fb_view_{fid}'
    await founder_feedback_view_callback(update, context)

# ─── End Feedback System ────────────────────────────────────────────

async def _finalize_book_upload(update: Update, context: ContextTypes.DEFAULT_TYPE):
    title = context.user_data.get('title')
    type_ = context.user_data.get('upload_type') or 'book'
    author = context.user_data.get('author')
    description = context.user_data.get('description')
    genre = context.user_data.get('genre')
    cover_file_id = context.user_data.get('cover_file_id')
    pdf_file_id = context.user_data.get('pdf_file_id')
    price_buy_now = context.user_data.get('price_buy_now')
    price_1_day = context.user_data.get('price_1_day')
    price_2_days = context.user_data.get('price_2_days')
    price_3_days = context.user_data.get('price_3_days')
    price_4_days = context.user_data.get('price_4_days')
    price_5_days = context.user_data.get('price_5_days')
    price_30_days = context.user_data.get('price_30_days')
    chapters_data = context.user_data.get('chapters', [])
    book_language = context.user_data.get('book_language', 'en')
    allow_translation = context.user_data.get('allow_translation', False)
    creator_telegram_id = update.effective_user.id
    chat_id = update.effective_chat.id

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "INSERT INTO content (title, type, status, creator_telegram_id, author, description, genre, cover_file_id, pdf_file_id, "
        "price_buy_now, price_1_day, price_2_days, price_3_days, price_4_days, price_5_days, price_30_days, "
        "language, allow_translation) "
        "VALUES (%s, %s, 'ongoing', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (
            title,
            type_,
            creator_telegram_id,
            author,
            description,
            genre,
            cover_file_id,
            pdf_file_id,
            price_buy_now,
            price_1_day,
            price_2_days,
            price_3_days,
            price_4_days,
            price_5_days,
            price_30_days,
            book_language,
            allow_translation,
        ),
    )
    content_id = c.fetchone()[0]
    conn.commit()
    conn.close()

    # --- Auto-generate 5-page preview PDF ---
    try:
        pdf_file = await context.bot.get_file(pdf_file_id)
        pdf_bytes = bytes(await pdf_file.download_as_bytearray())

        from content.chapter_service import extract_preview_pages
        import io as _io
        preview_bytes = extract_preview_pages(pdf_bytes, num_pages=5)
        if preview_bytes:
            preview_doc = await context.bot.send_document(
                chat_id=chat_id,
                document=_io.BytesIO(preview_bytes),
                filename=f"{title} - Preview.pdf",
                caption="\U0001f4d6 Preview generated.",
                disable_notification=True,
                protect_content=True,
            )
            if preview_doc.document:
                conn2 = get_db()
                c2 = conn2.cursor()
                c2.execute(
                    "UPDATE content SET preview_file_id=%s WHERE id=%s",
                    (preview_doc.document.file_id, content_id),
                )
                conn2.commit()
                conn2.close()
            try:
                await preview_doc.delete()
            except Exception:
                pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Preview generation error: {e}")
        pdf_bytes = None

    # --- Process chapters if defined ---
    if chapters_data:
        from content.chapter_service import add_chapter, update_chapter_file_id, split_pdf_to_chapters
        from content.audio_service import extract_text_from_pages, store_chapter_text, store_book_text
        try:
            # Download the full PDF if not already downloaded
            if pdf_bytes is None:
                pdf_file = await context.bot.get_file(pdf_file_id)
                pdf_bytes = bytes(await pdf_file.download_as_bytearray())

            # Extract and store full book text for audio
            try:
                from content.audio_service import extract_text_from_pdf
                full_text = extract_text_from_pdf(pdf_bytes)
                if full_text:
                    store_book_text(content_id, full_text)
            except Exception:
                pass

            # Split the PDF into chapter files
            chapter_pdfs = split_pdf_to_chapters(pdf_bytes, chapters_data)

            # Save each chapter to DB and upload split PDFs
            import io as _io
            for i, ch in enumerate(chapters_data):
                chapter_id = add_chapter(
                    content_id=content_id,
                    chapter_number=ch['number'],
                    title=ch['title'],
                    start_page=ch['start_page'],
                    end_page=ch['end_page'],
                    is_free=ch['is_free'],
                    price=ch['price'],
                )
                # Extract and store chapter text for audio/translation
                try:
                    ch_text = extract_text_from_pages(
                        pdf_bytes, ch['start_page'], ch['end_page']
                    )
                    if ch_text:
                        store_chapter_text(chapter_id, ch_text)
                except Exception:
                    pass
                # Upload the chapter PDF to Telegram and store its file_id
                if i < len(chapter_pdfs) and chapter_pdfs[i]:
                    ch_doc = await context.bot.send_document(
                        chat_id=chat_id,
                        document=_io.BytesIO(chapter_pdfs[i]),
                        filename=f"{title} - Ch{ch['number']}.pdf",
                        caption=f"\U0001f4c4 Chapter {ch['number']} processed.",
                        disable_notification=True,
                        protect_content=True,
                    )
                    if ch_doc.document:
                        update_chapter_file_id(chapter_id, ch_doc.document.file_id)
                    # Delete the processing message to keep chat clean
                    try:
                        await ch_doc.delete()
                    except Exception:
                        pass

            ch_count = len(chapters_data)
            free_count = sum(1 for ch in chapters_data if ch['is_free'])
            premium_count = ch_count - free_count
            await context.bot.send_message(
                chat_id=chat_id,
                text=(
                    f"\u2705 Book uploaded for approval.\n\n"
                    f"\U0001f4d1 {ch_count} chapters defined:\n"
                    f"  \U0001f513 {free_count} free | \U0001f512 {premium_count} premium\n\n"
                    f"Chapters will be available once the book is approved."
                ),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
                ]),
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Chapter processing error: {e}", exc_info=True)
            await context.bot.send_message(
                chat_id=chat_id,
                text=(
                    "\u2705 Book uploaded for approval.\n\n"
                    "\u26a0\ufe0f Could not split chapters automatically.\n"
                    f"Reason: {str(e)[:200]}\n\n"
                    "The full book will still be available.\n"
                    "You can define chapters again later from your Creator Dashboard."
                ),
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
                ]),
            )
    else:
        # Extract and store full book text for audio (no chapters)
        try:
            from content.audio_service import extract_text_from_pdf, store_book_text
            if pdf_bytes is None:
                pdf_file = await context.bot.get_file(pdf_file_id)
                pdf_bytes = bytes(await pdf_file.download_as_bytearray())
            full_text = extract_text_from_pdf(pdf_bytes)
            if full_text:
                store_book_text(content_id, full_text)
        except Exception:
            pass
        await context.bot.send_message(
            chat_id=chat_id,
            text="\u2705 Book uploaded for approval.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )

    # --- Notification #11: Notify Admins/Founder about new book for review ---
    from core.role_manager import get_admin_and_founder_ids
    reviewer_ids = get_admin_and_founder_ids()
    creator_name = update.effective_user.username or update.effective_user.first_name or str(creator_telegram_id)
    for rid in reviewer_ids:
        if rid == creator_telegram_id:
            continue
        try:
            await context.bot.send_message(
                chat_id=rid,
                text=(
                    f"\U0001f4da *New Book Uploaded for Review*\n\n"
                    f"\U0001f4d6 Title: {title}\n"
                    f"\u270d\ufe0f Author: {author}\n"
                    f"\U0001f3ad Genre: {genre}\n"
                    f"\U0001f464 Creator: @{creator_name}\n\n"
                    f"Go to Admin Panel \u2192 Approve Content to review."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass

async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await approve_content_list(update, context)

async def approve_item(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await approve_content_action(update, context)

async def apply_creator(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Redirect /apply_creator command to the proper registration flow."""
    user_id = update.effective_user.id
    status = get_creator_application_status(user_id)
    if status == 'pending':
        await update.message.reply_text(
            "\u23f3 Your creator application is already pending review.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        )
        return
    if status == 'approved':
        await update.message.reply_text(
            "\u2705 You're already an approved creator! Use /creator to access your dashboard.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        )
        return
    await update.message.reply_text(
        "\u270d\ufe0f *Become a Creator on WiamApp*\n\n"
        "Tap the button below to start your application.\n"
        "You'll set up your pen name, bio, and profile photo.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f4dd Start Application", callback_data='apply_creator')],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )

async def creator_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /creator command — show a button to open the full Creator Dashboard."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await update.message.reply_text(
            "\u26a0\ufe0f You need to be an approved creator to access the dashboard.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u270d\ufe0f Apply to be Creator", callback_data='apply_creator')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return
    await update.message.reply_text(
        "\u270d\ufe0f *Creator Dashboard*\n\nTap below to open your dashboard.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u270d\ufe0f Open Creator Dashboard", callback_data='open_creator_dashboard')],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )

async def approve_creators_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    actor_role = get_user_role(query.from_user.id)
    if actor_role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT telegram_id, username FROM users WHERE creator_application_status='pending'")
    pendings = c.fetchall()
    conn.close()
    if not pendings:
        await _safe_edit(query, "No pending creator applications.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')]]))
        return
    keyboard = []
    for tid, uname in pendings:
        name = uname or str(tid)
        keyboard.append([InlineKeyboardButton(f"\U0001f464 {name}", callback_data='noop')])
        keyboard.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'creator_approve_{tid}'),
            InlineKeyboardButton("\U0001f4b0 Pay Req", callback_data=f'creator_payreq_{tid}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'creator_reject_{tid}'),
        ])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back", callback_data='open_founder_dashboard')])
    reply_markup = InlineKeyboardMarkup(keyboard)
    await _safe_edit(query, "Pending Creator Applications:", reply_markup=reply_markup)

async def creator_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    parts = query.data.split('_', 2)
    if len(parts) != 3:
        await _safe_edit(query, "Invalid action.")
        return
    _, action, id_ = parts
    actor_role = get_user_role(query.from_user.id)
    if actor_role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    telegram_id = int(id_)
    _back_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Creators", callback_data='admin_approve_creators')]])
    if action == 'approve':
        approve_creator(telegram_id)
        await _safe_edit(query, "\u2705 Creator approved.", reply_markup=_back_kb)
        # --- Notification #8: Notify Creator they've been approved ---
        try:
            await context.bot.send_message(
                chat_id=telegram_id,
                text=(
                    "\u2705 *Congratulations!* Your creator application has been approved!\n\n"
                    "You can now access the Creator Dashboard.\n"
                    "Use /start to get started."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass
    elif action == 'payreq':
        set_payment_required(telegram_id)
        await _safe_edit(query, 
            "\U0001f4b0 Creator set to Payment Required.\n"
            "They must pay the subscription fee before being activated.",
            reply_markup=_back_kb,
        )
        # --- Notification #10: Notify Creator to pay subscription ---
        try:
            await context.bot.send_message(
                chat_id=telegram_id,
                text=(
                    "\U0001f4b0 *Creator Application Update*\n\n"
                    "Your application has been reviewed. To activate your creator account, "
                    "you need to pay the subscription fee.\n\n"
                    "Use /start \u2192 Renew Subscription to choose a plan and pay."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass
    elif action == 'reject':
        reject_creator(telegram_id)
        await _safe_edit(query, "\u274c Creator rejected.", reply_markup=_back_kb)
        # --- Notification #9: Notify Creator they've been rejected ---
        try:
            await context.bot.send_message(
                chat_id=telegram_id,
                text=(
                    "\u274c *Creator Application Update*\n\n"
                    "Unfortunately, your creator application was not approved at this time.\n\n"
                    "You can re-apply later if you wish."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass
    else:
        await _safe_edit(query, "Invalid action.", reply_markup=_back_kb)

async def noop_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()


async def browse_genres_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT DISTINCT genre FROM content WHERE status IN ('approved','ongoing','complete') AND genre IS NOT NULL ORDER BY genre")
    genres = c.fetchall()
    conn.close()
    if not genres:
        await _safe_edit(query, "No genres available yet.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    keyboard = [[InlineKeyboardButton(f"\U0001f3ad {g[0]}", callback_data=f'genre_{g[0]}')] for g in genres]
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, "Choose a genre:", reply_markup=InlineKeyboardMarkup(keyboard))


async def genre_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    genre = query.data.replace('genre_', '', 1)
    index = 0
    if '_idx_' in genre:
        parts = genre.rsplit('_idx_', 1)
        genre = parts[0]
        try:
            index = int(parts[1])
        except ValueError:
            index = 0
    # Strip '_list' suffix if present (handled by browse_list_callback)
    if genre.endswith('_list'):
        return
    from content.book_browser import _show_book_carousel
    await _show_book_carousel(query, index, genre=genre, prefix=f'genre_{genre}')


async def my_library_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT a.content_id, c.title, a.access_type, a.status, a.end_date "
        "FROM access a JOIN content c ON a.content_id = c.id "
        "WHERE a.user_id=%s ORDER BY a.start_date DESC LIMIT 20",
        (user_id,),
    )
    rows = c.fetchall()
    conn.close()
    if not rows:
        await _safe_edit(query, 
            "\u2764\ufe0f My Library\n\nYou haven't purchased any books yet.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f4da Browse Books", callback_data='browse_books')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return
    from content.reading_progress import get_progress_text
    keyboard = []
    for content_id, title, access_type, status, end_date in rows:
        if access_type == 'temporary' and status == 'expired':
            keyboard.append([
                InlineKeyboardButton(f"\U0001f4d6 {title} (Expired)", callback_data=f'book_{content_id}'),
                InlineKeyboardButton("\U0001f504 Renew", callback_data=f'choose_days_{content_id}'),
            ])
        elif status == 'active':
            suffix = ""
            if access_type == 'temporary' and end_date:
                suffix = f" (Until {str(end_date)[:10]})"
            progress = get_progress_text(user_id, content_id)
            read_label = f"\U0001f4d6 Continue ({progress})" if progress else "\U0001f4d6 Read"
            keyboard.append([
                InlineKeyboardButton(f"\U0001f4d6 {title}{suffix}", callback_data=f'book_{content_id}'),
                InlineKeyboardButton(read_label, callback_data=f'read_book_{content_id}'),
            ])
        else:
            keyboard.append([InlineKeyboardButton(f"\U0001f4d6 {title}", callback_data=f'book_{content_id}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, "\u2764\ufe0f My Library:", reply_markup=InlineKeyboardMarkup(keyboard))


async def renew_subscription_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    creator_status = get_creator_application_status(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER] and creator_status != 'payment_required':
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    from creators.subscription_service import build_tier_comparison_text, TIERS, CURRENCY
    text = build_tier_comparison_text()
    keyboard = []
    for tier_key, info in TIERS.items():
        keyboard.append([InlineKeyboardButton(
            f"{info['emoji']} {info['name']} — from {CURRENCY} {info['monthly_price']:,.2f}/mo",
            callback_data=f'sub_tier_{tier_key}',
        )])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, 
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def sub_tier_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User selected a tier — show monthly vs yearly billing options."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    creator_status = get_creator_application_status(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER] and creator_status != 'payment_required':
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    tier = query.data.replace('sub_tier_', '')
    from creators.subscription_service import TIERS, CURRENCY
    info = TIERS.get(tier)
    if not info:
        await _safe_edit(query, "Invalid plan.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='renew_subscription')]]))
        return
    monthly = info['monthly_price']
    yearly = info['yearly_price']
    saved = (monthly * 12) - yearly
    yes = '\u2705'
    no = '\u274c'
    max_b = 'Unlimited' if info['max_books'] > 1000 else str(info['max_books'])
    text = (
        f"{info['emoji']} *{info['name']} Plan*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4da Books: *{max_b}*\n"
        f"\U0001f4d1 Chapters: {yes if info['chapters'] else no}\n"
        f"\U0001f3a7 Audio (TTS): {yes if info['audio'] else no}\n"
        f"\U0001f30d Translation: {yes if info['translation'] else no}\n\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        f"Choose your billing cycle:\n\n"
        f"\U0001f4c5 *Monthly:* {CURRENCY} {monthly:,.2f}\n"
        f"\U0001f4c6 *Yearly:* {CURRENCY} {yearly:,.2f}  \u2014  _Save {CURRENCY} {saved:,.2f}!_"
    )
    keyboard = [
        [InlineKeyboardButton(f"\U0001f4c5 Monthly — {CURRENCY} {monthly:,.2f}", callback_data=f'sub_plan_{tier}_monthly')],
        [InlineKeyboardButton(f"\U0001f4c6 Yearly — {CURRENCY} {yearly:,.2f} (Save {CURRENCY} {saved:,.2f})", callback_data=f'sub_plan_{tier}_yearly')],
        [InlineKeyboardButton("\u25c0 Back to Plans", callback_data='renew_subscription')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def sub_plan_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User selected tier + cycle — show payment method."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    creator_status = get_creator_application_status(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER] and creator_status != 'payment_required':
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    plan = query.data.replace('sub_plan_', '')
    from creators.subscription_service import get_plan_price, TIERS, CURRENCY
    price = get_plan_price(plan)
    # Parse tier name from plan key
    parts = plan.rsplit('_', 1)
    tier_key = parts[0] if len(parts) == 2 else 'starter'
    cycle = parts[1] if len(parts) == 2 else 'monthly'
    info = TIERS.get(tier_key, TIERS['starter'])
    keyboard = [
        [InlineKeyboardButton("\U0001f4f1 MTN MoMo", callback_data=f'pay_momo_sub_{plan}'),
         InlineKeyboardButton("\U0001f3e6 Bank Transfer", callback_data=f'pay_bank_sub_{plan}')],
        [InlineKeyboardButton("\u25c0 Back", callback_data=f'sub_tier_{tier_key}')],
    ]
    await _safe_edit(query, 
        f"{info['emoji']} *{info['name']} Plan — {cycle.title()}*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4b0 Total: *{CURRENCY} {price:,.2f}*\n\n"
        f"Choose payment method:\n\n"
        f"_After payment, send proof screenshot._\n"
        f"_WiamApp Team will review and activate your plan._",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def founder_earnings_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show platform earnings dashboard with all revenue streams."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    from payments.platform_fee_service import (
        get_platform_fee_settings, get_all_creators_sales, get_total_platform_fees_collected,
    )
    from payments.commission_service import get_commission_settings

    pf_settings = get_platform_fee_settings()
    pf_rate_pct = int(pf_settings['fee_rate'] * 100)
    pf_cycle = pf_settings['fee_cycle_months']
    pf_collected = get_total_platform_fees_collected()

    # Get subscription fees collected
    from creators.subscription_service import CURRENCY
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(SUM(price), 0) FROM orders WHERE status='approved' AND price > 0")
    total_book_sales_row = cur.fetchone()
    total_book_revenue = float(total_book_sales_row[0]) if total_book_sales_row else 0
    cur.execute("SELECT COUNT(*) FROM orders WHERE status='approved' AND price > 0")
    total_book_count = cur.fetchone()[0] or 0
    conn.close()

    total_platform_revenue = pf_collected  # platform fees collected

    all_creators = get_all_creators_sales()

    text = (
        "\U0001f4b0 *Platform Earnings*\n"
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4ca *All Book Sales (tracked):*\n"
        f"\U0001f6d2 Total orders: *{total_book_count}*\n"
        f"\U0001f4b5 Total revenue: *GH\u20b5 {total_book_revenue:,.2f}*\n"
        f"_(Money goes to creators directly)_\n\n"
        f"\U0001f4b0 *Platform Revenue:*\n"
        f"\U0001f3e2 Platform fees collected: *GH\u20b5 {pf_collected:,.2f}*\n\n"
        f"\u2699\ufe0f Platform fee rate: *{pf_rate_pct}%*\n"
        f"\U0001f504 Fee cycle: Every *{pf_cycle} months*\n"
    )
    if all_creators:
        text += "\n\U0001f3c6 *Top Creators by Sales*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        for i, row in enumerate(all_creators[:5], 1):
            cid, uname, fname, sales, revenue = row
            name = _esc_md(uname or fname or str(cid))
            text += f"{i}. {name} \u2014 *{sales}* sales \u2014 *GH\u20b5 {float(revenue):,.0f}*\n"
    keyboard = [
        [InlineKeyboardButton(f"\u270f\ufe0f Change Fee Rate ({pf_rate_pct}%)", callback_data='pf_set_rate')],
        [InlineKeyboardButton(f"\U0001f504 Change Fee Cycle ({pf_cycle}mo)", callback_data='pf_set_cycle')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def commission_toggle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle commission ON/OFF."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    from payments.commission_service import is_commission_enabled, set_commission_enabled
    current = is_commission_enabled()
    set_commission_enabled(not current)
    new_state = "ON" if not current else "OFF"
    await _safe_edit(query, 
        f"\u2699\ufe0f Commission is now *{new_state}*.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Earnings", callback_data='founder_earnings')]]),
    )


async def commission_set_rate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt to enter new commission rate."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    _clear_text_input_flags(context, keep='awaiting_commission_rate')
    context.user_data['awaiting_commission_rate'] = True
    await _safe_edit(query, 
        "\u270f\ufe0f *Set Commission Rate*\n\n"
        "Enter the platform commission percentage (1-99).\n"
        "Example: `30` for 30% platform fee.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='founder_earnings')]]),
    )


async def commission_rate_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for commission rate."""
    if not context.user_data.get('awaiting_commission_rate'):
        return
    context.user_data.pop('awaiting_commission_rate', None)
    text = update.message.text.strip().replace('%', '')
    try:
        pct = int(text)
        if pct < 1 or pct > 99:
            raise ValueError
    except ValueError:
        await update.message.reply_text(
            "\u26a0\ufe0f Invalid. Enter a number between 1 and 99.",
        )
        context.user_data['awaiting_commission_rate'] = True
        return
    from payments.commission_service import set_commission_rate
    set_commission_rate(pct / 100.0)
    await update.message.reply_text(
        f"\u2705 Commission rate set to *{pct}%*.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Earnings", callback_data='founder_earnings')]]),
    )


async def pf_set_rate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt Founder to enter new platform fee rate."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    _clear_text_input_flags(context, keep='awaiting_pf_rate')
    context.user_data['awaiting_pf_rate'] = True
    await _safe_edit(query, 
        "\u270f\ufe0f *Set Platform Fee Rate*\n\n"
        "Enter the platform fee percentage (1-99).\n"
        "Example: `5` for 5%.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='founder_earnings')]]),
    )


async def pf_rate_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for platform fee rate."""
    if not context.user_data.get('awaiting_pf_rate'):
        return
    context.user_data.pop('awaiting_pf_rate', None)
    text = update.message.text.strip().replace('%', '')
    try:
        pct = int(text)
        if pct < 1 or pct > 99:
            raise ValueError
    except ValueError:
        await update.message.reply_text("\u26a0\ufe0f Invalid. Enter a number between 1 and 99.")
        context.user_data['awaiting_pf_rate'] = True
        return
    from payments.platform_fee_service import set_platform_fee_rate
    set_platform_fee_rate(pct / 100.0)
    await update.message.reply_text(
        f"\u2705 Platform fee rate set to *{pct}%*.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Earnings", callback_data='founder_earnings')]]),
    )


async def pf_set_cycle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt Founder to enter new platform fee cycle."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    _clear_text_input_flags(context, keep='awaiting_pf_cycle')
    context.user_data['awaiting_pf_cycle'] = True
    await _safe_edit(query, 
        "\U0001f504 *Set Platform Fee Cycle*\n\n"
        "Enter the number of months between fee collections (1-24).\n"
        "Example: `5` for every 5 months.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='founder_earnings')]]),
    )


async def pf_cycle_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for platform fee cycle."""
    if not context.user_data.get('awaiting_pf_cycle'):
        return
    context.user_data.pop('awaiting_pf_cycle', None)
    text = update.message.text.strip()
    try:
        months = int(text)
        if months < 1 or months > 24:
            raise ValueError
    except ValueError:
        await update.message.reply_text("\u26a0\ufe0f Invalid. Enter a number between 1 and 24.")
        context.user_data['awaiting_pf_cycle'] = True
        return
    from payments.platform_fee_service import set_platform_fee_cycle
    set_platform_fee_cycle(months)
    await update.message.reply_text(
        f"\u2705 Platform fee cycle set to every *{months} months*.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Earnings", callback_data='founder_earnings')]]),
    )


async def founder_review_fees_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show pending platform fees for Founder to review."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    from payments.platform_fee_service import list_pending_platform_fees
    fees = list_pending_platform_fees()
    if not fees:
        await _safe_edit(query, 
            "\U0001f4b0 *Review Platform Fees*\n\nNo pending platform fees.",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')]]),
        )
        return
    keyboard = []
    for row in fees:
        fee_id, creator_id, username, p_start, p_end, total_sales, fee_rate, fee_amount, status, proof_fid = row
        name = _esc_md(username or str(creator_id))
        proof_icon = "\U0001f4f8" if proof_fid else "\u23f3"
        status_icon = "\u23f3" if status == 'proof_submitted' else "\u26a0\ufe0f"
        label = f"{status_icon} {name} \u2014 GH\u20b5 {fee_amount:,.0f}"
        keyboard.append([InlineKeyboardButton(f"{proof_icon} {label}", callback_data=f'fee_detail_{fee_id}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')])
    await _safe_edit(query, 
        f"\U0001f4b0 *Pending Platform Fees* ({len(fees)}):",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def fee_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show detail of a platform fee."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    try:
        fee_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid fee.")
        return
    from payments.platform_fee_service import get_platform_fee
    fee = get_platform_fee(fee_id)
    if not fee:
        await _safe_edit(query, "Fee not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_review_fees')]]))
        return
    fid, creator_id, p_start, p_end, total_sales, fee_rate, fee_amount, status, proof_fid, created_at, paid_at = fee
    # Get creator username
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT username FROM users WHERE telegram_id=%s", (creator_id,))
    urow = cur.fetchone()
    conn.close()
    name = _esc_md(urow[0] if urow and urow[0] else str(creator_id))
    rate_pct = int(fee_rate * 100)
    text = (
        f"\U0001f4b0 *Platform Fee #{fid}*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f464 Creator: {name} (`{creator_id}`)\n"
        f"\U0001f4c5 Period: {str(p_start)[:10]} to {str(p_end)[:10]}\n"
        f"\U0001f4b5 Sales in period: *GH\u20b5 {total_sales:,.2f}*\n"
        f"\u2699\ufe0f Rate: *{rate_pct}%*\n"
        f"\U0001f4b0 Fee amount: *GH\u20b5 {fee_amount:,.2f}*\n"
        f"\U0001f4e6 Status: *{status}*\n"
    )
    if proof_fid:
        text += "\U0001f4f8 Proof: attached"
    else:
        text += "\u274c Proof: not yet sent"
    keyboard = []
    if status in ['pending', 'proof_submitted']:
        keyboard.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'fee_approve_{fee_id}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'fee_reject_{fee_id}'),
        ])
    if proof_fid:
        keyboard.append([InlineKeyboardButton("\U0001f4f8 View Proof", callback_data=f'view_fee_proof_{fee_id}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Fees", callback_data='founder_review_fees')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def view_fee_proof_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """View the proof photo for a platform fee."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    try:
        fee_id = int(query.data.split('_')[-1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid fee.")
        return
    from payments.platform_fee_service import get_platform_fee
    fee = get_platform_fee(fee_id)
    if not fee or not fee[8]:
        await _safe_edit(query, "No proof attached.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=f'fee_detail_{fee_id}')]]))
        return
    fid, creator_id, p_start, p_end, total_sales, fee_rate, fee_amount, status, proof_fid, created_at, paid_at = fee
    # Get creator name
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT username, first_name FROM users WHERE telegram_id=%s", (creator_id,))
    urow = cur.fetchone()
    conn.close()
    cname = urow[0] or urow[1] or str(creator_id) if urow else str(creator_id)
    rate_pct = int(fee_rate * 100)
    try:
        await query.message.delete()
    except Exception:
        pass
    caption = (
        f"\U0001f4f8 *Platform Fee Proof #{fid}*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        f"\U0001f464 Creator: {_esc_md(cname)} (`{creator_id}`)\n"
        f"\U0001f4c5 Period: {str(p_start)[:10]} to {str(p_end)[:10]}\n"
        f"\U0001f4b5 Sales in period: *GH\u20b5 {total_sales:,.2f}*\n"
        f"\u2699\ufe0f Rate: *{rate_pct}%*\n"
        f"\U0001f4b0 Amount bot asked to pay: *GH\u20b5 {fee_amount:,.2f}*\n\n"
        f"Check if the proof matches this amount."
    )
    keyboard_rows = []
    if status in ['pending', 'proof_submitted']:
        keyboard_rows.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'fee_approve_{fee_id}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'fee_reject_{fee_id}'),
        ])
    keyboard_rows.append([InlineKeyboardButton("\u25c0 Back to Fees", callback_data='founder_review_fees')])
    await query.message.chat.send_photo(
        photo=proof_fid,
        caption=caption,
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
        protect_content=True,
        parse_mode='Markdown',
    )


async def fee_approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Approve a platform fee payment."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    try:
        fee_id = int(query.data.split('_')[-1])
    except (IndexError, ValueError):
        return
    from payments.platform_fee_service import approve_platform_fee, get_platform_fee
    fee = get_platform_fee(fee_id)
    if not fee:
        await _safe_edit(query, "Fee not found.")
        return
    approve_platform_fee(fee_id)
    creator_id = fee[1]
    fee_amount = fee[6]
    result_text = f"\u2705 Platform fee #{fee_id} approved!\n\nGH\u20b5 {fee_amount:,.2f} from creator {creator_id}"
    result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Fees", callback_data='founder_review_fees')]])
    try:
        await _safe_edit(query, result_text, reply_markup=result_kb)
    except Exception:
        try:
            await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.message.delete()
            except Exception:
                pass
            await query.message.chat.send_message(result_text, reply_markup=result_kb)
    # Notify the creator
    try:
        await context.bot.send_message(
            chat_id=creator_id,
            text=(
                f"\u2705 Your platform fee of *GH\u20b5 {fee_amount:,.2f}* has been approved!\n\n"
                f"You can now upload books again."
            ),
            parse_mode='Markdown',
        )
    except Exception:
        pass


async def fee_reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Reject a platform fee proof."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    try:
        fee_id = int(query.data.split('_')[-1])
    except (IndexError, ValueError):
        return
    from payments.platform_fee_service import reject_platform_fee, get_platform_fee
    fee = get_platform_fee(fee_id)
    if not fee:
        await _safe_edit(query, "Fee not found.")
        return
    reject_platform_fee(fee_id)
    creator_id = fee[1]
    fee_amount = fee[6]
    result_text = f"\u274c Platform fee #{fee_id} proof rejected.\n\nCreator must resubmit proof."
    result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Fees", callback_data='founder_review_fees')]])
    try:
        await _safe_edit(query, result_text, reply_markup=result_kb)
    except Exception:
        try:
            await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.message.delete()
            except Exception:
                pass
            await query.message.chat.send_message(result_text, reply_markup=result_kb)
    # Notify the creator
    try:
        await context.bot.send_message(
            chat_id=creator_id,
            text=(
                f"\u274c Your platform fee proof was rejected.\n\n"
                f"Amount due: *GH\u20b5 {fee_amount:,.2f}*\n\n"
                f"Please resubmit a valid payment proof."
            ),
            parse_mode='Markdown',
        )
    except Exception:
        pass


async def founder_manage_subscriptions_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    from creators.subscription_service import (
        list_all_subscriptions, get_all_plan_prices, TIERS, CURRENCY,
        is_subscription_collection_enabled, 
    )
    subs = list_all_subscriptions(limit=20)
    plans = get_all_plan_prices()
    sub_collection_on = is_subscription_collection_enabled()

    # Subscription collection status
    sc_icon = "\u2705" if sub_collection_on else "\u274c"
    sc_text = "ON" if sub_collection_on else "OFF"

    # Show current plan prices grouped by tier
    price_lines = [
        "\U0001f4cb *Manage Subscriptions*\n",
        f"\U0001f4b0 Subscription Collection: {sc_icon} *{sc_text}*\n",
        "\U0001f4b0 *Current Plan Prices:*",
    ]
    for plan_name, tier, cycle, price, label in plans:
        safe_label = _esc_md(str(label))
        price_lines.append(f"  \u2022 {safe_label}: *{CURRENCY} {price:,.2f}*")

    if not subs:
        text = "\n".join(price_lines) + "\n\nNo subscriptions granted yet."
    else:
        lines = ["\n\n\U0001f4cb *Recent Subscriptions:*\n"]
        for row in subs:
            sub_id, creator_id, username, plan, start, end, status = row[:7]
            tier_val = row[7] if len(row) > 7 else ''
            name = _esc_md(username or str(creator_id))
            emoji = "\u2705" if status == 'active' else "\u274c"
            tier_name = TIERS.get(tier_val, {}).get('name', tier_val) if tier_val else _esc_md(str(plan))
            lines.append(f"{emoji} {name} \u2014 {tier_name} (until {str(end)[:10]})")
        text = "\n".join(price_lines) + "\n".join(lines)

    # Toggle label for subscription collection
    if sub_collection_on:
        toggle_label = "\U0001f534 Turn OFF Subscription Collection"
    else:
        toggle_label = "\U0001f7e2 Turn ON Subscription Collection"

    keyboard = [
        [InlineKeyboardButton(toggle_label, callback_data='sub_collection_toggle')],
        [InlineKeyboardButton("\u2705 Grant Subscription", callback_data='founder_grant_sub')],
        [InlineKeyboardButton("\u270f\ufe0f Edit Plan Prices", callback_data='founder_edit_sub_prices')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')],
    ]
    await _safe_edit(query, 
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def sub_collection_toggle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Toggle subscription collection ON/OFF."""
    query = update.callback_query
    await query.answer()
    if get_user_role(query.from_user.id) != ROLE_FOUNDER:
        return
    from creators.subscription_service import (
        is_subscription_collection_enabled, set_subscription_collection_enabled,
    )
    current = is_subscription_collection_enabled()
    set_subscription_collection_enabled(not current)
    new_state = "ON" if not current else "OFF"
    if not current:
        msg = "Users who want to become creators must now pay a subscription fee before being approved."
    else:
        msg = "Users can now become creators without paying a subscription fee."
    await _safe_edit(query, 
        f"\U0001f4b0 Subscription collection is now *{new_state}*.\n\n{msg}",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Subscriptions", callback_data='founder_subscriptions')]]),
    )


async def founder_grant_sub_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT telegram_id, username FROM users WHERE role='creator' OR creator_application_status='payment_required'")
    creators = c.fetchall()
    conn.close()
    if not creators:
        await _safe_edit(query, "No creators to grant subscriptions to.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_subscriptions')]]))
        return
    from creators.subscription_service import TIERS, CURRENCY
    keyboard = []
    for tid, uname in creators:
        label = uname or str(tid)
        for tier_key, info in TIERS.items():
            keyboard.append([InlineKeyboardButton(
                f"{info['emoji']} {label} \u2014 {info['name']} (Monthly)",
                callback_data=f'grant_sub_{tid}_{tier_key}_monthly',
            )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='founder_subscriptions')])
    await _safe_edit(query, 
        "\u2705 *Grant Subscription*\n\nSelect a creator and plan:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def grant_sub_action_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    try:
        # grant_sub_{creator_id}_{tier}_{cycle}
        parts = query.data.split('_')
        creator_id = int(parts[2])
        tier = parts[3]
        cycle = parts[4] if len(parts) > 4 else 'monthly'
        plan = f'{tier}_{cycle}'
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_subscriptions')]]))
        return
    from creators.subscription_service import create_subscription, unhide_books_for_creator, TIERS, CURRENCY
    from creators.approvals import approve_creator as _approve
    sub_id, end_date = create_subscription(creator_id, plan)
    _approve(creator_id)
    unhide_books_for_creator(creator_id)
    tier_info = TIERS.get(tier, {})
    tier_name = tier_info.get('name', tier) if tier_info else tier
    tier_emoji = tier_info.get('emoji', '') if tier_info else ''
    result_text = (
        f"\u2705 Subscription granted!\n\n"
        f"Creator: {creator_id}\n"
        f"Plan: {tier_emoji} {tier_name} ({cycle.title()})\n"
        f"Until: {str(end_date)[:10]}\n\n"
        f"Their books are now visible again."
    )
    result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_subscriptions')]])
    try:
        await _safe_edit(query, result_text, reply_markup=result_kb)
    except Exception:
        try:
            await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
        except Exception:
            await query.message.reply_text(result_text, reply_markup=result_kb)
    # Notify creator
    try:
        await context.bot.send_message(
            chat_id=creator_id,
            text=(
                f"\u2705 *Subscription Activated!*\n\n"
                f"{tier_emoji} Plan: *{tier_name}* ({cycle.title()})\n"
                f"\U0001f4c5 Until: {str(end_date)[:10]}\n\n"
                f"Your books are now visible and you have full creator access.\n"
                f"Use /start to access your Creator Dashboard."
            ),
            parse_mode='Markdown',
        )
    except Exception:
        pass


async def founder_sub_proofs_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List pending subscription proofs individually with per-proof approve/reject buttons."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    from payments.subscription_proof_service import list_pending_sub_proofs, count_pending_sub_proofs
    from creators.subscription_service import get_plan_price, TIERS, CURRENCY

    page = 0
    data = query.data
    if data.startswith('founder_sub_proofs_page_'):
        try:
            page = int(data.split('_')[-1])
        except ValueError:
            page = 0

    per_page = 10
    offset = page * per_page
    proofs = list_pending_sub_proofs(limit=per_page, offset=offset)
    total = count_pending_sub_proofs()

    if not proofs:
        await _safe_edit(query, 
            "\U0001f4f8 *Review Subscription Proofs*\n\nNo pending proofs to review.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back", callback_data='open_founder_dashboard')]]),
            parse_mode='Markdown',
        )
        return

    total_pages = max(1, (total + per_page - 1) // per_page)

    keyboard = []
    for row in proofs:
        proof_id, user_id, plan, proof_fid, status, created_at, username = row
        name = username or str(user_id)
        plan_display = plan.replace('_', ' ').title()
        price = get_plan_price(plan)
        label = f"{name} \u2014 {plan_display} ({CURRENCY} {price:,.0f})"
        keyboard.append([InlineKeyboardButton(f"\U0001f4f8 {label}", callback_data=f'subproof_detail_{proof_id}')])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("\u25c0 Prev", callback_data=f'founder_sub_proofs_page_{page - 1}'))
    if page < total_pages - 1:
        nav.append(InlineKeyboardButton("Next \u25b6", callback_data=f'founder_sub_proofs_page_{page + 1}'))
    if nav:
        keyboard.append(nav)
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back", callback_data='open_founder_dashboard')])

    await _safe_edit(query, 
        f"\U0001f4f8 *Pending Subscription Proofs* \u2014 Page {page + 1}/{total_pages}:\n\n"
        f"Tap a proof to view and approve/reject.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def subproof_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show detail of a single subscription proof with approve/reject."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    try:
        proof_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid proof.")
        return

    from payments.subscription_proof_service import get_sub_proof
    proof = get_sub_proof(proof_id)
    if not proof:
        await _safe_edit(query, "Proof not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_sub_proofs')]]))
        return

    pid, user_id, plan, proof_fid, status, created_at = proof
    from creators.subscription_service import get_plan_price, CURRENCY
    price = get_plan_price(plan)
    plan_display = plan.replace('_', ' ').title()

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE telegram_id=%s", (user_id,))
    urow = c.fetchone()
    conn.close()
    name = urow[0] if urow and urow[0] else str(user_id)

    # Delete old message and send the proof photo
    try:
        await query.message.delete()
    except Exception:
        pass

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("\u2705 Approve", callback_data=f'subproof_approve_{proof_id}'),
         InlineKeyboardButton("\u274c Reject", callback_data=f'subproof_reject_{proof_id}')],
        [InlineKeyboardButton("\u25c0 Back to Proofs", callback_data='founder_sub_proofs')],
    ])
    safe_name = str(name).replace('_', '\\_')
    await query.message.chat.send_photo(
        photo=proof_fid,
        caption=(
            f"\U0001f4f8 *Subscription Proof #{pid}*\n\n"
            f"\U0001f464 User: @{safe_name} (`{user_id}`)\n"
            f"\U0001f4cb Plan: {plan_display}\n"
            f"\U0001f4b5 Amount: {CURRENCY} {price:,.0f}\n"
            f"\U0001f4c5 Sent: {str(created_at)[:16]}\n"
            f"\U0001f4e6 Status: {status.title()}"
        ),
        parse_mode='Markdown',
        reply_markup=keyboard,
        protect_content=True,
    )


async def view_subproof_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Founder taps 'Open To See The Proof' from the chat notification for subscription proofs."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    try:
        proof_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid proof.")
        return

    from payments.subscription_proof_service import get_sub_proof
    proof = get_sub_proof(proof_id)
    if not proof:
        await _safe_edit(query, "Proof not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    pid, user_id, plan, proof_fid, status, created_at = proof
    from creators.subscription_service import get_plan_price as _gpp2, CURRENCY
    price = _gpp2(plan)
    plan_display = plan.replace('_', ' ').title()

    conn_vsp = get_db()
    c_vsp = conn_vsp.cursor()
    c_vsp.execute("SELECT username FROM users WHERE telegram_id=%s", (user_id,))
    urow_vsp = c_vsp.fetchone()
    conn_vsp.close()
    name = urow_vsp[0] if urow_vsp and urow_vsp[0] else str(user_id)
    safe_name = str(name).replace('_', '\\_')

    try:
        await query.message.delete()
    except Exception:
        pass

    keyboard_rows = []
    if status == 'pending':
        keyboard_rows.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'subproof_approve_{proof_id}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'subproof_reject_{proof_id}'),
        ])
    else:
        keyboard_rows.append([InlineKeyboardButton(f"\U0001f4e6 Already {status.title()}", callback_data='noop')])
    keyboard_rows.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    await query.message.chat.send_photo(
        photo=proof_fid,
        caption=(
            f"\U0001f4f8 *Subscription Proof #{pid}*\n\n"
            f"\U0001f464 Creator: @{safe_name} (`{user_id}`)\n"
            f"\U0001f4cb Plan: {plan_display}\n"
            f"\U0001f4b5 Amount: {CURRENCY} {price:,.0f}\n"
            f"\U0001f4c5 Sent: {str(created_at)[:16]}\n"
            f"\U0001f4e6 Status: {status.title()}"
        ),
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
        protect_content=True,
    )


async def subproof_action_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Approve or reject a subscription proof by proof ID."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    try:
        parts = query.data.split('_')
        action = parts[1]  # 'approve' or 'reject'
        proof_id = int(parts[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid action.")
        return

    from payments.subscription_proof_service import get_sub_proof, update_sub_proof_status
    proof = get_sub_proof(proof_id)
    if not proof:
        await _safe_edit(query, "Proof not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_sub_proofs')]]))
        return

    pid, creator_id, plan, proof_fid, status, created_at = proof

    if status != 'pending':
        result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])
        already_text = f"This proof has already been {status}."
        try:
            await _safe_edit(query, already_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.edit_message_caption(caption=already_text, reply_markup=result_kb)
            except Exception:
                try:
                    await query.message.delete()
                except Exception:
                    pass
                await query.message.chat.send_message(already_text, reply_markup=result_kb)
        return

    # Look up creator info for evidence
    conn_ev = get_db()
    c_ev = conn_ev.cursor()
    c_ev.execute("SELECT username, first_name FROM users WHERE telegram_id=%s", (creator_id,))
    _urow_ev = c_ev.fetchone()
    conn_ev.close()
    creator_username = _urow_ev[0] if _urow_ev and _urow_ev[0] else str(creator_id)
    creator_name = _urow_ev[1] if _urow_ev and len(_urow_ev) > 1 and _urow_ev[1] else None
    from creators.subscription_service import get_plan_price as _gpp
    sub_amount = _gpp(plan)
    plan_display = plan.replace('_', ' ').title()

    result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])

    if action == 'approve':
        update_sub_proof_status(proof_id, 'approved')

        # Parse plan to get tier and cycle
        plan_parts = plan.split('_')
        tier = plan_parts[0] if plan_parts else plan
        cycle = plan_parts[1] if len(plan_parts) > 1 else 'monthly'

        from creators.subscription_service import create_subscription, unhide_books_for_creator, TIERS
        from creators.approvals import approve_creator as _approve
        sub_id, end_date = create_subscription(creator_id, plan)
        _approve(creator_id)
        unhide_books_for_creator(creator_id)
        tier_info = TIERS.get(tier, {})
        tier_name = tier_info.get('name', tier) if tier_info else tier
        tier_emoji = tier_info.get('emoji', '') if tier_info else ''

        # Save evidence
        from payments.payment_evidence import save_evidence
        save_evidence(
            evidence_type='subscription', order_id=pid,
            buyer_id=creator_id, buyer_username=creator_username, buyer_name=creator_name,
            book_title=plan_display, amount=float(sub_amount) if sub_amount else 0,
            proof_file_id=proof_fid, action='approved', acted_by=query.from_user.id,
        )

        result_text = (
            f"\u2705 Proof #{proof_id} approved!\n\n"
            f"Creator: {creator_id}\n"
            f"Plan: {tier_emoji} {tier_name} ({cycle.title()})\n"
            f"Until: {str(end_date)[:10]}\n\n"
            f"Their books are now visible."
        )
        try:
            await _safe_edit(query, result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
            except Exception:
                try:
                    await query.message.delete()
                except Exception:
                    pass
                await query.message.chat.send_message(result_text, reply_markup=result_kb)

        # Notify creator
        try:
            await context.bot.send_message(
                chat_id=creator_id,
                text=(
                    f"\u2705 *Subscription Activated!*\n\n"
                    f"{tier_emoji} Plan: *{tier_name}* ({cycle.title()})\n"
                    f"\U0001f4c5 Until: {str(end_date)[:10]}\n\n"
                    f"Your books are now visible and you have full creator access.\n"
                    f"Use /start to access your Creator Dashboard."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass

    elif action == 'reject':
        update_sub_proof_status(proof_id, 'rejected')

        # Save evidence
        from payments.payment_evidence import save_evidence
        save_evidence(
            evidence_type='subscription', order_id=pid,
            buyer_id=creator_id, buyer_username=creator_username, buyer_name=creator_name,
            book_title=plan_display, amount=float(sub_amount) if sub_amount else 0,
            proof_file_id=proof_fid, action='rejected', acted_by=query.from_user.id,
        )

        result_text = f"\u274c Proof #{proof_id} rejected."
        try:
            await _safe_edit(query, result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
            except Exception:
                try:
                    await query.message.delete()
                except Exception:
                    pass
                await query.message.chat.send_message(result_text, reply_markup=result_kb)

        # Notify creator they can send again
        try:
            await context.bot.send_message(
                chat_id=creator_id,
                text=(
                    "\u274c *Subscription Proof Rejected*\n\n"
                    "Your subscription payment proof was not approved.\n"
                    "Please send a valid proof screenshot to try again.\n\n"
                    "Use /start \u2192 \U0001f4b0 Pay Subscription."
                ),
                parse_mode='Markdown',
            )
        except Exception:
            pass


async def founder_edit_sub_prices_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show current plan prices with edit buttons."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    from creators.subscription_service import get_all_plan_prices, CURRENCY
    plans = get_all_plan_prices()
    lines = ["\u270f\ufe0f *Edit Subscription Prices*\n"]
    keyboard = []
    for plan_name, tier, cycle, price, label in plans:
        lines.append(f"\u2022 {label}: *{CURRENCY} {price:,.2f}*")
        keyboard.append([InlineKeyboardButton(f"\u270f\ufe0f {label}", callback_data=f'set_sub_price_{plan_name}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='founder_subscriptions')])
    await _safe_edit(query, 
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def founder_set_sub_price_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt founder to enter new price for a plan."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.")
        return
    plan = query.data.replace('set_sub_price_', '')
    from creators.subscription_service import get_plan_price, CURRENCY
    current = get_plan_price(plan)
    _clear_text_input_flags(context, keep='awaiting_sub_price_edit')
    context.user_data['awaiting_sub_price_edit'] = plan
    await _safe_edit(query, 
        f"\u270f\ufe0f *Edit {plan.replace('_', ' ').title()} Price*\n\n"
        f"Current price: *{CURRENCY} {current:,.2f}*\n\n"
        f"Type the new price (number only):\n"
        f"Example: `250`",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u274c Cancel", callback_data='founder_edit_sub_prices')]]),
    )


async def founder_sub_price_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text input for new subscription price."""
    plan = context.user_data.get('awaiting_sub_price_edit')
    if not plan:
        return
    role = get_user_role(update.effective_user.id)
    if role != ROLE_FOUNDER:
        return
    text = update.message.text.strip().replace(',', '').replace(' ', '')
    try:
        new_price = float(text)
        if new_price <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text(
            "\u274c Invalid price. Please enter a positive number.\nExample: `5000`",
            parse_mode='Markdown',
        )
        return
    from creators.subscription_service import set_plan_price, CURRENCY
    ok = set_plan_price(plan, new_price)
    context.user_data.pop('awaiting_sub_price_edit', None)
    if ok:
        await update.message.reply_text(
            f"\u2705 *{plan.replace('_', ' ').title()} price updated to {CURRENCY} {new_price:,.2f}!*\n\n"
            f"All new subscriptions will use this price.",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u270f\ufe0f Edit More Prices", callback_data='founder_edit_sub_prices')],
                [InlineKeyboardButton("\u25c0 Back to Subscriptions", callback_data='founder_subscriptions')],
            ]),
        )
    else:
        await update.message.reply_text(
            f"\u274c Failed to update price. Plan '{plan}' not found.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_edit_sub_prices')]]),
        )


async def founder_genres_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name FROM genres ORDER BY name")
    genres = c.fetchall()
    conn.close()
    keyboard = []
    for gid, name in genres:
        keyboard.append([
            InlineKeyboardButton(f"\U0001f3ad {name}", callback_data='noop'),
            InlineKeyboardButton("\U0001f5d1", callback_data=f'genre_delete_{gid}'),
        ])
    keyboard.append([InlineKeyboardButton("\u2795 Add Genre", callback_data='genre_add_start')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_founder_dashboard')])
    await _safe_edit(query, 
        f"\U0001f3ad *Manage Genres* ({len(genres)} total)\n\nTap \U0001f5d1 to delete a genre.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def founder_delete_genre(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    try:
        genre_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid genre.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='founder_genres')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM genres WHERE id=%s", (genre_id,))
    conn.commit()
    conn.close()
    await query.answer("\u2705 Genre deleted!", show_alert=True)
    update_obj = update
    await founder_genres_callback(update_obj, context)


async def founder_add_genre_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    context.user_data['adding_genre'] = True
    await _safe_edit(query, 
        "Enter the new genre name:",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='founder_genres')]]),
    )
    return GENRE_ADD_NAME


async def founder_add_genre_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get('adding_genre'):
        return
    context.user_data.pop('adding_genre', None)
    name = update.message.text.strip()
    _genre_back = InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Genres", callback_data='founder_genres')]])
    if not name:
        await update.message.reply_text("\u274c Genre name cannot be empty.", reply_markup=_genre_back)
        return ConversationHandler.END
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute("INSERT INTO genres (name) VALUES (%s)", (name,))
        conn.commit()
        await update.message.reply_text(f"\u2705 Genre '{name}' added!", reply_markup=_genre_back)
    except Exception:
        conn.rollback()
        await update.message.reply_text(f"\u274c Genre '{name}' already exists.", reply_markup=_genre_back)
    conn.close()
    return ConversationHandler.END


def ensure_genres_access_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS access (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        access_type TEXT NOT NULL DEFAULT 'permanent',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        status TEXT DEFAULT 'active'
    )''')
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    default_genres = [
        'Romance', 'Fantasy', 'Motivation', 'Stories', 'Education',
        'Business', 'Spiritual', 'Self-Help', 'Biography', 'Technology',
        'Health', 'Poetry', 'Religion', 'Children', 'History',
    ]
    for g in default_genres:
        cur.execute("INSERT INTO genres (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (g,))
    conn.commit()
    conn.close()

async def dash_admins_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await show_admin_management(update, context)

async def dash_creators_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE telegram_id=%s", (user_id,))
    role = c.fetchone()
    conn.close()
    if not role or role[0] not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    back_cb = 'open_founder_dashboard' if role[0] == ROLE_FOUNDER else 'open_admin_panel'
    keyboard = [
        [InlineKeyboardButton("View Applications", callback_data='creator_apps')],
        [InlineKeyboardButton("List Creators", callback_data='list_creators')],
        [InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await _safe_edit(query, "Creators Dashboard:", reply_markup=reply_markup)

async def creator_apps_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    pending = list_pending_creator_applications()
    if not pending:
        await _safe_edit(query, "No pending creator applications.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_creators')]]))
        return

    from creators.profile_service import get_creator_profile

    # Show each applicant with their profile info
    try:
        await query.message.delete()
    except Exception:
        pass

    for telegram_id, username in pending:
        profile = get_creator_profile(telegram_id)
        tg_name = username or str(telegram_id)

        if profile:
            text = (
                f"\U0001f514 *Creator Application*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
                f"\U0001f464 Telegram: @{tg_name}\n"
                f"\u270d\ufe0f Pen Name: *{profile['pen_name']}*\n"
                f"\U0001f4dd Bio: {profile['bio']}\n"
            )
        else:
            text = (
                f"\U0001f514 *Creator Application*\n"
                f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
                f"\U0001f464 Telegram: @{tg_name}\n"
                f"_No profile submitted (old application)_\n"
            )

        if role == ROLE_FOUNDER:
            kb = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("\u2705 Approve", callback_data=f'creator_approve_{telegram_id}'),
                    InlineKeyboardButton("\U0001f4b0 Pay First", callback_data=f'creator_payreq_{telegram_id}'),
                ],
                [InlineKeyboardButton("\u274c Reject", callback_data=f'creator_reject_{telegram_id}')],
            ])
        else:
            kb = None

        pic_fid = profile.get('profile_pic_file_id') if profile else None
        try:
            if pic_fid:
                await query.message.chat.send_photo(photo=pic_fid, caption=text, reply_markup=kb, parse_mode='Markdown', protect_content=True)
            else:
                await query.message.chat.send_message(text, reply_markup=kb, parse_mode='Markdown')
        except Exception:
            await query.message.chat.send_message(text, reply_markup=kb, parse_mode='Markdown')

    # Back button
    await query.message.chat.send_message(
        f"\U0001f4cb {len(pending)} pending application(s)",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Creators", callback_data='dash_creators')]]),
    )

async def dash_creator_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await show_creator_dashboard(update, context)

async def list_creators_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT telegram_id, username, first_name, COALESCE(status, 'active') "
        "FROM users WHERE role='creator' ORDER BY username"
    )
    creators = c.fetchall()
    conn.close()
    if not creators:
        await _safe_edit(query, "No approved creators yet.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='dash_creators')]]))
        return
    keyboard = []
    for tid, uname, fname, ustatus in creators:
        name = uname or fname or str(tid)
        status_icon = {
            "active": "\u2705", "banned": "\U0001f6ab", "blocked": "\U0001f6d1"
        }.get(ustatus, "\u2705")
        keyboard.append([InlineKeyboardButton(f"{status_icon} {name}", callback_data=f'cr_detail_{tid}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='dash_creators')])
    await _safe_edit(query, 
        f"\u270d\ufe0f *Creators* ({len(creators)})",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def creator_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show creator profile with stats and ban/block buttons."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    try:
        target_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT telegram_id, username, first_name, last_name, date_joined, last_active, "
        "COALESCE(status, 'active') FROM users WHERE telegram_id=%s",
        (target_id,),
    )
    user = c.fetchone()
    if not user:
        conn.close()
        await _safe_edit(query, "Creator not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='list_creators')]]))
        return
    tid, uname, fname, lname, joined, last_act, ustatus = user

    # Book count
    c.execute("SELECT COUNT(*) FROM content WHERE creator_telegram_id=%s AND status IN ('approved','ongoing','complete') AND deleted_at IS NULL", (target_id,))
    book_count = c.fetchone()[0]
    # Total sales
    c.execute(
        "SELECT COUNT(*) FROM orders o JOIN content ct ON o.content_id=ct.id "
        "WHERE ct.creator_telegram_id=%s AND o.status='approved'", (target_id,)
    )
    sales = c.fetchone()[0]
    conn.close()

    name = (fname or "") + (f" {lname}" if lname else "")
    name = name.strip() or "N/A"
    status_icon = {"active": "\u2705", "banned": "\U0001f6ab", "blocked": "\U0001f6d1"}.get(ustatus, "\u2705")
    joined_str = str(joined)[:10] if joined else "N/A"

    text = f"\u270d\ufe0f *Creator Profile*\n\n*Name:* {name}\n"
    if uname:
        text += f"*Username:* @{uname}\n"
    text += (
        f"*Telegram ID:* `{tid}`\n"
        f"*Status:* {status_icon} {ustatus.title()}\n"
        f"*Joined:* {joined_str}\n\n"
        f"\U0001f4da Books: *{book_count}*\n"
        f"\U0001f4b0 Sales: *{sales}*\n"
    )

    keyboard = []
    # Ban/Block buttons
    if ustatus == 'banned':
        keyboard.append([InlineKeyboardButton("\u2705 Unban Creator", callback_data=f'cr_unban_{target_id}')])
    else:
        keyboard.append([InlineKeyboardButton("\U0001f6ab Ban Creator", callback_data=f'cr_ban_{target_id}')])
    if ustatus == 'blocked':
        keyboard.append([InlineKeyboardButton("\u2705 Unblock Creator", callback_data=f'cr_unblock_{target_id}')])
    else:
        keyboard.append([InlineKeyboardButton("\U0001f6d1 Block Creator", callback_data=f'cr_block_{target_id}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Creators", callback_data='list_creators')])

    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def _set_creator_status(update: Update, context: ContextTypes.DEFAULT_TYPE, new_status: str, message: str):
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
        return
    # Verify target is a creator
    target_role = get_user_role(target_id)
    if target_role != 'creator':
        await _safe_edit(query, "This action is only for creators.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='list_creators')]]))
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE users SET status=%s WHERE telegram_id=%s", (new_status, target_id))
    conn.commit()
    conn.close()

    # Notify the creator
    notifications = {
        'banned': (
            "\U0001f6ab *Your creator account has been banned.*\n\n"
            "You can no longer use this bot.\n"
            "Your books have been hidden from the store.\n\n"
            "If you believe this is an error, contact support:\n"
            "\U0001f4e7 support@wiamapp.com"
        ),
        'blocked': (
            "\U0001f6d1 *Your creator account has been blocked.*\n\n"
            "You can still browse but cannot upload or manage stories.\n\n"
            "If you believe this is an error, contact support:\n"
            "\U0001f4e7 support@wiamapp.com"
        ),
        'active': (
            "\u2705 *Your creator account has been restored!*\n\n"
            "You now have full access again.\n"
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
        [InlineKeyboardButton("\u270d\ufe0f View Creator", callback_data=f'cr_detail_{target_id}')],
        [InlineKeyboardButton("\u25c0 Back to Creators", callback_data='list_creators')],
    ]
    await _safe_edit(query, message, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def cr_ban_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _set_creator_status(update, context, 'banned', "\U0001f6ab Creator has been *banned*. They cannot use the bot.")

async def cr_unban_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _set_creator_status(update, context, 'active', "\u2705 Creator has been *unbanned* and restored to active.")

async def cr_block_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _set_creator_status(update, context, 'blocked', "\U0001f6d1 Creator has been *blocked*. They can browse but cannot upload or manage stories.")

async def cr_unblock_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _set_creator_status(update, context, 'active', "\u2705 Creator has been *unblocked* and restored to active.")


# ── Training Queue Handlers ────────────────────────────────────────────
# These handle inline keyboard buttons sent by telegram_notify.py
# to the TRAINING_CHAT_ID group for Founder/Editors.

async def train_assign_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show a list of intents to assign an unmatched question to."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await query.answer("Access denied.", show_alert=True)
        return

    try:
        mid = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        mid = 0

    # Fetch available intents from database
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name FROM w_bot_intents ORDER BY name")
    intents = c.fetchall()

    # Get the unmatched message text
    msg_text = ''
    if mid:
        c.execute("SELECT user_message FROM w_bot_unmatched WHERE id = %s", (mid,))
        row = c.fetchone()
        if row:
            msg_text = row[0][:200]
    conn.close()

    if not intents:
        await _safe_edit(query, "\u26a0\ufe0f No intents found in the system. Add intents first.")
        return

    keyboard = []
    for intent_id, intent_key in intents[:20]:  # Max 20 buttons
        label = intent_key.replace('intent_', '').replace('_', ' ').title()
        keyboard.append([InlineKeyboardButton(
            f"\U0001f3f7 {label}",
            callback_data=f'train_set_{mid}_{intent_id}'
        )])
    keyboard.append([InlineKeyboardButton("\u274c Cancel", callback_data=f'train_ignore_{mid}')])

    text = (
        "\U0001f4cb *Assign Intent*\n\n"
        f"Message: _{_esc_md(msg_text)}_\n\n"
        "Select the intent to assign this phrase to:"
    )
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def train_set_intent_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Actually assign the unmatched message to a specific intent."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await query.answer("Access denied.", show_alert=True)
        return

    try:
        parts = query.data.split('_')  # train_set_{mid}_{intent_id}
        mid = int(parts[2])
        intent_id = int(parts[3])
    except (IndexError, ValueError):
        await _safe_edit(query, "\u26a0\ufe0f Invalid training data.")
        return

    conn = get_db()
    c = conn.cursor()

    # Get the unmatched message
    c.execute("SELECT user_message FROM w_bot_unmatched WHERE id = %s", (mid,))
    row = c.fetchone()
    if not row:
        conn.close()
        await _safe_edit(query, "\u26a0\ufe0f Message not found (may have been deleted).")
        return
    phrase = row[0].strip()

    # Get the intent key
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    intent_row = c.fetchone()
    if not intent_row:
        conn.close()
        await _safe_edit(query, "\u26a0\ufe0f Intent not found.")
        return
    intent_key = intent_row[0]

    # Save as approved phrase for this intent
    c.execute(
        "INSERT INTO w_bot_intent_phrases (intent_id, phrase, approved) "
        "VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
        (intent_id, phrase.lower()),
    )

    # Mark the unmatched message as resolved
    c.execute(
        "UPDATE w_bot_unmatched SET resolved = TRUE, resolved_by = %s, "
        "resolved_intent = %s WHERE id = %s",
        (user_id, intent_key, mid),
    )
    conn.commit()
    conn.close()

    intent_label = intent_key.replace('intent_', '').replace('_', ' ').title()
    await _safe_edit(query,
        f"\u2705 *Training Complete*\n\n"
        f"Phrase: _{_esc_md(phrase[:200])}_\n"
        f"Assigned to: *{intent_label}*\n\n"
        f"The system will now recognize similar questions.",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Training: assigned unmatched #{mid} to {intent_key}")


async def train_ignore_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ignore/dismiss an unmatched training question."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await query.answer("Access denied.", show_alert=True)
        return

    try:
        mid = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        mid = 0

    if mid:
        conn = get_db()
        c = conn.cursor()
        c.execute(
            "UPDATE w_bot_unmatched SET resolved = TRUE, resolved_by = %s WHERE id = %s",
            (user_id, mid),
        )
        conn.commit()
        conn.close()

    await _safe_edit(query, "\u274c Ignored — this question won't be used for training.")


async def train_list_unmatched_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List recent unresolved unmatched questions."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await query.answer("Access denied.", show_alert=True)
        return

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT id, user_message, created_at FROM w_bot_unmatched "
        "WHERE resolved IS NOT TRUE ORDER BY created_at DESC LIMIT 10"
    )
    rows = c.fetchall()
    conn.close()

    if not rows:
        await _safe_edit(query,
            "\u2705 *No unresolved questions!*\n\nAll training questions have been handled.",
            parse_mode='Markdown',
        )
        return

    text = f"\U0001f4cb *Unresolved Questions* ({len(rows)})\n\n"
    keyboard = []
    for mid, msg, created in rows:
        short = (msg[:60] + '...') if len(msg) > 60 else msg
        text += f"\u2022 _{_esc_md(short)}_\n"
        keyboard.append([InlineKeyboardButton(
            f"\U0001f3f7 Assign: {short[:30]}",
            callback_data=f'train_assign_{mid}'
        )])

    keyboard.append([InlineKeyboardButton("\U0001f3e0 Close", callback_data='back_to_menu')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


# ── Train Bot Menu (Founder/Admin) ─────────────────────────────────────

async def train_bot_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show training options: view unmatched, add response, manage intents."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM w_bot_unmatched WHERE resolved IS NOT TRUE")
    unmatched_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM w_bot_intents")
    intent_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM w_bot_intent_phrases WHERE approved = TRUE")
    phrase_count = c.fetchone()[0]
    conn.close()

    text = (
        "\U0001f9e0 *Bot Training Panel*\n\n"
        f"\U0001f4ca Intents: *{intent_count}*\n"
        f"\U0001f4ac Trained Phrases: *{phrase_count}*\n"
        f"\u2753 Unresolved Questions: *{unmatched_count}*\n\n"
        "Choose an action:"
    )
    keyboard = [
        [InlineKeyboardButton(f"\u2753 Unmatched ({unmatched_count})", callback_data='train_list_unmatched')],
        [InlineKeyboardButton("\u2795 Add Response to Intent", callback_data='train_add_response')],
        [InlineKeyboardButton("\U0001f4cb View All Intents", callback_data='train_view_intents')],
        [InlineKeyboardButton("\u2728 Create New Intent", callback_data='train_create_intent')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def train_view_intents_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """List all intents with phrase counts."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return

    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT i.id, i.name, "
        "(SELECT COUNT(*) FROM w_bot_intent_phrases p WHERE p.intent_id = i.id AND p.approved = TRUE), "
        "(SELECT COUNT(*) FROM w_bot_intent_responses r WHERE r.intent_id = i.id AND r.is_active = TRUE) "
        "FROM w_bot_intents i ORDER BY i.name"
    )
    intents = c.fetchall()
    conn.close()

    if not intents:
        await _safe_edit(query, "\u26a0\ufe0f No intents found.")
        return

    text = "\U0001f4cb *All Intents*\n\n"
    keyboard = []
    for iid, name, pcount, rcount in intents[:15]:
        label = name.replace('intent_', '').replace('_', ' ').title()
        text += f"\u2022 *{label}* — {pcount} phrases, {rcount} responses\n"
        keyboard.append([InlineKeyboardButton(
            f"\u270f {label}", callback_data=f'train_intent_detail_{iid}'
        )])
    keyboard.append([InlineKeyboardButton("\U0001f519 Back", callback_data='train_bot_menu')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def train_intent_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show detail for one intent — phrases and response counts per part."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return

    try:
        intent_id = int(query.data.split('_')[3])
    except (IndexError, ValueError):
        return

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        await _safe_edit(query, "\u26a0\ufe0f Intent not found.")
        return
    intent_name = row[0]
    label = intent_name.replace('intent_', '').replace('_', ' ').title()

    c.execute("SELECT COUNT(*) FROM w_bot_intent_phrases WHERE intent_id = %s AND approved = TRUE", (intent_id,))
    phrase_count = c.fetchone()[0]
    part_counts = {}
    for part in ('intro', 'body', 'outro'):
        c.execute("SELECT COUNT(*) FROM w_bot_intent_responses WHERE intent_id = %s AND part = %s AND is_active = TRUE", (intent_id, part))
        part_counts[part] = c.fetchone()[0]
    conn.close()

    text = (
        f"\U0001f4cb *{label}*\n\n"
        f"Phrases: *{phrase_count}*\n"
        f"Intros: *{part_counts['intro']}* / Bodies: *{part_counts['body']}* / Outros: *{part_counts['outro']}*\n\n"
        "Add a new response variant:"
    )
    keyboard = [
        [InlineKeyboardButton("\U0001f44b Add Intro", callback_data=f'train_resp_intro_{intent_id}')],
        [InlineKeyboardButton("\U0001f4dd Add Body", callback_data=f'train_resp_body_{intent_id}')],
        [InlineKeyboardButton("\U0001f44b Add Outro", callback_data=f'train_resp_outro_{intent_id}')],
        [InlineKeyboardButton("\U0001f4ac Add Training Phrase", callback_data=f'train_add_phrase_{intent_id}')],
        [InlineKeyboardButton("\U0001f5d1 Delete Intent", callback_data=f'train_delete_intent_{intent_id}')],
        [InlineKeyboardButton("\U0001f519 Back", callback_data='train_view_intents')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def train_add_response_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt to pick an intent to add a response to."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, name FROM w_bot_intents ORDER BY name")
    intents = c.fetchall()
    conn.close()

    if not intents:
        await _safe_edit(query, "\u26a0\ufe0f No intents found.")
        return

    keyboard = []
    for iid, name in intents[:20]:
        label = name.replace('intent_', '').replace('_', ' ').title()
        keyboard.append([InlineKeyboardButton(f"\U0001f3f7 {label}", callback_data=f'train_intent_detail_{iid}')])
    keyboard.append([InlineKeyboardButton("\U0001f519 Back", callback_data='train_bot_menu')])
    await _safe_edit(query, "\U0001f4cb *Select Intent to Add Response*\n\nPick an intent:", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def train_resp_part_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Start collecting a new response text for an intent part (intro/body/outro)."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return

    try:
        parts = query.data.split('_')  # train_resp_{part}_{intent_id}
        part = parts[2]  # intro, body, or outro
        intent_id = int(parts[3])
    except (IndexError, ValueError):
        return

    context.user_data['train_intent_id'] = intent_id
    context.user_data['train_part'] = part
    context.user_data['awaiting_train_response'] = True

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    row = c.fetchone()
    conn.close()
    label = row[0].replace('intent_', '').replace('_', ' ').title() if row else f'Intent #{intent_id}'

    await _safe_edit(query,
        f"\u270f *Add {part.title()} Response*\n\n"
        f"Intent: *{label}*\n\n"
        f"Type your new *{part}* response text below.\n"
        f"Send /cancel to cancel.",
        parse_mode='Markdown',
    )


async def train_response_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive the typed response text and save it to the database.
    Handles: add response (intro/body/outro), create_intent, add_phrase."""
    if not context.user_data.get('awaiting_train_response'):
        return  # Not in training mode — let other handlers handle it

    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        context.user_data.pop('awaiting_train_response', None)
        return

    text = update.message.text.strip()
    if text.startswith('/'):
        context.user_data.pop('awaiting_train_response', None)
        context.user_data.pop('train_intent_id', None)
        context.user_data.pop('train_part', None)
        context.user_data.pop('train_action', None)
        await update.message.reply_text("\u274c Training cancelled.")
        raise ApplicationHandlerStop

    action = context.user_data.get('train_action', '')

    # ── Create Intent action ──
    if action == 'create_intent':
        context.user_data.pop('awaiting_train_response', None)
        context.user_data.pop('train_action', None)
        intent_name = text.lower().replace(' ', '_').strip()
        if len(intent_name) < 2:
            await update.message.reply_text("⚠️ Intent name must be at least 2 characters.")
            raise ApplicationHandlerStop
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT id FROM w_bot_intents WHERE name = %s", (intent_name,))
        if c.fetchone():
            conn.close()
            await update.message.reply_text(f"⚠️ Intent `{intent_name}` already exists.", parse_mode='Markdown')
            raise ApplicationHandlerStop
        c.execute("INSERT INTO w_bot_intents (name) VALUES (%s) RETURNING id", (intent_name,))
        new_id = c.fetchone()[0]
        conn.commit()
        conn.close()
        label = intent_name.replace('_', ' ').title()
        keyboard = [
            [InlineKeyboardButton(f"\U0001f4ac Add Phrase to {label}", callback_data=f'train_add_phrase_{new_id}')],
            [InlineKeyboardButton(f"\U0001f4dd Add Response to {label}", callback_data=f'train_intent_detail_{new_id}')],
            [InlineKeyboardButton("\U0001f9e0 Training Panel", callback_data='train_bot_menu')],
        ]
        await update.message.reply_text(
            f"✅ *Intent Created!*\n\nName: `{intent_name}`\nID: {new_id}",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown',
        )
        log_founder_action(user_id, f"Created intent via button: {intent_name} (id={new_id})")
        raise ApplicationHandlerStop

    # ── Add Phrase action ──
    if action == 'add_phrase':
        intent_id = context.user_data.get('train_intent_id')
        context.user_data.pop('awaiting_train_response', None)
        context.user_data.pop('train_action', None)
        context.user_data.pop('train_intent_id', None)
        if not intent_id:
            raise ApplicationHandlerStop
        phrase = text.lower().strip()
        conn = get_db()
        c = conn.cursor()
        c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            await update.message.reply_text("⚠️ Intent not found.")
            raise ApplicationHandlerStop
        intent_name = row[0]
        c.execute(
            "INSERT INTO w_bot_intent_phrases (intent_id, phrase, approved) "
            "VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
            (intent_id, phrase),
        )
        conn.commit()
        conn.close()
        label = intent_name.replace('intent_', '').replace('_', ' ').title()
        keyboard = [
            [InlineKeyboardButton(f"\U0001f4ac Add Another Phrase", callback_data=f'train_add_phrase_{intent_id}')],
            [InlineKeyboardButton(f"\u270f Intent Detail", callback_data=f'train_intent_detail_{intent_id}')],
            [InlineKeyboardButton("\U0001f9e0 Training Panel", callback_data='train_bot_menu')],
        ]
        await update.message.reply_text(
            f"✅ *Phrase Added!*\n\nIntent: *{label}*\nPhrase: _{_esc_md(phrase[:200])}_",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='Markdown',
        )
        log_founder_action(user_id, f"Added phrase to {intent_name}: {phrase[:100]}")
        raise ApplicationHandlerStop

    # ── Default: Add Response (intro/body/outro) ──
    intent_id = context.user_data.get('train_intent_id')
    part = context.user_data.get('train_part')

    if not intent_id or not part:
        context.user_data.pop('awaiting_train_response', None)
        return

    # Save to database
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text("\u26a0\ufe0f Intent not found.")
        context.user_data.pop('awaiting_train_response', None)
        raise ApplicationHandlerStop
    intent_name = row[0]

    c.execute(
        "INSERT INTO w_bot_intent_responses (intent_id, part, text, is_active) "
        "VALUES (%s, %s, %s, TRUE)",
        (intent_id, part, text),
    )
    conn.commit()
    conn.close()

    label = intent_name.replace('intent_', '').replace('_', ' ').title()
    context.user_data.pop('awaiting_train_response', None)
    context.user_data.pop('train_intent_id', None)
    context.user_data.pop('train_part', None)

    keyboard = [
        [InlineKeyboardButton(f"\u2795 Add Another to {label}", callback_data=f'train_intent_detail_{intent_id}')],
        [InlineKeyboardButton("\U0001f9e0 Training Panel", callback_data='train_bot_menu')],
        [InlineKeyboardButton("\U0001f3e0 Main Menu", callback_data='back_to_menu')],
    ]
    await update.message.reply_text(
        f"\u2705 *Response Added!*\n\n"
        f"Intent: *{label}*\n"
        f"Part: *{part.title()}*\n"
        f"Text: _{_esc_md(text[:200])}_",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Training: added {part} response to {intent_name}")
    raise ApplicationHandlerStop  # Prevent other text handlers from processing this


# ── Button-based Create Intent, Add Phrase, Delete Intent ──────────────

async def train_create_intent_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Button: start creating a new intent — ask user to type the name."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return
    context.user_data['awaiting_train_response'] = True
    context.user_data['train_action'] = 'create_intent'
    await _safe_edit(query,
        "✨ *Create New Intent*\n\n"
        "Type the intent name below (use underscores, e.g. `small_talk`).\n"
        "Send /cancel to cancel.",
        parse_mode='Markdown',
    )


async def train_add_phrase_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Button: add a training phrase to an intent — ask user to type it."""
    query = update.callback_query
    await query.answer()
    role = get_user_role(query.from_user.id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return
    try:
        intent_id = int(query.data.split('_')[3])
    except (IndexError, ValueError):
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        await _safe_edit(query, "⚠️ Intent not found.")
        return
    label = row[0].replace('intent_', '').replace('_', ' ').title()
    context.user_data['awaiting_train_response'] = True
    context.user_data['train_action'] = 'add_phrase'
    context.user_data['train_intent_id'] = intent_id
    await _safe_edit(query,
        f"📝 *Add Training Phrase*\n\n"
        f"Intent: *{label}*\n\n"
        f"Type the phrase this intent should match.\n"
        f"Send /cancel to cancel.",
        parse_mode='Markdown',
    )


async def train_delete_intent_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Button: delete an intent and all its phrases/responses."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        return
    try:
        intent_id = int(query.data.split('_')[3])
    except (IndexError, ValueError):
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT name FROM w_bot_intents WHERE id = %s", (intent_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        await _safe_edit(query, "⚠️ Intent not found.")
        return
    intent_name = row[0]
    label = intent_name.replace('intent_', '').replace('_', ' ').title()
    c.execute("DELETE FROM w_bot_intent_phrases WHERE intent_id = %s", (intent_id,))
    c.execute("DELETE FROM w_bot_intent_responses WHERE intent_id = %s", (intent_id,))
    c.execute("DELETE FROM w_bot_intents WHERE id = %s", (intent_id,))
    conn.commit()
    conn.close()
    keyboard = [
        [InlineKeyboardButton("\U0001f9e0 Training Panel", callback_data='train_bot_menu')],
        [InlineKeyboardButton("\U0001f3e0 Main Menu", callback_data='back_to_menu')],
    ]
    await _safe_edit(query,
        f"🗑 *Intent Deleted*\n\nRemoved *{label}* and all its phrases/replies.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Deleted intent via button: {intent_name} (id={intent_id})")


# ── Review Override Handlers ───────────────────────────────────────────

async def review_override_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Override a review decision from Telegram (approve or reject)."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await query.answer("Access denied.", show_alert=True)
        return

    try:
        parts = query.data.split('_')  # review_approve_{book_id} or review_reject_{book_id}
        action = parts[1]  # 'approve' or 'reject'
        book_id = int(parts[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "\u26a0\ufe0f Invalid review data.")
        return

    conn = get_db()
    c = conn.cursor()

    if action == 'approve':
        c.execute(
            "UPDATE content SET review_status = 'approved', reviewed_by = %s, "
            "last_reviewed_at = CURRENT_TIMESTAMP WHERE id = %s",
            (user_id, book_id),
        )
        c.execute(
            "UPDATE w_review_queue SET status = 'approved', reviewer_id = %s, "
            "reviewed_at = CURRENT_TIMESTAMP WHERE content_id = %s AND status = 'pending'",
            (user_id, book_id),
        )
        status_text = "\u2705 APPROVED"
    else:
        c.execute(
            "UPDATE content SET review_status = 'rejected', reviewed_by = %s, "
            "last_reviewed_at = CURRENT_TIMESTAMP WHERE id = %s",
            (user_id, book_id),
        )
        c.execute(
            "UPDATE w_review_queue SET status = 'rejected', reviewer_id = %s, "
            "reviewed_at = CURRENT_TIMESTAMP WHERE content_id = %s AND status = 'pending'",
            (user_id, book_id),
        )
        status_text = "\u274c REJECTED"

    # Get book title for confirmation
    c.execute("SELECT title FROM content WHERE id = %s", (book_id,))
    title_row = c.fetchone()
    title = title_row[0] if title_row else f'Book #{book_id}'

    conn.commit()
    conn.close()

    await _safe_edit(query,
        f"\U0001f4dd *Review Override*\n\n"
        f"Book: *{_esc_md(title)}*\n"
        f"Decision: {status_text}\n"
        f"By: User {user_id}",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Review override: {action} book #{book_id} ({title})")


# ── Section 3: Telegram Admin Intent Training Commands ─────────────────

async def cmd_create_intent(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/create_intent IntentName — Create a new bot intent."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("⛔ Admin/Founder only.")
        return
    if not context.args:
        await update.message.reply_text("Usage: `/create_intent IntentName`\nExample: `/create_intent Small_Talk`", parse_mode='Markdown')
        return
    intent_name = context.args[0].lower().strip()
    if not intent_name or len(intent_name) < 2:
        await update.message.reply_text("⚠️ Intent name must be at least 2 characters.")
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM w_bot_intents WHERE name = %s", (intent_name,))
    if c.fetchone():
        conn.close()
        await update.message.reply_text(f"⚠️ Intent `{intent_name}` already exists.", parse_mode='Markdown')
        return
    c.execute("INSERT INTO w_bot_intents (name) VALUES (%s) RETURNING id", (intent_name,))
    new_id = c.fetchone()[0]
    conn.commit()
    conn.close()
    label = intent_name.replace('_', ' ').title()
    await update.message.reply_text(
        f"✅ *Intent Created*\n\nName: `{intent_name}`\nID: {new_id}\n\n"
        f"Now add phrases with:\n`/add_phrase {intent_name} your phrase here`\n\n"
        f"And add a reply with:\n`/add_reply {intent_name} your reply here`",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Created intent: {intent_name} (id={new_id})")


async def cmd_add_phrase(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/add_phrase IntentName phrase text — Add a training phrase to an intent."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("⛔ Admin/Founder only.")
        return
    if len(context.args) < 2:
        await update.message.reply_text("Usage: `/add_phrase IntentName your phrase here`\nExample: `/add_phrase Small_Talk are you male`", parse_mode='Markdown')
        return
    intent_name = context.args[0].lower().strip()
    phrase = ' '.join(context.args[1:]).lower().strip()
    if not phrase:
        await update.message.reply_text("⚠️ Phrase cannot be empty.")
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM w_bot_intents WHERE name = %s", (intent_name,))
    row = c.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text(f"⚠️ Intent `{intent_name}` not found. Create it first with `/create_intent {intent_name}`", parse_mode='Markdown')
        return
    intent_id = row[0]
    c.execute(
        "INSERT INTO w_bot_intent_phrases (intent_id, phrase, approved) "
        "VALUES (%s, %s, TRUE) ON CONFLICT DO NOTHING",
        (intent_id, phrase),
    )
    conn.commit()
    conn.close()
    await update.message.reply_text(
        f"✅ *Phrase Added*\n\nIntent: `{intent_name}`\nPhrase: _{_esc_md(phrase)}_",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Added phrase to {intent_name}: {phrase[:100]}")


async def cmd_add_reply(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/add_reply IntentName reply text — Add a reply to an intent."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("⛔ Admin/Founder only.")
        return
    if len(context.args) < 2:
        await update.message.reply_text("Usage: `/add_reply IntentName your reply text here`\nExample: `/add_reply Small_Talk I'm WiamBot! I don't have a gender 🤖`", parse_mode='Markdown')
        return
    intent_name = context.args[0].lower().strip()
    reply_text = ' '.join(context.args[1:]).strip()
    if not reply_text:
        await update.message.reply_text("⚠️ Reply text cannot be empty.")
        return
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM w_bot_intents WHERE name = %s", (intent_name,))
    row = c.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text(f"⚠️ Intent `{intent_name}` not found.", parse_mode='Markdown')
        return
    intent_id = row[0]
    c.execute(
        "INSERT INTO w_bot_intent_responses (intent_id, part, text, is_active) "
        "VALUES (%s, 'body', %s, TRUE)",
        (intent_id, reply_text),
    )
    conn.commit()
    conn.close()
    await update.message.reply_text(
        f"✅ *Reply Added*\n\nIntent: `{intent_name}`\nReply: _{_esc_md(reply_text[:200])}_",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Added reply to {intent_name}: {reply_text[:100]}")


async def cmd_list_intents(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/list_intents — List all bot intents with phrase and reply counts."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("⛔ Admin/Founder only.")
        return
    conn = get_db()
    c = conn.cursor()
    c.execute(
        "SELECT i.id, i.name, "
        "(SELECT COUNT(*) FROM w_bot_intent_phrases p WHERE p.intent_id = i.id AND p.approved = TRUE), "
        "(SELECT COUNT(*) FROM w_bot_intent_responses r WHERE r.intent_id = i.id AND r.is_active = TRUE) "
        "FROM w_bot_intents i ORDER BY i.name"
    )
    intents = c.fetchall()
    conn.close()
    if not intents:
        await update.message.reply_text("📋 No intents found. Create one with `/create_intent IntentName`", parse_mode='Markdown')
        return
    text = f"🧠 *Bot Intents* ({len(intents)} total)\n\n"
    for iid, name, pcount, rcount in intents:
        label = name.replace('_', ' ').title()
        text += f"• `{name}` — {pcount} phrases, {rcount} replies\n"
    text += f"\n📝 Manage with:\n`/create_intent`, `/add_phrase`, `/add_reply`, `/delete_intent`"
    await update.message.reply_text(text, parse_mode='Markdown')


async def cmd_delete_intent(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/delete_intent IntentName — Delete an intent and all its phrases/replies."""
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_ADMIN, ROLE_FOUNDER]:
        await update.message.reply_text("⛔ Admin/Founder only.")
        return
    if not context.args:
        await update.message.reply_text("Usage: `/delete_intent IntentName`", parse_mode='Markdown')
        return
    intent_name = context.args[0].lower().strip()
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM w_bot_intents WHERE name = %s", (intent_name,))
    row = c.fetchone()
    if not row:
        conn.close()
        await update.message.reply_text(f"⚠️ Intent `{intent_name}` not found.", parse_mode='Markdown')
        return
    intent_id = row[0]
    c.execute("DELETE FROM w_bot_intent_phrases WHERE intent_id = %s", (intent_id,))
    c.execute("DELETE FROM w_bot_intent_responses WHERE intent_id = %s", (intent_id,))
    c.execute("DELETE FROM w_bot_intents WHERE id = %s", (intent_id,))
    conn.commit()
    conn.close()
    await update.message.reply_text(
        f"🗑 *Intent Deleted*\n\nRemoved `{intent_name}` and all its phrases/replies.",
        parse_mode='Markdown',
    )
    log_founder_action(user_id, f"Deleted intent: {intent_name} (id={intent_id})")


def init_db():
    """Initialize all database tables and run migrations."""
    from database import create_db
    create_db()
    ensure_creator_application_schema()
    ensure_creator_profile_schema()
    ensure_orders_schema()
    ensure_subscription_proofs_schema()
    ensure_payment_evidence_schema()
    ensure_commission_schema()
    ensure_platform_fee_schema()
    ensure_content_owner_schema()
    ensure_book_product_schema()
    ensure_creator_payment_schema()
    ensure_user_tracking_schema()
    ensure_genres_access_schema()
    ensure_subscription_schema()
    ensure_subscription_notification_columns()
    ensure_channel_posts_schema()
    ensure_access_notification_column()
    ensure_chapter_schema()
    ensure_deletion_schema()
    ensure_ratings_schema()
    ensure_comments_schema()
    ensure_follows_schema()
    ensure_reading_progress_schema()
    ensure_featured_schema()
    ensure_audio_schema()
    ensure_drafts_schema()
    ensure_feedback_schema()
    ensure_user_status_schema()
    expire_old_subscriptions()
    hide_books_for_expired_creators()
    expire_old_access()


def build_bot_app():
    """Build and return the Telegram bot Application with all handlers registered."""

    async def scheduled_expiry_check(context):
        """Lightweight periodic cleanup — subscription/rental models removed."""
        try:
            expire_old_access()
        except Exception:
            pass

    application = Application.builder().token(TOKEN).build()
    application.add_error_handler(error_handler)
    application.job_queue.run_repeating(scheduled_expiry_check, interval=3600, first=3600)
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("web", web_command))
    # Section 3: Admin intent training commands
    application.add_handler(CommandHandler("create_intent", cmd_create_intent))
    application.add_handler(CommandHandler("add_phrase", cmd_add_phrase))
    application.add_handler(CommandHandler("add_reply", cmd_add_reply))
    application.add_handler(CommandHandler("list_intents", cmd_list_intents))
    application.add_handler(CommandHandler("delete_intent", cmd_delete_intent))
    application.add_handler(CallbackQueryHandler(bot_help_callback, pattern='^bot_help$'))
    application.add_handler(MessageHandler(filters.ChatType.CHANNEL, channel_update_handler))
    application.add_handler(CallbackQueryHandler(global_ban_guard), group=-2)
    application.add_handler(CallbackQueryHandler(channel_callback_guard), group=-1)
    application.add_handler(CallbackQueryHandler(channel_post_list_callback, pattern='^channel_post_list$'))
    application.add_handler(CallbackQueryHandler(curated_feedback_list_callback, pattern='^curated_feedback$'))
    application.add_handler(CallbackQueryHandler(curated_book_comments_callback, pattern='^curated_book_'))
    application.add_handler(CallbackQueryHandler(post_feedback_callback, pattern='^postfeedback_'))
    application.add_handler(CallbackQueryHandler(channel_post_action_callback, pattern='^channel_post_'))
    application.add_handler(CallbackQueryHandler(carousel_nav_callback, pattern='^ch_nav_'))
    application.add_handler(CallbackQueryHandler(creator_carousel_nav_callback, pattern='^cr_nav_'))
    application.add_handler(CallbackQueryHandler(creator_books_list_callback, pattern='^cr_all_'))
    application.add_handler(CallbackQueryHandler(open_founder_dashboard_callback, pattern='^open_founder_dashboard$'))
    application.add_handler(CallbackQueryHandler(open_admin_panel_callback, pattern='^open_admin_panel$'))
    application.add_handler(CallbackQueryHandler(open_creator_dashboard_callback, pattern='^open_creator_dashboard$'))
    application.add_handler(CallbackQueryHandler(founder_genres_callback, pattern='^founder_genres$'))
    application.add_handler(CallbackQueryHandler(founder_delete_genre, pattern='^genre_delete_'))
    genre_add_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(founder_add_genre_start, pattern='^genre_add_start$')],
        states={GENRE_ADD_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, founder_add_genre_input)]},
        fallbacks=[CommandHandler('cancel', cancel_conversation)],
    )
    application.add_handler(genre_add_conv)
    application.add_handler(CallbackQueryHandler(manage_featured_callback, pattern='^manage_featured$'))
    application.add_handler(CallbackQueryHandler(feature_book_callback, pattern='^feature_'))
    application.add_handler(CallbackQueryHandler(unfeature_book_callback, pattern='^unfeature_'))
    application.add_handler(CallbackQueryHandler(chapters_list_callback, pattern='^chapters_'))
    application.add_handler(CallbackQueryHandler(read_chapter_callback, pattern='^read_ch_'))
    # Audio / Listen handlers
    application.add_handler(CallbackQueryHandler(listen_chapter_voice_callback, pattern='^lvoice_'))
    application.add_handler(CallbackQueryHandler(listen_book_voice_callback, pattern='^lbvoice_'))
    application.add_handler(CallbackQueryHandler(listen_chapter_lang_callback, pattern='^llang_'))
    application.add_handler(CallbackQueryHandler(listen_book_lang_callback, pattern='^lblang_'))
    application.add_handler(CallbackQueryHandler(listen_chapter_callback, pattern='^lch_'))
    application.add_handler(CallbackQueryHandler(listen_book_callback, pattern='^lbook_'))
    application.add_handler(CallbackQueryHandler(book_detail_callback, pattern='^book_'))
    application.add_handler(CallbackQueryHandler(back_to_menu_callback, pattern='^back_to_menu$'))
    application.add_handler(CallbackQueryHandler(my_drafts_callback, pattern='^my_drafts$'))
    application.add_handler(CallbackQueryHandler(delete_draft_callback, pattern=r'^delete_draft_\d+$'))
    # Feedback ConversationHandler
    feedback_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(feedback_start_callback, pattern='^send_feedback$')],
        states={
            FEEDBACK_CATEGORY: [CallbackQueryHandler(feedback_category_callback, pattern='^fb_cat_')],
            FEEDBACK_MESSAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, feedback_message_input)],
            FEEDBACK_SCREENSHOT: [
                MessageHandler(filters.PHOTO, feedback_screenshot_input),
                CallbackQueryHandler(feedback_skip_screenshot_callback, pattern='^fb_skip_screenshot$'),
            ],
        },
        fallbacks=[
            CallbackQueryHandler(feedback_cancel_callback, pattern='^fb_cancel$'),
            CommandHandler('cancel', cancel_conversation),
        ],
    )
    application.add_handler(feedback_conv)
    # Founder feedback UI handlers
    application.add_handler(CallbackQueryHandler(founder_feedback_list_callback, pattern='^founder_feedback$'))
    application.add_handler(CallbackQueryHandler(founder_feedback_toggle_callback, pattern='^fb_toggle_'))
    application.add_handler(CallbackQueryHandler(founder_feedback_view_callback, pattern=r'^fb_view_\d+$'))
    application.add_handler(CallbackQueryHandler(founder_feedback_screenshot_callback, pattern=r'^fb_screenshot_\d+$'))
    application.add_handler(CallbackQueryHandler(founder_feedback_resolve_callback, pattern=r'^fb_resolve_\d+$'))
    application.add_handler(CallbackQueryHandler(founder_panic_lock_callback, pattern='^founder_panic_toggle$'))
    application.add_handler(CallbackQueryHandler(preview_callback, pattern='^preview_'))
    application.add_handler(CallbackQueryHandler(read_orig_callback, pattern='^read_orig_'))
    application.add_handler(CallbackQueryHandler(read_trans_callback, pattern='^read_trans_'))
    application.add_handler(CallbackQueryHandler(read_translang_callback, pattern='^rtlang_'))
    application.add_handler(CallbackQueryHandler(read_book_callback, pattern='^read_book_'))
    application.add_handler(CommandHandler("admin", admin))
    application.add_handler(CommandHandler("apply_creator", apply_creator))
    application.add_handler(CommandHandler("creator", creator_dashboard))
    upload_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(upload_start, pattern='^admin_upload_'),
            CallbackQueryHandler(upload_start, pattern='^creator_upload'),
            CallbackQueryHandler(upload_resume_draft_callback, pattern=r'^resume_draft_\d+$'),
        ],
        states={
            UPLOAD_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_title)],
            UPLOAD_AUTHOR: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_author)],
            UPLOAD_DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_description)],
            UPLOAD_GENRE: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_genre)],
            UPLOAD_COVER: [MessageHandler(filters.PHOTO, upload_cover)],
            UPLOAD_PDF: [MessageHandler(filters.Document.ALL, upload_pdf)],
            UPLOAD_LANGUAGE: [CallbackQueryHandler(upload_language, pattern='^uplang_')],
            UPLOAD_ALLOW_TRANSLATION: [CallbackQueryHandler(upload_allow_translation, pattern='^allow_trans_')],
            UPLOAD_CHAPTERS_CHOICE: [
                CallbackQueryHandler(upload_chapters_choice, pattern='^chapters_(yes|no)$'),
            ],
            UPLOAD_CHAPTER_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_chapter_title)],
            UPLOAD_CHAPTER_PAGES: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_chapter_pages)],
            UPLOAD_CHAPTER_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, upload_chapter_price)],
            UPLOAD_CONFIRM_CANCEL: [
                CallbackQueryHandler(upload_save_draft_callback, pattern='^upload_save_draft$'),
                CallbackQueryHandler(upload_stop_completely_callback, pattern='^upload_stop_completely$'),
                CallbackQueryHandler(upload_resume_callback, pattern='^upload_resume$'),
            ],
        },
        fallbacks=[
            CommandHandler('cancel', cancel_conversation),
            CallbackQueryHandler(cancel_upload_callback, pattern='^cancel_upload$'),
            CallbackQueryHandler(upload_back_callback, pattern='^upload_back$'),
        ],
    )
    application.add_handler(upload_conv)

    admin_mgmt_conv = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(add_admin_start, pattern='^admin_mgmt_add$'),
            CallbackQueryHandler(remove_admin_start, pattern='^admin_mgmt_remove$'),
        ],
        states={
            ADMIN_ADD_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, add_admin_id)],
            ADMIN_REMOVE_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, remove_admin_id)],
        },
        fallbacks=[CommandHandler('cancel', cancel_conversation)],
    )
    application.add_handler(admin_mgmt_conv)
    application.add_handler(CallbackQueryHandler(approve_callback, pattern='^admin_approve$'))
    application.add_handler(CallbackQueryHandler(approve_item, pattern='^(approve|reject)_'))
    application.add_handler(CallbackQueryHandler(approve_creators_callback, pattern='^admin_approve_creators$'))
    application.add_handler(CallbackQueryHandler(creator_action, pattern='^creator_(approve|payreq|reject)_'))
    application.add_handler(CommandHandler("favorites", favorites))
    application.add_handler(CallbackQueryHandler(save_fav, pattern='^save_fav_'))
    application.add_handler(CallbackQueryHandler(rate_book_callback, pattern='^rate_'))
    application.add_handler(CallbackQueryHandler(set_rate_callback, pattern='^setrate_'))
    application.add_handler(CallbackQueryHandler(follow_creator_callback, pattern='^follow_'))
    application.add_handler(CallbackQueryHandler(view_creator_profile_callback, pattern='^creator_pub_'))
    application.add_handler(CallbackQueryHandler(update_progress_callback, pattern='^progress_'))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, progress_page_input), group=9)
    application.add_handler(CallbackQueryHandler(view_comments_callback, pattern='^comments_'))
    application.add_handler(CallbackQueryHandler(add_comment_callback, pattern='^addcomment_'))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, comment_text_input), group=8)
    application.add_handler(CallbackQueryHandler(dash_admins_callback, pattern='^dash_admins$'))
    application.add_handler(CallbackQueryHandler(list_admins, pattern='^admin_mgmt_list$'))
    application.add_handler(CallbackQueryHandler(dash_creators_callback, pattern='^dash_creators$'))
    application.add_handler(CallbackQueryHandler(dash_users_callback, pattern='^dash_users$'))
    application.add_handler(CallbackQueryHandler(users_browse_callback, pattern='^users_(browse|recent|paying)_'))
    application.add_handler(CallbackQueryHandler(user_detail_callback, pattern='^user_detail_'))
    application.add_handler(CallbackQueryHandler(user_favs_callback, pattern='^user_favs_'))
    application.add_handler(CallbackQueryHandler(user_lib_callback, pattern='^user_lib_'))
    application.add_handler(CallbackQueryHandler(user_orders_callback, pattern='^user_orders_'))
    application.add_handler(CallbackQueryHandler(user_ban_callback, pattern='^user_ban_'))
    application.add_handler(CallbackQueryHandler(user_unban_callback, pattern='^user_unban_'))
    application.add_handler(CallbackQueryHandler(user_block_callback, pattern='^user_block_'))
    application.add_handler(CallbackQueryHandler(user_unblock_callback, pattern='^user_unblock_'))
    application.add_handler(CallbackQueryHandler(creator_detail_callback, pattern='^cr_detail_'))
    application.add_handler(CallbackQueryHandler(cr_ban_callback, pattern='^cr_ban_'))
    application.add_handler(CallbackQueryHandler(cr_unban_callback, pattern='^cr_unban_'))
    application.add_handler(CallbackQueryHandler(cr_block_callback, pattern='^cr_block_'))
    application.add_handler(CallbackQueryHandler(cr_unblock_callback, pattern='^cr_unblock_'))
    application.add_handler(CallbackQueryHandler(dash_creator_callback, pattern='^dash_creator$'))
    application.add_handler(CallbackQueryHandler(creator_my_content_callback, pattern='^creator_my_content$'))
    application.add_handler(CallbackQueryHandler(creator_profile_callback, pattern='^creator_profile$'))
    application.add_handler(CallbackQueryHandler(creator_edit_profile_callback, pattern='^cr_edit_'))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, creator_profile_edit_input), group=5)
    application.add_handler(MessageHandler(filters.PHOTO, creator_profile_edit_input), group=5)
    application.add_handler(CallbackQueryHandler(creator_my_stats_callback, pattern='^creator_my_stats$'))
    application.add_handler(CallbackQueryHandler(creator_content_item_callback, pattern='^creator_content_'))
    application.add_handler(CallbackQueryHandler(toggle_comments_callback, pattern='^toggle_comments_'))
    application.add_handler(CallbackQueryHandler(replace_pdf_callback, pattern='^replace_pdf_'))
    application.add_handler(CallbackQueryHandler(replace_cover_callback, pattern='^replace_cover_'))
    application.add_handler(MessageHandler(filters.Document.PDF, replace_pdf_input), group=10)
    application.add_handler(MessageHandler(filters.PHOTO, replace_cover_input), group=11)
    # Creator application conversation handler
    apply_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(apply_creator_callback, pattern='^apply_creator$')],
        states={
            APPLY_PEN_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, apply_pen_name)],
            APPLY_BIO: [MessageHandler(filters.TEXT & ~filters.COMMAND, apply_bio)],
            APPLY_COUNTRY: [MessageHandler(filters.TEXT & ~filters.COMMAND, apply_country)],
            APPLY_PROFILE_PIC: [
                MessageHandler(filters.PHOTO, apply_profile_pic),
                CommandHandler('skip', apply_skip_pic),
            ],
            APPLY_CONFIRM: [CallbackQueryHandler(apply_confirm_callback, pattern='^apply_')],
        },
        fallbacks=[CommandHandler('cancel', cancel_conversation)],
        allow_reentry=True,
    )
    application.add_handler(apply_conv)
    application.add_handler(CallbackQueryHandler(apply_status_callback, pattern='^apply_status$'))
    application.add_handler(CallbackQueryHandler(list_creators_callback, pattern='^list_creators$'))
    application.add_handler(CallbackQueryHandler(creator_apps_callback, pattern='^creator_apps$'))
    application.add_handler(CallbackQueryHandler(noop_callback, pattern='^noop$'))
    # Deletion handlers
    application.add_handler(CallbackQueryHandler(del_book_confirm, pattern='^del_book_'))
    application.add_handler(CallbackQueryHandler(del_book_execute, pattern='^del_confirm_'))
    application.add_handler(CallbackQueryHandler(creator_deleted_books_callback, pattern='^creator_deleted_books$'))
    application.add_handler(CallbackQueryHandler(restore_book_callback, pattern='^restore_book_'))
    application.add_handler(CallbackQueryHandler(permdel_book_confirm, pattern='^permdel_book_'))
    application.add_handler(CallbackQueryHandler(permdel_book_execute, pattern='^permdelyes_'))
    application.add_handler(CallbackQueryHandler(admin_manage_books_callback, pattern='^admin_manage_books$'))
    application.add_handler(CallbackQueryHandler(founder_del_book_confirm, pattern='^fdel_book_'))
    application.add_handler(CallbackQueryHandler(founder_soft_del_execute, pattern='^fsdel_'))
    application.add_handler(CallbackQueryHandler(founder_perm_del_execute, pattern='^fpdel_'))
    application.add_handler(CallbackQueryHandler(remove_fav, pattern='^rm_fav_'))
    # Training Queue handlers (for Telegram training chat)
    application.add_handler(CallbackQueryHandler(train_assign_callback, pattern='^train_assign_'))
    application.add_handler(CallbackQueryHandler(train_set_intent_callback, pattern='^train_set_'))
    application.add_handler(CallbackQueryHandler(train_ignore_callback, pattern='^train_ignore_'))
    application.add_handler(CallbackQueryHandler(train_list_unmatched_callback, pattern='^train_list_unmatched$'))
    # Train Bot menu + dynamic training handlers
    application.add_handler(CallbackQueryHandler(train_bot_menu_callback, pattern='^train_bot_menu$'))
    application.add_handler(CallbackQueryHandler(train_view_intents_callback, pattern='^train_view_intents$'))
    application.add_handler(CallbackQueryHandler(train_intent_detail_callback, pattern='^train_intent_detail_'))
    application.add_handler(CallbackQueryHandler(train_add_response_callback, pattern='^train_add_response$'))
    application.add_handler(CallbackQueryHandler(train_create_intent_callback, pattern='^train_create_intent$'))
    application.add_handler(CallbackQueryHandler(train_add_phrase_callback, pattern='^train_add_phrase_'))
    application.add_handler(CallbackQueryHandler(train_delete_intent_callback, pattern='^train_delete_intent_'))
    application.add_handler(CallbackQueryHandler(train_resp_part_callback, pattern='^train_resp_(intro|body|outro)_'))
    # Training text input handler (must be BEFORE other text handlers, use group=1)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, train_response_text_handler), group=1)

    # General chat handler using real AI (must be AFTER all other handlers)
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat_message_handler), group=99)

    # Review override handlers (for Telegram notification chat)
    application.add_handler(CallbackQueryHandler(review_override_callback, pattern='^review_(approve|reject)_'))
    return application

async def chat_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle general chat messages using real AI service."""
    from webapp.services.ai_service import chat_completion, check_user_limit, increment_user_limit
    
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    
    # Check user daily limit
    if not check_user_limit(user_id, 'chat'):
        await update.message.reply_text("⚠️ You've reached your daily AI chat limit (100 messages). Try again tomorrow!")
        return
    
    # Get user message
    user_message = update.message.text.strip()
    if not user_message:
        return
    
    # System prompt for WiamBot
    system_prompt = """You are WiamBot, a helpful AI assistant for WiamApp users.
    
    Rules:
    - Be helpful, friendly, and concise
    - Keep responses under 200 words
    - Don't reveal you're an AI
    - Help with WiamApp features when asked
    - If you don't know, say so politely
    - Never share personal data about users"""
    
    try:
        # Get AI response
        ai_response = chat_completion(system_prompt, user_message)
        
        if ai_response:
            # Increment user limit
            increment_user_limit(user_id, 'chat')
            
            # Send response
            await update.message.reply_text(ai_response)
        else:
            await update.message.reply_text("🤖 Sorry, I'm having trouble thinking right now. Please try again later.")

    except Exception as e:
        logger.error(f"Chat handler error: {e}")
        await update.message.reply_text("💭 Something went wrong. Please try again.")


def main():
    init_db()
    application = build_bot_app()
    application.run_polling()


if __name__ == "__main__":
    main()
