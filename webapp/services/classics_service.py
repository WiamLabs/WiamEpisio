"""
WiamApp — Classic Seed System Service
=======================================
Fetches public-domain novels from Project Gutenberg via the Gutendex API,
parses them into chapters, and stores them as ClassicBook + ClassicChapter
records.  Entirely isolated from the core creator ecosystem.

Can be removed later by dropping the w_classics_* tables and deleting
this file + the classics route/template files.
"""
import re
import random
import logging
import requests
from datetime import datetime, timedelta
from flask import current_app

log = logging.getLogger(__name__)

# ── Safety / content filters ────────────────────────────────────────────────

# Subjects that must NOT appear in a book's metadata
BLOCKED_SUBJECTS = {
    'politics', 'law', 'legal', 'erotic', 'adult', 'erotica',
    'pornography', 'violence', 'sexual', 'explicit', 'crime',
    'abuse', 'horror', 'war', 'slavery',
}

# Keywords in title / subject text that indicate mature content (13+ filter)
MATURE_KEYWORDS = re.compile(
    r'\b(violence|sexual|erotic|explicit|crime|abuse|obscene|'
    r'pornograph|incest|rape|torture|bondage|sadis|masochis)\b',
    re.IGNORECASE,
)

# Gutenberg license / legal blocks to strip from plain-text downloads
_LICENSE_START = re.compile(
    r'(\*{3,}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG)',
    re.IGNORECASE,
)
_LICENSE_END = re.compile(
    r'(\*{3,}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG)',
    re.IGNORECASE,
)

# Chapter heading patterns
_CHAPTER_RE = re.compile(
    r'^(?:CHAPTER|Chapter|BOOK|Book|PART|Part|VOLUME|Volume)'
    r'\s+([IVXLCDM]+|\d+)'
    r'(?:\s*[.:\-—]+\s*(.*))?$',
    re.MULTILINE,
)

MIN_CHAPTERS = 5
MIN_CHAPTER_WORDS = 200  # skip very short pseudo-chapters


def _plain_text_to_html(text):
    """Convert Gutenberg plain text into HTML with proper <p> paragraph tags.

    Gutenberg text uses blank lines (double newlines) as paragraph separators.
    Single newlines within a paragraph are treated as soft wraps.
    """
    import html as _html
    if not text:
        return ''
    # Normalise line endings
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # Split on blank lines (one or more empty lines)
    raw_paragraphs = re.split(r'\n\s*\n', text)
    paragraphs = []
    for p in raw_paragraphs:
        # Collapse internal single newlines into spaces (soft-wrap)
        p = re.sub(r'\n', ' ', p).strip()
        if p:
            paragraphs.append(f'<p>{_html.escape(p)}</p>')
    return '\n'.join(paragraphs)


# ── Gutendex API helpers ────────────────────────────────────────────────────

GUTENDEX_BASE = 'https://gutendex.com/books/'


# Map user-facing genre names to Gutendex search/topic terms
_GENRE_SEARCH_MAP = {
    'romance': 'romance love',
    'fantasy': 'fantasy magic',
    'horror': 'horror ghost supernatural',
    'mystery': 'mystery detective',
    'science fiction': 'science fiction',
    'adventure': 'adventure',
    'thriller': 'thriller suspense',
    'drama': 'drama',
    'comedy': 'comedy humor',
    'historical fiction': 'historical fiction',
    'gothic fiction': 'gothic',
    'poetry': 'poetry',
    'western': 'western frontier',
    'biography': 'biography',
    'philosophy': 'philosophy',
    'children': 'children fairy tales',
}


def _fetch_gutendex_page(page_url=None, topic='fiction', page=1, search_term=None):
    """Fetch a single page of results from the Gutendex API."""
    url = page_url or GUTENDEX_BASE
    params = {}
    if not page_url:
        params = {
            'languages': 'en',
            'mime_type': 'text/plain',
            'page': page,
        }
        # Use 'search' for genre-specific queries (matches title + subjects)
        if search_term:
            params['search'] = search_term
        else:
            params['topic'] = topic
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.error("Gutendex API error: %s", e)
        return None


def _is_safe_book(book_data):
    """Return (True, '') if the book passes all safety filters, else (False, reason)."""
    subjects = ' '.join(book_data.get('subjects', []) + book_data.get('bookshelves', []))
    subjects_lower = subjects.lower()

    # Check blocked subjects
    for word in BLOCKED_SUBJECTS:
        if word in subjects_lower:
            return False, f'blocked subject: {word}'

    # Check mature keywords in subjects + title
    text_to_check = subjects + ' ' + (book_data.get('title') or '')
    if MATURE_KEYWORDS.search(text_to_check):
        return False, 'mature keyword detected'

    return True, ''


def _get_plain_text_url(book_data):
    """Extract the best plain-text download URL from Gutendex book data."""
    formats = book_data.get('formats', {})
    # Prefer UTF-8 plain text
    for mime in ['text/plain; charset=utf-8', 'text/plain', 'text/plain; charset=us-ascii']:
        if mime in formats:
            url = formats[mime]
            # Skip .zip files
            if not url.endswith('.zip'):
                return url
    return None


def _download_text(url):
    """Download the plain text of a book."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        log.error("Failed to download text from %s: %s", url, e)
        return None


def _strip_gutenberg_license(text):
    """Remove Project Gutenberg license headers and footers from text."""
    # Find start of actual content (after license header)
    start_match = _LICENSE_START.search(text)
    if start_match:
        # Find the end of the header line (next blank line after START marker)
        after_start = text[start_match.end():]
        # Skip past the "*** START OF..." line to the next double newline
        blank = re.search(r'\n\s*\n', after_start)
        if blank:
            text = after_start[blank.end():]
        else:
            text = after_start

    # Remove license footer
    end_match = _LICENSE_END.search(text)
    if end_match:
        text = text[:end_match.start()]

    return text.strip()


def _parse_chapters(text):
    """Split cleaned text into chapters using regex patterns.

    Returns a list of dicts: [{chapter_number, chapter_title, content, word_count}]
    """
    # Find all chapter headings with positions
    matches = list(_CHAPTER_RE.finditer(text))
    if len(matches) < MIN_CHAPTERS:
        return []

    chapters = []
    for i, match in enumerate(matches):
        ch_num = i + 1
        ch_title = (match.group(2) or '').strip()
        if not ch_title:
            ch_title = f'Chapter {match.group(1)}'

        # Content is from end of this heading to start of next heading
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        wc = len(content.split())

        if wc < MIN_CHAPTER_WORDS:
            continue

        chapters.append({
            'chapter_number': ch_num,
            'chapter_title': ch_title,
            'content': content,
            'word_count': wc,
        })

    # Re-number after filtering short chapters
    for i, ch in enumerate(chapters):
        ch['chapter_number'] = i + 1

    return chapters


def _get_cover_image(book_data):
    """Get cover image URL from Gutendex data."""
    formats = book_data.get('formats', {})
    for mime in ['image/jpeg', 'image/png']:
        if mime in formats:
            return formats[mime]
    return ''


def _get_author_name(book_data):
    """Extract author name from Gutendex data."""
    authors = book_data.get('authors', [])
    if authors:
        return authors[0].get('name', 'Unknown')
    return 'Unknown'


def _get_genre(book_data):
    """Try to extract a genre from subjects/bookshelves."""
    subjects = book_data.get('subjects', []) + book_data.get('bookshelves', [])
    genre_map = {
        'adventure': 'Adventure',
        'romance': 'Romance',
        'mystery': 'Mystery',
        'science fiction': 'Science Fiction',
        'fantasy': 'Fantasy',
        'horror': 'Horror',
        'thriller': 'Thriller',
        'drama': 'Drama',
        'comedy': 'Comedy',
        'humor': 'Comedy',
        'satire': 'Comedy',
        'historical': 'Historical Fiction',
        'history': 'History',
        'children': "Children's Literature",
        'detective': 'Mystery',
        'gothic': 'Gothic Fiction',
        'poetry': 'Poetry',
        'verse': 'Poetry',
        'philosophy': 'Philosophy',
        'biography': 'Biography',
        'autobiography': 'Biography',
        'religion': 'Religion',
        'spiritual': 'Religion',
        'education': 'Education',
        'war': 'War & Military',
        'western': 'Western',
        'crime': 'Crime',
        'political': 'Political Fiction',
        'nature': 'Nature & Environment',
        'travel': 'Travel',
    }
    subjects_lower = ' '.join(subjects).lower()
    for key, genre in genre_map.items():
        if key in subjects_lower:
            return genre
    return 'Classic Fiction'


# ── Main fetch-and-store function ────────────────────────────────────────────

def fetch_classic_novels(count=5, topic='fiction', genre=None):
    """Fetch *count* classic novels from Gutendex, parse chapters, store as drafts.

    If genre is provided, it will be used as the search term AND as the
    forced genre for all fetched books (overriding subject-based detection).

    Returns dict with 'fetched', 'skipped', 'errors' lists.
    """
    from ..models import ClassicBook, ClassicChapter, ClassicFetchLog
    from ..extensions import db

    result = {'fetched': [], 'skipped': [], 'errors': []}
    # Start from a low random page to avoid 404s on small result sets
    page = random.randint(1, 5)
    fetched = 0
    pages_scanned = 0
    max_pages = 15  # safety limit — scan up to 15 pages from start

    # Resolve genre search term
    search_term = None
    forced_genre = None
    if genre:
        genre_lower = genre.strip().lower()
        search_term = _GENRE_SEARCH_MAP.get(genre_lower, genre_lower)
        # Capitalize for storage
        forced_genre = genre.strip().title()
        # Map common names
        _nice_names = {
            'Science Fiction': 'Science Fiction', 'Historical Fiction': 'Historical Fiction',
            'Gothic Fiction': 'Gothic Fiction', "Children'S Literature": "Children's Literature",
            'Children': "Children's Literature",
        }
        forced_genre = _nice_names.get(forced_genre, forced_genre)

    while fetched < count and pages_scanned < max_pages:
        data = _fetch_gutendex_page(topic=topic, page=page, search_term=search_term)
        if not data or not data.get('results'):
            # If we started above page 1 and got nothing, retry from page 1
            if page > 1 and pages_scanned == 0:
                page = 1
                continue
            break

        for book_data in data['results']:
            if fetched >= count:
                break

            gid = book_data.get('id')
            title = book_data.get('title', 'Untitled')

            # Already fetched or in DB?
            existing = ClassicBook.query.filter_by(gutenberg_id=gid).first()
            if existing:
                result['skipped'].append({'id': gid, 'title': title, 'reason': 'already in DB'})
                continue

            logged = ClassicFetchLog.query.filter_by(gutenberg_id=gid).first()
            if logged:
                result['skipped'].append({'id': gid, 'title': title, 'reason': 'previously processed'})
                continue

            # Safety filter
            safe, reason = _is_safe_book(book_data)
            if not safe:
                db.session.add(ClassicFetchLog(
                    gutenberg_id=gid, title=title, status='skipped', reason_skipped=reason
                ))
                db.session.commit()
                result['skipped'].append({'id': gid, 'title': title, 'reason': reason})
                continue

            # Get plain text URL
            text_url = _get_plain_text_url(book_data)
            if not text_url:
                db.session.add(ClassicFetchLog(
                    gutenberg_id=gid, title=title, status='skipped', reason_skipped='no plain text'
                ))
                db.session.commit()
                result['skipped'].append({'id': gid, 'title': title, 'reason': 'no plain text available'})
                continue

            # Download and parse
            raw_text = _download_text(text_url)
            if not raw_text:
                db.session.add(ClassicFetchLog(
                    gutenberg_id=gid, title=title, status='error', reason_skipped='download failed'
                ))
                db.session.commit()
                result['errors'].append({'id': gid, 'title': title, 'reason': 'download failed'})
                continue

            cleaned = _strip_gutenberg_license(raw_text)
            chapters = _parse_chapters(cleaned)

            if len(chapters) < MIN_CHAPTERS:
                db.session.add(ClassicFetchLog(
                    gutenberg_id=gid, title=title, status='skipped',
                    reason_skipped=f'only {len(chapters)} chapters (need {MIN_CHAPTERS}+)'
                ))
                db.session.commit()
                result['skipped'].append({
                    'id': gid, 'title': title,
                    'reason': f'only {len(chapters)} chapters'
                })
                continue

            # Create ClassicBook
            total_words = sum(ch['word_count'] for ch in chapters)
            description_parts = book_data.get('subjects', [])[:3]
            description = '. '.join(description_parts) if description_parts else ''

            # Use forced genre if specified, otherwise detect from subjects
            book_genre = forced_genre if forced_genre else _get_genre(book_data)

            classic = ClassicBook(
                title=title,
                author=_get_author_name(book_data),
                gutenberg_id=gid,
                description=description,
                cover_image=_get_cover_image(book_data),
                language='en',
                genre=book_genre,
                word_count=total_words,
                status='draft',
                source='gutenberg',
            )
            db.session.add(classic)
            db.session.flush()  # get classic.id

            # Create chapters
            for ch in chapters:
                db.session.add(ClassicChapter(
                    book_id=classic.id,
                    chapter_number=ch['chapter_number'],
                    chapter_title=ch['chapter_title'],
                    content=ch['content'],
                    word_count=ch['word_count'],
                ))

            # Log success
            db.session.add(ClassicFetchLog(
                gutenberg_id=gid, title=title, status='fetched'
            ))
            db.session.commit()

            fetched += 1
            result['fetched'].append({
                'id': gid, 'title': title, 'author': classic.author,
                'chapters': len(chapters), 'words': total_words,
                'classic_id': classic.id,
            })
            log.info("Fetched classic: %s by %s (%d chapters, %d words)",
                     title, classic.author, len(chapters), total_words)

        # Next page
        pages_scanned += 1
        next_url = data.get('next')
        if next_url:
            page += 1
        else:
            break

    return result


# ── Publishing helpers ───────────────────────────────────────────────────────

def publish_classic(book_id):
    """Publish a classic book with scheduled chapter releases.

    Creates a mirrored Content + WebBookContent record so the classic
    appears in all existing home/browse sections alongside creator books.
    Chapter 1 → immediate, Chapter 2 → +1 day, Chapter 3 → +2 days, etc.
    """
    from ..models import ClassicBook, ClassicChapter, Content, WebBookContent
    from ..extensions import db

    book = ClassicBook.query.get(book_id)
    if not book:
        return False, 'Book not found'
    if book.status == 'published':
        return False, 'Already published'

    now = datetime.utcnow()

    # ── 1. Schedule chapter release dates on ClassicChapter ──
    chapters = ClassicChapter.query.filter_by(book_id=book.id)\
        .order_by(ClassicChapter.chapter_number).all()

    for ch in chapters:
        days_offset = ch.chapter_number - 1  # ch1 = 0 days, ch2 = 1 day, etc.
        ch.publish_date = now + timedelta(days=days_offset)

    # ── 2. Create mirrored Content record ──
    cover_fid = None
    if book.cover_image:
        cover_fid = f'ext_{book.cover_image}'

    content = Content(
        title=book.title,
        author=book.author,
        description=book.description or '',
        genre=book.genre or 'Fiction',
        type='book',
        status='ongoing',
        source='gutenberg',
        algorithm_weight=0,
        cover_file_id=cover_fid,
        creator_wiam_id=None,
        price=0.0,
        views=0,
        published_at=now,
        created_at=now,
    )
    db.session.add(content)
    db.session.flush()  # get content.id

    # ── 3. Create mirrored WebBookContent chapters ──
    for ch in chapters:
        wbc = WebBookContent(
            content_id=content.id,
            chapter_number=ch.chapter_number,
            chapter_title=ch.chapter_title or f'Chapter {ch.chapter_number}',
            body=_plain_text_to_html(ch.content) if ch.content else '',
            word_count=ch.word_count or 0,
            status='published' if ch.chapter_number == 1 else 'draft',
        )
        db.session.add(wbc)

    # ── 4. Link classic ↔ content and mark published ──
    book.status = 'published'
    book.published_at = now
    book.content_id = content.id

    db.session.commit()
    log.info("Published classic #%d '%s' → Content #%d, %d chapters scheduled",
             book.id, book.title, content.id, len(chapters))

    # Notify ALL readers about the new classic book
    try:
        from .notifications import notify_classic_book_published
        notify_classic_book_published(content.id, book.title, book.author)
    except Exception as e:
        log.warning("Classic publish notification failed: %s", str(e)[:120])

    return True, f'{len(chapters)} chapters scheduled'


def release_due_classic_chapters():
    """Release classic chapters whose publish_date has arrived.

    Called periodically (e.g. before_request with cooldown).
    Finds ClassicChapter records due for release and sets the corresponding
    WebBookContent status to 'published'.  When all chapters of a book are
    released, sets the Content status to 'complete'.
    """
    from ..models import ClassicBook, ClassicChapter, Content, WebBookContent
    from ..extensions import db

    now = datetime.utcnow()

    # Find due chapters that haven't been synced yet, ordered by publish_date
    # so we release in chronological order (oldest first)
    due_chapters = db.session.query(ClassicChapter, ClassicBook).join(
        ClassicBook, ClassicChapter.book_id == ClassicBook.id
    ).filter(
        ClassicBook.status == 'published',
        ClassicBook.content_id != None,
        ClassicChapter.publish_date != None,
        ClassicChapter.publish_date <= now,
    ).order_by(ClassicChapter.publish_date.asc()).all()

    released = 0
    content_ids_to_check = set()
    released_info = []  # (content_id, book_title, chapter_num, chapter_title)

    for ch, classic in due_chapters:
        # Find the mirrored WebBookContent
        wbc = WebBookContent.query.filter_by(
            content_id=classic.content_id,
            chapter_number=ch.chapter_number,
        ).first()
        if wbc and wbc.status == 'draft':
            wbc.status = 'published'
            released += 1
            content_ids_to_check.add(classic.content_id)
            released_info.append((
                classic.content_id, classic.title,
                ch.chapter_number, ch.chapter_title or '',
            ))

    # Check if any books are now fully released → set to 'complete'
    for cid in content_ids_to_check:
        drafts_left = WebBookContent.query.filter_by(
            content_id=cid, status='draft'
        ).count()
        if drafts_left == 0:
            content_rec = Content.query.get(cid)
            if content_rec and content_rec.status == 'ongoing':
                content_rec.status = 'complete'

    if released > 0:
        db.session.commit()
        log.info("Released %d classic chapters across %d books", released, len(content_ids_to_check))

        # Notify readers who are following these books about new chapters
        try:
            from .notifications import notify_classic_chapter_released
            for cid, btitle, chnum, chtitle in released_info:
                notify_classic_chapter_released(cid, btitle, chnum, chtitle)
        except Exception as e:
            log.warning("Classic chapter notification failed: %s", str(e)[:120])

    return released


def delete_classic(book_id):
    """Completely remove a classic book, its chapters, AND the mirrored Content record."""
    from ..routes.studio import _hard_delete_book
    from ..extensions import db
    from ..models import ClassicBook

    book = ClassicBook.query.get(book_id)
    if not book:
        return False, 'Book not found'

    title = book.title

    # Delete mirrored Content + ALL related records via the shared hard-delete
    if book.content_id:
        _hard_delete_book(book.content_id)

    # If hard_delete already removed the classic link, re-fetch
    book = ClassicBook.query.get(book_id)
    if book:
        db.session.delete(book)  # cascade deletes ClassicChapter records
        db.session.commit()

    log.info("Deleted classic #%d '%s' (+ mirrored Content + all related data)", book_id, title)
    return True, f'Deleted "{title}"'


def _repair_classic_paragraphs():
    """One-time repair: convert plain-text WebBookContent.body to HTML paragraphs
    for already-published classic books whose body lacks <p> tags."""
    from ..models import ClassicBook, WebBookContent
    from ..extensions import db

    published = ClassicBook.query.filter(
        ClassicBook.status == 'published',
        ClassicBook.content_id != None,
    ).all()

    fixed = 0
    for book in published:
        chapters = WebBookContent.query.filter_by(content_id=book.content_id).all()
        for wbc in chapters:
            if wbc.body and '<p>' not in wbc.body[:100]:
                wbc.body = _plain_text_to_html(wbc.body)
                fixed += 1

    if fixed:
        db.session.commit()
        log.info("Repaired paragraph formatting on %d classic chapter(s)", fixed)


def migrate_existing_classics():
    """One-time: create Content mirrors for any already-published classics that lack one.

    Sets up scheduled chapter release (ch1 = now, ch2 = +1 day, ch3 = +2 days, etc.)
    so the before_request scheduler can drip-feed them day by day.
    """
    from ..models import ClassicBook, ClassicChapter, Content, WebBookContent
    from ..extensions import db

    orphans = ClassicBook.query.filter(
        ClassicBook.status == 'published',
        ClassicBook.content_id == None,
    ).all()

    if not orphans:
        return 0

    now = datetime.utcnow()
    count = 0

    for book in orphans:
        cover_fid = f'ext_{book.cover_image}' if book.cover_image else None
        content = Content(
            title=book.title,
            author=book.author,
            description=book.description or '',
            genre=book.genre or 'Fiction',
            type='book',
            status='ongoing',
            source='gutenberg',
            algorithm_weight=0,
            cover_file_id=cover_fid,
            creator_wiam_id=None,
            price=0.0,
            views=book.views or 0,
            published_at=book.published_at or now,
            created_at=book.created_at or now,
        )
        db.session.add(content)
        db.session.flush()

        chapters = ClassicChapter.query.filter_by(book_id=book.id)\
            .order_by(ClassicChapter.chapter_number).all()

        for ch in chapters:
            # Set publish_date if missing so the scheduler can release chapters
            if not ch.publish_date:
                ch.publish_date = now + timedelta(days=ch.chapter_number - 1)

            is_first = ch.chapter_number == 1
            wbc = WebBookContent(
                content_id=content.id,
                chapter_number=ch.chapter_number,
                chapter_title=ch.chapter_title or f'Chapter {ch.chapter_number}',
                body=_plain_text_to_html(ch.content) if ch.content else '',
                word_count=ch.word_count or 0,
                status='published' if is_first else 'draft',
            )
            db.session.add(wbc)

        book.content_id = content.id
        count += 1

    db.session.commit()
    log.info("Migrated %d existing classics to Content table (scheduled release)", count)

    # ── Repair: fix paragraph formatting on existing WebBookContent ──
    _repair_classic_paragraphs()

    # ── Repair: fix already-migrated classics with missing publish_date ──
    broken = ClassicBook.query.filter(
        ClassicBook.status == 'published',
        ClassicBook.content_id != None,
    ).all()

    repaired = 0
    for book in broken:
        chapters = ClassicChapter.query.filter_by(book_id=book.id)\
            .order_by(ClassicChapter.chapter_number).all()

        needs_fix = any(ch.publish_date is None for ch in chapters)
        if not needs_fix:
            continue

        now_repair = datetime.utcnow()
        for ch in chapters:
            if not ch.publish_date:
                ch.publish_date = now_repair + timedelta(days=ch.chapter_number - 1)

        # Ensure ch1 WebBookContent is published, rest are draft
        for ch in chapters:
            wbc = WebBookContent.query.filter_by(
                content_id=book.content_id,
                chapter_number=ch.chapter_number,
            ).first()
            if wbc:
                if ch.chapter_number == 1:
                    wbc.status = 'published'
                elif ch.publish_date > now_repair:
                    wbc.status = 'draft'

        repaired += 1

    if repaired:
        db.session.commit()
        log.info("Repaired scheduling for %d already-migrated classics", repaired)

    return count
