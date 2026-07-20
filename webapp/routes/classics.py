"""
Classic Seed System — Routes
==============================
Founder-only dashboard for fetching, reviewing, publishing, and managing
public-domain classic novels from Project Gutenberg.

Also provides public-facing routes for classic book detail and reading.
"""
import logging
from functools import wraps
from datetime import datetime, date
from flask import Blueprint, render_template, redirect, url_for, request, flash, session, jsonify
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import ClassicBook, ClassicChapter, ClassicFetchLog, Content

log = logging.getLogger(__name__)

classics_bp = Blueprint('classics', __name__, url_prefix='/classics')


def founder_required(f):
    """Decorator: only the founder can access."""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if not current_user.is_founder:
            flash('Access denied.', 'error')
            return redirect(url_for('home.home'))
        return f(*args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════════════════
# FOUNDER DASHBOARD — Content Seeder
# ═══════════════════════════════════════════════════════════════════════════

@classics_bp.route('/dashboard')
@founder_required
def dashboard():
    """Main classics dashboard — drafts + published + fetch log."""
    drafts = ClassicBook.query.filter_by(status='draft')\
        .order_by(ClassicBook.created_at.desc()).all()
    published = ClassicBook.query.filter_by(status='published')\
        .order_by(ClassicBook.published_at.desc()).all()
    recent_log = ClassicFetchLog.query.order_by(ClassicFetchLog.fetched_at.desc()).limit(20).all()

    stats = {
        'total_classics': ClassicBook.query.count(),
        'draft_count': len(drafts),
        'published_count': len(published),
        'total_chapters': ClassicChapter.query.count(),
    }

    return render_template('founder/classics_dashboard.html',
                           drafts=drafts, published=published,
                           recent_log=recent_log, stats=stats)


@classics_bp.route('/fetch', methods=['POST'])
@founder_required
def fetch_books():
    """Fetch classic novels from Gutendex API."""
    from ..services.classics_service import fetch_classic_novels

    count = int(request.form.get('count', 5))
    count = min(count, 10)  # cap at 10 per request
    topic = request.form.get('topic', 'fiction').strip() or 'fiction'

    # Pass topic as genre so Gutendex uses genre-specific search
    # and the fetched books are tagged with the correct genre
    genre = topic if topic.lower() != 'fiction' else None
    result = fetch_classic_novels(count=count, topic=topic, genre=genre)

    fetched_count = len(result['fetched'])
    skipped_count = len(result['skipped'])
    error_count = len(result['errors'])

    if fetched_count > 0:
        flash(f'Successfully fetched {fetched_count} classic novel(s). '
              f'{skipped_count} skipped, {error_count} errors.', 'success')
    elif skipped_count > 0:
        flash(f'No new novels fetched. {skipped_count} skipped (duplicates or filtered).', 'warning')
    else:
        flash('Could not fetch any novels. Check the logs for details.', 'error')

    return redirect(url_for('classics.dashboard'))


@classics_bp.route('/review/<int:book_id>')
@founder_required
def review(book_id):
    """Review a classic book draft — view parsed chapters before publishing."""
    book = ClassicBook.query.get_or_404(book_id)
    chapters = ClassicChapter.query.filter_by(book_id=book.id)\
        .order_by(ClassicChapter.chapter_number).all()
    return render_template('founder/classics_review.html', book=book, chapters=chapters)


@classics_bp.route('/publish/<int:book_id>', methods=['POST'])
@founder_required
def publish(book_id):
    """Publish a classic book with scheduled chapter releases."""
    from ..services.classics_service import publish_classic
    ok, msg = publish_classic(book_id)
    if ok:
        flash(f'Published! {msg}', 'success')
    else:
        flash(msg, 'error')
    return redirect(url_for('classics.dashboard'))


@classics_bp.route('/delete/<int:book_id>', methods=['POST'])
@founder_required
def delete(book_id):
    """Permanently delete a classic book and all its chapters."""
    from ..services.classics_service import delete_classic
    ok, msg = delete_classic(book_id)
    if ok:
        flash(msg, 'success')
    else:
        flash(msg, 'error')
    return redirect(url_for('classics.dashboard'))


@classics_bp.route('/log/delete/<int:log_id>', methods=['POST'])
@founder_required
def delete_log(log_id):
    """Delete a fetch log entry and its associated ClassicBook (if any)."""
    entry = ClassicFetchLog.query.get_or_404(log_id)
    gid = entry.gutenberg_id
    # Also delete the ClassicBook if one exists for this gutenberg_id
    book = ClassicBook.query.filter_by(gutenberg_id=gid).first()
    if book:
        from ..services.classics_service import delete_classic
        delete_classic(book.id)
    db.session.delete(entry)
    db.session.commit()
    flash(f'Log entry #{gid} deleted.', 'success')
    return redirect(url_for('classics.dashboard'))


@classics_bp.route('/log/return/<int:log_id>', methods=['POST'])
@founder_required
def return_log(log_id):
    """Return a fetched/published book back to draft review."""
    entry = ClassicFetchLog.query.get_or_404(log_id)
    book = ClassicBook.query.filter_by(gutenberg_id=entry.gutenberg_id).first()
    if not book:
        flash('No book found for this log entry.', 'warning')
        return redirect(url_for('classics.dashboard'))

    if book.status == 'published' and book.content_id:
        # Remove the mirrored Content so the book goes back to draft
        from ..routes.studio import _hard_delete_book
        _hard_delete_book(book.content_id)
        # Re-fetch book since _hard_delete_book may have nullified content_id
        book = ClassicBook.query.get(book.id)

    if book:
        book.status = 'draft'
        book.published_at = None
        book.content_id = None
        db.session.commit()
        flash(f'"{book.title}" returned to draft review.', 'success')
    else:
        flash('Book could not be found after cleanup.', 'error')

    return redirect(url_for('classics.dashboard'))


@classics_bp.route('/manage')
@founder_required
def manage():
    """Manage published classics — view stats, delete underperformers."""
    books = ClassicBook.query.filter_by(status='published')\
        .order_by(ClassicBook.published_at.desc()).all()
    return render_template('founder/classics_manage.html', books=books)


# ═══════════════════════════════════════════════════════════════════════════
# PUBLIC — Classic Book Detail & Reading
# ═══════════════════════════════════════════════════════════════════════════

@classics_bp.route('/book/<int:book_id>')
def book_detail(book_id):
    """Public classic book detail page."""
    book = ClassicBook.query.filter_by(id=book_id, status='published').first_or_404()

    # Increment views — once per user per day (sync to mirrored Content too)
    _view_key = f'classic_viewed_{book_id}_{date.today().isoformat()}'
    if _view_key not in session:
        book.views = (book.views or 0) + 1
        if book.content_id:
            mirror = Content.query.get(book.content_id)
            if mirror:
                mirror.views = (mirror.views or 0) + 1
        session[_view_key] = 1
        db.session.commit()

    chapters = ClassicChapter.query.filter(
        ClassicChapter.book_id == book.id,
        ClassicChapter.publish_date <= datetime.utcnow()
    ).order_by(ClassicChapter.chapter_number).all()

    total_chapters = ClassicChapter.query.filter_by(book_id=book.id).count()

    return render_template('classics_detail.html',
                           book=book, chapters=chapters,
                           total_chapters=total_chapters)


@classics_bp.route('/book/<int:book_id>/read/<int:chapter_num>')
def read_chapter(book_id, chapter_num):
    """Read a classic chapter in the WiamApp web reader."""
    book = ClassicBook.query.filter_by(id=book_id, status='published').first_or_404()

    chapter = ClassicChapter.query.filter_by(
        book_id=book.id, chapter_number=chapter_num
    ).first_or_404()

    # Only allow reading released chapters
    if not chapter.is_released:
        flash('This chapter has not been released yet.', 'warning')
        return redirect(url_for('classics.book_detail', book_id=book_id))

    # Get prev/next chapter info
    prev_ch = ClassicChapter.query.filter(
        ClassicChapter.book_id == book.id,
        ClassicChapter.chapter_number < chapter_num,
        ClassicChapter.publish_date <= datetime.utcnow()
    ).order_by(ClassicChapter.chapter_number.desc()).first()

    next_ch = ClassicChapter.query.filter(
        ClassicChapter.book_id == book.id,
        ClassicChapter.chapter_number > chapter_num,
        ClassicChapter.publish_date <= datetime.utcnow()
    ).order_by(ClassicChapter.chapter_number.asc()).first()

    total_chapters = ClassicChapter.query.filter(
        ClassicChapter.book_id == book.id,
        ClassicChapter.publish_date <= datetime.utcnow()
    ).count()

    from ..services.classics_service import _plain_text_to_html
    chapter_html = _plain_text_to_html(chapter.content) if chapter.content else ''

    return render_template('classics_reader.html',
                           book=book, chapter=chapter,
                           chapter_html=chapter_html,
                           prev_ch=prev_ch, next_ch=next_ch,
                           total_chapters=total_chapters)
