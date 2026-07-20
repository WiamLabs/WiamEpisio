"""
Expo Push Notification Service — sends native push notifications
to iOS/Android via the Expo Push API (https://exp.host/--/api/v2/push/send).

No API key required — Expo push is free and keyless for standard usage.
"""
import logging
import requests
from ..extensions import db
from ..models import ExpoPushToken

log = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def send_expo_push_to_user(user_id, title, body, data=None):
    """
    Send an Expo push notification to all active tokens for a user.
    
    Args:
        user_id: The user's wiam_id (BigInteger)
        title: Notification title
        body: Notification body text
        data: Optional dict of extra data (e.g. { screen: 'BookDetail', params: { bookId: 5 } })
    """
    from ..models import User
    from sqlalchemy import or_

    # Check user push preference
    user = User.query.filter(
        or_(User.id == user_id, User.wiam_id == user_id)
    ).first()
    if user and not getattr(user, 'notif_push', True):
        return

    # Get all active tokens for this user (check both id and wiam_id)
    tokens = ExpoPushToken.query.filter(
        ExpoPushToken.user_id == user_id,
        ExpoPushToken.active == True,
    ).all()

    if not tokens:
        return

    messages = []
    for t in tokens:
        if not t.token.startswith('ExponentPushToken['):
            continue
        msg = {
            'to': t.token,
            'sound': 'default',
            'title': title,
            'body': body,
        }
        if data:
            msg['data'] = data
        messages.append(msg)

    if not messages:
        return

    _send_batch(messages)


def _send_batch(messages):
    """Send a batch of Expo push messages (max 100 per request)."""
    stale_tokens = []

    # Expo allows up to 100 messages per request
    for i in range(0, len(messages), 100):
        batch = messages[i:i + 100]
        try:
            resp = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout=10,
            )
            if resp.status_code == 200:
                result = resp.json()
                tickets = result.get('data', [])
                for idx, ticket in enumerate(tickets):
                    if ticket.get('status') == 'error':
                        detail = ticket.get('details', {})
                        error_type = detail.get('error', '')
                        if error_type == 'DeviceNotRegistered':
                            token_str = batch[idx].get('to', '')
                            stale_tokens.append(token_str)
                            log.debug('Expo push token expired: %s', token_str)
                        else:
                            log.warning('Expo push error: %s — %s',
                                        ticket.get('message', ''), error_type)
            else:
                log.warning('Expo push API error: status=%d body=%s',
                            resp.status_code, resp.text[:200])
        except requests.RequestException as e:
            log.warning('Expo push request failed: %s', str(e)[:200])

    # Clean up stale tokens
    if stale_tokens:
        try:
            for token_str in stale_tokens:
                ExpoPushToken.query.filter_by(token=token_str).update(
                    {'active': False}, synchronize_session=False
                )
            db.session.commit()
            log.info('Deactivated %d expired Expo push tokens', len(stale_tokens))
        except Exception as e:
            db.session.rollback()
            log.warning('Failed to clean stale Expo tokens: %s', e)


def register_token(user_id, token, device_name=None, platform=None):
    """
    Register or reactivate an Expo push token for a user.
    Returns the ExpoPushToken record.
    """
    if not token or not token.startswith('ExponentPushToken['):
        return None

    existing = ExpoPushToken.query.filter_by(token=token).first()
    if existing:
        # Reactivate and reassign if different user (e.g. logout/login on same device)
        existing.user_id = user_id
        existing.active = True
        if device_name:
            existing.device_name = device_name
        if platform:
            existing.platform = platform
        db.session.commit()
        return existing

    new_token = ExpoPushToken(
        user_id=user_id,
        token=token,
        device_name=device_name,
        platform=platform,
        active=True,
    )
    db.session.add(new_token)
    db.session.commit()
    log.info('Registered Expo push token for user %s (%s)', user_id, platform or 'unknown')
    return new_token


def unregister_token(token):
    """Deactivate an Expo push token (e.g. on logout)."""
    if not token:
        return
    existing = ExpoPushToken.query.filter_by(token=token).first()
    if existing:
        existing.active = False
        db.session.commit()
        log.info('Deactivated Expo push token: %s...', token[:30])
