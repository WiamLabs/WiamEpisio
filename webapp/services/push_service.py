"""Web Push notification service using pywebpush."""
import json
import logging
from flask import current_app
from ..extensions import db
from ..models import PushSubscription

log = logging.getLogger(__name__)


def send_push_to_user(user_id, title, body, url='/notifications', notif_type='system'):
    """Send a web push notification to all subscriptions for a user."""
    vapid_private = current_app.config.get('VAPID_PRIVATE_KEY', '')
    vapid_email = current_app.config.get('VAPID_CLAIMS_EMAIL', '')
    if not vapid_private:
        log.debug('Push skipped — VAPID_PRIVATE_KEY not set')
        return

    # Check if user wants push notifications
    from ..models import User
    from sqlalchemy import or_
    user = User.query.filter(
        or_(User.id == user_id, User.wiam_id == user_id)
    ).first()
    if user and not getattr(user, 'notif_push', True):
        return

    subs = PushSubscription.query.filter_by(user_id=user_id).all()
    if not subs:
        return

    payload = json.dumps({
        'title': title,
        'body': body,
        'url': url,
        'type': notif_type,
    })

    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        log.warning('pywebpush not installed — skipping push notification')
        return

    stale_ids = []
    for sub in subs:
        subscription_info = {
            'endpoint': sub.endpoint,
            'keys': {
                'p256dh': sub.p256dh,
                'auth': sub.auth,
            }
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=vapid_private,
                vapid_claims={'sub': vapid_email},
            )
        except WebPushException as ex:
            # 410 Gone or 404 = subscription expired, remove it
            ex_str = str(ex)[:300]
            resp = getattr(ex, 'response', None)
            status = getattr(resp, 'status_code', 0) if resp else 0
            if status in (404, 410) or '410' in ex_str or 'Gone' in ex_str:
                stale_ids.append(sub.id)
                log.debug('Push sub expired (410/404) for user %s — will clean up', user_id)
            else:
                log.warning('Push failed for user %s: %s', user_id, ex_str)
        except Exception as ex:
            log.warning('Push error for user %s: %s', user_id, str(ex)[:200])

    # Clean up stale subscriptions
    if stale_ids:
        PushSubscription.query.filter(PushSubscription.id.in_(stale_ids)).delete(synchronize_session=False)
        db.session.commit()
        log.info('Cleaned up %d expired push subscriptions for user %s', len(stale_ids), user_id)
