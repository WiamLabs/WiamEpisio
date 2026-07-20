"""
WiamElite Algorithm Service — V2 Ultra-Hard
100% automated. No human picks stories. The algorithm decides.

A story must meet ALL 17 thresholds simultaneously AND sustain them
for 6 consecutive monthly checks before earning WiamElite status.

When a book achieves Elite:
- Creator gets Gold Verified Badge (1 year)
- Book chapter coins get 3x multiplier
- Creator earns 60% revenue on that book (instead of 50%)
- Platform-wide celebration announcement
- Shareable celebration card
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import (
    Content, EliteStory, Rating, ReadingProgress, Favorite,
    WebBookContent, ContentFlag, User, Notification, Follow,
    ShareEvent, ChapterUnlock,
)

log = logging.getLogger(__name__)

# ── Promotion Thresholds (must meet ALL simultaneously) ───────────────
THRESHOLDS = {
    'total_reads': 1_000_000,        # 1 MILLION reads
    'unique_readers': 50_000,        # 50K individual readers
    'avg_rating': 4.7,               # near perfect quality
    'total_ratings': 2_000,          # 2K ratings
    'completion_rate': 0.70,         # 70% of readers finish
    'active_readers_30d': 2_000,     # 2K active readers this month
    'chapter_count': 50,             # 50+ published chapters
    'total_words': 200_000,          # 200K+ words (full novel)
    'total_votes': 5_000,            # 5K favorites
    'total_shares': 1_000,           # 1K shares
    'paid_read_ratio': 0.50,         # 50% of reads are paid
    'reader_return_rate': 0.50,      # 50% read 10+ chapters
    'creator_followers': 5_000,      # 5K followers
    'creator_account_age_days': 365, # 1 year account age
    'violations_365d': 0,            # zero violations in 1 year
    'publishing_consistency_months': 12,  # active publishing for 12 months
    'min_chapters_per_month': 2,     # at least 2 chapters/month
}

# Must sustain ALL thresholds for this many consecutive monthly checks
SUSTAINED_MONTHS_REQUIRED = 6

# ── Demotion Thresholds ───────────────────────────────────────────────
DEMOTION = {
    'active_readers_30d': 500,   # drop below 500 active readers
    'avg_rating': 4.0,          # rating drops below 4.0
    'paid_read_ratio': 0.30,    # paid reads drop below 30%
}

# ── Elite Benefits ────────────────────────────────────────────────────
ELITE_COIN_MULTIPLIER = 3.0     # 3x chapter coin pricing
ELITE_REVENUE_PCT = 0.60        # 60% creator revenue split
VERIFIED_BADGE_DURATION_DAYS = 365  # 1 year badge


def compute_story_metrics(content_id):
    """Compute all WiamElite V2 metrics for a single story."""
    story = Content.query.get(content_id)
    if not story:
        return None

    now = datetime.utcnow()
    d30 = now - timedelta(days=30)
    d365 = now - timedelta(days=365)

    # Total reads (views)
    total_reads = story.views or 0

    # Unique readers (distinct users with reading progress)
    unique_readers = ReadingProgress.query.filter_by(
        content_id=content_id
    ).count()

    # Ratings
    rating_stats = db.session.query(
        func.avg(Rating.rating),
        func.count(Rating.id),
    ).filter_by(content_id=content_id).first()
    avg_rating = float(rating_stats[0] or 0)
    total_ratings = rating_stats[1] or 0

    # Published chapters
    chapters = WebBookContent.query.filter_by(
        content_id=content_id,
        status='published',
    ).all()
    chapter_count = len(chapters)

    # Total words across all published chapters
    total_words = sum(ch.word_count or 0 for ch in chapters)

    # Completion rate (readers who reached last chapter / total readers)
    if chapter_count > 0 and unique_readers > 0:
        completed = ReadingProgress.query.filter(
            ReadingProgress.content_id == content_id,
            ReadingProgress.current_chapter >= chapter_count,
        ).count()
        completion_rate = completed / unique_readers
    else:
        completion_rate = 0.0

    # Active readers in last 30 days
    active_readers_30d = ReadingProgress.query.filter(
        ReadingProgress.content_id == content_id,
        ReadingProgress.last_read_at >= d30,
    ).count()

    # Reader return rate (% who read 10+ chapters)
    if unique_readers > 0:
        deep_readers = ReadingProgress.query.filter(
            ReadingProgress.content_id == content_id,
            ReadingProgress.current_chapter >= 10,
        ).count()
        reader_return_rate = deep_readers / unique_readers
    else:
        reader_return_rate = 0.0

    # Total favorites (votes)
    total_votes = Favorite.query.filter_by(content_id=content_id).count()

    # Total shares
    total_shares = ShareEvent.query.filter_by(content_id=content_id).count()

    # Paid reads and ratio
    paid_reads = ChapterUnlock.query.filter_by(content_id=content_id).count()
    total_chapter_reads = ReadingProgress.query.filter_by(content_id=content_id).count()
    paid_read_ratio = (paid_reads / max(total_chapter_reads, 1))

    # Creator followers
    creator = story.creator
    creator_followers = 0
    creator_age_days = 0
    if creator:
        creator_followers = Follow.query.filter_by(
            creator_id=creator.wiam_id
        ).count()
        if creator.date_joined:
            creator_age_days = (now - creator.date_joined).days

    # Violations in last 365 days
    violations_365d = ContentFlag.query.filter(
        ContentFlag.content_id == content_id,
        ContentFlag.status.in_(['flagged', 'hidden']),
        ContentFlag.created_at >= d365,
    ).count()

    # Publishing consistency: check chapters published per month over last 12 months
    publishing_months = 0
    for m in range(12):
        month_start = now - timedelta(days=30 * (m + 1))
        month_end = now - timedelta(days=30 * m)
        ch_in_month = WebBookContent.query.filter(
            WebBookContent.content_id == content_id,
            WebBookContent.status == 'published',
            WebBookContent.created_at >= month_start,
            WebBookContent.created_at < month_end,
        ).count()
        if ch_in_month >= THRESHOLDS['min_chapters_per_month']:
            publishing_months += 1

    return {
        'total_reads': total_reads,
        'unique_readers': unique_readers,
        'avg_rating': round(avg_rating, 2),
        'total_ratings': total_ratings,
        'completion_rate': round(completion_rate, 3),
        'active_readers_30d': active_readers_30d,
        'chapter_count': chapter_count,
        'total_words': total_words,
        'total_votes': total_votes,
        'total_shares': total_shares,
        'paid_reads': paid_reads,
        'paid_read_ratio': round(paid_read_ratio, 3),
        'reader_return_rate': round(reader_return_rate, 3),
        'creator_followers': creator_followers,
        'creator_account_age_days': creator_age_days,
        'violations_365d': violations_365d,
        'publishing_consistency_months': publishing_months,
    }


def check_all_thresholds(metrics):
    """Check if metrics meet ALL promotion thresholds (single check)."""
    if not metrics:
        return False
    return (
        metrics['total_reads'] >= THRESHOLDS['total_reads'] and
        metrics['unique_readers'] >= THRESHOLDS['unique_readers'] and
        metrics['avg_rating'] >= THRESHOLDS['avg_rating'] and
        metrics['total_ratings'] >= THRESHOLDS['total_ratings'] and
        metrics['completion_rate'] >= THRESHOLDS['completion_rate'] and
        metrics['active_readers_30d'] >= THRESHOLDS['active_readers_30d'] and
        metrics['chapter_count'] >= THRESHOLDS['chapter_count'] and
        metrics['total_words'] >= THRESHOLDS['total_words'] and
        metrics['total_votes'] >= THRESHOLDS['total_votes'] and
        metrics['total_shares'] >= THRESHOLDS['total_shares'] and
        metrics['paid_read_ratio'] >= THRESHOLDS['paid_read_ratio'] and
        metrics['reader_return_rate'] >= THRESHOLDS['reader_return_rate'] and
        metrics['creator_followers'] >= THRESHOLDS['creator_followers'] and
        metrics['creator_account_age_days'] >= THRESHOLDS['creator_account_age_days'] and
        metrics['violations_365d'] <= THRESHOLDS['violations_365d'] and
        metrics['publishing_consistency_months'] >= THRESHOLDS['publishing_consistency_months']
    )


def check_promotion(metrics, elite_record):
    """
    Check if a story should be promoted to WiamElite.
    Must meet ALL thresholds for 6 consecutive monthly checks.
    """
    if not check_all_thresholds(metrics):
        return False

    # Check sustained period
    months = (elite_record.consecutive_months_qualified if elite_record else 0) + 1
    return months >= SUSTAINED_MONTHS_REQUIRED


def check_demotion(metrics):
    """Check if an elite story should be demoted."""
    if not metrics:
        return True
    if metrics['violations_365d'] > 0:
        return True
    if metrics['active_readers_30d'] < DEMOTION['active_readers_30d']:
        return True
    if metrics['avg_rating'] < DEMOTION['avg_rating']:
        return True
    if metrics['paid_read_ratio'] < DEMOTION['paid_read_ratio']:
        return True
    return False


def promote_story(content_id, metrics):
    """
    Officially promote a story to WiamElite.
    Grants: verified badge, 3x coin multiplier, 60% revenue, celebration.
    """
    now = datetime.utcnow()
    existing = EliteStory.query.filter_by(content_id=content_id).first()
    if existing and existing.is_active:
        return existing  # Already elite

    if existing:
        elite = existing
        elite.is_active = True
        elite.promoted_at = now
        elite.demoted_at = None
    else:
        elite = EliteStory(content_id=content_id)
        db.session.add(elite)

    # Set all cached metrics
    _update_elite_metrics(elite, metrics)

    # Set elite benefits
    elite.coin_multiplier = ELITE_COIN_MULTIPLIER
    elite.creator_revenue_pct = ELITE_REVENUE_PCT
    elite.verified_badge_expires = now + timedelta(days=VERIFIED_BADGE_DURATION_DAYS)
    elite.elite_streak_days = 0
    elite.last_checked = now

    db.session.commit()

    # ── CELEBRATION ──
    story = Content.query.get(content_id)
    if story and story.creator_wiam_id:
        # Notify creator with full celebration
        _notify(
            story.creator_wiam_id,
            'elite_promoted',
            'YOUR STORY ACHIEVED WIAMELITE!',
            f'"{story.title}" has earned WiamElite status — the HIGHEST honor on WiamApp! '
            f'You now receive: Gold Verified Badge (1 year), 60% revenue on this book, '
            f'3x chapter coin pricing, and a platform-wide celebration. '
            f'Share your achievement with the world!',
            f'/elite/celebrate/{content_id}',
        )

        # Send branded WiamElite email to creator
        try:
            creator = User.query.filter_by(wiam_id=story.creator_wiam_id).first()
            if creator and getattr(creator, 'email', None):
                from .email_service import send_elite_email
                send_elite_email(creator.email, creator.display_name, story.title)
        except Exception:
            pass

        # Notify all the book's readers
        reader_ids = db.session.query(ReadingProgress.user_id).filter_by(
            content_id=content_id
        ).distinct().limit(10000).all()
        for (rid,) in reader_ids:
            if rid != story.creator_wiam_id:
                _notify(
                    rid,
                    'elite_book_you_read',
                    'A story you read just made WiamElite!',
                    f'"{story.title}" has achieved WiamElite — the highest honor on WiamApp. '
                    f'You were part of its journey!',
                    f'/elite',
                )

        # Notify all creator's followers
        from ..models import Follow
        follower_ids = db.session.query(Follow.user_id).filter_by(
            creator_id=story.creator_wiam_id
        ).distinct().limit(10000).all()
        for (fid,) in follower_ids:
            if fid != story.creator_wiam_id:
                _notify(
                    fid,
                    'elite_creator_you_follow',
                    'A creator you follow just achieved WiamElite!',
                    f'{story.author or "Your favorite creator"} just earned WiamElite '
                    f'with "{story.title}". Check it out!',
                    f'/elite',
                )

    log.info("WiamElite V2 PROMOTED: content_id=%d (sustained %d months)",
             content_id, SUSTAINED_MONTHS_REQUIRED)
    return elite


def demote_story(content_id, reason=''):
    """Remove a story from WiamElite."""
    elite = EliteStory.query.filter_by(content_id=content_id, is_active=True).first()
    if not elite:
        return

    elite.is_active = False
    elite.demoted_at = datetime.utcnow()
    elite.consecutive_months_qualified = 0
    db.session.commit()

    story = Content.query.get(content_id)
    if story and story.creator_wiam_id:
        try:
            from .notifications import notify_elite_demotion
            notify_elite_demotion(story.creator_wiam_id, story.title, content_id)
        except Exception as e:
            log.warning("Elite demotion notification failed: %s", str(e)[:100])

    log.info("WiamElite DEMOTED: content_id=%d reason=%s", content_id, reason)


def run_elite_algorithm():
    """
    Run the full WiamElite V2 algorithm.
    Called daily by the background scheduler.

    For non-elite stories: check if they meet ALL thresholds.
      - If yes: increment consecutive_months_qualified.
      - If consecutive_months_qualified >= 6: PROMOTE.
    For elite stories: update metrics, check demotion.
    """
    now = datetime.utcnow()
    promoted_count = 0
    demoted_count = 0

    published = Content.query.filter(
        Content.status.in_(Content.PUBLISHED_STATUSES),
        Content.deleted_at == None,
    ).all()

    for story in published:
        metrics = compute_story_metrics(story.id)
        if not metrics:
            continue

        elite = EliteStory.query.filter_by(content_id=story.id).first()
        is_currently_elite = elite and elite.is_active

        if not is_currently_elite:
            # Check if story meets all thresholds
            meets_all = check_all_thresholds(metrics)

            if meets_all:
                if not elite:
                    # Create tracking record
                    elite = EliteStory(content_id=story.id, is_active=False)
                    elite.consecutive_months_qualified = 0
                    elite.first_qualified_at = elite.first_qualified_at or now
                    db.session.add(elite)

                elite.consecutive_months_qualified = (elite.consecutive_months_qualified or 0) + 1
                _update_elite_metrics(elite, metrics)
                elite.last_checked = now

                if not elite.first_qualified_at:
                    elite.first_qualified_at = now

                # Check if sustained long enough for promotion
                if elite.consecutive_months_qualified >= SUSTAINED_MONTHS_REQUIRED:
                    elite.is_active = True
                    elite.promoted_at = now
                    elite.demoted_at = None
                    elite.coin_multiplier = ELITE_COIN_MULTIPLIER
                    elite.creator_revenue_pct = ELITE_REVENUE_PCT
                    elite.verified_badge_expires = now + timedelta(days=VERIFIED_BADGE_DURATION_DAYS)
                    db.session.commit()
                    # Full celebration
                    _celebrate_promotion(story.id, metrics)
                    promoted_count += 1
                else:
                    log.info("WiamElite tracking: content_id=%d month %d/%d",
                             story.id, elite.consecutive_months_qualified, SUSTAINED_MONTHS_REQUIRED)
            elif elite and not elite.is_active:
                # Reset counter — broke the streak
                elite.consecutive_months_qualified = 0
                elite.first_qualified_at = None
                elite.last_checked = now

        elif is_currently_elite:
            # Update cached metrics
            _update_elite_metrics(elite, metrics)
            elite.last_checked = now
            elite.elite_streak_days = (now - elite.promoted_at).days if elite.promoted_at else 0

            if check_demotion(metrics):
                demote_story(story.id)
                demoted_count += 1

    db.session.commit()
    log.info("WiamElite V2 algorithm complete: %d promoted, %d demoted", promoted_count, demoted_count)
    return {'promoted': promoted_count, 'demoted': demoted_count}


def _update_elite_metrics(elite, metrics):
    """Update cached metrics on an EliteStory record."""
    elite.total_reads = metrics['total_reads']
    elite.unique_readers = metrics['unique_readers']
    elite.avg_rating = metrics['avg_rating']
    elite.total_ratings = metrics['total_ratings']
    elite.completion_rate = metrics['completion_rate']
    elite.active_readers_30d = metrics['active_readers_30d']
    elite.chapter_count = metrics['chapter_count']
    elite.total_words = metrics['total_words']
    elite.total_votes = metrics['total_votes']
    elite.total_shares = metrics['total_shares']
    elite.paid_reads = metrics['paid_reads']
    elite.paid_read_ratio = metrics['paid_read_ratio']
    elite.reader_return_rate = metrics['reader_return_rate']
    elite.creator_followers = metrics['creator_followers']


def _celebrate_promotion(content_id, metrics):
    """Send full celebration notifications when a story achieves Elite."""
    story = Content.query.get(content_id)
    if not story or not story.creator_wiam_id:
        return

    # Notify creator
    _notify(
        story.creator_wiam_id,
        'elite_promoted',
        'YOUR STORY ACHIEVED WIAMELITE!',
        f'"{story.title}" has earned WiamElite status — the HIGHEST honor on WiamApp! '
        f'After 6 months of sustained excellence, your story has proven itself legendary. '
        f'You now receive: Gold Verified Badge (1 year), 60% revenue, '
        f'3x chapter coin pricing, and a platform-wide celebration!',
        f'/elite/celebrate/{content_id}',
    )

    # Notify readers (batch, max 10K)
    reader_ids = db.session.query(ReadingProgress.user_id).filter_by(
        content_id=content_id
    ).distinct().limit(10000).all()
    for (rid,) in reader_ids:
        if rid != story.creator_wiam_id:
            _notify(rid, 'elite_book_you_read',
                    'A story you read just made WiamElite!',
                    f'"{story.title}" achieved WiamElite — the highest honor on WiamApp!',
                    '/elite')

    # Notify followers (batch, max 10K)
    follower_ids = db.session.query(Follow.user_id).filter_by(
        creator_id=story.creator_wiam_id
    ).distinct().limit(10000).all()
    for (fid,) in follower_ids:
        if fid != story.creator_wiam_id:
            _notify(fid, 'elite_creator_you_follow',
                    'A creator you follow achieved WiamElite!',
                    f'{story.author or "A creator you follow"} earned WiamElite with "{story.title}"!',
                    '/elite')

    log.info("WiamElite celebration sent for content_id=%d", content_id)


def get_elite_stories(limit=50):
    """Get all active WiamElite stories with their Content objects."""
    elites = EliteStory.query.filter_by(is_active=True).order_by(
        EliteStory.total_reads.desc()
    ).limit(limit).all()

    results = []
    for e in elites:
        story = Content.query.filter(
            Content.id == e.content_id,
            Content.deleted_at == None,
            Content.status.in_(Content.PUBLISHED_STATUSES),
        ).first()
        if story:
            results.append({'story': story, 'elite': e})
    return results


def get_elite_leaderboard(limit=20):
    """Get Elite stories ranked by total reads (leaderboard)."""
    return get_elite_stories(limit=limit)


def is_elite(content_id):
    """Check if a specific story is currently WiamElite."""
    e = EliteStory.query.filter_by(content_id=content_id, is_active=True).first()
    return e is not None


def has_elite_subscription(user_id):
    """Check if a user has a valid WiamElite subscription (active or cancelled within grace)."""
    from ..models import EliteSubscription
    sub = EliteSubscription.query.filter_by(
        user_id=user_id, status='active'
    ).first()
    if sub and sub.is_valid:
        return True
    # Also check recently cancelled subs still within 3-day grace period
    sub = EliteSubscription.query.filter_by(
        user_id=user_id, status='cancelled'
    ).order_by(EliteSubscription.id.desc()).first()
    return sub is not None and sub.is_valid


def creator_has_verified_badge(creator_wiam_id):
    """Check if a creator has an active verified badge from WiamElite."""
    now = datetime.utcnow()
    has_badge = EliteStory.query.filter(
        EliteStory.is_active == True,
        EliteStory.verified_badge_expires > now,
    ).join(Content, Content.id == EliteStory.content_id).filter(
        Content.creator_wiam_id == creator_wiam_id,
    ).first()
    return has_badge is not None


def get_threshold_progress(content_id):
    """Get how far a story is toward each Elite threshold (for display)."""
    metrics = compute_story_metrics(content_id)
    if not metrics:
        return None

    progress = {}
    mapping = {
        'total_reads': 'total_reads',
        'unique_readers': 'unique_readers',
        'avg_rating': 'avg_rating',
        'total_ratings': 'total_ratings',
        'completion_rate': 'completion_rate',
        'active_readers_30d': 'active_readers_30d',
        'chapter_count': 'chapter_count',
        'total_words': 'total_words',
        'total_votes': 'total_votes',
        'total_shares': 'total_shares',
        'paid_read_ratio': 'paid_read_ratio',
        'reader_return_rate': 'reader_return_rate',
        'creator_followers': 'creator_followers',
        'creator_account_age_days': 'creator_account_age_days',
        'violations_365d': 'violations_365d',
        'publishing_consistency_months': 'publishing_consistency_months',
    }

    for key, metric_key in mapping.items():
        threshold = THRESHOLDS[key]
        current = metrics[metric_key]
        if key == 'violations_365d':
            met = current <= threshold
            pct = 100.0 if met else 0.0
        else:
            pct = min(100.0, (current / max(threshold, 0.001)) * 100)
            met = current >= threshold
        progress[key] = {
            'current': current,
            'threshold': threshold,
            'percentage': round(pct, 1),
            'met': met,
        }

    # Add sustained months tracking
    elite = EliteStory.query.filter_by(content_id=content_id).first()
    sustained = elite.consecutive_months_qualified if elite else 0
    progress['sustained_months'] = {
        'current': sustained,
        'threshold': SUSTAINED_MONTHS_REQUIRED,
        'percentage': round(min(100.0, (sustained / SUSTAINED_MONTHS_REQUIRED) * 100), 1),
        'met': sustained >= SUSTAINED_MONTHS_REQUIRED,
    }

    return progress


def _notify(user_id, ntype, title, message, link=None):
    """Create an in-app notification."""
    try:
        notif = Notification(
            user_id=user_id,
            type=ntype,
            title=title,
            message=message,
            link=link,
        )
        db.session.add(notif)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        log.warning("Elite notification failed: %s", str(e)[:100])
