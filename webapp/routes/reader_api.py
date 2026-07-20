"""Reader Experience API — paragraph reactions, comments, threads."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import (
    ParagraphReaction, ParagraphComment, ParagraphCommentLike,
    ReaderPreferences, User,
)

reader_api = Blueprint('reader_api', __name__, url_prefix='/api/reader')

ALLOWED_EMOJIS = ['❤️', '😂', '😭', '😡', '😮', '🔥']


# ─── Paragraph Reactions ──────────────────────────────────────────────────────

@reader_api.route('/react', methods=['POST'])
@csrf.exempt
@login_required
def react():
    """Add/update/remove an emoji reaction on a paragraph."""
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter = data.get('chapter_number', 0)
    para = data.get('paragraph_index', 0)
    emoji = data.get('emoji', '')

    if emoji and emoji not in ALLOWED_EMOJIS:
        return jsonify(ok=False, error='Invalid emoji.'), 400

    uid = current_user.wiam_id
    existing = ParagraphReaction.query.filter_by(
        user_id=uid, content_id=content_id,
        chapter_number=chapter, paragraph_index=para
    ).first()

    if not emoji:
        # Remove reaction
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify(ok=True, removed=True)

    if existing:
        if existing.emoji == emoji:
            # Same emoji = toggle off
            db.session.delete(existing)
            db.session.commit()
            return jsonify(ok=True, removed=True)
        existing.emoji = emoji
        existing.updated_at = datetime.utcnow()
    else:
        r = ParagraphReaction(
            user_id=uid, content_id=content_id,
            chapter_number=chapter, paragraph_index=para,
            emoji=emoji,
        )
        db.session.add(r)

    db.session.commit()
    return jsonify(ok=True, emoji=emoji)


@reader_api.route('/reactions', methods=['GET'])
@login_required
def get_reactions():
    """Batch-fetch all reactions for a chapter (grouped by paragraph)."""
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)

    rows = ParagraphReaction.query.filter_by(
        content_id=content_id, chapter_number=chapter
    ).all()

    uid = current_user.wiam_id
    # Group: {para_index: {emoji: count, ...}, ...}
    paras = {}
    user_reactions = {}
    for r in rows:
        pi = r.paragraph_index
        if pi not in paras:
            paras[pi] = {}
        paras[pi][r.emoji] = paras[pi].get(r.emoji, 0) + 1
        if r.user_id == uid:
            user_reactions[pi] = r.emoji

    return jsonify(ok=True, reactions=paras, user_reactions=user_reactions)


# ─── Paragraph Comments ───────────────────────────────────────────────────────

@reader_api.route('/comment', methods=['POST'])
@csrf.exempt
@login_required
def add_comment():
    """Add a comment (or reply) on a paragraph."""
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter = data.get('chapter_number', 0)
    para = data.get('paragraph_index', 0)
    text = (data.get('text', '') or '').strip()[:200]
    parent_id = data.get('parent_id')

    if not text:
        return jsonify(ok=False, error='Comment cannot be empty.'), 400
    if len(text) < 1:
        return jsonify(ok=False, error='Comment too short.'), 400

    uid = current_user.wiam_id

    # ── Rate Guard (comment spam) ──
    from ..services.rate_guard import check_rate
    allowed, rate_msg = check_rate(current_user.id, 'comment')
    if not allowed:
        return jsonify(ok=False, error=rate_msg), 429

    # ── Fake Engagement Filter (S13) ──
    from ..services.trust_engine import is_suspicious_comment
    sus, sus_reason = is_suspicious_comment(current_user.id, text)
    if sus:
        return jsonify(ok=False, error='Please write a more meaningful comment.'), 400

    # ── Content Guard scan ──
    from ..services.content_guard import scan_content, is_user_banned
    if is_user_banned(current_user.id):
        return jsonify(ok=False, error='Your account has been suspended.'), 403
    verdict = scan_content(current_user.id, text, 'comment')
    if not verdict.allowed:
        return jsonify(ok=False, error=verdict.reason), 400

    c = ParagraphComment(
        parent_id=parent_id if parent_id else None,
        user_id=uid, content_id=content_id,
        chapter_number=chapter, paragraph_index=para,
        text=text,
    )
    db.session.add(c)
    db.session.commit()

    user = current_user
    return jsonify(ok=True, comment={
        'id': c.id,
        'text': c.text,
        'user_name': user.display_name,
        'user_initial': (user.display_name or 'U')[0].upper(),
        'created_at': c.created_at.strftime('%b %d, %H:%M') if c.created_at else '',
        'like_count': 0,
        'liked': False,
        'is_own': True,
        'parent_id': c.parent_id,
        'replies': [],
    })


@reader_api.route('/comments', methods=['GET'])
@login_required
def get_comments():
    """Get all comments for a paragraph (top-level + replies)."""
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)
    para = request.args.get('paragraph_index', 0, type=int)
    sort = request.args.get('sort', 'newest')

    uid = current_user.wiam_id

    q = ParagraphComment.query.filter_by(
        content_id=content_id, chapter_number=chapter,
        paragraph_index=para, parent_id=None, is_deleted=False,
    )
    if sort == 'top':
        q = q.order_by(ParagraphComment.like_count.desc(), ParagraphComment.created_at.desc())
    else:
        q = q.order_by(ParagraphComment.created_at.desc())

    comments = q.limit(50).all()

    # Get user's likes
    all_ids = [c.id for c in comments]
    for c in comments:
        all_ids.extend([r.id for r in c.replies])
    liked_ids = set()
    if all_ids:
        liked = ParagraphCommentLike.query.filter(
            ParagraphCommentLike.comment_id.in_(all_ids),
            ParagraphCommentLike.user_id == uid,
        ).all()
        liked_ids = {lk.comment_id for lk in liked}

    def fmt(c):
        u = c.user
        return {
            'id': c.id,
            'text': c.text,
            'user_name': u.display_name if u else 'User',
            'user_initial': (u.display_name if u else 'U')[0].upper(),
            'created_at': c.created_at.strftime('%b %d, %H:%M') if c.created_at else '',
            'like_count': c.like_count,
            'liked': c.id in liked_ids,
            'is_own': c.user_id == uid,
            'parent_id': c.parent_id,
            'replies': [fmt(r) for r in c.replies],
        }

    return jsonify(ok=True, comments=[fmt(c) for c in comments])


@reader_api.route('/comment-counts', methods=['GET'])
@login_required
def comment_counts():
    """Batch-fetch comment counts per paragraph for a chapter."""
    content_id = request.args.get('content_id', 0, type=int)
    chapter = request.args.get('chapter_number', 0, type=int)

    from sqlalchemy import func
    rows = db.session.query(
        ParagraphComment.paragraph_index,
        func.count(ParagraphComment.id)
    ).filter_by(
        content_id=content_id, chapter_number=chapter, is_deleted=False,
    ).group_by(ParagraphComment.paragraph_index).all()

    counts = {pi: cnt for pi, cnt in rows}
    return jsonify(ok=True, counts=counts)


@reader_api.route('/comment/<int:comment_id>/like', methods=['POST'])
@csrf.exempt
@login_required
def like_comment(comment_id):
    """Toggle like on a paragraph comment."""
    uid = current_user.wiam_id
    c = ParagraphComment.query.get_or_404(comment_id)

    existing = ParagraphCommentLike.query.filter_by(
        comment_id=comment_id, user_id=uid
    ).first()

    if existing:
        db.session.delete(existing)
        c.like_count = max(0, (c.like_count or 0) - 1)
        liked = False
    else:
        db.session.add(ParagraphCommentLike(comment_id=comment_id, user_id=uid))
        c.like_count = (c.like_count or 0) + 1
        liked = True

    db.session.commit()
    return jsonify(ok=True, liked=liked, count=c.like_count)


@reader_api.route('/comment/<int:comment_id>/delete', methods=['POST'])
@csrf.exempt
@login_required
def delete_comment(comment_id):
    """Soft-delete a comment (own or admin)."""
    c = ParagraphComment.query.get_or_404(comment_id)
    uid = current_user.wiam_id

    if c.user_id != uid and not current_user.is_admin and not current_user.is_founder:
        return jsonify(ok=False, error='Not allowed.'), 403

    c.is_deleted = True
    c.text = '[deleted]'
    db.session.commit()
    return jsonify(ok=True)


# ─── Reader Preferences (extended) ───────────────────────────────────────────

@reader_api.route('/pref', methods=['POST'])
@csrf.exempt
@login_required
def save_pref():
    """Save reader preferences (theme, font_size, font_family, line_spacing)."""
    data = request.get_json(silent=True) or {}
    uid = current_user.wiam_id

    prefs = ReaderPreferences.query.filter_by(user_id=uid).first()
    if not prefs:
        prefs = ReaderPreferences(user_id=uid)
        db.session.add(prefs)

    for key in ('theme', 'font_size', 'font_family', 'line_spacing'):
        if key in data:
            setattr(prefs, key, data[key])
    prefs.updated_at = datetime.utcnow()

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        # Race condition: another request already inserted — fetch and update
        prefs = ReaderPreferences.query.filter_by(user_id=uid).first()
        if prefs:
            for key in ('theme', 'font_size', 'font_family', 'line_spacing'):
                if key in data:
                    setattr(prefs, key, data[key])
            prefs.updated_at = datetime.utcnow()
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
    return jsonify(ok=True)


# ─── Reading Position Tracking ────────────────────────────────────────────────

@reader_api.route('/save-position', methods=['POST'])
@csrf.exempt
@login_required
def save_position():
    """Save the reader's exact scroll position (0-100%) for a chapter."""
    from ..models import ReadingProgress
    data = request.get_json(silent=True) or {}
    content_id = data.get('content_id', 0)
    chapter_number = data.get('chapter_number', 0)
    position = data.get('position', 0)

    if not content_id or not chapter_number:
        return jsonify(ok=False), 400

    uid = current_user.wiam_id
    progress = ReadingProgress.query.filter_by(
        user_id=uid, content_id=content_id
    ).first()

    if progress:
        progress.current_chapter = chapter_number
        progress.current_position = min(100, max(0, int(position)))
        progress.last_read_at = datetime.utcnow()
    else:
        progress = ReadingProgress(
            user_id=uid,
            content_id=content_id,
            current_chapter=chapter_number,
            current_position=min(100, max(0, int(position))),
        )
        db.session.add(progress)

    db.session.commit()
    return jsonify(ok=True)
