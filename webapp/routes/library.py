from flask import Blueprint, render_template, jsonify, request
from flask_login import login_required, current_user
from ..models import Content, Access, ReadingProgress, UserLibrary, ChapterUnlock
from ..extensions import db, csrf

library_bp = Blueprint('library', __name__)


@library_bp.route('/')
@login_required
def my_library():
    """My Library — the reader's personal bookshelf with sections."""
    uid = current_user.wiam_id or current_user.id

    # ── Saved Books (explicitly added by user) ──
    lib_entries = UserLibrary.query.filter_by(user_id=uid).order_by(
        UserLibrary.added_at.desc()
    ).all()
    lib_ids = [e.content_id for e in lib_entries]

    # ── Continue Reading (most recent active reads, top 10) ──
    all_progress = ReadingProgress.query.filter_by(user_id=uid).order_by(
        ReadingProgress.last_read_at.desc()
    ).all()
    progress_map = {p.content_id: p for p in all_progress}
    continue_ids = [p.content_id for p in all_progress[:10]]

    # ── Reading History (every book ever opened, full list) ──
    history_ids = [p.content_id for p in all_progress]

    # ── Unlocked Books (chapters purchased with coins) ──
    unlocked_ids = []
    try:
        unlocked_rows = db.session.query(
            ChapterUnlock.content_id
        ).filter_by(user_id=uid).distinct().all()
        unlocked_ids = [r[0] for r in unlocked_rows]
    except Exception:
        pass

    # ── Fetch all books in one query ──
    all_ids = list(set(lib_ids + continue_ids + history_ids + unlocked_ids))
    book_map = {}
    if all_ids:
        book_map = {b.id: b for b in Content.query.filter(
            Content.id.in_(all_ids), Content.deleted_at == None
        ).all()}

    saved_books = [book_map[cid] for cid in lib_ids if cid in book_map]
    continue_books = [{'book': book_map[cid], 'progress': progress_map[cid]}
                      for cid in continue_ids if cid in book_map]
    history_books = [{'book': book_map[cid], 'progress': progress_map[cid]}
                     for cid in history_ids if cid in book_map]
    unlocked_books = [book_map[cid] for cid in unlocked_ids if cid in book_map]

    return render_template('library.html',
                           saved_books=saved_books,
                           continue_books=continue_books,
                           history_books=history_books,
                           unlocked_books=unlocked_books,
                           progress_map=progress_map,
                           lib_ids=set(lib_ids))


@library_bp.route('/toggle', methods=['POST'])
@csrf.exempt
@login_required
def toggle_library():
    """Add or remove a book from the user's library."""
    uid = current_user.wiam_id or current_user.id
    content_id = request.form.get('content_id', type=int) or request.json.get('content_id')
    if not content_id:
        return jsonify({'error': 'Missing content_id'}), 400

    existing = UserLibrary.query.filter_by(user_id=uid, content_id=content_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'in_library': False})
    else:
        db.session.add(UserLibrary(user_id=uid, content_id=content_id))
        db.session.commit()
        return jsonify({'in_library': True})


@library_bp.route('/check/<int:content_id>')
@login_required
def check_library(content_id):
    """Check if a book is in the user's library (for AJAX)."""
    uid = current_user.wiam_id or current_user.id
    exists = UserLibrary.query.filter_by(user_id=uid, content_id=content_id).first() is not None
    return jsonify({'in_library': exists})


