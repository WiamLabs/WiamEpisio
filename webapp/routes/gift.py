"""F16: Gift a Book + Sticker Gifts — send books & beautiful stickers."""
import secrets
from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import GiftBook, Content, Access, User, StickerGift, CoinBalance, CoinTransaction

gift_bp = Blueprint('gift', __name__, url_prefix='/gift')

# ── Sticker Catalog ──────────────────────────────────────────────────────────
STICKER_CATALOG = [
    # key, emoji, label, coin_cost, tier, gradient_from, gradient_to
    {'key': 'balloon',    'emoji': '🎈', 'label': 'Balloon',     'cost': 5,  'tier': 'common',   'g1': '#ff6b6b', 'g2': '#ee5a24'},
    {'key': 'lollipop',   'emoji': '🍭', 'label': 'Lollipop',    'cost': 5,  'tier': 'common',   'g1': '#fd79a8', 'g2': '#e84393'},
    {'key': 'candy',      'emoji': '🍬', 'label': 'Candy',       'cost': 5,  'tier': 'common',   'g1': '#a29bfe', 'g2': '#6c5ce7'},
    {'key': 'chocolate',  'emoji': '🍫', 'label': 'Chocolate',   'cost': 5,  'tier': 'common',   'g1': '#b97a57', 'g2': '#8B5E3C'},
    {'key': 'coffee',     'emoji': '☕',  'label': 'Coffee',      'cost': 5,  'tier': 'common',   'g1': '#c0a16b', 'g2': '#8B6914'},
    {'key': 'donut',      'emoji': '🍩', 'label': 'Donut',       'cost': 10, 'tier': 'uncommon', 'g1': '#fdcb6e', 'g2': '#f39c12'},
    {'key': 'cupcake',    'emoji': '🧁', 'label': 'Cupcake',     'cost': 10, 'tier': 'uncommon', 'g1': '#fab1a0', 'g2': '#e17055'},
    {'key': 'icecream',   'emoji': '🍧', 'label': 'Ice Cream',   'cost': 10, 'tier': 'uncommon', 'g1': '#81ecec', 'g2': '#00cec9'},
    {'key': 'cone',       'emoji': '🍦', 'label': 'Cone',        'cost': 10, 'tier': 'uncommon', 'g1': '#ffeaa7', 'g2': '#fdcb6e'},
    {'key': 'watermelon', 'emoji': '🍉', 'label': 'Watermelon',  'cost': 10, 'tier': 'uncommon', 'g1': '#55efc4', 'g2': '#00b894'},
    {'key': 'party',      'emoji': '🎉', 'label': 'Party',       'cost': 15, 'tier': 'rare',     'g1': '#f9ca24', 'g2': '#f0932b'},
    {'key': 'confetti',   'emoji': '🎊', 'label': 'Confetti',    'cost': 15, 'tier': 'rare',     'g1': '#e056fd', 'g2': '#be2edd'},
    {'key': 'gift',       'emoji': '🎁', 'label': 'Gift Box',    'cost': 15, 'tier': 'rare',     'g1': '#ff7675', 'g2': '#d63031'},
    {'key': 'heart',      'emoji': '♥️',  'label': 'Heart',       'cost': 15, 'tier': 'rare',     'g1': '#ff6b81', 'g2': '#c44569'},
    {'key': 'cocktail',   'emoji': '🍹', 'label': 'Cocktail',    'cost': 15, 'tier': 'rare',     'g1': '#7bed9f', 'g2': '#2ed573'},
    {'key': 'sunglasses', 'emoji': '🕶️', 'label': 'Cool',        'cost': 20, 'tier': 'epic',     'g1': '#2d3436', 'g2': '#636e72'},
    {'key': 'backpack',   'emoji': '🎒', 'label': 'Backpack',    'cost': 20, 'tier': 'epic',     'g1': '#e17055', 'g2': '#d63031'},
    {'key': 'beer',       'emoji': '🍻', 'label': 'Cheers',      'cost': 20, 'tier': 'epic',     'g1': '#ffc312', 'g2': '#f79f1f'},
    {'key': 'champagne',  'emoji': '🥂', 'label': 'Champagne',   'cost': 20, 'tier': 'epic',     'g1': '#d4a843', 'g2': '#b8860b'},
    {'key': 'bottle',     'emoji': '🍾', 'label': 'Celebrate',   'cost': 20, 'tier': 'epic',     'g1': '#2bcbba', 'g2': '#0fb9b1'},
]

STICKER_MAP = {s['key']: s for s in STICKER_CATALOG}


@gift_bp.route('/send/<int:book_id>', methods=['GET', 'POST'])
@login_required
def send_gift(book_id):
    """Send a book as a gift."""
    book = Content.query.get_or_404(book_id)

    if request.method == 'POST':
        message = request.form.get('message', '').strip()[:500]
        code = secrets.token_urlsafe(12)

        gift = GiftBook(
            sender_id=current_user.wiam_id,
            content_id=book_id,
            recipient_code=code,
            message=message,
        )
        db.session.add(gift)
        db.session.commit()
        flash('Gift created! Share the link with the recipient.', 'success')
        return redirect(url_for('gift.gift_sent', gift_id=gift.id))

    return render_template('gift/send.html', book=book)


@gift_bp.route('/sent/<int:gift_id>')
@login_required
def gift_sent(gift_id):
    """Show the gift link after creation."""
    gift = GiftBook.query.get_or_404(gift_id)
    if gift.sender_id != current_user.wiam_id:
        flash('Not your gift.', 'error')
        return redirect(url_for('home.home'))
    book = Content.query.get(gift.content_id)
    return render_template('gift/sent.html', gift=gift, book=book)


@gift_bp.route('/claim/<code>')
@login_required
def claim_gift(code):
    """Claim a gift using its code."""
    gift = GiftBook.query.filter_by(recipient_code=code).first_or_404()
    book = Content.query.get(gift.content_id)

    if gift.is_claimed:
        flash('This gift has already been claimed.', 'info')
        return render_template('gift/claimed.html', gift=gift, book=book, already=True)

    if gift.sender_id == current_user.wiam_id:
        flash("You can't claim your own gift!", 'error')
        return redirect(url_for('home.home'))

    # Grant access
    gift.is_claimed = True
    gift.recipient_id = current_user.wiam_id
    gift.claimed_at = datetime.utcnow()

    existing_access = Access.query.filter_by(
        user_id=current_user.wiam_id, content_id=gift.content_id
    ).first()
    if not existing_access:
        access = Access(
            user_id=current_user.wiam_id,
            content_id=gift.content_id,
            access_type='permanent',
            status='active',
        )
        db.session.add(access)

    db.session.commit()

    # Notify sender
    try:
        from ..services.notifications import notify_system
        notify_system(gift.sender_id, 'Gift Claimed!',
                      f'{current_user.display_name} claimed your gift of "{book.title}"!',
                      f'/book/{book.id}')
    except Exception:
        pass

    flash(f'You received "{book.title}" as a gift!', 'success')
    return render_template('gift/claimed.html', gift=gift, book=book, already=False)


@gift_bp.route('/my-gifts')
@login_required
def my_gifts():
    """List gifts sent by the current user."""
    uid = current_user.wiam_id
    sent = db.session.query(GiftBook, Content).join(
        Content, GiftBook.content_id == Content.id
    ).filter(GiftBook.sender_id == uid).order_by(GiftBook.created_at.desc()).all()

    received = db.session.query(GiftBook, Content).join(
        Content, GiftBook.content_id == Content.id
    ).filter(GiftBook.recipient_id == uid).order_by(GiftBook.claimed_at.desc()).all()

    return render_template('gift/my_gifts.html', sent=sent, received=received)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STICKER GIFTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@gift_bp.route('/sticker/send', methods=['POST'])
@login_required
def send_sticker():
    """AJAX — send a gift sticker to a creator/reader on a story."""
    data = request.get_json(silent=True) or {}
    sticker_key = data.get('sticker_key', '')
    content_id = data.get('content_id', 0)
    recipient_id = data.get('recipient_id', 0)
    message = (data.get('message', '') or '')[:200]

    sticker = STICKER_MAP.get(sticker_key)
    if not sticker:
        return jsonify(ok=False, error='Invalid sticker.'), 400

    book = Content.query.get(content_id)
    if not book:
        return jsonify(ok=False, error='Story not found.'), 404

    recipient = User.query.filter_by(wiam_id=recipient_id).first()
    if not recipient:
        return jsonify(ok=False, error='Recipient not found.'), 404

    if recipient_id == current_user.wiam_id:
        return jsonify(ok=False, error="You can't gift yourself!"), 400

    cost = sticker['cost']
    uid = current_user.wiam_id

    # Check coin balance
    bal = CoinBalance.query.filter_by(user_id=uid).first()
    if not bal or bal.balance < cost:
        return jsonify(ok=False, error=f'Not enough coins. You need {cost} coins.', need_coins=True), 400

    # Deduct coins
    bal.balance -= cost
    bal.total_spent += cost
    bal.updated_at = datetime.utcnow()

    tx = CoinTransaction(
        user_id=uid,
        type='sticker_gift',
        amount=-cost,
        balance_after=bal.balance,
        description=f'Sent {sticker["emoji"]} {sticker["label"]} sticker on "{book.title}"',
        content_id=content_id,
        recipient_id=recipient_id,
    )
    db.session.add(tx)

    # Credit creator (50/50 split — same as chapter unlocks)
    creator_share = cost // 2
    if creator_share > 0:
        creator_bal = CoinBalance.query.filter_by(user_id=recipient_id).first()
        if not creator_bal:
            creator_bal = CoinBalance(user_id=recipient_id, balance=0, total_purchased=0, total_spent=0)
            db.session.add(creator_bal)
            db.session.flush()
        creator_bal.balance += creator_share
        creator_bal.updated_at = datetime.utcnow()

        creator_tx = CoinTransaction(
            user_id=recipient_id,
            type='sticker_received',
            amount=creator_share,
            balance_after=creator_bal.balance,
            description=f'Received {sticker["emoji"]} {sticker["label"]} sticker from {current_user.display_name}',
            content_id=content_id,
            recipient_id=uid,
        )
        db.session.add(creator_tx)

    # Save sticker gift
    sg = StickerGift(
        sender_id=uid,
        recipient_id=recipient_id,
        content_id=content_id,
        sticker_key=sticker_key,
        coin_cost=cost,
        message=message,
    )
    db.session.add(sg)
    db.session.commit()

    # Notify recipient
    try:
        from ..services.notifications import notify_gift_received
        notify_gift_received(
            recipient_id, current_user.display_name,
            f'{sticker["emoji"]} {sticker["label"]}',
            book_title=book.title, book_id=content_id,
        )
    except Exception:
        pass

    return jsonify(ok=True, sticker=sticker_key, emoji=sticker['emoji'], label=sticker['label'])


@gift_bp.route('/sticker/data/<int:content_id>')
@login_required
def sticker_data(content_id):
    """AJAX — get recent sticker gifts for a story."""
    from sqlalchemy import func
    gifts = db.session.query(
        StickerGift.sticker_key,
        func.count(StickerGift.id).label('cnt')
    ).filter(
        StickerGift.content_id == content_id
    ).group_by(StickerGift.sticker_key).all()

    total = StickerGift.query.filter_by(content_id=content_id).count()

    result = []
    for key, cnt in gifts:
        s = STICKER_MAP.get(key)
        if s:
            result.append({'key': key, 'emoji': s['emoji'], 'label': s['label'], 'count': cnt})

    return jsonify(ok=True, stickers=result, total=total)


@gift_bp.route('/stickers')
@login_required
def sticker_history():
    """View sent and received sticker gifts."""
    uid = current_user.wiam_id
    sent = StickerGift.query.filter_by(sender_id=uid).order_by(StickerGift.created_at.desc()).limit(50).all()
    received = StickerGift.query.filter_by(recipient_id=uid).order_by(StickerGift.created_at.desc()).limit(50).all()
    return render_template('gift/sticker_history.html', sent=sent, received=received,
                           sticker_map=STICKER_MAP)


# ---------------------------------------------------------------------------
# Gift Celebration Page — cinematic congratulation when reader opens gift
# ---------------------------------------------------------------------------

@gift_bp.route('/celebrate/<int:gift_id>')
@login_required
def celebrate(gift_id):
    """Beautiful cinematic celebration page when a reader opens their gift notification."""
    gift = StickerGift.query.get_or_404(gift_id)

    # Only the recipient can see the celebration
    if gift.recipient_id != current_user.id:
        flash('This gift is not for you.', 'info')
        return redirect(url_for('home.home'))

    # Get sender info
    sender = User.query.get(gift.sender_id)
    sender_name = sender.display_name if sender else 'A Creator'
    sender_avatar = sender.avatar_url if sender else None

    # Get sticker info
    sticker = STICKER_MAP.get(gift.sticker_key)

    return render_template('gift/celebrate.html',
                           gift=gift,
                           sender_name=sender_name,
                           sender_avatar=sender_avatar,
                           sticker=sticker,
                           coin_amount=gift.coin_cost)
