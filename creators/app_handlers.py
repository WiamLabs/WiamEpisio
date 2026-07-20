from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes, ConversationHandler

from creators.applications import apply_for_creator, get_creator_application_status


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)

_HOME_KB = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])

# Conversation states
APPLY_PEN_NAME = 100
APPLY_BIO = 101
APPLY_COUNTRY = 104
APPLY_PROFILE_PIC = 102
APPLY_CONFIRM = 103


async def apply_creator_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point: user taps 'Apply to be Creator'."""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    status = get_creator_application_status(user_id)
    if status == 'pending':
        await _safe_edit(query, 
            "\u23f3 Your creator application is already pending review.",
            reply_markup=_HOME_KB,
        )
        return ConversationHandler.END
    await _safe_edit(query, 
        "\u270d\ufe0f *Creator Registration*\n"
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        "Welcome! Let's set up your creator profile.\n"
        "This info will be shown to readers on your books.\n\n"
        "\U0001f4dd *Step 1/4 \u2014 Author / Pen Name*\n\n"
        "What name do you want to publish under?\n"
        "This will appear on all your book covers.",
        parse_mode='Markdown',
    )
    return APPLY_PEN_NAME


async def apply_pen_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive pen name, ask for bio."""
    name = update.message.text.strip()
    if len(name) < 2:
        await update.message.reply_text("\u26a0\ufe0f Name too short. Enter at least 2 characters:")
        return APPLY_PEN_NAME
    if len(name) > 60:
        await update.message.reply_text("\u26a0\ufe0f Name too long (max 60). Try shorter:")
        return APPLY_PEN_NAME
    context.user_data['apply_pen_name'] = name
    await update.message.reply_text(
        f"\u2705 Great, *{name}*!\n\n"
        f"\U0001f4dd *Step 2/4 \u2014 Bio*\n\n"
        f"Write a short bio about yourself (max 300 chars).\n"
        f"Readers will see this on your profile.\n\n"
        f"_Example: \"Ghanaian author passionate about African folklore.\"_",
        parse_mode='Markdown',
    )
    return APPLY_BIO


async def apply_bio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive bio, ask for profile picture."""
    bio = update.message.text.strip()
    if len(bio) < 10:
        await update.message.reply_text("\u26a0\ufe0f Bio too short. Write at least 10 characters:")
        return APPLY_BIO
    if len(bio) > 300:
        await update.message.reply_text(f"\u26a0\ufe0f Too long ({len(bio)}/300). Shorten it:")
        return APPLY_BIO
    context.user_data['apply_bio'] = bio
    await update.message.reply_text(
        "\U0001f30d *Step 3/4 \u2014 Country*\n\n"
        "What country are you from?\n\n"
        "_Example: Ghana, Nigeria, Kenya, etc._",
        parse_mode='Markdown',
    )
    return APPLY_COUNTRY


async def apply_country(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive country, ask for profile picture."""
    country = update.message.text.strip()
    if len(country) < 2:
        await update.message.reply_text("\u26a0\ufe0f Country name too short. Enter at least 2 characters:")
        return APPLY_COUNTRY
    if len(country) > 60:
        await update.message.reply_text("\u26a0\ufe0f Country name too long (max 60). Try shorter:")
        return APPLY_COUNTRY
    context.user_data['apply_country'] = country
    await update.message.reply_text(
        "\U0001f4f7 *Step 4/4 \u2014 Profile Picture*\n\n"
        "Send a profile photo of yourself.\n"
        "This will appear alongside your books.\n\n"
        "Or type /skip to use your Telegram avatar.",
        parse_mode='Markdown',
    )
    return APPLY_PROFILE_PIC


async def apply_profile_pic(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Receive profile picture photo."""
    if not update.message.photo:
        await update.message.reply_text("\u26a0\ufe0f Please send a photo, or /skip to continue.")
        return APPLY_PROFILE_PIC
    context.user_data['apply_profile_pic'] = update.message.photo[-1].file_id
    return await _show_confirm(update, context)


async def apply_skip_pic(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User typed /skip for profile picture."""
    context.user_data['apply_profile_pic'] = None
    return await _show_confirm(update, context)


async def _show_confirm(update, context):
    """Show summary and ask for confirmation."""
    pen_name = context.user_data.get('apply_pen_name', '')
    bio = context.user_data.get('apply_bio', '')
    country = context.user_data.get('apply_country', '')
    has_pic = bool(context.user_data.get('apply_profile_pic'))
    text = (
        "\U0001f4cb *Review Your Creator Profile*\n"
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
        f"\u270d\ufe0f *Name:* {pen_name}\n\n"
        f"\U0001f4dd *Bio:* {bio}\n\n"
        f"\U0001f30d *Country:* {country}\n\n"
        f"\U0001f4f7 *Photo:* {'Attached \u2705' if has_pic else 'None (Telegram avatar)'}\n\n"
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
        "Does everything look good?"
    )
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("\u2705 Submit Application", callback_data='apply_confirm_yes')],
        [InlineKeyboardButton("\u270f\ufe0f Edit Name", callback_data='apply_edit_name')],
        [InlineKeyboardButton("\u270f\ufe0f Edit Bio", callback_data='apply_edit_bio')],
        [InlineKeyboardButton("\u274c Cancel", callback_data='apply_cancel')],
    ])
    if has_pic:
        try:
            await update.message.reply_photo(
                photo=context.user_data['apply_profile_pic'],
                caption=text,
                reply_markup=keyboard,
                parse_mode='Markdown',
            )
            return APPLY_CONFIRM
        except Exception:
            pass
    await update.message.reply_text(text, reply_markup=keyboard, parse_mode='Markdown')
    return APPLY_CONFIRM


async def apply_confirm_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle confirm/edit/cancel buttons."""
    query = update.callback_query
    await query.answer()
    if query.data == 'apply_cancel':
        context.user_data.pop('apply_pen_name', None)
        context.user_data.pop('apply_bio', None)
        context.user_data.pop('apply_profile_pic', None)
        try:
            await _safe_edit(query, "\u274c Application cancelled.", reply_markup=_HOME_KB)
        except Exception:
            try:
                await query.edit_message_caption(caption="\u274c Application cancelled.", reply_markup=_HOME_KB)
            except Exception:
                await query.message.reply_text("\u274c Application cancelled.", reply_markup=_HOME_KB)
        return ConversationHandler.END
    if query.data == 'apply_edit_name':
        try:
            await _safe_edit(query, "\u270d\ufe0f Enter your new author / pen name:")
        except Exception:
            await query.edit_message_caption(caption="\u270d\ufe0f Enter your new author / pen name:")
        return APPLY_PEN_NAME
    if query.data == 'apply_edit_bio':
        try:
            await _safe_edit(query, "\U0001f4dd Enter your new bio (max 300 chars):")
        except Exception:
            await query.edit_message_caption(caption="\U0001f4dd Enter your new bio (max 300 chars):")
        return APPLY_BIO
    if query.data == 'apply_confirm_yes':
        user_id = query.from_user.id
        pen_name = context.user_data.get('apply_pen_name', '')
        bio = context.user_data.get('apply_bio', '')
        country = context.user_data.get('apply_country', '')
        pic_fid = context.user_data.get('apply_profile_pic')
        from creators.profile_service import save_creator_profile
        save_creator_profile(user_id, pen_name, bio, pic_fid, country)
        apply_for_creator(user_id)
        result = (
            "\u2705 *Application Submitted!*\n\n"
            f"\u270d\ufe0f Name: *{pen_name}*\n"
            f"\U0001f4dd Bio: {bio}\n\n"
            "WiamApp Team will review your profile and approve you.\n"
            "You'll be notified when your account is activated."
        )
        try:
            await _safe_edit(query, result, parse_mode='Markdown', reply_markup=_HOME_KB)
        except Exception:
            try:
                await query.edit_message_caption(caption=result, parse_mode='Markdown', reply_markup=_HOME_KB)
            except Exception:
                await query.message.reply_text(result, parse_mode='Markdown', reply_markup=_HOME_KB)
        # Notify founder
        from core.role_manager import get_founder_id
        founder_id = get_founder_id()
        if founder_id:
            username = query.from_user.username or query.from_user.first_name or str(user_id)
            notif = (
                f"\U0001f514 *New Creator Application*\n\n"
                f"\U0001f464 @{username} (`{user_id}`)\n"
                f"\u270d\ufe0f Pen Name: *{pen_name}*\n"
                f"\U0001f4dd Bio: {bio}\n\n"
                f"Go to Creators \u2192 Applications to review."
            )
            try:
                if pic_fid:
                    await context.bot.send_photo(chat_id=founder_id, photo=pic_fid, caption=notif, parse_mode='Markdown', protect_content=True)
                else:
                    await context.bot.send_message(chat_id=founder_id, text=notif, parse_mode='Markdown')
            except Exception:
                pass
        context.user_data.pop('apply_pen_name', None)
        context.user_data.pop('apply_bio', None)
        context.user_data.pop('apply_country', None)
        context.user_data.pop('apply_profile_pic', None)
        return ConversationHandler.END
    return APPLY_CONFIRM


async def apply_status_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    status = get_creator_application_status(user_id)
    if status == 'pending':
        await _safe_edit(query, "\u23f3 Your creator application is pending review.", reply_markup=_HOME_KB)
    elif status == 'approved':
        await _safe_edit(query, "\u2705 Approved! Press /start to access Creator Dashboard.", reply_markup=_HOME_KB)
    elif status == 'rejected':
        await _safe_edit(query, "\u274c Your creator application was rejected.", reply_markup=_HOME_KB)
    else:
        await _safe_edit(query, "You have not submitted a creator application yet.", reply_markup=_HOME_KB)
