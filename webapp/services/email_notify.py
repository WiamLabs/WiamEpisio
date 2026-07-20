"""Email notifications for users — uses the branded WiamApp email template."""
import os
import logging

log = logging.getLogger(__name__)


def email_notify_user(user, subject, body_text, link=''):
    """Send a branded email notification to a user if they have an email.

    Args:
        user: User model instance (must have .email)
        subject: email subject line
        body_text: plain text body content
        link: optional URL to include as a CTA button
    """
    if not user or not getattr(user, 'email', None):
        return False

    try:
        from .email_service import enqueue_branded, _app_url, _heading, _paragraph, _button
        app_url = _app_url()
        full_link = f"{app_url}{link}" if link and not link.startswith('http') else (link or '')
        body = _heading(subject) + _paragraph(body_text)
        if full_link:
            body += _button('Open WiamApp', full_link)
        job = enqueue_branded(user.email, subject, body, body_text[:100], priority=2)
        return job is not None
    except Exception as e:
        log.warning("email_notify_user error: %s", str(e)[:200])
        return False
