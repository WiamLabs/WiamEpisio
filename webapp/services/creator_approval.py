"""
Rule-based Creator Application Auto-Approval System (DEPRECATED)
=================================================================

**Deprecated as of Push 2 of the deep_tracking_and_home_fix plan.**

The tiny one-tap creator gate (``/api/v1/apply/submit`` and the web
``/become-creator`` route) no longer calls ``auto_process_application`` or
``evaluate_application``. Any reader who supplies a non-spam pen name and
agrees to Creator Terms is promoted to creator immediately by
``finalize_creator_upgrade``.

What's still alive in this module:

* ``_has_spam`` / ``SPAM_PATTERNS`` — a cheap regex used by both the mobile
  and web tiny gates as a placeholder-detector ("asdf", "test test",
  "lorem ipsum", etc.). This is the only retained code path.

Everything else (scoring rubric, ``evaluate_application``,
``auto_process_application``, ``process_delayed_approvals``) is kept for
historical replay / analytics — no production caller invokes it. The
``creator_approval_scheduled`` column on the User table is also unused in
the new flow; it stays for backwards compatibility but new rows will never
populate it.

Do not extend the rubric — extend ``finalize_creator_upgrade`` and the tiny
gate instead.
"""
import re
import logging
from datetime import datetime, timedelta

log = logging.getLogger(__name__)

# ── Valid genres on WiamApp ──
VALID_GENRES = {
    'romance', 'fantasy', 'mystery', 'science fiction', 'horror', 'thriller',
    'adventure', 'drama', 'comedy', 'historical fiction', 'gothic fiction',
    'poetry', 'western', 'biography', 'philosophy', 'children', 'action',
    'crime', 'young adult', 'literary fiction', 'dystopian', 'paranormal',
    'contemporary', 'suspense', 'dark fantasy', 'urban fantasy', 'slice of life',
    'supernatural', 'fan fiction', 'fanfiction', 'fiction', 'non-fiction',
    'nonfiction', 'self-help', 'memoir', 'sci-fi', 'ya',
}

# ── Spam / low-effort indicators ──
SPAM_PATTERNS = [
    r'test\s*test', r'^asdf$', r'^qwerty$', r'lorem\s*ipsum', r'^xxx+$',
    r'^aaa+$', r'^bbb+$', r'just\s*testing', r'^hello\s*world$',
    r'blah\s*blah', r'^idk$', r'^n/?a$',
]
SPAM_RE = re.compile('|'.join(SPAM_PATTERNS), re.IGNORECASE)


def _word_count(text):
    """Count words in a text string."""
    return len(text.split()) if text else 0


def _unique_word_ratio(text):
    """Ratio of unique words to total words (measures vocabulary diversity)."""
    words = text.lower().split() if text else []
    if not words:
        return 0.0
    return len(set(words)) / len(words)


def _sentence_count(text):
    """Rough sentence count based on punctuation."""
    if not text:
        return 0
    return len(re.split(r'[.!?]+', text.strip())) - 1 or 1


def _has_spam(text):
    """Check if text matches spam patterns."""
    return bool(SPAM_RE.search(text or ''))


def _has_proper_capitalization(text):
    """Check if text has reasonable capitalization (not all-lower or all-upper)."""
    if not text or len(text) < 10:
        return False
    # Check first letter is capitalized
    stripped = text.strip()
    if stripped and stripped[0].isupper():
        return True
    # Check if there's any capitalization at all
    return any(c.isupper() for c in text)


def _score_pen_name(pen_name):
    """Score pen name quality (0-10)."""
    if not pen_name or len(pen_name.strip()) < 2:
        return 0
    name = pen_name.strip()
    score = 0
    # Length: 2-4 chars = 3, 5-20 = 6, 21+ = 4
    if len(name) >= 5:
        score += 6
    elif len(name) >= 2:
        score += 3
    # Has space (first + last name style) = +2
    if ' ' in name:
        score += 2
    # Not spam
    if _has_spam(name):
        return 0
    # Not all same character
    if len(set(name.lower().replace(' ', ''))) < 2:
        return 0
    # Proper capitalization
    if name[0].isupper():
        score += 2
    return min(score, 10)


def _score_writing_experience(exp):
    """Score writing experience description (0-15)."""
    if not exp:
        return 0
    exp = exp.strip()
    words = _word_count(exp)
    if _has_spam(exp):
        return 0

    score = 0
    # Length-based
    if words >= 20:
        score += 8
    elif words >= 10:
        score += 5
    elif words >= 3:
        score += 2

    # Keywords that indicate real experience
    exp_keywords = [
        'year', 'month', 'wrote', 'written', 'writing', 'story', 'stories',
        'novel', 'book', 'poetry', 'poem', 'blog', 'journal', 'school',
        'university', 'college', 'published', 'wattpad', 'fanfic',
        'creative writing', 'english', 'literature', 'passion', 'hobby',
        'beginner', 'intermediate', 'advanced', 'professional', 'amateur',
        'experience', 'practice', 'draft', 'chapter',
    ]
    exp_lower = exp.lower()
    keyword_hits = sum(1 for kw in exp_keywords if kw in exp_lower)
    score += min(keyword_hits * 2, 7)

    return min(score, 15)


def _score_genres(genres):
    """Score genre selection (0-10)."""
    if not genres:
        return 0
    genres_text = genres.strip().lower()
    if _has_spam(genres_text):
        return 0

    score = 0
    # Check if any valid genre is mentioned
    matched = [g for g in VALID_GENRES if g in genres_text]
    if matched:
        score += min(len(matched) * 3, 8)
    else:
        # They wrote something but it's not a recognized genre
        score += 2 if len(genres_text) > 3 else 0

    # Bonus for selecting multiple genres (comma-separated)
    parts = [p.strip() for p in re.split(r'[,;/&]', genres_text) if p.strip()]
    if len(parts) >= 2:
        score += 2

    return min(score, 10)


def _score_story_idea(idea):
    """Score story idea depth (0-25)."""
    if not idea:
        return 0
    idea = idea.strip()
    words = _word_count(idea)
    if _has_spam(idea):
        return 0

    score = 0

    # Length (most important for story ideas)
    if words >= 80:
        score += 12
    elif words >= 50:
        score += 9
    elif words >= 30:
        score += 6
    elif words >= 20:
        score += 3

    # Vocabulary diversity
    ratio = _unique_word_ratio(idea)
    if ratio >= 0.6:
        score += 4
    elif ratio >= 0.4:
        score += 2

    # Sentence structure
    sents = _sentence_count(idea)
    if sents >= 3:
        score += 4
    elif sents >= 2:
        score += 2

    # Story-telling keywords
    story_keywords = [
        'character', 'protagonist', 'antagonist', 'plot', 'world', 'setting',
        'conflict', 'theme', 'journey', 'discover', 'secret', 'adventure',
        'love', 'war', 'family', 'friend', 'magic', 'power', 'kingdom',
        'village', 'city', 'fight', 'survive', 'quest', 'hero', 'villain',
        'mystery', 'murder', 'detective', 'ghost', 'demon', 'angel',
        'prince', 'princess', 'king', 'queen', 'dragon',
    ]
    idea_lower = idea.lower()
    kw_hits = sum(1 for kw in story_keywords if kw in idea_lower)
    score += min(kw_hits * 2, 5)

    return min(score, 25)


def _score_sample_paragraph(sample):
    """Score sample paragraph quality (0-30)."""
    if not sample:
        return 0
    sample = sample.strip()
    words = _word_count(sample)
    if _has_spam(sample):
        return 0

    score = 0

    # Length — this is the most heavily weighted section
    if words >= 100:
        score += 12
    elif words >= 70:
        score += 9
    elif words >= 50:
        score += 6
    elif words >= 30:
        score += 3

    # Vocabulary diversity
    ratio = _unique_word_ratio(sample)
    if ratio >= 0.55:
        score += 5
    elif ratio >= 0.4:
        score += 3

    # Sentence variety
    sents = _sentence_count(sample)
    if sents >= 4:
        score += 5
    elif sents >= 2:
        score += 3

    # Proper capitalization and punctuation
    if _has_proper_capitalization(sample):
        score += 3

    # Has dialogue (quotes)
    if '"' in sample or '\u201c' in sample or '\u2018' in sample:
        score += 3

    # Not mostly repeated words
    if ratio < 0.2 and words > 10:
        return 0  # Gibberish / repeated text

    # Descriptive language bonus
    descriptive = ['the', 'was', 'had', 'with', 'her', 'his', 'their', 'she', 'he']
    desc_hits = sum(1 for d in descriptive if f' {d} ' in f' {sample.lower()} ')
    if desc_hits >= 3:
        score += 2

    return min(score, 30)


def _score_why_wiam(why):
    """Score motivation for joining WiamApp (0-10)."""
    if not why:
        return 0
    why = why.strip()
    words = _word_count(why)
    if _has_spam(why):
        return 0

    score = 0
    if words >= 15:
        score += 5
    elif words >= 8:
        score += 3
    elif words >= 3:
        score += 1

    # Positive/motivated keywords
    motivation_kw = [
        'share', 'reader', 'audience', 'write', 'story', 'stories',
        'platform', 'community', 'publish', 'dream', 'passion', 'love',
        'creative', 'express', 'inspire', 'connect', 'grow', 'learn',
        'talent', 'opportunity', 'african', 'ghana', 'wiam',
    ]
    why_lower = why.lower()
    hits = sum(1 for kw in motivation_kw if kw in why_lower)
    score += min(hits * 2, 5)

    return min(score, 10)


# ── Thresholds: prefer “open studio” over turning away real writers ──
APPROVE_THRESHOLD = 30


def evaluate_application(app_data):
    """Evaluate a creator application and return score + decision.

    Args:
        app_data: dict with keys: pen_name, writing_experience, genres,
                  story_idea, sample_paragraph, why_wiam

    Returns:
        dict with:
            score: int (0-100)
            decision: 'approve' | 'pending' | 'reject'
            breakdown: dict of individual scores
            reason: str explaining the decision
    """
    pen_name = app_data.get('pen_name', '')
    writing_exp = app_data.get('writing_experience', '')
    genres = app_data.get('genres', '')
    story_idea = app_data.get('story_idea', '')
    sample = app_data.get('sample_paragraph', '')
    why_wiam = app_data.get('why_wiam', '')

    breakdown = {
        'pen_name': _score_pen_name(pen_name),
        'writing_experience': _score_writing_experience(writing_exp),
        'genres': _score_genres(genres),
        'story_idea': _score_story_idea(story_idea),
        'sample_paragraph': _score_sample_paragraph(sample),
        'why_wiam': _score_why_wiam(why_wiam),
    }

    total = sum(breakdown.values())

    # Hard rejections (regardless of score)
    if _has_spam(pen_name) or _has_spam(story_idea) or _has_spam(sample):
        return {
            'score': total,
            'decision': 'reject',
            'breakdown': breakdown,
            'reason': 'Application flagged as low-effort or spam.',
        }

    if _word_count(sample) < 12:
        return {
            'score': total,
            'decision': 'pending',
            'breakdown': breakdown,
            'reason': 'Short writing sample — queued for a quick human review.',
        }

    if _word_count(story_idea) < 8:
        return {
            'score': total,
            'decision': 'pending',
            'breakdown': breakdown,
            'reason': 'Add a sentence or two about your story — we will still review your application.',
        }

    if total >= APPROVE_THRESHOLD:
        decision = 'approve'
        reason = 'Welcome! You can open the studio and start publishing.'
    else:
        decision = 'pending'
        reason = 'Application queued for review—we will get back to you soon.'

    return {
        'score': total,
        'decision': decision,
        'breakdown': breakdown,
        'reason': reason,
    }


def auto_process_application(user, app_data):
    """Run auto-approval on a creator application and apply the result.

    Key rules:
      - Never override a founder/team manual decision (approved/rejected).
      - Passing score grants creator immediately (no multi-day friction).
      - Low scores go to pending — we do **not** auto-reject honest short forms.
      - Auto-reject is reserved for spam-pattern hits inside evaluate_application.

    Args:
        user: User model instance
        app_data: dict with application fields

    Returns:
        dict with evaluation result
    """
    from ..extensions import db

    # Never override a manual decision by founder/team
    if user.creator_application_status in ('approved', 'rejected'):
        log.info("Creator auto-eval SKIPPED: user=%s already %s (manual decision)",
                 user.id, user.creator_application_status)
        return {
            'score': 0,
            'decision': user.creator_application_status,
            'breakdown': {},
            'reason': 'Manual decision already made — not overriding.',
        }

    result = evaluate_application(app_data)
    decision = result['decision']

    log.info("Creator auto-eval: user=%s score=%d decision=%s breakdown=%s",
             user.id, result['score'], decision, result['breakdown'])

    if decision == 'approve':
        from .creator_activation import finalize_creator_upgrade
        finalize_creator_upgrade(user, pen_name_hint=app_data.get('pen_name'))
        db.session.commit()

        log.info("Creator auto-eval: user=%s APPROVED immediately (score=%d)",
                 user.id, result.get('score', 0))

        try:
            from .notifications import notify_system
            notify_system(
                user.wiam_id or user.id,
                'Creator Application Approved!',
                'Congratulations! Open the studio and start publishing your stories.',
                '/studio',
            )
        except Exception as e:
            log.warning("Auto-approve notification failed: %s", str(e)[:120])

    elif decision == 'reject':
        user.creator_application_status = 'rejected'
        db.session.commit()

        # Send rejection notification
        try:
            from .notifications import notify_system
            notify_system(
                user.wiam_id or user.id,
                'Creator Application Update',
                result['reason'],
                '/become-creator',
            )
        except Exception as e:
            log.warning("Auto-reject notification failed: %s", str(e)[:120])

    # 'pending' — leave as-is for manual review

    return result


def process_delayed_approvals():
    """Process creator applications that have passed their scheduled approval time.
    Called by the scheduler. Respects manual overrides.
    """
    from ..extensions import db
    from ..models import User

    now = datetime.utcnow()
    pending_users = User.query.filter(
        User.creator_application_status == 'pending',
        User.creator_approval_scheduled.isnot(None),
        User.creator_approval_scheduled <= now,
    ).all()

    approved = 0
    from .creator_activation import finalize_creator_upgrade
    for user in pending_users:
        # Double-check they weren't manually rejected in the meantime
        if user.creator_application_status != 'pending':
            continue

        finalize_creator_upgrade(user)
        approved += 1

        try:
            from .notifications import notify_system
            notify_system(
                user.wiam_id or user.id,
                'Creator Application Approved!',
                'Congratulations! You are now a WiamApp creator. Head to your studio to start writing!',
                '/studio',
            )
        except Exception:
            pass

    if approved:
        db.session.commit()
        log.info("Delayed creator approvals: %d users approved", approved)

    return approved
