"""
WiamBulletin — Creator announcement channel (WhatsApp Channel style).
Rules:
  - Only creators can post (text + emojis, or book_share with cover)
  - Readers must explicitly follow a creator's Bulletin (NOT auto on Follow)
  - Readers react with emojis (cannot type messages)
  - No direct image/video uploads — only book covers via book_share
"""
import logging
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, abort
from flask_login import login_required, current_user
from ..extensions import db
from ..models import (
    BulletinPost, BulletinReaction, BulletinFollow, Follow, User, Content,
    CreatorProfile, Notification,
)

log = logging.getLogger(__name__)

bulletin_bp = Blueprint('bulletin', __name__, url_prefix='/bulletin')

# Wiam Official Bulletin uses creator_id = 0 (system-level)
OFFICIAL_BULLETIN_ID = 0

# Minimum followers required for a creator to post on their Bulletin
MIN_FOLLOWERS_TO_POST = 50


# ── Feature Lock Gate ─────────────────────────────────────────────────

@bulletin_bp.before_request
def bulletin_lock_gate():
    """Block access if founder has locked WiamBulletin."""
    try:
        from flask_login import current_user
        if current_user.is_authenticated and getattr(current_user, 'is_founder', False):
            return None
        from ..extensions import is_feature_locked
        if is_feature_locked('feature_bulletin'):
            return render_template('feature_locked.html',
                feature_name='WiamBulletin',
                feature_icon='📢',
                feature_description='WiamBulletin is where creators share updates and connect with readers. This feature is not available right now — check back soon!'
            )
    except Exception as e:
        log.warning("Bulletin lock gate error: %s", str(e)[:120])


# ── Helpers ───────────────────────────────────────────────────────────

def _is_bulletin_follower(user_id, creator_id):
    """Check if user follows creator's Bulletin."""
    return BulletinFollow.query.filter_by(
        user_id=user_id, creator_id=creator_id
    ).first() is not None


def _is_own_bulletin(user_id, creator_id):
    return int(user_id) == int(creator_id)


# ── Bulletin List: All creators whose bulletins you follow ───────────

@bulletin_bp.route('/')
@login_required
def bulletin_list():
    """Chat-list view: shows all creators whose bulletin the user follows."""
    uid = current_user.wiam_id

    # ── Wiam Official Bulletin — always shown at top for everyone ──
    official_last_post = BulletinPost.query.filter_by(
        creator_id=OFFICIAL_BULLETIN_ID, is_deleted=False
    ).order_by(BulletinPost.created_at.desc()).first()
    official_post_count = BulletinPost.query.filter_by(
        creator_id=OFFICIAL_BULLETIN_ID, is_deleted=False
    ).count()
    official_channel = {
        'is_official': True,
        'creator': None,
        'profile': None,
        'last_post': official_last_post,
        'follower_count': User.query.count(),  # all users
        'post_count': official_post_count,
    }

    # Get bulletin follows
    bfollows = BulletinFollow.query.filter_by(user_id=uid).all()
    creator_ids = [bf.creator_id for bf in bfollows]

    channels = []
    if creator_ids:
        for cid in creator_ids:
            if cid == OFFICIAL_BULLETIN_ID:
                continue  # Already shown above
            creator = User.query.filter_by(wiam_id=cid).first()
            if not creator:
                continue
            cp = CreatorProfile.query.get(cid)
            last_post = BulletinPost.query.filter_by(
                creator_id=cid, is_deleted=False
            ).order_by(BulletinPost.created_at.desc()).first()
            follower_count = BulletinFollow.query.filter_by(creator_id=cid).count()
            channels.append({
                'is_official': False,
                'creator': creator,
                'profile': cp,
                'last_post': last_post,
                'follower_count': follower_count,
            })
        # Sort by most recent post
        channels.sort(
            key=lambda c: c['last_post'].created_at if c['last_post'] else datetime.min,
            reverse=True,
        )

    # If creator, also show own bulletin at top
    own_channel = None
    if current_user.is_creator:
        cp = CreatorProfile.query.get(uid)
        last_post = BulletinPost.query.filter_by(
            creator_id=uid, is_deleted=False
        ).order_by(BulletinPost.created_at.desc()).first()
        follower_count = BulletinFollow.query.filter_by(creator_id=uid).count()
        own_channel = {
            'creator': current_user,
            'profile': cp,
            'last_post': last_post,
            'follower_count': follower_count,
        }

    return render_template(
        'bulletin_list.html',
        channels=channels,
        own_channel=own_channel,
        official_channel=official_channel,
    )


# ── Channel: View a creator's Bulletin ───────────────────────────────

@bulletin_bp.route('/official')
@login_required
def official_feed():
    """Wiam Official Bulletin — system-level announcements for all users."""
    uid = current_user.wiam_id
    is_founder = getattr(current_user, 'is_founder', False)

    page = request.args.get('page', 1, type=int)
    per_page = 50

    pinned = BulletinPost.query.filter_by(
        creator_id=OFFICIAL_BULLETIN_ID, is_pinned=True, is_deleted=False
    ).order_by(BulletinPost.created_at.desc()).all()

    posts_q = BulletinPost.query.filter_by(
        creator_id=OFFICIAL_BULLETIN_ID, is_pinned=False, is_deleted=False
    ).order_by(BulletinPost.created_at.desc())
    posts_page = posts_q.paginate(page=page, per_page=per_page, error_out=False)

    all_post_ids = [p.id for p in pinned] + [p.id for p in posts_page.items]
    user_reactions = {}
    if all_post_ids:
        reacts = BulletinReaction.query.filter(
            BulletinReaction.post_id.in_(all_post_ids),
            BulletinReaction.user_id == uid
        ).all()
        for r in reacts:
            user_reactions.setdefault(r.post_id, []).append(r.emoji)

    post_count = BulletinPost.query.filter_by(
        creator_id=OFFICIAL_BULLETIN_ID, is_deleted=False
    ).count()

    return render_template(
        'bulletin.html',
        creator=None,
        profile=None,
        pinned_posts=pinned,
        posts=posts_page,
        user_reactions=user_reactions,
        is_own=is_founder,
        is_official=True,
        is_bulletin_follower=True,
        follower_count=User.query.count(),
        post_count=post_count,
        creator_books=[],
    )


@bulletin_bp.route('/<int:creator_id>')
@login_required
def feed(creator_id):
    """Chat-like channel view for a single creator's bulletin."""
    # Redirect creator_id=0 to official feed
    if creator_id == OFFICIAL_BULLETIN_ID:
        return redirect(url_for('bulletin.official_feed'))

    uid = current_user.wiam_id
    creator = User.query.filter_by(wiam_id=creator_id).first_or_404()
    profile = CreatorProfile.query.get(creator_id)

    if not creator.is_creator:
        flash('This user is not a creator.', 'error')
        return redirect(url_for('home.home'))

    is_own = _is_own_bulletin(uid, creator_id)
    is_bulletin_follower = _is_bulletin_follower(uid, creator_id)

    # Bulletin follower count
    follower_count = BulletinFollow.query.filter_by(creator_id=creator_id).count()
    post_count = BulletinPost.query.filter_by(creator_id=creator_id, is_deleted=False).count()

    # Even if not a bulletin follower, let them see the page (with follow prompt)
    # Paginated posts (oldest first for chat-like feel, but we reverse in template)
    page = request.args.get('page', 1, type=int)
    per_page = 50

    pinned = BulletinPost.query.filter_by(
        creator_id=creator_id, is_pinned=True, is_deleted=False
    ).order_by(BulletinPost.created_at.desc()).all()

    posts_q = BulletinPost.query.filter_by(
        creator_id=creator_id, is_pinned=False, is_deleted=False
    ).order_by(BulletinPost.created_at.desc())
    posts_page = posts_q.paginate(page=page, per_page=per_page, error_out=False)

    # Get user's reactions for highlighting
    all_post_ids = [p.id for p in pinned] + [p.id for p in posts_page.items]
    user_reactions = {}
    if all_post_ids:
        reacts = BulletinReaction.query.filter(
            BulletinReaction.post_id.in_(all_post_ids),
            BulletinReaction.user_id == uid
        ).all()
        for r in reacts:
            user_reactions.setdefault(r.post_id, []).append(r.emoji)

    # Creator's books (for composer)
    creator_books = []
    if is_own:
        creator_books = Content.query.filter(
            Content.creator_wiam_id == creator_id,
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at == None,
        ).order_by(Content.title).all()

    return render_template(
        'bulletin.html',
        creator=creator,
        profile=profile,
        pinned_posts=pinned,
        posts=posts_page,
        user_reactions=user_reactions,
        is_own=is_own,
        is_official=False,
        is_bulletin_follower=is_bulletin_follower,
        follower_count=follower_count,
        post_count=post_count,
        creator_books=creator_books,
    )


# ── Toggle Bulletin Follow ───────────────────────────────────────────

@bulletin_bp.route('/<int:creator_id>/follow', methods=['POST'])
@login_required
def toggle_bulletin_follow(creator_id):
    """Follow or unfollow a creator's Bulletin (AJAX)."""
    uid = current_user.wiam_id
    if uid == creator_id:
        return jsonify({'error': 'Cannot follow your own bulletin'}), 400

    # Block creator-to-creator bulletin follows
    if current_user.is_creator:
        target = User.query.filter_by(wiam_id=creator_id).first()
        if target and target.is_creator:
            return jsonify({'error': 'Creators cannot follow other creators\' bulletins'}), 400

    existing = BulletinFollow.query.filter_by(
        user_id=uid, creator_id=creator_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        following = False
    else:
        bf = BulletinFollow(user_id=uid, creator_id=creator_id)
        db.session.add(bf)
        db.session.commit()
        following = True

    count = BulletinFollow.query.filter_by(creator_id=creator_id).count()
    return jsonify({'following': following, 'count': count})


# ── Post: Creator creates a new bulletin post ────────────────────────

@bulletin_bp.route('/official/post', methods=['POST'])
@login_required
def create_official_post():
    """Create a post on the Wiam Official Bulletin. Founder only."""
    if not getattr(current_user, 'is_founder', False):
        abort(403)

    text = (request.form.get('text', '') or '').strip()
    if not text:
        flash('Write something to post.', 'error')
        return redirect(url_for('bulletin.official_feed'))

    post = BulletinPost(
        creator_id=OFFICIAL_BULLETIN_ID,
        type='text',
        text_content=text,
    )
    db.session.add(post)
    db.session.commit()

    log.info("Official bulletin post created: id=%d", post.id)
    flash('Posted to Wiam Official Bulletin!', 'success')
    return redirect(url_for('bulletin.official_feed'))


@bulletin_bp.route('/<int:creator_id>/post', methods=['POST'])
@login_required
def create_post(creator_id):
    """Create a new bulletin post. Only the creator can post."""
    uid = current_user.wiam_id
    if uid != creator_id or not current_user.is_creator:
        abort(403)

    # Follower gate: need 50+ followers to post
    fcount = Follow.query.filter_by(creator_id=uid).count()
    if fcount < MIN_FOLLOWERS_TO_POST:
        flash(f'You need at least {MIN_FOLLOWERS_TO_POST} followers to post on your Bulletin (currently {fcount}).', 'error')
        return redirect(url_for('bulletin.feed', creator_id=creator_id))

    text = (request.form.get('text', '') or '').strip()
    post_type = request.form.get('type', 'text')
    content_id = request.form.get('content_id', type=int)

    if post_type == 'book_share':
        if not content_id:
            flash('Select a story to share.', 'error')
            return redirect(url_for('bulletin.feed', creator_id=creator_id))
        book = Content.query.get(content_id)
        if not book or book.creator_wiam_id != creator_id:
            flash('You can only share your own stories.', 'error')
            return redirect(url_for('bulletin.feed', creator_id=creator_id))
    else:
        content_id = None
        if not text:
            flash('Write something to post.', 'error')
            return redirect(url_for('bulletin.feed', creator_id=creator_id))

    post = BulletinPost(
        creator_id=creator_id,
        type=post_type,
        text_content=text,
        content_id=content_id,
    )
    db.session.add(post)
    db.session.commit()

    log.info("Bulletin post created: id=%d creator=%d type=%s", post.id, creator_id, post_type)
    flash('Posted to your Bulletin!', 'success')
    return redirect(url_for('bulletin.feed', creator_id=creator_id))


# ── Book Share from Studio (after publish) ────────────────────────────

@bulletin_bp.route('/share-book', methods=['POST'])
@login_required
def share_book():
    """Share a book to bulletin — called from studio after publishing."""
    uid = current_user.wiam_id
    if not current_user.is_creator:
        abort(403)

    # Follower gate: need 50+ followers to post
    fcount = Follow.query.filter_by(creator_id=uid).count()
    if fcount < MIN_FOLLOWERS_TO_POST:
        return jsonify({'error': f'Need {MIN_FOLLOWERS_TO_POST}+ followers to post (currently {fcount})'}), 403

    content_id = request.form.get('content_id', type=int)
    text = (request.form.get('text', '') or '').strip()

    if not content_id:
        return jsonify({'error': 'No book specified'}), 400

    book = Content.query.get(content_id)
    if not book or book.creator_wiam_id != uid:
        return jsonify({'error': 'Not your book'}), 403

    existing = BulletinPost.query.filter_by(
        creator_id=uid, type='book_share', content_id=content_id, is_deleted=False
    ).order_by(BulletinPost.created_at.desc()).first()

    if existing:
        from datetime import timedelta
        if (datetime.utcnow() - existing.created_at).total_seconds() < 3600:
            return jsonify({'status': 'already_shared'}), 200

    default_text = text or f'Check out my story: "{book.title}"!'
    post = BulletinPost(
        creator_id=uid,
        type='book_share',
        text_content=default_text,
        content_id=content_id,
    )
    db.session.add(post)
    db.session.commit()

    log.info("Bulletin book share: post=%d book=%d creator=%d", post.id, content_id, uid)
    return jsonify({'status': 'shared', 'post_id': post.id}), 200


# ── React: Reader reacts to a post ───────────────────────────────────

@bulletin_bp.route('/react/<int:post_id>', methods=['POST'])
@login_required
def react(post_id):
    """Toggle an emoji reaction on a bulletin post."""
    uid = current_user.wiam_id
    post = BulletinPost.query.get_or_404(post_id)

    if post.is_deleted:
        return jsonify({'error': 'Post not found'}), 404

    data = request.get_json(silent=True) or {}
    emoji = (data.get('emoji', '') or '').strip()
    if not emoji or len(emoji) > 10:
        return jsonify({'error': 'Invalid emoji'}), 400

    existing = BulletinReaction.query.filter_by(
        post_id=post_id, user_id=uid, emoji=emoji
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        action = 'removed'
    else:
        reaction = BulletinReaction(post_id=post_id, user_id=uid, emoji=emoji)
        db.session.add(reaction)
        db.session.commit()
        action = 'added'

    summary = post.reactions_summary
    return jsonify({
        'action': action,
        'emoji': emoji,
        'reactions': summary,
        'total': post.total_reactions,
    })


# ── Pin/Unpin a post ─────────────────────────────────────────────────

@bulletin_bp.route('/pin/<int:post_id>', methods=['POST'])
@login_required
def toggle_pin(post_id):
    """Pin or unpin a bulletin post. Only the creator can do this."""
    uid = current_user.wiam_id
    post = BulletinPost.query.get_or_404(post_id)

    if post.creator_id != uid:
        abort(403)

    post.is_pinned = not post.is_pinned
    post.updated_at = datetime.utcnow()
    db.session.commit()

    action = 'pinned' if post.is_pinned else 'unpinned'
    flash(f'Post {action}.', 'success')
    return redirect(url_for('bulletin.feed', creator_id=uid))


# ── Delete a post ─────────────────────────────────────────────────────

@bulletin_bp.route('/delete/<int:post_id>', methods=['POST'])
@login_required
def delete_post(post_id):
    """Soft-delete a bulletin post. Only the creator can do this."""
    uid = current_user.wiam_id
    post = BulletinPost.query.get_or_404(post_id)

    if post.creator_id != uid:
        abort(403)

    post.is_deleted = True
    post.updated_at = datetime.utcnow()
    db.session.commit()

    flash('Post deleted.', 'success')
    return redirect(url_for('bulletin.feed', creator_id=uid))
