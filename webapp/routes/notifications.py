"""In-app notifications for users."""
from flask import Blueprint, render_template, jsonify, redirect, url_for, request, current_app
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import Notification, PushSubscription

notifications_bp = Blueprint('notifications', __name__, url_prefix='/notifications')


def _invalidate_notif_cache(uid):
    """Remove cached notification count so the badge updates immediately."""
    try:
        cache = getattr(current_app, '_notif_count_cache', None)
        if cache and uid in cache:
            del cache[uid]
    except Exception:
        pass


@notifications_bp.route('/')
@login_required
def list_notifications():
    """Show all notifications for the current user."""
    uid = current_user.wiam_id or current_user.id
    notifs = Notification.query.filter_by(
        user_id=uid
    ).order_by(Notification.created_at.desc()).limit(50).all()

    # Mark all as read
    unread = [n for n in notifs if not n.is_read]
    if unread:
        for n in unread:
            n.is_read = True
        db.session.commit()
        _invalidate_notif_cache(uid)

    return render_template('notifications.html', notifications=notifs)


@notifications_bp.route('/count')
@login_required
def unread_count():
    """Return unread notification count (for AJAX polling)."""
    uid = current_user.wiam_id or current_user.id
    count = Notification.query.filter_by(
        user_id=uid, is_read=False
    ).count()
    return jsonify({'count': count})


@notifications_bp.route('/read/<int:notif_id>')
@login_required
def read_and_redirect(notif_id):
    """Mark a notification as read and redirect to its link."""
    uid = current_user.wiam_id or current_user.id
    notif = Notification.query.filter_by(
        id=notif_id, user_id=uid
    ).first()
    if notif:
        notif.is_read = True
        db.session.commit()
        _invalidate_notif_cache(uid)
        if notif.link:
            return redirect(notif.link)
    return redirect(url_for('notifications.list_notifications'))


@notifications_bp.route('/clear', methods=['POST'])
@login_required
def clear_all():
    """Mark all notifications as read."""
    uid = current_user.wiam_id or current_user.id
    Notification.query.filter_by(
        user_id=uid, is_read=False
    ).update({'is_read': True})
    db.session.commit()
    _invalidate_notif_cache(uid)
    return jsonify({'success': True})


@notifications_bp.route('/delete/<int:notif_id>', methods=['POST'])
@login_required
def delete_notification(notif_id):
    """Delete a single notification."""
    uid = current_user.wiam_id or current_user.id
    notif = Notification.query.filter_by(
        id=notif_id, user_id=uid
    ).first()
    if notif:
        db.session.delete(notif)
        db.session.commit()
        _invalidate_notif_cache(uid)
    return jsonify({'success': True})


@notifications_bp.route('/delete-all', methods=['POST'])
@login_required
def delete_all():
    """Delete all notifications for the current user."""
    uid = current_user.wiam_id or current_user.id
    Notification.query.filter_by(
        user_id=uid
    ).delete()
    db.session.commit()
    _invalidate_notif_cache(uid)
    return jsonify({'success': True})


@notifications_bp.route('/poll')
@login_required
def poll_notifications():
    """Return new unread notifications for in-app toast display.
    Uses a session-stored last_seen_notif_id to track which are new.
    """
    from flask import session
    uid = current_user.wiam_id or current_user.id
    last_seen = session.get('last_seen_notif_id', 0)

    # Single query: fetch all unread (limit 20), derive both new notifs and count
    all_unread = Notification.query.filter(
        Notification.user_id == uid,
        Notification.is_read == False,
    ).order_by(Notification.created_at.desc()).limit(20).all()

    new_notifs = [n for n in all_unread if n.id > last_seen][:5]
    unread_count = len(all_unread)

    # Update last_seen to the max id
    if new_notifs:
        session['last_seen_notif_id'] = max(n.id for n in new_notifs)

    return jsonify({
        'notifications': [{
            'id': n.id,
            'type': n.type,
            'title': n.title,
            'message': n.message,
            'link': n.link,
        } for n in new_notifs],
        'unread_count': unread_count,
    })


@notifications_bp.route('/recent')
@login_required
def recent_notifications():
    """Return recent notifications as JSON for the bell dropdown."""
    uid = current_user.wiam_id or current_user.id
    notifs = Notification.query.filter_by(
        user_id=uid
    ).order_by(Notification.created_at.desc()).limit(10).all()
    return jsonify({
        'notifications': [{
            'id': n.id,
            'type': n.type or 'system',
            'title': n.title,
            'message': n.message or '',
            'link': n.link or '#',
            'is_read': n.is_read,
            'time': n.created_at.strftime('%b %d · %I:%M %p') if n.created_at else '',
        } for n in notifs],
        'total': Notification.query.filter_by(user_id=uid).count(),
    })


# ─── Web Push Subscription ────────────────────────────────────────────────────

@notifications_bp.route('/push/vapid-key')
@login_required
def vapid_public_key():
    """Return the VAPID public key for the client to subscribe."""
    key = current_app.config.get('VAPID_PUBLIC_KEY', '')
    return jsonify({'publicKey': key})


@notifications_bp.route('/push/subscribe', methods=['POST'])
@csrf.exempt
@login_required
def push_subscribe():
    """Save a push subscription for the current user."""
    data = request.get_json(silent=True) or {}
    endpoint = data.get('endpoint', '')
    keys = data.get('keys', {})
    p256dh = keys.get('p256dh', '')
    auth = keys.get('auth', '')

    if not endpoint or not p256dh or not auth:
        return jsonify({'error': 'Invalid subscription data'}), 400

    uid = current_user.wiam_id or current_user.id

    # Check if this endpoint already exists for this user
    existing = PushSubscription.query.filter_by(
        user_id=uid, endpoint=endpoint
    ).first()
    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        sub = PushSubscription(
            user_id=uid, endpoint=endpoint,
            p256dh=p256dh, auth=auth,
        )
        db.session.add(sub)

    db.session.commit()
    return jsonify({'ok': True})


@notifications_bp.route('/push/unsubscribe', methods=['POST'])
@csrf.exempt
@login_required
def push_unsubscribe():
    """Remove a push subscription."""
    data = request.get_json(silent=True) or {}
    endpoint = data.get('endpoint', '')
    if endpoint:
        PushSubscription.query.filter_by(
            user_id=current_user.wiam_id or current_user.id, endpoint=endpoint
        ).delete()
        db.session.commit()
    return jsonify({'ok': True})
