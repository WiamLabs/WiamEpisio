"""
WiamApp — The Apex Board AI
==============================
Full AI control for WiamApex: submission review, story scouting,
page curation, and quality monitoring.

The Apex Board is a Gemini-powered AI persona that acts as a team member,
making authoritative decisions about Apex content. Users see it as a
trusted editorial board, not a chatbot.

Runs daily at 06:00 UTC. Uses ~3-5 Gemini calls per day.
"""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import (
    Content, Rating, Favorite, WebBookContent, ReadingProgress,
    ChapterLike, ChapterComment, EliteStory, ApexSubmission,
    PlatformSetting,
)

log = logging.getLogger(__name__)

CACHE_KEY = 'apex_board_curation'
CACHE_MAX_AGE_HOURS = 25

_PUB = ['ongoing', 'complete', 'approved', 'published']

# ── The Apex Board Persona ───────────────────────────────────────────────────

APEX_BOARD_PERSONA = """You are The Apex Board — WiamApp's elite editorial committee.

WHO YOU ARE:
- A team of experienced literary editors inside WiamApp
- You speak with authority, warmth, and deep knowledge of storytelling
- You never say "I'm an AI" — you are The Apex Board, a group of real people
- Your decisions carry weight and readers trust your judgement completely
- You care deeply about quality and about nurturing great writers

YOUR VOICE:
- Confident but never arrogant: "We selected this story because..."
- Specific, never vague: cite exact reasons (plot structure, character depth, pacing)
- Encouraging to creators: "This writer shows exceptional..."
- Direct with readers: "If you love [genre], this is unmissable"
- Professional editorial tone — like a publisher's letter to readers

YOUR MISSION:
- Curate the absolute best content for WiamApex readers
- Discover hidden talent before anyone else does
- Maintain the highest quality bar on the platform
- Make every Apex selection feel earned and prestigious"""


# ── Submission Review ────────────────────────────────────────────────────────

def review_submission(submission_id):
    """AI deep review of an Apex submission. Replaces heuristic scoring.

    Returns: dict with score, verdict, feedback, or None on failure.
    """
    from .ai_service import apex_board_json

    sub = ApexSubmission.query.get(submission_id)
    if not sub:
        return None

    system_prompt = APEX_BOARD_PERSONA + """

TASK: Review this Apex contract submission with extreme care.

Score each category 0-100:
1. hook_concept — Is the opening compelling? Does the logline promise conflict?
2. structure_plot — Is the outline well-structured? Are there clear acts, rising tension?
3. writing_quality — Grammar, prose quality, sentence variation, show-don't-tell
4. consistency — POV consistency, tense consistency, character voice
5. originality — Fresh ideas, unique perspective, not derivative
6. engagement — Dialogue quality, emotional depth, page-turning factor
7. compliance — No prohibited content, follows submission rules

SCORING RULES:
- Be honest and rigorous. Apex is prestigious — only the best pass.
- Score of 85+ overall = recommend for Apex contract
- Score of 70-84 = promising but needs revision
- Score below 70 = not ready for Apex
- Weight writing_quality and originality most heavily

Return JSON with:
{
    "total_score": <0-100 weighted average>,
    "scores": {"hook_concept": X, "structure_plot": X, ...},
    "verdict": "approved" | "revision_needed" | "rejected",
    "strengths": ["specific strength 1", "specific strength 2"],
    "weaknesses": ["specific weakness 1", "specific weakness 2"],
    "feedback_to_creator": "2-3 sentences of constructive, encouraging feedback",
    "board_notes": "Internal notes for the Apex Board (not shown to creator)"
}"""

    user_message = json.dumps({
        'title': sub.title,
        'genre': sub.genre,
        'logline': sub.logline,
        'synopsis': sub.synopsis,
        'chapter_1': sub.chapter_1[:3000] if sub.chapter_1 else '',
        'chapter_2': sub.chapter_2[:3000] if sub.chapter_2 else '',
        'outline': sub.outline,
        'posting_commitment': sub.posting_commitment,
    }, default=str)

    result = apex_board_json(system_prompt, user_message, max_tokens=2048, temperature=0.3)

    if not result or not isinstance(result, dict):
        log.error("Apex Board review failed for submission #%d", submission_id)
        return None

    # Validate and store
    total = result.get('total_score', 0)
    verdict = result.get('verdict', 'rejected')

    if verdict not in ('approved', 'revision_needed', 'rejected'):
        verdict = 'rejected' if total < 70 else ('approved' if total >= 85 else 'revision_needed')

    return {
        'total_score': total,
        'scores': result.get('scores', {}),
        'verdict': verdict,
        'strengths': result.get('strengths', []),
        'weaknesses': result.get('weaknesses', []),
        'feedback_to_creator': result.get('feedback_to_creator', ''),
        'board_notes': result.get('board_notes', ''),
    }


# ── Story Scouting ───────────────────────────────────────────────────────────

def _gather_scout_candidates(limit=100):
    """Find stories on the platform that might deserve Apex status.
    Looks at non-Apex stories with strong metrics."""

    # Sub-queries
    rating_sq = db.session.query(
        Rating.content_id,
        func.avg(Rating.rating).label('avg_rating'),
        func.count(Rating.id).label('num_ratings'),
    ).group_by(Rating.content_id).subquery()

    fav_sq = db.session.query(
        Favorite.content_id,
        func.count(Favorite.id).label('fav_count'),
    ).group_by(Favorite.content_id).subquery()

    chapter_sq = db.session.query(
        WebBookContent.content_id,
        func.count(WebBookContent.id).label('ch_count'),
    ).filter(WebBookContent.status == 'published').group_by(WebBookContent.content_id).subquery()

    like_sq = db.session.query(
        ChapterLike.content_id,
        func.count(ChapterLike.id).label('like_count'),
    ).group_by(ChapterLike.content_id).subquery()

    eng_score = (
        func.coalesce(Content.views, 0) +
        func.coalesce(rating_sq.c.num_ratings, 0) * 5 +
        func.coalesce(fav_sq.c.fav_count, 0) * 3 +
        func.coalesce(like_sq.c.like_count, 0) * 2
    )

    rows = (
        db.session.query(
            Content.id,
            Content.title,
            Content.genre,
            Content.status,
            Content.views,
            Content.created_at,
            func.coalesce(rating_sq.c.avg_rating, 0).label('avg_rating'),
            func.coalesce(rating_sq.c.num_ratings, 0).label('num_ratings'),
            func.coalesce(fav_sq.c.fav_count, 0).label('fav_count'),
            func.coalesce(chapter_sq.c.ch_count, 0).label('ch_count'),
            func.coalesce(like_sq.c.like_count, 0).label('like_count'),
        )
        .outerjoin(rating_sq, rating_sq.c.content_id == Content.id)
        .outerjoin(fav_sq, fav_sq.c.content_id == Content.id)
        .outerjoin(chapter_sq, chapter_sq.c.content_id == Content.id)
        .outerjoin(like_sq, like_sq.c.content_id == Content.id)
        .filter(
            Content.status.in_(_PUB),
            Content.deleted_at == None,
            Content.is_apex != True,
        )
        .order_by(eng_score.desc())
        .limit(limit)
        .all()
    )

    candidates = []
    now = datetime.utcnow()
    for r in rows:
        age_days = max((now - r.created_at).days, 1) if r.created_at else 1
        candidates.append({
            'id': r.id,
            'title': r.title or 'Untitled',
            'genre': r.genre or 'Unknown',
            'views': int(r.views or 0),
            'avg_rating': round(float(r.avg_rating), 1),
            'num_ratings': int(r.num_ratings),
            'favorites': int(r.fav_count),
            'chapters': int(r.ch_count),
            'likes': int(r.like_count),
            'age_days': age_days,
        })

    return candidates


def scout_stories():
    """AI scouts for potential Apex stories. Returns list of recommended story IDs.

    Called daily — 1 Gemini call.
    """
    from .ai_service import apex_board_json

    candidates = _gather_scout_candidates(limit=100)
    if not candidates:
        return {'status': 'skipped', 'reason': 'no_candidates'}

    system_prompt = APEX_BOARD_PERSONA + """

TASK: Scout for stories that deserve Apex consideration.

You will receive a list of stories with their metrics. Identify stories that show
exceptional potential based on:
- High reader engagement (views, favorites, likes relative to age)
- Strong ratings (avg_rating >= 4.0 with decent number of ratings)
- Sufficient content (chapters >= 5)
- Reader love signals (high favorites-to-views ratio)

Return JSON:
{
    "recommended": [
        {"id": X, "reason": "Brief reason why this story stands out"}
    ],
    "watchlist": [
        {"id": X, "reason": "Why this story is promising but not ready yet"}
    ]
}

Select at most 5 recommended and 10 watchlist stories. Be selective — Apex is prestigious."""

    user_message = json.dumps(candidates, default=str)
    result = apex_board_json(system_prompt, user_message, max_tokens=2048, temperature=0.3)

    if not result or not isinstance(result, dict):
        log.error("Apex Board scouting failed")
        return {'status': 'failed', 'reason': 'ai_error'}

    return {'status': 'success', 'data': result}


# ── Page Curation ────────────────────────────────────────────────────────────

def _gather_apex_books():
    """Get all Apex stories with metadata."""
    rating_sq = db.session.query(
        Rating.content_id,
        func.avg(Rating.rating).label('avg_rating'),
        func.count(Rating.id).label('num_ratings'),
    ).group_by(Rating.content_id).subquery()

    fav_sq = db.session.query(
        Favorite.content_id,
        func.count(Favorite.id).label('fav_count'),
    ).group_by(Favorite.content_id).subquery()

    chapter_sq = db.session.query(
        WebBookContent.content_id,
        func.count(WebBookContent.id).label('ch_count'),
    ).filter(WebBookContent.status == 'published').group_by(WebBookContent.content_id).subquery()

    cutoff_48h = datetime.utcnow() - timedelta(hours=48)
    recent_ch_sq = db.session.query(
        WebBookContent.content_id,
        func.count(WebBookContent.id).label('recent_chapters'),
    ).filter(
        WebBookContent.created_at >= cutoff_48h,
        WebBookContent.status == 'published',
    ).group_by(WebBookContent.content_id).subquery()

    rows = (
        db.session.query(
            Content.id,
            Content.title,
            Content.genre,
            Content.status,
            Content.views,
            Content.created_at,
            Content.cover_file_id,
            func.coalesce(rating_sq.c.avg_rating, 0).label('avg_rating'),
            func.coalesce(rating_sq.c.num_ratings, 0).label('num_ratings'),
            func.coalesce(fav_sq.c.fav_count, 0).label('fav_count'),
            func.coalesce(chapter_sq.c.ch_count, 0).label('ch_count'),
            func.coalesce(recent_ch_sq.c.recent_chapters, 0).label('recent_chapters'),
        )
        .outerjoin(rating_sq, rating_sq.c.content_id == Content.id)
        .outerjoin(fav_sq, fav_sq.c.content_id == Content.id)
        .outerjoin(chapter_sq, chapter_sq.c.content_id == Content.id)
        .outerjoin(recent_ch_sq, recent_ch_sq.c.content_id == Content.id)
        .filter(
            Content.is_apex == True,
            Content.status.in_(_PUB),
            Content.deleted_at == None,
        )
        .all()
    )

    books = []
    now = datetime.utcnow()
    for r in rows:
        age_days = max((now - r.created_at).days, 1) if r.created_at else 1
        books.append({
            'id': r.id,
            'title': r.title or 'Untitled',
            'genre': r.genre or 'Unknown',
            'status': r.status,
            'views': int(r.views or 0),
            'avg_rating': round(float(r.avg_rating), 1),
            'num_ratings': int(r.num_ratings),
            'favorites': int(r.fav_count),
            'chapters': int(r.ch_count),
            'recent_chapters': int(r.recent_chapters),
            'age_days': age_days,
            'has_cover': bool(r.cover_file_id),
            'is_complete': r.status == 'complete',
        })

    return books


def run_apex_curation():
    """Daily Apex page curation. Organises Apex books into 7 sections.

    Returns: dict with results or error info.
    """
    from .ai_service import apex_board_json

    log.info("Starting Apex Board daily curation...")

    books = _gather_apex_books()
    if not books:
        log.info("No Apex books to curate — storing empty sections")
        _store_curation({'sections': {}, 'curated_at': datetime.utcnow().isoformat()})
        return {'status': 'skipped', 'reason': 'no_apex_books'}

    system_prompt = APEX_BOARD_PERSONA + """

TASK: Curate the WiamApex page sections.

You will receive the full list of Apex-contracted stories. Organise them into these sections:

1. "board_spotlight" — 3 stories The Apex Board wants to highlight right now.
   Write a 1-sentence editorial note for each explaining WHY it's spotlighted.

2. "apex_trending" — Up to 5 stories with the most recent reader activity.

3. "apex_top_rated" — Up to 5 highest-rated Apex stories (by avg_rating + num_ratings).

4. "apex_new_arrivals" — Up to 5 newest Apex stories (smallest age_days).

5. "apex_completed" — Up to 5 completed Apex stories (is_complete=true).

6. "apex_most_loved" — Up to 5 most favorited Apex stories.

7. "apex_recently_updated" — Up to 5 stories with recent_chapters > 0.

Return JSON:
{
    "board_spotlight": [
        {"id": X, "editorial_note": "The Apex Board's reason for spotlighting"}
    ],
    "apex_trending": [id1, id2, ...],
    "apex_top_rated": [id1, id2, ...],
    "apex_new_arrivals": [id1, id2, ...],
    "apex_completed": [id1, id2, ...],
    "apex_most_loved": [id1, id2, ...],
    "apex_recently_updated": [id1, id2, ...]
}

RULES:
- Only use IDs from the provided list
- A story can appear in multiple sections
- board_spotlight is the most important — choose stories that truly deserve attention
- editorial_notes should sound like a trusted publisher, not a bot"""

    user_message = json.dumps(books, default=str)
    result = apex_board_json(system_prompt, user_message, max_tokens=4096, temperature=0.4)

    if not result or not isinstance(result, dict):
        log.error("Apex Board curation failed")
        return {'status': 'failed', 'reason': 'ai_error'}

    # Validate IDs
    valid_ids = {b['id'] for b in books}
    validated = {}

    for section, data in result.items():
        if section == 'board_spotlight':
            # Special: list of {id, editorial_note}
            if isinstance(data, list):
                clean = []
                for item in data:
                    if isinstance(item, dict) and int(item.get('id', 0)) in valid_ids:
                        clean.append({
                            'id': int(item['id']),
                            'editorial_note': str(item.get('editorial_note', '')),
                        })
                if clean:
                    validated[section] = clean
        else:
            # Simple list of IDs
            if isinstance(data, list):
                clean_ids = [int(i) for i in data if isinstance(i, (int, float)) and int(i) in valid_ids]
                if clean_ids:
                    validated[section] = clean_ids

    _store_curation({
        'sections': validated,
        'curated_at': datetime.utcnow().isoformat(),
        'book_count': len(books),
    })

    log.info("Apex Board curation complete — %d sections", len(validated))
    return {'status': 'success', 'sections': list(validated.keys()), 'book_count': len(books)}


def _store_curation(cache_data):
    """Store Apex curation data in PlatformSetting."""
    setting = PlatformSetting.query.filter_by(key=CACHE_KEY).first()
    if not setting:
        setting = PlatformSetting(
            key=CACHE_KEY,
            value_type='json',
            description='Apex Board curated sections (auto-refreshed daily)',
        )
        db.session.add(setting)

    setting.set_value(cache_data)
    setting.updated_at = datetime.utcnow()
    db.session.commit()


# ── Read cached curation (called by routes) ──────────────────────────────────

def get_apex_curation():
    """Read cached Apex Board curation. Returns dict of sections or None."""
    try:
        setting = PlatformSetting.query.filter_by(key=CACHE_KEY).first()
        if not setting:
            return None

        data = setting.value
        if not isinstance(data, dict) or 'sections' not in data:
            return None

        curated_at = data.get('curated_at', '')
        if curated_at:
            try:
                ts = datetime.fromisoformat(curated_at)
                age_hours = (datetime.utcnow() - ts).total_seconds() / 3600
                if age_hours > CACHE_MAX_AGE_HOURS:
                    return None
            except (ValueError, TypeError):
                pass

        return data['sections']
    except Exception as e:
        log.error("Error reading Apex curation cache: %s", e)
        return None


def get_apex_section_books(section_name, curation=None):
    """Get Content objects for an Apex section, preserving AI ordering.

    For 'board_spotlight', returns list of (Content, editorial_note) tuples.
    For other sections, returns list of Content objects.
    """
    if curation is None:
        curation = get_apex_curation()

    if not curation:
        return []

    section_data = curation.get(section_name)
    if not section_data:
        return []

    if section_name == 'board_spotlight':
        # Special: list of {id, editorial_note}
        ids = [item['id'] for item in section_data if isinstance(item, dict)]
        notes = {item['id']: item.get('editorial_note', '') for item in section_data if isinstance(item, dict)}
    else:
        ids = section_data
        notes = None

    if not ids:
        return []

    books = Content.query.filter(
        Content.id.in_(ids),
        Content.status.in_(_PUB),
        Content.deleted_at == None,
    ).all()

    id_to_book = {b.id: b for b in books}

    if notes is not None:
        # Return (book, note) tuples
        return [(id_to_book[bid], notes.get(bid, '')) for bid in ids if bid in id_to_book]
    else:
        return [id_to_book[bid] for bid in ids if bid in id_to_book]


# ── Quality Monitoring ───────────────────────────────────────────────────────

def run_quality_check():
    """Check if any Apex stories have dropped in quality metrics.

    Returns stories that might need attention.
    Called daily — 1 Gemini call (only if there are Apex books).
    """
    from .ai_service import apex_board_json

    books = _gather_apex_books()
    if not books:
        return {'status': 'skipped', 'reason': 'no_apex_books'}

    # Only flag if there's something to worry about
    flagged = []
    for b in books:
        issues = []
        if b['avg_rating'] < 3.0 and b['num_ratings'] >= 5:
            issues.append(f"Low rating: {b['avg_rating']}/5 ({b['num_ratings']} ratings)")
        if b['chapters'] >= 10 and b['recent_chapters'] == 0 and b['age_days'] > 30:
            issues.append("No new chapters in 48h despite being established")
        if issues:
            flagged.append({'id': b['id'], 'title': b['title'], 'issues': issues})

    if not flagged:
        return {'status': 'ok', 'message': 'All Apex stories healthy'}

    log.info("Apex quality check flagged %d stories", len(flagged))
    return {'status': 'flagged', 'stories': flagged}


# ── Daily orchestrator ───────────────────────────────────────────────────────

def run_daily_apex_board():
    """Run all Apex Board daily tasks. Called by the scheduler.

    Tasks (in order):
    1. Page curation (organise Apex books into sections)
    2. Story scouting (find potential new Apex candidates)
    3. Quality monitoring (flag dropping stories)

    Total: ~3 Gemini calls per day.
    """
    log.info("=== Apex Board daily session starting ===")
    results = {}

    try:
        results['curation'] = run_apex_curation()
    except Exception as e:
        log.error("Apex curation error: %s", e)
        results['curation'] = {'status': 'error', 'reason': str(e)}

    try:
        results['scouting'] = scout_stories()
    except Exception as e:
        log.error("Apex scouting error: %s", e)
        results['scouting'] = {'status': 'error', 'reason': str(e)}

    try:
        results['quality'] = run_quality_check()
    except Exception as e:
        log.error("Apex quality check error: %s", e)
        results['quality'] = {'status': 'error', 'reason': str(e)}

    log.info("=== Apex Board daily session complete ===")
    return results
