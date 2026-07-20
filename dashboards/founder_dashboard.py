from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def founder_menu():
    keyboard = [
        [InlineKeyboardButton("\U0001f465 Users Dashboard", callback_data="dash_users")],
        [InlineKeyboardButton("\u270d\ufe0f Creators Dashboard", callback_data="dash_creators")],
        [InlineKeyboardButton("\U0001f6e0 Admin Management", callback_data="dash_admins")],
        [InlineKeyboardButton("\u270d\ufe0f Approve Creators", callback_data="admin_approve_creators")],
        [InlineKeyboardButton("\U0001f4da Manage All Books", callback_data="admin_manage_books")],
        [InlineKeyboardButton("\U0001f3ad Manage Genres", callback_data="founder_genres")],
        [InlineKeyboardButton("\u2b50 Manage Featured", callback_data="manage_featured")],
        [InlineKeyboardButton("\U0001f4e8 View Feedback", callback_data="founder_feedback")],
        [InlineKeyboardButton("\U0001f6a8 Panic Lock", callback_data="founder_panic_toggle")],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data="back_to_menu")],
    ]
    return InlineKeyboardMarkup(keyboard)
