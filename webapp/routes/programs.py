"""
P7 Programs Routes — Reader & Creator engagement programs.

- WiamRising: New creator discovery
- Story Challenges: Weekly/monthly writing challenges
- Gift Subscriptions: Gift premium to friends
- Creator Milestones: Achievement badges
- WiamAmbassador: Referral rewards
- Magic Box: Weekly loot crates for reading/creator goals
"""
import logging
import hashlib
import random
from datetime import datetime, date, timedelta

from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db, csrf
from ..models import (
    User, Content, Follow, Rating, CreatorProfile,
    StoryChallenge, ChallengeEntry, GiftSubscription,
    CreatorMilestone, Referral, PlatformConfig,
    MagicBox, MagicBoxReward, ReadingStreak, CoinBalance,
)

log = logging.getLogger(__name__)

programs_bp = Blueprint('programs', __name__, url_prefix='/programs')


# ── Feature Lock Gate ─────────────────────────────────────────────────

@programs_bp.before_request
def programs_lock_gate():
    """Block access if founder has locked Programs."""
    from flask_login import current_user
    if current_user.is_authenticated and getattr(current_user, 'is_founder', False):
        return None
    from ..extensions import is_feature_locked
    if is_feature_locked('feature_programs'):
        from flask import render_template
        return render_template('feature_locked.html',
            feature_name='WiamApp Programs',
            feature_icon='⭐',
            feature_description='WiamApp Programs includes Reading Streaks, Magic Box, Story Challenges, and more. This feature is not available right now — check back soon!'
        )


# ---------------------------------------------------------------------------
# Programs Hub
# ---------------------------------------------------------------------------

@programs_bp.route('/')
def hub():
    """Programs hub — overview of all available programs."""
    now = datetime.utcnow()
    active_challenges = StoryChallenge.query.filter(
        StoryChallenge.is_active == True,
        StoryChallenge.ends_at > now,
    ).order_by(StoryChallenge.ends_at).limit(6).all()

    # WiamRising — new creators (joined < 60 days, has 1+ story)
    sixty_ago = now - timedelta(days=60)
    rising_creators = db.session.query(User).join(
        Content, Content.creator_wiam_id == User.wiam_id
    ).filter(
        User.date_joined >= sixty_ago,
        User.role.in_(['creator', 'founder']),
        Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
    ).group_by(User.id).limit(12).all()

    return render_template(
        'programs/hub.html',
        active_challenges=active_challenges,
        rising_creators=rising_creators,
    )


# ---------------------------------------------------------------------------
# WiamRising — New Creator Discovery
# ---------------------------------------------------------------------------

@programs_bp.route('/rising')
def rising():
    """WiamRising — discover new creators who joined in the last 60 days."""
    now = datetime.utcnow()
    sixty_ago = now - timedelta(days=60)

    rising_creators = db.session.query(
        User,
        db.func.count(Content.id).label('story_count'),
    ).join(
        Content, Content.creator_wiam_id == User.wiam_id
    ).filter(
        User.date_joined >= sixty_ago,
        User.role.in_(['creator', 'founder']),
        Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
    ).group_by(User.id).order_by(
        db.func.count(Content.id).desc()
    ).limit(30).all()

    return render_template('programs/rising.html', rising_creators=rising_creators)


# ---------------------------------------------------------------------------
# Story Challenges
# ---------------------------------------------------------------------------

@programs_bp.route('/challenges')
def challenges():
    """Browse active and past story challenges."""
    now = datetime.utcnow()
    active = StoryChallenge.query.filter(
        StoryChallenge.is_active == True,
        StoryChallenge.ends_at > now,
    ).order_by(StoryChallenge.ends_at).all()

    past = StoryChallenge.query.filter(
        StoryChallenge.ends_at <= now,
    ).order_by(StoryChallenge.ends_at.desc()).limit(12).all()

    # User's entries
    my_entries = {}
    if current_user.is_authenticated:
        entries = ChallengeEntry.query.filter_by(user_id=current_user.wiam_id).all()
        my_entries = {e.challenge_id: e for e in entries}

    return render_template(
        'programs/challenges.html',
        active_challenges=active,
        past_challenges=past,
        my_entries=my_entries,
    )


@programs_bp.route('/challenges/<int:challenge_id>')
def challenge_detail(challenge_id):
    """View a single challenge and its entries."""
    challenge = StoryChallenge.query.get_or_404(challenge_id)
    entries = db.session.query(ChallengeEntry, User).join(
        User, User.wiam_id == ChallengeEntry.user_id
    ).filter(
        ChallengeEntry.challenge_id == challenge_id,
    ).order_by(ChallengeEntry.created_at.desc()).limit(50).all()

    my_entry = None
    if current_user.is_authenticated:
        my_entry = ChallengeEntry.query.filter_by(
            challenge_id=challenge_id, user_id=current_user.wiam_id
        ).first()

    return render_template(
        'programs/challenge_detail.html',
        challenge=challenge,
        entries=entries,
        my_entry=my_entry,
    )


@programs_bp.route('/challenges/<int:challenge_id>/join', methods=['POST'])
@login_required
def challenge_join(challenge_id):
    """Join a story challenge."""
    challenge = StoryChallenge.query.get_or_404(challenge_id)
    now = datetime.utcnow()

    if now > challenge.ends_at:
        flash('This challenge has ended.', 'error')
        return redirect(url_for('programs.challenge_detail', challenge_id=challenge_id))

    existing = ChallengeEntry.query.filter_by(
        challenge_id=challenge_id, user_id=current_user.wiam_id
    ).first()
    if existing:
        flash('You already joined this challenge!', 'info')
        return redirect(url_for('programs.challenge_detail', challenge_id=challenge_id))

    entry = ChallengeEntry(
        challenge_id=challenge_id,
        user_id=current_user.wiam_id,
        status='joined',
    )
    db.session.add(entry)
    db.session.commit()
    flash(f'You joined "{challenge.title}"! Start writing!', 'success')
    return redirect(url_for('programs.challenge_detail', challenge_id=challenge_id))


# ---------------------------------------------------------------------------
# Gift Subscriptions
# ---------------------------------------------------------------------------

@programs_bp.route('/gift')
@login_required
def gift_sub():
    """Gift a premium subscription to a friend."""
    sent_gifts = GiftSubscription.query.filter_by(
        sender_id=current_user.wiam_id
    ).order_by(GiftSubscription.created_at.desc()).limit(20).all()

    received_gifts = GiftSubscription.query.filter_by(
        recipient_id=current_user.wiam_id
    ).order_by(GiftSubscription.created_at.desc()).limit(20).all()

    return render_template(
        'programs/gift_sub.html',
        sent_gifts=sent_gifts,
        received_gifts=received_gifts,
    )


@programs_bp.route('/gift/send', methods=['POST'])
@login_required
def gift_send():
    """Initiate sending a gift subscription."""
    recipient_email = request.form.get('recipient_email', '').strip().lower()
    plan = request.form.get('plan', 'premium')
    message = request.form.get('message', '').strip()[:200]

    recipient = User.query.filter_by(email=recipient_email).first()
    if not recipient:
        flash('No user found with that email.', 'error')
        return redirect(url_for('programs.gift_sub'))

    if recipient.wiam_id == current_user.wiam_id:
        flash("You can't gift to yourself!", 'error')
        return redirect(url_for('programs.gift_sub'))

    amount = 20.0 if plan == 'premium' else 25.0

    gift = GiftSubscription(
        sender_id=current_user.wiam_id,
        recipient_id=recipient.wiam_id,
        plan=plan,
        duration_months=1,
        amount_ghs=amount,
        status='pending',
        message=message,
    )
    db.session.add(gift)
    db.session.commit()

    # TODO: Redirect to Paystack checkout for the gift amount
    flash(f'Gift created for {recipient.display_name}! Payment integration coming soon.', 'success')
    return redirect(url_for('programs.gift_sub'))


# ---------------------------------------------------------------------------
# Creator Milestones
# ---------------------------------------------------------------------------

MILESTONE_DEFINITIONS = [
    {'key': 'first_story', 'name': 'First Story', 'icon': 'bi-pencil-fill', 'color': '#3498db',
     'desc': 'Published your first story'},
    {'key': '5_stories', 'name': 'Prolific Writer', 'icon': 'bi-journals', 'color': '#2ecc71',
     'desc': 'Published 5 stories'},
    {'key': '10_stories', 'name': 'Story Machine', 'icon': 'bi-stack', 'color': '#9b59b6',
     'desc': 'Published 10 stories'},
    {'key': '100_readers', 'name': 'Rising Star', 'icon': 'bi-star-fill', 'color': '#f1c40f',
     'desc': 'Reached 100 total readers'},
    {'key': '1000_readers', 'name': 'Thousand Club', 'icon': 'bi-people-fill', 'color': '#e74c3c',
     'desc': 'Reached 1,000 total readers'},
    {'key': '50_followers', 'name': 'Community Builder', 'icon': 'bi-heart-fill', 'color': '#e91e63',
     'desc': 'Gained 50 followers'},
    {'key': '100_followers', 'name': 'Fan Favorite', 'icon': 'bi-hearts', 'color': '#d4a843',
     'desc': 'Gained 100 followers'},
    {'key': 'first_tip', 'name': 'First Tip', 'icon': 'bi-coin', 'color': '#d4a843',
     'desc': 'Received your first coin tip'},
    {'key': 'first_payout', 'name': 'Paid Creator', 'icon': 'bi-cash-stack', 'color': '#2ecc71',
     'desc': 'Received your first payout'},
    {'key': 'elite_story', 'name': 'Elite Achiever', 'icon': 'bi-trophy-fill', 'color': '#d4a843',
     'desc': 'One of your stories entered WiamElite'},
    {'key': 'challenge_winner', 'name': 'Challenge Champion', 'icon': 'bi-award-fill', 'color': '#9b59b6',
     'desc': 'Won a Story Challenge'},
    {'key': '30_day_streak', 'name': 'Streak Master', 'icon': 'bi-fire', 'color': '#e74c3c',
     'desc': '30-day reading streak'},
]


@programs_bp.route('/milestones')
@login_required
def milestones():
    """View creator milestones and achievements."""
    earned = CreatorMilestone.query.filter_by(
        user_id=current_user.wiam_id
    ).all()
    earned_keys = {m.milestone_key for m in earned}

    return render_template(
        'programs/milestones.html',
        milestone_defs=MILESTONE_DEFINITIONS,
        earned_keys=earned_keys,
        earned=earned,
    )


def check_and_award_milestones(user_id):
    """Check if a user has earned new milestones. Called after key actions."""
    user = User.query.filter_by(wiam_id=user_id).first()
    if not user:
        return []

    earned_keys = {m.milestone_key for m in
                   CreatorMilestone.query.filter_by(user_id=user_id).all()}
    new_milestones = []

    # Story count milestones
    story_count = Content.query.filter(
        Content.creator_wiam_id == user_id,
        Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
    ).count()

    checks = [
        ('first_story', story_count >= 1),
        ('5_stories', story_count >= 5),
        ('10_stories', story_count >= 10),
    ]

    # Reader count
    total_reads = db.session.query(
        db.func.coalesce(db.func.sum(Content.views), 0)
    ).filter(Content.creator_wiam_id == user_id).scalar() or 0

    checks.extend([
        ('100_readers', total_reads >= 100),
        ('1000_readers', total_reads >= 1000),
    ])

    # Follower count
    follower_count = Follow.query.filter_by(creator_id=user_id).count()
    checks.extend([
        ('50_followers', follower_count >= 50),
        ('100_followers', follower_count >= 100),
    ])

    for mdef in MILESTONE_DEFINITIONS:
        key = mdef['key']
        if key in earned_keys:
            continue
        for check_key, condition in checks:
            if check_key == key and condition:
                milestone = CreatorMilestone(
                    user_id=user_id,
                    milestone_key=key,
                    milestone_name=mdef['name'],
                    milestone_icon=mdef['icon'],
                    milestone_color=mdef['color'],
                )
                db.session.add(milestone)
                new_milestones.append(mdef)
                break

    if new_milestones:
        db.session.commit()

    return new_milestones


# ---------------------------------------------------------------------------
# WiamAmbassador — Referral Program
# ---------------------------------------------------------------------------

def _generate_referral_code(user_id):
    """Generate a unique referral code for a user."""
    raw = f'wiam_{user_id}_{datetime.utcnow().timestamp()}'
    return 'WA' + hashlib.md5(raw.encode()).hexdigest()[:8].upper()


@programs_bp.route('/ambassador')
@login_required
def ambassador():
    """WiamAmbassador referral dashboard."""
    uid = current_user.wiam_id

    # Ensure user has a referral code
    if not current_user.referral_code:
        code = _generate_referral_code(uid)
        try:
            user = User.query.get(current_user.id)
            user.referral_code = code
            db.session.commit()
        except Exception:
            db.session.rollback()

    referrals = Referral.query.filter_by(referrer_id=uid).order_by(
        Referral.created_at.desc()
    ).all()

    total_coins = sum(r.coins_earned for r in referrals)
    active_referrals = sum(1 for r in referrals if r.status in ('active_reader', 'premium_convert'))

    return render_template(
        'programs/ambassador.html',
        referrals=referrals,
        total_coins=total_coins,
        active_referrals=active_referrals,
        referral_code=current_user.referral_code or '',
    )


# ---------------------------------------------------------------------------
# Magic Box — Weekly Loot Crate
# ---------------------------------------------------------------------------

READER_GOALS = [
    {'key': 'read_3_days', 'label': 'Read on 3 different days', 'threshold': 3},
    {'key': 'read_5_stories', 'label': 'Read 5 different stories', 'threshold': 5},
    {'key': 'read_60_min', 'label': 'Read for 60+ minutes total', 'threshold': 60},
    {'key': 'maintain_streak', 'label': 'Maintain a 7-day streak', 'threshold': 7},
    {'key': 'rate_2_stories', 'label': 'Rate 2 stories', 'threshold': 2},
]

CREATOR_GOALS = [
    {'key': 'publish_chapter', 'label': 'Publish a new chapter', 'threshold': 1},
    {'key': 'gain_5_followers', 'label': 'Gain 5 new followers this week', 'threshold': 5},
    {'key': 'get_10_reads', 'label': 'Get 10+ reads on any story', 'threshold': 10},
]

TIER_THRESHOLDS = {
    'bronze': 2,    # 2 goals met
    'silver': 3,    # 3 goals met
    'gold': 4,      # 4 goals met
    'diamond': 5,   # all 5 goals met
}

TIER_REWARDS = {
    'bronze':  [('coins', 5, 15), ('xp_boost', 1, 1)],
    'silver':  [('coins', 10, 30), ('xp_boost', 1, 1), ('streak_shield', 0, 1)],
    'gold':    [('coins', 20, 50), ('streak_shield', 1, 1), ('badge', 1, 1)],
    'diamond': [('coins', 40, 80), ('streak_shield', 1, 1), ('badge', 1, 1), ('xp_boost', 1, 2)],
}

REWARD_LABELS = {
    'coins': '🪙 {} Wiam Coins',
    'streak_shield': '🛡️ Streak Shield',
    'xp_boost': '⚡ XP Boost ({}x)',
    'badge': '🏅 Mystery Badge',
}


def _current_week_start():
    """Return Monday of the current ISO week."""
    today = date.today()
    return today - timedelta(days=today.weekday())


def _check_reader_goals(uid, week_start):
    """Evaluate which reader goals the user met this week."""
    week_end = week_start + timedelta(days=7)
    met = []

    # Days with reading activity
    reading_days = ReadingStreak.query.filter(
        ReadingStreak.user_id == uid,
        ReadingStreak.date >= week_start,
        ReadingStreak.date < week_end,
        ReadingStreak.minutes_read > 0,
    ).count()
    if reading_days >= 3:
        met.append('read_3_days')

    # Total minutes read this week
    from sqlalchemy import func
    total_min = db.session.query(
        func.coalesce(func.sum(ReadingStreak.minutes_read), 0)
    ).filter(
        ReadingStreak.user_id == uid,
        ReadingStreak.date >= week_start,
        ReadingStreak.date < week_end,
    ).scalar() or 0
    if total_min >= 60:
        met.append('read_60_min')

    # Different stories read (via Access table)
    from ..models import Access
    stories_read = Access.query.filter(
        Access.user_id == uid,
        Access.start_date >= datetime.combine(week_start, datetime.min.time()),
        Access.start_date < datetime.combine(week_end, datetime.min.time()),
    ).with_entities(Access.content_id).distinct().count()
    if stories_read >= 5:
        met.append('read_5_stories')

    # Streak check — current streak >= 7
    today = date.today()
    streak = 0
    d = today
    while True:
        entry = ReadingStreak.query.filter_by(user_id=uid, date=d).first()
        if entry and entry.minutes_read > 0:
            streak += 1
            d -= timedelta(days=1)
        else:
            break
    if streak >= 7:
        met.append('maintain_streak')

    # Ratings given this week
    ratings = Rating.query.filter(
        Rating.user_id == uid,
        Rating.created_at >= datetime.combine(week_start, datetime.min.time()),
        Rating.created_at < datetime.combine(week_end, datetime.min.time()),
    ).count()
    if ratings >= 2:
        met.append('rate_2_stories')

    return met


def _check_creator_goals(uid, week_start):
    """Evaluate which creator goals the user met this week."""
    from ..models import WebBookContent
    week_end = week_start + timedelta(days=7)
    met = []

    # Published chapters this week (join through Content to match creator)
    chapters = db.session.query(WebBookContent).join(
        Content, Content.id == WebBookContent.content_id
    ).filter(
        Content.creator_wiam_id == uid,
        WebBookContent.created_at >= datetime.combine(week_start, datetime.min.time()),
        WebBookContent.created_at < datetime.combine(week_end, datetime.min.time()),
    ).count()
    if chapters >= 1:
        met.append('publish_chapter')

    # New followers this week
    new_follows = Follow.query.filter(
        Follow.creator_id == uid,
        Follow.created_at >= datetime.combine(week_start, datetime.min.time()),
        Follow.created_at < datetime.combine(week_end, datetime.min.time()),
    ).count()
    if new_follows >= 5:
        met.append('gain_5_followers')

    # Reads on any story this week
    from sqlalchemy import func
    week_reads = db.session.query(
        func.coalesce(func.sum(Content.views), 0)
    ).filter(
        Content.creator_wiam_id == uid,
    ).scalar() or 0
    if week_reads >= 10:
        met.append('get_10_reads')

    return met


def _determine_tier(goals_met_count, is_creator=False):
    """Determine crate tier from number of goals met."""
    if is_creator:
        if goals_met_count >= 3:
            return 'gold'
        elif goals_met_count >= 2:
            return 'silver'
        elif goals_met_count >= 1:
            return 'bronze'
        return None
    # Reader tiers
    for tier in ('diamond', 'gold', 'silver', 'bronze'):
        if goals_met_count >= TIER_THRESHOLDS[tier]:
            return tier
    return None


def _generate_rewards(tier):
    """Generate random rewards for a given tier."""
    rewards = []
    for reward_type, min_qty, max_qty in TIER_REWARDS.get(tier, []):
        qty = random.randint(min_qty, max_qty)
        if qty <= 0:
            continue
        label = REWARD_LABELS.get(reward_type, reward_type).format(qty)
        rewards.append({
            'type': reward_type,
            'key': f'{reward_type}_{qty}',
            'label': label,
            'quantity': qty,
        })
    return rewards


@programs_bp.route('/magic-box')
@login_required
def magic_box():
    """Magic Box — Weekly Loot Crate page."""
    uid = current_user.wiam_id
    ws = _current_week_start()

    # Check existing boxes for this week
    reader_box = MagicBox.query.filter_by(user_id=uid, week_start=ws, source='reader').first()
    creator_box = None
    if getattr(current_user, 'is_creator', False):
        creator_box = MagicBox.query.filter_by(user_id=uid, week_start=ws, source='creator').first()

    # Evaluate current goals progress
    reader_goals_met = _check_reader_goals(uid, ws)
    creator_goals_met = []
    if getattr(current_user, 'is_creator', False):
        creator_goals_met = _check_creator_goals(uid, ws)

    reader_tier = _determine_tier(len(reader_goals_met))
    creator_tier = _determine_tier(len(creator_goals_met), is_creator=True) if creator_goals_met else None

    # Existing rewards for opened boxes
    reader_rewards = []
    if reader_box and reader_box.opened_at:
        reader_rewards = MagicBoxReward.query.filter_by(box_id=reader_box.id).all()
    creator_rewards = []
    if creator_box and creator_box.opened_at:
        creator_rewards = MagicBoxReward.query.filter_by(box_id=creator_box.id).all()

    # Past boxes (last 8 weeks)
    past_boxes = MagicBox.query.filter(
        MagicBox.user_id == uid,
        MagicBox.week_start < ws,
    ).order_by(MagicBox.week_start.desc()).limit(16).all()

    return render_template(
        'programs/magic_box.html',
        week_start=ws,
        reader_box=reader_box,
        creator_box=creator_box,
        reader_goals=READER_GOALS,
        creator_goals=CREATOR_GOALS,
        reader_goals_met=reader_goals_met,
        creator_goals_met=creator_goals_met,
        reader_tier=reader_tier,
        creator_tier=creator_tier,
        reader_rewards=reader_rewards,
        creator_rewards=creator_rewards,
        past_boxes=past_boxes,
        tier_thresholds=TIER_THRESHOLDS,
    )


@programs_bp.route('/magic-box/earn', methods=['POST'])
@login_required
@csrf.exempt
def magic_box_earn():
    """Earn (claim) a magic box for the current week."""
    uid = current_user.wiam_id
    ws = _current_week_start()
    source = request.form.get('source', 'reader')

    if source == 'creator' and not getattr(current_user, 'is_creator', False):
        flash('Only creators can earn creator crates.', 'error')
        return redirect(url_for('programs.magic_box'))

    existing = MagicBox.query.filter_by(user_id=uid, week_start=ws, source=source).first()
    if existing:
        flash('You already earned this week\'s crate!', 'info')
        return redirect(url_for('programs.magic_box'))

    if source == 'creator':
        goals_met = _check_creator_goals(uid, ws)
        tier = _determine_tier(len(goals_met), is_creator=True)
    else:
        goals_met = _check_reader_goals(uid, ws)
        tier = _determine_tier(len(goals_met))

    if not tier:
        flash('You haven\'t met enough goals yet. Keep reading!', 'info')
        return redirect(url_for('programs.magic_box'))

    box = MagicBox(
        user_id=uid,
        tier=tier,
        week_start=ws,
        source=source,
        goals_met=','.join(goals_met),
    )
    db.session.add(box)
    db.session.commit()

    flash(f'You earned a {tier.title()} Crate! Open it now!', 'success')
    return redirect(url_for('programs.magic_box'))


@programs_bp.route('/magic-box/open/<int:box_id>', methods=['POST'])
@login_required
@csrf.exempt
def magic_box_open(box_id):
    """Open a sealed magic box to reveal rewards."""
    box = MagicBox.query.get_or_404(box_id)
    if box.user_id != current_user.wiam_id:
        flash('That crate doesn\'t belong to you.', 'error')
        return redirect(url_for('programs.magic_box'))

    if box.opened_at:
        flash('This crate is already opened!', 'info')
        return redirect(url_for('programs.magic_box'))

    # Generate rewards
    rewards = _generate_rewards(box.tier)
    for r in rewards:
        reward = MagicBoxReward(
            box_id=box.id,
            reward_type=r['type'],
            reward_key=r['key'],
            reward_label=r['label'],
            quantity=r['quantity'],
        )
        db.session.add(reward)

        # Apply coin rewards immediately
        if r['type'] == 'coins':
            try:
                bal = CoinBalance.query.filter_by(user_id=current_user.wiam_id).first()
                if bal:
                    bal.balance = (bal.balance or 0) + r['quantity']
                else:
                    bal = CoinBalance(user_id=current_user.wiam_id, balance=r['quantity'])
                    db.session.add(bal)
            except Exception:
                log.exception('Failed to credit coins from magic box')

    box.opened_at = datetime.utcnow()
    db.session.commit()

    # Return rewards as JSON for the animation
    return jsonify({
        'ok': True,
        'tier': box.tier,
        'rewards': rewards,
    })
