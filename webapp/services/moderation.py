"""
Content Moderation Service — Phase 4
Handles text scanning, report processing, auto-escalation, and trust scores.
"""
import re
import logging
from datetime import datetime
from html import unescape

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Default banned words (seeded on first run if table is empty)
# ---------------------------------------------------------------------------

DEFAULT_BANNED_WORDS = [
    # Severity 3 (auto-reject) — explicit/illegal
    {'word': 'child porn', 'category': 'sexual', 'severity': 3},
    {'word': 'cp links', 'category': 'sexual', 'severity': 3},
    {'word': 'underage sex', 'category': 'sexual', 'severity': 3},
    {'word': 'kill yourself', 'category': 'hate', 'severity': 3},
    {'word': 'bomb threat', 'category': 'violence', 'severity': 3},
    {'word': 'school shooting', 'category': 'violence', 'severity': 3},
    # Severity 2 (flag for review)
    {'word': 'nigger', 'category': 'hate', 'severity': 2},
    {'word': 'faggot', 'category': 'hate', 'severity': 2},
    {'word': 'retard', 'category': 'hate', 'severity': 2},
    {'word': 'whore', 'category': 'sexual', 'severity': 2},
    {'word': 'slut', 'category': 'sexual', 'severity': 2},
    # Severity 1 (log only — common in fiction context)
    {'word': 'fuck', 'category': 'general', 'severity': 1},
    {'word': 'shit', 'category': 'general', 'severity': 1},
    {'word': 'damn', 'category': 'general', 'severity': 1},
    {'word': 'ass', 'category': 'general', 'severity': 1},
    # Spam patterns
    {'word': 'buy followers', 'category': 'spam', 'severity': 2},
    {'word': 'free money', 'category': 'spam', 'severity': 2},
    {'word': 'click here now', 'category': 'spam', 'severity': 2},
    {'word': 'whatsapp me', 'category': 'spam', 'severity': 1},
    {'word': 'telegram.me/', 'category': 'spam', 'severity': 2},
    {'word': 'bit.ly/', 'category': 'spam', 'severity': 1},
]


def seed_banned_words():
    """Seed the banned words table if empty."""
    from ..extensions import db
    from ..models import BannedWord

    if BannedWord.query.first():
        return 0

    count = 0
    for item in DEFAULT_BANNED_WORDS:
        existing = BannedWord.query.filter_by(word=item['word']).first()
        if not existing:
            db.session.add(BannedWord(
                word=item['word'],
                category=item['category'],
                severity=item['severity'],
            ))
            count += 1
    db.session.commit()
    log.info("Seeded %d banned words", count)
    return count


# ---------------------------------------------------------------------------
# Text Scanner
# ---------------------------------------------------------------------------

def _strip_html(text):
    """Remove HTML tags and decode entities for clean scanning."""
    clean = re.sub(r'<[^>]+>', ' ', text or '')
    clean = unescape(clean)
    return clean.lower().strip()


def scan_text(text, title=''):
    """
    Scan text for banned words/phrases.
    Returns: {
        'clean': bool,
        'matches': [{'word': str, 'category': str, 'severity': int}],
        'max_severity': int,
        'should_reject': bool,   # severity 3 found
        'should_flag': bool,     # severity 2 found
    }
    """
    from ..models import BannedWord

    result = {
        'clean': True,
        'matches': [],
        'max_severity': 0,
        'should_reject': False,
        'should_flag': False,
    }

    combined = _strip_html(text) + ' ' + (title or '').lower()
    if not combined.strip():
        return result

    # Load active banned words
    banned = BannedWord.query.filter_by(is_active=True).all()

    for bw in banned:
        pattern = re.escape(bw.word.lower())
        if re.search(r'\b' + pattern + r'\b', combined, re.IGNORECASE):
            result['clean'] = False
            result['matches'].append({
                'word': bw.word,
                'category': bw.category,
                'severity': bw.severity,
            })
            if bw.severity > result['max_severity']:
                result['max_severity'] = bw.severity

    if result['max_severity'] >= 3:
        result['should_reject'] = True
    if result['max_severity'] >= 2:
        result['should_flag'] = True

    return result


def scan_chapter_on_publish(content_id, chapter_number, body, title=''):
    """
    Scan a chapter when it's published.
    Creates/updates ContentFlag if issues found. Logs to ModerationLog.
    Returns scan result dict.
    """
    from ..extensions import db
    from ..models import ContentFlag, ModerationLog, WebBookContent

    result = scan_text(body, title)

    if result['clean']:
        # Clear any existing flag from previous scan
        existing_flag = ContentFlag.query.filter_by(
            content_id=content_id, chapter_number=chapter_number, flag_type='scan'
        ).first()
        if existing_flag and existing_flag.status == 'flagged':
            existing_flag.status = 'cleared'
            existing_flag.updated_at = datetime.utcnow()
            db.session.commit()
        return result

    # Content has issues — create or update flag
    match_words = ', '.join(m['word'] for m in result['matches'])

    flag = ContentFlag.query.filter_by(
        content_id=content_id, chapter_number=chapter_number
    ).first()
    if not flag:
        flag = ContentFlag(
            content_id=content_id,
            chapter_number=chapter_number,
            flag_type='scan',
        )
        db.session.add(flag)

    flag.scan_matches = match_words
    flag.scan_severity = result['max_severity']
    flag.updated_at = datetime.utcnow()

    if result['should_reject']:
        flag.status = 'hidden'
        # Also unpublish the chapter
        chapter = WebBookContent.query.filter_by(
            content_id=content_id, chapter_number=chapter_number
        ).first()
        if chapter:
            chapter.status = 'draft'
            chapter.updated_at = datetime.utcnow()
    elif result['should_flag']:
        flag.status = 'flagged'

    # Log the moderation action
    log_entry = ModerationLog(
        actor_id=0,  # system
        action='flag' if not result['should_reject'] else 'hide',
        target_type='chapter',
        target_id=content_id,
        chapter_number=chapter_number,
        reason=f'Auto-scan: {match_words}',
        details=f'Severity: {result["max_severity"]}, Matches: {len(result["matches"])}',
    )
    db.session.add(log_entry)
    db.session.commit()

    log.info(
        "Scan result for story=%d ch=%d: severity=%d matches=%s",
        content_id, chapter_number, result['max_severity'], match_words
    )
    return result


# ---------------------------------------------------------------------------
# Report Processing + Auto-Escalation
# ---------------------------------------------------------------------------

REPORT_FLAG_THRESHOLD = 3
REPORT_HIDE_THRESHOLD = 10


def process_report(reporter_id, content_id, chapter_number, reason, details=''):
    """
    Process a user report. Creates ContentReport and escalates if thresholds met.
    Returns (report, message).
    """
    from ..extensions import db
    from ..models import ContentReport, ContentFlag, ModerationLog, Report
    from sqlalchemy import func

    # Check duplicate
    existing = ContentReport.query.filter_by(
        reporter_id=reporter_id,
        content_id=content_id,
        chapter_number=chapter_number,
    ).first()
    if existing:
        return existing, 'You have already reported this content.'

    # Create report
    report = ContentReport(
        reporter_id=reporter_id,
        content_id=content_id,
        chapter_number=chapter_number,
        reason=reason,
        details=details,
    )
    db.session.add(report)
    db.session.flush()

    # Also create a general disputes record
    target_type = 'CHAPTER' if chapter_number else 'BOOK'
    target_id = content_id
    try:
        db.session.add(Report(
            reporter_user_id=reporter_id,
            target_type=target_type,
            target_id=target_id,
            category=reason,
            description=details or f'Reported {target_type.lower()} #{target_id}',
        ))
    except Exception:
        pass  # non-critical — disputes table may not exist yet

    # Count total reports for this content+chapter
    report_count = ContentReport.query.filter_by(
        content_id=content_id,
        chapter_number=chapter_number,
    ).filter(ContentReport.status.in_(['pending', 'actioned'])).count()

    # Get or create content flag
    flag = ContentFlag.query.filter_by(
        content_id=content_id, chapter_number=chapter_number
    ).first()

    escalation_msg = ''

    if report_count >= REPORT_HIDE_THRESHOLD:
        # Auto-hide
        if not flag:
            flag = ContentFlag(
                content_id=content_id,
                chapter_number=chapter_number,
                flag_type='report',
            )
            db.session.add(flag)
        flag.status = 'hidden'
        flag.report_count = report_count
        flag.updated_at = datetime.utcnow()

        # Hide the chapter
        from ..models import WebBookContent
        chapter = WebBookContent.query.filter_by(
            content_id=content_id, chapter_number=chapter_number
        ).first() if chapter_number else None
        if chapter:
            chapter.status = 'draft'
            chapter.updated_at = datetime.utcnow()

        # Log
        db.session.add(ModerationLog(
            actor_id=0,
            action='hide',
            target_type='chapter' if chapter_number else 'story',
            target_id=content_id,
            chapter_number=chapter_number,
            reason=f'Auto-hidden: {report_count} reports',
        ))
        escalation_msg = 'Content has been automatically hidden due to multiple reports.'

    elif report_count >= REPORT_FLAG_THRESHOLD:
        # Auto-flag
        if not flag:
            flag = ContentFlag(
                content_id=content_id,
                chapter_number=chapter_number,
                flag_type='report',
            )
            db.session.add(flag)
        if flag.status not in ('hidden',):
            flag.status = 'flagged'
        flag.report_count = report_count
        flag.updated_at = datetime.utcnow()

        # Log
        db.session.add(ModerationLog(
            actor_id=0,
            action='flag',
            target_type='chapter' if chapter_number else 'story',
            target_id=content_id,
            chapter_number=chapter_number,
            reason=f'Auto-flagged: {report_count} reports',
        ))
        escalation_msg = 'Content flagged for review.'

    db.session.commit()
    return report, escalation_msg or 'Report submitted. Thank you for helping keep WiamApp safe.'


# ---------------------------------------------------------------------------
# Trust Score Update
# ---------------------------------------------------------------------------

def update_creator_trust_score(creator_id):
    """
    Recalculate a creator's trust score based on flags, reports, and activity.
    Updates MonetizationStatus.cached_trust_score.
    """
    from ..extensions import db
    from ..models import (
        MonetizationStatus, Content, ContentFlag, ContentReport,
        Follow, Rating, WebBookContent,
    )
    from sqlalchemy import func

    # Base score
    score = 50

    # Published stories (+5 per story, max +25)
    story_count = Content.query.filter(
        Content.creator_wiam_id == creator_id,
        Content.is_published == True,
        Content.deleted_at == None,
    ).count()
    score += min(25, story_count * 5)

    # Followers (+1 per 10 followers, max +15)
    followers = Follow.query.filter_by(creator_id=creator_id).count()
    score += min(15, followers // 10)

    # Good ratings (+2 per rating above 3.5, max +10)
    book_ids = [b.id for b in Content.query.filter(
        Content.creator_wiam_id == creator_id,
        Content.deleted_at == None,
    ).all()]
    if book_ids:
        avg_rating = db.session.query(func.avg(Rating.score)).filter(
            Rating.content_id.in_(book_ids)
        ).scalar() or 0
        if avg_rating >= 4.0:
            score += 10
        elif avg_rating >= 3.5:
            score += 5

    # Penalties: active flags (-10 per flagged, -20 per hidden)
    if book_ids:
        flagged = ContentFlag.query.filter(
            ContentFlag.content_id.in_(book_ids),
            ContentFlag.status == 'flagged',
        ).count()
        hidden = ContentFlag.query.filter(
            ContentFlag.content_id.in_(book_ids),
            ContentFlag.status == 'hidden',
        ).count()
        score -= flagged * 10
        score -= hidden * 20

    # Penalties: reports in last 60 days (-3 per report)
    from datetime import timedelta
    cutoff = datetime.utcnow() - timedelta(days=60)
    if book_ids:
        recent_reports = ContentReport.query.filter(
            ContentReport.content_id.in_(book_ids),
            ContentReport.created_at >= cutoff,
        ).count()
        score -= recent_reports * 3

    # Clamp 0-100
    score = max(0, min(100, score))

    # Update MonetizationStatus
    status = MonetizationStatus.query.get(creator_id)
    if status:
        status.cached_trust_score = score
        status.last_checked = datetime.utcnow()
        db.session.commit()

    return score


# ---------------------------------------------------------------------------
# Founder Override Actions
# ---------------------------------------------------------------------------

def founder_action(actor_id, action, content_id, chapter_number=None, reason=''):
    """
    Founder/admin takes a moderation action on content.
    Actions: 'clear' (approve), 'hide', 'restore', 'warn'
    """
    from ..extensions import db
    from ..models import ContentFlag, ModerationLog, WebBookContent, Content

    flag = ContentFlag.query.filter_by(
        content_id=content_id, chapter_number=chapter_number
    ).first()

    if action == 'clear':
        # Approve content — remove flag
        if flag:
            flag.status = 'cleared'
            flag.actioned_by = actor_id
            flag.action_note = reason
            flag.updated_at = datetime.utcnow()

    elif action == 'hide':
        # Hide content
        if not flag:
            flag = ContentFlag(
                content_id=content_id,
                chapter_number=chapter_number,
                flag_type='manual',
            )
            db.session.add(flag)
        flag.status = 'hidden'
        flag.actioned_by = actor_id
        flag.action_note = reason
        flag.updated_at = datetime.utcnow()

        # Unpublish
        if chapter_number:
            ch = WebBookContent.query.filter_by(
                content_id=content_id, chapter_number=chapter_number
            ).first()
            if ch:
                ch.status = 'draft'
                ch.updated_at = datetime.utcnow()
        else:
            book = Content.query.get(content_id)
            if book:
                book.status = 'draft'

    elif action == 'restore':
        # Restore hidden content
        if flag:
            flag.status = 'restored'
            flag.actioned_by = actor_id
            flag.action_note = reason
            flag.updated_at = datetime.utcnow()

        # Re-publish
        if chapter_number:
            ch = WebBookContent.query.filter_by(
                content_id=content_id, chapter_number=chapter_number
            ).first()
            if ch:
                ch.status = 'published'
                ch.updated_at = datetime.utcnow()

    # Log the action
    log_entry = ModerationLog(
        actor_id=actor_id,
        action=action,
        target_type='chapter' if chapter_number else 'story',
        target_id=content_id,
        chapter_number=chapter_number,
        reason=reason,
    )
    db.session.add(log_entry)
    db.session.commit()

    return flag
