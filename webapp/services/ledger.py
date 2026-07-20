"""
WiamApp Money Ecosystem v5 — Double-Entry Ledger Service

Every financial event creates a balanced pair of ledger entries (debit + credit).
No direct balance updates — all balances derived from ledger.

System accounts:
  - platform_revenue  (account_id=0): earnings from user coin purchases
  - platform_cash     (account_id=0): real GHS received from Paystack
  - platform_loss     (account_id=0): refunds/disputes absorbed by platform
"""
import uuid
import json
import logging
from datetime import datetime, timedelta
from ..extensions import db
from ..models import (
    LedgerEntry, SystemWallet, CoinBalance, CoinTransaction,
    FraudAlert, User, RefundRequest,
)

log = logging.getLogger(__name__)

# Rate limit windows (per user)
RATE_LIMITS = {
    'purchase': {'max': 5, 'window_seconds': 60},
    'unlock': {'max': 20, 'window_seconds': 60},
    'tip': {'max': 10, 'window_seconds': 60},
}

# Per-type revenue splits: creator_share_pct / platform_share_pct
REVENUE_SPLITS = {
    'unlock':       {'creator': 70, 'platform': 30},  # creator-owned series (including featured)
    'unlock_origin': {'creator': 0, 'platform': 100},  # Wiam Origin / bought rights — platform owns
    'tip':          {'creator': 80, 'platform': 20},
    'subscription': {'creator': 75, 'platform': 25},
}


def unlock_split_for_content(content=None):
    """Creator feature/upload → 70/30. Origin / platform-owned → 100% platform."""
    if content is not None and bool(getattr(content, 'is_wiam_origin', False)):
        return REVENUE_SPLITS['unlock_origin']
    shelf = (getattr(content, 'catalog_shelf', None) or '') if content is not None else ''
    if shelf == 'origin':
        return REVENUE_SPLITS['unlock_origin']
    return REVENUE_SPLITS['unlock']


def _get_user(user_id):
    """
    Resolve a User by wiam_id (BigInteger) first, then by PK id as fallback.
    Callers from payment/API routes pass wiam_id; founder routes pass User.id.
    """
    user = User.query.filter_by(wiam_id=user_id).first()
    if user:
        return user
    return User.query.get(user_id)


def _get_system_balance(account_type):
    """Get system wallet balance (coins). Creates wallet row if missing."""
    w = SystemWallet.query.get(account_type)
    if not w:
        w = SystemWallet(account_type=account_type, balance_coins=0, balance_ghs=0.0)
        db.session.add(w)
        db.session.flush()
    return w


def _get_user_balance(user_id):
    """Get user coin balance. Creates row if missing."""
    b = CoinBalance.query.get(user_id)
    if not b:
        b = CoinBalance(user_id=user_id, balance=0, total_purchased=0, total_spent=0)
        db.session.add(b)
        db.session.flush()
    return b


def _check_rate_limit(user_id, event_type):
    """Check rate limits. Returns (allowed, message)."""
    limits = RATE_LIMITS.get(event_type)
    if not limits:
        return True, ''

    window = datetime.utcnow() - timedelta(seconds=limits['window_seconds'])
    count = CoinTransaction.query.filter(
        CoinTransaction.user_id == user_id,
        CoinTransaction.type == event_type,
        CoinTransaction.created_at >= window,
    ).count()

    if count >= limits['max']:
        # Log fraud alert
        alert = FraudAlert(
            user_id=user_id,
            alert_type='rate_limit',
            severity='medium',
            description=f'Rate limit exceeded: {count}/{limits["max"]} {event_type}s in {limits["window_seconds"]}s',
            metadata_json=json.dumps({'event_type': event_type, 'count': count, 'limit': limits['max']}),
        )
        db.session.add(alert)

        # Increase risk score
        user = _get_user(user_id)
        if user:
            user.risk_score = min(100, (user.risk_score or 0) + 5)

        db.session.commit()
        return False, f'Too many {event_type}s. Please wait and try again.'

    return True, ''


def _check_frozen(user_id):
    """Check if user's account is frozen."""
    user = _get_user(user_id)
    if user and user.account_frozen:
        return True
    return False


def record_coin_purchase(user_id, coins, price_ghs, reference, package_id=None,
                         store=None, store_transaction_id=None):
    """
    Record a coin purchase (Paystack or IAP payment confirmed).
    Double-entry:
      DEBIT  platform_cash    (GHS in)
      CREDIT user             (coins added)
      CREDIT platform_revenue (platform keeps the coins value)
    """
    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'purchase')
    if not allowed:
        return {'error': msg}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    # Update user balance
    bal = _get_user_balance(user_id)
    bal.balance += coins
    bal.total_purchased += coins
    bal.updated_at = now
    new_balance = bal.balance

    # Update system wallets
    cash_wallet = _get_system_balance('platform_cash')
    cash_wallet.balance_ghs += price_ghs
    cash_wallet.updated_at = now

    rev_wallet = _get_system_balance('platform_revenue')
    rev_wallet.balance_coins += coins
    rev_wallet.updated_at = now

    # Ledger entries (double-entry)
    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='platform_cash', account_id=0,
            entry_type='debit', amount=int(price_ghs * 100), currency='GHS',
            balance_after=int(cash_wallet.balance_ghs * 100),
            description=f'Paystack payment received: GHS {price_ghs}',
            reference=reference, event_type='cash_in',
            metadata_json=json.dumps({'package_id': package_id, 'coins': coins}),
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='credit', amount=coins, currency='coins',
            balance_after=new_balance,
            description=f'Purchased {coins} coins for GHS {price_ghs}',
            reference=reference, event_type='purchase',
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=coins, currency='coins',
            balance_after=rev_wallet.balance_coins,
            description=f'Revenue from coin purchase by user {user_id}',
            reference=reference, event_type='purchase',
            created_at=now, created_by=user_id,
        ),
    ]
    for e in entries:
        db.session.add(e)

    # CoinTransaction (backward compatible)
    tx = CoinTransaction(
        user_id=user_id, type='purchase', amount=coins,
        balance_after=new_balance, description=f'Purchased {coins} coins',
        reference=reference, ledger_tx_group=tx_group, created_at=now,
        store=store, store_transaction_id=store_transaction_id,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: purchase user=%s coins=%s GHS=%.2f ref=%s", user_id, coins, price_ghs, reference)
    return {'success': True, 'balance': new_balance, 'tx_group': tx_group}


def record_chapter_unlock(user_id, creator_id, content_id, chapter_number, coins_cost):
    """
    Record a chapter unlock (coin spend).
    Double-entry:
      DEBIT  user      (coins removed)
      CREDIT creator   (creator_share of coins earned — tracked for payout)
      CREDIT platform  (platform_share of coins — platform revenue)
    """
    # Self-purchase prevention
    if user_id == creator_id:
        return {'error': 'You cannot unlock your own content.'}

    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'unlock')
    if not allowed:
        return {'error': msg}

    bal = _get_user_balance(user_id)
    if bal.balance < coins_cost:
        return {'error': 'Not enough coins.'}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    # Revenue split
    split = REVENUE_SPLITS['unlock']
    creator_coins = int(coins_cost * split['creator'] / 100)
    platform_coins = coins_cost - creator_coins

    # Debit user
    bal.balance -= coins_cost
    bal.total_spent += coins_cost
    bal.updated_at = now

    # Platform revenue from split
    if platform_coins > 0:
        rev_wallet = _get_system_balance('platform_revenue')
        rev_wallet.balance_coins += platform_coins
        rev_wallet.updated_at = now

    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='debit', amount=coins_cost, currency='coins',
            balance_after=bal.balance,
            description=f'Unlock chapter {chapter_number} of story {content_id}',
            event_type='unlock',
            metadata_json=json.dumps({'content_id': content_id, 'chapter': chapter_number, 'creator_id': creator_id}),
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='credit', amount=creator_coins, currency='coins',
            balance_after=0,  # creator balance tracked via CreatorEarnings
            description=f'Earned {creator_coins} coins from chapter unlock ({split["creator"]}% of {coins_cost})',
            event_type='unlock',
            metadata_json=json.dumps({'content_id': content_id, 'chapter': chapter_number, 'user_id': user_id, 'split': split}),
            created_at=now, created_by=user_id,
        ),
    ]
    if platform_coins > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=platform_coins, currency='coins',
            balance_after=_get_system_balance('platform_revenue').balance_coins,
            description=f'Platform share from unlock ({split["platform"]}% of {coins_cost})',
            event_type='unlock',
            created_at=now, created_by=user_id,
        ))
    for e in entries:
        db.session.add(e)

    tx = CoinTransaction(
        user_id=user_id, type='unlock', amount=-coins_cost,
        balance_after=bal.balance,
        description=f'Unlocked Ch.{chapter_number}',
        content_id=content_id, chapter_id=chapter_number,
        recipient_id=creator_id, ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: unlock user=%s creator=%s book=%s ch=%s coins=%s",
             user_id, creator_id, content_id, chapter_number, coins_cost)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def record_episode_unlock(user_id, creator_id, content_id, episode_id, episode_number, coins_cost):
    """Coin spend to unlock a drama episode. Same economics as chapter unlock."""
    if user_id == creator_id:
        return {'error': 'You cannot unlock your own content.'}

    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'unlock')
    if not allowed:
        return {'error': msg}

    bal = _get_user_balance(user_id)
    if bal.balance < coins_cost:
        return {'error': 'Not enough coins.'}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    content = None
    try:
        from ..models import Content
        content = Content.query.get(content_id)
    except Exception:
        content = None
    split = unlock_split_for_content(content)
    creator_coins = int(coins_cost * split['creator'] / 100)
    platform_coins = coins_cost - creator_coins
    if split.get('creator', 0) <= 0:
        creator_coins = 0
        platform_coins = coins_cost

    bal.balance -= coins_cost
    bal.total_spent += coins_cost
    bal.updated_at = now

    if platform_coins > 0:
        rev_wallet = _get_system_balance('platform_revenue')
        rev_wallet.balance_coins += platform_coins
        rev_wallet.updated_at = now

    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='debit', amount=coins_cost, currency='coins',
            balance_after=bal.balance,
            description=f'Unlock episode {episode_number} of series {content_id}',
            event_type='episode_unlock',
            metadata_json=json.dumps({
                'content_id': content_id, 'episode_id': episode_id,
                'episode_number': episode_number, 'creator_id': creator_id,
                'split': split,
            }),
            created_at=now, created_by=user_id,
        ),
    ]
    if creator_coins > 0 and creator_id:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='credit', amount=creator_coins, currency='coins',
            balance_after=0,
            description=f'Earned {creator_coins} coins from episode unlock',
            event_type='episode_unlock',
            metadata_json=json.dumps({
                'content_id': content_id, 'episode_id': episode_id, 'user_id': user_id,
            }),
            created_at=now, created_by=user_id,
        ))
    if platform_coins > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=platform_coins, currency='coins',
            balance_after=_get_system_balance('platform_revenue').balance_coins,
            description=f'Platform share from episode unlock',
            event_type='episode_unlock',
            created_at=now, created_by=user_id,
        ))
    for e in entries:
        db.session.add(e)

    tx = CoinTransaction(
        user_id=user_id, type='unlock', amount=-coins_cost,
        balance_after=bal.balance,
        description=f'Unlocked Ep.{episode_number}',
        content_id=content_id, chapter_id=episode_number,
        recipient_id=creator_id, ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: episode_unlock user=%s creator=%s series=%s ep=%s coins=%s",
             user_id, creator_id, content_id, episode_number, coins_cost)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def record_voice_story_unlock(user_id, creator_id, story_id, coins_cost):
    """
    Record a WiamVox voice story unlock (coin spend). Same economics as chapter unlock.
    CoinTransaction.voice_story_id distinguishes this from book content_id.
    """
    if user_id == creator_id:
        return {'error': 'You cannot unlock your own story.'}

    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'unlock')
    if not allowed:
        return {'error': msg}

    bal = _get_user_balance(user_id)
    if bal.balance < coins_cost:
        return {'error': 'Not enough coins.'}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    split = REVENUE_SPLITS['unlock']
    creator_coins = int(coins_cost * split['creator'] / 100)
    platform_coins = coins_cost - creator_coins

    bal.balance -= coins_cost
    bal.total_spent += coins_cost
    bal.updated_at = now

    if platform_coins > 0:
        rev_wallet = _get_system_balance('platform_revenue')
        rev_wallet.balance_coins += platform_coins
        rev_wallet.updated_at = now

    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='debit', amount=coins_cost, currency='coins',
            balance_after=bal.balance,
            description=f'Unlock voice story {story_id}',
            event_type='unlock',
            metadata_json=json.dumps({'voice_story_id': story_id, 'creator_id': creator_id}),
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='credit', amount=creator_coins, currency='coins',
            balance_after=0,
            description=f'Earned {creator_coins} coins from voice story unlock ({split["creator"]}% of {coins_cost})',
            event_type='unlock',
            metadata_json=json.dumps({'voice_story_id': story_id, 'user_id': user_id, 'split': split}),
            created_at=now, created_by=user_id,
        ),
    ]
    if platform_coins > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=platform_coins, currency='coins',
            balance_after=_get_system_balance('platform_revenue').balance_coins,
            description=f'Platform share from voice unlock ({split["platform"]}% of {coins_cost})',
            event_type='unlock',
            created_at=now, created_by=user_id,
        ))
    for e in entries:
        db.session.add(e)

    tx = CoinTransaction(
        user_id=user_id, type='unlock', amount=-coins_cost,
        balance_after=bal.balance,
        description=f'Voice story unlock',
        voice_story_id=story_id, recipient_id=creator_id,
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: voice unlock user=%s creator=%s story=%s coins=%s",
             user_id, creator_id, story_id, coins_cost)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def record_voice_tip(user_id, creator_id, story_id, moment_id, coins_amount):
    """
    Tip on a WiamVox voice story (optionally attributed to a moment).
    Same economics as book tips; CoinTransaction.voice_story_id / voice_moment_id for reporting.
    moment_id may be None for story-level tips.
    """
    if user_id == creator_id:
        return {'error': 'You cannot tip yourself.'}

    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'tip')
    if not allowed:
        return {'error': msg}

    bal = _get_user_balance(user_id)
    if bal.balance < coins_amount:
        return {'error': 'Not enough coins.'}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    split = REVENUE_SPLITS['tip']
    creator_coins = int(coins_amount * split['creator'] / 100)
    platform_coins = coins_amount - creator_coins

    bal.balance -= coins_amount
    bal.total_spent += coins_amount
    bal.updated_at = now

    if platform_coins > 0:
        rev_wallet = _get_system_balance('platform_revenue')
        rev_wallet.balance_coins += platform_coins
        rev_wallet.updated_at = now

    meta = {'voice_story_id': story_id, 'voice_moment_id': moment_id, 'creator_id': creator_id}
    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='debit', amount=coins_amount, currency='coins',
            balance_after=bal.balance,
            description=f'Voice tip story={story_id} moment={moment_id}',
            event_type='tip',
            metadata_json=json.dumps(meta),
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='credit', amount=creator_coins, currency='coins',
            balance_after=0,
            description=f'Received {creator_coins} coin voice tip ({split["creator"]}% of {coins_amount})',
            event_type='tip',
            metadata_json=json.dumps({**meta, 'user_id': user_id, 'split': split}),
            created_at=now, created_by=user_id,
        ),
    ]
    if platform_coins > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=platform_coins, currency='coins',
            balance_after=_get_system_balance('platform_revenue').balance_coins,
            description=f'Platform share from voice tip ({split["platform"]}% of {coins_amount})',
            event_type='tip',
            created_at=now, created_by=user_id,
        ))
    for e in entries:
        db.session.add(e)

    tx = CoinTransaction(
        user_id=user_id, type='tip', amount=-coins_amount,
        balance_after=bal.balance,
        description='Voice story tip',
        voice_story_id=story_id, voice_moment_id=moment_id, recipient_id=creator_id,
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: voice tip user=%s creator=%s story=%s moment=%s coins=%s",
             user_id, creator_id, story_id, moment_id, coins_amount)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def record_tip(user_id, creator_id, content_id, coins_amount):
    """
    Record a tip from reader to creator.
    Double-entry:
      DEBIT  user      (coins removed)
      CREDIT creator   (creator_share of coins earned)
      CREDIT platform  (platform_share of coins — platform revenue)
    """
    # Self-tip prevention
    if user_id == creator_id:
        return {'error': 'You cannot tip yourself.'}

    if _check_frozen(user_id):
        return {'error': 'Account is frozen. Contact support.'}

    allowed, msg = _check_rate_limit(user_id, 'tip')
    if not allowed:
        return {'error': msg}

    bal = _get_user_balance(user_id)
    if bal.balance < coins_amount:
        return {'error': 'Not enough coins.'}

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    # Revenue split
    split = REVENUE_SPLITS['tip']
    creator_coins = int(coins_amount * split['creator'] / 100)
    platform_coins = coins_amount - creator_coins

    bal.balance -= coins_amount
    bal.total_spent += coins_amount
    bal.updated_at = now

    # Platform revenue from split
    if platform_coins > 0:
        rev_wallet = _get_system_balance('platform_revenue')
        rev_wallet.balance_coins += platform_coins
        rev_wallet.updated_at = now

    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='debit', amount=coins_amount, currency='coins',
            balance_after=bal.balance,
            description=f'Tip to creator {creator_id} on story {content_id}',
            event_type='tip',
            metadata_json=json.dumps({'content_id': content_id, 'creator_id': creator_id}),
            created_at=now, created_by=user_id,
        ),
        LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='credit', amount=creator_coins, currency='coins',
            balance_after=0,
            description=f'Received {creator_coins} coin tip ({split["creator"]}% of {coins_amount})',
            event_type='tip',
            metadata_json=json.dumps({'content_id': content_id, 'user_id': user_id, 'split': split}),
            created_at=now, created_by=user_id,
        ),
    ]
    if platform_coins > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_revenue', account_id=0,
            entry_type='credit', amount=platform_coins, currency='coins',
            balance_after=_get_system_balance('platform_revenue').balance_coins,
            description=f'Platform share from tip ({split["platform"]}% of {coins_amount})',
            event_type='tip',
            created_at=now, created_by=user_id,
        ))
    for e in entries:
        db.session.add(e)

    tx = CoinTransaction(
        user_id=user_id, type='tip', amount=-coins_amount,
        balance_after=bal.balance,
        description=f'Tip to creator',
        content_id=content_id, recipient_id=creator_id,
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: tip user=%s creator=%s book=%s coins=%s",
             user_id, creator_id, content_id, coins_amount)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def record_refund(user_id, original_tx_id, coins_amount, reason='',
                  creator_id=None, resolved_by=None):
    """
    Process a refund.
    Rules:
      - Never remove coins already spent
      - Deduct from creator pending earnings first
      - If insufficient, platform_loss absorbs
    Double-entry:
      CREDIT user                (coins returned)
      DEBIT  creator             (if applicable)
      DEBIT  platform_loss       (remainder)
    """
    from ..models import RefundRequest, CreatorEarnings

    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    bal = _get_user_balance(user_id)
    bal.balance += coins_amount
    bal.updated_at = now

    # Track how much creator vs platform absorbs
    creator_deducted = 0
    platform_absorbed = 0

    if creator_id:
        # Try to deduct from creator's unpaid earnings
        current_month = now.month
        current_year = now.year
        earnings = CreatorEarnings.query.filter_by(
            creator_id=creator_id, year=current_year, month=current_month, is_paid=False
        ).first()
        if earnings and earnings.total_coins >= coins_amount:
            earnings.total_coins -= coins_amount
            earnings.coins_from_unlocks = max(0, (earnings.coins_from_unlocks or 0) - coins_amount)
            earnings.ghs_value = earnings.total_coins * 0.05
            earnings.creator_share_ghs = earnings.ghs_value * 0.5
            creator_deducted = coins_amount
        elif earnings:
            creator_deducted = earnings.total_coins
            platform_absorbed = coins_amount - creator_deducted
            earnings.total_coins = 0
            earnings.coins_from_unlocks = 0
            earnings.ghs_value = 0
            earnings.creator_share_ghs = 0
        else:
            platform_absorbed = coins_amount
    else:
        platform_absorbed = coins_amount

    # Ledger entries
    entries = [
        LedgerEntry(
            tx_group=tx_group, account_type='user', account_id=user_id,
            entry_type='credit', amount=coins_amount, currency='coins',
            balance_after=bal.balance,
            description=f'Refund: {reason}',
            reference=str(original_tx_id), event_type='refund',
            metadata_json=json.dumps({'original_tx': original_tx_id, 'reason': reason}),
            created_at=now, created_by=resolved_by or 0,
        ),
    ]
    if creator_deducted > 0:
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='creator', account_id=creator_id,
            entry_type='debit', amount=creator_deducted, currency='coins',
            balance_after=0, description=f'Refund deduction',
            event_type='refund', created_at=now, created_by=resolved_by or 0,
        ))
    if platform_absorbed > 0:
        loss_wallet = _get_system_balance('platform_loss')
        loss_wallet.balance_coins += platform_absorbed
        loss_wallet.updated_at = now
        entries.append(LedgerEntry(
            tx_group=tx_group, account_type='platform_loss', account_id=0,
            entry_type='debit', amount=platform_absorbed, currency='coins',
            balance_after=loss_wallet.balance_coins,
            description=f'Platform absorbed refund loss',
            event_type='refund', created_at=now, created_by=resolved_by or 0,
        ))

    for e in entries:
        db.session.add(e)

    # CoinTransaction
    tx = CoinTransaction(
        user_id=user_id, type='refund', amount=coins_amount,
        balance_after=bal.balance, description=f'Refund: {reason}',
        reference=str(original_tx_id), ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)

    # Update original transaction dispute_status
    orig = CoinTransaction.query.get(original_tx_id)
    if orig:
        orig.dispute_status = 'refunded'

    # Increment user refund count + check for auto-freeze
    user = _get_user(user_id)
    if user:
        user.refund_count = (user.refund_count or 0) + 1
        if user.refund_count >= 5:
            user.account_frozen = True
            user.risk_score = min(100, (user.risk_score or 0) + 20)
            alert = FraudAlert(
                user_id=user_id, alert_type='suspicious_pattern', severity='high',
                description=f'Auto-frozen: {user.refund_count} refunds',
                created_at=now,
            )
            db.session.add(alert)

    # RefundRequest record
    refund = RefundRequest(
        user_id=user_id, original_tx_id=original_tx_id,
        amount_coins=coins_amount, reason=reason,
        status='approved', resolved_by=resolved_by,
        creator_deducted=creator_deducted,
        platform_absorbed=platform_absorbed,
        ledger_tx_group=tx_group,
        created_at=now, resolved_at=now,
    )
    db.session.add(refund)
    db.session.commit()

    log.info("Ledger: refund user=%s coins=%s creator_deducted=%s platform=%s",
             user_id, coins_amount, creator_deducted, platform_absorbed)
    return {'success': True, 'balance': bal.balance, 'tx_group': tx_group}


def founder_adjust_balance(user_id, coins_delta, reason, founder_id):
    """
    Founder manually adjusts a user's balance (via ledger only, never direct).
    Positive = credit, Negative = debit.
    """
    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    bal = _get_user_balance(user_id)
    bal.balance += coins_delta
    if bal.balance < 0:
        bal.balance = 0
    bal.updated_at = now

    entry_type = 'credit' if coins_delta > 0 else 'debit'
    entry = LedgerEntry(
        tx_group=tx_group, account_type='user', account_id=user_id,
        entry_type=entry_type, amount=abs(coins_delta), currency='coins',
        balance_after=bal.balance,
        description=f'Founder adjustment: {reason}',
        event_type='adjustment',
        metadata_json=json.dumps({'founder_id': founder_id, 'reason': reason}),
        created_at=now, created_by=founder_id,
    )
    db.session.add(entry)

    tx = CoinTransaction(
        user_id=user_id, type='adjustment', amount=coins_delta,
        balance_after=bal.balance, description=f'Founder: {reason}',
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Ledger: founder_adjust user=%s delta=%s by=%s reason=%s",
             user_id, coins_delta, founder_id, reason)
    return {'success': True, 'balance': bal.balance}


def founder_freeze_account(user_id, freeze=True, founder_id=None, reason=''):
    """Founder freezes/unfreezes a user's financial account."""
    user = _get_user(user_id)
    if not user:
        return {'error': 'User not found'}

    user.account_frozen = freeze
    if freeze:
        user.risk_score = min(100, (user.risk_score or 0) + 30)

    alert = FraudAlert(
        user_id=user_id,
        alert_type='suspicious_pattern',
        severity='high' if freeze else 'low',
        description=f'Account {"frozen" if freeze else "unfrozen"} by founder: {reason}',
        metadata_json=json.dumps({'founder_id': founder_id, 'reason': reason}),
        created_at=datetime.utcnow(),
    )
    db.session.add(alert)
    db.session.commit()

    log.info("Founder %s account user=%s freeze=%s reason=%s", founder_id, user_id, freeze, reason)
    return {'success': True, 'frozen': freeze}


def get_ledger_health():
    """Dashboard data: system wallet balances, recent alerts, ledger stats."""
    wallets = {w.account_type: {
        'coins': w.balance_coins, 'ghs': w.balance_ghs
    } for w in SystemWallet.query.all()}

    # Ensure all 3 wallets exist
    for wtype in ('platform_revenue', 'platform_cash', 'platform_loss'):
        if wtype not in wallets:
            wallets[wtype] = {'coins': 0, 'ghs': 0.0}

    recent_alerts = FraudAlert.query.filter_by(is_resolved=False)\
        .order_by(FraudAlert.created_at.desc()).limit(20).all()

    from sqlalchemy import func
    total_ledger_entries = db.session.query(func.count(LedgerEntry.id)).scalar() or 0
    total_refunds = db.session.query(func.count(RefundRequest.id)).scalar() or 0
    pending_refunds = RefundRequest.query.filter_by(status='pending').count()

    return {
        'wallets': wallets,
        'total_ledger_entries': total_ledger_entries,
        'total_refunds': total_refunds,
        'pending_refunds': pending_refunds,
        'unresolved_alerts': [{
            'id': a.id,
            'user_id': a.user_id,
            'type': a.alert_type,
            'severity': a.severity,
            'description': a.description,
            'created_at': a.created_at.isoformat() if a.created_at else None,
        } for a in recent_alerts],
    }


# ---------------------------------------------------------------------------
# Growth Features: Welcome Bonus, Daily Rewards, Referral Bonus
# ---------------------------------------------------------------------------

WELCOME_BONUS_COINS = 10
FIRST_MISSION_COINS = 10
DAILY_REWARD_COINS = 5
DAILY_REWARD_STREAK_BONUS = {3: 5, 7: 15, 14: 30, 30: 100}   # streak day → extra coins
REFERRAL_BONUS_REFERRER = 100   # coins for the person who referred
REFERRAL_BONUS_REFERRED = 50    # coins for the new user


def claim_welcome_bonus(user_id):
    """
    One-time welcome bonus for new users.
    Returns { ok, balance, coins } or { ok: False, error }.
    """
    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}
    if user.welcome_bonus_claimed:
        return {'ok': False, 'error': 'Welcome bonus already claimed'}

    bal = _get_user_balance(user_id)
    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    bal.balance += WELCOME_BONUS_COINS
    bal.total_purchased += WELCOME_BONUS_COINS
    bal.updated_at = now
    user.welcome_bonus_claimed = True

    entry = LedgerEntry(
        tx_group=tx_group, account_type='user', account_id=user_id,
        entry_type='credit', amount=WELCOME_BONUS_COINS, currency='coins',
        balance_after=bal.balance,
        description=f'Welcome bonus: {WELCOME_BONUS_COINS} coins',
        event_type='bonus', created_at=now, created_by=user_id,
    )
    db.session.add(entry)

    tx = CoinTransaction(
        user_id=user_id, type='bonus', amount=WELCOME_BONUS_COINS,
        balance_after=bal.balance,
        description='Welcome bonus',
        reference=f'welcome_{user_id}',
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Growth: welcome bonus user=%s coins=%s", user_id, WELCOME_BONUS_COINS)
    return {'ok': True, 'balance': bal.balance, 'coins': WELCOME_BONUS_COINS}


def claim_daily_reward(user_id):
    """
    Daily login reward with streak tracking.
    Returns { ok, balance, coins, streak } or { ok: False, error }.
    """
    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}

    now = datetime.utcnow()
    today = now.date()

    # Check if already claimed today
    if user.last_daily_reward:
        last_date = user.last_daily_reward.date()
        if last_date == today:
            return {'ok': False, 'error': 'Daily reward already claimed today'}

        # Check streak: if last claim was yesterday, increment; otherwise reset
        yesterday = today - timedelta(days=1)
        if last_date == yesterday:
            user.daily_reward_streak = (user.daily_reward_streak or 0) + 1
        else:
            user.daily_reward_streak = 1
    else:
        user.daily_reward_streak = 1

    user.last_daily_reward = now
    streak = user.daily_reward_streak

    # Calculate reward: base + streak bonus
    coins = DAILY_REWARD_COINS
    streak_bonus = 0
    for day_threshold, bonus in sorted(DAILY_REWARD_STREAK_BONUS.items()):
        if streak >= day_threshold:
            streak_bonus = bonus
    total_coins = coins + streak_bonus

    bal = _get_user_balance(user_id)
    tx_group = str(uuid.uuid4())

    bal.balance += total_coins
    bal.total_purchased += total_coins
    bal.updated_at = now

    desc = f'Daily reward: {coins} coins'
    if streak_bonus > 0:
        desc += f' + {streak_bonus} streak bonus (day {streak})'

    entry = LedgerEntry(
        tx_group=tx_group, account_type='user', account_id=user_id,
        entry_type='credit', amount=total_coins, currency='coins',
        balance_after=bal.balance,
        description=desc, event_type='bonus',
        metadata_json=json.dumps({'streak': streak, 'base': coins, 'streak_bonus': streak_bonus}),
        created_at=now, created_by=user_id,
    )
    db.session.add(entry)

    tx = CoinTransaction(
        user_id=user_id, type='bonus', amount=total_coins,
        balance_after=bal.balance,
        description=desc,
        reference=f'daily_{user_id}_{today.isoformat()}',
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Growth: daily reward user=%s coins=%s streak=%s", user_id, total_coins, streak)
    return {'ok': True, 'balance': bal.balance, 'coins': total_coins, 'streak': streak}


def has_claimed_first_mission_bonus(user_id):
    """Return True if the first-mission bonus was already granted."""
    ref = f'first_mission_{user_id}'
    return CoinTransaction.query.filter_by(reference=ref).first() is not None


def claim_first_mission_bonus(user_id):
    """
    One-time first mission bonus (+10 coins).
    Returns { ok, balance, coins } or { ok: False, error }.
    """
    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}
    if has_claimed_first_mission_bonus(user_id):
        return {'ok': False, 'error': 'First mission bonus already claimed'}

    bal = _get_user_balance(user_id)
    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()

    bal.balance += FIRST_MISSION_COINS
    bal.total_purchased += FIRST_MISSION_COINS
    bal.updated_at = now

    entry = LedgerEntry(
        tx_group=tx_group, account_type='user', account_id=user_id,
        entry_type='credit', amount=FIRST_MISSION_COINS, currency='coins',
        balance_after=bal.balance,
        description=f'First mission bonus: {FIRST_MISSION_COINS} coins',
        event_type='bonus', created_at=now, created_by=user_id,
    )
    db.session.add(entry)

    tx = CoinTransaction(
        user_id=user_id, type='bonus', amount=FIRST_MISSION_COINS,
        balance_after=bal.balance,
        description='First mission reward',
        reference=f'first_mission_{user_id}',
        ledger_tx_group=tx_group, created_at=now,
    )
    db.session.add(tx)
    db.session.commit()

    log.info("Growth: first mission bonus user=%s coins=%s", user_id, FIRST_MISSION_COINS)
    return {'ok': True, 'balance': bal.balance, 'coins': FIRST_MISSION_COINS}


def credit_referral_bonus(referrer_id, referred_id, referral_code):
    """
    Credit both referrer and referred user after a successful referral.
    Called after the referred user signs up with a valid referral code.
    Returns { ok } or { ok: False, error }.
    """
    if referrer_id == referred_id:
        return {'ok': False, 'error': 'Self-referral not allowed'}

    now = datetime.utcnow()

    # Credit referrer
    ref_bal = _get_user_balance(referrer_id)
    ref_bal.balance += REFERRAL_BONUS_REFERRER
    ref_bal.total_purchased += REFERRAL_BONUS_REFERRER
    ref_bal.updated_at = now

    tx_group_r = str(uuid.uuid4())
    db.session.add(LedgerEntry(
        tx_group=tx_group_r, account_type='user', account_id=referrer_id,
        entry_type='credit', amount=REFERRAL_BONUS_REFERRER, currency='coins',
        balance_after=ref_bal.balance,
        description=f'Referral bonus: invited user {referred_id}',
        event_type='bonus',
        metadata_json=json.dumps({'referred_id': referred_id, 'code': referral_code}),
        created_at=now, created_by=referrer_id,
    ))
    db.session.add(CoinTransaction(
        user_id=referrer_id, type='bonus', amount=REFERRAL_BONUS_REFERRER,
        balance_after=ref_bal.balance,
        description=f'Referral bonus for inviting a friend',
        reference=f'ref_r_{referrer_id}_{referred_id}',
        ledger_tx_group=tx_group_r, created_at=now,
    ))

    # Credit referred user
    new_bal = _get_user_balance(referred_id)
    new_bal.balance += REFERRAL_BONUS_REFERRED
    new_bal.total_purchased += REFERRAL_BONUS_REFERRED
    new_bal.updated_at = now

    tx_group_n = str(uuid.uuid4())
    db.session.add(LedgerEntry(
        tx_group=tx_group_n, account_type='user', account_id=referred_id,
        entry_type='credit', amount=REFERRAL_BONUS_REFERRED, currency='coins',
        balance_after=new_bal.balance,
        description=f'Welcome referral bonus from {referrer_id}',
        event_type='bonus',
        metadata_json=json.dumps({'referrer_id': referrer_id, 'code': referral_code}),
        created_at=now, created_by=referred_id,
    ))
    db.session.add(CoinTransaction(
        user_id=referred_id, type='bonus', amount=REFERRAL_BONUS_REFERRED,
        balance_after=new_bal.balance,
        description=f'Referral welcome bonus',
        reference=f'ref_n_{referrer_id}_{referred_id}',
        ledger_tx_group=tx_group_n, created_at=now,
    ))

    db.session.commit()

    log.info("Growth: referral bonus referrer=%s referred=%s", referrer_id, referred_id)
    return {'ok': True, 'referrer_coins': REFERRAL_BONUS_REFERRER,
            'referred_coins': REFERRAL_BONUS_REFERRED}


# ---------------------------------------------------------------------------
# Episio free-coin rewards (capped)
# ---------------------------------------------------------------------------

WATCH_EPISODE_COINS = 2
WATCH_REWARD_PAUSE_BALANCE = 50
AD_COINS = 10
AD_COINS_DAILY_LIMIT = 3
SERIES_FINISH_COINS = 15
SERIES_FINISH_WEEKLY_LIMIT = 2
FRIEND_INVITE_COINS = 20
FRIEND_INVITE_MONTHLY_LIMIT = 5


def _credit_bonus(user_id, coins, description, reference, event_type='bonus'):
    bal = _get_user_balance(user_id)
    tx_group = str(uuid.uuid4())
    now = datetime.utcnow()
    bal.balance += coins
    bal.total_purchased += coins
    bal.updated_at = now
    db.session.add(LedgerEntry(
        tx_group=tx_group, account_type='user', account_id=user_id,
        entry_type='credit', amount=coins, currency='coins',
        balance_after=bal.balance,
        description=description,
        event_type=event_type, created_at=now, created_by=user_id,
    ))
    db.session.add(CoinTransaction(
        user_id=user_id, type='bonus', amount=coins,
        balance_after=bal.balance,
        description=description,
        reference=reference,
        ledger_tx_group=tx_group, created_at=now,
    ))
    return bal


def claim_watch_episode_reward(user_id, episode_id, series_id=None):
    """+2 per completed episode; pause when balance >= 50. Idempotent per episode."""
    from sqlalchemy import text
    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}

    exists = db.session.execute(
        text('SELECT id FROM w_watch_episode_rewards WHERE user_id=:u AND episode_id=:e'),
        {'u': user_id, 'e': episode_id},
    ).first()
    if exists:
        bal = _get_user_balance(user_id)
        return {'ok': True, 'already': True, 'granted': False, 'balance': bal.balance, 'coins': 0}

    bal = _get_user_balance(user_id)
    if bal.balance >= WATCH_REWARD_PAUSE_BALANCE:
        return {
            'ok': True, 'paused': True, 'granted': False,
            'balance': bal.balance, 'coins': 0,
            'pause_at': WATCH_REWARD_PAUSE_BALANCE,
        }

    try:
        db.session.execute(
            text(
                'INSERT INTO w_watch_episode_rewards (user_id, episode_id, coins) '
                'VALUES (:u, :e, :c)'
            ),
            {'u': user_id, 'e': episode_id, 'c': WATCH_EPISODE_COINS},
        )
    except Exception:
        db.session.rollback()
        bal = _get_user_balance(user_id)
        return {'ok': True, 'already': True, 'granted': False, 'balance': bal.balance, 'coins': 0}

    bal = _credit_bonus(
        user_id, WATCH_EPISODE_COINS,
        f'Watch reward episode {episode_id}',
        f'watch_ep_{user_id}_{episode_id}',
    )
    db.session.commit()
    return {
        'ok': True, 'granted': True, 'coins': WATCH_EPISODE_COINS,
        'balance': bal.balance, 'paused': False,
    }


def claim_ad_coins(user_id):
    """+10 after rewarded ad; max 3 per calendar day (UTC)."""
    from sqlalchemy import text
    from datetime import date
    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}

    today = date.today()
    row = db.session.execute(
        text('SELECT id, claim_count FROM w_ad_coin_claims WHERE user_id=:u AND claim_date=:d'),
        {'u': user_id, 'd': today.isoformat()},
    ).first()
    count = int(row.claim_count) if row else 0
    if count >= AD_COINS_DAILY_LIMIT:
        return {
            'ok': False, 'error': 'Daily ad reward limit reached',
            'daily_remaining': 0, 'daily_limit': AD_COINS_DAILY_LIMIT,
        }

    if row:
        db.session.execute(
            text('UPDATE w_ad_coin_claims SET claim_count = claim_count + 1 WHERE id=:id'),
            {'id': row.id},
        )
    else:
        db.session.execute(
            text(
                'INSERT INTO w_ad_coin_claims (user_id, claim_date, claim_count) '
                'VALUES (:u, :d, 1)'
            ),
            {'u': user_id, 'd': today.isoformat()},
        )

    bal = _credit_bonus(
        user_id, AD_COINS, 'Ad reward', f'ad_coins_{user_id}_{today.isoformat()}_{count + 1}',
    )
    db.session.commit()
    return {
        'ok': True, 'coins': AD_COINS, 'balance': bal.balance,
        'daily_remaining': AD_COINS_DAILY_LIMIT - (count + 1),
        'daily_limit': AD_COINS_DAILY_LIMIT,
    }


def claim_series_finish_bonus(user_id, series_id):
    """+15 once per series when ~90% watched; max 2 series / rolling 7 days."""
    from sqlalchemy import text
    from ..models import WatchProgress, Episode

    user = _get_user(user_id)
    if not user:
        return {'ok': False, 'error': 'User not found'}

    already = db.session.execute(
        text('SELECT id FROM w_series_finish_rewards WHERE user_id=:u AND series_id=:s'),
        {'u': user_id, 's': series_id},
    ).first()
    if already:
        bal = _get_user_balance(user_id)
        return {'ok': True, 'already': True, 'granted': False, 'balance': bal.balance, 'coins': 0}

    total = Episode.query.filter_by(content_id=series_id).count()
    if total <= 0:
        return {'ok': False, 'error': 'Series not found'}

    ep_ids = [r[0] for r in db.session.query(Episode.id).filter_by(content_id=series_id).all()]
    if not ep_ids:
        return {'ok': False, 'error': 'No episodes'}

    completed_ids = {
        int(r.episode_id) for r in WatchProgress.query.filter(
            WatchProgress.user_id == user_id,
            WatchProgress.episode_id.in_(ep_ids),
            WatchProgress.completed.is_(True),
        ).all()
    }
    rewarded_rows = db.session.execute(
        text('SELECT episode_id FROM w_watch_episode_rewards WHERE user_id=:u'),
        {'u': user_id},
    ).fetchall()
    rewarded_set = {int(r[0]) for r in rewarded_rows if r and r[0] is not None}
    done = len(completed_ids | (rewarded_set & set(ep_ids)))
    if done / float(total) < 0.9:
        return {'ok': False, 'error': 'Series not finished yet', 'progress': round(done / float(total), 2)}

    week_count = db.session.execute(
        text(
            'SELECT COUNT(*) FROM w_series_finish_rewards '
            'WHERE user_id=:u AND created_at >= NOW() - INTERVAL \'7 days\''
        ),
        {'u': user_id},
    ).scalar() or 0
    if int(week_count) >= SERIES_FINISH_WEEKLY_LIMIT:
        return {
            'ok': False, 'error': 'Weekly finish bonus limit reached',
            'weekly_limit': SERIES_FINISH_WEEKLY_LIMIT,
        }

    try:
        db.session.execute(
            text(
                'INSERT INTO w_series_finish_rewards (user_id, series_id, coins) '
                'VALUES (:u, :s, :c)'
            ),
            {'u': user_id, 's': series_id, 'c': SERIES_FINISH_COINS},
        )
    except Exception:
        db.session.rollback()
        bal = _get_user_balance(user_id)
        return {'ok': True, 'already': True, 'granted': False, 'balance': bal.balance, 'coins': 0}

    bal = _credit_bonus(
        user_id, SERIES_FINISH_COINS,
        f'Series finish bonus {series_id}',
        f'series_finish_{user_id}_{series_id}',
    )
    db.session.commit()
    return {'ok': True, 'granted': True, 'coins': SERIES_FINISH_COINS, 'balance': bal.balance}


def credit_friend_invite_on_verify(referred_user_id):
    """When invitee verifies email, credit referrer +20 (max 5/month)."""
    from sqlalchemy import text
    referred = _get_user(referred_user_id)
    if not referred:
        return {'ok': False, 'error': 'User not found'}
    referrer_id = getattr(referred, 'referred_by', None)
    if not referrer_id:
        return {'ok': False, 'skipped': True, 'reason': 'no_referrer'}

    exists = db.session.execute(
        text(
            'SELECT id FROM w_friend_invite_bonuses '
            'WHERE referrer_id=:r AND referred_id=:n'
        ),
        {'r': referrer_id, 'n': referred_user_id},
    ).first()
    if exists:
        return {'ok': True, 'already': True}

    month_count = db.session.execute(
        text(
            'SELECT COUNT(*) FROM w_friend_invite_bonuses '
            'WHERE referrer_id=:r AND created_at >= date_trunc(\'month\', NOW())'
        ),
        {'r': referrer_id},
    ).scalar() or 0
    if int(month_count) >= FRIEND_INVITE_MONTHLY_LIMIT:
        return {'ok': False, 'error': 'Monthly invite bonus limit', 'monthly_limit': FRIEND_INVITE_MONTHLY_LIMIT}

    try:
        db.session.execute(
            text(
                'INSERT INTO w_friend_invite_bonuses (referrer_id, referred_id, coins) '
                'VALUES (:r, :n, :c)'
            ),
            {'r': referrer_id, 'n': referred_user_id, 'c': FRIEND_INVITE_COINS},
        )
    except Exception:
        db.session.rollback()
        return {'ok': True, 'already': True}

    bal = _credit_bonus(
        referrer_id, FRIEND_INVITE_COINS,
        f'Friend invite bonus for user {referred_user_id}',
        f'friend_invite_{referrer_id}_{referred_user_id}',
    )
    db.session.commit()
    return {'ok': True, 'granted': True, 'coins': FRIEND_INVITE_COINS, 'balance': bal.balance, 'referrer_id': referrer_id}
