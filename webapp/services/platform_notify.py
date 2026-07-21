"""
WiamApp — Platform Notification Service
=========================================
Replaces telegram_notify.py — sends all admin/founder notifications via
email + in-app Notification model instead of Telegram Bot API.

All functions maintain the same signatures so callers don't need changes.
"""
import os
import logging
import threading
from datetime import datetime

log = logging.getLogger(__name__)


def _app_url():
    return os.environ.get('APP_URL', 'https://wiamapp.com').rstrip('/')


def _get_founder_email():
    """Get the founder's email for admin notifications."""
    return os.environ.get('FOUNDER_EMAIL', 'wiamlabs@gmail.com')


def _get_founder_id():
    """Get the founder's user ID for in-app notifications."""
    try:
        from webapp.models import User
        from webapp.extensions import db
        founder = User.query.filter_by(is_founder=True).first()
        if founder:
            return founder.wiam_id
    except Exception:
        pass
    return os.environ.get('FOUNDER_USER_ID', '')


def _send_email_async(to_email, subject, body_html):
    """Queue email via the centralized email queue (rate-limited)."""
    try:
        from webapp.services.email_service import enqueue_branded
        enqueue_branded(to_email, subject, body_html, subject[:100], priority=2)
    except Exception as e:
        log.error("Platform notify email error: %s", e)


def _create_in_app_notification(user_id, title, message, link=None, notif_type='system'):
    """Create an in-app notification for a user."""
    try:
        from webapp.models import Notification
        from webapp.extensions import db
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message[:500],
            link=link or '/notifications',
            type=notif_type,
        )
        db.session.add(notif)
        db.session.commit()
    except Exception as e:
        log.error("In-app notification error: %s", e)


def _notify_founder(title, message, link=None, email_subject=None, email_body=None):
    """Send notification to founder via in-app + email."""
    founder_id = _get_founder_id()
    founder_email = _get_founder_email()

    # In-app notification
    if founder_id:
        _create_in_app_notification(founder_id, title, message, link, 'admin')

    # Email notification
    if founder_email and email_body:
        _send_email_async(founder_email, email_subject or title, email_body)


def _esc(text):
    """Escape HTML special characters."""
    if not text:
        return ''
    return str(text).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _email_card(title, rows, cta_text='', cta_link=''):
    """Build a simple HTML email card body."""
    from webapp.services.email_service import _heading, _info_box, _button, _paragraph
    rows_html = ''
    for label, value in rows:
        rows_html += (
            f'<tr><td style="padding:6px 0;color:#888;font-size:13px;width:120px;">{label}:</td>'
            f'<td style="color:#e0e0e0;font-size:13px;font-weight:600;">{_esc(str(value))}</td></tr>'
        )
    body = (
        _heading(title, '#d4a843')
        + _info_box(f'<table style="width:100%;border-collapse:collapse;">{rows_html}</table>')
        + _paragraph(f'<span style="color:#888;font-size:12px;">{datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}</span>')
    )
    if cta_text and cta_link:
        body += _button(cta_text, cta_link)
    return body


# ---------------------------------------------------------------------------
# 1. TRAINING QUEUE — Unmatched WiamBot questions
# ---------------------------------------------------------------------------

def notify_training_queue(user_message, user_id, user_name='', confidence=0, unmatched_id=None):
    """Notify founder about an unmatched WiamBot question."""
    url = _app_url()
    title = 'New Unmatched Question'
    message = f'User {user_name or user_id}: "{user_message[:200]}"'
    link = f'{url}/founder/overview'

    email_body = _email_card(
        'New Unmatched WiamBot Question',
        [
            ('User', user_name or 'Unknown'),
            ('User ID', user_id),
            ('Message', user_message[:300]),
            ('Confidence', f'{confidence}%'),
        ],
        'View Training Queue', link,
    )
    _notify_founder(title, message, link, 'WiamBot — Unmatched Question', email_body)


# ---------------------------------------------------------------------------
# 2. PLATFORM MONITORING — Key event notifications
# ---------------------------------------------------------------------------

def notify_new_user(user_name, email, user_id):
    """Notify when a new user signs up."""
    url = _app_url()
    title = 'New User Registered'
    message = f'{user_name} ({email}) just signed up.'
    link = f'{url}/founder/users'

    email_body = _email_card(
        'New User Registered',
        [('Name', user_name), ('Email', email), ('User ID', user_id)],
        'View Users', link,
    )
    _notify_founder(title, message, link, 'New User — WiamApp', email_body)


def notify_new_book_published(book_title, author, book_id, creator_name=''):
    """Notify when a creator publishes a new book."""
    url = _app_url()
    title = 'New Book Published'
    message = f'"{book_title}" by {author or creator_name} published.'
    link = f'{url}/book/{book_id}'

    email_body = _email_card(
        'New Book Published',
        [
            ('Title', book_title),
            ('Author', author),
            ('Creator', creator_name),
            ('Book ID', book_id),
        ],
        'View Book', link,
    )
    _notify_founder(title, message, link, f'New Book: {book_title} — WiamApp', email_body)


def notify_review_result(book_title, book_id, score, passed, creator_name=''):
    """Notify when a book review is completed."""
    url = _app_url()
    status = 'APPROVED' if passed else 'NOT APPROVED'
    title = f'Content Review: {status}'
    message = f'"{book_title}" scored {score}/100 — {status}.'
    link = f'{url}/founder/review-queue'

    email_body = _email_card(
        f'Content Review Complete — {status}',
        [
            ('Book', book_title),
            ('Creator', creator_name),
            ('Score', f'{score}/100'),
            ('Result', status),
        ],
        'Review Queue', link,
    )
    _notify_founder(title, message, link, f'Review: {book_title} — {status}', email_body)


def notify_new_creator_application(creator_name, email, user_id):
    """Notify when someone applies to become a creator."""
    url = _app_url()
    title = 'New Creator Application'
    message = f'{creator_name} ({email}) applied to become a creator.'
    link = f'{url}/founder/creators'

    email_body = _email_card(
        'New Creator Application',
        [('Name', creator_name), ('Email', email), ('User ID', user_id)],
        'View Applications', link,
    )
    _notify_founder(title, message, link, 'New Creator Application — WiamApp', email_body)


def notify_episio_series_submitted(series_title, series_id, creator_name, episode_count):
    """Full-season QC queued — founder/team final check + publish on website."""
    url = _app_url()
    title = 'WiamEpisio series ready for review'
    message = (
        f'{creator_name} submitted “{series_title}” ({episode_count} eps). '
        f'System QC covers trailer + every episode + cover/banner. '
        f'Founder final check + publish on web.'
    )
    link = f'{url}/founder/episio/series/{series_id}'
    email_body = _email_card(
        'Series submitted for live',
        [
            ('Series', series_title),
            ('Series ID', series_id),
            ('Creator', creator_name),
            ('Episodes', episode_count),
            ('Note', 'Publish only after QC + light founder check (website).'),
        ],
        'Open Founder Review', link,
    )
    _notify_founder(title, message, link, f'Review: {series_title} — WiamEpisio', email_body)


def notify_episio_qc_flags_ready(series_title, series_id, band, flag_count):
    """QC finished with flags — founder decides before creator Needs Changes."""
    url = _app_url()
    title = 'WiamEpisio QC flags need your decision'
    message = (
        f'“{series_title}” QC band={band} with {flag_count} flagged item(s). '
        f'Review before creators are asked to fix. After SLA, system may notify them.'
    )
    link = f'{url}/founder/episio-quality'
    email_body = _email_card(
        'QC flags ready for founder decision',
        [
            ('Series', series_title),
            ('Series ID', series_id),
            ('Band', band),
            ('Flagged items', flag_count),
            ('Note', 'Approve / reject before creator Needs Changes is published.'),
        ],
        'Open Quality Panel', link,
    )
    _notify_founder(title, message, link, f'QC flags: {series_title} — WiamEpisio', email_body)


def notify_creator_application_if_pending(user, pen_name):
    """After submit + auto-rules: email/founder only if still in manual review queue."""
    if not user:
        return
    try:
        from webapp.extensions import db
        db.session.refresh(user)
        if (getattr(user, 'creator_application_status', None) or 'none') != 'pending':
            return
        nm = (pen_name or user.display_name or user.first_name or '').strip() or 'Applicant'
        notify_new_creator_application(nm, getattr(user, 'email', None) or '', user.id)
    except Exception as e:
        log.warning('notify_creator_application_if_pending: %s', e)


def notify_payout_event(creator_name, amount, currency, status, payout_id=0):
    """Notify on payout events (pending, approved, paid, failed)."""
    url = _app_url()
    title = f'Payout {status.upper()}'
    message = f'{creator_name}: {amount} {currency} — {status}'
    link = f'{url}/founder/payouts'

    email_body = _email_card(
        f'Payout {status.upper()}',
        [
            ('Creator', creator_name),
            ('Amount', f'{amount} {currency}'),
            ('Status', status),
            ('Payout ID', payout_id),
        ],
        'View Payouts', link,
    )
    _notify_founder(title, message, link, f'Payout {status} — {creator_name}', email_body)


def notify_moderation_flag(content_type, content_id, reason, reporter_name=''):
    """Notify when content is flagged for moderation."""
    url = _app_url()
    title = 'Content Flagged'
    message = f'{content_type} #{content_id} flagged: {reason[:200]}'
    link = f'{url}/founder/moderation'

    email_body = _email_card(
        'Content Flagged for Review',
        [
            ('Type', content_type),
            ('ID', content_id),
            ('Reason', reason[:300]),
            ('Reporter', reporter_name or 'System'),
        ],
        'Moderation Panel', link,
    )
    _notify_founder(title, message, link, 'Content Flagged — WiamApp', email_body)


def notify_error(error_msg, context=''):
    """Notify Founder of a system error."""
    title = 'System Error'
    message = f'{context}: {str(error_msg)[:300]}'

    email_body = _email_card(
        'System Error',
        [('Context', context or 'Unknown'), ('Error', str(error_msg)[:500])],
    )
    _notify_founder(title, message, None, 'System Error — WiamApp', email_body)


def notify_coin_purchase(user_name, amount_ghs, coins, user_id):
    """Notify when a user buys coins."""
    url = _app_url()
    title = 'Coin Purchase'
    message = f'{user_name} bought {coins} coins for {amount_ghs} GHS.'

    email_body = _email_card(
        'Coin Purchase',
        [
            ('User', user_name),
            ('User ID', user_id),
            ('Amount', f'{amount_ghs} GHS'),
            ('Coins', coins),
        ],
    )
    _notify_founder(title, message, f'{url}/founder/revenue', 'Coin Purchase — WiamApp', email_body)


# ---------------------------------------------------------------------------
# 3. DAILY SUMMARY (called by scheduler)
# ---------------------------------------------------------------------------

def send_daily_summary(stats):
    """Send a daily platform summary to the founder."""
    url = _app_url()
    title = 'Daily Platform Summary'
    date_str = datetime.utcnow().strftime('%Y-%m-%d')
    message = (
        f"Date: {date_str} | "
        f"New Users: {stats.get('new_users', 0)} | "
        f"New Books: {stats.get('new_books', 0)} | "
        f"Revenue: {stats.get('revenue_ghs', 0)} GHS"
    )

    email_body = _email_card(
        f'Daily Summary — {date_str}',
        [
            ('New Users', stats.get('new_users', 0)),
            ('New Books', stats.get('new_books', 0)),
            ('Reviews', stats.get('reviews', 0)),
            ('Coins Bought', stats.get('coins_bought', 0)),
            ('Revenue', f"{stats.get('revenue_ghs', 0)} GHS"),
            ('Total Reads', stats.get('total_reads', 0)),
            ('Unmatched Qs', stats.get('unmatched_qs', 0)),
        ],
        'View Dashboard', f'{url}/founder',
    )
    _notify_founder(title, message, f'{url}/founder', f'WiamApp Daily Summary — {date_str}', email_body)
