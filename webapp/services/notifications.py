"""Notification generation helpers — call these from routes when events happen."""
from ..extensions import db
from ..models import Notification, Follow, Content, User, CreatorSettings
from sqlalchemy import or_


def _try_push(user_id, title, body, url='/', notif_type='system'):
    """Attempt to send push notifications to the user (Web Push + Expo native)."""
    # Web Push (browser)
    try:
        from flask import current_app
        if current_app.config.get('VAPID_PRIVATE_KEY'):
            from .push_service import send_push_to_user
            send_push_to_user(user_id, title, body, url, notif_type=notif_type)
    except Exception:
        pass

    # Expo Push (native iOS/Android)
    try:
        from .expo_push import send_expo_push_to_user
        send_expo_push_to_user(user_id, title, body, data={
            'url': url,
            'type': notif_type,
        })
    except Exception:
        pass


def _get_user_by_any_id(user_identifier):
    """Fetch a User by either internal id or wiam_id."""
    if user_identifier is None:
        return None
    return User.query.filter(
        or_(User.id == user_identifier, User.wiam_id == user_identifier)
    ).first()


def _resolve_uid(user_identifier):
    """Resolve the canonical notification user_id (wiam_id if present else user.id)."""
    user = _get_user_by_any_id(user_identifier)
    if user:
        return user.wiam_id or user.id
    return user_identifier


def _user_wants(user_id, pref_field):
    """Check if user has a notification preference enabled."""
    user = _get_user_by_any_id(user_id)
    if not user:
        return True  # default to sending
    return getattr(user, pref_field, True)


def _try_email(user_id, subject, body, link=''):
    """Attempt to send email notification to user if they have an email."""
    if not _user_wants(user_id, 'notif_email'):
        return
    try:
        from .email_notify import email_notify_user
        user = _get_user_by_any_id(user_id)
        if user:
            email_notify_user(user, subject, body, link)
    except Exception:
        pass


# ── Story / Chapter Notifications ─────────────────────────────────

def notify_new_book_published(content_id):
    """Notify all followers of a creator when their new book is published."""
    book = Content.query.get(content_id)
    if not book:
        return
    creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
    if not creator:
        return

    followers = Follow.query.filter_by(creator_id=book.creator_wiam_id).all()
    for f in followers:
        uid = _resolve_uid(f.user_id)
        if not _user_wants(uid, 'notif_new_chapter'):
            continue
        notif = Notification(
            user_id=uid,
            type='new_book',
            title=f'New story by {creator.display_name}',
            message=f'"{book.title}" is now available!',
            link=f'/book/{book.id}',
        )
        db.session.add(notif)
        _try_email(uid, f'New story by {creator.display_name}',
                   f'"{book.title}" is now available on WiamApp!', f'/book/{book.id}')
    if followers:
        db.session.commit()
        for f in followers:
            uid = _resolve_uid(f.user_id)
            _try_push(uid, f'New story by {creator.display_name}',
                      f'"{book.title}" is now available!', f'/book/{book.id}',
                      notif_type='new_book')


def notify_new_chapter(content_id, chapter_num, chapter_title=''):
    """Notify all followers when a creator publishes a new chapter."""
    book = Content.query.get(content_id)
    if not book:
        return
    creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
    if not creator:
        return

    ch_label = chapter_title or f'Chapter {chapter_num}'
    followers = Follow.query.filter_by(creator_id=book.creator_wiam_id).all()
    for f in followers:
        uid = _resolve_uid(f.user_id)
        if not _user_wants(uid, 'notif_new_chapter'):
            continue
        notif = Notification(
            user_id=uid,
            type='new_chapter',
            title=f'New chapter in "{book.title}"',
            message=f'{creator.display_name} published {ch_label}',
            link=f'/book/{book.id}/read?ch={chapter_num}',
        )
        db.session.add(notif)
        _try_email(uid, f'New chapter in "{book.title}"',
                   f'{creator.display_name} published {ch_label}', f'/book/{book.id}')
    if followers:
        db.session.commit()
        for f in followers:
            uid = _resolve_uid(f.user_id)
            _try_push(uid, f'New chapter in "{book.title}"',
                      f'{creator.display_name} published {ch_label}',
                      f'/book/{book.id}/read?ch={chapter_num}',
                      notif_type='new_chapter')


def notify_creator_scheduled_chapter_live(book, chapter_num, chapter_title=''):
    """Tell the creator their scheduled chapter just went live.

    Respects ``CreatorSettings.notif_scheduled_publish`` (default True when no
    row exists). Push type ``scheduled_publish`` deep-links in the mobile app.
    """
    if not book:
        return
    creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
    if not creator:
        return
    cs = CreatorSettings.query.filter_by(user_id=creator.id).first()
    if cs is not None and not cs.notif_scheduled_publish:
        return
    ch_label = chapter_title or f'Chapter {chapter_num}'
    uid = _resolve_uid(creator.id)
    link = f'/book/{book.id}/read?ch={chapter_num}'
    notif = Notification(
        user_id=uid,
        type='scheduled_publish',
        title='Your chapter is live',
        message=f'"{book.title}" — {ch_label} published on schedule.',
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(
        uid,
        'Your chapter is live',
        f'"{book.title}" — {ch_label} is now published.',
        link,
        notif_type='scheduled_publish',
    )


# ── Social Notifications ──────────────────────────────────────────

def notify_new_follower(creator_id, follower_name):
    """Notify a creator when someone follows them."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_new_follower'):
        return
    notif = Notification(
        user_id=uid,
        type='follow',
        title='New Follower',
        message=f'{follower_name} started following you!',
        link='/dashboard?tab=followers',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'New Follower',
              f'{follower_name} started following you!', '/dashboard?tab=followers',
              notif_type='follow')


def notify_comment(creator_id, commenter_name, book_title, book_id, chapter_num=None):
    """Notify creator when someone comments on their story."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_comments'):
        return
    link = f'/book/{book_id}'
    if chapter_num:
        link = f'/book/{book_id}/read/{chapter_num}/comments'
    msg = f'{commenter_name} commented on "{book_title}"'
    notif = Notification(
        user_id=uid,
        type='comment',
        title='New Comment',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'New Comment', msg, link, notif_type='comment')


def notify_like(creator_id, liker_name, book_title, book_id, chapter_num=None):
    """Notify creator when someone likes their chapter."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_likes'):
        return
    link = f'/book/{book_id}'
    msg = f'{liker_name} liked "{book_title}"'
    if chapter_num:
        msg = f'{liker_name} liked Chapter {chapter_num} of "{book_title}"'
    notif = Notification(
        user_id=uid,
        type='like',
        title='New Like',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'New Like', msg, link, notif_type='like')


def notify_mention(user_id, mentioner_name, context, link='/notifications'):
    """Notify user when they are mentioned in a comment."""
    uid = _resolve_uid(user_id)
    if not _user_wants(uid, 'notif_mentions'):
        return
    msg = f'{mentioner_name} mentioned you: "{context[:80]}"'
    notif = Notification(
        user_id=uid,
        type='mention',
        title='You were mentioned',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'You were mentioned', msg, link, notif_type='mention')


# ── Coins & Orders ────────────────────────────────────────────────

def notify_coin_received(user_id, amount, reason=''):
    """Notify user when they receive coins."""
    uid = _resolve_uid(user_id)
    if not _user_wants(uid, 'notif_coins'):
        return
    msg = f'You received {amount} Wiam Coins! {reason}'.strip()
    notif = Notification(
        user_id=uid,
        type='coins',
        title='Coins Received',
        message=msg,
        link='/payment/coins',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Coins Received', msg, '/payment/coins', notif_type='coins')


def notify_order_update(user_id, book_title, status, book_id=None):
    """Notify a user when their order status changes."""
    uid = _resolve_uid(user_id)
    status_text = {
        'approved': 'has been approved! You now have access.',
        'rejected': 'was not approved.',
        'awaiting_payment': 'is awaiting payment.',
    }.get(status, f'status updated to {status}.')

    msg = f'Your order for "{book_title}" {status_text}'
    link = f'/book/{book_id}' if book_id else '/dashboard'
    notif = Notification(
        user_id=uid,
        type='order_update',
        title='Order Update',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, 'Order Update', msg, link)
    _try_push(uid, 'Order Update', msg, link, notif_type='order_update')


def notify_access_expiry(user_id, book_title, days_left, book_id=None):
    """Notify a user when their rental is about to expire."""
    uid = _resolve_uid(user_id)
    notif = Notification(
        user_id=uid,
        type='access_expiry',
        title='Access Expiring Soon',
        message=f'Your access to "{book_title}" expires in {days_left} day{"s" if days_left != 1 else ""}.',
        link=f'/book/{book_id}/read' if book_id else '/library',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Access Expiring Soon',
              f'Your access to "{book_title}" expires soon.',
              f'/book/{book_id}/read' if book_id else '/library',
              notif_type='system')


# ── Elite & Announcements ─────────────────────────────────────────

def notify_elite_promotion(creator_id, book_title, book_id):
    """Notify creator when their story enters WiamElite."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_elite'):
        return
    msg = f'Your story "{book_title}" has been promoted to WiamElite! Congratulations!'
    notif = Notification(
        user_id=uid,
        type='elite',
        title='WiamElite Promotion',
        message=msg,
        link=f'/book/{book_id}',
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, 'WiamElite Promotion', msg, f'/book/{book_id}')
    _try_push(uid, 'WiamElite Promotion', msg, f'/book/{book_id}',
              notif_type='elite')


def notify_announcement(user_id, title, message, link='/notifications'):
    """Notify user about a platform announcement."""
    uid = _resolve_uid(user_id)
    if not _user_wants(uid, 'notif_announcements'):
        return
    notif = Notification(
        user_id=uid,
        type='announcement',
        title=title,
        message=message,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, title, message, link, notif_type='announcement')


# ── Classic / Public Domain Book Notifications ───────────────────

def notify_classic_book_published(content_id, book_title, author):
    """Notify ALL readers (non-creator, non-admin regular users) when a
    classic (public domain) book is published.  Sends in-app + push.
    Only users with notif_new_chapter enabled receive this.
    """
    import logging
    log = logging.getLogger(__name__)
    link = f'/book/{content_id}'
    title = 'New Classic Book Available!'
    msg = f'"{book_title}" by {author} is now on WiamApp — start reading for free!'

    readers = User.query.filter(
        User.status == 'active',
        User.onboarding_completed == True,
    ).all()

    count = 0
    for u in readers:
        uid = u.wiam_id or u.id
        if not getattr(u, 'notif_new_chapter', True):
            continue
        notif = Notification(
            user_id=uid,
            type='new_book',
            title=title,
            message=msg,
            link=link,
        )
        db.session.add(notif)
        count += 1

    if count > 0:
        db.session.commit()
        log.info("Notified %d readers about classic book '%s'", count, book_title)

    # Push notifications in a second pass (after commit)
    for u in readers:
        uid = u.wiam_id or u.id
        if not getattr(u, 'notif_new_chapter', True):
            continue
        _try_push(uid, title, msg, link, notif_type='new_book')


def notify_classic_chapter_released(content_id, book_title, chapter_num, chapter_title=''):
    """Notify readers who have reading progress on this classic book
    that a new chapter has been released."""
    from ..models import ReadingProgress
    import logging
    log = logging.getLogger(__name__)

    link = f'/book/{content_id}/read?ch={chapter_num}'
    ch_label = chapter_title or f'Chapter {chapter_num}'
    title = f'New chapter in "{book_title}"'
    msg = f'{ch_label} is now available — continue reading!'

    # Find users who have started reading this book
    progress_records = ReadingProgress.query.filter_by(content_id=content_id).all()
    notified_uids = set()
    count = 0

    for rp in progress_records:
        uid = rp.user_id
        if uid in notified_uids:
            continue
        notified_uids.add(uid)
        if not _user_wants(uid, 'notif_new_chapter'):
            continue
        notif = Notification(
            user_id=uid,
            type='new_chapter',
            title=title,
            message=msg,
            link=link,
        )
        db.session.add(notif)
        count += 1

    if count > 0:
        db.session.commit()
        log.info("Notified %d readers about ch%d of '%s'", count, chapter_num, book_title)

    for uid in notified_uids:
        if _user_wants(uid, 'notif_new_chapter'):
            _try_push(uid, title, msg, link, notif_type='new_chapter')


# ── Welcome & Onboarding ────────────────────────────────────────

def notify_welcome(user_id):
    """Send a welcome notification to a newly registered user."""
    uid = _resolve_uid(user_id)
    notif = Notification(
        user_id=uid,
        type='system',
        title='Welcome to WiamApp!',
        message='Start exploring free stories from creators around the world. Happy reading!',
        link='/browse',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Welcome to WiamApp!',
              'Start exploring free stories. Happy reading!', '/browse',
              notif_type='system')


# ── Sticker / Gift Notifications ────────────────────────────────

def notify_gift_received(recipient_id, sender_name, sticker_name, book_title='', book_id=None):
    """Notify user when they receive a sticker gift.

    Stickers are gifts, not coin transfers — using ``type='gift'`` lets the
    inbox icon and filters distinguish between coin/tip activity (yellow coin
    icon) and sticker celebrations (gift icon). Older clients that don't yet
    handle the ``gift`` type fall through to the generic icon, which is fine.
    """
    uid = _resolve_uid(recipient_id)
    link = f'/book/{book_id}' if book_id else '/gift/received'
    msg = f'{sender_name} sent you a {sticker_name} sticker'
    if book_title:
        msg += f' on "{book_title}"'
    msg += '!'
    notif = Notification(
        user_id=uid,
        type='gift',
        title='Sticker Gift Received!',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Sticker Gift Received!', msg, link, notif_type='gift')


# ── Gift Celebration Notifications ────────────────────────────

def notify_gift_celebration(recipient_id, sender_name, coin_amount, gift_id):
    """Notify reader of a gift and link to the celebration page."""
    uid = _resolve_uid(recipient_id)
    link = f'/gift/celebrate/{gift_id}'
    title = '🎁 You Received a Gift!'
    msg = f'{sender_name} gifted you {coin_amount} sticker coins! Tap to see your surprise.'
    notif = Notification(
        user_id=uid,
        type='coins',
        title=title,
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, title, msg, link, notif_type='coins')


# ── Review / Moderation Notifications ───────────────────────────

def notify_review_complete(creator_id, book_title, book_id, passed, score):
    """Notify creator when their book review is completed."""
    uid = _resolve_uid(creator_id)
    if passed:
        title = 'Review Approved!'
        msg = f'Your story "{book_title}" scored {score}/100 and has been approved for monetization!'
    else:
        title = 'Review Not Passed'
        msg = f'Your story "{book_title}" scored {score}/100. Check the feedback and resubmit when ready.'
    link = f'/book/{book_id}'
    notif = Notification(
        user_id=uid,
        type='system',
        title=title,
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, title, msg, link)
    _try_push(uid, title, msg, link, notif_type='system')


# ── Elite Demotion ──────────────────────────────────────────────

def notify_elite_demotion(creator_id, book_title, book_id):
    """Notify creator when their story is removed from WiamElite."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_elite'):
        return
    msg = f'Your story "{book_title}" has been removed from WiamElite. Keep writing — you can earn it back!'
    notif = Notification(
        user_id=uid,
        type='elite',
        title='WiamElite Status Update',
        message=msg,
        link=f'/book/{book_id}',
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, 'WiamElite Status Update', msg, f'/book/{book_id}')
    _try_push(uid, 'WiamElite Status Update', msg, f'/book/{book_id}',
              notif_type='elite')


# ── Creator Payout Notification ─────────────────────────────────

def notify_payout_processed(creator_id, amount, currency='GHS'):
    """Notify creator when their payout is processed."""
    uid = _resolve_uid(creator_id)
    if not _user_wants(uid, 'notif_coins'):
        return
    msg = f'Your payout of {amount} {currency} has been processed and sent to your account!'
    notif = Notification(
        user_id=uid,
        type='coins',
        title='Payout Processed!',
        message=msg,
        link='/dashboard?tab=earnings',
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, 'Payout Processed!', msg, '/dashboard?tab=earnings')
    _try_push(uid, 'Payout Processed!', msg, '/dashboard?tab=earnings',
              notif_type='coins')


# ── Reply to Comment ────────────────────────────────────────────

def notify_comment_reply(original_commenter_id, replier_name, book_title, book_id, chapter_num=None):
    """Notify user when someone replies to their comment."""
    uid = _resolve_uid(original_commenter_id)
    if not _user_wants(uid, 'notif_comments'):
        return
    link = f'/book/{book_id}'
    if chapter_num:
        link = f'/book/{book_id}/read/{chapter_num}/comments'
    msg = f'{replier_name} replied to your comment on "{book_title}"'
    notif = Notification(
        user_id=uid,
        type='comment',
        title='New Reply',
        message=msg,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'New Reply', msg, link, notif_type='comment')


# ── Coin Purchase Confirmation ──────────────────────────────────

def notify_coin_purchase_success(user_id, coins, amount_ghs):
    """Notify user when their coin purchase is successful."""
    uid = _resolve_uid(user_id)
    if not _user_wants(uid, 'notif_coins'):
        return
    msg = f'You successfully purchased {coins} Wiam Coins for {amount_ghs} GHS!'
    notif = Notification(
        user_id=uid,
        type='coins',
        title='Coins Purchased!',
        message=msg,
        link='/payment/coins',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Coins Purchased!', msg, '/payment/coins', notif_type='coins')


# ── Favorite / Rating Milestones ────────────────────────────────

def notify_milestone(creator_id, book_title, book_id, milestone_type, count):
    """Notify creator about a milestone on their book (reads, ratings, favorites)."""
    uid = _resolve_uid(creator_id)
    labels = {
        'reads': f'"{book_title}" just hit {count} reads!',
        'ratings': f'"{book_title}" now has {count} ratings!',
        'favorites': f'"{book_title}" was favorited {count} times!',
        'followers': f'You just reached {count} followers!',
    }
    msg = labels.get(milestone_type, f'Milestone reached: {count}!')
    notif = Notification(
        user_id=uid,
        type='system',
        title='Milestone Reached!',
        message=msg,
        link=f'/book/{book_id}' if book_id else '/dashboard',
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, 'Milestone Reached!', msg,
              f'/book/{book_id}' if book_id else '/dashboard',
              notif_type='system')


# ── Team / Admin Notifications ──────────────────────────────────

def notify_team_action(user_id, title, message, link='/team'):
    """Notify a team member about an action relevant to their role."""
    uid = _resolve_uid(user_id)
    notif = Notification(
        user_id=uid,
        type='announcement',
        title=title,
        message=message,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_push(uid, title, message, link, notif_type='announcement')


# ── System / Generic ──────────────────────────────────────────────

def notify_system(user_id, title, message, link=None):
    """Generic system notification."""
    uid = _resolve_uid(user_id)
    notif = Notification(
        user_id=uid,
        type='system',
        title=title,
        message=message,
        link=link,
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, title, message, link or '')
    _try_push(uid, title, message, link or '/', notif_type='system')


def notify_creator_welcome(user):
    """Push + in-app notification fired the moment a reader becomes a creator.

    The mobile app deep-links ``type='creator_welcome'`` straight into the
    full-screen ``WelcomeCreator`` tour so the new creator immediately sees
    every dashboard tool unlocked rather than wondering whether anything
    actually changed (the bug that previously left "approved" creators
    staring at an unchanged drawer).
    """
    if user is None:
        return
    uid = _resolve_uid(getattr(user, 'id', user))
    title = 'Welcome to WiamApp Creators'
    message = (
        'You can now write, publish chapters, build a following, and earn '
        'on WiamApp. Tap to open your creator tour.'
    )
    notif = Notification(
        user_id=uid,
        type='creator_welcome',
        title=title,
        message=message,
        link='/creator/welcome',
    )
    db.session.add(notif)
    db.session.commit()
    _try_email(uid, title, message, '/creator/welcome')
    _try_push(uid, title, message, '/creator/welcome', notif_type='creator_welcome')
