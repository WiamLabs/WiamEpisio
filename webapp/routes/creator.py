"""Creator profile pages."""
from flask import Blueprint, render_template, redirect, url_for, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func
from ..extensions import db, csrf
from ..models import User, Content, CreatorProfile, Follow, Rating, EliteStory

creator_bp = Blueprint('creator', __name__)


@creator_bp.route('/creator/<username>')
def profile(username):
    """Public creator profile page."""
    user = User.query.filter_by(username=username).first()
    if not user or user.role not in ('creator', 'admin', 'founder'):
        # Try matching by wiam_id as fallback
        try:
            user = User.query.filter_by(wiam_id=int(username)).first()
        except (ValueError, TypeError):
            pass
        if not user or user.role not in ('creator', 'admin', 'founder'):
            return render_template('creator_profile.html', creator=None), 404

    try:
        # Get creator profile (pen name, bio, etc.)
        cp = CreatorProfile.query.filter_by(wiam_id=user.wiam_id).first()

        # Get books
        books = Content.query.filter(
            Content.creator_wiam_id == user.wiam_id,
            Content.status.in_(Content.PUBLISHED_STATUSES),
            Content.deleted_at == None
        ).order_by(func.coalesce(Content.published_at, Content.created_at).desc()).all()

        # Stats
        book_count = len(books)
        total_views = sum(b.views or 0 for b in books)

        # Follower count
        follower_count = Follow.query.filter_by(creator_id=user.id).count()

        # Average rating across all books
        book_ids = [b.id for b in books]
        avg_rating = 0
        rating_count = 0
        if book_ids:
            result = db.session.query(
                func.count(Rating.id),
                func.coalesce(func.avg(Rating.rating), 0)
            ).filter(Rating.content_id.in_(book_ids)).first()
            rating_count = result[0] or 0
            avg_rating = round(float(result[1] or 0), 1)

        # Is current user following this creator?
        is_following = False
        if current_user.is_authenticated and current_user.id != user.id:
            is_following = Follow.query.filter_by(
                user_id=current_user.id,
                creator_id=user.id
            ).first() is not None

        # WiamElite: check if creator has any elite stories
        elite_ids = set()
        if book_ids:
            elite_entries = EliteStory.query.filter(
                EliteStory.content_id.in_(book_ids),
                EliteStory.is_active == True,
            ).all()
            elite_ids = {e.content_id for e in elite_entries}
        is_elite_creator = len(elite_ids) > 0

        return render_template('creator_profile.html',
            creator=user,
            profile=cp,
            books=books,
            book_count=book_count,
            total_views=total_views,
            follower_count=follower_count,
            avg_rating=avg_rating,
            rating_count=rating_count,
            is_following=is_following,
            elite_ids=elite_ids,
            is_elite_creator=is_elite_creator,
        )
    except Exception:
        return render_template('creator_profile.html',
            creator=user,
            profile=None,
            books=[],
            book_count=0,
            total_views=0,
            follower_count=0,
            avg_rating=0,
            rating_count=0,
            is_following=False,
            elite_ids=set(),
            is_elite_creator=False,
        )


@creator_bp.route('/creator/<int:creator_id>/follow', methods=['POST'])
@csrf.exempt
def toggle_follow(creator_id):
    """Toggle follow/unfollow a creator. Uses User.id (primary key) — works for email + all auth types."""
    if not current_user.is_authenticated:
        return jsonify({'error': 'Login required'}), 401

    if current_user.id == creator_id:
        return jsonify({'error': 'Cannot follow yourself'}), 400

    # ── Rate Guard (follow spam) ──
    from ..services.rate_guard import check_rate
    allowed, rate_msg = check_rate(current_user.id, 'follow')
    if not allowed:
        return jsonify({'error': rate_msg}), 429

    existing = Follow.query.filter_by(
        user_id=current_user.id,
        creator_id=creator_id
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        following = False
    else:
        follow = Follow(user_id=current_user.id, creator_id=creator_id)
        db.session.add(follow)
        db.session.commit()
        following = True
        try:
            from ..services.notifications import notify_new_follower
            notify_new_follower(creator_id, current_user.display_name)
        except Exception:
            pass

    count = Follow.query.filter_by(creator_id=creator_id).count()
    return jsonify({'following': following, 'count': count})
