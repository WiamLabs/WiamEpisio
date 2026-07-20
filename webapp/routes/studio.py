"""WiamStudio — where creators write and publish books."""
import os
import uuid
from functools import wraps
import logging
from datetime import datetime, timedelta
from flask import Blueprint, render_template, redirect, url_for, request, jsonify, flash, current_app, send_from_directory
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from ..extensions import db, csrf, limiter
from ..models import Content, WebBookContent, Genre, CreatorProfile, MonetizationStatus

studio_bp = Blueprint('studio', __name__, url_prefix='/creator/studio')
log = logging.getLogger(__name__)


def creator_required(f):
    """Decorator: only creators (and founder) can access."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_creator:
            flash('You need a creator account to access this.', 'error')
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated


@studio_bp.route('/')
@creator_required
def dashboard():
    """WiamStudio home — list all books with drafts."""
    tid = current_user.wiam_id
    books = Content.query.filter(
        Content.creator_wiam_id == tid,
        Content.deleted_at == None
    ).order_by(Content.created_at.desc()).all()

    # Chapter counts
    chapter_counts = {}
    word_counts = {}
    for b in books:
        chapters = WebBookContent.query.filter_by(content_id=b.id).all()
        chapter_counts[b.id] = len(chapters)
        word_counts[b.id] = sum(c.word_count or 0 for c in chapters)

    # ── Eligibility progress data ──
    elig = None
    try:
        from ..services.monetization import ELIGIBILITY_REQUIREMENTS
        from ..models import Follow, Rating, ReadingProgress, WebBookContent as WBC
        from sqlalchemy import func

        reqs = ELIGIBILITY_REQUIREMENTS
        now = datetime.utcnow()
        account_age = (now - current_user.date_joined).days if current_user.date_joined else 0

        published = [b for b in books if b.is_published]
        pub_ids = [b.id for b in published]

        max_chapters = 0
        for bid in pub_ids:
            cc = WBC.query.filter_by(content_id=bid).count()
            if cc > max_chapters:
                max_chapters = cc

        total_readers = 0
        if pub_ids:
            total_readers = db.session.query(
                func.count(func.distinct(ReadingProgress.user_id))
            ).filter(ReadingProgress.content_id.in_(pub_ids)).scalar() or 0

        followers = Follow.query.filter_by(creator_id=current_user.id).count()

        avg_rating = 0.0
        rating_count = 0
        if pub_ids:
            agg = db.session.query(func.avg(Rating.rating), func.count(Rating.id)).filter(
                Rating.content_id.in_(pub_ids)
            ).first()
            avg_rating = round(float(agg[0] or 0), 1)
            rating_count = int(agg[1] or 0)

        violations_60d = 0
        try:
            from ..models import UserWarning
            violations_60d = UserWarning.query.filter(
                UserWarning.user_id == current_user.id,
                UserWarning.severity.in_(['warning', 'strike']),
                UserWarning.created_at >= now - timedelta(days=60),
            ).count()
        except Exception:
            pass

        trust_score = 50
        try:
            from ..services.trust_engine import compute_reader_trust
            trust_score = int(compute_reader_trust(current_user.id, save=False) * 100)
        except Exception:
            trust_score = min(100, 50 + (len(published) * 5) + (followers // 10))

        elig = {
            'account_age':   {'val': account_age,      'req': reqs['min_account_age_days'],  'label': 'Account Age',       'unit': 'days'},
            'stories':       {'val': len(published),   'req': reqs['min_published_stories'], 'label': 'Published Stories', 'unit': ''},
            'chapters':      {'val': max_chapters,     'req': reqs['min_chapters_in_story'], 'label': 'Chapters (best story)', 'unit': ''},
            'readers':       {'val': total_readers,    'req': reqs['min_unique_readers'],     'label': 'Unique Readers',    'unit': ''},
            'followers':     {'val': followers,         'req': reqs['min_followers'],          'label': 'Followers',         'unit': ''},
            'rating_count':  {'val': rating_count,     'req': reqs['min_rating_count'],       'label': 'Ratings',           'unit': ''},
            'avg_rating':    {'val': avg_rating,        'req': reqs['min_avg_rating'],         'label': 'Avg Rating',        'unit': '★'},
            'violations':    {'val': violations_60d,   'req': reqs['max_violations_60d'],     'label': 'Violations (60d)',  'unit': '', 'inverse': True},
            'trust':         {'val': trust_score,      'req': reqs['min_trust_score'],        'label': 'Trust Score',       'unit': ''},
        }
    except Exception as e:
        log.error("Eligibility data error: %s", e, exc_info=True)
        # Provide fallback so bars always show (all zeros)
        from ..services.monetization import ELIGIBILITY_REQUIREMENTS as _ER
        elig = {
            'account_age':   {'val': 0, 'req': _ER['min_account_age_days'],  'label': 'Account Age',        'unit': 'days'},
            'stories':       {'val': 0, 'req': _ER['min_published_stories'], 'label': 'Published Stories',  'unit': ''},
            'chapters':      {'val': 0, 'req': _ER['min_chapters_in_story'], 'label': 'Chapters (best)',    'unit': ''},
            'readers':       {'val': 0, 'req': _ER['min_unique_readers'],    'label': 'Unique Readers',     'unit': ''},
            'followers':     {'val': 0, 'req': _ER['min_followers'],         'label': 'Followers',          'unit': ''},
            'rating_count':  {'val': 0, 'req': _ER['min_rating_count'],      'label': 'Ratings',            'unit': ''},
            'avg_rating':    {'val': 0, 'req': _ER['min_avg_rating'],        'label': 'Avg Rating',         'unit': '\u2605'},
            'violations':    {'val': 0, 'req': _ER['max_violations_60d'],    'label': 'Violations (60d)',   'unit': '', 'inverse': True},
            'trust':         {'val': 0, 'req': _ER['min_trust_score'],       'label': 'Trust Score',        'unit': ''},
        }

    return render_template('studio/dashboard.html',
        books=books,
        chapter_counts=chapter_counts,
        word_counts=word_counts,
        elig=elig,
    )


@studio_bp.route('/monetization-guide')
@creator_required
def monetization_guide():
    """Full monetization guide page for creators."""
    return render_template('studio/monetization_guide.html')


@studio_bp.route('/new', methods=['GET', 'POST'])
@creator_required
def new_book():
    """Create a new book (setup: cover, title, synopsis, genre)."""
    genres = Genre.query.order_by(Genre.name).all()
    profile = CreatorProfile.query.filter_by(wiam_id=current_user.wiam_id).first()

    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        description = (request.form.get('synopsis', '').strip() or request.form.get('description', '').strip())[:500]
        genre = request.form.get('genre', '').strip()
        allow_download = request.form.get('allow_download') == 'on'

        if not title:
            flash('Title is required.', 'error')
            return render_template('studio/new_book.html', genres=genres, profile=profile)

        # ── Rate Guard (book creation limit) ──
        from ..services.rate_guard import check_book_create
        allowed, rate_msg = check_book_create(current_user.id)
        if not allowed:
            flash(rate_msg, 'error')
            return render_template('studio/new_book.html', genres=genres, profile=profile)

        # ── Content Guard scan ──
        from ..services.content_guard import scan_multiple
        verdict = scan_multiple(current_user.id, {
            'book_title': title,
            'book_description': description,
        })
        if not verdict.allowed:
            flash(verdict.reason, 'error')
            return render_template('studio/new_book.html', genres=genres, profile=profile)

        # Create the content entry
        book = Content(
            title=title,
            author=author or (profile.pen_name if profile else current_user.display_name),
            description=description,
            genre=genre,
            status='draft',
            source='web',
            allow_download=allow_download,
            creator_wiam_id=current_user.wiam_id,
            price=0.0,
        )
        db.session.add(book)
        db.session.flush()  # Get the ID

        # Handle cover image upload during creation
        if 'cover' in request.files:
            cover_file = request.files['cover']
            if cover_file and cover_file.filename and _allowed_image(cover_file.filename):
                # NSFW / validity scan before saving
                from ..services.cover_scanner import validate_cover, normalize_cover, issue_cover_strike
                scan = validate_cover(cover_file)
                if not scan['valid']:
                    # Issue warning/strike for NSFW covers
                    if scan.get('nsfw'):
                        issue_cover_strike(
                            current_user.id,
                            scan.get('skin_ratio', 0),
                            severe=scan.get('severe', False),
                        )
                    flash(scan['error'], 'error')
                    return render_template('studio/new_book.html', genres=genres, profile=profile)
                cover_bytes = cover_file.read()
                ext = cover_file.filename.rsplit('.', 1)[1].lower()
                ct_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp'}
                ct = ct_map.get(ext, 'image/jpeg')
                cover_bytes, ct = normalize_cover(cover_bytes, ct)
                # Upload to Cloudinary (no DB fallback)
                from ..services.image_service import upload_cover as cloud_upload_cover
                cloud_id = cloud_upload_cover(cover_bytes, book.id, ct)
                if cloud_id:
                    book.cover_file_id = cloud_id

        # Create first chapter
        ch1 = WebBookContent(
            content_id=book.id,
            chapter_number=1,
            chapter_title='Chapter 1',
            body='',
            word_count=0,
        )
        db.session.add(ch1)
        db.session.commit()

        return redirect(url_for('studio.editor', book_id=book.id))

    return render_template('studio/new_book.html', genres=genres, profile=profile)


@studio_bp.route('/<int:book_id>')
@creator_required
def editor(book_id):
    """The main writing editor."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
        Content.deleted_at == None,
    ).first_or_404()

    chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    if not chapters:
        ch1 = WebBookContent(
            content_id=book_id,
            chapter_number=1,
            chapter_title='Chapter 1',
            body='',
        )
        db.session.add(ch1)
        db.session.commit()
        chapters = [ch1]

    # Which chapter to load
    ch_num = request.args.get('ch', 1, type=int)
    current_chapter = None
    for ch in chapters:
        if ch.chapter_number == ch_num:
            current_chapter = ch
            break
    if not current_chapter:
        current_chapter = chapters[0]

    genres = Genre.query.order_by(Genre.name).all()

    return render_template('studio/editor.html',
        book=book,
        chapters=chapters,
        current_chapter=current_chapter,
        genres=genres,
    )


@studio_bp.route('/<int:book_id>/save', methods=['POST'])
@csrf.exempt
@creator_required
def save_chapter(book_id):
    """Auto-save or manual save — AJAX endpoint."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first()
    if not book:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json()
    ch_num = data.get('chapter_number', 1)
    raw_body = data.get('body', '')
    try:
        from ..services.chapter_sanitizer import sanitize_chapter_body
        body = sanitize_chapter_body(raw_body)
    except Exception:
        body = raw_body
    title = data.get('chapter_title', '')
    word_count = data.get('word_count', 0)

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first()

    if chapter:
        chapter.body = body
        if title:
            chapter.chapter_title = title
        chapter.word_count = word_count
        chapter.updated_at = datetime.utcnow()
    else:
        chapter = WebBookContent(
            content_id=book_id,
            chapter_number=ch_num,
            chapter_title=title or f'Chapter {ch_num}',
            body=body,
            word_count=word_count,
        )
        db.session.add(chapter)

    db.session.commit()
    return jsonify({'saved': True, 'updated_at': chapter.updated_at.isoformat()})


@studio_bp.route('/<int:book_id>/chapter/add', methods=['POST'])
@csrf.exempt
@creator_required
def add_chapter(book_id):
    """Add a new chapter."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    last_ch = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number.desc()).first()

    # Block if the latest chapter is still empty (0 words)
    if last_ch and (not last_ch.body or not last_ch.body.strip()):
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Write something in the current chapter before adding a new one.'}), 400
        flash('Write something in the current chapter before adding a new one.', 'warning')
        return redirect(url_for('studio.editor', book_id=book_id, ch=last_ch.chapter_number))

    new_num = (last_ch.chapter_number + 1) if last_ch else 1
    ch = WebBookContent(
        content_id=book_id,
        chapter_number=new_num,
        chapter_title=f'Chapter {new_num}',
        body='',
    )
    db.session.add(ch)
    db.session.commit()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({
            'chapter_number': new_num,
            'chapter_title': ch.chapter_title,
            'id': ch.id,
        })
    return redirect(url_for('studio.editor', book_id=book_id, ch=new_num))


@studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/delete', methods=['POST'])
@creator_required
def delete_chapter(book_id, ch_num):
    """Delete a chapter."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    # Don't delete if it's the only chapter
    count = WebBookContent.query.filter_by(content_id=book_id).count()
    if count <= 1:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': 'Cannot delete the only chapter'}), 400
        flash('Cannot delete the only chapter.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()
    db.session.delete(chapter)
    db.session.flush()

    # Auto-renumber remaining chapters sequentially (1, 2, 3, ...)
    remaining = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number.asc()).all()
    for idx, ch in enumerate(remaining, start=1):
        if ch.chapter_number != idx:
            # Update title if it follows "Chapter N" pattern
            if ch.chapter_title and ch.chapter_title.strip().lower() == f'chapter {ch.chapter_number}':
                ch.chapter_title = f'Chapter {idx}'
            ch.chapter_number = idx
    db.session.commit()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'deleted': True, 'renumbered': True})
    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/<int:book_id>/delete', methods=['POST'])
@creator_required
def delete_book(book_id):
    """Permanently delete a book and ALL related data from the database."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
        Content.deleted_at == None,
    ).first_or_404()

    title = book.title
    # Delete ALL related data from DB to free space
    _hard_delete_book(book_id)

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'deleted': True})
    flash(f'"{title}" has been permanently deleted from WiamApp.', 'success')
    return redirect(url_for('studio.dashboard'))


def _hard_delete_book(book_id):
    """Remove a book and every related row from the database."""
    from ..models import (
        WebBookContent, ReadingProgress, Favorite, Rating, Review, ReviewLike,
        ChapterComment, ChapterCommentLike, ChapterLike, ChapterVote,
        ParagraphReaction, ParagraphComment, ParagraphCommentLike,
        ShareEvent, ChapterUnlock, Access, ImageStore,
        EliteStory, FeaturedBook, Bookmark, ShelfItem,
        Order, StickerGift, GiftBook, CollectionItem,
        CoinTransaction, ReviewQueue, ClassicBook, ContentReport,
    )
    # Delete paragraph-level data
    ParagraphCommentLike.query.filter(
        ParagraphCommentLike.comment_id.in_(
            db.session.query(ParagraphComment.id).filter_by(content_id=book_id)
        )
    ).delete(synchronize_session=False)
    ParagraphComment.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ParagraphReaction.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    # Delete chapter-level data
    ChapterCommentLike.query.filter(
        ChapterCommentLike.comment_id.in_(
            db.session.query(ChapterComment.id).filter_by(content_id=book_id)
        )
    ).delete(synchronize_session=False)
    ChapterComment.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ChapterLike.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ChapterVote.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    # Delete book-level data
    ReviewLike.query.filter(
        ReviewLike.review_id.in_(
            db.session.query(Review.id).filter_by(content_id=book_id)
        )
    ).delete(synchronize_session=False)
    Review.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    Rating.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    Favorite.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ReadingProgress.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ShareEvent.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ChapterUnlock.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    Access.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    # Delete elite, featured, bookmark, shelf references
    EliteStory.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    FeaturedBook.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    Bookmark.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ShelfItem.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    # Delete orders, gifts, stickers, collections, transactions, reviews queue
    Order.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    StickerGift.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    GiftBook.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    CollectionItem.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    CoinTransaction.query.filter_by(content_id=book_id).update({'content_id': None}, synchronize_session=False)
    ReviewQueue.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    ContentReport.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    # Unlink classic book if this Content was mirrored from one
    ClassicBook.query.filter_by(content_id=book_id).update({'content_id': None, 'status': 'fetched'}, synchronize_session=False)
    # Delete cover image — both legacy DB blobs and Cloudinary assets.
    book = Content.query.get(book_id)
    if book and book.cover_file_id:
        cfid = book.cover_file_id
        if cfid.startswith('dbimg_'):
            try:
                img_id = int(cfid[6:])
                ImageStore.query.filter_by(id=img_id).delete(synchronize_session=False)
            except (ValueError, TypeError):
                pass
        # Cloudinary cleanup — best-effort, never blocks the hard delete.
        try:
            from ..services.image_service import delete_cover as _del_cover, delete_image_url as _del_image_url
            # Stable upload pattern (Push 1+) is wiamapp/covers/cover_<id>.
            _del_cover(book_id)
            # Legacy ext_<full_url> covers fall through to URL-based delete.
            if cfid.startswith('ext_'):
                _del_image_url(cfid[4:])
        except Exception as _exc:
            log.warning("Cloudinary cover cleanup skipped for book %s: %s", book_id, _exc)
    # Delete chapters and book
    WebBookContent.query.filter_by(content_id=book_id).delete(synchronize_session=False)
    Content.query.filter_by(id=book_id).delete(synchronize_session=False)
    db.session.commit()


@studio_bp.route('/<int:book_id>/settings', methods=['POST'])
@creator_required
def update_settings(book_id):
    """Update book settings (title, genre, description, prices, etc.)."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    title = request.form.get('title', '').strip()
    description = (request.form.get('synopsis', '').strip() or request.form.get('description', '').strip())[:500]

    # ── Content Guard scan (keyword-only on settings save to conserve AI quota) ──
    from ..services.content_guard import scan_multiple
    verdict = scan_multiple(current_user.id, {
        'book_title': title or '',
        'book_description': description or '',
    }, skip_ai=True)
    if not verdict.allowed:
        flash(verdict.reason, 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if title:
        book.title = title
    author = request.form.get('author', '').strip()
    if author:
        book.author = author
    book.description = description
    book.genre = request.form.get('genre', '').strip()
    book.allow_download = request.form.get('allow_download') == 'on'
    book.introduction = (request.form.get('introduction', '').strip() or None)

    # Prices
    try:
        book.price = float(request.form.get('price', 0) or 0)
        book.price_buy_now = float(request.form.get('price_buy_now', 0) or 0) or None
        book.price_1_day = float(request.form.get('price_1_day', 0) or 0) or None
        book.price_2_days = float(request.form.get('price_2_days', 0) or 0) or None
        book.price_3_days = float(request.form.get('price_3_days', 0) or 0) or None
        book.price_5_days = float(request.form.get('price_5_days', 0) or 0) or None
        book.price_30_days = float(request.form.get('price_30_days', 0) or 0) or None
    except (ValueError, TypeError):
        pass

    db.session.commit()
    flash('Book settings updated.', 'success')
    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/<int:book_id>/publish', methods=['POST'])
@limiter.limit("5 per minute")
@creator_required
def publish(book_id):
    """Publish a book — set status to ongoing or complete."""
    from ..services.moderation import scan_chapter_on_publish
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    # ── Draft shortcut — no validation needed to UNPUBLISH ──
    publish_type = request.form.get('publish_type', 'ongoing')
    if publish_type == 'draft':
        book.status = 'draft'
        db.session.commit()
        flash('Story moved back to drafts.', 'success')
        return redirect(url_for('studio.editor', book_id=book_id))

    # ── Auto-save story details submitted alongside publish ──
    # The publish form includes hidden fields synced from the Story Details
    # section via JS, so creators don't have to click "Save Details" first.
    # Always apply form values so the creator's current selections are saved.
    _genre = request.form.get('genre', '').strip()
    _synopsis = request.form.get('synopsis', '').strip()
    _title = request.form.get('title', '').strip()
    dirty = False
    if _genre:
        book.genre = _genre
        dirty = True
    if _synopsis:
        book.description = _synopsis[:500]
        dirty = True
    if _title:
        book.title = _title
        dirty = True
    if dirty:
        db.session.flush()

    # Validate: must have title, at least 1 chapter with content
    chapters = WebBookContent.query.filter_by(content_id=book_id).all()
    if not chapters or all(not ch.body.strip() for ch in chapters):
        flash('Write at least one chapter before publishing.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if not book.title or not book.title.strip():
        flash('Set a title before publishing.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if not book.genre or not book.genre.strip():
        flash('Select a genre before publishing.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if not book.description or len(book.description.strip()) < 20:
        flash('Add a synopsis (at least 20 characters) before publishing.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    # Validate chapter titles and minimum content length
    for ch in chapters:
        if ch.body and ch.body.strip():
            if not ch.chapter_title or not ch.chapter_title.strip():
                flash(f'Chapter {ch.chapter_number} needs a title before publishing.', 'error')
                return redirect(url_for('studio.editor', book_id=book_id))
            if len(ch.body.strip()) < 50:
                flash(f'Chapter {ch.chapter_number} is too short (minimum 50 characters).', 'error')
                return redirect(url_for('studio.editor', book_id=book_id))

    # Phase 4: Scan all chapters before publishing
    rejected = []
    for ch in chapters:
        if ch.body and ch.body.strip():
            result = scan_chapter_on_publish(book_id, ch.chapter_number, ch.body, ch.chapter_title)
            if result.get('should_reject'):
                rejected.append(ch.chapter_number)

    if rejected:
        flash(f'Chapters {rejected} contain prohibited content and cannot be published. Please review and edit them.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if publish_type == 'complete':
        book.status = 'complete'
    else:
        book.status = 'ongoing'

    # Set published_at on first publish (so it appears in New Releases)
    if not book.published_at:
        book.published_at = datetime.utcnow()

    # Only count published chapters — do NOT auto-publish draft chapters
    published_ch = [ch for ch in chapters if ch.status == 'published']
    draft_ch = [ch for ch in chapters if ch.status != 'published' and ch.body and ch.body.strip()]

    db.session.commit()

    if draft_ch:
        flash(f'{len(draft_ch)} chapter(s) are still drafts. Publish them individually or use "Publish All Drafts".', 'info')

    # ── Auto-create review queue entry for Editor Studio ──
    try:
        from ..models import ReviewQueue
        existing = ReviewQueue.query.filter_by(
            content_id=book_id, status='pending'
        ).first()
        if not existing:
            sub_type = 'new' if not book.last_reviewed_at else 'resubmission'
            rq = ReviewQueue(content_id=book_id, creator_id=current_user.wiam_id,
                             submission_type=sub_type, status='pending')
            db.session.add(rq)
            book.review_status = 'unreviewed'
            db.session.commit()
    except Exception:
        pass

    try:
        from ..services.notifications import notify_new_book_published
        notify_new_book_published(book_id)
    except Exception:
        pass

    # Notify Founder/Editors via email + in-app
    try:
        from ..services.platform_notify import notify_new_book_published as pn_notify_book
        creator_name = current_user.display_name if hasattr(current_user, 'display_name') else ''
        pn_notify_book(book.title, book.author or '', book_id, creator_name=creator_name)
    except Exception:
        pass

    flash(f'"{book.title}" is now published as {book.status}!', 'success')
    return redirect(url_for('studio.editor', book_id=book_id, bulletin_prompt=1))


@studio_bp.route('/<int:book_id>/unpublish', methods=['POST'])
@creator_required
def unpublish(book_id):
    """Set book back to draft."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()
    book.status = 'draft'
    db.session.commit()
    flash('Book moved back to drafts.', 'success')
    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/publish', methods=['POST'])
@creator_required
def publish_chapter(book_id, ch_num):
    """Publish a single chapter (like WebNovel / Wattpad)."""
    from ..services.moderation import scan_chapter_on_publish
    Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    if not chapter.body or not chapter.body.strip():
        flash('Cannot publish an empty chapter.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    # Phase 4: Scan chapter before publishing
    result = scan_chapter_on_publish(book_id, ch_num, chapter.body, chapter.chapter_title)
    if result.get('should_reject'):
        flash('This chapter contains prohibited content and cannot be published. Please review and edit it.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))
    if result.get('should_flag'):
        flash('This chapter has been flagged for review but is still published. Our team may review it.', 'warning')

    was_unpublished = (chapter.status != 'published')
    chapter.status = 'published'
    chapter.updated_at = datetime.utcnow()
    if was_unpublished and not chapter.published_at:
        chapter.published_at = datetime.utcnow()
    try:
        from ..services.analytics import track
        track('publish_chapter', current_user, content_id=book_id, chapter_number=ch_num, source='web')
    except Exception:
        pass
    db.session.commit()
    if was_unpublished:
        try:
            from ..services.notifications import notify_new_chapter
            notify_new_chapter(book_id, ch_num, chapter.chapter_title)
        except Exception:
            pass
    flash(f'Chapter {ch_num} published!', 'success')
    return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))


@studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/unpublish', methods=['POST'])
@creator_required
def unpublish_chapter(book_id, ch_num):
    """Unpublish a single chapter back to draft."""
    Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    chapter.status = 'draft'
    chapter.updated_at = datetime.utcnow()
    db.session.commit()
    flash(f'Chapter {ch_num} moved back to draft.', 'success')
    return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))


@studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/lock', methods=['POST'])
@csrf.exempt
@creator_required
def toggle_chapter_lock(book_id, ch_num):
    """Lock/unlock a chapter (paid chapter). Requires monetization eligibility."""
    Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    data = request.get_json() if request.is_json else {}
    lock = data.get('lock', not chapter.is_locked)
    price = data.get('price', chapter.chapter_price or 0)

    # Enforce: first 10 chapters must be FREE
    if lock and ch_num <= 10:
        msg = 'The first 10 chapters of any story must be free.'
        if request.is_json:
            return jsonify({'error': msg}), 400
        flash(msg, 'error')
        return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    # Enforce: monetization eligibility required to lock
    if lock:
        status = MonetizationStatus.query.get(current_user.wiam_id)
        if not status or not status.is_eligible:
            msg = 'You must meet monetization eligibility requirements to lock chapters.'
            if request.is_json:
                return jsonify({'error': msg}), 403
            flash(msg, 'error')
            return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    # Enforce: book must be approved for monetization (Smart Hybrid Publishing)
    if lock:
        book = Content.query.get(book_id)
        if book and book.review_status not in ('approved', 'elite_approved', 'apex_approved'):
            msg = 'Your story must pass editorial review before you can lock chapters. Request a review from your Story Settings.'
            if request.is_json:
                return jsonify({'error': msg}), 403
            flash(msg, 'error')
            return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    # Enforce: price range 3-10 coins
    if lock:
        price = max(3, min(10, int(float(price))))

    chapter.is_locked = lock
    chapter.chapter_price = float(price) if lock else 0
    chapter.updated_at = datetime.utcnow()
    db.session.commit()

    if request.is_json:
        return jsonify({'locked': chapter.is_locked, 'price': chapter.chapter_price})

    flash(f'Chapter {ch_num} {"locked" if lock else "unlocked"}.', 'success')
    return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))


@studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/premium-lock', methods=['POST'])
@csrf.exempt
@creator_required
def toggle_premium_lock(book_id, ch_num):
    """Toggle premium lock on a chapter. Requires monetization eligibility."""
    Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    data = request.get_json() if request.is_json else {}
    lock = data.get('lock', not chapter.is_premium_locked)
    cost = data.get('cost', chapter.unlock_cost_credits or 1)

    if lock and ch_num <= 10:
        msg = 'The first 10 chapters of any story must be free.'
        if request.is_json:
            return jsonify({'error': msg}), 400
        flash(msg, 'error')
        return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    if lock:
        status = MonetizationStatus.query.get(current_user.wiam_id)
        if not status or not status.is_eligible:
            msg = 'You must meet monetization eligibility requirements to lock chapters.'
            if request.is_json:
                return jsonify({'error': msg}), 403
            flash(msg, 'error')
            return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))

    if lock:
        cost = max(1, min(5, int(float(cost))))

    chapter.is_premium_locked = lock
    chapter.unlock_cost_credits = int(cost) if lock else 0
    # If premium-locking, ensure coin lock is off to avoid double-lock
    if lock:
        chapter.is_locked = False
        chapter.chapter_price = 0
    chapter.updated_at = datetime.utcnow()
    db.session.commit()

    if request.is_json:
        return jsonify({'premium_locked': chapter.is_premium_locked, 'cost': chapter.unlock_cost_credits})

    flash(f'Chapter {ch_num} {"premium-locked" if lock else "premium-unlocked"}.', 'success')
    return redirect(url_for('studio.editor', book_id=book_id, ch=ch_num))


@studio_bp.route('/<int:book_id>/publish-all-chapters', methods=['POST'])
@creator_required
def publish_all_chapters(book_id):
    """Publish all draft chapters with content — full moderation + notify parity.

    Workstream D fix: previously this route just flipped ``status='published'``
    on every draft, which let creators bypass the moderation scan they would
    have hit if they used the per-chapter ``publish_chapter`` route. We now
    scan each chapter, skip any that scan_chapter_on_publish flags as
    rejectable, stamp ``published_at`` and fire ``notify_new_chapter`` for
    every chapter that successfully publishes — same shape as the mobile API.
    """
    from ..services.moderation import scan_chapter_on_publish
    Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    chapters = WebBookContent.query.filter_by(content_id=book_id).all()
    published = []
    rejected = []
    flagged = []
    for ch in chapters:
        if ch.status != 'draft' or not ch.body or not ch.body.strip():
            continue
        try:
            result = scan_chapter_on_publish(book_id, ch.chapter_number, ch.body, ch.chapter_title or '')
        except Exception as exc:
            log.warning("publish-all-chapters scan skip book=%s ch=%s: %s", book_id, ch.chapter_number, exc)
            result = {'should_reject': False, 'should_flag': False}
        if result.get('should_reject'):
            rejected.append(ch.chapter_number)
            continue
        ch.status = 'published'
        ch.updated_at = datetime.utcnow()
        if not ch.published_at:
            ch.published_at = datetime.utcnow()
        published.append(ch)
        if result.get('should_flag'):
            flagged.append(ch.chapter_number)

    try:
        from ..services.analytics import track
        for ch in published:
            track('publish_chapter', current_user, content_id=book_id, chapter_number=ch.chapter_number, source='web_bulk')
    except Exception:
        pass

    db.session.commit()

    for ch in published:
        try:
            from ..services.notifications import notify_new_chapter
            notify_new_chapter(book_id, ch.chapter_number, ch.chapter_title or '')
        except Exception as exc:
            log.warning("notify_new_chapter skipped book=%s ch=%s: %s", book_id, ch.chapter_number, exc)

    msg = f'{len(published)} chapter(s) published!'
    if rejected:
        msg += f' {len(rejected)} chapter(s) blocked by content scan — please review and edit.'
    if flagged:
        msg += f' {len(flagged)} chapter(s) flagged for review (still published).'
    flash(msg, 'success' if not rejected else 'warning')
    return redirect(url_for('studio.editor', book_id=book_id))


# ── Preview ──────────────────────────────────────────────────────

@studio_bp.route('/<int:book_id>/preview')
@creator_required
def preview(book_id):
    """Preview a book as it would appear to readers."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
        Content.deleted_at == None,
    ).first_or_404()

    chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    ch_num = request.args.get('ch', 1, type=int)
    current_chapter = None
    for ch in chapters:
        if ch.chapter_number == ch_num:
            current_chapter = ch
            break
    if not current_chapter and chapters:
        current_chapter = chapters[0]

    total_words = sum(c.word_count or 0 for c in chapters)

    return render_template('studio/preview.html',
        book=book,
        chapters=chapters,
        current_chapter=current_chapter,
        total_words=total_words,
    )


# ── Cover Upload ─────────────────────────────────────────────────

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def _allowed_image(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS


def _get_upload_dir():
    upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'covers')
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


@studio_bp.route('/<int:book_id>/cover', methods=['POST'])
@creator_required
def upload_cover(book_id):
    """Upload a cover image for a web-written book — stored in PostgreSQL."""
    from ..services.cover_scanner import validate_cover, check_duplicate_cover
    from ..models import ImageStore

    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    if 'cover' not in request.files:
        flash('No file selected.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    file = request.files['cover']
    if file.filename == '':
        flash('No file selected.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    if not _allowed_image(file.filename):
        flash('Invalid image format. Use PNG, JPG, GIF, or WebP.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    # Phase 4: Scan cover image before saving
    scan = validate_cover(file)
    if not scan['valid']:
        # Issue warning/strike for NSFW covers
        if scan.get('nsfw'):
            from ..services.cover_scanner import issue_cover_strike
            issue_cover_strike(
                current_user.id,
                scan.get('skin_ratio', 0),
                severe=scan.get('severe', False),
            )
        flash(scan['error'], 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    # Phase 4: Check for duplicate covers (stolen images)
    if scan['hash']:
        dupe_book = check_duplicate_cover(scan['hash'], exclude_book_id=book_id)
        if dupe_book:
            flash(f'This cover image is already used by another story ("{dupe_book.title}"). Please use an original cover.', 'error')
            return redirect(url_for('studio.editor', book_id=book_id))

    # Read file bytes and determine content type
    img_bytes = file.read()
    ext = file.filename.rsplit('.', 1)[1].lower()
    ct_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp'}
    content_type = ct_map.get(ext, 'image/jpeg')

    # Normalize cover to uniform 600x900 dimensions for consistent display
    from ..services.cover_scanner import normalize_cover
    img_bytes, content_type = normalize_cover(img_bytes, content_type)

    # Upload to Cloudinary (no DB fallback — saves space)
    from ..services.image_service import upload_cover as cloud_upload_cover
    cloud_id = cloud_upload_cover(img_bytes, book_id, content_type)
    if cloud_id:
        book.cover_file_id = cloud_id
        db.session.commit()
        flash('Cover image uploaded!', 'success')
    else:
        flash('Cover upload failed. Please try again.', 'error')
    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/covers/<filename>')
def serve_uploaded_cover(filename):
    """Serve uploaded cover images (legacy filesystem fallback)."""
    upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'covers')
    full_path = os.path.join(upload_dir, filename)
    if os.path.isfile(full_path):
        return send_from_directory(upload_dir, filename)
    # Ephemeral filesystem — file lost after deploy; return default cover
    return redirect('/static/img/default_cover.png')


# ── Smart Hybrid Publishing — Monetization Review ────────────

@studio_bp.route('/<int:book_id>/request-review', methods=['POST'])
@limiter.limit("3 per minute")
@creator_required
def request_review(book_id):
    """Creator requests bot review for monetization eligibility."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
        Content.deleted_at == None,
    ).first_or_404()

    # Must be published first
    if not book.is_published:
        flash('Publish your story first before requesting a review.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    # Already approved?
    if book.review_status in ('approved', 'elite_approved', 'apex_approved'):
        flash('This story is already approved for monetization.', 'info')
        return redirect(url_for('studio.editor', book_id=book_id))

    # Already under review?
    if book.review_status == 'under_review':
        flash('This story is already under review. Please wait.', 'info')
        return redirect(url_for('studio.editor', book_id=book_id))

    # ── Pre-validation: chapters + word count ──
    from ..models import WebBookContent
    published_chapters = WebBookContent.query.filter_by(
        content_id=book_id, status='published'
    ).all()

    min_chapters = 10
    min_words = 1000
    try:
        from ..models import PlatformSetting
        import json as _json
        mc = PlatformSetting.query.filter_by(key='min_chapters_required').first()
        if mc and mc.value_json:
            min_chapters = _json.loads(mc.value_json)
        mw = PlatformSetting.query.filter_by(key='min_words_per_chapter').first()
        if mw and mw.value_json:
            min_words = _json.loads(mw.value_json)
    except Exception:
        pass

    if len(published_chapters) < min_chapters:
        flash(f'You need at least {min_chapters} published chapters before requesting a review. '
              f'You currently have {len(published_chapters)}. Keep writing!', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    short_chapters = [ch for ch in published_chapters if (ch.word_count or 0) < min_words]
    if short_chapters:
        short_nums = ', '.join(str(ch.chapter_number) for ch in short_chapters[:5])
        flash(f'Each chapter must have at least {min_words} words. '
              f'Chapters {short_nums}{"..." if len(short_chapters) > 5 else ""} '
              f'are too short. Please expand them before requesting a review.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    submission_type = request.form.get('type', 'monetization')

    try:
        from ..services.bot_review import submit_for_review
        result = submit_for_review(book_id, submission_type)

        if result.get('error'):
            flash(result['error'], 'error')
            return redirect(url_for('studio.editor', book_id=book_id))

        score = result.get('total_score', 0)
        passed = result.get('passed_monetization', False)
        if passed:
            flash(f'Your story scored {score}/100 and has been approved for monetization!', 'success')
        else:
            feedback = result.get('feedback', [])
            feedback_text = ' '.join(feedback[:3])
            flash(f'Your story scored {score}/100 — not enough for monetization. {feedback_text}', 'warning')

        # Notify Founder/Editors via email + in-app
        try:
            from ..services.platform_notify import notify_review_result
            creator_name = current_user.display_name if hasattr(current_user, 'display_name') else ''
            notify_review_result(book.title, book_id, score, passed, creator_name=creator_name)
        except Exception:
            pass
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Bot review error: %s", e)
        flash('Review could not be completed. Please try again later.', 'error')

    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/<int:book_id>/resubmit-review', methods=['POST'])
@limiter.limit("3 per minute")
@creator_required
def resubmit_review(book_id):
    """Creator resubmits after revisions for another bot review."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
        Content.deleted_at == None,
    ).first_or_404()

    if book.review_status not in ('rejected', 'revision_requested'):
        flash('You can only resubmit stories that were rejected or had revisions requested.', 'error')
        return redirect(url_for('studio.editor', book_id=book_id))

    try:
        from ..services.bot_review import resubmit_for_review
        result = resubmit_for_review(book_id)

        if result.get('error'):
            flash(result['error'], 'error')
            return redirect(url_for('studio.editor', book_id=book_id))

        score = result.get('total_score', 0)
        if result.get('passed_monetization'):
            flash(f'Resubmission scored {score}/100 — approved for monetization!', 'success')
        else:
            feedback = result.get('feedback', [])
            feedback_text = ' '.join(feedback[:3])
            flash(f'Resubmission scored {score}/100 — still below threshold. {feedback_text}', 'warning')
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Bot resubmit error: %s", e)
        flash('Resubmission could not be completed. Please try again later.', 'error')

    return redirect(url_for('studio.editor', book_id=book_id))


@studio_bp.route('/<int:book_id>/review-status')
@creator_required
def review_status(book_id):
    """AJAX endpoint — return current review status and bot score for a book."""
    book = Content.query.filter(
        Content.id == book_id,
        Content.creator_wiam_id == current_user.wiam_id,
    ).first_or_404()

    from ..models import ReviewQueue
    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()

    return jsonify({
        'review_status': book.review_status or 'unreviewed',
        'review_score': book.review_score,
        'last_reviewed_at': book.last_reviewed_at.isoformat() if book.last_reviewed_at else None,
        'queue_status': qe.status if qe else None,
        'bot_score': qe.bot_score if qe else None,
        'bot_feedback': qe.bot_feedback_json if qe else None,
    })


# ---------------------------------------------------------------------------
# Top Readers — Creator can see engaged readers & gift sticker coins
# ---------------------------------------------------------------------------

@studio_bp.route('/top-readers')
@creator_required
def top_readers():
    """Show creator their most engaged readers across all their stories."""
    from ..models import (ReadingProgress, ChapterLike, ChapterComment,
                          User, CoinBalance, StickerGift)
    from sqlalchemy import func

    tid = current_user.wiam_id
    my_books = Content.query.filter(
        Content.creator_wiam_id == tid,
        Content.deleted_at == None,
    ).all()
    book_ids = [b.id for b in my_books]

    if not book_ids:
        return render_template('studio/top_readers.html',
                               readers=[], coin_balance=0, my_books=my_books)

    # Aggregate engagement: reading progress, chapter likes, comments
    # Score = chapters_read * 2 + likes * 3 + comments * 5
    reader_scores = {}

    # Reading progress (chapters read)
    progress_rows = db.session.query(
        ReadingProgress.user_id,
        func.sum(ReadingProgress.current_chapter).label('total_chapters')
    ).filter(
        ReadingProgress.content_id.in_(book_ids)
    ).group_by(ReadingProgress.user_id).all()

    for row in progress_rows:
        uid = row.user_id
        reader_scores[uid] = reader_scores.get(uid, 0) + (row.total_chapters or 0) * 2

    # Chapter likes
    like_rows = db.session.query(
        ChapterLike.user_id,
        func.count(ChapterLike.id).label('total_likes')
    ).filter(
        ChapterLike.content_id.in_(book_ids)
    ).group_by(ChapterLike.user_id).all()

    for row in like_rows:
        uid = row.user_id
        reader_scores[uid] = reader_scores.get(uid, 0) + (row.total_likes or 0) * 3

    # Comments
    comment_rows = db.session.query(
        ChapterComment.user_id,
        func.count(ChapterComment.id).label('total_comments')
    ).filter(
        ChapterComment.content_id.in_(book_ids),
        ChapterComment.is_deleted == False,
    ).group_by(ChapterComment.user_id).all()

    for row in comment_rows:
        uid = row.user_id
        reader_scores[uid] = reader_scores.get(uid, 0) + (row.total_comments or 0) * 5

    # Remove self
    reader_scores.pop(current_user.id, None)
    if tid:
        reader_scores.pop(tid, None)

    # Sort by score, top 50
    sorted_readers = sorted(reader_scores.items(), key=lambda x: x[1], reverse=True)[:50]

    # Fetch user details
    reader_ids = [r[0] for r in sorted_readers]
    users_map = {}
    if reader_ids:
        users = User.query.filter(User.id.in_(reader_ids)).all()
        # Also try wiam_id match
        users2 = User.query.filter(User.wiam_id.in_(reader_ids)).all()
        for u in users + users2:
            users_map[u.id] = u
            if u.wiam_id:
                users_map[u.wiam_id] = u

    readers = []
    for uid, score in sorted_readers:
        user = users_map.get(uid)
        if not user or user.status == 'banned':
            continue
        # Count gifts already sent to this reader
        gifts_sent = StickerGift.query.filter_by(
            sender_id=current_user.id, recipient_id=user.id
        ).count()
        readers.append({
            'user': user,
            'score': score,
            'gifts_sent': gifts_sent,
        })

    # Creator's coin balance (CoinBalance uses User.id, not wiam_id)
    bal = CoinBalance.query.filter_by(user_id=current_user.id).first()
    coin_balance = bal.balance if bal else 0

    return render_template('studio/top_readers.html',
                           readers=readers, coin_balance=coin_balance, my_books=my_books)


@studio_bp.route('/gift-reader', methods=['POST'])
@creator_required
def gift_reader_coins():
    """Creator gifts sticker coins to a reader."""
    from ..models import CoinBalance, StickerGift, User

    reader_id = request.form.get('reader_id', type=int)
    amount = request.form.get('amount', type=int)

    if not reader_id or not amount or amount < 5 or amount > 100:
        flash('Invalid gift amount (5-100 coins).', 'error')
        return redirect(url_for('studio.top_readers'))

    if reader_id == current_user.id:
        flash('You cannot gift yourself.', 'error')
        return redirect(url_for('studio.top_readers'))

    reader = User.query.get(reader_id)
    if not reader:
        flash('Reader not found.', 'error')
        return redirect(url_for('studio.top_readers'))

    # Debit creator's coins (CoinBalance uses User.id)
    bal = CoinBalance.query.filter_by(user_id=current_user.id).first()
    if not bal or bal.balance < amount:
        flash('Not enough coins. Buy more from the Coins page.', 'error')
        return redirect(url_for('studio.top_readers'))

    bal.balance -= amount

    # Credit reader's coins (CoinBalance uses User.id)
    reader_bal = CoinBalance.query.filter_by(user_id=reader.id).first()
    if reader_bal:
        reader_bal.balance += amount
    else:
        reader_bal = CoinBalance(user_id=reader.id, balance=amount)
        db.session.add(reader_bal)

    # Record the gift
    gift = StickerGift(
        sender_id=current_user.id,
        recipient_id=reader.id,
        content_id=0,
        sticker_key='creator_gift',
        coin_cost=amount,
        message=f'{current_user.display_name} gifted you {amount} sticker coins!',
    )
    db.session.add(gift)
    db.session.commit()

    # Notify reader — link to gift celebration page
    try:
        from ..services.notifications import notify_gift_celebration
        notify_gift_celebration(
            reader.id, current_user.display_name, amount, gift.id
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Gift notification error: %s", e)

    flash(f'Gifted {amount} coins to {reader.display_name}!', 'success')
    return redirect(url_for('studio.top_readers'))
