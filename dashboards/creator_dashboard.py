import os
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram import Update
from telegram.ext import ContextTypes

from core.db import get_db_connection

WEB_BASE = os.environ.get('APP_URL', 'https://wiamapp.fly.dev').rstrip('/')

# All global text-input flags — mirrors the list in bot.py.
_TEXT_INPUT_FLAGS = [
    'editing_payment', 'editing_prices_for', 'awaiting_search',
    'awaiting_commission_rate', 'awaiting_sub_price_edit',
    'awaiting_pf_rate', 'awaiting_pf_cycle',
    'cr_editing_profile', 'awaiting_comment', 'awaiting_page_progress',
    'awaiting_replace_pdf', 'awaiting_replace_cover', 'awaiting_sub_proof',
    'adding_genre',
]

def _clear_text_input_flags(context, keep=None):
    for flag in _TEXT_INPUT_FLAGS:
        if flag != keep:
            context.user_data.pop(flag, None)

async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)

from core.role_manager import ROLE_CREATOR, ROLE_FOUNDER, get_user_role
from creators.subscription_service import has_active_subscription
from creators.content_service import (
    get_creator_book_detail,
    get_creator_content_item,
    get_creator_payment_details,
    get_creator_stats,
    list_creator_content,
    set_creator_payment_details,
    update_book_prices,
)
from content.deletion_service import (
    soft_delete_book,
    restore_book,
    permanent_delete_book,
    list_deleted_books,
)


async def show_creator_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    # Get current plan info for display
    from creators.subscription_service import get_creator_tier, get_tier_info, CURRENCY
    tier = get_creator_tier(user_id)
    tier_info = get_tier_info(tier) if tier != 'none' else None
    tier_label = f"{tier_info['emoji']} {tier_info['name']}" if tier_info else "\u26a0\ufe0f No Plan"

    # Check platform fee status for display
    from payments.platform_fee_service import check_platform_fee_status
    fee_status = check_platform_fee_status(user_id)
    fee_label = "\U0001f4b0 Platform Fee"
    if fee_status.get('is_overdue'):
        fee_label = "\u26a0\ufe0f Platform Fee (OVERDUE)"
    elif fee_status.get('pending_fee') and fee_status['pending_fee'].get('status') == 'proof_submitted':
        fee_label = "\u23f3 Platform Fee (Under Review)"

    keyboard = [
        [InlineKeyboardButton(f"\U0001f4cb My Plan ({tier_label})", callback_data='creator_my_plan')],
        [InlineKeyboardButton("\U0001f464 My Profile", callback_data='creator_profile')],
        [InlineKeyboardButton("\U0001f4e4 Upload Book", callback_data='creator_upload')],
        [InlineKeyboardButton("\U0001f4da My Books", callback_data='creator_my_content')],
        [InlineKeyboardButton("\U0001f4ca My Stats", callback_data='creator_my_stats')],
        [InlineKeyboardButton("\U0001f4b3 Payment Details", callback_data='creator_payment_details')],
        [InlineKeyboardButton("\U0001f4e8 My Orders", callback_data='creator_my_orders')],
        [InlineKeyboardButton(fee_label, callback_data='creator_platform_fee')],
        [InlineKeyboardButton("\U0001f4c2 My Drafts", callback_data='my_drafts')],
        [InlineKeyboardButton("\u270d\ufe0f Write on Web", url=f"{WEB_BASE}/creator/studio"),
         InlineKeyboardButton("\U0001f4ca Web Dashboard", url=f"{WEB_BASE}/creator/dashboard")],
    ]
    if role == ROLE_CREATOR:
        keyboard.append([InlineKeyboardButton("\u274c Cancel Subscription", callback_data='cancel_sub_warn')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    reply_markup = InlineKeyboardMarkup(keyboard)
    await _safe_edit(query, f"\u270d\ufe0f *Creator Dashboard*\n\nPlan: {tier_label}", reply_markup=reply_markup, parse_mode='Markdown')


def _sub_expired_msg():
    return (
        "\u26a0\ufe0f Your subscription has expired.\n\n"
        "Renew your subscription to access creator features."
    )

def _sub_expired_kb():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("\U0001f504 Renew Subscription", callback_data='renew_subscription')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ])


async def creator_my_plan_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the creator's current subscription plan details."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return

    from creators.subscription_service import (
        get_active_subscription, get_creator_tier, get_tier_info,
        get_creator_book_count, get_max_books, TIERS, CURRENCY,
    )
    sub = get_active_subscription(user_id)
    tier = get_creator_tier(user_id)
    info = get_tier_info(tier) if tier != 'none' else None

    if not sub or not info:
        await _safe_edit(query, 
            "\u26a0\ufe0f *No Active Plan*\n\n"
            "Subscribe to start publishing books!",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f451 View Plans", callback_data='renew_subscription')],
                [InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')],
            ]),
            parse_mode='Markdown',
        )
        return

    end_date = str(sub[3])[:10]
    plan_key = sub[1] or ''
    cycle = 'Yearly' if 'yearly' in plan_key else 'Monthly'
    book_count = get_creator_book_count(user_id)
    max_b = get_max_books(user_id)
    max_label = 'Unlimited' if max_b > 1000 else str(max_b)
    yes = '\u2705'
    no = '\u274c'

    text = (
        f"{info['emoji']} *Your Plan: {info['name']}*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4c5 Billing: *{cycle}*\n"
        f"\U0001f4c6 Expires: *{end_date}*\n\n"
        f"\U0001f4da Books: *{book_count} / {max_label}*\n"
        f"\U0001f4d1 Chapters: {yes if info['chapters'] else no}\n"
        f"\U0001f3a7 Audio (TTS): {yes if info['audio'] else no}\n"
        f"\U0001f30d Translation: {yes if info['translation'] else no}\n\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
    )
    keyboard = [
        [InlineKeyboardButton("\u2b06 Upgrade Plan", callback_data='renew_subscription')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def creator_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the creator's profile with edit options."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    from creators.profile_service import get_creator_profile
    profile = get_creator_profile(user_id)
    if not profile:
        await _safe_edit(query, 
            "\U0001f464 *My Profile*\n\nNo profile set up yet.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]),
            parse_mode='Markdown',
        )
        return
    has_pic = bool(profile.get('profile_pic_file_id'))
    text = (
        "\U0001f464 *My Creator Profile*\n"
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\u270d\ufe0f *Pen Name:* {profile['pen_name']}\n\n"
        f"\U0001f4dd *Bio:* {profile['bio']}\n\n"
        f"\U0001f4f7 *Photo:* {'Set \u2705' if has_pic else 'Not set'}\n"
    )
    keyboard = [
        [InlineKeyboardButton("\u270f\ufe0f Edit Name", callback_data='cr_edit_name')],
        [InlineKeyboardButton("\u270f\ufe0f Edit Bio", callback_data='cr_edit_bio')],
        [InlineKeyboardButton("\u270f\ufe0f Change Photo", callback_data='cr_edit_photo')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')],
    ]
    if has_pic:
        try:
            await query.message.delete()
            await query.message.chat.send_photo(
                photo=profile['profile_pic_file_id'],
                caption=text,
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def creator_edit_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle edit name/bio/photo buttons — prompt user to send new value."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return
    _clear_text_input_flags(context, keep='cr_editing_profile')
    field = query.data.replace('cr_edit_', '')
    if field == 'name':
        context.user_data['cr_editing_profile'] = 'pen_name'
        prompt = "\u270d\ufe0f Type your new author / pen name:"
    elif field == 'bio':
        context.user_data['cr_editing_profile'] = 'bio'
        prompt = "\U0001f4dd Type your new bio (max 300 chars):"
    elif field == 'photo':
        context.user_data['cr_editing_profile'] = 'profile_pic_file_id'
        prompt = "\U0001f4f7 Send your new profile photo:"
    else:
        return
    try:
        await _safe_edit(query, prompt)
    except Exception:
        try:
            await query.edit_message_caption(caption=prompt)
        except Exception:
            await query.message.reply_text(prompt)


async def creator_profile_edit_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text/photo input for profile editing."""
    field = context.user_data.get('cr_editing_profile')
    if not field:
        return
    user_id = update.effective_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return
    from creators.profile_service import update_creator_field
    back_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("\U0001f464 Back to Profile", callback_data='creator_profile')],
        [InlineKeyboardButton("\u25c0 Back to Dashboard", callback_data='open_creator_dashboard')],
    ])
    if field == 'profile_pic_file_id':
        if not update.message.photo:
            await update.message.reply_text("\u26a0\ufe0f Please send a photo.")
            return
        value = update.message.photo[-1].file_id
        update_creator_field(user_id, field, value)
        context.user_data.pop('cr_editing_profile', None)
        await update.message.reply_text("\u2705 Profile photo updated!", reply_markup=back_kb)
        return
    value = update.message.text.strip()
    if field == 'pen_name':
        if len(value) < 2 or len(value) > 60:
            await update.message.reply_text("\u26a0\ufe0f Name must be 2-60 characters. Try again:")
            return
    elif field == 'bio':
        if len(value) < 10 or len(value) > 300:
            await update.message.reply_text(f"\u26a0\ufe0f Bio must be 10-300 characters ({len(value)} given). Try again:")
            return
    update_creator_field(user_id, field, value)
    context.user_data.pop('cr_editing_profile', None)
    label = 'Pen name' if field == 'pen_name' else 'Bio'
    await update.message.reply_text(f"\u2705 {label} updated to: *{value}*", reply_markup=back_kb, parse_mode='Markdown')


def _check_creator_access(user_id, role):
    """Returns True if access allowed, False if blocked."""
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return False
    if role == ROLE_FOUNDER:
        return True
    return has_active_subscription(user_id)


async def creator_my_content_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    rows = list_creator_content(user_id, limit=20)
    if not rows:
        await _safe_edit(query, "📚 My Books\n\nYou haven't uploaded any books yet.", reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📤 Upload Book", callback_data='creator_upload')],
            [InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')],
        ]))
        return
    keyboard = []
    for content_id, title, type_, status, views, price in rows:
        label = f"📖 {title}"
        if status == 'pending':
            label += " ⏳"
        elif status == 'rejected':
            label += " ❌"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'creator_content_{content_id}')])
    keyboard.append([InlineKeyboardButton("\U0001f4c2 Deleted Books", callback_data='creator_deleted_books')])
    keyboard.append([InlineKeyboardButton("🏠 Back to Menu", callback_data='back_to_menu')])
    await _safe_edit(query, "📚 My Books:", reply_markup=InlineKeyboardMarkup(keyboard))


def _fmt(val):
    if val is None:
        return "—"
    return f"GH\u20b5 {val:,.0f}"


async def creator_content_item_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    try:
        content_id = int(query.data.split('_', 2)[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid item.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_my_content')]]))
        return
    item = get_creator_book_detail(user_id, content_id)
    if not item:
        await _safe_edit(query, "Not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_my_content')]]))
        return
    (cid, title, author, status, views,
     p_buy, p1, p2, p3, p4, p5, p30) = item
    text = (
        f"\U0001f4d6 *{title}*\n"
        f"\u270d Author: {author or '—'}\n"
        f"\U0001f4cb Status: {status}\n"
        f"\U0001f441 Views: {views}\n\n"
        f"\U0001f4b0 *Prices:*\n"
        f"  Buy Now: {_fmt(p_buy)}\n"
        f"  1 day: {_fmt(p1)}\n"
        f"  2 days: {_fmt(p2)}\n"
        f"  3 days: {_fmt(p3)}\n"
        f"  4 days: {_fmt(p4)}\n"
        f"  5 days: {_fmt(p5)}\n"
        f"  30 days: {_fmt(p30)}"
    )
    # Check if comments are disabled
    from content.comments import are_comments_disabled
    comments_off = are_comments_disabled(content_id)
    comments_label = "\u2705 Comments: ON" if not comments_off else "\u274c Comments: OFF"
    keyboard = [
        [InlineKeyboardButton("\U0001f4dd Edit Prices", callback_data=f'edit_prices_{content_id}')],
        [InlineKeyboardButton("\U0001f4c4 Replace PDF", callback_data=f'replace_pdf_{content_id}'),
         InlineKeyboardButton("\U0001f5bc Replace Cover", callback_data=f'replace_cover_{content_id}')],
        [InlineKeyboardButton(comments_label, callback_data=f'toggle_comments_{content_id}')],
        [InlineKeyboardButton("\U0001f5d1 Delete Book", callback_data=f'del_book_{content_id}')],
        [InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def toggle_comments_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Creator toggles comments ON/OFF for their book."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return
    item = get_creator_book_detail(user_id, content_id)
    if not item:
        return
    from content.comments import are_comments_disabled, toggle_comments
    current = are_comments_disabled(content_id)
    toggle_comments(content_id, not current)
    new_state = "OFF" if not current else "ON"
    await _safe_edit(query, 
        f"\U0001f4ac Comments are now *{new_state}* for *{item[1]}*.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'creator_content_{content_id}')],
        ]),
    )


async def replace_pdf_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt creator to send new PDF. Book goes back to pending review."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return
    item = get_creator_book_detail(user_id, content_id)
    if not item:
        return
    _clear_text_input_flags(context, keep='awaiting_replace_pdf')
    context.user_data['awaiting_replace_pdf'] = content_id
    await _safe_edit(query, 
        f"\U0001f4c4 *Replace PDF for: {item[1]}*\n\n"
        "\u26a0\ufe0f Send the new PDF file now.\n"
        "The book will be set to *pending review* after replacement.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 Cancel", callback_data=f'creator_content_{content_id}')],
        ]),
    )


async def replace_cover_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Prompt creator to send new cover image."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return
    item = get_creator_book_detail(user_id, content_id)
    if not item:
        return
    _clear_text_input_flags(context, keep='awaiting_replace_cover')
    context.user_data['awaiting_replace_cover'] = content_id
    await _safe_edit(query, 
        f"\U0001f5bc *Replace Cover for: {item[1]}*\n\n"
        "Send the new cover image now.\n"
        "The book will be set to *pending review* after replacement.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 Cancel", callback_data=f'creator_content_{content_id}')],
        ]),
    )


async def replace_pdf_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle new PDF file upload for replacement."""
    content_id = context.user_data.get('awaiting_replace_pdf')
    if not content_id:
        return
    context.user_data.pop('awaiting_replace_pdf', None)

    doc = update.message.document
    if not doc or not doc.file_name.lower().endswith('.pdf'):
        await update.message.reply_text(
            "\u26a0\ufe0f Please send a valid PDF file.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'creator_content_{content_id}')],
            ]),
        )
        return

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET pdf_file_id=%s, status='pending' WHERE id=%s",
        (doc.file_id, content_id),
    )
    conn.commit()
    conn.close()

    await update.message.reply_text(
        "\u2705 PDF replaced! Book is now *pending review*.\n"
        "WiamApp Team will review and re-approve it.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')],
        ]),
    )


async def replace_cover_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle new cover image upload for replacement."""
    content_id = context.user_data.get('awaiting_replace_cover')
    if not content_id:
        return
    context.user_data.pop('awaiting_replace_cover', None)

    photo = update.message.photo
    if not photo:
        await update.message.reply_text(
            "\u26a0\ufe0f Please send an image.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'creator_content_{content_id}')],
            ]),
        )
        return

    file_id = photo[-1].file_id

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET cover_file_id=%s, status='pending' WHERE id=%s",
        (file_id, content_id),
    )
    conn.commit()
    conn.close()

    await update.message.reply_text(
        "\u2705 Cover replaced! Book is now *pending review*.\n"
        "WiamApp Team will review and re-approve it.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')],
        ]),
    )


async def edit_prices_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid item.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_my_content')]]))
        return
    item = get_creator_book_detail(user_id, content_id)
    if not item:
        await _safe_edit(query, "Not found or access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_my_content')]]))
        return
    _clear_text_input_flags(context, keep='editing_prices_for')
    context.user_data['editing_prices_for'] = content_id
    await _safe_edit(query, 
        "\U0001f4dd *Edit Prices*\n\n"
        "Send all 7 prices on one line, separated by spaces:\n"
        "`BuyNow 1day 2days 3days 4days 5days 30days`\n\n"
        "Example: `5000 500 900 1200 1500 1800 4000`\n"
        "Use `0` to disable a price tier.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='creator_my_content')]]),
    )


async def edit_prices_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    content_id = context.user_data.get('editing_prices_for')
    if not content_id:
        return
    user_id = update.effective_user.id
    text = update.message.text.strip()
    parts = text.split()
    if len(parts) != 7:
        await update.message.reply_text(
            "\u274c Please send exactly 7 numbers separated by spaces.\n"
            "Example: `5000 500 900 1200 1500 1800 4000`",
            parse_mode='Markdown',
        )
        return
    try:
        vals = [float(p) for p in parts]
    except ValueError:
        await update.message.reply_text("\u274c All values must be numbers.")
        return
    prices = {
        'buy_now': vals[0] if vals[0] > 0 else None,
        '1_day': vals[1] if vals[1] > 0 else None,
        '2_days': vals[2] if vals[2] > 0 else None,
        '3_days': vals[3] if vals[3] > 0 else None,
        '4_days': vals[4] if vals[4] > 0 else None,
        '5_days': vals[5] if vals[5] > 0 else None,
        '30_days': vals[6] if vals[6] > 0 else None,
    }
    update_book_prices(content_id, user_id, prices)
    context.user_data.pop('editing_prices_for', None)
    await update.message.reply_text(
        "\u2705 Prices updated successfully!",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to My Books", callback_data='creator_my_content')]]),
    )


async def creator_payment_details_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    details = get_creator_payment_details(user_id)
    momo = details.get('momo_number') or 'Not set'
    bank = details.get('bank_details') or 'Not set'
    text = (
        "\U0001f4b3 Your Payment Details\n\n"
        f"\U0001f4f1 MoMo: {momo}\n"
        f"\U0001f3e6 Bank: {bank}\n\n"
        "Customers will see these details when purchasing your books."
    )
    keyboard = [
        [InlineKeyboardButton("\U0001f4dd Edit Payment Details", callback_data='creator_edit_payment')],
        [InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')],
    ]
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard))


async def creator_edit_payment_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    _clear_text_input_flags(context, keep='editing_payment')
    context.user_data['editing_payment'] = True
    await _safe_edit(query, 
        "\U0001f4dd Edit Payment Details\n\n"
        "Send your details in this format (2 lines):\n\n"
        "Line 1: Your MoMo number\n"
        "Line 2: Your bank details\n\n"
        "Example:\n"
        "+233 551 234 567\n"
        "Bank: MTN MoMo, Name: John Doe",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Cancel", callback_data='creator_payment_details')]]),
    )


async def creator_edit_payment_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.get('editing_payment'):
        return
    user_id = update.effective_user.id
    text = update.message.text.strip()
    lines = text.split('\n', 1)
    momo = lines[0].strip()
    bank = lines[1].strip() if len(lines) > 1 else None
    set_creator_payment_details(user_id, momo_number=momo, bank_details=bank)
    context.user_data.pop('editing_payment', None)
    msg = f"\u2705 Payment details updated!\n\n\U0001f4f1 MoMo: {momo}"
    if bank:
        msg += f"\n\U0001f3e6 Bank: {bank}"
    await update.message.reply_text(
        msg,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_payment_details')]]),
    )


async def creator_my_stats_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if not _check_creator_access(user_id, role):
        await _safe_edit(query, _sub_expired_msg(), reply_markup=_sub_expired_kb())
        return
    total, views = get_creator_stats(user_id)
    from payments.commission_service import get_creator_earnings, is_commission_enabled, get_commission_rate
    earnings = get_creator_earnings(user_id)
    text = (
        f"\U0001f4ca *My Stats*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4da Total books: *{total}*\n"
        f"\U0001f441 Total views: *{views:,}*\n\n"
        f"\U0001f4b0 *Earnings*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        f"\U0001f6d2 Total sales: *{earnings['total_sales']}*\n"
        f"\U0001f4b5 Total revenue: *GH\u20b5 {earnings['total_revenue']:,.2f}*\n"
    )
    if is_commission_enabled():
        pct = int(get_commission_rate() * 100)
        text += (
            f"\U0001f4b0 Your earnings ({100-pct}%): *GH\u20b5 {earnings['creator_earnings']:,.2f}*\n"
            f"\U0001f3e2 Platform service fee ({pct}%): *GH\u20b5 {earnings['platform_fees']:,.2f}*"
        )
    else:
        text += (
            f"\U0001f4b0 Your earnings: *GH\u20b5 {earnings['total_revenue']:,.2f}*\n"
            f"\u2705 _No platform service fee applied._"
        )
    await _safe_edit(query, 
        text,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]),
        parse_mode='Markdown',
    )


# ── Deletion handlers ──────────────────────────────────────────────

async def del_book_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show soft-delete confirmation."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_my_content')]]))
        return
    item = get_creator_book_detail(user_id, content_id)
    title = item[1] if item else f"Book #{content_id}"
    keyboard = [
        [InlineKeyboardButton("\u2705 Yes, Delete", callback_data=f'del_confirm_{content_id}')],
        [InlineKeyboardButton("\u274c No, Cancel", callback_data=f'creator_content_{content_id}')],
    ]
    await _safe_edit(query, 
        f"\u26a0\ufe0f *Delete \"{title}\"?*\n\n"
        f"This will hide the book from the store.\n"
        f"You can recover it later from \U0001f4c2 Deleted Books.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def del_book_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Execute soft-delete."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    ok = soft_delete_book(content_id, creator_id=user_id)
    if ok:
        await _safe_edit(query, 
            "\U0001f5d1 Book deleted.\n\nYou can recover it from \U0001f4c2 Deleted Books.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')]]),
        )
    else:
        await _safe_edit(query, 
            "\u274c Could not delete this book.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')]]),
        )


async def creator_deleted_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show list of soft-deleted books for recovery or permanent deletion."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.")
        return
    rows = list_deleted_books(user_id)
    if not rows:
        await _safe_edit(query, 
            "\U0001f4c2 Deleted Books\n\nNo deleted books.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')]]),
        )
        return
    keyboard = []
    for cid, title, status, deleted_at in rows:
        date_str = str(deleted_at)[:10] if deleted_at else ""
        keyboard.append([InlineKeyboardButton(f"\U0001f4d6 {title} ({date_str})", callback_data=f'noop')])
        keyboard.append([
            InlineKeyboardButton("\u267b\ufe0f Recover", callback_data=f'restore_book_{cid}'),
            InlineKeyboardButton("\U0001f5d1 Perm. Delete", callback_data=f'permdel_book_{cid}'),
        ])
    keyboard.append([InlineKeyboardButton("\u25c0 My Books", callback_data='creator_my_content')])
    await _safe_edit(query, 
        "\U0001f4c2 *Deleted Books*\n\nRecover or permanently delete:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def restore_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Restore a soft-deleted book."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    ok = restore_book(content_id, creator_id=user_id)
    msg = "\u2705 Book restored! It is now visible again." if ok else "\u274c Could not restore this book."
    await _safe_edit(query, 
        msg,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Deleted Books", callback_data='creator_deleted_books')]]),
    )


async def permdel_book_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show permanent delete confirmation."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        content_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    item = get_creator_book_detail(user_id, content_id)
    title = item[1] if item else f"Book #{content_id}"
    keyboard = [
        [InlineKeyboardButton("\U0001f6a8 Yes, Permanently Delete", callback_data=f'permdelyes_{content_id}')],
        [InlineKeyboardButton("\u274c No, Cancel", callback_data='creator_deleted_books')],
    ]
    await _safe_edit(query, 
        f"\U0001f6a8 *PERMANENTLY DELETE \"{title}\"?*\n\n"
        f"\u26a0\ufe0f This action *CANNOT* be undone!\n"
        f"The book, all chapters, orders, and access records will be erased forever.",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def permdel_book_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Execute permanent deletion."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    try:
        content_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid.")
        return
    ok = permanent_delete_book(content_id, creator_id=user_id)
    msg = "\U0001f5d1 Book permanently deleted." if ok else "\u274c Could not delete this book."
    await _safe_edit(query, 
        msg,
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Deleted Books", callback_data='creator_deleted_books')]]),
    )


# ── Cancel Subscription ───────────────────────────────────────────

async def cancel_sub_warn(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show warning before cancelling subscription."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role != ROLE_CREATOR:
        await _safe_edit(query, "Access denied.")
        return

    from creators.subscription_service import get_active_subscription
    sub = get_active_subscription(user_id)
    if not sub:
        await _safe_edit(query, 
            "\u26a0\ufe0f You don't have an active subscription.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]),
        )
        return

    end_date = str(sub[3])[:10]
    await _safe_edit(query, 
        f"\u26a0\ufe0f *Are you sure you want to cancel?*\n\n"
        f"Your current subscription runs until *{end_date}*.\n\n"
        f"\u274c If you cancel now:\n"
        f"  \u2022 Your books will be *hidden* from the store\n"
        f"  \u2022 You will *lose creator access* immediately\n"
        f"  \u2022 No refund for remaining time\n\n"
        f"\U0001f6a8 *If you want to come back later, you will need to pay for a new subscription.*",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f6a8 Yes, Cancel My Subscription", callback_data='cancel_sub_confirm')],
            [InlineKeyboardButton("\u25c0 No, Keep It", callback_data='open_creator_dashboard')],
        ]),
        parse_mode='Markdown',
    )


async def cancel_sub_execute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Execute subscription cancellation after confirmation."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role != ROLE_CREATOR:
        await _safe_edit(query, "Access denied.")
        return

    from creators.subscription_service import cancel_subscription, hide_books_for_expired_creators

    ok = cancel_subscription(user_id)
    if not ok:
        await _safe_edit(query, 
            "\u26a0\ufe0f No active subscription to cancel.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        )
        return

    # Hide their books immediately
    hide_books_for_expired_creators()

    # Downgrade role back to user with payment_required status
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET role='user', creator_application_status='payment_required' WHERE telegram_id=%s",
        (user_id,),
    )
    conn.commit()
    conn.close()

    await _safe_edit(query, 
        "\u274c *Subscription Cancelled*\n\n"
        "Your creator subscription has been cancelled.\n"
        "Your books are now hidden from the store.\n\n"
        "To become a creator again, you'll need to pay for a new subscription.\n"
        "Use /start \u2192 \U0001f4b0 Pay Subscription to reactivate.",
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        parse_mode='Markdown',
    )


# ─── Creator My Orders ────────────────────────────────────────────────

ORDERS_PER_PAGE = 10


async def creator_my_orders_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show orders for the creator's books so they can approve/reject."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    from payments.order_service import list_creator_orders, count_creator_orders

    page = 0
    data = query.data
    if data.startswith('creator_my_orders_page_'):
        try:
            page = int(data.split('_')[-1])
        except ValueError:
            page = 0

    offset = page * ORDERS_PER_PAGE

    orders = list_creator_orders(user_id, status='pending_review', limit=ORDERS_PER_PAGE, offset=offset)
    total = count_creator_orders(user_id, status='pending_review')
    status_label = "pending review"
    if not orders:
        await _safe_edit(query, "No pending orders for your books.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]))
        return

    total_pages = max(1, (total + ORDERS_PER_PAGE - 1) // ORDERS_PER_PAGE)

    keyboard = []
    for row in orders:
        (order_id, uid, cid, status, ref, method,
         access_type, rent_days, price, proof_fid, title, username) = row
        name = username or str(uid)
        book = title or f"Book #{cid}"
        label = f"#{order_id} {name} \u2014 {book}"
        if access_type == 'temporary' and rent_days:
            label += f" ({rent_days}d)"
        if price:
            label += f" {price:.0f}GH\u20b5"
        status_icon = "\U0001f4f8" if proof_fid else "\u23f3"
        keyboard.append([InlineKeyboardButton(f"{status_icon} {label}", callback_data=f'order_detail_{order_id}')])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("\u25c0 Prev", callback_data=f'creator_my_orders_page_{page - 1}'))
    if page < total_pages - 1:
        nav.append(InlineKeyboardButton("Next \u25b6", callback_data=f'creator_my_orders_page_{page + 1}'))
    if nav:
        keyboard.append(nav)
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')])
    await _safe_edit(query, 
        f"\U0001f4e6 Your Book Orders ({status_label}) \u2014 Page {page + 1}/{total_pages}:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# ─── Creator Platform Fee ────────────────────────────────────────────

async def creator_platform_fee_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the creator's platform fee status."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    from payments.platform_fee_service import check_platform_fee_status, get_platform_fee_settings, get_creator_total_sales
    import os
    PLATFORM_MOMO = os.getenv("MOMO_NUMBER", "670 000 000")

    fee_status = check_platform_fee_status(user_id)
    settings = get_platform_fee_settings()
    sales = get_creator_total_sales(user_id)
    rate_pct = int(settings['fee_rate'] * 100)
    cycle = settings['fee_cycle_months']

    text = (
        f"\U0001f4b0 *Platform Fee*\n"
        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\U0001f4ca Total sales: *{sales['sale_count']}* orders\n"
        f"\U0001f4b5 Total revenue: *GH\u20b5 {sales['total_amount']:,.2f}*\n\n"
        f"\u2699\ufe0f Fee rate: *{rate_pct}%*\n"
        f"\U0001f504 Fee cycle: Every *{cycle} months*\n\n"
    )

    keyboard = []
    pending = fee_status.get('pending_fee')
    if pending:
        fee_amt = pending['fee_amount']
        p_start = str(pending['period_start'])[:10]
        p_end = str(pending['period_end'])[:10]
        status_txt = pending['status']
        text += (
            f"\u26a0\ufe0f *Fee Due:*\n"
            f"Period: {p_start} to {p_end}\n"
            f"Sales in period: *GH\u20b5 {pending['total_sales']:,.2f}*\n"
            f"Fee amount: *GH\u20b5 {fee_amt:,.2f}*\n"
        )
        if status_txt == 'proof_submitted':
            text += f"\n\u23f3 _Proof submitted. Waiting for WiamLabs to review._"
        else:
            text += (
                f"\n\U0001f4f1 Pay *GH\u20b5 {fee_amt:,.2f}* to:\n"
                f"`{PLATFORM_MOMO}`\n\n"
                f"After paying, tap the button below and send your proof screenshot."
            )
            keyboard.append([InlineKeyboardButton("\U0001f4b0 Pay & Upload Proof", callback_data=f'pay_platform_fee_{pending["id"]}')])
    else:
        next_due = fee_status.get('next_due')
        if next_due:
            text += f"\u2705 No fee due. Next fee: *{str(next_due)[:10]}*"
        else:
            text += "\u2705 No platform fee due at this time."

    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')])
    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')


async def pay_platform_fee_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Creator taps 'Pay & Upload Proof' for a platform fee."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    role = get_user_role(user_id)
    if role not in [ROLE_CREATOR, ROLE_FOUNDER]:
        return

    try:
        fee_id = int(query.data.split('_')[-1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid fee.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]))
        return

    context.user_data['awaiting_platform_fee_proof'] = fee_id
    import os
    PLATFORM_MOMO = os.getenv("MOMO_NUMBER", "670 000 000")

    from payments.platform_fee_service import get_platform_fee
    fee = get_platform_fee(fee_id)
    if not fee:
        await _safe_edit(query, "Fee not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='open_creator_dashboard')]]))
        return

    fee_amount = fee[6]
    await _safe_edit(query,
        f"\U0001f4b0 *Pay Platform Fee*\n\n"
        f"Amount: *GH\u20b5 {fee_amount:,.2f}*\n\n"
        f"\U0001f4f1 Send to MTN MoMo:\n"
        f"`{PLATFORM_MOMO}`\n\n"
        f"\u2705 After paying, send a *screenshot* of your receipt here.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data='creator_platform_fee')]]),
    )
