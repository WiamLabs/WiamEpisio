from datetime import datetime, timezone, timedelta

from core.db import get_db_connection

# ── Tier definitions ─────────────────────────────────────────────
TIERS = {
    'starter': {
        'name': 'Starter',
        'emoji': '\U0001f331',
        'max_books': 5,
        'chapters': False,
        'audio': False,
        'translation': False,
        'monthly_price': 100.00,
        'yearly_price': 1000.00,
        'color': '🟢',
    },
    'pro': {
        'name': 'Pro',
        'emoji': '\u26a1',
        'max_books': 20,
        'chapters': False,
        'audio': True,
        'translation': True,
        'monthly_price': 250.00,
        'yearly_price': 2500.00,
        'color': '🔵',
    },
    'business': {
        'name': 'Business',
        'emoji': '\U0001f451',
        'max_books': 999999,
        'chapters': True,
        'audio': True,
        'translation': True,
        'monthly_price': 500.00,
        'yearly_price': 5000.00,
        'color': '🟡',
    },
}

CURRENCY = 'GH\u20b5'


def ensure_subscription_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS creator_subscriptions (
        id SERIAL PRIMARY KEY,
        creator_wiam_id BIGINT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'starter_monthly',
        tier TEXT NOT NULL DEFAULT 'starter',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Add tier column if missing (migration from old schema)
    cur.execute("ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter'")

    # Plan pricing table (founder-configurable)
    cur.execute('''CREATE TABLE IF NOT EXISTS subscription_plans (
        plan TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'starter',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        price REAL NOT NULL,
        label TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Add new columns if missing (migration)
    cur.execute("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter'")
    cur.execute("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'")

    # Subscription settings (collection on/off)
    cur.execute('''CREATE TABLE IF NOT EXISTS subscription_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        collection_enabled BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    cur.execute("SELECT id FROM subscription_settings WHERE id=1")
    if not cur.fetchone():
        cur.execute("INSERT INTO subscription_settings (id, collection_enabled) VALUES (1, FALSE)")

    # Upsert all 6 plans
    for tier_key, info in TIERS.items():
        for cycle in ('monthly', 'yearly'):
            plan_key = f'{tier_key}_{cycle}'
            price = info[f'{cycle}_price']
            label = f"{info['emoji']} {info['name']} ({cycle.title()})"
            cur.execute(
                "INSERT INTO subscription_plans (plan, tier, billing_cycle, price, label) "
                "VALUES (%s, %s, %s, %s, %s) "
                "ON CONFLICT (plan) DO UPDATE SET tier=%s, billing_cycle=%s, price=%s, label=%s, updated_at=CURRENT_TIMESTAMP",
                (plan_key, tier_key, cycle, price, label,
                 tier_key, cycle, price, label),
            )
    conn.commit()
    conn.close()


def is_subscription_collection_enabled() -> bool:
    """Check if subscription collection is ON (users must pay to become creators)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT collection_enabled FROM subscription_settings WHERE id=1")
    row = cur.fetchone()
    conn.close()
    return bool(row[0]) if row else False


def set_subscription_collection_enabled(enabled: bool):
    """Toggle subscription collection ON/OFF."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE subscription_settings SET collection_enabled=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        (enabled,),
    )
    if cur.rowcount == 0:
        cur.execute("INSERT INTO subscription_settings (id, collection_enabled) VALUES (1, %s)", (enabled,))
    conn.commit()
    conn.close()


def get_plan_price(plan: str) -> float:
    """Get the current price for a subscription plan."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT price FROM subscription_plans WHERE plan=%s", (plan,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 0.0


def get_all_plan_prices() -> list:
    """Get all plan prices. Returns list of (plan, tier, billing_cycle, price, label)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT plan, tier, billing_cycle, price, label FROM subscription_plans ORDER BY price ASC")
    rows = cur.fetchall()
    conn.close()
    return rows


def get_plans_by_tier(tier: str) -> list:
    """Get monthly and yearly plan for a given tier."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT plan, billing_cycle, price, label FROM subscription_plans "
        "WHERE tier=%s ORDER BY price ASC", (tier,))
    rows = cur.fetchall()
    conn.close()
    return rows


def set_plan_price(plan: str, price: float) -> bool:
    """Update the price for a subscription plan. Returns True if updated."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE subscription_plans SET price=%s, updated_at=CURRENT_TIMESTAMP WHERE plan=%s",
        (price, plan),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_active_subscription(creator_wiam_id: int):
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, plan, start_date, end_date, status, tier "
        "FROM creator_subscriptions "
        "WHERE creator_wiam_id=%s AND status='active' AND end_date > %s "
        "ORDER BY end_date DESC LIMIT 1",
        (creator_wiam_id, now),
    )
    row = cur.fetchone()
    conn.close()
    return row


def has_active_subscription(creator_wiam_id: int) -> bool:
    return get_active_subscription(creator_wiam_id) is not None


def get_creator_tier(creator_wiam_id: int) -> str:
    """Return the active tier ('starter'/'pro'/'business') or 'none'."""
    sub = get_active_subscription(creator_wiam_id)
    if not sub:
        return 'none'
    return sub[5] if len(sub) > 5 and sub[5] else 'starter'


def get_tier_info(tier: str) -> dict:
    """Return tier feature dict from TIERS."""
    return TIERS.get(tier, TIERS['starter'])


# ── Feature gating ───────────────────────────────────────────────
def can_use_chapters(creator_wiam_id: int) -> bool:
    tier = get_creator_tier(creator_wiam_id)
    info = TIERS.get(tier)
    return info['chapters'] if info else False


def can_use_audio(creator_wiam_id: int) -> bool:
    tier = get_creator_tier(creator_wiam_id)
    info = TIERS.get(tier)
    return info['audio'] if info else False


def can_use_translation(creator_wiam_id: int) -> bool:
    tier = get_creator_tier(creator_wiam_id)
    info = TIERS.get(tier)
    return info['translation'] if info else False


def get_max_books(creator_wiam_id: int) -> int:
    tier = get_creator_tier(creator_wiam_id)
    info = TIERS.get(tier)
    return info['max_books'] if info else 0


def get_creator_book_count(creator_wiam_id: int) -> int:
    """Count how many non-deleted books a creator has."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) FROM content WHERE creator_wiam_id=%s AND status != 'deleted'",
        (creator_wiam_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 0


def can_upload_more(creator_wiam_id: int) -> bool:
    """Check if creator hasn't hit their book limit."""
    return get_creator_book_count(creator_wiam_id) < get_max_books(creator_wiam_id)


def create_subscription(creator_wiam_id: int, plan: str = 'starter_monthly') -> tuple:
    now = datetime.now(timezone.utc)
    # Parse tier and cycle from plan key
    parts = plan.rsplit('_', 1)
    if len(parts) == 2 and parts[1] in ('monthly', 'yearly'):
        tier = parts[0]
        cycle = parts[1]
    else:
        tier = 'starter'
        cycle = 'monthly'

    if cycle == 'yearly':
        end_date = now + timedelta(days=365)
    else:
        end_date = now + timedelta(days=30)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO creator_subscriptions (creator_wiam_id, plan, tier, start_date, end_date, status) "
        "VALUES (%s, %s, %s, %s, %s, 'active') RETURNING id",
        (creator_wiam_id, plan, tier, now, end_date),
    )
    sub_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return sub_id, end_date


def cancel_subscription(creator_wiam_id: int) -> bool:
    """Immediately cancel the creator's active subscription. Returns True if cancelled."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE creator_subscriptions SET status='cancelled', end_date=CURRENT_TIMESTAMP "
        "WHERE creator_wiam_id=%s AND status='active'",
        (creator_wiam_id,),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def expire_old_subscriptions():
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE creator_subscriptions SET status='expired' "
        "WHERE status='active' AND end_date <= %s",
        (now,),
    )
    conn.commit()
    conn.close()


def hide_books_for_expired_creators():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET status='hidden' "
        "WHERE creator_wiam_id IS NOT NULL "
        "AND status IN ('approved','ongoing','complete') "
        "AND creator_wiam_id NOT IN ("
        "  SELECT DISTINCT creator_wiam_id FROM creator_subscriptions "
        "  WHERE status='active' AND end_date > CURRENT_TIMESTAMP"
        ") "
        "AND creator_wiam_id NOT IN ("
        "  SELECT wiam_id FROM users WHERE role IN ('founder', 'admin')"
        ")"
    )
    conn.commit()
    conn.close()


def unhide_books_for_creator(creator_wiam_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET status='ongoing' "
        "WHERE creator_wiam_id=%s AND status='hidden'",
        (creator_wiam_id,),
    )
    conn.commit()
    conn.close()


def get_just_expired_creator_ids():
    """Get creators whose subscription expired but haven't been notified yet."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT DISTINCT cs.creator_wiam_id "
        "FROM creator_subscriptions cs "
        "WHERE cs.status = 'expired' "
        "AND cs.notified_expired IS NOT TRUE "
        "AND cs.creator_wiam_id NOT IN ("
        "  SELECT DISTINCT creator_wiam_id FROM creator_subscriptions "
        "  WHERE status='active' AND end_date > CURRENT_TIMESTAMP"
        ") "
        "AND cs.creator_wiam_id NOT IN ("
        "  SELECT wiam_id FROM users WHERE role IN ('founder', 'admin')"
        ")"
    )
    rows = cur.fetchall()
    # Mark as notified
    if rows:
        ids = [r[0] for r in rows]
        for cid in ids:
            cur.execute(
                "UPDATE creator_subscriptions SET notified_expired=TRUE "
                "WHERE creator_wiam_id=%s AND status='expired'",
                (cid,),
            )
        conn.commit()
    conn.close()
    return [r[0] for r in rows]


def get_expiring_soon_creator_ids(days_before: int = 3):
    """Get creators whose subscription expires within N days and haven't been warned yet."""
    now = datetime.now(timezone.utc)
    warn_date = now + timedelta(days=days_before)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT DISTINCT cs.creator_wiam_id, cs.end_date "
        "FROM creator_subscriptions cs "
        "WHERE cs.status = 'active' "
        "AND cs.end_date <= %s "
        "AND cs.end_date > %s "
        "AND cs.notified_warning IS NOT TRUE "
        "AND cs.creator_wiam_id NOT IN ("
        "  SELECT wiam_id FROM users WHERE role IN ('founder', 'admin')"
        ")",
        (warn_date, now),
    )
    rows = cur.fetchall()
    # Mark as warned
    if rows:
        for cid, _ in rows:
            cur.execute(
                "UPDATE creator_subscriptions SET notified_warning=TRUE "
                "WHERE creator_wiam_id=%s AND status='active'",
                (cid,),
            )
        conn.commit()
    conn.close()
    return [(r[0], r[1]) for r in rows]


def ensure_subscription_notification_columns():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS notified_warning BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS notified_expired BOOLEAN DEFAULT FALSE")
    conn.commit()
    conn.close()


def list_all_subscriptions(limit: int = 20):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT cs.id, cs.creator_wiam_id, u.username, cs.plan, cs.start_date, cs.end_date, cs.status, cs.tier "
        "FROM creator_subscriptions cs "
        "LEFT JOIN users u ON cs.creator_wiam_id = u.wiam_id "
        "ORDER BY cs.created_at DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def build_tier_comparison_text() -> str:
    """Build a beautiful tier comparison message for Telegram."""
    lines = [
        "\U0001f451 *Creator Subscription Plans*\n",
        "Choose the plan that fits your publishing goals:\n",
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
    ]
    for key, t in TIERS.items():
        yes = '\u2705'
        no = '\u274c'
        monthly = t['monthly_price']
        yearly = t['yearly_price']
        saved = (monthly * 12) - yearly
        max_b = 'Unlimited' if t['max_books'] > 1000 else str(t['max_books'])
        lines.append(f"\n{t['emoji']} *{t['name']}*")
        lines.append(f"   \U0001f4b0 {CURRENCY} {monthly:,.2f}/mo  |  {CURRENCY} {yearly:,.2f}/yr")
        lines.append(f"   \U0001f4b8 _Save {CURRENCY} {saved:,.2f} yearly_")
        lines.append(f"   \U0001f4da Books: *{max_b}*")
        lines.append(f"   \U0001f4d1 Chapters: {yes if t['chapters'] else no}")
        lines.append(f"   \U0001f3a7 Audio (TTS): {yes if t['audio'] else no}")
        lines.append(f"   \U0001f30d Translation: {yes if t['translation'] else no}")
    lines.append("\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
    lines.append("_Select a plan below to subscribe:_")
    return "\n".join(lines)
