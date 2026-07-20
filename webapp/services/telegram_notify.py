"""
Telegram Notification Service — sends messages to Telegram via Bot API.

Used for:
1. Training Queue: forward unmatched help center questions for Founder/Editors to approve/reject
2. Platform Monitoring: new users, new books, review results, payouts, errors
3. Editorial Review: send review feedback to Founder/Editors in Telegram

Uses direct HTTP calls to Telegram Bot API (no dependency on bot instance).
"""
import os
import json
import logging
import threading
from datetime import datetime

import requests

log = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
TRAINING_CHAT_ID = os.environ.get('TRAINING_CHAT_ID', '')
NOTIFY_CHAT_ID = os.environ.get('NOTIFY_CHAT_ID', '')

API_BASE = f'https://api.telegram.org/bot{BOT_TOKEN}'


# ---------------------------------------------------------------------------
# Low-level send
# ---------------------------------------------------------------------------

def _send(method, payload, timeout=10):
    """Call Telegram Bot API. Runs in background thread to avoid blocking Flask."""
    if not BOT_TOKEN:
        log.warning("BOT_TOKEN not set — cannot send Telegram message")
        return None
    try:
        url = f'{API_BASE}/{method}'
        resp = requests.post(url, json=payload, timeout=timeout)
        data = resp.json()
        if not data.get('ok'):
            log.error("Telegram API error: %s", data.get('description', 'unknown'))
        return data
    except Exception as e:
        log.error("Telegram send error: %s", e)
        return None


def _send_async(method, payload):
    """Fire-and-forget: send in background thread so Flask doesn't block."""
    t = threading.Thread(target=_send, args=(method, payload), daemon=True)
    t.start()


def send_message(chat_id, text, reply_markup=None, parse_mode='HTML'):
    """Send a text message to a Telegram chat."""
    if not chat_id:
        return
    payload = {
        'chat_id': chat_id,
        'text': text[:4096],
        'parse_mode': parse_mode,
    }
    if reply_markup:
        payload['reply_markup'] = reply_markup
    _send_async('sendMessage', payload)


def _esc(text):
    """Escape HTML special characters for Telegram HTML parse mode."""
    if not text:
        return ''
    return str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


# ---------------------------------------------------------------------------
# 1. TRAINING QUEUE — Forward unmatched help center questions
# ---------------------------------------------------------------------------

def notify_training_queue(user_message, user_id, user_name='', confidence=0, unmatched_id=None):
    """Forward an unmatched help center question to the Training Chat for approval."""
    chat_id = TRAINING_CHAT_ID
    if not chat_id:
        log.info("TRAINING_CHAT_ID not set — skipping training queue notification")
        return

    text = (
        "🔔 <b>New Unmatched Question</b>\n\n"
        f"<b>User:</b> {_esc(user_name or 'Unknown')} (ID: {user_id})\n"
        f"<b>Message:</b> <i>{_esc(user_message[:500])}</i>\n"
        f"<b>Confidence:</b> {confidence}%\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
        "👇 <b>Choose an action:</b>"
    )

    # Inline keyboard with approve/reject buttons
    mid = unmatched_id or 0
    reply_markup = {
        'inline_keyboard': [
            [
                {'text': '✅ Assign to Intent', 'callback_data': f'train_assign_{mid}'},
                {'text': '❌ Ignore', 'callback_data': f'train_ignore_{mid}'},
            ],
            [
                {'text': '📋 View All Unmatched', 'callback_data': 'train_list_unmatched'},
            ],
        ]
    }

    send_message(chat_id, text, reply_markup=reply_markup)


# ---------------------------------------------------------------------------
# 2. PLATFORM MONITORING — Key event notifications
# ---------------------------------------------------------------------------

def notify_new_user(user_name, email, user_id):
    """Notify when a new user signs up."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "👤 <b>New User Registered</b>\n\n"
        f"<b>Name:</b> {_esc(user_name)}\n"
        f"<b>Email:</b> {_esc(email)}\n"
        f"<b>User ID:</b> {user_id}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    send_message(chat_id, text)


def notify_new_book_published(book_title, author, book_id, creator_name=''):
    """Notify when a creator publishes a new book."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "📖 <b>New Book Published</b>\n\n"
        f"<b>Title:</b> {_esc(book_title)}\n"
        f"<b>Author:</b> {_esc(author)}\n"
        f"<b>Creator:</b> {_esc(creator_name)}\n"
        f"<b>Book ID:</b> {book_id}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )

    app_url = os.environ.get('APP_URL', '')
    reply_markup = None
    if app_url:
        reply_markup = {
            'inline_keyboard': [
                [{'text': '🔗 View on WiamApp', 'url': f'{app_url}/book/{book_id}'}],
            ]
        }
    send_message(chat_id, text, reply_markup=reply_markup)


def notify_review_result(book_title, book_id, score, passed, creator_name=''):
    """Notify when a book review is completed (by the scoring engine)."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    status_emoji = '✅' if passed else '❌'
    status_text = 'APPROVED' if passed else 'NOT APPROVED'

    text = (
        f"📝 <b>Content Review Complete</b>\n\n"
        f"<b>Book:</b> {_esc(book_title)}\n"
        f"<b>Creator:</b> {_esc(creator_name)}\n"
        f"<b>Score:</b> {score}/100\n"
        f"<b>Result:</b> {status_emoji} {status_text}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )

    app_url = os.environ.get('APP_URL', '')
    reply_markup = None
    if app_url:
        reply_markup = {
            'inline_keyboard': [
                [{'text': '📋 Review Queue', 'url': f'{app_url}/founder/review-queue'}],
                [
                    {'text': '✅ Override Approve', 'callback_data': f'review_approve_{book_id}'},
                    {'text': '❌ Override Reject', 'callback_data': f'review_reject_{book_id}'},
                ],
            ]
        }
    send_message(chat_id, text, reply_markup=reply_markup)


def notify_new_creator_application(creator_name, email, user_id):
    """Notify when someone applies to become a creator."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "✍️ <b>New Creator Application</b>\n\n"
        f"<b>Name:</b> {_esc(creator_name)}\n"
        f"<b>Email:</b> {_esc(email)}\n"
        f"<b>User ID:</b> {user_id}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )

    app_url = os.environ.get('APP_URL', '')
    reply_markup = None
    if app_url:
        reply_markup = {
            'inline_keyboard': [
                [{'text': '📋 View Applications', 'url': f'{app_url}/founder/creators'}],
            ]
        }
    send_message(chat_id, text, reply_markup=reply_markup)


def notify_payout_event(creator_name, amount, currency, status, payout_id=0):
    """Notify on payout events (pending, approved, paid, failed)."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    emoji = {'pending': '⏳', 'approved': '✅', 'paid': '💰', 'failed': '❌'}.get(status, '📋')

    text = (
        f"{emoji} <b>Payout {status.upper()}</b>\n\n"
        f"<b>Creator:</b> {_esc(creator_name)}\n"
        f"<b>Amount:</b> {amount} {currency}\n"
        f"<b>Status:</b> {status}\n"
        f"<b>Payout ID:</b> {payout_id}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    send_message(chat_id, text)


def notify_moderation_flag(content_type, content_id, reason, reporter_name=''):
    """Notify when content is flagged for moderation."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "🚨 <b>Content Flagged</b>\n\n"
        f"<b>Type:</b> {_esc(content_type)}\n"
        f"<b>ID:</b> {content_id}\n"
        f"<b>Reason:</b> {_esc(reason)}\n"
        f"<b>Reporter:</b> {_esc(reporter_name or 'System')}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )

    app_url = os.environ.get('APP_URL', '')
    reply_markup = None
    if app_url:
        reply_markup = {
            'inline_keyboard': [
                [{'text': '🛡 Moderation Panel', 'url': f'{app_url}/founder/moderation'}],
            ]
        }
    send_message(chat_id, text, reply_markup=reply_markup)


def notify_error(error_msg, context=''):
    """Notify Founder of a system error."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "⚠️ <b>System Error</b>\n\n"
        f"<b>Context:</b> {_esc(context or 'Unknown')}\n"
        f"<b>Error:</b> <code>{_esc(str(error_msg)[:500])}</code>\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    send_message(chat_id, text)


def notify_coin_purchase(user_name, amount_ghs, coins, user_id):
    """Notify when a user buys coins."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "🪙 <b>Coin Purchase</b>\n\n"
        f"<b>User:</b> {_esc(user_name)} (ID: {user_id})\n"
        f"<b>Amount:</b> {amount_ghs} GHS\n"
        f"<b>Coins:</b> {coins}\n"
        f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    send_message(chat_id, text)


# ---------------------------------------------------------------------------
# 3. DAILY SUMMARY (called by scheduler)
# ---------------------------------------------------------------------------

def send_daily_summary(stats):
    """Send a daily platform summary to the notification chat."""
    chat_id = NOTIFY_CHAT_ID
    if not chat_id:
        return

    text = (
        "📊 <b>Daily Platform Summary</b>\n"
        f"<b>Date:</b> {datetime.utcnow().strftime('%Y-%m-%d')}\n\n"
        f"👤 New Users: <b>{stats.get('new_users', 0)}</b>\n"
        f"📖 New Books: <b>{stats.get('new_books', 0)}</b>\n"
        f"📝 Reviews Completed: <b>{stats.get('reviews', 0)}</b>\n"
        f"🪙 Coins Purchased: <b>{stats.get('coins_bought', 0)}</b>\n"
        f"💰 Revenue: <b>{stats.get('revenue_ghs', 0)} GHS</b>\n"
        f"👁 Total Reads: <b>{stats.get('total_reads', 0)}</b>\n"
        f"🔔 Unmatched Questions: <b>{stats.get('unmatched_qs', 0)}</b>"
    )
    send_message(chat_id, text)
