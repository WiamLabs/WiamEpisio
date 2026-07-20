"""Editor Studio — dedicated workspace for editorial review of stories.
Editors can browse the review queue, read chapters inline, leave notes,
edit chapter content, and approve/reject/request revisions on stories."""
import json
import logging
from datetime import datetime
from functools import wraps
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify, abort
from flask_login import login_required, current_user
from ..extensions import db, csrf

log = logging.getLogger(__name__)

editor_studio_bp = Blueprint('editor_studio', __name__, url_prefix='/team/editor-studio')

EDITOR_ROLES = ('editor', 'admin', 'founder')
EDITOR_RBAC_ROLES = {'editor', 'admin', 'overall_boss', 'team_lead', 'translator'}


def editor_required(f):
    """Decorator: user must be logged in AND have an editor-capable role.
    Checks both the legacy User.role column and RBAC roles so team accounts work.
    """
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if current_user.role in EDITOR_ROLES:
            return f(*args, **kwargs)
        # Check RBAC roles for team accounts
        if hasattr(current_user, 'get_roles'):
            if EDITOR_RBAC_ROLES & set(current_user.get_roles()):
                return f(*args, **kwargs)
        flash('You do not have access to the Editor Studio.', 'error')
        if getattr(current_user, 'is_team_account', False):
            return redirect(url_for('team.dashboard'))
        return redirect(url_for('home.index'))
    return decorated


def _audit(action, target_type, target_id, details=None):
    """Write an audit log entry for the current user."""
    from ..models import AuditLog
    entry = AuditLog(
        actor_user_id=current_user.wiam_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details_json=json.dumps(details or {}),
        ip_address=request.remote_addr,
    )
    db.session.add(entry)


def _quality_checklist(book, chapters):
    """Auto-calculate quality checklist for a story."""
    from ..services.moderation import scan_text
    checks = []
    # Has synopsis
    has_synopsis = bool(book.description and len(book.description.strip()) >= 20)
    checks.append({'label': 'Synopsis (20+ chars)', 'passed': has_synopsis})
    # Has cover
    has_cover = bool(book.cover_file_id)
    checks.append({'label': 'Cover image uploaded', 'passed': has_cover})
    # Chapter count
    ch_count = len(chapters)
    checks.append({'label': f'Chapters: {ch_count}', 'passed': ch_count >= 1})
    # Word counts
    total_words = sum(c.word_count or 0 for c in chapters)
    avg_words = total_words // max(ch_count, 1)
    checks.append({'label': f'Total words: {total_words:,}', 'passed': total_words >= 500})
    checks.append({'label': f'Avg words/chapter: {avg_words:,}', 'passed': avg_words >= 100})
    # Empty chapters
    empty = [c for c in chapters if not c.body or not c.body.strip()]
    checks.append({'label': f'Empty chapters: {len(empty)}', 'passed': len(empty) == 0})
    # Banned words scan (sample first 3 chapters)
    flagged_chapters = []
    try:
        for ch in chapters[:5]:
            if ch.body and ch.body.strip():
                result = scan_text(ch.body)
                if result and result.get('flagged'):
                    flagged_chapters.append(ch.chapter_number)
    except Exception:
        pass
    checks.append({
        'label': f'Content safety: {"clean" if not flagged_chapters else f"flagged ch {flagged_chapters}"}',
        'passed': len(flagged_chapters) == 0,
    })
    # Score
    passed = sum(1 for c in checks if c['passed'])
    score = int((passed / max(len(checks), 1)) * 100)
    return checks, score


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD — Review Queue
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/')
@editor_required
def dashboard():
    """Editor Studio home — review queue with filters."""
    from ..models import ReviewQueue, Content, WebBookContent

    status_filter = request.args.get('status', '')
    genre_filter = request.args.get('genre', '')
    search_q = request.args.get('q', '').strip()
    assigned_filter = request.args.get('assigned', '')

    query = ReviewQueue.query

    if status_filter:
        query = query.filter(ReviewQueue.status == status_filter)
    if assigned_filter == 'me':
        query = query.filter(ReviewQueue.assigned_to == current_user.wiam_id)
    elif assigned_filter == 'unassigned':
        query = query.filter(ReviewQueue.assigned_to.is_(None))

    items = query.order_by(ReviewQueue.created_at.desc()).limit(100).all()

    # Enrich with story data
    enriched = []
    for item in items:
        story = Content.query.get(item.content_id)
        if not story or story.deleted_at:
            continue
        if genre_filter and story.genre != genre_filter:
            continue
        if search_q and search_q.lower() not in (story.title or '').lower():
            continue
        ch_count = WebBookContent.query.filter_by(content_id=story.id).count()
        total_words = db.session.query(
            db.func.coalesce(db.func.sum(WebBookContent.word_count), 0)
        ).filter_by(content_id=story.id).scalar()
        enriched.append({
            'queue': item,
            'story': story,
            'ch_count': ch_count,
            'total_words': total_words,
        })

    # Stats
    from ..models import ReviewQueue as RQ
    pending_count = RQ.query.filter_by(status='pending').count()
    my_reviews = RQ.query.filter_by(reviewed_by=current_user.wiam_id).count()
    in_review_count = RQ.query.filter_by(status='in_review').count()

    # Genres for filter dropdown
    from ..models import Genre
    genres = Genre.query.order_by(Genre.name).all()

    return render_template('editor_studio/dashboard.html',
        items=enriched,
        status_filter=status_filter,
        genre_filter=genre_filter,
        search_q=search_q,
        assigned_filter=assigned_filter,
        pending_count=pending_count,
        my_reviews_count=my_reviews,
        in_review_count=in_review_count,
        genres=genres,
    )


# ═══════════════════════════════════════════════════════════════════════════
# STORY REVIEW WORKSPACE
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/<int:book_id>')
@editor_required
def review(book_id):
    """3-panel review workspace for a story."""
    from ..models import Content, WebBookContent, EditorialNote, ReviewQueue

    story = Content.query.filter(
        Content.id == book_id,
        Content.deleted_at.is_(None),
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

    # Editorial notes for this story
    notes = EditorialNote.query.filter_by(
        content_id=book_id
    ).order_by(EditorialNote.created_at.desc()).all()

    # Review queue entry
    queue_entry = ReviewQueue.query.filter_by(
        content_id=book_id
    ).order_by(ReviewQueue.created_at.desc()).first()

    # Quality checklist
    checks, score = _quality_checklist(story, chapters)

    # Auto-assign if unassigned and editor opens it
    if queue_entry and not queue_entry.assigned_to and queue_entry.status == 'pending':
        queue_entry.assigned_to = current_user.wiam_id
        queue_entry.status = 'in_review'
        story.review_status = 'under_review'
        _audit('STORY_SELF_ASSIGNED', 'BOOK', book_id)
        db.session.commit()

    # Author info
    from ..models import User
    author = User.query.filter_by(wiam_id=story.creator_wiam_id).first()

    return render_template('editor_studio/review.html',
        story=story,
        chapters=chapters,
        current_chapter=current_chapter,
        notes=notes,
        queue_entry=queue_entry,
        checks=checks,
        quality_score=score,
        author=author,
    )


@editor_studio_bp.route('/<int:book_id>/chapter/<int:ch_num>')
@editor_required
def read_chapter(book_id, ch_num):
    """AJAX endpoint — return chapter content as JSON for inline reading."""
    from ..models import Content, WebBookContent, EditorialNote

    Content.query.filter(
        Content.id == book_id,
        Content.deleted_at.is_(None),
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    # Notes for this specific chapter
    ch_notes = EditorialNote.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).order_by(EditorialNote.created_at.desc()).all()

    return jsonify({
        'chapter_number': chapter.chapter_number,
        'chapter_title': chapter.chapter_title,
        'body': chapter.body or '',
        'word_count': chapter.word_count or 0,
        'status': chapter.status,
        'is_locked': chapter.is_locked,
        'updated_at': chapter.updated_at.isoformat() if chapter.updated_at else None,
        'notes': [{
            'id': n.id,
            'text': n.note_text,
            'type': n.note_type,
            'editor': n.editor.display_name if n.editor else 'Unknown',
            'created_at': n.created_at.strftime('%b %d, %H:%M'),
        } for n in ch_notes],
    })


# ═══════════════════════════════════════════════════════════════════════════
# EDITORIAL ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/<int:book_id>/note', methods=['POST'])
@editor_required
def add_note(book_id):
    """Add an editorial note to a story or chapter."""
    from ..models import Content, EditorialNote

    Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    data = request.get_json() if request.is_json else None
    if data:
        note_text = data.get('note_text', '').strip()
        chapter_number = data.get('chapter_number')
        note_type = data.get('note_type', 'feedback')
    else:
        note_text = request.form.get('note_text', '').strip()
        chapter_number = request.form.get('chapter_number', type=int)
        note_type = request.form.get('note_type', 'feedback')

    if not note_text:
        if request.is_json:
            return jsonify({'error': 'Note text is required'}), 400
        flash('Note text is required.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    note = EditorialNote(
        editor_user_id=current_user.wiam_id,
        content_id=book_id,
        chapter_number=chapter_number if chapter_number else None,
        note_text=note_text,
        note_type=note_type,
    )
    db.session.add(note)
    _audit('NOTE_ADDED', 'BOOK', book_id, {
        'chapter': chapter_number,
        'type': note_type,
        'preview': note_text[:100],
    })
    db.session.commit()

    if request.is_json:
        return jsonify({
            'id': note.id,
            'text': note.note_text,
            'type': note.note_type,
            'editor': current_user.display_name,
            'created_at': note.created_at.strftime('%b %d, %H:%M'),
        })

    flash('Note added.', 'success')
    return redirect(url_for('editor_studio.review', book_id=book_id))


@editor_studio_bp.route('/<int:book_id>/approve', methods=['POST'])
@editor_required
def approve(book_id):
    """Approve a story."""
    from ..models import Content, ReviewQueue

    story = Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    feedback = request.form.get('feedback', '').strip()
    score = request.form.get('score', type=int) or None

    story.review_status = 'approved'
    story.last_reviewed_at = datetime.utcnow()
    story.reviewed_by = current_user.wiam_id
    if score:
        story.review_score = score

    # Update queue entry
    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()
    if qe:
        qe.status = 'approved'
        qe.reviewed_at = datetime.utcnow()
        qe.reviewed_by = current_user.wiam_id
        qe.editor_score = score
        qe.editor_feedback = feedback

    _audit('STORY_APPROVED', 'BOOK', book_id, {
        'score': score,
        'feedback_preview': feedback[:200] if feedback else '',
    })
    db.session.commit()

    log.info("Editor %s approved story #%s", current_user.display_name, book_id)
    flash(f'"{story.title}" has been approved!', 'success')
    return redirect(url_for('editor_studio.review', book_id=book_id))


@editor_studio_bp.route('/<int:book_id>/reject', methods=['POST'])
@editor_required
def reject(book_id):
    """Reject a story — requires a reason."""
    from ..models import Content, ReviewQueue, EditorialNote

    story = Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    reason = request.form.get('reason', '').strip()
    if not reason:
        flash('A reason is required when rejecting a story.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    story.review_status = 'rejected'
    story.last_reviewed_at = datetime.utcnow()
    story.reviewed_by = current_user.wiam_id

    # Auto-create a note with the rejection reason
    note = EditorialNote(
        editor_user_id=current_user.wiam_id,
        content_id=book_id,
        note_text=f'REJECTED: {reason}',
        note_type='feedback',
    )
    db.session.add(note)

    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()
    if qe:
        qe.status = 'rejected'
        qe.reviewed_at = datetime.utcnow()
        qe.reviewed_by = current_user.wiam_id
        qe.editor_feedback = reason

    _audit('STORY_REJECTED', 'BOOK', book_id, {'reason': reason[:500]})
    db.session.commit()

    log.info("Editor %s rejected story #%s: %s", current_user.display_name, book_id, reason[:100])
    flash(f'"{story.title}" has been rejected.', 'warning')
    return redirect(url_for('editor_studio.review', book_id=book_id))


@editor_studio_bp.route('/<int:book_id>/request-revision', methods=['POST'])
@editor_required
def request_revision(book_id):
    """Request revision on a story — requires feedback."""
    from ..models import Content, ReviewQueue, EditorialNote

    story = Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    feedback = request.form.get('feedback', '').strip()
    if not feedback:
        flash('Feedback is required when requesting a revision.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    story.review_status = 'revision_requested'
    story.last_reviewed_at = datetime.utcnow()
    story.reviewed_by = current_user.wiam_id

    note = EditorialNote(
        editor_user_id=current_user.wiam_id,
        content_id=book_id,
        note_text=f'REVISION REQUESTED: {feedback}',
        note_type='revision_request',
    )
    db.session.add(note)

    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()
    if qe:
        qe.status = 'revision_requested'
        qe.reviewed_at = datetime.utcnow()
        qe.reviewed_by = current_user.wiam_id
        qe.editor_feedback = feedback

    _audit('REVISION_REQUESTED', 'BOOK', book_id, {'feedback': feedback[:500]})
    db.session.commit()

    log.info("Editor %s requested revision on story #%s", current_user.display_name, book_id)
    flash(f'Revision requested for "{story.title}".', 'info')
    return redirect(url_for('editor_studio.review', book_id=book_id))


@editor_studio_bp.route('/<int:book_id>/assign', methods=['POST'])
@editor_required
def assign_to_me(book_id):
    """Self-assign a story from the queue."""
    from ..models import Content, ReviewQueue

    Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()
    if not qe:
        flash('No queue entry found for this story.', 'error')
        return redirect(url_for('editor_studio.dashboard'))

    qe.assigned_to = current_user.wiam_id
    if qe.status == 'pending':
        qe.status = 'in_review'

    _audit('STORY_SELF_ASSIGNED', 'BOOK', book_id)
    db.session.commit()

    flash('Story assigned to you.', 'success')
    return redirect(url_for('editor_studio.review', book_id=book_id))


# ═══════════════════════════════════════════════════════════════════════════
# CHAPTER EDITING (editors can edit chapter content)
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/<int:book_id>/chapter/<int:ch_num>/save', methods=['POST'])
@csrf.exempt
@editor_required
def save_chapter(book_id, ch_num):
    """Editor saves changes to a chapter — AJAX endpoint."""
    from ..models import Content, WebBookContent

    Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    chapter = WebBookContent.query.filter_by(
        content_id=book_id, chapter_number=ch_num
    ).first_or_404()

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    old_title = chapter.chapter_title
    old_word_count = chapter.word_count

    if 'body' in data:
        chapter.body = data['body']
    if 'chapter_title' in data and data['chapter_title'].strip():
        chapter.chapter_title = data['chapter_title'].strip()
    if 'word_count' in data:
        chapter.word_count = data['word_count']

    chapter.updated_at = datetime.utcnow()
    _audit('CHAPTER_EDITED', 'CHAPTER', chapter.id, {
        'book_id': book_id,
        'chapter_number': ch_num,
        'old_title': old_title,
        'new_title': chapter.chapter_title,
        'old_words': old_word_count,
        'new_words': chapter.word_count,
    })
    db.session.commit()

    return jsonify({
        'saved': True,
        'updated_at': chapter.updated_at.isoformat(),
    })


# ═══════════════════════════════════════════════════════════════════════════
# BOOK METADATA EDITING (editors can edit title, author, synopsis, genre)
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/<int:book_id>/edit-metadata', methods=['POST'])
@csrf.exempt
@editor_required
def edit_metadata(book_id):
    """Editor updates story metadata — title, author, synopsis, genre, status."""
    from ..models import Content

    story = Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    data = request.get_json() if request.is_json else None
    if data:
        title = data.get('title', '').strip()
        author = data.get('author', '').strip()
        description = data.get('description', '').strip()
        genre = data.get('genre', '').strip()
        status = data.get('status', '').strip()
    else:
        title = request.form.get('title', '').strip()
        author = request.form.get('author', '').strip()
        description = request.form.get('description', '').strip()
        genre = request.form.get('genre', '').strip()
        status = request.form.get('status', '').strip()

    changes = {}
    if title and title != story.title:
        changes['old_title'] = story.title
        story.title = title
        changes['new_title'] = title
    if author and author != story.author:
        changes['old_author'] = story.author
        story.author = author
        changes['new_author'] = author
    if description is not None and description != (story.description or ''):
        changes['description_changed'] = True
        story.description = description[:2000]
    if genre and genre != story.genre:
        changes['old_genre'] = story.genre
        story.genre = genre
        changes['new_genre'] = genre
    if status and status in ('draft', 'ongoing', 'complete', 'published', 'hidden', 'flagged'):
        if status != story.status:
            changes['old_status'] = story.status
            story.status = status
            changes['new_status'] = status

    if not changes:
        if request.is_json:
            return jsonify({'ok': True, 'message': 'No changes made'})
        flash('No changes to save.', 'info')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    _audit('STORY_METADATA_EDITED', 'BOOK', book_id, changes)
    db.session.commit()

    log.info("Editor %s edited metadata for story #%s: %s",
             current_user.display_name, book_id, list(changes.keys()))

    if request.is_json:
        return jsonify({'ok': True, 'changes': changes})

    flash('Story details updated successfully.', 'success')
    return redirect(url_for('editor_studio.review', book_id=book_id))


@editor_studio_bp.route('/<int:book_id>/replace-cover', methods=['POST'])
@editor_required
def replace_cover(book_id):
    """Editor uploads a new cover image for a story — bypasses NSFW scan (team is trusted)."""
    from ..models import Content, ImageStore
    from ..services.cover_scanner import normalize_cover

    story = Content.query.filter(
        Content.id == book_id, Content.deleted_at.is_(None),
    ).first_or_404()

    if 'cover' not in request.files:
        flash('No file selected.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    file = request.files['cover']
    if not file or not file.filename:
        flash('No file selected.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    allowed_ext = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_ext:
        flash('Invalid image format. Use PNG, JPG, GIF, or WebP.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    img_bytes = file.read()
    ct_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
              'gif': 'image/gif', 'webp': 'image/webp'}
    content_type = ct_map.get(ext, 'image/jpeg')

    # Normalize to standard 600x900
    img_bytes, content_type = normalize_cover(img_bytes, content_type)

    # Upload to Cloudinary (no DB fallback — saves space)
    from ..services.image_service import upload_cover as cloud_upload_cover
    cloud_id = cloud_upload_cover(img_bytes, book_id, content_type)

    if not cloud_id:
        flash('Cover upload failed. Please try again.', 'error')
        return redirect(url_for('editor_studio.review', book_id=book_id))

    old_cover = story.cover_file_id
    story.cover_file_id = cloud_id

    _audit('COVER_REPLACED', 'BOOK', book_id, {
        'old_cover_id': old_cover,
        'new_cover_id': story.cover_file_id,
        'editor': current_user.display_name,
    })
    db.session.commit()

    log.info("Editor %s replaced cover for story #%s", current_user.display_name, book_id)
    flash('Cover image replaced successfully.', 'success')
    return redirect(url_for('editor_studio.review', book_id=book_id))


# ═══════════════════════════════════════════════════════════════════════════
# CONTENT BROWSE — Search & edit any book (not just review queue)
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/content')
@editor_required
def content_browse():
    """Browse all books with search/filter — editors can open any book for editing."""
    from ..models import Content, WebBookContent, User

    search_q = request.args.get('q', '').strip()
    status_filter = request.args.get('status', '')
    genre_filter = request.args.get('genre', '')
    page = max(1, request.args.get('page', 1, type=int))
    per_page = 30

    query = Content.query.filter(Content.deleted_at.is_(None))

    if search_q:
        query = query.filter(
            db.or_(
                Content.title.ilike(f'%{search_q}%'),
                Content.author.ilike(f'%{search_q}%'),
            )
        )
    if status_filter:
        query = query.filter(Content.status == status_filter)
    if genre_filter:
        query = query.filter(Content.genre == genre_filter)

    total = query.count()
    books = query.order_by(Content.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    # Enrich with chapter count
    enriched = []
    for book in books:
        ch_count = WebBookContent.query.filter_by(content_id=book.id).count()
        total_words = db.session.query(
            db.func.coalesce(db.func.sum(WebBookContent.word_count), 0)
        ).filter_by(content_id=book.id).scalar()
        creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
        enriched.append({
            'book': book,
            'ch_count': ch_count,
            'total_words': total_words,
            'creator': creator,
        })

    total_pages = (total + per_page - 1) // per_page

    from ..models import Genre
    genres = Genre.query.order_by(Genre.name).all()

    return render_template('editor_studio/content_browse.html',
        items=enriched,
        search_q=search_q,
        status_filter=status_filter,
        genre_filter=genre_filter,
        page=page,
        total_pages=total_pages,
        total=total,
        genres=genres,
    )


# ═══════════════════════════════════════════════════════════════════════════
# MY REVIEWS — Personal review history
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/my-reviews')
@editor_required
def my_reviews():
    """Editor's personal review history."""
    from ..models import ReviewQueue, Content

    reviews = ReviewQueue.query.filter_by(
        reviewed_by=current_user.wiam_id
    ).order_by(ReviewQueue.reviewed_at.desc()).limit(100).all()

    enriched = []
    for r in reviews:
        story = Content.query.get(r.content_id)
        if story:
            enriched.append({'queue': r, 'story': story})

    return render_template('editor_studio/my_reviews.html', reviews=enriched)


# ═══════════════════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════════════════

@editor_studio_bp.route('/stats')
@editor_required
def stats():
    """Editor performance stats as JSON."""
    from ..models import ReviewQueue
    from datetime import timedelta

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    tid = current_user.wiam_id
    total = ReviewQueue.query.filter_by(reviewed_by=tid).count()
    today = ReviewQueue.query.filter(
        ReviewQueue.reviewed_by == tid,
        ReviewQueue.reviewed_at >= today_start,
    ).count()
    this_week = ReviewQueue.query.filter(
        ReviewQueue.reviewed_by == tid,
        ReviewQueue.reviewed_at >= week_ago,
    ).count()
    approved = ReviewQueue.query.filter_by(reviewed_by=tid, status='approved').count()
    rejected = ReviewQueue.query.filter_by(reviewed_by=tid, status='rejected').count()

    return jsonify({
        'total': total,
        'today': today,
        'this_week': this_week,
        'approved': approved,
        'rejected': rejected,
    })
