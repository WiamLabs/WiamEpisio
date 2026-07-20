"""
WiamApp v6-IAP — RevenueCat Integration Service

Handles:
  - Verifying purchases via RevenueCat REST API
  - Mapping store product IDs → coin amounts / subscription tiers
  - Processing RevenueCat webhook events (purchases, refunds, renewals)

Env vars (add to Render when ready):
  REVENUECAT_API_KEY        — Secret API key (sk_...)
  REVENUECAT_WEBHOOK_SECRET — Shared secret for webhook signature verification
"""
import os
import hmac
import hashlib
import logging
import requests
from datetime import datetime
from flask import current_app

from ..extensions import db
from ..models import (
    CoinPackage, CoinTransaction, CoinBalance,
    PremiumSubscription, EliteSubscription, User,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Product ID → Coins mapping (fallback if DB lookup fails)
# These MUST match the product IDs configured in RevenueCat dashboard
# ---------------------------------------------------------------------------
PRODUCT_COIN_MAP = {
    'wiamcoins_100':  {'coins': 100,  'bonus': 0,   'label': 'Starter'},
    'wiamcoins_550':  {'coins': 500,  'bonus': 50,  'label': 'Popular'},
    'wiamcoins_1200': {'coins': 1000, 'bonus': 200, 'label': 'Best Value'},
    'wiamcoins_2600': {'coins': 2000, 'bonus': 600, 'label': 'Super'},
    'wiamcoins_7000': {'coins': 5000, 'bonus': 2000,'label': 'Mega'},
}

SUBSCRIPTION_MAP = {
    'wiampremium_basic':     {'plan': 'basic',     'tier': 1},
    'wiampremium_plus':      {'plan': 'plus',      'tier': 2},
    'wiampremium_unlimited': {'plan': 'unlimited', 'tier': 3},
    'wiamelite_monthly':     {'plan': 'monthly',   'type': 'elite'},
}

# Internal USD → coin conversion: 100 coins = $1.00 USD
COIN_TO_USD = 0.01


def _rc_api_key():
    """Get RevenueCat secret API key from config/env."""
    return (
        current_app.config.get('REVENUECAT_API_KEY')
        or os.environ.get('REVENUECAT_API_KEY', '')
    )


def _rc_webhook_secret():
    """Get RevenueCat webhook shared secret."""
    return (
        current_app.config.get('REVENUECAT_WEBHOOK_SECRET')
        or os.environ.get('REVENUECAT_WEBHOOK_SECRET', '')
    )


# ---------------------------------------------------------------------------
# Product mapping helpers
# ---------------------------------------------------------------------------

def map_product_to_coins(product_id):
    """
    Map a store product ID to coin amount.
    First checks DB (CoinPackage), falls back to PRODUCT_COIN_MAP.
    Returns dict { coins, bonus, total, label } or None if unknown.
    """
    pkg = CoinPackage.query.filter_by(store_product_id=product_id, is_active=True).first()
    if pkg:
        return {
            'coins': pkg.coins,
            'bonus': pkg.bonus_coins,
            'total': pkg.total_coins,
            'label': pkg.label,
            'package_id': pkg.id,
        }
    info = PRODUCT_COIN_MAP.get(product_id)
    if info:
        return {
            'coins': info['coins'],
            'bonus': info['bonus'],
            'total': info['coins'] + info['bonus'],
            'label': info['label'],
            'package_id': None,
        }
    return None


def map_product_to_subscription(product_id):
    """Map a store product ID to subscription info. Returns dict or None."""
    return SUBSCRIPTION_MAP.get(product_id)


def is_coin_product(product_id):
    """Check if product_id is a consumable coin package."""
    if CoinPackage.query.filter_by(store_product_id=product_id).first():
        return True
    return product_id in PRODUCT_COIN_MAP


def is_subscription_product(product_id):
    """Check if product_id is a subscription."""
    return product_id in SUBSCRIPTION_MAP


# ---------------------------------------------------------------------------
# RevenueCat REST API — verify customer purchases
# ---------------------------------------------------------------------------

def verify_rc_purchase(rc_user_id, expected_product_id=None):
    """
    Call RevenueCat GET /v1/subscribers/{app_user_id} to verify purchases.

    Returns dict:
      { ok: True, customer_info: {...}, non_consumable_purchases: [...],
        active_entitlements: {...} }
    Or:
      { ok: False, error: '...' }
    """
    api_key = _rc_api_key()
    if not api_key:
        return {'ok': False, 'error': 'RevenueCat API key not configured'}

    url = f'https://api.revenuecat.com/v1/subscribers/{rc_user_id}'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 404:
            return {'ok': False, 'error': 'RevenueCat subscriber not found'}
        if resp.status_code != 200:
            log.warning("RevenueCat API %s: %s", resp.status_code, resp.text[:200])
            return {'ok': False, 'error': f'RevenueCat API error ({resp.status_code})'}

        data = resp.json()
        subscriber = data.get('subscriber', {})

        return {
            'ok': True,
            'customer_info': subscriber,
            'non_consumable_purchases': subscriber.get('non_subscriptions', {}),
            'active_entitlements': subscriber.get('entitlements', {}),
            'subscriptions': subscriber.get('subscriptions', {}),
        }
    except requests.RequestException as e:
        log.error("RevenueCat API request failed: %s", e)
        return {'ok': False, 'error': f'RevenueCat API unreachable: {e}'}


def find_purchase_in_rc_data(rc_data, product_id):
    """
    Extract a specific product purchase from RevenueCat customer data.
    For non-consumables/consumables, checks non_subscriptions.
    Returns transaction dict or None.
    """
    non_subs = rc_data.get('non_consumable_purchases', {})
    # RevenueCat groups non-subscriptions by product_id
    purchases = non_subs.get(product_id, [])
    if purchases:
        # Return latest purchase
        return purchases[-1]

    # Also check subscriptions
    subs = rc_data.get('subscriptions', {})
    if product_id in subs:
        return subs[product_id]

    return None


# ---------------------------------------------------------------------------
# Credit coins after verified IAP purchase
# ---------------------------------------------------------------------------

def credit_coins_for_iap(user_id, product_id, store, store_transaction_id,
                         rc_user_id=None):
    """
    Credit coins to user after a verified IAP purchase.
    Uses the ledger service for double-entry accounting.

    Returns dict { ok, balance, coins_credited } or { ok: False, error }.
    """
    # Idempotency: check if this store transaction was already processed
    existing = CoinTransaction.query.filter_by(
        store_transaction_id=store_transaction_id,
        type='purchase',
    ).first()
    if existing:
        bal = CoinBalance.query.get(user_id)
        return {
            'ok': True,
            'balance': bal.balance if bal else 0,
            'coins_credited': 0,
            'already_processed': True,
        }

    coin_info = map_product_to_coins(product_id)
    if not coin_info:
        return {'ok': False, 'error': f'Unknown product: {product_id}'}

    total_coins = coin_info['total']
    package_id = coin_info.get('package_id')

    # Use ledger service for double-entry accounting
    try:
        from .ledger import record_coin_purchase

        # Get USD price from package
        pkg = CoinPackage.query.filter_by(store_product_id=product_id).first()
        price_usd = pkg.price_usd if pkg else (total_coins * COIN_TO_USD)
        # Convert to GHS equivalent (approximate — platform tracks both)
        from .monetization import COIN_TO_GHS
        price_ghs = total_coins * COIN_TO_GHS

        result = record_coin_purchase(
            user_id, total_coins, price_ghs,
            reference=f'iap_{store}_{store_transaction_id}',
            package_id=package_id,
            store=store,
            store_transaction_id=store_transaction_id,
        )
        if result.get('error'):
            return {'ok': False, 'error': result['error']}

        return {
            'ok': True,
            'balance': result.get('balance', 0),
            'coins_credited': total_coins,
            'already_processed': False,
        }
    except Exception as e:
        log.error("IAP credit_coins error: %s", e)
        # Fallback: direct credit (same pattern as Paystack webhook fallback)
        return _fallback_credit(user_id, total_coins, store,
                                store_transaction_id, product_id)


def _fallback_credit(user_id, total_coins, store, store_transaction_id,
                     product_id):
    """Direct coin credit when ledger service fails."""
    try:
        bal = CoinBalance.query.get(user_id)
        if not bal:
            bal = CoinBalance(user_id=user_id, balance=0,
                              total_purchased=0, total_spent=0)
            db.session.add(bal)
            db.session.flush()

        bal.balance += total_coins
        bal.total_purchased += total_coins
        bal.updated_at = datetime.utcnow()

        tx = CoinTransaction(
            user_id=user_id,
            type='purchase',
            amount=total_coins,
            balance_after=bal.balance,
            description=f'IAP purchase: {product_id} ({store})',
            reference=f'iap_{store}_{store_transaction_id}',
            store=store,
            store_transaction_id=store_transaction_id,
        )
        db.session.add(tx)
        db.session.commit()

        return {
            'ok': True,
            'balance': bal.balance,
            'coins_credited': total_coins,
            'already_processed': False,
            'fallback': True,
        }
    except Exception as e:
        db.session.rollback()
        log.error("IAP fallback credit failed: %s", e)
        return {'ok': False, 'error': f'Credit failed: {e}'}


# ---------------------------------------------------------------------------
# Activate/extend subscription after verified IAP
# ---------------------------------------------------------------------------

def activate_subscription_for_iap(user_id, product_id, store,
                                  store_transaction_id, expires_at=None,
                                  rc_user_id=None):
    """
    Activate or extend a subscription purchased via IAP.
    Returns dict { ok, plan, expires_at } or { ok: False, error }.
    """
    sub_info = map_product_to_subscription(product_id)
    if not sub_info:
        return {'ok': False, 'error': f'Unknown subscription product: {product_id}'}

    sub_type = sub_info.get('type', 'premium')
    plan = sub_info['plan']

    try:
        if sub_type == 'elite':
            return _activate_elite(user_id, plan, store, store_transaction_id,
                                   expires_at, rc_user_id)
        else:
            return _activate_premium(user_id, plan, store, store_transaction_id,
                                     expires_at, rc_user_id)
    except Exception as e:
        db.session.rollback()
        log.error("IAP activate_subscription error: %s", e)
        return {'ok': False, 'error': f'Subscription activation failed: {e}'}


def _activate_premium(user_id, plan, store, store_transaction_id,
                      expires_at, rc_user_id):
    """Create or update PremiumSubscription."""
    # Check idempotency
    existing = PremiumSubscription.query.filter_by(
        store_transaction_id=store_transaction_id
    ).first()
    if existing:
        return {
            'ok': True,
            'plan': existing.plan,
            'expires_at': existing.expires_at.isoformat() if existing.expires_at else None,
            'already_processed': True,
        }

    # Find active sub or create new
    sub = PremiumSubscription.query.filter_by(
        user_id=user_id, status='active'
    ).first()

    if sub:
        # Extend existing
        sub.plan = plan
        sub.store = store
        sub.store_transaction_id = store_transaction_id
        sub.rc_subscriber_id = rc_user_id
        if expires_at:
            sub.expires_at = expires_at
    else:
        sub = PremiumSubscription(
            user_id=user_id,
            plan=plan,
            store=store,
            store_product_id=f'wiampremium_{plan}',
            store_transaction_id=store_transaction_id,
            rc_subscriber_id=rc_user_id,
            status='active',
            started_at=datetime.utcnow(),
            expires_at=expires_at,
        )
        db.session.add(sub)

    # Update user premium status (match by wiam_id or primary id)
    user = User.query.filter(
        db.or_(User.wiam_id == user_id, User.id == user_id)
    ).first()
    if user:
        user.premium_status = 'active'
        user.premium_plan = plan
        user.premium_provider = store
        user.premium_started_at = user.premium_started_at or datetime.utcnow()
        user.premium_expires_at = expires_at
        user.trial_used = True

    db.session.commit()
    return {
        'ok': True,
        'plan': plan,
        'expires_at': expires_at.isoformat() if expires_at else None,
        'already_processed': False,
    }


def _activate_elite(user_id, plan, store, store_transaction_id,
                     expires_at, rc_user_id):
    """Create or update EliteSubscription."""
    existing = EliteSubscription.query.filter_by(
        store_transaction_id=store_transaction_id
    ).first()
    if existing:
        return {
            'ok': True,
            'plan': existing.plan,
            'expires_at': existing.expires_at.isoformat() if existing.expires_at else None,
            'already_processed': True,
        }

    sub = EliteSubscription.query.filter_by(
        user_id=user_id, status='active'
    ).first()

    if sub:
        sub.plan = plan
        sub.store = store
        sub.store_transaction_id = store_transaction_id
        sub.rc_subscriber_id = rc_user_id
        if expires_at:
            sub.expires_at = expires_at
    else:
        sub = EliteSubscription(
            user_id=user_id,
            plan=plan,
            store=store,
            store_product_id=f'wiamelite_{plan}',
            store_transaction_id=store_transaction_id,
            rc_subscriber_id=rc_user_id,
            status='active',
            started_at=datetime.utcnow(),
            expires_at=expires_at,
        )
        db.session.add(sub)

    db.session.commit()
    return {
        'ok': True,
        'plan': plan,
        'expires_at': expires_at.isoformat() if expires_at else None,
        'already_processed': False,
    }


# ---------------------------------------------------------------------------
# RevenueCat Webhook Handler
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload_bytes, signature_header):
    """
    Verify RevenueCat webhook signature.
    RevenueCat sends an Authorization header with the webhook secret.
    Returns True if valid.
    """
    secret = _rc_webhook_secret()
    if not secret:
        log.warning("REVENUECAT_WEBHOOK_SECRET not set — skipping verification")
        return True  # Allow in dev mode

    return signature_header == secret


def handle_rc_webhook(event):
    """
    Process a RevenueCat webhook event.

    Event types:
      INITIAL_PURCHASE, RENEWAL, CANCELLATION, UNCANCELLATION,
      BILLING_ISSUE, SUBSCRIBER_ALIAS, PRODUCT_CHANGE,
      EXPIRATION, TRANSFER, NON_RENEWING_PURCHASE

    Returns dict { ok, action }.
    """
    event_type = event.get('type', '')
    app_user_id = event.get('app_user_id', '')
    product_id = event.get('product_id', '')
    store = event.get('store', '').lower()  # APP_STORE, PLAY_STORE → apple, google
    transaction_id = event.get('transaction_id', '') or event.get('original_transaction_id', '')
    expiration_at_ms = event.get('expiration_at_ms')

    # Normalize store name
    if store in ('app_store', 'apple'):
        store = 'apple'
    elif store in ('play_store', 'google'):
        store = 'google'

    # Resolve WiamApp user_id from app_user_id
    # RevenueCat app_user_id should be set to our user's wiam_id
    user_id = _resolve_user_id(app_user_id)
    if not user_id:
        log.warning("RC webhook: cannot resolve user for app_user_id=%s", app_user_id)
        return {'ok': False, 'error': f'Unknown user: {app_user_id}'}

    expires_at = None
    if expiration_at_ms:
        try:
            expires_at = datetime.utcfromtimestamp(expiration_at_ms / 1000)
        except (ValueError, TypeError):
            pass

    log.info("RC webhook: type=%s user=%s product=%s store=%s",
             event_type, user_id, product_id, store)

    # ── Handle by event type ──

    if event_type == 'INITIAL_PURCHASE':
        return _handle_purchase(user_id, product_id, store, transaction_id,
                                expires_at, app_user_id)

    elif event_type == 'NON_RENEWING_PURCHASE':
        # Consumable (coin pack) purchased
        return _handle_purchase(user_id, product_id, store, transaction_id,
                                expires_at, app_user_id)

    elif event_type == 'RENEWAL':
        return _handle_renewal(user_id, product_id, store, transaction_id,
                               expires_at, app_user_id)

    elif event_type in ('CANCELLATION', 'EXPIRATION'):
        return _handle_cancellation(user_id, product_id, store)

    elif event_type == 'UNCANCELLATION':
        return _handle_uncancellation(user_id, product_id, store,
                                      transaction_id, expires_at)

    elif event_type == 'BILLING_ISSUE':
        return _handle_billing_issue(user_id, product_id, store)

    elif event_type == 'REFUND':
        return _handle_refund(user_id, product_id, store, transaction_id)

    else:
        log.info("RC webhook: unhandled event type %s", event_type)
        return {'ok': True, 'action': 'ignored', 'event_type': event_type}


def _resolve_user_id(app_user_id):
    """
    Resolve RevenueCat app_user_id → WiamApp user.wiam_id.
    We set app_user_id = str(user.wiam_id) when configuring RC SDK.
    """
    if not app_user_id:
        return None
    # Try direct integer parse (our convention)
    try:
        uid = int(app_user_id)
        user = User.query.filter(
            db.or_(User.wiam_id == uid, User.id == uid)
        ).first()
        if user:
            return uid
    except (ValueError, TypeError):
        pass
    # Fallback: check if stored in rc_subscriber_id on subscriptions
    sub = PremiumSubscription.query.filter_by(rc_subscriber_id=app_user_id).first()
    if sub:
        return sub.user_id
    sub = EliteSubscription.query.filter_by(rc_subscriber_id=app_user_id).first()
    if sub:
        return sub.user_id
    return None


def _handle_purchase(user_id, product_id, store, transaction_id,
                     expires_at, rc_user_id):
    """Handle initial purchase — coins or subscription."""
    if is_coin_product(product_id):
        result = credit_coins_for_iap(
            user_id, product_id, store, transaction_id, rc_user_id)
        result['action'] = 'coins_credited'
        return result
    elif is_subscription_product(product_id):
        result = activate_subscription_for_iap(
            user_id, product_id, store, transaction_id, expires_at, rc_user_id)
        result['action'] = 'subscription_activated'
        return result
    else:
        return {'ok': False, 'error': f'Unknown product: {product_id}'}


def _handle_renewal(user_id, product_id, store, transaction_id,
                    expires_at, rc_user_id):
    """Handle subscription renewal — extend expiry."""
    if not is_subscription_product(product_id):
        return {'ok': False, 'error': f'Not a subscription: {product_id}'}

    result = activate_subscription_for_iap(
        user_id, product_id, store, transaction_id, expires_at, rc_user_id)
    result['action'] = 'subscription_renewed'
    return result


def _handle_cancellation(user_id, product_id, store):
    """Handle subscription cancellation or expiration."""
    sub_info = map_product_to_subscription(product_id)
    if not sub_info:
        return {'ok': False, 'error': f'Unknown subscription: {product_id}'}

    sub_type = sub_info.get('type', 'premium')
    now = datetime.utcnow()

    try:
        if sub_type == 'elite':
            sub = EliteSubscription.query.filter_by(
                user_id=user_id, status='active'
            ).first()
            if sub:
                sub.status = 'cancelled'
                sub.cancelled_at = now
        else:
            sub = PremiumSubscription.query.filter_by(
                user_id=user_id, status='active'
            ).first()
            if sub:
                sub.status = 'cancelled'
                sub.cancelled_at = now
            # Update user premium status
            user = User.query.filter(
                db.or_(User.wiam_id == user_id, User.id == user_id)
            ).first()
            if user:
                user.premium_status = 'cancelled'

        db.session.commit()
        return {'ok': True, 'action': 'subscription_cancelled'}
    except Exception as e:
        db.session.rollback()
        log.error("RC cancellation error: %s", e)
        return {'ok': False, 'error': str(e)}


def _handle_uncancellation(user_id, product_id, store, transaction_id,
                           expires_at):
    """Handle subscription uncancellation (user re-subscribed)."""
    sub_info = map_product_to_subscription(product_id)
    if not sub_info:
        return {'ok': False, 'error': f'Unknown subscription: {product_id}'}

    sub_type = sub_info.get('type', 'premium')

    try:
        if sub_type == 'elite':
            sub = EliteSubscription.query.filter_by(
                user_id=user_id, status='cancelled'
            ).first()
            if sub:
                sub.status = 'active'
                sub.cancelled_at = None
                if expires_at:
                    sub.expires_at = expires_at
        else:
            sub = PremiumSubscription.query.filter_by(
                user_id=user_id, status='cancelled'
            ).first()
            if sub:
                sub.status = 'active'
                sub.cancelled_at = None
                if expires_at:
                    sub.expires_at = expires_at
            user = User.query.filter(
                db.or_(User.wiam_id == user_id, User.id == user_id)
            ).first()
            if user:
                user.premium_status = 'active'
                user.premium_expires_at = expires_at

        db.session.commit()
        return {'ok': True, 'action': 'subscription_uncancelled'}
    except Exception as e:
        db.session.rollback()
        log.error("RC uncancellation error: %s", e)
        return {'ok': False, 'error': str(e)}


def _handle_billing_issue(user_id, product_id, store):
    """Flag subscription with billing issue."""
    log.warning("RC billing issue: user=%s product=%s store=%s",
                user_id, product_id, store)
    # Create a fraud alert for visibility in founder dashboard
    try:
        from ..models import FraudAlert
        alert = FraudAlert(
            user_id=user_id,
            alert_type='billing_issue',
            severity='low',
            description=f'Store billing issue: {product_id} ({store})',
        )
        db.session.add(alert)
        db.session.commit()
    except Exception:
        db.session.rollback()
    return {'ok': True, 'action': 'billing_issue_flagged'}


def _handle_refund(user_id, product_id, store, transaction_id):
    """Handle refund — reverse coin credit or cancel subscription."""
    if is_coin_product(product_id):
        return _refund_coins(user_id, product_id, store, transaction_id)
    elif is_subscription_product(product_id):
        # Treat refund as cancellation
        result = _handle_cancellation(user_id, product_id, store)
        result['action'] = 'subscription_refunded'
        return result
    return {'ok': False, 'error': f'Unknown product for refund: {product_id}'}


def _refund_coins(user_id, product_id, store, transaction_id):
    """Reverse a coin purchase due to store refund."""
    # Find the original transaction
    ref = f'iap_{store}_{transaction_id}'
    original_tx = CoinTransaction.query.filter_by(
        reference=ref, type='purchase'
    ).first()

    if not original_tx:
        log.warning("RC refund: no original tx found for ref=%s", ref)
        return {'ok': True, 'action': 'refund_skipped_no_original'}

    # Use ledger service refund
    try:
        from .ledger import record_refund
        result = record_refund(
            user_id=user_id,
            original_tx_id=original_tx.id,
            coins_amount=original_tx.amount,
            reason=f'Store refund ({store}): {product_id}',
        )
        if result.get('error'):
            return {'ok': False, 'error': result['error']}
        return {'ok': True, 'action': 'coins_refunded',
                'coins_reversed': original_tx.amount}
    except Exception as e:
        log.error("RC refund ledger error: %s", e)
        return {'ok': False, 'error': f'Refund failed: {e}'}
