"""
WiamApp — Trust & Engagement Engine (S12, S13)
===============================================
S12: Reader Trust Score — computed from account age, warning history,
     engagement quality, and behavioral signals. Stored on users.reader_trust_score.
S13: Fake Engagement Filter — detects and discounts suspicious engagement
     (mass ratings from new/low-trust accounts, duplicate comments, etc.)
"""
import logging
import time
from datetime import datetime, timedelta
from collections import defaultdict

log = logging.getLogger(__name__)

# ── Cache for trust scores (avoid recomputing on every request) ──────────────
_trust_cache = {}  # { user_id: (score, timestamp) }
_TRUST_CACHE_TTL = 600  # 10 minutes


# =============================================================================
# S12: Reader Trust Score
# =============================================================================

def compute_reader_trust(user_id, save=True):
    """Compute a reader's trust score (0.0–1.0) based on behavioral signals.

    Factors (positive):
      - Account age: longer = more trusted
      - Engagement quality: comments, ratings, reading progress
      - Consistent behavior: regular usage over time

    Factors (negative):
      - Warnings and strikes
      - Rate limit violations (burst triggers)
      - Low-effort engagement patterns

    Args:
        user_id: int — User.id
        save: bool — persist to DB

    Returns: float (0.0–1.0)
    """
    # Check cache first
    now = time.time()
    cached = _trust_cache.get(user_id)
    if cached and (now - cached[1]) < _TRUST_CACHE_TTL:
        return cached[0]

    try:
        from ..models import User, UserWarning, Rating, ReadingProgress
        from ..models import ChapterComment, ParagraphComment
        from ..extensions import db
        from sqlalchemy import func

        user = User.query.get(user_id)
        if not user:
            return 0.5

        score = 0.0
        utcnow = datetime.utcnow()

        # ── Account age (0–0.20) ──
        age_days = (utcnow - (user.date_joined or user.created_at or utcnow)).days
        if age_days >= 365:
            score += 0.20
        elif age_days >= 90:
            score += 0.15
        elif age_days >= 30:
            score += 0.10
        elif age_days >= 7:
            score += 0.05
        # < 7 days = 0

        # ── Warning history (0 to -0.30) ──
        cutoff_90 = utcnow - timedelta(days=90)
        cutoff_365 = utcnow - timedelta(days=365)

        strikes = UserWarning.query.filter(
            UserWarning.user_id == user_id,
            UserWarning.severity == 'strike',
            UserWarning.created_at >= cutoff_365,
        ).count()
        warnings = UserWarning.query.filter(
            UserWarning.user_id == user_id,
            UserWarning.severity == 'warning',
            UserWarning.created_at >= cutoff_90,
        ).count()

        score -= strikes * 0.15  # each strike = -0.15
        score -= warnings * 0.05  # each warning = -0.05

        # ── Reading engagement (0–0.25) ──
        books_read = db.session.query(
            func.count(func.distinct(ReadingProgress.content_id))
        ).filter(ReadingProgress.user_id == user_id).scalar() or 0

        if books_read >= 20:
            score += 0.25
        elif books_read >= 10:
            score += 0.20
        elif books_read >= 5:
            score += 0.15
        elif books_read >= 1:
            score += 0.08

        # ── Rating quality (0–0.15) ──
        rating_count = Rating.query.filter_by(user_id=user_id).count()
        if rating_count > 0:
            # Check rating diversity (not all same score)
            rating_std = db.session.query(
                func.count(func.distinct(Rating.rating))
            ).filter(Rating.user_id == user_id).scalar() or 1

            if rating_count >= 5 and rating_std >= 3:
                score += 0.15  # diverse, engaged rater
            elif rating_count >= 3:
                score += 0.10
            elif rating_count >= 1:
                score += 0.05

        # ── Comment quality (0–0.15) ──
        comment_count = (
            ChapterComment.query.filter_by(user_id=user_id).count() +
            ParagraphComment.query.filter_by(user_id=user_id).count()
        )
        if comment_count >= 10:
            score += 0.15
        elif comment_count >= 5:
            score += 0.10
        elif comment_count >= 1:
            score += 0.05

        # ── Base trust (everyone starts with some) ──
        score += 0.25

        # Clamp to 0.0–1.0
        score = max(0.0, min(1.0, round(score, 3)))

        # Cache it
        _trust_cache[user_id] = (score, now)

        # Persist to DB
        if save:
            try:
                user.reader_trust_score = score
                db.session.commit()
            except Exception:
                db.session.rollback()

        return score

    except Exception as e:
        log.debug("trust_engine: compute_reader_trust failed for user %d: %s", user_id, str(e)[:100])
        return 0.5


def get_trust_level(user_id):
    """Return a human-readable trust level for the user.

    Returns: (level_name, color) tuple
      - 'new'       → grey   (< 0.3)
      - 'building'  → blue   (0.3–0.5)
      - 'trusted'   → green  (0.5–0.75)
      - 'veteran'   → gold   (>= 0.75)
    """
    score = compute_reader_trust(user_id, save=False)
    if score >= 0.75:
        return 'veteran', '#d4a843'
    elif score >= 0.5:
        return 'trusted', '#4ade80'
    elif score >= 0.3:
        return 'building', '#38bdf8'
    else:
        return 'new', '#9ca3af'


# =============================================================================
# S13: Fake Engagement Filter
# =============================================================================

def is_suspicious_rating(user_id, book_id):
    """Check if a rating submission looks suspicious.

    Suspicious signals:
      - Account < 24 hours old
      - Trust score < 0.2
      - Already rated 5+ books in the last hour
      - Rating same author's books in rapid succession

    Returns: (suspicious: bool, reason: str)
    """
    try:
        from ..models import User, Rating, Content
        from ..extensions import db

        user = User.query.get(user_id)
        if not user:
            return True, 'Unknown user'

        # Account too new
        age_hours = (datetime.utcnow() - (user.date_joined or user.created_at or datetime.utcnow())).total_seconds() / 3600
        if age_hours < 24:
            return True, 'Account too new for rating'

        # Very low trust
        trust = compute_reader_trust(user_id, save=False)
        if trust < 0.2:
            return True, 'Low trust score'

        # Rapid rating (5+ in last hour)
        cutoff = datetime.utcnow() - timedelta(hours=1)
        recent_ratings = Rating.query.filter(
            Rating.user_id == user_id,
            Rating.created_at >= cutoff,
        ).count()
        if recent_ratings >= 5:
            return True, 'Too many ratings in short period'

        # Same-author rating burst (3+ books by same author in 1 hour)
        book = Content.query.get(book_id)
        if book and book.creator_wiam_id:
            same_author_books = [b.id for b in Content.query.filter_by(
                creator_wiam_id=book.creator_wiam_id
            ).all()]
            if same_author_books:
                same_author_ratings = Rating.query.filter(
                    Rating.user_id == user_id,
                    Rating.content_id.in_(same_author_books),
                    Rating.created_at >= cutoff,
                ).count()
                if same_author_ratings >= 3:
                    return True, 'Rapid same-author rating pattern'

        return False, ''

    except Exception as e:
        log.debug("is_suspicious_rating error: %s", str(e)[:100])
        return False, ''


def is_suspicious_comment(user_id, text):
    """Check if a comment looks like fake engagement.

    Suspicious signals:
      - Very short (< 5 chars)
      - Duplicate of recent comment by same user
      - Account trust < 0.2
      - Repetitive patterns ("nice", "good", "update plz")

    Returns: (suspicious: bool, reason: str)
    """
    try:
        from ..models import ChapterComment, ParagraphComment

        if not text or len(text.strip()) < 3:
            return True, 'Comment too short'

        clean = text.strip().lower()

        # Low-effort spam patterns
        spam_phrases = [
            'nice', 'good', 'cool', 'great', 'wow', 'ok', 'update',
            'more', 'next', 'plz', 'pls', 'please update', 'first',
            'hi', 'hello', 'lol', 'haha', 'xd',
        ]
        if clean in spam_phrases:
            return True, 'Low-effort comment'

        # Check for duplicate comments by same user in last hour
        cutoff = datetime.utcnow() - timedelta(hours=1)
        recent_cc = ChapterComment.query.filter(
            ChapterComment.user_id == user_id,
            ChapterComment.created_at >= cutoff,
        ).all()
        recent_pc = ParagraphComment.query.filter(
            ParagraphComment.user_id == user_id,
            ParagraphComment.created_at >= cutoff,
        ).all()

        for c in recent_cc + recent_pc:
            if hasattr(c, 'body') and c.body and c.body.strip().lower() == clean:
                return True, 'Duplicate comment'
            if hasattr(c, 'text') and c.text and c.text.strip().lower() == clean:
                return True, 'Duplicate comment'

        # Low trust account
        trust = compute_reader_trust(user_id, save=False)
        if trust < 0.15 and len(clean) < 20:
            return True, 'Low-trust short comment'

        return False, ''

    except Exception as e:
        log.debug("is_suspicious_comment error: %s", str(e)[:100])
        return False, ''


def weighted_rating_score(book_id):
    """Compute a trust-weighted average rating for a book.

    Ratings from higher-trust users carry more weight.
    This counteracts rating manipulation from fake/new accounts.

    Returns: (weighted_avg: float, total_ratings: int) or (None, 0) if no ratings
    """
    try:
        from ..models import Rating
        ratings = Rating.query.filter_by(content_id=book_id).all()
        if not ratings:
            return None, 0

        total_weight = 0.0
        weighted_sum = 0.0
        for r in ratings:
            trust = compute_reader_trust(r.user_id, save=False)
            # Minimum weight of 0.1 so no rating is completely ignored
            weight = max(0.1, trust)
            weighted_sum += r.rating * weight
            total_weight += weight

        if total_weight == 0:
            return None, 0

        avg = round(weighted_sum / total_weight, 2)
        return avg, len(ratings)

    except Exception as e:
        log.debug("weighted_rating_score error: %s", str(e)[:100])
        return None, 0


# ── Periodic cleanup for trust cache ─────────────────────────────────────────

def cleanup_trust_cache():
    """Remove stale trust cache entries (older than 1 hour)."""
    now = time.time()
    cutoff = now - 3600
    stale = [uid for uid, (_, ts) in _trust_cache.items() if ts < cutoff]
    for uid in stale:
        del _trust_cache[uid]
