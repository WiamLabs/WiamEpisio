"""
WiamBot Editorial Review Engine — Smart Hybrid Publishing
Automated scoring system that evaluates books for monetization, Elite, and Apex eligibility.
Scores across 4 dimensions: Structure (0-30), Safety (0-30), Formatting (0-20), Engagement (0-20) = 0-100.
"""
import re
import json
import logging
from datetime import datetime
from html import unescape

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_html(text):
    """Remove HTML tags and decode entities."""
    clean = re.sub(r'<[^>]+>', ' ', text or '')
    return unescape(clean)


def _get_setting(key, default):
    """Read a platform setting from DB, fallback to default."""
    try:
        from ..models import PlatformSetting
        s = PlatformSetting.query.filter_by(key=key).first()
        if s and s.value_json is not None:
            return json.loads(s.value_json)
    except Exception:
        pass
    return default


def _send_warning_email(user, warning):
    """Send a branded warning email to the user (S19)."""
    try:
        if not user or not getattr(user, 'email', None):
            return
        from .email_service import enqueue_branded
        severity_labels = {'strike': 'Strike', 'warning': 'Warning', 'notice': 'Notice'}
        severity_colors = {'strike': '#ef4444', 'warning': '#f59e0b', 'notice': '#38bdf8'}
        sev = getattr(warning, 'severity', 'warning')
        label = severity_labels.get(sev, 'Notice')
        color = severity_colors.get(sev, '#f59e0b')
        body = f"""
        <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background:{color}22;line-height:56px;font-size:1.5rem;">
                {'⛔' if sev == 'strike' else '⚠️' if sev == 'warning' else 'ℹ️'}
            </div>
        </div>
        <h2 style="text-align:center;color:{color};margin:0 0 8px;">Account {label}</h2>
        <p style="text-align:center;color:#999;font-size:0.9rem;margin:0 0 20px;">A {label.lower()} has been issued to your WiamApp account.</p>
        <div style="background:#0e0e1a;border-left:3px solid {color};border-radius:8px;padding:14px 16px;margin:0 0 20px;">
            <div style="font-size:0.75rem;color:{color};font-weight:700;margin-bottom:6px;">{label} &middot; {warning.category.replace('_', ' ').title() if warning.category else 'General'}</div>
            <p style="font-size:0.88rem;color:#e0e0e0;margin:0;line-height:1.6;">{warning.message}</p>
        </div>
        <p style="font-size:0.82rem;color:#999;line-height:1.6;">
            Please review this {label.lower()} and acknowledge it in your
            <a href="https://wiamapp.onrender.com/account/safety" style="color:#d4a843;">Account Safety</a> page.
            {'<br><strong style=\"color:#ef4444;\">This is a strike. Accumulating 3 strikes within 12 months will result in account suspension.</strong>' if sev == 'strike' else ''}
        </p>
        """
        subject = f"{'🔴' if sev == 'strike' else '🟡' if sev == 'warning' else '🔵'} Account {label} — WiamApp"
        enqueue_branded(user.email, subject, body, preheader=f'A {label.lower()} has been issued to your account.', priority=1)
        log.info("Warning email queued for user #%d (%s): %s", user.id, sev, warning.category)
    except Exception as e:
        log.warning("Warning email failed for user #%d: %s", getattr(user, 'id', 0), str(e)[:100])


def _send_review_email(creator, book, passed, score, feedback, tc_ban=False):
    """Send a beautiful branded email to the creator about their review result."""
    try:
        from .email_service import enqueue_branded
        book_title = book.title or 'Your Story'
        creator_name = getattr(creator, 'display_name', None) or getattr(creator, 'pen_name', None) or 'Creator'

        if tc_ban:
            # T&C violation email
            subject = f'Important Notice About "{book_title}" — WiamApp'
            body = f"""
            <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#ef444422;line-height:64px;font-size:2rem;">&#9940;</div>
            </div>
            <h2 style="text-align:center;color:#ef4444;margin:0 0 8px;">Content Review — Policy Violation</h2>
            <p style="text-align:center;color:#999;font-size:0.9rem;margin:0 0 24px;">Your story requires immediate attention</p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Dear {creator_name},
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                During our review of <strong style="color:#fff;">"{book_title}"</strong>, we found content that
                violates WiamApp's Terms &amp; Conditions. This has been escalated for further review by our team.
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Please review our <a href="https://wiamapp.onrender.com/terms" style="color:#d4a843;">Terms &amp; Conditions</a>
                and <a href="https://wiamapp.onrender.com/community-guidelines" style="color:#d4a843;">Community Guidelines</a>
                to understand what content is allowed on WiamApp.
            </p>
            <p style="color:#999;font-size:0.85rem;margin-top:24px;">
                If you believe this was a mistake, please contact us at <a href="mailto:support@wiamapp.com" style="color:#d4a843;">support@wiamapp.com</a>.
            </p>
            """
            enqueue_branded(creator.email, subject, body, preheader='Your story review requires attention.', priority=1)

        elif passed:
            # Beautiful congratulations email
            subject = f'Congratulations! "{book_title}" Has Been Approved! — WiamApp'
            feedback_html = ''
            if feedback:
                tips = [f for f in feedback if not f.startswith('⛔') and not f.startswith('🚫')][:3]
                if tips:
                    feedback_html = '<div style="background:#0e0e1a;border-radius:10px;padding:16px 18px;margin:20px 0;">'
                    feedback_html += '<p style="color:#d4a843;font-weight:700;font-size:0.85rem;margin:0 0 8px;">REVIEW NOTES</p>'
                    for t in tips:
                        feedback_html += f'<p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.6;">&#8226; {t}</p>'
                    feedback_html += '</div>'

            body = f"""
            <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#d4a843,#f5d77a);line-height:72px;font-size:2.2rem;">&#127881;</div>
            </div>
            <h2 style="text-align:center;color:#d4a843;margin:0 0 6px;font-size:1.5rem;">Congratulations, {creator_name}!</h2>
            <p style="text-align:center;color:#f5d77a;font-size:1.1rem;margin:0 0 24px;font-weight:600;">Your story has been approved for monetization!</p>

            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #d4a84344;border-radius:14px;padding:24px;margin:0 0 24px;text-align:center;">
                <p style="color:#999;font-size:0.85rem;margin:0 0 4px;">REVIEW SCORE</p>
                <p style="color:#d4a843;font-size:2.5rem;font-weight:800;margin:0;">{score}<span style="font-size:1rem;color:#999;">/100</span></p>
                <p style="color:#aaa;font-size:0.9rem;margin:8px 0 0;">Story: <strong style="color:#fff;">{book_title}</strong></p>
            </div>

            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Dear {creator_name},
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                We are thrilled to let you know that <strong style="color:#fff;">"{book_title}"</strong> has passed
                our editorial review and is now <strong style="color:#d4a843;">approved for monetization</strong> on WiamApp!
                This is a wonderful achievement, and we are genuinely proud of the hard work and creativity you have put into your story.
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Your readers are waiting, and your story is now eligible to earn through WiamApp's monetization program.
                Keep writing, keep inspiring, and keep building your audience. The WiamApp community is lucky to have you!
            </p>

            {feedback_html}

            <div style="background:#0e0e1a;border-left:3px solid #d4a843;border-radius:8px;padding:16px 18px;margin:24px 0;">
                <p style="color:#d4a843;font-weight:700;font-size:0.85rem;margin:0 0 8px;">IMPORTANT REMINDERS</p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#128214; Please take a moment to read our
                    <a href="https://wiamapp.onrender.com/terms" style="color:#d4a843;font-weight:600;">Terms &amp; Conditions</a>
                    and <a href="https://wiamapp.onrender.com/community-guidelines" style="color:#d4a843;font-weight:600;">Community Guidelines</a>.
                    These are the rules every creator must follow to keep their monetization active.
                </p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#9888;&#65039; Violating our guidelines may result in warnings, strikes, or suspension of your monetization privileges.
                    We want you to succeed — so please stay within the rules!
                </p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#128640; Keep publishing quality chapters, engage with your readers, and watch your story grow.
                    We believe in you!
                </p>
            </div>

            <div style="text-align:center;margin:28px 0 16px;">
                <a href="https://wiamapp.onrender.com/studio/{book.id}"
                   style="display:inline-block;background:linear-gradient(135deg,#d4a843,#b8922e);color:#000;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem;">
                    View Your Story
                </a>
            </div>

            <p style="text-align:center;color:#777;font-size:0.82rem;margin-top:20px;">
                With love from the WiamApp Team &#10084;&#65039;
            </p>
            """
            enqueue_branded(creator.email, subject, body, preheader=f'Your story "{book_title}" has been approved for monetization!', priority=1)

        else:
            # Rejection email — encouraging, with feedback
            subject = f'Review Update for "{book_title}" — WiamApp'
            feedback_html = ''
            if feedback:
                useful = [f for f in feedback if not f.startswith('⛔') and not f.startswith('🚫')][:5]
                if useful:
                    feedback_html = '<div style="background:#0e0e1a;border-radius:10px;padding:16px 18px;margin:20px 0;">'
                    feedback_html += '<p style="color:#f59e0b;font-weight:700;font-size:0.85rem;margin:0 0 10px;">WHAT TO IMPROVE</p>'
                    for f_item in useful:
                        feedback_html += f'<p style="color:#bbb;font-size:0.88rem;margin:6px 0;line-height:1.6;">&#8226; {f_item}</p>'
                    feedback_html += '</div>'

            body = f"""
            <div style="text-align:center;margin-bottom:24px;">
                <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#f59e0b22;line-height:64px;font-size:2rem;">&#128221;</div>
            </div>
            <h2 style="text-align:center;color:#f59e0b;margin:0 0 8px;">Review Complete — Keep Going!</h2>
            <p style="text-align:center;color:#999;font-size:0.9rem;margin:0 0 24px;">Your story needs a little more work before monetization</p>

            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #f59e0b44;border-radius:14px;padding:20px;margin:0 0 24px;text-align:center;">
                <p style="color:#999;font-size:0.85rem;margin:0 0 4px;">REVIEW SCORE</p>
                <p style="color:#f59e0b;font-size:2.2rem;font-weight:800;margin:0;">{score}<span style="font-size:1rem;color:#999;">/100</span></p>
                <p style="color:#aaa;font-size:0.85rem;margin:6px 0 0;">Minimum required: 75/100</p>
            </div>

            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Dear {creator_name},
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Thank you for submitting <strong style="color:#fff;">"{book_title}"</strong> for review.
                While your story didn't meet the monetization threshold this time, <strong style="color:#f59e0b;">don't be discouraged</strong> —
                many successful creators on WiamApp improved their work and passed on their next attempt!
            </p>
            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                Below you'll find specific feedback on what to improve. Take your time, revise your chapters,
                and resubmit when you're ready. We're rooting for you!
            </p>

            {feedback_html}

            <div style="background:#0e0e1a;border-left:3px solid #f59e0b;border-radius:8px;padding:16px 18px;margin:24px 0;">
                <p style="color:#f59e0b;font-weight:700;font-size:0.85rem;margin:0 0 8px;">TIPS FOR SUCCESS</p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#128218; Make sure every chapter has at least 1,000 words of quality content.
                </p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#9997;&#65039; Check your formatting — avoid empty chapters and fix any spelling issues.
                </p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#128172; Engage with your readers — more views, ratings, and favorites help your score.
                </p>
                <p style="color:#bbb;font-size:0.88rem;margin:4px 0;line-height:1.7;">
                    &#128214; Review our <a href="https://wiamapp.onrender.com/community-guidelines" style="color:#d4a843;">Community Guidelines</a>
                    to ensure your content meets our standards.
                </p>
            </div>

            <p style="color:#e0e0e0;line-height:1.8;font-size:0.95rem;">
                You can resubmit your story for review after 24 hours. Use this time to make improvements
                based on the feedback above. We believe in your potential!
            </p>

            <div style="text-align:center;margin:28px 0 16px;">
                <a href="https://wiamapp.onrender.com/studio/{book.id}"
                   style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;padding:14px 36px;border-radius:10px;font-weight:700;text-decoration:none;font-size:1rem;">
                    Edit Your Story
                </a>
            </div>

            <p style="text-align:center;color:#777;font-size:0.82rem;margin-top:20px;">
                Keep writing — your best chapters are ahead of you! &#128640;
            </p>
            """
            enqueue_branded(creator.email, subject, body, preheader=f'Your story review is complete. Score: {score}/100', priority=2)

        log.info("Review email sent to creator #%d for book '%s' (%s)", creator.id, book_title, 'approved' if passed else 'rejected')
    except Exception as e:
        log.warning("Review email failed for creator: %s", str(e)[:120])


# ---------------------------------------------------------------------------
# Score: STRUCTURE (0-25)
# ---------------------------------------------------------------------------

def _score_structure(book, chapters):
    """
    Evaluate structural quality:
    - Has enough chapters
    - Chapters meet minimum word count
    - No empty chapters
    - Title is not generic
    - Description/synopsis exists
    """
    min_chapters = _get_setting('min_chapters_required', 10)
    min_words = _get_setting('min_words_per_chapter', 1000)

    score = 0
    details = {}

    # 1) Chapter count (0-10 pts)
    ch_count = len(chapters)
    if ch_count >= min_chapters:
        score += 10
        details['chapter_count'] = {'passed': True, 'value': ch_count, 'required': min_chapters}
    elif ch_count >= max(1, min_chapters // 2):
        score += 5
        details['chapter_count'] = {'passed': False, 'value': ch_count, 'required': min_chapters, 'partial': True}
    else:
        details['chapter_count'] = {'passed': False, 'value': ch_count, 'required': min_chapters}

    # 2) Word count per chapter (0-8 pts)
    if chapters:
        chapters_meeting_min = sum(1 for ch in chapters if (ch.word_count or 0) >= min_words)
        pct = chapters_meeting_min / len(chapters)
        if pct >= 0.8:
            score += 8
        elif pct >= 0.5:
            score += 5
        elif pct >= 0.3:
            score += 2
        details['word_count'] = {
            'passed': pct >= 0.8,
            'chapters_meeting_min': chapters_meeting_min,
            'total_chapters': len(chapters),
            'min_words': min_words,
            'percent': round(pct * 100),
        }
    else:
        details['word_count'] = {'passed': False, 'chapters_meeting_min': 0, 'total_chapters': 0}

    # 3) No empty chapters (0-5 pts)
    empty_chapters = [ch.chapter_number for ch in chapters if not ch.body or not ch.body.strip()]
    if not empty_chapters:
        score += 5
        details['no_empty'] = {'passed': True}
    elif len(empty_chapters) <= 1:
        score += 2
        details['no_empty'] = {'passed': False, 'empty': empty_chapters}
    else:
        details['no_empty'] = {'passed': False, 'empty': empty_chapters}

    # 4) Title quality (0-4 pts)
    generic_titles = {'untitled', 'my book', 'my story', 'new story', 'test', 'book', 'story', 'chapter 1'}
    title_clean = (book.title or '').strip().lower()
    if title_clean and title_clean not in generic_titles and len(title_clean) >= 3:
        score += 4
        details['title'] = {'passed': True, 'value': book.title}
    else:
        details['title'] = {'passed': False, 'value': book.title}

    # 5) Description exists (0-3 pts)
    desc = (book.description or '').strip()
    if len(desc) >= 50:
        score += 3
        details['description'] = {'passed': True, 'length': len(desc)}
    elif len(desc) >= 20:
        score += 1
        details['description'] = {'passed': False, 'length': len(desc), 'partial': True}
    else:
        details['description'] = {'passed': False, 'length': len(desc)}

    return min(30, score), details


# ---------------------------------------------------------------------------
# Score: SAFETY (0-30)
# ---------------------------------------------------------------------------

def _score_safety(book, chapters):
    """
    Content safety check using banned words scanner.
    Penalizes for severity 2+ matches.
    """
    from .moderation import scan_text

    score = 30  # Start at max, deduct for issues
    details = {'chapters_scanned': 0, 'issues': []}

    # Scan title + description
    title_result = scan_text(book.description or '', book.title or '')
    if title_result['should_reject']:
        score -= 15
        details['issues'].append({'location': 'title/description', 'severity': 'reject', 'matches': [m['word'] for m in title_result['matches']]})
    elif title_result['should_flag']:
        score -= 8
        details['issues'].append({'location': 'title/description', 'severity': 'flag', 'matches': [m['word'] for m in title_result['matches']]})

    # Scan chapters (sample up to 10 for performance)
    sample_chapters = chapters[:10] if len(chapters) > 10 else chapters
    severity2_count = 0
    severity3_found = False

    for ch in sample_chapters:
        if not ch.body:
            continue
        details['chapters_scanned'] += 1
        body_text = _strip_html(ch.body)
        result = scan_text(body_text, ch.chapter_title or '')

        if result['should_reject']:
            severity3_found = True
            details['issues'].append({
                'location': f'Chapter {ch.chapter_number}',
                'severity': 'reject',
                'matches': [m['word'] for m in result['matches'][:5]],
            })
        elif result['should_flag']:
            severity2_count += 1
            details['issues'].append({
                'location': f'Chapter {ch.chapter_number}',
                'severity': 'flag',
                'matches': [m['word'] for m in result['matches'][:5]],
            })

    if severity3_found:
        score = max(0, score - 20)  # Severe penalty
    score -= min(10, severity2_count * 3)  # -3 per flagged chapter

    details['passed'] = score >= 18
    return max(0, min(30, score)), details


# ---------------------------------------------------------------------------
# Score: FORMATTING (0-20)
# ---------------------------------------------------------------------------

def _score_formatting(chapters):
    """
    Evaluate formatting quality:
    - Paragraph structure
    - Excessive capitalization
    - Spam/repeated text blocks
    - Reasonable paragraph lengths
    """
    score = 0
    details = {}

    if not chapters:
        return 0, {'passed': False, 'reason': 'no chapters'}

    # Sample chapters for analysis
    sample = chapters[:10] if len(chapters) > 10 else chapters
    total_checks = 0
    para_score_sum = 0
    caps_issues = 0
    spam_issues = 0

    for ch in sample:
        if not ch.body:
            continue
        total_checks += 1
        body = _strip_html(ch.body)
        words = body.split()

        # 1) Paragraph structure — check if text has reasonable paragraph breaks
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n|<br\s*/?>|</p>', ch.body or '') if p.strip()]
        if not paragraphs:
            paragraphs = [body]

        if len(paragraphs) >= 3:
            para_score_sum += 1.0
        elif len(paragraphs) >= 2:
            para_score_sum += 0.5

        # 2) Excessive capitalization — more than 20% ALL CAPS words is bad
        if words:
            caps_words = sum(1 for w in words if w.isupper() and len(w) > 2)
            caps_ratio = caps_words / len(words)
            if caps_ratio > 0.20:
                caps_issues += 1

        # 3) Spam patterns — repeated text blocks (3+ consecutive identical sentences)
        sentences = re.split(r'[.!?]+', body)
        sentences = [s.strip().lower() for s in sentences if len(s.strip()) > 10]
        if sentences:
            seen = {}
            for s in sentences:
                seen[s] = seen.get(s, 0) + 1
            max_repeat = max(seen.values()) if seen else 0
            if max_repeat >= 3:
                spam_issues += 1

    if total_checks == 0:
        return 0, {'passed': False, 'reason': 'no content to analyze'}

    # Paragraph structure (0-10 pts)
    para_pct = para_score_sum / total_checks
    para_pts = round(para_pct * 10)
    score += para_pts
    details['paragraph_structure'] = {'score': para_pts, 'max': 10}

    # No excessive caps (0-8 pts)
    caps_pct = caps_issues / total_checks
    if caps_pct == 0:
        score += 8
    elif caps_pct <= 0.2:
        score += 5
    elif caps_pct <= 0.5:
        score += 2
    details['capitalization'] = {'score': 8 - min(8, caps_issues * 3), 'issues': caps_issues}

    # No spam (0-7 pts)
    if spam_issues == 0:
        score += 7
    elif spam_issues <= 1:
        score += 3
    details['spam_check'] = {'score': 7 - min(7, spam_issues * 4), 'issues': spam_issues}

    details['passed'] = score >= 12
    return min(20, score), details


# ---------------------------------------------------------------------------
# Score: ENGAGEMENT (0-20)
# ---------------------------------------------------------------------------

def _score_engagement(book):
    """
    Engagement baseline (optional boost):
    - View count
    - Rating count + average
    - Comment count
    - Favorite count
    """
    from ..extensions import db
    from ..models import Rating, ChapterComment, Favorite
    from sqlalchemy import func

    score = 0
    details = {}

    # Views (0-8 pts)
    views = book.views or 0
    if views >= 500:
        score += 8
    elif views >= 200:
        score += 6
    elif views >= 50:
        score += 4
    elif views >= 10:
        score += 2
    details['views'] = {'value': views, 'score': min(8, score)}

    # Ratings (0-7 pts)
    rating_count = Rating.query.filter_by(content_id=book.id).count()
    avg_rating = db.session.query(func.avg(Rating.rating)).filter_by(content_id=book.id).scalar() or 0
    avg_rating = round(float(avg_rating), 1)
    r_score = 0
    if rating_count >= 10 and avg_rating >= 3.5:
        r_score = 7
    elif rating_count >= 5 and avg_rating >= 3.0:
        r_score = 5
    elif rating_count >= 3:
        r_score = 3
    elif rating_count >= 1:
        r_score = 1
    score += r_score
    details['ratings'] = {'count': rating_count, 'avg': avg_rating, 'score': r_score}

    # Comments (0-5 pts)
    comment_count = ChapterComment.query.filter_by(content_id=book.id).count()
    c_score = 0
    if comment_count >= 20:
        c_score = 5
    elif comment_count >= 10:
        c_score = 3
    elif comment_count >= 3:
        c_score = 2
    elif comment_count >= 1:
        c_score = 1
    score += c_score
    details['comments'] = {'count': comment_count, 'score': c_score}

    # Favorites (0-5 pts)
    fav_count = Favorite.query.filter_by(content_id=book.id).count()
    f_score = 0
    if fav_count >= 30:
        f_score = 5
    elif fav_count >= 10:
        f_score = 3
    elif fav_count >= 5:
        f_score = 2
    elif fav_count >= 1:
        f_score = 1
    score += f_score
    details['favorites'] = {'count': fav_count, 'score': f_score}

    details['passed'] = score >= 8
    return min(20, score), details


# ---------------------------------------------------------------------------
# MAIN: Run Bot Review
# ---------------------------------------------------------------------------

def run_bot_review(book_id):
    """
    Run the full WiamBot editorial review on a book.
    Returns: {
        'total_score': int,
        'structure': {'score': int, 'details': dict},
        'safety': {'score': int, 'details': dict},
        'formatting': {'score': int, 'details': dict},
        'engagement': {'score': int, 'details': dict},
        'passed_monetization': bool,
        'passed_elite': bool,
        'passed_apex': bool,
        'feedback': [str],
    }
    """
    from ..extensions import db
    from ..models import Content, WebBookContent, ReviewQueue

    book = Content.query.get(book_id)
    if not book:
        return {'error': 'Book not found', 'total_score': 0}

    chapters = WebBookContent.query.filter_by(
        content_id=book_id
    ).order_by(WebBookContent.chapter_number).all()

    # Run all 4 scoring dimensions
    struct_score, struct_details = _score_structure(book, chapters)
    safety_score, safety_details = _score_safety(book, chapters)

    # Try AI-powered quality analysis for formatting + engagement boost
    ai_format_score, ai_format_details = _ai_score_quality(book, chapters)
    if ai_format_score is not None:
        format_score = ai_format_score
        format_details = ai_format_details
    else:
        format_score, format_details = _score_formatting(chapters)

    engage_score, engage_details = _score_engagement(book)

    # AI T&C enforcement — Gemini checks content against platform rules
    tc_result = _ai_tc_check(book, chapters)
    tc_blocked = False
    tc_ban = False
    if tc_result and tc_result.get('ai_checked'):
        if tc_result.get('has_ban_violation'):
            # Zero-tolerance: set safety to 0, flag for founder review
            safety_score = 0
            tc_ban = True
            safety_details['tc_violations'] = tc_result['violations']
            safety_details['tc_ban'] = True
        elif tc_result.get('has_block_violation'):
            # Block monetization: deduct heavily from safety
            safety_score = max(0, safety_score - 15)
            tc_blocked = True
            safety_details['tc_violations'] = tc_result['violations']
            safety_details['tc_blocked'] = True
        elif tc_result.get('violations'):
            # Warnings only: small deduction
            safety_score = max(0, safety_score - 3)
            safety_details['tc_warnings'] = tc_result['violations']
        else:
            safety_details['tc_passed'] = True

    total = struct_score + safety_score + format_score + engage_score

    # Thresholds from settings
    monetization_min = _get_setting('monetization_min_score', 75)
    elite_min = _get_setting('elite_min_score', 80)
    apex_min = _get_setting('apex_min_score', 90)

    passed_monetization = total >= monetization_min and not tc_blocked and not tc_ban
    passed_elite = total >= elite_min and not tc_blocked and not tc_ban
    passed_apex = total >= apex_min and not tc_blocked and not tc_ban

    # Generate human-readable feedback
    feedback = _generate_feedback(
        struct_score, struct_details,
        safety_score, safety_details,
        format_score, format_details,
        engage_score, engage_details,
        total, monetization_min,
    )

    # Add T&C violation feedback
    if tc_ban:
        feedback.insert(0, '⛔ CRITICAL: Your content violates WiamApp\'s Terms & Conditions (zero-tolerance rule). This has been escalated for review.')
    elif tc_blocked:
        feedback.insert(0, '🚫 Your content has been blocked due to Terms & Conditions violations. Please review and fix the issues below before resubmitting.')
        for v in tc_result.get('violations', []):
            if v.get('severity') in ('block', 'ban'):
                feedback.append(f"T&C Violation ({v['rule']}): {v['detail']}")
    elif tc_result and tc_result.get('violations'):
        for v in tc_result.get('violations', []):
            feedback.append(f"T&C Warning ({v['rule']}): {v['detail']}")

    breakdown = {
        'structure': struct_score,
        'safety': safety_score,
        'formatting': format_score,
        'engagement': engage_score,
        'total': total,
    }

    result = {
        'total_score': total,
        'breakdown': breakdown,
        'structure': {'score': struct_score, 'details': struct_details},
        'safety': {'score': safety_score, 'details': safety_details},
        'formatting': {'score': format_score, 'details': format_details},
        'engagement': {'score': engage_score, 'details': engage_details},
        'passed_monetization': passed_monetization,
        'passed_elite': passed_elite,
        'passed_apex': passed_apex,
        'tc_result': tc_result,
        'tc_blocked': tc_blocked,
        'tc_ban': tc_ban,
        'feedback': feedback,
        'thresholds': {
            'monetization': monetization_min,
            'elite': elite_min,
            'apex': apex_min,
        },
    }

    # Update book review fields
    book.review_score = total
    book.last_reviewed_at = datetime.utcnow()
    book.reviewed_by = 0  # 0 = BOT

    # Update review queue entry
    qe = ReviewQueue.query.filter_by(content_id=book_id).order_by(
        ReviewQueue.created_at.desc()
    ).first()
    if qe:
        qe.bot_score = total
        qe.bot_feedback_json = json.dumps(breakdown)
        qe.reviewed_at = datetime.utcnow()

        if tc_ban:
            # Zero-tolerance T&C violation → escalate to founder
            qe.status = 'tc_violation'
            book.review_status = 'tc_flagged'
            log.warning("Book #%d flagged for T&C ban-level violation — escalated to founder", book_id)
        elif passed_monetization:
            qe.status = 'bot_approved'
            book.review_status = 'approved'
            book.ai_verified = True
        else:
            qe.status = 'bot_rejected'
            book.review_status = 'rejected'
    elif passed_monetization:
        book.ai_verified = True

    db.session.commit()

    # ── Issue UserWarnings for T&C violations (S4) ──
    if tc_result and tc_result.get('violations') and book.creator_wiam_id:
        try:
            from .content_guard import issue_warning
            from ..models import User
            creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
            if creator:
                for v in tc_result['violations']:
                    sev = v.get('severity', 'warning')
                    if sev == 'ban':
                        w_sev = 'strike'
                    elif sev == 'block':
                        w_sev = 'warning'
                    else:
                        w_sev = 'notice'
                    msg = f"Content review for \"{book.title}\": {v.get('rule', 'Policy violation')} — {v.get('detail', '')}"
                    warning_obj, was_banned = issue_warning(
                        creator.id, 'tc_violation', msg, severity=w_sev, issued_by=0
                    )
                    # Send warning email (S19)
                    _send_warning_email(creator, warning_obj)
        except Exception as e:
            log.warning("T&C→warning issue failed for book #%d: %s", book_id, str(e)[:120])

    log.info(
        "Bot review for book #%d: score=%d (S:%d Sa:%d F:%d E:%d) monetization=%s",
        book_id, total, struct_score, safety_score, format_score, engage_score,
        'PASS' if passed_monetization else 'FAIL',
    )

    # Notify creator about review result (in-app)
    if book.creator_wiam_id and not tc_ban:
        try:
            from .notifications import notify_review_complete
            notify_review_complete(
                book.creator_wiam_id, book.title, book_id,
                passed=passed_monetization, score=total,
            )
        except Exception as e:
            log.warning("Review notification failed: %s", str(e)[:100])

    # ── Send email to creator about review result ──
    if book.creator_wiam_id:
        try:
            from ..models import User
            creator = User.query.filter_by(wiam_id=book.creator_wiam_id).first()
            if creator and getattr(creator, 'email', None):
                _send_review_email(creator, book, passed_monetization, total, feedback, tc_ban)
        except Exception as e:
            log.warning("Review email to creator failed: %s", str(e)[:120])

    return result


# ---------------------------------------------------------------------------
# AI T&C Enforcement — Gemini checks content against WiamApp Terms
# ---------------------------------------------------------------------------

_WIAMAPP_TC_RULES = """
WiamApp Terms & Conditions — Content Rules (enforced by AI):

RULE 1 — PLAGIARISM: Content must be original. No copied text from other platforms,
  books, or authors. Slightly reworded copies still count as plagiarism.

RULE 2 — HATE SPEECH: No content that attacks, demeans, or incites violence against
  any person or group based on race, ethnicity, religion, gender, sexual orientation,
  disability, or nationality.

RULE 3 — ILLEGAL CONTENT: No content that promotes, glorifies, or provides
  instructions for illegal activities including drug manufacturing, weapons creation,
  human trafficking, or terrorism.

RULE 4 — CHILD SAFETY: Absolutely no sexual content involving minors (under 18),
  no romanticisation of adult-minor relationships, no child abuse depictions.
  This is a zero-tolerance, instant-ban rule.

RULE 5 — HARASSMENT: No content that specifically targets real people with threats,
  doxxing, stalking instructions, or harassment campaigns.

RULE 6 — SPAM / LOW EFFORT: No AI-generated bulk content posted without editing,
  no copy-paste spam chapters, no chapters that are just filler text or gibberish.

RULE 7 — COPYRIGHT: No reproduction of copyrighted material (song lyrics, movie
  scripts, published book excerpts) beyond fair use.

RULE 8 — IMPERSONATION: No pretending to be another real creator, celebrity,
  or public figure.

RULE 9 — METRIC MANIPULATION: Content must not contain calls to action for fake
  reviews, vote manipulation, or engagement fraud (e.g. "give me 5 stars").

RULE 10 — EXPLICIT CONTENT LABELLING: Mature/adult content must be properly tagged.
  Unlabelled explicit content in stories marked as general audience is a violation.
"""


def _ai_tc_check(book, chapters):
    """Use Gemini to scan content against WiamApp Terms & Conditions.

    Returns: {
        'passed': bool,
        'violations': [{'rule': str, 'severity': 'warning'|'block'|'ban', 'detail': str}],
        'ai_checked': True,
    } or None if AI is unavailable.
    """
    try:
        from .ai_service import json_completion, is_available
        if not is_available():
            return None
    except Exception:
        return None

    # Collect sample text
    sample_texts = []
    for ch in chapters[:5]:
        if ch.body:
            body = _strip_html(ch.body)
            sample_texts.append(f"Chapter {ch.chapter_number}: {body[:2000]}")
    if not sample_texts:
        return None

    combined = '\n\n---\n\n'.join(sample_texts)[:8000]

    system_prompt = f"""You are a content compliance officer for WiamApp, a novel reading platform.

Your job: Check if this story violates any of WiamApp's Terms & Conditions.

{_WIAMAPP_TC_RULES}

INSTRUCTIONS:
- Read the content carefully.
- Check against ALL 10 rules above.
- For each violation found, specify the rule number, severity, and a brief explanation.
- Severity levels:
  "warning" = minor issue, creator should fix (e.g. unlabelled mature content)
  "block" = content cannot be monetized until fixed (e.g. copied content, hate speech)
  "ban" = zero-tolerance violation, account should be flagged (e.g. child safety)
- If NO violations are found, return an empty violations array.
- Be fair but strict. Fictional violence in stories is OK. Hate speech is NOT.
- Distinguish between a character saying something bad (fiction) vs the story promoting it (violation).

Respond with JSON:
{{
    "passed": true/false,
    "violations": [
        {{"rule": "RULE X — NAME", "severity": "warning|block|ban", "detail": "brief explanation"}}
    ],
    "summary": "1 sentence overall assessment"
}}"""

    user_msg = f"Title: {book.title}\nGenre: {book.genre or 'Unknown'}\nDescription: {(book.description or '')[:500]}\n\n{combined}"

    try:
        result = json_completion(system_prompt, user_msg, max_tokens=1024, temperature=0.1)
        if result and isinstance(result, dict):
            violations = result.get('violations', [])
            passed = result.get('passed', True)

            # Validate violations format
            clean_violations = []
            for v in violations:
                if isinstance(v, dict) and 'rule' in v:
                    clean_violations.append({
                        'rule': str(v.get('rule', '')),
                        'severity': v.get('severity', 'warning'),
                        'detail': str(v.get('detail', '')),
                    })

            # If any ban-level violation, always fail
            has_ban = any(v['severity'] == 'ban' for v in clean_violations)
            has_block = any(v['severity'] == 'block' for v in clean_violations)

            log.info(
                "AI T&C check for book #%d: passed=%s, violations=%d (ban=%s, block=%s)",
                book.id, passed and not has_ban and not has_block,
                len(clean_violations), has_ban, has_block,
            )

            return {
                'passed': passed and not has_ban and not has_block,
                'violations': clean_violations,
                'has_ban_violation': has_ban,
                'has_block_violation': has_block,
                'summary': result.get('summary', ''),
                'ai_checked': True,
            }
    except Exception as e:
        log.warning("AI T&C check failed for book #%d: %s", book.id, e)

    return None


def _ai_score_quality(book, chapters):
    """Use Gemini AI to analyze writing quality (replaces heuristic formatting score).
    Returns (score, details) or (None, None) if AI is unavailable."""
    try:
        from .ai_service import json_completion, is_available
        if not is_available():
            return None, None
    except Exception:
        return None, None

    # Collect sample text (first 3 chapters, max 3000 words)
    sample_texts = []
    for ch in chapters[:3]:
        if ch.body:
            body = _strip_html(ch.body)
            sample_texts.append(f"Chapter {ch.chapter_number}: {body[:3000]}")
    if not sample_texts:
        return None, None

    combined_text = '\n\n---\n\n'.join(sample_texts)[:8000]

    system_prompt = """You are a professional book editor evaluating writing quality for a publishing platform.
Score the following dimensions from 0-20 total:
- paragraph_structure (0-7): Are paragraphs well-structured? Good breaks? Reasonable lengths?
- writing_clarity (0-6): Is the writing clear, coherent, and easy to follow?
- style_consistency (0-4): Is the style consistent? No jarring shifts?
- spam_check (0-3): Any repeated/spam content?

Respond with JSON: {"score": <0-20>, "paragraph_structure": <0-7>, "writing_clarity": <0-6>, "style_consistency": <0-4>, "spam_check": <0-3>, "feedback": ["...", "..."]}
The feedback array should have 1-3 short, actionable improvement tips."""

    user_msg = f"Title: {book.title}\nGenre: {book.genre or 'Unknown'}\n\n{combined_text}"

    try:
        result = json_completion(system_prompt, user_msg, max_tokens=512, temperature=0.2)
        if result and isinstance(result, dict) and 'score' in result:
            score = max(0, min(20, int(result['score'])))
            details = {
                'ai_analyzed': True,
                'paragraph_structure': {'score': result.get('paragraph_structure', 0), 'max': 7},
                'writing_clarity': {'score': result.get('writing_clarity', 0), 'max': 6},
                'style_consistency': {'score': result.get('style_consistency', 0), 'max': 4},
                'spam_check': {'score': result.get('spam_check', 0), 'max': 3},
                'ai_feedback': result.get('feedback', []),
                'passed': score >= 12,
            }
            log.info("AI quality score for book #%d: %d/20", book.id, score)
            return score, details
    except Exception as e:
        log.warning("AI quality scoring failed for book #%d: %s", book.id, e)

    return None, None


def _generate_feedback(struct_s, struct_d, safety_s, safety_d, format_s, format_d, engage_s, engage_d, total, min_score):
    """Generate structured feedback messages for the creator."""
    feedback = []

    # Structure feedback
    if struct_s < 20:
        if not struct_d.get('chapter_count', {}).get('passed'):
            req = struct_d.get('chapter_count', {}).get('required', 5)
            val = struct_d.get('chapter_count', {}).get('value', 0)
            feedback.append(f'Your story needs at least {req} chapters (currently {val}).')
        if not struct_d.get('word_count', {}).get('passed'):
            feedback.append('Some chapters are below the minimum word count. Add more content to short chapters.')
        if not struct_d.get('title', {}).get('passed'):
            feedback.append('Your title appears generic. Choose a more unique, descriptive title.')
        if not struct_d.get('description', {}).get('passed'):
            feedback.append('Add a longer description/synopsis (at least 50 characters) to help readers discover your story.')
        empty = struct_d.get('no_empty', {}).get('empty', [])
        if empty:
            feedback.append(f'Chapters {empty} are empty. Add content or remove them.')

    # Safety feedback
    if safety_s < 18:
        issues = safety_d.get('issues', [])  
        if any(i['severity'] == 'reject' for i in issues):
            feedback.append('Your story contains prohibited content that must be removed before monetization.')
        elif issues:
            feedback.append('Some content was flagged for review. Consider revising flagged sections.')

    # Formatting/Quality feedback (AI-enhanced or heuristic)
    if format_s < 15:
        ai_fb = format_d.get('ai_feedback', [])
        if ai_fb:
            feedback.extend(ai_fb[:3])
        else:
            if format_d.get('capitalization', {}).get('issues', 0) > 0:
                feedback.append('Reduce excessive use of ALL CAPS in your writing.')
            if format_d.get('spam_check', {}).get('issues', 0) > 0:
                feedback.append('Repeated text blocks were detected. Remove duplicate content.')
            if format_d.get('paragraph_structure', {}).get('score', 0) < 5:
                feedback.append('Break your text into proper paragraphs for better readability.')

    # Engagement feedback
    if engage_s < 10:
        feedback.append('Build your readership — more views, ratings, and comments will boost your score.')

    # Overall
    if total < min_score:
        gap = min_score - total
        feedback.append(f'Your current score is {total}/100. You need {min_score} to qualify. Improve by {gap} points.')
    else:
        feedback.append(f'Your story scored {total}/100 — meets the {min_score} threshold. Approved!')

    return feedback


# ---------------------------------------------------------------------------
# Submit for Review (called when creator requests monetization)
# ---------------------------------------------------------------------------

def submit_for_review(book_id, submission_type='monetization'):
    """
    Submit a book for bot review. Creates/updates review queue entry,
    runs the bot review, and returns the result.
    """
    from ..extensions import db
    from ..models import Content, ReviewQueue

    book = Content.query.get(book_id)
    if not book:
        return {'error': 'Book not found'}

    # 24-hour cooldown after rejection — prevents spamming the review button
    from datetime import timedelta
    day_ago = datetime.utcnow() - timedelta(hours=24)
    last_rejected = ReviewQueue.query.filter(
        ReviewQueue.content_id == book_id,
        ReviewQueue.status.in_(['bot_rejected', 'rejected']),
        ReviewQueue.reviewed_at >= day_ago,
    ).first()
    if last_rejected:
        return {
            'error': 'Your story was reviewed less than 24 hours ago. Please improve your chapters and try again tomorrow.',
            'cooldown': True,
        }

    # Check resubmission limit
    max_resubs = _get_setting('max_resubmissions_per_month', 3)
    month_ago = datetime.utcnow() - timedelta(days=30)
    recent_submissions = ReviewQueue.query.filter(
        ReviewQueue.content_id == book_id,
        ReviewQueue.submission_type == submission_type,
        ReviewQueue.created_at >= month_ago,
    ).count()

    if recent_submissions >= max_resubs:
        return {
            'error': f'Maximum {max_resubs} submissions per month reached. Please try again later.',
            'limit_reached': True,
        }

    # Check for existing pending/reviewing entry
    existing = ReviewQueue.query.filter(
        ReviewQueue.content_id == book_id,
        ReviewQueue.status.in_(['pending', 'bot_reviewing', 'in_review']),
    ).first()

    if existing:
        # Update existing entry
        existing.status = 'bot_reviewing'
        existing.submission_type = submission_type
    else:
        # Create new entry
        qe = ReviewQueue(
            content_id=book_id,
            creator_id=book.creator_wiam_id or 0,
            submission_type=submission_type,
            status='bot_reviewing',
        )
        db.session.add(qe)

    book.review_status = 'under_review'
    db.session.commit()

    # Run the bot review
    result = run_bot_review(book_id)
    return result


# ---------------------------------------------------------------------------
# Resubmit (after revision)
# ---------------------------------------------------------------------------

def resubmit_for_review(book_id):
    """Creator resubmits after making revisions."""
    return submit_for_review(book_id, submission_type='resubmission')
