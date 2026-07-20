"""
WiamApp — Content Guard Service
=================================
AI-powered content moderation with automatic warning escalation.

Scans all user-generated text (comments, bios, usernames, titles, descriptions)
through a 2-layer system:
  Layer 1: Fast keyword scan (banned words from DB)
  Layer 2: AI contextual analysis (via content_guard in ai_service)

Warning escalation:
  - 1st offence → Notice (informational)
  - 2nd offence → Warning (formal)
  - 3rd offence → Strike + AUTO-BAN

Each scan returns a GuardVerdict that routes can use to block/allow content.
"""
import logging
import re
from datetime import datetime, timedelta
from html import unescape

log = logging.getLogger(__name__)


# ── Guard Verdict ────────────────────────────────────────────────────────────

class GuardVerdict:
    """Result of a content guard scan."""
    __slots__ = ('allowed', 'reason', 'severity', 'category',
                 'warning_issued', 'user_banned', 'details')

    def __init__(self, allowed=True, reason='', severity=0, category='clean',
                 warning_issued=False, user_banned=False, details=''):
        self.allowed = allowed
        self.reason = reason
        self.severity = severity
        self.category = category
        self.warning_issued = warning_issued
        self.user_banned = user_banned
        self.details = details

    def __bool__(self):
        return self.allowed

    def to_dict(self):
        return {
            'allowed': self.allowed,
            'reason': self.reason,
            'severity': self.severity,
            'category': self.category,
            'warning_issued': self.warning_issued,
            'user_banned': self.user_banned,
        }


# ── Content type configs ─────────────────────────────────────────────────────

CONTENT_TYPES = {
    'comment': {
        'max_length': 500,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 1,
        'label': 'Comment',
    },
    'bio': {
        'max_length': 500,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 2,
        'label': 'Profile Bio',
    },
    'username': {
        'max_length': 30,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 2,
        'label': 'Username',
    },
    'display_name': {
        'max_length': 50,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 2,
        'label': 'Display Name',
    },
    'pen_name': {
        'max_length': 50,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 2,
        'label': 'Pen Name',
    },
    'book_title': {
        'max_length': 200,
        'ai_scan': True,
        'block_severity': 3,
        'warn_severity': 2,
        'label': 'Book Title',
    },
    'book_description': {
        'max_length': 5000,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 1,
        'label': 'Book Description',
    },
    'chapter_title': {
        'max_length': 200,
        'ai_scan': False,
        'block_severity': 3,
        'warn_severity': 2,
        'label': 'Chapter Title',
    },
    'feedback': {
        'max_length': 2000,
        'ai_scan': True,
        'block_severity': 2,
        'warn_severity': 1,
        'label': 'Feedback',
    },
    'report_text': {
        'max_length': 1000,
        'ai_scan': False,
        'block_severity': 3,
        'warn_severity': 2,
        'label': 'Report',
    },
}

# Severity 3 words that ALWAYS block immediately — no AI needed
INSTANT_BLOCK_PATTERNS = [
    r'child\s*porn', r'\bcp\s*links?\b', r'underage\s*sex',
    r'bomb\s*threat', r'school\s*shoot', r'kill\s*yourself',
    r'k+y+s+\b', r'go\s*die\b',
]
_INSTANT_BLOCK_RE = re.compile(
    '|'.join(INSTANT_BLOCK_PATTERNS), re.IGNORECASE
)


# ── AI Moderation Prompt ─────────────────────────────────────────────────────

_GUARD_SYSTEM_PROMPT = """You are WiamApp's content moderation system. Analyse the user-submitted text and return a JSON verdict.

RULES:
- This is a novel/story reading platform. Fiction context matters.
- Usernames, bios, and comments are NOT fiction — they must be clean.
- Book titles and descriptions have slight creative leeway.
- Block: hate speech, slurs, threats, harassment, doxxing, CSAM references, spam/scam links, impersonation of staff.
- Warn: excessive profanity, explicit sexual solicitation, bullying language, promotion of self-harm.
- Allow: normal creative expression, mild language in fiction context, constructive criticism, romantic or suggestive book titles (e.g. 'Sexy Girl', 'Bad Boy', 'Hot Boss'), genre-appropriate descriptions.

Respond ONLY with this JSON (no markdown, no explanation):
{"allowed": true/false, "severity": 0-3, "category": "clean|hate|harassment|sexual|violence|spam|self_harm|illegal", "reason": "brief reason"}

Severity scale: 0=clean, 1=mild (log only), 2=moderate (warn user), 3=severe (block + strike)"""


def _build_ai_prompt(text, content_type):
    """Build the user message for AI moderation."""
    cfg = CONTENT_TYPES.get(content_type, {})
    label = cfg.get('label', content_type)
    return f"Content type: {label}\nText to review:\n\"\"\"\n{text[:1500]}\n\"\"\""


# ── Core scanning ────────────────────────────────────────────────────────────

def _strip_html(text):
    """Remove HTML tags and decode entities."""
    clean = re.sub(r'<[^>]+>', ' ', text or '')
    return unescape(clean).strip()


def _keyword_scan(text):
    """Fast keyword scan against banned words DB.
    Returns (max_severity, matches_list) or (0, []) if clean.
    """
    from ..models import BannedWord
    clean_text = _strip_html(text).lower()
    if not clean_text:
        return 0, []

    matches = []
    max_sev = 0
    try:
        banned = BannedWord.query.filter_by(is_active=True).all()
    except Exception:
        return 0, []

    for bw in banned:
        pattern = re.escape(bw.word.lower())
        if re.search(r'\b' + pattern + r'\b', clean_text, re.IGNORECASE):
            matches.append({'word': bw.word, 'category': bw.category, 'severity': bw.severity})
            if bw.severity > max_sev:
                max_sev = bw.severity

    return max_sev, matches


def _instant_block_check(text):
    """Check for instant-block patterns (severity 3 always)."""
    clean = _strip_html(text).lower()
    m = _INSTANT_BLOCK_RE.search(clean)
    if m:
        return True, m.group()
    return False, None


def _ai_scan(text, content_type):
    """AI contextual scan. Returns dict or None on failure."""
    from . import ai_service
    prompt = _build_ai_prompt(text, content_type)
    try:
        result = ai_service.content_guard_json(_GUARD_SYSTEM_PROMPT, prompt)
        if result and isinstance(result, dict):
            return result
    except Exception as e:
        log.error("AI content guard scan failed: %s", e)
    return None


# ── Warning Escalation ───────────────────────────────────────────────────────

STRIKE_THRESHOLD = 3  # 3 strikes = auto-ban


def count_user_strikes(user_id):
    """Count how many strikes a user has in the last 365 days."""
    from ..models import UserWarning
    cutoff = datetime.utcnow() - timedelta(days=365)
    return UserWarning.query.filter(
        UserWarning.user_id == user_id,
        UserWarning.severity == 'strike',
        UserWarning.created_at >= cutoff,
    ).count()


def count_user_warnings(user_id):
    """Count total warnings (any severity) in last 90 days."""
    from ..models import UserWarning
    cutoff = datetime.utcnow() - timedelta(days=90)
    return UserWarning.query.filter(
        UserWarning.user_id == user_id,
        UserWarning.created_at >= cutoff,
    ).count()


def issue_warning(user_id, category, message, severity='warning', issued_by=0):
    """Issue a warning to a user. Auto-escalates severity based on history.

    Escalation logic:
      - 0 prior warnings in 90 days → notice
      - 1 prior warning → warning
      - 2+ prior warnings → strike
      - 3+ strikes in 365 days → AUTO-BAN

    Returns: (UserWarning, was_banned: bool)
    """
    from ..extensions import db
    from ..models import UserWarning, User

    # Founders are fully exempt from warnings/strikes
    if _is_founder(user_id):
        log.info("Skipping warning for founder user_id=%d", user_id)
        dummy = UserWarning(user_id=user_id, target_role='user', category=category,
                            message='[skipped — founder]', severity='notice', issued_by=issued_by)
        return dummy, False

    prior_count = count_user_warnings(user_id)

    # Auto-escalate severity based on history
    if prior_count == 0:
        actual_severity = 'notice'
    elif prior_count == 1:
        actual_severity = 'warning'
    else:
        actual_severity = 'strike'

    # If caller explicitly set 'strike' (e.g. severity-3 content), honour it
    if severity == 'strike':
        actual_severity = 'strike'

    warning = UserWarning(
        user_id=user_id,
        target_role='user',
        category=category,
        message=message,
        severity=actual_severity,
        issued_by=issued_by,
    )
    db.session.add(warning)
    db.session.flush()

    # Check if auto-ban should trigger
    was_banned = False
    if actual_severity == 'strike':
        total_strikes = count_user_strikes(user_id)
        if total_strikes >= STRIKE_THRESHOLD:
            user = User.query.get(user_id)
            if user and user.status != 'banned' and user.role != 'founder':
                user.status = 'banned'
                was_banned = True
                log.warning(
                    "AUTO-BAN: user_id=%d banned after %d strikes",
                    user_id, total_strikes
                )
                # Add a final warning noting the ban
                ban_warning = UserWarning(
                    user_id=user_id,
                    target_role='user',
                    category='account_ban',
                    message=f'Account automatically suspended after {total_strikes} strikes. '
                            f'Last violation: {category} — {message[:200]}',
                    severity='strike',
                    issued_by=0,
                )
                db.session.add(ban_warning)

    db.session.commit()
    log.info(
        "Warning issued: user=%d severity=%s category=%s banned=%s",
        user_id, actual_severity, category, was_banned
    )

    # ── Send warning email (S19) ──
    try:
        user = User.query.get(user_id)
        if user and getattr(user, 'email', None):
            from .bot_review import _send_warning_email
            _send_warning_email(user, warning)
    except Exception as e:
        log.debug("Warning email skipped for user %d: %s", user_id, str(e)[:80])

    return warning, was_banned


# ── Main scan function ───────────────────────────────────────────────────────

def _is_founder(user_id):
    """Check if user_id belongs to a founder account."""
    try:
        from ..models import User
        user = User.query.get(user_id)
        return user and user.role == 'founder'
    except Exception:
        return False


def scan_content(user_id, text, content_type='comment', skip_ai=False):
    """
    Scan user-generated text through the full guard pipeline.

    Args:
        user_id: The user who submitted the content
        text: The text to scan
        content_type: One of CONTENT_TYPES keys
        skip_ai: Skip AI scan (for performance on low-risk items)

    Returns: GuardVerdict
    """
    if not text or not text.strip():
        return GuardVerdict(allowed=True, category='clean')

    # Founders are exempt from content guard scanning
    if _is_founder(user_id):
        return GuardVerdict(allowed=True, category='clean')

    text = text.strip()
    cfg = CONTENT_TYPES.get(content_type, CONTENT_TYPES['comment'])

    # ── Length check ──
    if cfg['max_length'] and len(text) > cfg['max_length']:
        return GuardVerdict(
            allowed=False,
            reason=f'{cfg["label"]} exceeds maximum length of {cfg["max_length"]} characters.',
            severity=0,
            category='length',
        )

    # ── Instant block patterns (severity 3 — no mercy) ──
    is_blocked, matched = _instant_block_check(text)
    if is_blocked:
        warning, was_banned = issue_warning(
            user_id,
            category='illegal_content',
            message=f'Instant-block content detected in {cfg["label"]}: matched pattern.',
            severity='strike',
        )
        return GuardVerdict(
            allowed=False,
            reason='This content violates our Terms of Service and is not permitted.',
            severity=3,
            category='illegal',
            warning_issued=True,
            user_banned=was_banned,
        )

    # ── Keyword scan (Layer 1) ──
    kw_severity, kw_matches = _keyword_scan(text)

    if kw_severity >= cfg['block_severity']:
        match_words = ', '.join(m['word'] for m in kw_matches if m['severity'] >= cfg['block_severity'])
        cat = kw_matches[0]['category'] if kw_matches else 'general'

        sev = 'strike' if kw_severity >= 3 else 'warning'
        warning, was_banned = issue_warning(
            user_id,
            category=cat,
            message=f'Prohibited content in {cfg["label"]}.',
            severity=sev,
        )
        return GuardVerdict(
            allowed=False,
            reason='Your content contains language that violates our community guidelines.',
            severity=kw_severity,
            category=cat,
            warning_issued=True,
            user_banned=was_banned,
            details=f'Matched: {match_words}',
        )

    # ── AI scan (Layer 2) — only if configured and not skipped ──
    if cfg['ai_scan'] and not skip_ai:
        ai_result = _ai_scan(text, content_type)

        if ai_result:
            ai_severity = ai_result.get('severity', 0)
            ai_allowed = ai_result.get('allowed', True)
            ai_category = ai_result.get('category', 'clean')
            ai_reason = ai_result.get('reason', '')

            if not ai_allowed and ai_severity >= cfg['warn_severity']:
                sev = 'strike' if ai_severity >= 3 else 'warning'
                warning, was_banned = issue_warning(
                    user_id,
                    category=ai_category,
                    message=f'Content violation in {cfg["label"]}: {ai_reason[:200]}',
                    severity=sev,
                )
                return GuardVerdict(
                    allowed=False,
                    reason='Your content was flagged by our review system. Please revise and try again.',
                    severity=ai_severity,
                    category=ai_category,
                    warning_issued=True,
                    user_banned=was_banned,
                    details=ai_reason,
                )

    # ── Keyword severity 1 — log but allow ──
    if kw_severity == 1 and kw_matches:
        log.info(
            "Content guard: mild match for user=%d type=%s matches=%s",
            user_id, content_type,
            ', '.join(m['word'] for m in kw_matches)
        )

    return GuardVerdict(allowed=True, category='clean')


# ── Batch scan helper ────────────────────────────────────────────────────────

def scan_multiple(user_id, fields, skip_ai=False):
    """Scan multiple fields at once. Stops on first block.

    Args:
        user_id: User ID
        fields: dict of {content_type: text_value}
        skip_ai: Skip AI scans

    Returns: GuardVerdict (first failure, or clean verdict)
    """
    for content_type, text in fields.items():
        if not text:
            continue
        verdict = scan_content(user_id, text, content_type, skip_ai)
        if not verdict.allowed:
            return verdict
    return GuardVerdict(allowed=True, category='clean')


# ── User status check ────────────────────────────────────────────────────────

def is_user_banned(user_id):
    """Quick check if a user is currently banned."""
    from ..models import User
    user = User.query.get(user_id)
    return user and user.status == 'banned'


def get_user_warning_summary(user_id):
    """Get a summary of a user's warning history.
    Returns dict with counts and last warning info.
    """
    from ..models import UserWarning
    cutoff_90 = datetime.utcnow() - timedelta(days=90)
    cutoff_365 = datetime.utcnow() - timedelta(days=365)

    warnings_90d = UserWarning.query.filter(
        UserWarning.user_id == user_id,
        UserWarning.created_at >= cutoff_90,
    ).count()

    strikes_365d = UserWarning.query.filter(
        UserWarning.user_id == user_id,
        UserWarning.severity == 'strike',
        UserWarning.created_at >= cutoff_365,
    ).count()

    last_warning = UserWarning.query.filter(
        UserWarning.user_id == user_id,
    ).order_by(UserWarning.created_at.desc()).first()

    return {
        'warnings_90d': warnings_90d,
        'strikes_365d': strikes_365d,
        'strikes_remaining': max(0, STRIKE_THRESHOLD - strikes_365d),
        'last_warning': last_warning,
        'at_risk': strikes_365d >= (STRIKE_THRESHOLD - 1),
    }
