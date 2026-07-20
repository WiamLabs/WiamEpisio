from flask import Blueprint, render_template, redirect, url_for, request, jsonify, session
from flask_login import login_required, current_user
from sqlalchemy import func
from ..models import (
    Content, Favorite, Access, Rating, Review, ReviewLike, User, CreatorProfile,
    WebBookContent, ReadingProgress, ReaderPreferences, ShareEvent,
    ChapterUnlock, CoinBalance, EliteStory,
    ChapterComment, ChapterCommentLike, ChapterLike, ChapterVote,
    ParagraphComment, ParagraphCommentLike,
    Follow, UserLibrary,
)
from ..extensions import db, csrf, limiter
from datetime import datetime, date
import time as _time

book_bp = Blueprint('book', __name__)

# Per-book rating stats cache — {book_id: {'ts': float, 'count': int, 'avg': float}}
_rating_stats_cache = {}
_RATING_STATS_TTL = 120  # seconds


@book_bp.route('/<int:book_id>')
def detail(book_id):
    book = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at == None,
    ).first_or_404()

    # Views are now tracked via time-based /record-view endpoint (not on page load)

    user_rating = None
    reading_progress = None
    in_library = False
    user_liked_reviews = set()
    coin_balance = 0
    is_following = False

    if current_user.is_authenticated:
        uid = current_user.wiam_id
        ur = Rating.query.filter_by(user_id=uid, content_id=book_id).first()
        user_rating = ur.rating if ur else None
        reading_progress = ReadingProgress.query.filter_by(user_id=uid, content_id=book_id).first()
        in_library = UserLibrary.query.filter_by(user_id=uid, content_id=book_id).first() is not None
        bal = CoinBalance.query.get(current_user.id) or CoinBalance.query.filter_by(user_id=uid).first()
        coin_balance = bal.balance if bal else 0

    # Book rating stats (cached 120s per book)
    now = _time.time()
    _rs = _rating_stats_cache.get(book_id)
    if _rs and now - _rs['ts'] < _RATING_STATS_TTL:
        rating_count = _rs['count']
        avg_rating = _rs['avg']
    else:
        rating_result = db.session.query(
            func.count(Rating.id),
            func.coalesce(func.avg(Rating.rating), 0)
        ).filter(Rating.content_id == book_id).first()
        rating_count = rating_result[0] or 0
        avg_rating = round(float(rating_result[1] or 0), 1)
        _rating_stats_cache[book_id] = {'ts': now, 'count': rating_count, 'avg': avg_rating}

    # Reviews (last 20)
    reviews_raw = db.session.query(Review, User).join(
        User, Review.user_id == User.wiam_id
    ).filter(
        Review.content_id == book_id
    ).order_by(Review.created_at.desc()).limit(20).all()

    if current_user.is_authenticated:
        review_ids = [r.id for r, _ in reviews_raw]
        if review_ids:
            liked = ReviewLike.query.filter(
                ReviewLike.review_id.in_(review_ids),
                ReviewLike.user_id == current_user.wiam_id,
            ).all()
            user_liked_reviews = {lk.review_id for lk in liked}

    # Creator profile
    creator = book.creator
    creator_profile = None
    if creator:
        creator_profile = CreatorProfile.query.filter_by(wiam_id=creator.wiam_id).first()

    # Similar books (same genre, excluding this one)
    similar_books = []
    if book.genre:
        similar_books = Content.query.filter(
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at == None,
            Content.genre == book.genre,
            Content.id != book.id,
        ).order_by(Content.views.desc()).limit(6).all()

    # Chapters list — only published chapters on public pages
    all_chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    is_creator = current_user.is_authenticated and book.creator_wiam_id == current_user.wiam_id
    chapters = [ch for ch in all_chapters if ch.status == 'published']
    total_words = sum(ch.word_count or 0 for ch in chapters)
    reading_time_min = max(1, round(total_words / 200)) if total_words else 0
    chapter_count = len(chapters)

    # WiamElite status
    is_elite = EliteStory.query.filter_by(content_id=book_id, is_active=True).first() is not None

    # Follow status + sticker data
    follower_count = 0
    if creator:
        follower_count = Follow.query.filter_by(creator_id=creator.id).count()
        if current_user.is_authenticated and creator.id != current_user.id:
            is_following = Follow.query.filter_by(
                user_id=current_user.id, creator_id=creator.id
            ).first() is not None

    from .gift import STICKER_CATALOG
    from ..models import StickerGift
    sticker_total = StickerGift.query.filter_by(content_id=book_id).count()

    return render_template(
        'book_detail.html',
        book=book,
        creator=creator,
        creator_profile=creator_profile,
        
        user_rating=user_rating,
        avg_rating=avg_rating,
        rating_count=rating_count,
        reviews=reviews_raw,
        user_liked_reviews=user_liked_reviews,
        similar_books=similar_books,
        reading_time_min=reading_time_min,
        chapter_count=chapter_count,
        total_words=total_words,
        chapters=chapters,
        reading_progress=reading_progress,
        is_elite=is_elite,
        is_following=is_following,
        follower_count=follower_count,
        sticker_catalog=STICKER_CATALOG,
        coin_balance=coin_balance,
        sticker_total=sticker_total,
        in_library=in_library,
    )


@book_bp.route('/<int:book_id>/rate', methods=['POST'])
@login_required
def rate_book(book_id):
    """Submit or update a star rating (1-5)."""
    rating_val = request.form.get('rating', type=int)
    if not rating_val or rating_val < 1 or rating_val > 5:
        return jsonify({'error': 'Invalid rating'}), 400

    # ── Rate Guard (rating spam) ──
    from ..services.rate_guard import check_rate
    allowed, rate_msg = check_rate(current_user.id, 'rating')
    if not allowed:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': rate_msg}), 429
        flash(rate_msg, 'error')
        return redirect(url_for('book.detail', book_id=book_id))

    # ── Fake Engagement Filter (S13) ──
    from ..services.trust_engine import is_suspicious_rating
    suspicious, sus_reason = is_suspicious_rating(current_user.id, book_id)
    if suspicious:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Please wait before rating more stories.'}), 429
        flash('Please wait before rating more stories.', 'warning')
        return redirect(url_for('book.detail', book_id=book_id))

    existing = Rating.query.filter_by(
        user_id=current_user.wiam_id, content_id=book_id
    ).first()
    if existing:
        existing.rating = rating_val
    else:
        db.session.add(Rating(
            user_id=current_user.wiam_id,
            content_id=book_id,
            rating=rating_val
        ))
    db.session.commit()

    # Return updated stats
    result = db.session.query(
        func.count(Rating.id),
        func.coalesce(func.avg(Rating.rating), 0)
    ).filter(Rating.content_id == book_id).first()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'avg': round(float(result[1] or 0), 1),
            'count': result[0] or 0,
            'user_rating': rating_val
        })
    return redirect(url_for('book.detail', book_id=book_id))


@book_bp.route('/<int:book_id>/review', methods=['POST'])
@login_required
def submit_review(book_id):
    """Submit a written review."""
    text = request.form.get('text', '').strip()
    if not text or len(text) < 10:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Review must be at least 10 characters'}), 400
        return redirect(url_for('book.detail', book_id=book_id))

    # One review per user per book
    existing = Review.query.filter_by(
        user_id=current_user.wiam_id, content_id=book_id
    ).first()
    if existing:
        existing.text = text
    else:
        db.session.add(Review(
            user_id=current_user.wiam_id,
            content_id=book_id,
            text=text
        ))
    db.session.commit()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True})
    return redirect(url_for('book.detail', book_id=book_id))


@book_bp.route('/<int:book_id>/review/<int:review_id>/delete', methods=['POST'])
@login_required
def delete_review(book_id, review_id):
    """Delete a review. Allowed for: review author, book creator, admin/founder."""
    review = Review.query.filter_by(id=review_id, content_id=book_id).first_or_404()
    book = Content.query.get_or_404(book_id)
    is_author = review.user_id == current_user.wiam_id
    is_book_creator = book.creator_wiam_id == current_user.wiam_id
    is_admin = current_user.is_admin
    if not (is_author or is_book_creator or is_admin):
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Not allowed'}), 403
        return redirect(url_for('book.detail', book_id=book_id))
    ReviewLike.query.filter_by(review_id=review_id).delete()
    db.session.delete(review)
    db.session.commit()
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'deleted': True})
    return redirect(url_for('book.detail', book_id=book_id))


@book_bp.route('/<int:book_id>/review/<int:review_id>/like', methods=['POST'])
@login_required
def toggle_review_like(book_id, review_id):
    """Toggle like on a review."""
    review = Review.query.filter_by(id=review_id, content_id=book_id).first_or_404()
    existing = ReviewLike.query.filter_by(review_id=review_id, user_id=current_user.wiam_id).first()
    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(ReviewLike(review_id=review_id, user_id=current_user.wiam_id))
        liked = True
    db.session.commit()
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'liked': liked, 'count': review.like_count})
    return redirect(url_for('book.detail', book_id=book_id))


@book_bp.route('/<int:book_id>/record-view', methods=['POST'])
@csrf.exempt
@limiter.limit("10 per minute")
@login_required
def record_view(book_id):
    """Time-based view counting — only counts after reader spends 30+ seconds reading."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at == None,
    ).first_or_404()

    _is_own = current_user.wiam_id == book.creator_wiam_id
    _view_key = f'tview_{book_id}_{date.today().isoformat()}'
    if not _is_own and _view_key not in session:
        book.views = (book.views or 0) + 1
        session[_view_key] = 1
        try:
            from ..services.analytics import track
            track('book_view', current_user, content_id=book_id, source='web_reader')
        except Exception:
            pass
        db.session.commit()
        return jsonify({'counted': True})
    return jsonify({'counted': False})


@book_bp.route('/<int:book_id>/read')
@limiter.limit("60 per minute")
@login_required
def read_book(book_id):
    """Premium web book reader for web-written books, PDF fallback for legacy."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at == None,
    ).first_or_404()

    # Views are now tracked via time-based /record-view endpoint (not on page load)

    # All stories are free to read (locked chapters handled in Phase 3)
    has_access = True

    # Check for web-written chapters
    is_creator = (book.creator_wiam_id == current_user.wiam_id)
    all_chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    # Only published chapters on public pages (creators use Studio Preview for drafts)
    chapters = [ch for ch in all_chapters if ch.status == 'published']

    if chapters:
        # Web reader
        ch_num = request.args.get('ch', 1, type=int)
        current_chapter = None
        for ch in chapters:
            if ch.chapter_number == ch_num:
                current_chapter = ch
                break
        if not current_chapter:
            current_chapter = chapters[0]

        # Check if current chapter is locked and user hasn't unlocked it
        chapter_locked = False
        premium_chapter_locked = False
        if not is_creator:
            unlocked = ChapterUnlock.query.filter(
                ChapterUnlock.content_id == book_id,
                ChapterUnlock.chapter_number == current_chapter.chapter_number,
                db.or_(ChapterUnlock.user_id == current_user.id,
                       ChapterUnlock.user_id == current_user.wiam_id),
            ).first()
            if not unlocked:
                if current_chapter.is_premium_locked:
                    from ..services.premium_service import is_premium_active
                    from ..models import PlatformConfig
                    cfg = PlatformConfig.get()
                    if cfg.ff_premium_enabled:
                        chapter_locked = True
                        premium_chapter_locked = True
                elif current_chapter.is_locked and current_chapter.chapter_price:
                    chapter_locked = True

        # Get user's coin balance for unlock UI (check both id and wiam_id)
        user_coin_bal = CoinBalance.query.get(current_user.id) or CoinBalance.query.get(current_user.wiam_id)
        coin_balance = user_coin_bal.balance if user_coin_bal else 0

        # Build set of unlocked chapter numbers for TOC display
        unlocked_chapters = set()
        if not is_creator:
            unlocks = ChapterUnlock.query.filter(
                ChapterUnlock.content_id == book_id,
                db.or_(ChapterUnlock.user_id == current_user.id,
                       ChapterUnlock.user_id == current_user.wiam_id),
            ).all()
            unlocked_chapters = {u.chapter_number for u in unlocks}

        # Load/update reading progress
        progress = ReadingProgress.query.filter_by(
            user_id=current_user.wiam_id, content_id=book_id
        ).first()
        if progress:
            progress.current_chapter = current_chapter.chapter_number
            progress.total_chapters = len(chapters)
            progress.last_read_at = datetime.utcnow()
        else:
            progress = ReadingProgress(
                user_id=current_user.wiam_id,
                content_id=book_id,
                current_chapter=current_chapter.chapter_number,
                total_chapters=len(chapters),
            )
            db.session.add(progress)
        db.session.commit()

        # Reader preferences
        prefs = ReaderPreferences.query.filter_by(
            user_id=current_user.wiam_id
        ).first()

        # Follow status for creator prompt
        creator = book.creator
        creator_profile = None
        is_following_creator = False
        if creator and creator.id != current_user.id:
            creator_profile = CreatorProfile.query.filter_by(wiam_id=creator.wiam_id).first()
            is_following_creator = Follow.query.filter_by(
                user_id=current_user.id, creator_id=creator.id
            ).first() is not None

        # Chapter interactions
        uid = current_user.wiam_id
        ch_n = current_chapter.chapter_number
        chapter_liked = ChapterLike.query.filter_by(
            user_id=uid, content_id=book_id, chapter_number=ch_n
        ).first() is not None
        chapter_like_count = ChapterLike.query.filter_by(
            content_id=book_id, chapter_number=ch_n
        ).count()
        user_vote_obj = ChapterVote.query.filter_by(
            user_id=uid, content_id=book_id, chapter_number=ch_n
        ).first()
        user_vote = user_vote_obj.value if user_vote_obj else 0
        vote_ups = ChapterVote.query.filter_by(content_id=book_id, chapter_number=ch_n, value=1).count()
        vote_downs = ChapterVote.query.filter_by(content_id=book_id, chapter_number=ch_n, value=-1).count()
        comment_count = ChapterComment.query.filter_by(
            content_id=book_id, chapter_number=ch_n, is_deleted=False
        ).count()

        return render_template('web_reader.html',
            book=book,
            chapters=chapters,
            current_chapter=current_chapter,
            progress=progress,
            prefs=prefs,
            has_access=has_access,
            chapter_locked=chapter_locked,
            premium_chapter_locked=premium_chapter_locked,
            coin_balance=coin_balance,
            unlocked_chapters=unlocked_chapters,
            chapter_liked=chapter_liked,
            chapter_like_count=chapter_like_count,
            user_vote=user_vote,
            vote_ups=vote_ups,
            vote_downs=vote_downs,
            comment_count=comment_count,
            creator=creator,
            creator_profile=creator_profile,
            is_following_creator=is_following_creator,
        )
    else:
        # No chapters available — redirect back to book detail
        flash('This story doesn\'t have any chapters yet. Check back soon!', 'info')
        return redirect(url_for('book.detail', book_id=book_id))


@book_bp.route('/<int:book_id>/download')
@login_required
def download_pdf(book_id):
    """Generate and serve a PDF of a web-written book for buyers with permanent access."""
    import io
    import re
    from html import unescape
    from flask import send_file, abort

    book = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at == None,
    ).first_or_404()

    # Check access — must be permanent (not rental)
    access = Access.query.filter_by(
        user_id=current_user.wiam_id, content_id=book_id, status='active'
    ).first()

    if not access:
        flash('You need access to download this book.', 'error')
        return redirect(url_for('book.detail', book_id=book_id))

    if access.access_type == 'temporary':
        flash('Downloads are only available with permanent access.', 'info')
        return redirect(url_for('book.read_book', book_id=book_id))

    if book.allow_download is False:
        flash('Downloads are disabled for this book.', 'info')
        return redirect(url_for('book.read_book', book_id=book_id))

    # Get chapters
    chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    if not chapters:
        # Legacy PDF book — no web content to generate
        flash('This book does not have downloadable web content.', 'info')
        return redirect(url_for('book.read_book', book_id=book_id))

    # Generate PDF with reportlab
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
    from reportlab.lib.enums import TA_CENTER

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('BookTitle', parent=styles['Title'],
        fontSize=24, spaceAfter=12, alignment=TA_CENTER)
    author_style = ParagraphStyle('BookAuthor', parent=styles['Normal'],
        fontSize=14, spaceAfter=30, alignment=TA_CENTER, textColor='#888888')
    ch_title_style = ParagraphStyle('ChTitle', parent=styles['Heading1'],
        fontSize=16, spaceBefore=20, spaceAfter=12)
    body_style = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=11, leading=16, spaceAfter=8)

    def strip_html(html_str):
        """Convert HTML to reportlab-safe text with basic formatting."""
        if not html_str:
            return ''
        text = html_str
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'</p>', '\n\n', text)
        text = re.sub(r'<p[^>]*>', '', text)
        text = re.sub(r'<strong>(.*?)</strong>', r'<b>\1</b>', text)
        text = re.sub(r'<em>(.*?)</em>', r'<i>\1</i>', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = unescape(text)
        return text.strip()

    story = []
    story.append(Paragraph(book.title or 'Untitled', title_style))
    story.append(Paragraph(book.author or '', author_style))
    story.append(Spacer(1, 30))

    for ch in chapters:
        if ch.chapter_number > 1:
            story.append(PageBreak())
        ch_label = ch.title or f'Chapter {ch.chapter_number}'
        story.append(Paragraph(ch_label, ch_title_style))

        text = strip_html(ch.body)
        for para in text.split('\n\n'):
            para = para.strip()
            if para:
                story.append(Paragraph(para.replace('\n', '<br/>'), body_style))

    doc.build(story)
    buf.seek(0)

    safe_title = re.sub(r'[^\w\s-]', '', book.title or 'book').strip().replace(' ', '_')
    return send_file(buf, mimetype='application/pdf',
        as_attachment=True,
        download_name=f'{safe_title}.pdf')


@book_bp.route('/<int:book_id>/track-share', methods=['POST'])
@login_required
def track_share(book_id):
    """Record a share event for trending score calculation."""
    book = Content.query.get_or_404(book_id)
    platform = request.form.get('platform', request.json.get('platform', 'unknown') if request.is_json else 'unknown')
    event = ShareEvent(
        user_id=current_user.wiam_id,
        content_id=book.id,
        platform=platform,
    )
    db.session.add(event)
    try:
        from ..services.analytics import track
        track('share', current_user, content_id=book.id, platform=str(platform)[:40])
    except Exception:
        pass
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Content Report (Phase 4)
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/report', methods=['POST'])
@login_required
def report_content(book_id):
    """Submit a report on a story or chapter."""
    from ..services.moderation import process_report

    book = Content.query.get_or_404(book_id)
    chapter_number = request.form.get('chapter_number', type=int)
    reason = request.form.get('reason', 'other')
    details = request.form.get('details', '')

    valid_reasons = ['inappropriate', 'plagiarism', 'spam', 'hate', 'other']
    if reason not in valid_reasons:
        reason = 'other'

    report, message = process_report(
        reporter_id=current_user.wiam_id,
        content_id=book_id,
        chapter_number=chapter_number,
        reason=reason,
        details=details,
    )

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'ok': True, 'message': message})

    flash(message, 'info')
    if chapter_number:
        return redirect(url_for('book.read_book', book_id=book_id, ch=chapter_number))
    return redirect(url_for('book.detail', book_id=book_id))


# ---------------------------------------------------------------------------
# Chapter Interactions: Like, Vote, Comment
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/chapter/<int:ch_num>/like', methods=['POST'])
@csrf.exempt
@login_required
def toggle_chapter_like(book_id, ch_num):
    """Toggle like on a chapter."""
    uid = current_user.wiam_id
    existing = ChapterLike.query.filter_by(
        user_id=uid, content_id=book_id, chapter_number=ch_num
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        liked = False
    else:
        db.session.add(ChapterLike(user_id=uid, content_id=book_id, chapter_number=ch_num))
        db.session.commit()
        liked = True
        # Notify creator of the like
        try:
            book = Content.query.get(book_id)
            if book and book.creator_wiam_id != uid:
                from ..services.notifications import notify_like
                notify_like(book.creator_wiam_id, current_user.display_name,
                            book.title, book_id, ch_num)
        except Exception:
            pass
    count = ChapterLike.query.filter_by(content_id=book_id, chapter_number=ch_num).count()
    return jsonify({'liked': liked, 'count': count})


@book_bp.route('/<int:book_id>/chapter/<int:ch_num>/vote', methods=['POST'])
@csrf.exempt
@login_required
def toggle_chapter_vote(book_id, ch_num):
    """Upvote or downvote a chapter. value=1 or value=-1."""
    uid = current_user.wiam_id
    data = request.get_json(silent=True) or {}
    value = data.get('value', 1)
    if value not in (1, -1):
        value = 1
    existing = ChapterVote.query.filter_by(
        user_id=uid, content_id=book_id, chapter_number=ch_num
    ).first()
    if existing:
        if existing.value == value:
            db.session.delete(existing)
            db.session.commit()
            user_vote = 0
        else:
            existing.value = value
            db.session.commit()
            user_vote = value
    else:
        db.session.add(ChapterVote(user_id=uid, content_id=book_id, chapter_number=ch_num, value=value))
        db.session.commit()
        user_vote = value
    ups = ChapterVote.query.filter_by(content_id=book_id, chapter_number=ch_num, value=1).count()
    downs = ChapterVote.query.filter_by(content_id=book_id, chapter_number=ch_num, value=-1).count()
    return jsonify({'user_vote': user_vote, 'ups': ups, 'downs': downs, 'score': ups - downs})


@book_bp.route('/<int:book_id>/chapter/<int:ch_num>/comments', methods=['GET'])
@login_required
def get_chapter_comments(book_id, ch_num):
    """Fetch comments for a chapter (AJAX)."""
    uid = current_user.wiam_id
    comments = ChapterComment.query.filter_by(
        content_id=book_id, chapter_number=ch_num, is_deleted=False
    ).order_by(ChapterComment.created_at.desc()).limit(50).all()

    comment_ids = [c.id for c in comments]
    user_liked = set()
    if comment_ids:
        liked = ChapterCommentLike.query.filter(
            ChapterCommentLike.comment_id.in_(comment_ids),
            ChapterCommentLike.user_id == uid,
        ).all()
        user_liked = {lk.comment_id for lk in liked}

    result = []
    for c in comments:
        u = c.user
        result.append({
            'id': c.id,
            'text': c.text,
            'user_name': u.display_name if u else 'Unknown',
            'user_id': c.user_id,
            'created_at': c.created_at.strftime('%b %d, %Y %I:%M %p'),
            'like_count': c.like_count,
            'user_liked': c.id in user_liked,
            'is_own': c.user_id == uid,
        })
    return jsonify({'comments': result, 'count': len(result)})


@book_bp.route('/<int:book_id>/chapter/<int:ch_num>/comment', methods=['POST'])
@csrf.exempt
@login_required
def add_chapter_comment(book_id, ch_num):
    """Add a comment to a chapter."""
    uid = current_user.wiam_id
    data = request.get_json(silent=True) or {}
    text = (data.get('text', '') or '').strip()
    if not text or len(text) > 1000:
        return jsonify({'error': 'Comment must be 1-1000 characters'}), 400
    comment = ChapterComment(
        user_id=uid, content_id=book_id, chapter_number=ch_num, text=text
    )
    db.session.add(comment)
    db.session.commit()
    # Notify creator of the comment
    try:
        book = Content.query.get(book_id)
        if book and book.creator_wiam_id != uid:
            from ..services.notifications import notify_comment
            notify_comment(book.creator_wiam_id, current_user.display_name,
                           book.title, book_id, ch_num)
    except Exception:
        pass
    u = current_user
    return jsonify({
        'id': comment.id,
        'text': comment.text,
        'user_name': u.display_name,
        'user_id': uid,
        'created_at': comment.created_at.strftime('%b %d, %Y %I:%M %p'),
        'like_count': 0,
        'user_liked': False,
        'is_own': True,
    })


@book_bp.route('/comment/<int:comment_id>/like', methods=['POST'])
@csrf.exempt
@login_required
def toggle_comment_like(comment_id):
    """Toggle like on a chapter comment."""
    uid = current_user.wiam_id
    existing = ChapterCommentLike.query.filter_by(
        comment_id=comment_id, user_id=uid
    ).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        liked = False
    else:
        db.session.add(ChapterCommentLike(comment_id=comment_id, user_id=uid))
        db.session.commit()
        liked = True
    count = ChapterCommentLike.query.filter_by(comment_id=comment_id).count()
    return jsonify({'liked': liked, 'count': count})


@book_bp.route('/comment/<int:comment_id>/delete', methods=['POST'])
@csrf.exempt
@login_required
def delete_chapter_comment(comment_id):
    """Soft-delete a chapter comment (own or book creator)."""
    uid = current_user.wiam_id
    comment = ChapterComment.query.get_or_404(comment_id)
    book = Content.query.get(comment.content_id)
    if comment.user_id != uid and (not book or book.creator_wiam_id != uid):
        return jsonify({'error': 'Not authorized'}), 403
    comment.is_deleted = True
    db.session.commit()
    return jsonify({'ok': True})


# ---------------------------------------------------------------------------
# Paragraph Comments Page (standalone page, not overlay)
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/read/<int:ch_num>/paragraph/<int:para_idx>/comments')
@login_required
def paragraph_comments(book_id, ch_num, para_idx):
    """Dedicated page for paragraph-level comments."""
    book = Content.query.filter(Content.id == book_id, Content.deleted_at == None).first_or_404()
    chapter = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first_or_404()
    uid = current_user.wiam_id

    comments = ParagraphComment.query.filter_by(
        content_id=book_id, chapter_number=ch_num,
        paragraph_index=para_idx, parent_id=None, is_deleted=False,
    ).order_by(ParagraphComment.created_at.desc()).limit(100).all()

    # Gather liked IDs
    all_ids = [c.id for c in comments]
    for c in comments:
        if hasattr(c, 'replies'):
            all_ids.extend([r.id for r in c.replies if not r.is_deleted])
    liked_ids = set()
    if all_ids:
        liked = ParagraphCommentLike.query.filter(
            ParagraphCommentLike.comment_id.in_(all_ids),
            ParagraphCommentLike.user_id == uid,
        ).all()
        liked_ids = {lk.comment_id for lk in liked}

    # Resolve user names
    user_ids = set()
    for c in comments:
        user_ids.add(c.user_id)
        if hasattr(c, 'replies'):
            for r in c.replies:
                user_ids.add(r.user_id)
    users_map = {}
    if user_ids:
        for u in User.query.filter(User.wiam_id.in_(list(user_ids))).all():
            users_map[u.wiam_id] = u

    # Get reader's saved theme preference
    reader_theme = 'dark'
    prefs = ReaderPreferences.query.filter_by(user_id=uid).first()
    if prefs and prefs.theme:
        reader_theme = prefs.theme

    return render_template('paragraph_comments.html',
        book=book, chapter=chapter, para_idx=para_idx,
        comments=comments, liked_ids=liked_ids, users_map=users_map,
        reader_theme=reader_theme,
    )


# ---------------------------------------------------------------------------
# Chapter Comments Page (standalone page)
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/read/<int:ch_num>/comments')
@login_required
def chapter_comments_page(book_id, ch_num):
    """Dedicated page for chapter-level comments."""
    book = Content.query.filter(Content.id == book_id, Content.deleted_at == None).first_or_404()
    chapter = WebBookContent.query.filter_by(content_id=book_id, chapter_number=ch_num).first_or_404()
    uid = current_user.wiam_id

    comments = ChapterComment.query.filter_by(
        content_id=book_id, chapter_number=ch_num, is_deleted=False,
    ).order_by(ChapterComment.created_at.desc()).limit(200).all()

    # Gather liked IDs
    all_ids = [c.id for c in comments]
    liked_ids = set()
    if all_ids:
        liked = ChapterCommentLike.query.filter(
            ChapterCommentLike.comment_id.in_(all_ids),
            ChapterCommentLike.user_id == uid,
        ).all()
        liked_ids = {lk.comment_id for lk in liked}

    # Resolve user names
    user_ids = set(c.user_id for c in comments)
    users_map = {}
    if user_ids:
        for u in User.query.filter(User.wiam_id.in_(list(user_ids))).all():
            users_map[u.wiam_id] = u

    # Get reader's saved theme preference
    reader_theme = 'dark'
    prefs = ReaderPreferences.query.filter_by(user_id=uid).first()
    if prefs and prefs.theme:
        reader_theme = prefs.theme

    return render_template('chapter_comments.html',
        book=book, chapter=chapter,
        comments=comments, liked_ids=liked_ids, users_map=users_map,
        reader_theme=reader_theme,
    )


# ---------------------------------------------------------------------------
# Book Comments Page (reviews as comments, standalone page)
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/comments')
@login_required
def book_comments(book_id):
    """Dedicated page for book-level comments (reviews)."""
    book = Content.query.filter(Content.id == book_id, Content.deleted_at == None).first_or_404()
    uid = current_user.wiam_id

    reviews_raw = db.session.query(Review, User).join(
        User, Review.user_id == User.wiam_id
    ).filter(
        Review.content_id == book_id
    ).order_by(Review.created_at.desc()).limit(100).all()

    user_liked_reviews = set()
    if reviews_raw:
        review_ids = [r.id for r, _ in reviews_raw]
        if review_ids:
            liked = ReviewLike.query.filter(
                ReviewLike.review_id.in_(review_ids),
                ReviewLike.user_id == uid,
            ).all()
            user_liked_reviews = {lk.review_id for lk in liked}

    return render_template('book_comments.html',
        book=book,
        reviews=reviews_raw,
        user_liked_reviews=user_liked_reviews,
    )


# ---------------------------------------------------------------------------
# Gift Stickers Page (standalone page instead of overlay)
# ---------------------------------------------------------------------------

@book_bp.route('/<int:book_id>/gift-stickers')
@login_required
def gift_stickers(book_id):
    """Dedicated page for sending gift stickers to a book's creator."""
    book = Content.query.filter(Content.id == book_id, Content.deleted_at == None).first_or_404()
    creator = book.creator
    creator_profile = None
    if creator:
        creator_profile = CreatorProfile.query.filter_by(wiam_id=creator.wiam_id).first()

    from .gift import STICKER_CATALOG
    from ..models import CoinBalance, StickerGift
    coin_balance = 0
    sticker_total = 0
    if current_user.is_authenticated:
        bal = CoinBalance.query.filter_by(user_id=current_user.wiam_id).first()
        coin_balance = bal.balance if bal else 0
        sticker_total = StickerGift.query.filter_by(content_id=book_id).count()

    return render_template('gift_stickers.html',
        book=book,
        creator=creator,
        creator_profile=creator_profile,
        sticker_catalog=STICKER_CATALOG,
        coin_balance=coin_balance,
        sticker_total=sticker_total,
    )
