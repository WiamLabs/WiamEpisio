"""WiamPremium routes — subscription page, Paystack integration, management."""
import logging
import requests as http_requests
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app
from flask_login import login_required, current_user
from datetime import datetime, timedelta

from ..extensions import db
from ..models import PremiumSubscription, PlatformConfig, User

log = logging.getLogger(__name__)

premium_bp = Blueprint('premium', __name__, url_prefix='/premium')


# ── Feature Lock Gate ─────────────────────────────────────────────────

@premium_bp.before_request
def premium_lock_gate():
    """Block access if founder has locked WiamPremium."""
    if current_user.is_authenticated and getattr(current_user, 'is_founder', False):
        return None
    from ..extensions import is_feature_locked
    if is_feature_locked('feature_premium'):
        return render_template('feature_locked.html',
            feature_name='WiamPremium',
            feature_icon='💎',
            feature_description='WiamPremium subscriptions are not available right now. We\'re working on something exciting — check back soon!'
        )


# ---------------------------------------------------------------------------
# Subscribe page
# ---------------------------------------------------------------------------

@premium_bp.route('/')
def premium_page():
    """WiamPremium subscription landing page."""
    cfg = PlatformConfig.get()
    current_sub = None
    is_subscribed = False

    if current_user.is_authenticated:
        uid = current_user.wiam_id
        current_sub = PremiumSubscription.query.filter_by(
            user_id=uid, status='active'
        ).first()
        if not current_sub:
            current_sub = PremiumSubscription.query.filter_by(
                user_id=uid, status='cancelled'
            ).order_by(PremiumSubscription.id.desc()).first()
            if current_sub and not current_sub.is_valid:
                current_sub = None
        is_subscribed = current_sub is not None

    return render_template(
        'premium_subscribe.html',
        is_subscribed=is_subscribed,
        current_sub=current_sub,
        price_ghs=cfg.premium_price_ghs,
        credits_per_month=cfg.premium_monthly_unlock_credits,
    )


# ---------------------------------------------------------------------------
# Paystack subscription activation
# ---------------------------------------------------------------------------

@premium_bp.route('/activate', methods=['POST'])
@login_required
def activate():
    """Initialize Paystack transaction for WiamPremium subscription."""
    uid = current_user.wiam_id

    existing = PremiumSubscription.query.filter_by(user_id=uid, status='active').first()
    if existing and existing.is_valid:
        flash('You already have an active WiamPremium subscription.', 'info')
        return redirect(url_for('premium.premium_page'))

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    plan_code = current_app.config.get('PAYSTACK_PREMIUM_PLAN_CODE', '')
    if not secret or not plan_code:
        log.error("Paystack keys or premium plan code not configured")
        flash('Subscription system not configured yet. Please contact support.', 'error')
        return redirect(url_for('premium.premium_page'))

    from ..models import PlatformConfig
    cfg = PlatformConfig.get()
    amount_pesewas = int(cfg.premium_price_ghs * 100)

    email = current_user.email or f'user{uid}@wiamapp.com'

    payload = {
        'email': email,
        'amount': amount_pesewas,
        'currency': 'GHS',
        'plan': plan_code,
        'callback_url': url_for('premium.callback', _external=True),
        'metadata': {
            'user_id': uid,
            'type': 'premium_subscription',
            'custom_fields': [
                {'display_name': 'User', 'variable_name': 'user_id', 'value': str(uid)},
                {'display_name': 'Plan', 'variable_name': 'plan', 'value': 'WiamPremium Monthly'},
            ],
        },
    }

    try:
        resp = http_requests.post(
            'https://api.paystack.co/transaction/initialize',
            json=payload,
            headers={
                'Authorization': f'Bearer {secret}',
                'Content-Type': 'application/json',
            },
            timeout=15,
        )
        data = resp.json()
        if data.get('status') and data.get('data', {}).get('authorization_url'):
            log.info("Premium sub initialized for user %s, ref=%s", uid,
                     data['data'].get('reference', '?'))
            return redirect(data['data']['authorization_url'])
        else:
            log.error("Paystack premium init failed: %s", data.get('message'))
            flash('Could not start subscription. Please try again.', 'error')
            return redirect(url_for('premium.premium_page'))
    except Exception as e:
        log.error("Paystack premium init error: %s", e)
        flash('Payment service unavailable. Please try again later.', 'error')
        return redirect(url_for('premium.premium_page'))


# ---------------------------------------------------------------------------
# Callback (Paystack redirects here)
# ---------------------------------------------------------------------------

@premium_bp.route('/callback')
@login_required
def callback():
    """Paystack redirects here after WiamPremium payment."""
    reference = request.args.get('reference', '')
    uid = current_user.wiam_id

    if not reference:
        flash('Invalid payment reference.', 'error')
        return redirect(url_for('premium.premium_page'))

    existing = PremiumSubscription.query.filter_by(paystack_reference=reference).first()
    if existing:
        flash('WiamPremium activated! Enjoy your premium benefits.', 'success')
        return redirect(url_for('premium.manage'))

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    try:
        resp = http_requests.get(
            f'https://api.paystack.co/transaction/verify/{reference}',
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        payload = resp.json()
        tx_data = payload.get('data', {})

        if not (payload.get('status') and tx_data.get('status') == 'success'):
            flash('Payment was not completed. Please try again.', 'error')
            return redirect(url_for('premium.premium_page'))

        meta = tx_data.get('metadata', {})
        if meta.get('type') != 'premium_subscription':
            flash('Payment received but type mismatch. Contact support with ref: ' + reference, 'error')
            return redirect(url_for('premium.premium_page'))

        existing = PremiumSubscription.query.filter_by(paystack_reference=reference).first()
        if existing:
            flash('WiamPremium activated!', 'success')
            return redirect(url_for('premium.manage'))

        now = datetime.utcnow()
        sub = PremiumSubscription(
            user_id=uid,
            plan='monthly',
            amount_ghs=tx_data.get('amount', 2000) / 100,
            status='active',
            paystack_reference=reference,
            started_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.session.add(sub)

        # Activate premium status on user
        from ..services.premium_service import activate_premium, grant_monthly_credits
        user = User.query.filter_by(wiam_id=uid).first()
        if user:
            activate_premium(user, plan='monthly', provider='paystack',
                             expires_at=now + timedelta(days=30))
            grant_monthly_credits(user)

        db.session.commit()
        log.info("Premium sub callback: created for user %s ref=%s", uid, reference)
        flash('WiamPremium activated! Enjoy your premium benefits.', 'success')
        return redirect(url_for('premium.manage'))

    except Exception as e:
        log.error("Premium sub callback error: %s", e)
        flash('Could not verify payment. Your subscription will activate shortly.', 'info')
        return redirect(url_for('premium.premium_page'))


# ---------------------------------------------------------------------------
# Cancel subscription
# ---------------------------------------------------------------------------

@premium_bp.route('/cancel', methods=['POST'])
@login_required
def cancel():
    """Cancel WiamPremium subscription via Paystack API."""
    uid = current_user.wiam_id
    sub = PremiumSubscription.query.filter_by(user_id=uid, status='active').first()
    if not sub:
        flash('No active subscription found.', 'info')
        return redirect(url_for('premium.premium_page'))

    if sub.paystack_sub_code:
        secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
        try:
            resp = http_requests.post(
                'https://api.paystack.co/subscription/disable',
                json={
                    'code': sub.paystack_sub_code,
                    'token': sub.paystack_email_token or '',
                },
                headers={
                    'Authorization': f'Bearer {secret}',
                    'Content-Type': 'application/json',
                },
                timeout=15,
            )
            result = resp.json()
            log.info("Paystack cancel premium sub %s: %s", sub.paystack_sub_code,
                     result.get('message', '?'))
        except Exception as e:
            log.error("Paystack cancel error for premium sub %s: %s", sub.paystack_sub_code, e)

    sub.status = 'cancelled'
    sub.cancelled_at = datetime.utcnow()
    db.session.commit()
    flash('WiamPremium cancelled. You retain access until your current period ends.', 'info')
    return redirect(url_for('premium.manage'))


# ---------------------------------------------------------------------------
# Subscription management page (P3)
# ---------------------------------------------------------------------------

@premium_bp.route('/manage')
@login_required
def manage():
    """Subscription management — view status, credits, billing history."""
    uid = current_user.wiam_id
    cfg = PlatformConfig.get()

    # Current premium subscription
    premium_sub = PremiumSubscription.query.filter_by(
        user_id=uid
    ).order_by(PremiumSubscription.id.desc()).first()

    # Current elite subscription
    from ..models import EliteSubscription
    elite_sub = EliteSubscription.query.filter_by(
        user_id=uid
    ).order_by(EliteSubscription.id.desc()).first()

    # Premium credits
    from ..services.premium_service import is_premium_active
    user = current_user
    credits = getattr(user, 'premium_credits_balance', 0) or 0
    credits_cycle_end = getattr(user, 'premium_credits_cycle_end', None)

    # Billing history (all subscriptions)
    all_premium = PremiumSubscription.query.filter_by(user_id=uid).order_by(
        PremiumSubscription.created_at.desc()
    ).limit(12).all()

    all_elite = EliteSubscription.query.filter_by(user_id=uid).order_by(
        EliteSubscription.created_at.desc()
    ).limit(12).all()

    return render_template(
        'subscription_manage.html',
        premium_sub=premium_sub,
        elite_sub=elite_sub,
        is_premium=is_premium_active(user),
        credits=credits,
        credits_cycle_end=credits_cycle_end,
        all_premium=all_premium,
        all_elite=all_elite,
        cfg=cfg,
    )


# ---------------------------------------------------------------------------
# Apex browse page (P2)
# ---------------------------------------------------------------------------

@premium_bp.route('/apex')
def apex_page():
    """WiamApex — AI-curated Apex stories by The Apex Board."""
    # Feature lock gate — founders bypass
    if not (current_user.is_authenticated and getattr(current_user, 'is_founder', False)):
        from ..extensions import is_feature_locked
        if is_feature_locked('feature_apex'):
            return render_template('feature_locked.html',
                feature_name='WiamApex',
                feature_icon='🏆',
                feature_description='WiamApex showcases AI-curated top stories on the platform. This feature is not available right now — check back soon!'
            )

    from ..models import Content
    from ..services.premium_service import is_premium_active as _is_prem
    from ..services.apex_ai import get_apex_curation, get_apex_section_books

    cfg = PlatformConfig.get()
    is_prem_user = _is_prem(current_user) if current_user.is_authenticated else False

    # Try AI curation first
    curation = get_apex_curation()

    if curation:
        # AI-curated sections
        board_spotlight = get_apex_section_books('board_spotlight', curation)
        apex_trending = get_apex_section_books('apex_trending', curation)
        apex_top_rated = get_apex_section_books('apex_top_rated', curation)
        apex_new_arrivals = get_apex_section_books('apex_new_arrivals', curation)
        apex_completed = get_apex_section_books('apex_completed', curation)
        apex_most_loved = get_apex_section_books('apex_most_loved', curation)
        apex_recently_updated = get_apex_section_books('apex_recently_updated', curation)
    else:
        # Fallback: simple query (no AI available yet)
        all_apex = Content.query.filter(
            Content.is_apex == True,
            Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
            Content.deleted_at == None,
        ).order_by(Content.views.desc()).all()
        board_spotlight = []
        apex_trending = all_apex[:5]
        apex_top_rated = all_apex[:5]
        apex_new_arrivals = all_apex[:5]
        apex_completed = [b for b in all_apex if b.status == 'complete'][:5]
        apex_most_loved = all_apex[:5]
        apex_recently_updated = all_apex[:5]

    # All Apex stories for the full grid
    apex_stories = Content.query.filter_by(is_apex=True).filter(
        Content.deleted_at == None,
        Content.status.in_(['ongoing', 'complete', 'approved', 'published']),
    ).order_by(Content.views.desc()).all()

    return render_template(
        'apex.html',
        apex_stories=apex_stories,
        board_spotlight=board_spotlight,
        apex_trending=apex_trending,
        apex_top_rated=apex_top_rated,
        apex_new_arrivals=apex_new_arrivals,
        apex_completed=apex_completed,
        apex_most_loved=apex_most_loved,
        apex_recently_updated=apex_recently_updated,
        is_premium=is_prem_user,
        apex_paywall=cfg.ff_apex_paywall_enabled,
        has_ai_curation=curation is not None,
    )
