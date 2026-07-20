from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def user_menu(can_apply: bool = True, pending: bool = False, payment_required: bool = False):
    keyboard = [
        [InlineKeyboardButton("\U0001f4da Browse Books", callback_data="browse_books")],
        [InlineKeyboardButton("\U0001f525 Trending", callback_data="trending_books"),
         InlineKeyboardButton("\U0001f195 New Releases", callback_data="new_releases")],
        [InlineKeyboardButton("\U0001f3ad Genres", callback_data="browse_genres")],
        [InlineKeyboardButton("\u2764\ufe0f My Library", callback_data="my_library")],
    ]
    if payment_required:
        keyboard.append([InlineKeyboardButton("\U0001f4b0 Pay Subscription to Become Creator", callback_data="renew_subscription")])
    elif pending:
        keyboard.append([InlineKeyboardButton("\u23f3 Application Pending", callback_data="apply_status")])
    elif can_apply:
        keyboard.append([InlineKeyboardButton("\u270d\ufe0f Apply to be Creator", callback_data="apply_creator")])
    return InlineKeyboardMarkup(keyboard)
