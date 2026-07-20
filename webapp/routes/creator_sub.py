"""Creator Subscription API routes — subscribe, cancel, manage tiers, check perks."""
import logging
from flask import Blueprint, request, jsonify
from datetime import datetime

from ..extensions import db
from ..models import (
    User, CreatorSubTier, CreatorSubscription, CreatorSubEarning,
)
from ..services.creator_sub_service import (
    subscribe_to_creator, cancel_subscription, check_subscription,
    get_subscriber_perks, get_creator_tiers, get_subscriber_count,
    create_tier, update_tier, tier_to_dict, subscription_to_dict,
    is_creator_eligible_for_subs, can_reader_subscribe,
    get_creator_eligibility_progress,
)

log = logging.getLogger(__name__)

creator_sub_bp = Blueprint('creator_sub', __name__, url_prefix='/api/v1/creator-sub')


# ---------------------------------------------------------------------------
# JWT helpers (reuse from api_v1)
# ---------------------------------------------------------------------------

def _get_api_user(required=True):
    """Extract authenticated user from JWT (same logic as api_v1)."""
    from ..routes.api_v1 import _decode_token
    from ..services.premium_service import check_and_expire_premium

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None if not required else None
    token = auth_header[7:]
    user_id = _decode_token(token)
    if not user_id:
        return None
    user = User.query.get(user_id)
    if user:
        check_and_expire_premium(user)
    return user


def _require_auth():
    """Return (user, error_response). If user is None, return the error."""
    user = _get_api_user()
    if not user:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if user.status == 'banned':
        return None, (jsonify({'error': 'Account is banned'}), 403)
    return user, None


# ---------------------------------------------------------------------------
# Reader endpoints
# ---------------------------------------------------------------------------

@creator_sub_bp.route('/subscribe', methods=['POST'])
def subscribe():
    """Subscribe to a creator's tier."""
    user, err = _require_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    creator_id = data.get('creator_id')
    tier_id = data.get('tier_id')

    if not creator_id or not tier_id:
        return jsonify({'error': 'creator_id and tier_id required'}), 400

    ok, result = subscribe_to_creator(user, int(creator_id), int(tier_id))
    if not ok:
        return jsonify(result), 400

    return jsonify(result), 201


@creator_sub_bp.route('/cancel', methods=['POST'])
def cancel():
    """Cancel subscription to a creator."""
    user, err = _require_auth()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    creator_id = data.get('creator_id')
    if not creator_id:
        return jsonify({'error': 'creator_id required'}), 400

    ok, result = cancel_subscription(user.id, int(creator_id))
    if not ok:
        return jsonify(result), 400

    return jsonify(result)


@creator_sub_bp.route('/my-subscriptions')
def my_subscriptions():
    """List all of the reader's creator subscriptions."""
    user, err = _require_auth()
    if err:
        return err

    subs = CreatorSubscription.query.filter_by(
        subscriber_id=user.id
    ).filter(
        CreatorSubscription.status.in_(['active', 'paused'])
    ).order_by(CreatorSubscription.started_at.desc()).all()

    return jsonify({
        'subscriptions': [subscription_to_dict(s) for s in subs],
        'count': len(subs),
    })


@creator_sub_bp.route('/check/<int:creator_id>')
def check(creator_id):
    """Check if the current user is subscribed to a creator."""
    user = _get_api_user(required=False)
    if not user:
        return jsonify({
            'is_subscribed': False,
            'perks': {},
            'can_subscribe': False,
            'reason': 'Not authenticated',
        })

    sub = check_subscription(user.id, creator_id)
    perks = get_subscriber_perks(user.id, creator_id)
    can_sub, reason = can_reader_subscribe(user)

    # Check if creator is eligible
    creator = User.query.get(creator_id)
    creator_eligible = False
    creator_reason = ''
    if creator:
        creator_eligible, creator_reason = is_creator_eligible_for_subs(creator)

    return jsonify({
        'is_subscribed': sub is not None and sub.is_valid,
        'subscription': subscription_to_dict(sub) if sub else None,
        'perks': perks,
        'can_subscribe': can_sub and creator_eligible,
        'reason': reason if not can_sub else (creator_reason if not creator_eligible else ''),
        'tiers': [tier_to_dict(t) for t in get_creator_tiers(creator_id)] if creator_eligible else [],
    })


# ---------------------------------------------------------------------------
# Creator endpoints — tier management
# ---------------------------------------------------------------------------

@creator_sub_bp.route('/tiers', methods=['GET'])
def list_tiers():
    """List the current creator's subscription tiers."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    tiers = get_creator_tiers(user.id, active_only=False)
    eligible, reason = is_creator_eligible_for_subs(user)
    progress = get_creator_eligibility_progress(user)

    return jsonify({
        'tiers': [tier_to_dict(t) for t in tiers],
        'eligible': eligible,
        'reason': reason,
        'eligibility_progress': progress,
        'subscriber_count': get_subscriber_count(user.id),
    })


@creator_sub_bp.route('/tiers', methods=['POST'])
def create_tier_route():
    """Create a new subscription tier."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    data = request.get_json(silent=True) or {}
    name = data.get('name', 'Supporter').strip()
    price = data.get('price_ghs', 5.0)
    description = data.get('description', '').strip()
    billing_period = data.get('billing_period', 'monthly')
    yearly_price = data.get('yearly_price_ghs')

    if not name or len(name) > 50:
        return jsonify({'error': 'Tier name required (max 50 chars)'}), 400
    if not isinstance(price, (int, float)) or price < 1 or price > 100:
        return jsonify({'error': 'Price must be between GHS 1 and GHS 100'}), 400
    if yearly_price is not None:
        if not isinstance(yearly_price, (int, float)) or yearly_price < 1 or yearly_price > 1000:
            return jsonify({'error': 'Yearly price must be between GHS 1 and GHS 1000'}), 400

    perks = {
        'subscriber_posts': data.get('perk_subscriber_posts', True),
        'early_access_hours': data.get('perk_early_access_hours', 0),
        'badge': data.get('perk_badge', True),
        'author_notes': data.get('perk_author_notes', False),
        'no_ads': data.get('perk_no_ads', True),
        'priority_comments': data.get('perk_priority_comments', False),
    }

    tier, msg = create_tier(
        user.id, name, float(price), description,
        billing_period=billing_period,
        yearly_price_ghs=float(yearly_price) if yearly_price else None,
        **perks,
    )
    if not tier:
        return jsonify({'error': msg}), 400

    return jsonify(tier_to_dict(tier)), 201


@creator_sub_bp.route('/tiers/<int:tier_id>', methods=['PUT', 'PATCH'])
def update_tier_route(tier_id):
    """Update an existing subscription tier."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    data = request.get_json(silent=True) or {}
    fields = {}
    if 'name' in data:
        fields['name'] = data['name'].strip()[:50]
    if 'price_ghs' in data:
        fields['price_ghs'] = float(data['price_ghs'])
    if 'description' in data:
        fields['description'] = data['description'].strip()
    if 'billing_period' in data:
        fields['billing_period'] = data['billing_period']
    if 'yearly_price_ghs' in data:
        val = data['yearly_price_ghs']
        fields['yearly_price_ghs'] = float(val) if val else None
    for perk in ('subscriber_posts', 'early_access_hours', 'badge',
                 'author_notes', 'no_ads', 'priority_comments'):
        if f'perk_{perk}' in data:
            fields[perk] = data[f'perk_{perk}']
    if 'is_active' in data:
        fields['is_active'] = bool(data['is_active'])

    tier, msg = update_tier(tier_id, user.id, **fields)
    if not tier:
        return jsonify({'error': msg}), 400

    return jsonify(tier_to_dict(tier))


@creator_sub_bp.route('/subscribers')
def list_subscribers():
    """List subscribers for the current creator."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 50)

    query = CreatorSubscription.query.filter_by(
        creator_id=user.id
    ).filter(
        CreatorSubscription.status.in_(['active', 'paused'])
    ).order_by(CreatorSubscription.started_at.desc())

    total = query.count()
    subs = query.offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for s in subs:
        subscriber = User.query.get(s.subscriber_id)
        items.append({
            'subscription_id': s.id,
            'subscriber': {
                'id': subscriber.id if subscriber else s.subscriber_id,
                'username': subscriber.username if subscriber else 'Unknown',
                'display_name': subscriber.display_name if subscriber else 'Unknown',
                'avatar_url': subscriber.avatar_url if subscriber else None,
            },
            'tier': tier_to_dict(s.tier) if s.tier else None,
            'status': s.status,
            'started_at': s.started_at.isoformat() if s.started_at else None,
            'expires_at': s.expires_at.isoformat() if s.expires_at else None,
        })

    return jsonify({
        'subscribers': items,
        'total': total,
        'page': page,
        'per_page': per_page,
    })


@creator_sub_bp.route('/earnings')
def subscription_earnings():
    """Get subscription earnings for the current creator."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    # Summary
    from sqlalchemy import func
    total_earned = db.session.query(
        func.coalesce(func.sum(CreatorSubEarning.creator_share_ghs), 0)
    ).filter_by(creator_id=user.id).scalar()

    pending = db.session.query(
        func.coalesce(func.sum(CreatorSubEarning.creator_share_ghs), 0)
    ).filter_by(creator_id=user.id, status='pending').scalar()

    recent = CreatorSubEarning.query.filter_by(
        creator_id=user.id
    ).order_by(CreatorSubEarning.created_at.desc()).limit(20).all()

    return jsonify({
        'total_earned_ghs': round(float(total_earned), 2),
        'pending_ghs': round(float(pending), 2),
        'subscriber_count': get_subscriber_count(user.id),
        'recent_earnings': [{
            'id': e.id,
            'amount_ghs': e.amount_ghs,
            'creator_share_ghs': e.creator_share_ghs,
            'period_start': e.period_start.isoformat(),
            'period_end': e.period_end.isoformat(),
            'status': e.status,
        } for e in recent],
    })


@creator_sub_bp.route('/eligibility')
def eligibility_progress():
    """Get the current creator's eligibility progress towards subscriptions."""
    user, err = _require_auth()
    if err:
        return err

    if not user.is_creator:
        return jsonify({'error': 'Creator account required'}), 403

    progress = get_creator_eligibility_progress(user)
    return jsonify(progress)


# ---------------------------------------------------------------------------
# Public endpoint — view a creator's tiers (for non-authenticated browsing)
# ---------------------------------------------------------------------------

@creator_sub_bp.route('/creator/<int:creator_id>/tiers')
def creator_tiers_public(creator_id):
    """Get a creator's active subscription tiers (public)."""
    creator = User.query.get(creator_id)
    if not creator:
        return jsonify({'error': 'Creator not found'}), 404

    eligible, reason = is_creator_eligible_for_subs(creator)
    tiers = get_creator_tiers(creator_id) if eligible else []

    return jsonify({
        'creator_id': creator_id,
        'creator_name': creator.display_name,
        'eligible': eligible,
        'reason': reason if not eligible else '',
        'tiers': [tier_to_dict(t) for t in tiers],
        'subscriber_count': get_subscriber_count(creator_id),
    })
