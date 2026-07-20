"""Coin purchase routes — Paystack integration for buying Wiam Coins."""
import hmac
import hashlib
import logging
import requests
from datetime import datetime, timedelta
from flask import (
    Blueprint, render_template, request, redirect,
    url_for, flash, jsonify, current_app,
)
from flask_login import login_required, current_user
from ..extensions import db, csrf
from ..models import (
    CoinBalance, CoinTransaction, CoinPackage,
    ChapterUnlock, CreatorEarnings, WebBookContent, Content,
    EliteSubscription, PremiumSubscription, User,
)

log = logging.getLogger(__name__)

payment_bp = Blueprint('payment', __name__, url_prefix='/payment')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_balance(user_id):
    """Get or create a CoinBalance row for the user."""
    bal = CoinBalance.query.get(user_id)
    if not bal:
        bal = CoinBalance(user_id=user_id, balance=0, total_purchased=0, total_spent=0)
        db.session.add(bal)
        db.session.commit()
    return bal


def _credit_coins(user_id, coins, reference, description='Coin purchase'):
    """Credit coins to a user's balance and log the transaction."""
    bal = _get_or_create_balance(user_id)
    bal.balance += coins
    bal.total_purchased += coins
    bal.updated_at = datetime.utcnow()

    tx = CoinTransaction(
        user_id=user_id,
        type='purchase',
        amount=coins,
        balance_after=bal.balance,
        description=description,
        reference=reference,
    )
    db.session.add(tx)
    db.session.commit()
    try:
        from ..services.notifications import notify_coin_received
        notify_coin_received(user_id, coins, description)
    except Exception:
        pass
    return bal


def _verify_paystack(reference):
    """Verify a transaction with Paystack API. Returns (success, data)."""
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        log.error("PAYSTACK_SECRET_KEY not configured")
        return False, {}
    try:
        resp = requests.get(
            f'https://api.paystack.co/transaction/verify/{reference}',
            headers={'Authorization': f'Bearer {secret}'},
            timeout=15,
        )
        payload = resp.json()
        if payload.get('status') and payload['data'].get('status') == 'success':
            return True, payload['data']
        return False, payload.get('data', {})
    except Exception as e:
        log.error("Paystack verify error: %s", e)
        return False, {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@payment_bp.route('/coins')
@login_required
def coins():
    """Show available coin packages for purchase."""
    packages = CoinPackage.query.filter_by(is_active=True).order_by(CoinPackage.sort_order).all()
    bal = _get_or_create_balance(current_user.wiam_id)
    return render_template('payment/coins.html',
        packages=packages,
        balance=bal,
        paystack_public_key=current_app.config.get('PAYSTACK_PUBLIC_KEY', ''),
    )


@payment_bp.route('/coins/initialize', methods=['POST'])
@login_required
def initialize():
    """Initialize a Paystack transaction for a coin package."""
    package_id = request.form.get('package_id', type=int)
    if not package_id:
        flash('Invalid package.', 'error')
        return redirect(url_for('payment.coins'))

    pkg = CoinPackage.query.get(package_id)
    if not pkg or not pkg.is_active:
        flash('Package not available.', 'error')
        return redirect(url_for('payment.coins'))

    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        flash('Payment system not configured.', 'error')
        return redirect(url_for('payment.coins'))

    # Determine user email (required by Paystack)
    email = current_user.email or f'user{current_user.wiam_id}@wiamapp.com'

    payload = {
        'email': email,
        'amount': pkg.price_pesewas,
        'currency': 'GHS',
        'callback_url': url_for('payment.callback', _external=True),
        'metadata': {
            'user_id': current_user.wiam_id,
            'package_id': pkg.id,
            'coins': pkg.total_coins,
            'custom_fields': [
                {'display_name': 'User', 'variable_name': 'user_id', 'value': str(current_user.wiam_id)},
                {'display_name': 'Package', 'variable_name': 'package', 'value': f'{pkg.total_coins} coins'},
            ],
        },
    }

    try:
        resp = requests.post(
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
            return redirect(data['data']['authorization_url'])
        else:
            log.error("Paystack init failed: %s", data.get('message'))
            flash('Could not start payment. Please try again.', 'error')
            return redirect(url_for('payment.coins'))
    except Exception as e:
        log.error("Paystack init error: %s", e)
        flash('Payment service unavailable. Please try again later.', 'error')
        return redirect(url_for('payment.coins'))


@payment_bp.route('/callback')
@login_required
def callback():
    """Paystack redirects here after payment. Verify status and show result.
    Coins are ONLY credited via the webhook (server-to-server), never here.
    This prevents fake credits from users navigating back/forward."""
    reference = request.args.get('reference', '')
    if not reference:
        flash('Invalid payment reference.', 'error')
        return redirect(url_for('payment.coins'))

    # Check if already credited by webhook
    existing = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    if existing:
        flash(f'{existing.amount} coins added to your account!', 'success')
        return redirect(url_for('payment.success', reference=reference))

    # Verify with Paystack API to check payment status
    success, data = _verify_paystack(reference)
    if not success:
        flash('Payment was not completed. No coins were charged.', 'error')
        return redirect(url_for('payment.coins'))

    # Payment succeeded on Paystack side — credit coins here as backup
    # (webhook should handle this, but in case webhook is delayed)
    meta = data.get('metadata', {})
    user_id = meta.get('user_id')
    package_id = meta.get('package_id')
    coins_to_credit = meta.get('coins')

    # Verify amount actually paid matches expected
    amount_paid = data.get('amount', 0)  # in pesewas
    if not user_id or not coins_to_credit:
        log.error("Paystack callback missing metadata: ref=%s", reference)
        flash('Payment received but could not process. Contact support with ref: ' + reference, 'error')
        return redirect(url_for('payment.coins'))

    if int(user_id) != current_user.wiam_id:
        flash('Payment user mismatch. Contact support.', 'error')
        return redirect(url_for('payment.coins'))

    # Verify the amount paid matches the package price
    pkg = CoinPackage.query.get(package_id) if package_id else None
    if pkg and amount_paid < pkg.price_pesewas:
        log.error("Amount mismatch: paid=%s expected=%s ref=%s", amount_paid, pkg.price_pesewas, reference)
        flash('Payment amount mismatch. Contact support.', 'error')
        return redirect(url_for('payment.coins'))

    # Double-check idempotency (webhook may have processed while we verified)
    existing = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    if existing:
        flash(f'{existing.amount} coins added to your account!', 'success')
        return redirect(url_for('payment.success', reference=reference))

    price_ghs = amount_paid / 100
    try:
        from ..services.ledger import record_coin_purchase
        result = record_coin_purchase(
            int(user_id), int(coins_to_credit), price_ghs,
            reference, package_id=package_id,
        )
        if result.get('error'):
            log.warning("Ledger callback failed: %s", result['error'])
            _credit_coins(int(user_id), int(coins_to_credit), reference,
                          f'Purchased {coins_to_credit} coins (callback-fallback)')
    except Exception as e:
        log.error("Ledger callback error, falling back: %s", e)
        _credit_coins(int(user_id), int(coins_to_credit), reference,
                      f'Purchased {coins_to_credit} coins')
    log.info("Callback credited %s coins to user %s (ref=%s)", coins_to_credit, user_id, reference)

    flash(f'{coins_to_credit} Wiam Coins added to your account!', 'success')
    return redirect(url_for('payment.success', reference=reference))


@payment_bp.route('/webhook', methods=['POST'])
@csrf.exempt
def webhook():
    """Paystack webhook — server-to-server notification. Verifies signature."""
    secret = current_app.config.get('PAYSTACK_SECRET_KEY', '')
    if not secret:
        return jsonify({'error': 'not configured'}), 500

    # Verify signature
    sig = request.headers.get('X-Paystack-Signature', '')
    body = request.get_data()
    expected = hmac.HMAC(secret.encode(), body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(sig, expected):
        log.warning("Paystack webhook: invalid signature")
        return jsonify({'error': 'invalid signature'}), 400

    payload = request.get_json(silent=True) or {}
    event = payload.get('event', '')
    log.info("Paystack webhook event: %s", event)

    if event == 'charge.success':
        _handle_charge_success(payload.get('data', {}))

    elif event == 'subscription.create':
        _handle_subscription_create(payload.get('data', {}))

    elif event in ('subscription.not_renew', 'subscription.disable'):
        _handle_subscription_ended(payload.get('data', {}), event)

    elif event == 'invoice.payment_failed':
        _handle_invoice_failed(payload.get('data', {}))

    elif event == 'transfer.success':
        _handle_transfer_success(payload.get('data', {}))

    elif event == 'transfer.failed':
        _handle_transfer_failed(payload.get('data', {}))

    elif event == 'transfer.reversed':
        _handle_transfer_reversed(payload.get('data', {}))

    return jsonify({'status': 'ok'}), 200


# ---------------------------------------------------------------------------
# Webhook event handlers
# ---------------------------------------------------------------------------

def _handle_charge_success(data):
    """Handle charge.success — coin purchases, Elite subs, AND Premium subs."""
    reference = data.get('reference', '')
    meta = data.get('metadata', {})
    sub_type = meta.get('type', '')

    # --- Elite subscription charge (initial or renewal) ---
    if sub_type == 'elite_subscription':
        _handle_elite_charge(data, reference, meta)
        return

    # --- Premium subscription charge (initial or renewal) ---
    if sub_type == 'premium_subscription':
        _handle_premium_charge(data, reference, meta)
        return

    # --- Plan-based charge without explicit type (renewal from Paystack) ---
    plan_obj = data.get('plan', {})
    if plan_obj:
        plan_code = plan_obj.get('plan_code', '') if isinstance(plan_obj, dict) else ''
        elite_plan = current_app.config.get('PAYSTACK_ELITE_PLAN_CODE', '')
        premium_plan = current_app.config.get('PAYSTACK_PREMIUM_PLAN_CODE', '')
        if elite_plan and plan_code == elite_plan:
            _handle_elite_charge(data, reference, meta)
            return
        elif premium_plan and plan_code == premium_plan:
            _handle_premium_charge(data, reference, meta)
            return
        else:
            log.warning("Unknown plan charge: plan_code=%s ref=%s", plan_code, reference)
            return

    # --- Regular coin purchase ---
    user_id = meta.get('user_id')
    coins_to_credit = meta.get('coins')

    if not reference or not user_id or not coins_to_credit:
        log.warning("Webhook charge.success missing data: ref=%s", reference)
        return

    # Idempotent — skip if already processed
    existing = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    if existing:
        return

    package_id = meta.get('package_id')
    price_ghs = data.get('amount', 0) / 100

    # v5 ledger: record purchase through double-entry ledger
    try:
        from ..services.ledger import record_coin_purchase
        result = record_coin_purchase(
            int(user_id), int(coins_to_credit), price_ghs,
            reference, package_id=package_id,
        )
        if result.get('error'):
            log.warning("Ledger purchase failed: %s (ref=%s)", result['error'], reference)
            # Fallback to direct credit if ledger rejects (frozen/rate-limited)
            _credit_coins(int(user_id), int(coins_to_credit), reference,
                          f'Purchased {coins_to_credit} coins (webhook-fallback)')
        else:
            log.info("Ledger: webhook purchase user=%s coins=%s ref=%s",
                     user_id, coins_to_credit, reference)
    except Exception as e:
        log.error("Ledger error, falling back to direct credit: %s", e)
        _credit_coins(int(user_id), int(coins_to_credit), reference,
                      f'Purchased {coins_to_credit} coins (webhook)')

    try:
        from ..services.notifications import notify_coin_received
        notify_coin_received(int(user_id), int(coins_to_credit), 'Coin purchase')
    except Exception:
        pass


def _handle_elite_charge(data, reference, meta):
    """Handle an Elite subscription charge (initial or renewal)."""
    user_id = meta.get('user_id')
    if not user_id:
        customer = data.get('customer', {})
        email = customer.get('email', '')
        if email:
            u = User.query.filter_by(email=email).first()
            if u:
                user_id = u.wiam_id
        if not user_id:
            log.warning("Elite charge: no user_id found, ref=%s", reference)
            return

    existing = EliteSubscription.query.filter_by(paystack_reference=reference).first()
    if existing:
        log.info("Elite charge already processed: ref=%s", reference)
        return

    sub = EliteSubscription.query.filter_by(
        user_id=int(user_id), status='active'
    ).first()

    now = datetime.utcnow()
    if sub:
        sub.expires_at = now + timedelta(days=30)
        sub.paystack_reference = reference
        sub.amount_ghs = data.get('amount', 2500) / 100
        log.info("Elite sub renewed for user %s, new expiry %s", user_id, sub.expires_at)
    else:
        sub = EliteSubscription(
            user_id=int(user_id),
            plan='monthly',
            amount_ghs=data.get('amount', 2500) / 100,
            status='active',
            paystack_reference=reference,
            started_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.session.add(sub)
        log.info("Elite sub created via webhook for user %s ref=%s", user_id, reference)

    db.session.commit()


def _handle_premium_charge(data, reference, meta):
    """Handle a Premium subscription charge (initial or renewal)."""
    user_id = meta.get('user_id')
    if not user_id:
        customer = data.get('customer', {})
        email = customer.get('email', '')
        if email:
            u = User.query.filter_by(email=email).first()
            if u:
                user_id = u.wiam_id
        if not user_id:
            log.warning("Premium charge: no user_id found, ref=%s", reference)
            return

    existing = PremiumSubscription.query.filter_by(paystack_reference=reference).first()
    if existing:
        log.info("Premium charge already processed: ref=%s", reference)
        return

    sub = PremiumSubscription.query.filter_by(
        user_id=int(user_id), status='active'
    ).first()

    now = datetime.utcnow()
    if sub:
        sub.expires_at = now + timedelta(days=30)
        sub.paystack_reference = reference
        sub.amount_ghs = data.get('amount', 2000) / 100
        log.info("Premium sub renewed for user %s, new expiry %s", user_id, sub.expires_at)
    else:
        sub = PremiumSubscription(
            user_id=int(user_id),
            plan='monthly',
            amount_ghs=data.get('amount', 2000) / 100,
            status='active',
            paystack_reference=reference,
            started_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.session.add(sub)
        log.info("Premium sub created via webhook for user %s ref=%s", user_id, reference)

    db.session.commit()

    # Activate premium status + grant monthly credits
    try:
        from ..services.premium_service import activate_premium, grant_monthly_credits
        user_obj = User.query.get(int(user_id))
        if user_obj:
            activate_premium(user_obj, plan='monthly', provider='paystack',
                             expires_at=sub.expires_at)
            grant_monthly_credits(user_obj)
    except Exception as e:
        log.error("Failed to activate premium for user %s: %s", user_id, e)


def _handle_subscription_create(data):
    """Handle subscription.create — Paystack confirms the recurring subscription is set up.
    Store the subscription code and email token for future cancellation."""
    sub_code = data.get('subscription_code', '')
    email_token = data.get('email_token', '')
    customer = data.get('customer', {})
    customer_email = customer.get('email', '')

    if not sub_code:
        log.warning("subscription.create missing subscription_code")
        return

    # Determine if this is Elite or Premium based on plan code
    plan_obj = data.get('plan', {})
    plan_code = plan_obj.get('plan_code', '') if isinstance(plan_obj, dict) else ''
    elite_plan = current_app.config.get('PAYSTACK_ELITE_PLAN_CODE', '')
    premium_plan = current_app.config.get('PAYSTACK_PREMIUM_PLAN_CODE', '')
    is_premium = premium_plan and plan_code == premium_plan

    meta = data.get('metadata') or {}
    user_id = meta.get('user_id')

    # Resolve user from email if not in metadata
    resolved_user_id = None
    if user_id:
        resolved_user_id = int(user_id)
    elif customer_email:
        user = User.query.filter_by(email=customer_email).first()
        if user:
            resolved_user_id = user.id

    if not resolved_user_id:
        log.warning("subscription.create: no user found for code=%s email=%s", sub_code, customer_email)
        return

    sub = None
    if is_premium:
        sub = PremiumSubscription.query.filter_by(
            user_id=resolved_user_id, status='active'
        ).order_by(PremiumSubscription.id.desc()).first()
    else:
        sub = EliteSubscription.query.filter_by(
            user_id=resolved_user_id, status='active'
        ).order_by(EliteSubscription.id.desc()).first()

    if sub:
        sub.paystack_sub_code = sub_code
        sub.paystack_email_token = email_token
        db.session.commit()
        log.info("Subscription code %s linked to %s user %s",
                 sub_code, 'premium' if is_premium else 'elite', resolved_user_id)
    else:
        log.warning("subscription.create: no active sub for code=%s user=%s type=%s",
                    sub_code, resolved_user_id, 'premium' if is_premium else 'elite')


def _handle_subscription_ended(data, event):
    """Handle subscription.not_renew or subscription.disable — for both Elite and Premium."""
    sub_code = data.get('subscription_code', '')
    if not sub_code:
        return

    # Check Elite first
    sub = EliteSubscription.query.filter_by(
        paystack_sub_code=sub_code, status='active'
    ).first()
    if sub:
        sub.status = 'cancelled'
        sub.cancelled_at = datetime.utcnow()
        db.session.commit()
        log.info("Elite subscription %s ended via %s for user %s",
                 sub_code, event, sub.user_id)
        return

    # Check Premium
    psub = PremiumSubscription.query.filter_by(
        paystack_sub_code=sub_code, status='active'
    ).first()
    if psub:
        psub.status = 'cancelled'
        psub.cancelled_at = datetime.utcnow()
        db.session.commit()
        log.info("Premium subscription %s ended via %s for user %s",
                 sub_code, event, psub.user_id)
        try:
            from ..services.premium_service import expire_premium
            user_obj = User.query.get(psub.user_id)
            if user_obj:
                expire_premium(user_obj)
        except Exception as e:
            log.error("Failed to expire premium for user %s: %s", psub.user_id, e)
        return

    log.warning("subscription ended but no active sub found for code=%s event=%s",
                sub_code, event)


def _handle_invoice_failed(data):
    """Handle invoice.payment_failed — log it, keep sub active (Paystack retries)."""
    sub_data = data.get('subscription', {})
    sub_code = sub_data.get('subscription_code', '') if isinstance(sub_data, dict) else ''
    customer = data.get('customer', {})
    log.warning("Invoice payment failed: sub=%s customer=%s",
                sub_code, customer.get('email', '?'))


# ---------------------------------------------------------------------------
# Transfer webhook handlers (creator payouts)
# ---------------------------------------------------------------------------

def _find_payout_by_reference(reference):
    """Find a CreatorPayout by Paystack reference."""
    from ..models import CreatorPayout
    if not reference:
        return None
    return CreatorPayout.query.filter_by(paystack_reference=reference).first()


def _handle_transfer_success(data):
    """Handle transfer.success — mark payout as sent."""
    reference = data.get('reference', '')
    payout = _find_payout_by_reference(reference)
    if not payout:
        log.warning("transfer.success: no payout found for ref=%s", reference)
        return

    if payout.status == 'sent':
        return  # idempotent

    payout.status = 'sent'
    payout.completed_at = datetime.utcnow()
    db.session.commit()
    log.info("Payout %d for creator %s marked SENT (GHS %.2f ref=%s)",
             payout.id, payout.creator_id, payout.amount_ghs, reference)


def _handle_transfer_failed(data):
    """Handle transfer.failed — mark payout as failed with reason."""
    reference = data.get('reference', '')
    reason = data.get('reason', 'Unknown failure')
    payout = _find_payout_by_reference(reference)
    if not payout:
        log.warning("transfer.failed: no payout found for ref=%s", reference)
        return

    payout.status = 'failed'
    payout.failure_reason = reason
    db.session.commit()
    log.error("Payout %d for creator %s FAILED: %s (ref=%s)",
              payout.id, payout.creator_id, reason, reference)


def _handle_transfer_reversed(data):
    """Handle transfer.reversed — mark payout as failed, un-mark earnings as paid."""
    reference = data.get('reference', '')
    payout = _find_payout_by_reference(reference)
    if not payout:
        log.warning("transfer.reversed: no payout found for ref=%s", reference)
        return

    payout.status = 'failed'
    payout.failure_reason = 'Transfer reversed by Paystack'

    # Un-mark earnings so they'll be included in next payout run
    from ..models import CreatorEarnings
    earnings = CreatorEarnings.query.filter_by(
        creator_id=payout.creator_id, is_paid=True
    ).filter(
        (CreatorEarnings.year < payout.year) |
        ((CreatorEarnings.year == payout.year) & (CreatorEarnings.month <= payout.month))
    ).all()
    for e in earnings:
        e.is_paid = False
    db.session.commit()
    log.warning("Payout %d for creator %s REVERSED — earnings unmarked (ref=%s)",
                payout.id, payout.creator_id, reference)


@payment_bp.route('/success')
@login_required
def success():
    """Purchase success page."""
    reference = request.args.get('reference', '')
    tx = None
    if reference:
        tx = CoinTransaction.query.filter_by(reference=reference, type='purchase').first()
    bal = _get_or_create_balance(current_user.id)
    return render_template('payment/success.html', transaction=tx, balance=bal)


@payment_bp.route('/coins/history')
@login_required
def history():
    """Show user's coin transaction history."""
    page = request.args.get('page', 1, type=int)
    txns = CoinTransaction.query.filter_by(
        user_id=current_user.id
    ).order_by(CoinTransaction.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    bal = _get_or_create_balance(current_user.id)
    return render_template('payment/history.html', transactions=txns, balance=bal)


# ---------------------------------------------------------------------------
# Chapter Unlock (Phase 3)
# ---------------------------------------------------------------------------

def _debit_coins(user_id, coins, tx_type, description, content_id=None,
                 chapter_id=None, recipient_id=None):
    """Debit coins from a user's balance and log the transaction."""
    bal = _get_or_create_balance(user_id)
    if bal.balance < coins:
        return None, 'Insufficient coins'
    bal.balance -= coins
    bal.total_spent += coins
    bal.updated_at = datetime.utcnow()

    tx = CoinTransaction(
        user_id=user_id,
        type=tx_type,
        amount=-coins,
        balance_after=bal.balance,
        description=description,
        content_id=content_id,
        chapter_id=chapter_id,
        recipient_id=recipient_id,
    )
    db.session.add(tx)
    db.session.flush()  # get tx.id before commit
    return tx, None


def _record_creator_earning(creator_id, coins, earning_type='unlock'):
    """Increment a creator's monthly earnings."""
    now = datetime.utcnow()
    earn = CreatorEarnings.query.filter_by(
        creator_id=creator_id, year=now.year, month=now.month
    ).first()
    if not earn:
        earn = CreatorEarnings(
            creator_id=creator_id, year=now.year, month=now.month
        )
        db.session.add(earn)

    if earning_type == 'unlock':
        earn.coins_from_unlocks += coins
    elif earning_type == 'tip':
        earn.coins_from_tips += coins

    earn.total_coins = earn.coins_from_unlocks + earn.coins_from_tips
    from ..services.monetization import COIN_TO_GHS
    earn.ghs_value = earn.total_coins * COIN_TO_GHS
    # Use dynamic revenue share from RevenueRule (defaults to 50%)
    from ..models import RevenueRule
    share_pct = RevenueRule.get_creator_share(creator_id) or 50.0
    earn.creator_share_ghs = earn.ghs_value * (share_pct / 100.0)
    earn.updated_at = datetime.utcnow()


@payment_bp.route('/unlock', methods=['POST'])
@login_required
def unlock_chapter():
    """Spend coins to unlock a locked chapter."""
    content_id = request.form.get('content_id', type=int)
    chapter_num = request.form.get('chapter_number', type=int)

    if not content_id or not chapter_num:
        flash('Invalid chapter.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    # Check chapter exists and is locked
    chapter = WebBookContent.query.filter_by(
        content_id=content_id, chapter_number=chapter_num
    ).first()
    if not chapter or not chapter.is_locked or not chapter.chapter_price:
        flash('This chapter is not locked.', 'info')
        return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))

    # Already unlocked?
    existing = ChapterUnlock.query.filter_by(
        user_id=current_user.id,
        content_id=content_id,
        chapter_number=chapter_num,
    ).first()
    if existing:
        return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))

    # Get creator id
    book = Content.query.get(content_id)
    if not book:
        flash('Story not found.', 'error')
        return redirect(url_for('home.home'))

    coins_needed = int(chapter.chapter_price)

    # Creator can always read their own chapters
    if book.creator_wiam_id == current_user.wiam_id:
        return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))

    # v5 ledger: debit via double-entry ledger
    try:
        from ..services.ledger import record_chapter_unlock
        result = record_chapter_unlock(
            current_user.wiam_id, book.creator_wiam_id,
            content_id, chapter_num, coins_needed,
        )
        if result.get('error'):
            flash(result['error'], 'error')
            return redirect(url_for('payment.coins'))
        tx_id = None  # ledger handles the CoinTransaction internally
    except Exception as e:
        log.error("Ledger unlock error, falling back: %s", e)
        desc = f'Unlocked Ch {chapter_num} of "{book.title}" ({coins_needed} coins)'
        tx, err = _debit_coins(
            current_user.wiam_id, coins_needed, 'unlock', desc,
            content_id=content_id, chapter_id=chapter_num,
            recipient_id=book.creator_wiam_id,
        )
        if err:
            flash(f'Not enough coins. You need {coins_needed} coins to unlock this chapter.', 'error')
            return redirect(url_for('payment.coins'))
        tx_id = tx.id

    # Record unlock
    unlock = ChapterUnlock(
        user_id=current_user.id,
        content_id=content_id,
        chapter_number=chapter_num,
        coins_spent=coins_needed,
        creator_id=book.creator_wiam_id,
        transaction_id=tx_id,
    )
    db.session.add(unlock)

    # Track creator earnings
    _record_creator_earning(book.creator_wiam_id, coins_needed, 'unlock')

    db.session.commit()
    flash(f'Chapter unlocked! {coins_needed} coins spent.', 'success')
    return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))


@payment_bp.route('/unlock-premium', methods=['POST'])
@login_required
def unlock_chapter_premium():
    """Spend premium credits to unlock a premium-locked chapter."""
    content_id = request.form.get('content_id', type=int)
    chapter_num = request.form.get('chapter_number', type=int)

    if not content_id or not chapter_num:
        flash('Invalid chapter.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    chapter = WebBookContent.query.filter_by(
        content_id=content_id, chapter_number=chapter_num
    ).first()
    if not chapter or not chapter.is_premium_locked:
        flash('This chapter is not premium-locked.', 'info')
        return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))

    # Creator can always read their own chapters
    book = Content.query.get(content_id)
    if book and book.creator_wiam_id == current_user.wiam_id:
        return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))

    from ..services.premium_service import spend_premium_credit
    success, message = spend_premium_credit(current_user, chapter)
    if success:
        flash(message, 'success')
    else:
        flash(message, 'error')
        return redirect(request.referrer or url_for('book.read_book', book_id=content_id, ch=chapter_num))

    return redirect(url_for('book.read_book', book_id=content_id, ch=chapter_num))


# ---------------------------------------------------------------------------
# Tipping (Phase 3)
# ---------------------------------------------------------------------------

@payment_bp.route('/tip', methods=['POST'])
@login_required
def tip_creator():
    """Tip a creator with coins from a chapter page."""
    creator_id = request.form.get('creator_id', type=int)
    content_id = request.form.get('content_id', type=int)
    tip_amount = request.form.get('amount', type=int)

    if not creator_id or not tip_amount or tip_amount < 1:
        flash('Invalid tip.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    if tip_amount > 100:
        flash('Maximum tip is 100 coins.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    if creator_id == current_user.id:
        flash('You cannot tip yourself.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    # creator_id from form is User.id — resolve to wiam_id for earnings
    creator_user = User.query.get(creator_id)
    if not creator_user:
        flash('Creator not found.', 'error')
        return redirect(request.referrer or url_for('home.home'))

    book = Content.query.get(content_id) if content_id else None
    book_title = book.title if book else 'a story'

    # v5 ledger: record tip through double-entry ledger
    try:
        from ..services.ledger import record_tip
        result = record_tip(
            current_user.wiam_id, creator_user.wiam_id,
            content_id, tip_amount,
        )
        if result.get('error'):
            flash(result['error'], 'error')
            return redirect(url_for('payment.coins'))
    except Exception as e:
        log.error("Ledger tip error, falling back: %s", e)
        desc = f'Tipped {tip_amount} coins on "{book_title}"'
        tx, err = _debit_coins(
            current_user.wiam_id, tip_amount, 'tip', desc,
            content_id=content_id, recipient_id=creator_user.wiam_id,
        )
        if err:
            flash('Not enough coins to tip.', 'error')
            return redirect(url_for('payment.coins'))

    # Track creator earnings (uses wiam_id)
    _record_creator_earning(creator_user.wiam_id, tip_amount, 'tip')

    db.session.commit()

    # Notify creator of the tip
    try:
        from ..services.notifications import notify_coin_received
        notify_coin_received(creator_id, tip_amount,
                              f'{current_user.display_name} tipped you on "{book_title}"')
    except Exception:
        pass

    flash(f'You tipped {tip_amount} coins! The creator will love this.', 'success')
    return redirect(request.referrer or url_for('home.home'))


@payment_bp.route('/tip-history')
@login_required
def tip_history():
    """Show tip transactions sent by the current reader."""
    tips_sent = CoinTransaction.query.filter_by(
        user_id=current_user.id, type='tip'
    ).order_by(CoinTransaction.created_at.desc()).limit(50).all()

    # Resolve creator names and story titles
    tip_details = []
    for tx in tips_sent:
        creator_name = 'Unknown Creator'
        story_title = 'Unknown Story'
        if tx.recipient_id:
            creator = User.query.filter_by(wiam_id=tx.recipient_id).first()
            if creator:
                creator_name = creator.display_name
        if tx.content_id:
            book = Content.query.get(tx.content_id)
            if book:
                story_title = book.title
        tip_details.append({
            'amount': abs(tx.amount),
            'creator_name': creator_name,
            'story_title': story_title,
            'date': tx.created_at,
            'description': tx.description,
        })

    bal = _get_or_create_balance(current_user.id)
    return render_template('payment/tip_history.html', tips=tip_details, balance=bal)


# ---------------------------------------------------------------------------
# RevenueCat Webhook — handles ALL Apple + Google events via one endpoint
# ---------------------------------------------------------------------------

@payment_bp.route('/webhooks/revenuecat', methods=['POST'])
@csrf.exempt
def revenuecat_webhook():
    """
    RevenueCat sends unified webhook events for both Apple and Google.
    Events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION,
            UNCANCELLATION, BILLING_ISSUE, REFUND, NON_RENEWING_PURCHASE, etc.

    Authorization: RevenueCat sends the webhook secret in the Authorization header.
    """
    from ..services.iap import verify_webhook_signature, handle_rc_webhook

    # Verify webhook authenticity
    auth_header = request.headers.get('Authorization', '')
    if not verify_webhook_signature(request.get_data(), auth_header):
        log.warning("RevenueCat webhook: invalid signature")
        return jsonify({'error': 'Unauthorized'}), 401

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({'error': 'Empty payload'}), 400

    # RevenueCat webhook format: { "api_version": "1.0", "event": { ... } }
    event = payload.get('event', {})
    if not event:
        log.warning("RevenueCat webhook: no event in payload")
        return jsonify({'error': 'No event'}), 400

    event_type = event.get('type', 'unknown')
    app_user_id = event.get('app_user_id', '')
    product_id = event.get('product_id', '')

    log.info("RevenueCat webhook received: type=%s user=%s product=%s",
             event_type, app_user_id, product_id)

    try:
        result = handle_rc_webhook(event)
        log.info("RevenueCat webhook processed: %s", result)
        return jsonify(result), 200
    except Exception as e:
        log.error("RevenueCat webhook error: %s", e)
        return jsonify({'error': 'Internal error'}), 500