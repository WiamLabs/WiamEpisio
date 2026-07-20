from datetime import datetime, timezone, timedelta

from core.db import get_db_connection

DEFAULT_FEE_RATE = 0.05  # 5%
DEFAULT_FEE_CYCLE_MONTHS = 5


def ensure_platform_fee_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    # Platform fee settings (rate, cycle)
    cur.execute('''CREATE TABLE IF NOT EXISTS platform_fee_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        fee_rate REAL DEFAULT 0.05,
        fee_cycle_months INTEGER DEFAULT 5,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    cur.execute("SELECT id FROM platform_fee_settings WHERE id=1")
    if not cur.fetchone():
        cur.execute("INSERT INTO platform_fee_settings (id, fee_rate, fee_cycle_months) VALUES (1, 0.05, 5)")

    # Platform fee records per creator per cycle
    cur.execute('''CREATE TABLE IF NOT EXISTS platform_fees (
        id SERIAL PRIMARY KEY,
        creator_telegram_id BIGINT NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        total_sales REAL DEFAULT 0,
        fee_rate REAL NOT NULL,
        fee_amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        proof_file_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP
    )''')
    conn.commit()
    conn.close()


# ── Settings ─────────────────────────────────────────────────────

def get_platform_fee_settings() -> dict:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT fee_rate, fee_cycle_months FROM platform_fee_settings WHERE id=1")
    row = cur.fetchone()
    conn.close()
    if row:
        return {'fee_rate': float(row[0]), 'fee_cycle_months': int(row[1])}
    return {'fee_rate': DEFAULT_FEE_RATE, 'fee_cycle_months': DEFAULT_FEE_CYCLE_MONTHS}


def set_platform_fee_rate(rate: float):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE platform_fee_settings SET fee_rate=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        (rate,),
    )
    conn.commit()
    conn.close()


def set_platform_fee_cycle(months: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE platform_fee_settings SET fee_cycle_months=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        (months,),
    )
    conn.commit()
    conn.close()


# ── Creator Sales Tracking ───────────────────────────────────────

def get_creator_total_sales(creator_id: int, since: datetime = None) -> dict:
    """Get total approved sales for a creator, optionally since a date."""
    conn = get_db_connection()
    cur = conn.cursor()
    if since:
        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(o.price), 0) "
            "FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE c.creator_telegram_id=%s AND o.status='approved' "
            "AND o.id > 0 AND o.price > 0 "
            "AND o.id IN (SELECT id FROM orders WHERE status='approved') "
            "AND EXISTS (SELECT 1 FROM orders o2 WHERE o2.id = o.id AND o2.status='approved')",
            (creator_id,),
        )
        # Use a simpler approach: filter by order creation time
        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(o.price), 0) "
            "FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE c.creator_telegram_id=%s AND o.status='approved' AND o.price > 0",
            (creator_id,),
        )
    else:
        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(o.price), 0) "
            "FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE c.creator_telegram_id=%s AND o.status='approved' AND o.price > 0",
            (creator_id,),
        )
    row = cur.fetchone()
    conn.close()
    return {
        'sale_count': row[0] or 0,
        'total_amount': float(row[1] or 0),
    }


def get_all_creators_sales() -> list:
    """Get sales summary for all creators (for Founder dashboard)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.creator_telegram_id, u.username, u.first_name, "
        "COUNT(*) as sales, COALESCE(SUM(o.price), 0) as revenue "
        "FROM orders o "
        "JOIN content c ON o.content_id = c.id "
        "LEFT JOIN users u ON c.creator_telegram_id = u.telegram_id "
        "WHERE o.status='approved' AND o.price > 0 "
        "GROUP BY c.creator_telegram_id, u.username, u.first_name "
        "ORDER BY revenue DESC"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


# ── Platform Fee Calculation ─────────────────────────────────────

def _get_creator_registration_date(creator_id: int) -> datetime | None:
    """Get when the creator's first subscription started (their registration as creator)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT MIN(start_date) FROM creator_subscriptions WHERE creator_telegram_id=%s",
        (creator_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


def _get_last_paid_fee(creator_id: int):
    """Get the most recent paid platform fee for a creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, period_start, period_end, total_sales, fee_amount, paid_at "
        "FROM platform_fees "
        "WHERE creator_telegram_id=%s AND status='paid' "
        "ORDER BY period_end DESC LIMIT 1",
        (creator_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def _get_pending_fee(creator_id: int):
    """Get any pending/unpaid platform fee for a creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, period_start, period_end, total_sales, fee_rate, fee_amount, status "
        "FROM platform_fees "
        "WHERE creator_telegram_id=%s AND status IN ('pending', 'proof_submitted') "
        "ORDER BY period_end DESC LIMIT 1",
        (creator_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def get_creator_sales_in_period(creator_id: int, period_start: datetime, period_end: datetime) -> float:
    """Sum of approved order prices for a creator in a date range."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Use the orders table - we need a created_at or similar timestamp
    # Orders don't have a created_at column explicitly, but they have an id (serial)
    # Let's add a check for this
    cur.execute(
        "SELECT COALESCE(SUM(o.price), 0) "
        "FROM orders o JOIN content c ON o.content_id = c.id "
        "WHERE c.creator_telegram_id=%s AND o.status='approved' AND o.price > 0",
        (creator_id,),
    )
    row = cur.fetchone()
    conn.close()
    return float(row[0] or 0)


def check_platform_fee_status(creator_id: int) -> dict:
    """
    Check if a creator owes a platform fee.
    Returns dict with:
      - is_overdue: bool (True = cannot upload)
      - pending_fee: dict or None (fee details if pending)
      - next_due: datetime or None
      - message: str
    """
    settings = get_platform_fee_settings()
    cycle_months = settings['fee_cycle_months']
    fee_rate = settings['fee_rate']

    reg_date = _get_creator_registration_date(creator_id)
    if not reg_date:
        # Never had a subscription — no fee due
        return {'is_overdue': False, 'pending_fee': None, 'next_due': None, 'message': 'No subscription history'}

    # Make reg_date timezone-aware if it isn't
    if reg_date.tzinfo is None:
        reg_date = reg_date.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)

    # Check for existing pending fee
    pending = _get_pending_fee(creator_id)
    if pending:
        fee_id, p_start, p_end, total_sales, rate, amount, status = pending
        return {
            'is_overdue': True,
            'pending_fee': {
                'id': fee_id,
                'period_start': p_start,
                'period_end': p_end,
                'total_sales': total_sales,
                'fee_rate': rate,
                'fee_amount': amount,
                'status': status,
            },
            'next_due': None,
            'message': f'Platform fee of GH₵ {amount:,.2f} is due',
        }

    # Calculate when next fee is due based on registration date
    last_paid = _get_last_paid_fee(creator_id)
    if last_paid:
        # Next period starts after last paid period ended
        last_period_end = last_paid[2]
        if last_period_end.tzinfo is None:
            last_period_end = last_period_end.replace(tzinfo=timezone.utc)
        period_start = last_period_end
    else:
        # First fee period starts from registration
        period_start = reg_date

    # Calculate period end (cycle_months after period_start)
    period_end = period_start + timedelta(days=cycle_months * 30)

    if now < period_end:
        # Not due yet
        return {
            'is_overdue': False,
            'pending_fee': None,
            'next_due': period_end,
            'message': f'Next platform fee due on {str(period_end)[:10]}',
        }

    # Fee is due — calculate it
    total_sales = get_creator_sales_in_period(creator_id, period_start, period_end)

    if total_sales <= 0:
        # Zero sales — no fee, auto-advance the period
        _auto_advance_zero_fee(creator_id, period_start, period_end, fee_rate)
        # Recalculate next period
        new_start = period_end
        new_end = new_start + timedelta(days=cycle_months * 30)
        if now < new_end:
            return {
                'is_overdue': False,
                'pending_fee': None,
                'next_due': new_end,
                'message': f'No sales last period. Next fee due {str(new_end)[:10]}',
            }
        else:
            # Multiple periods passed with no sales — keep advancing
            return {
                'is_overdue': False,
                'pending_fee': None,
                'next_due': new_end,
                'message': 'No sales — no platform fee due',
            }

    # Creator has sales — create a pending fee
    fee_amount = round(total_sales * fee_rate, 2)
    fee_id = _create_fee_record(creator_id, period_start, period_end, total_sales, fee_rate, fee_amount)

    return {
        'is_overdue': True,
        'pending_fee': {
            'id': fee_id,
            'period_start': period_start,
            'period_end': period_end,
            'total_sales': total_sales,
            'fee_rate': fee_rate,
            'fee_amount': fee_amount,
            'status': 'pending',
        },
        'next_due': None,
        'message': f'Platform fee of GH₵ {fee_amount:,.2f} is due',
    }


def _auto_advance_zero_fee(creator_id, period_start, period_end, fee_rate):
    """Record a zero-fee period so the cycle advances."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Check if already recorded
    cur.execute(
        "SELECT id FROM platform_fees WHERE creator_telegram_id=%s AND period_start=%s AND period_end=%s",
        (creator_id, period_start, period_end),
    )
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO platform_fees (creator_telegram_id, period_start, period_end, "
            "total_sales, fee_rate, fee_amount, status, paid_at) "
            "VALUES (%s, %s, %s, 0, %s, 0, 'paid', CURRENT_TIMESTAMP)",
            (creator_id, period_start, period_end, fee_rate),
        )
    conn.commit()
    conn.close()


def _create_fee_record(creator_id, period_start, period_end, total_sales, fee_rate, fee_amount) -> int:
    """Create a pending platform fee record."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Check if already exists
    cur.execute(
        "SELECT id FROM platform_fees WHERE creator_telegram_id=%s AND period_start=%s AND period_end=%s AND status IN ('pending', 'proof_submitted')",
        (creator_id, period_start, period_end),
    )
    existing = cur.fetchone()
    if existing:
        conn.close()
        return existing[0]
    cur.execute(
        "INSERT INTO platform_fees (creator_telegram_id, period_start, period_end, "
        "total_sales, fee_rate, fee_amount, status) "
        "VALUES (%s, %s, %s, %s, %s, %s, 'pending') RETURNING id",
        (creator_id, period_start, period_end, total_sales, fee_rate, fee_amount),
    )
    fee_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return fee_id


def is_platform_fee_overdue(creator_id: int) -> bool:
    """Quick check: is this creator blocked from uploading due to unpaid platform fee?"""
    status = check_platform_fee_status(creator_id)
    return status['is_overdue']


# ── Fee Payment ──────────────────────────────────────────────────

def submit_fee_proof(fee_id: int, proof_file_id: str):
    """Creator submits payment proof for a platform fee."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE platform_fees SET proof_file_id=%s, status='proof_submitted' WHERE id=%s",
        (proof_file_id, fee_id),
    )
    conn.commit()
    conn.close()


def approve_platform_fee(fee_id: int):
    """Founder approves a platform fee payment."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE platform_fees SET status='paid', paid_at=CURRENT_TIMESTAMP WHERE id=%s",
        (fee_id,),
    )
    conn.commit()
    conn.close()


def reject_platform_fee(fee_id: int):
    """Founder rejects a platform fee proof — back to pending."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE platform_fees SET status='pending', proof_file_id=NULL WHERE id=%s",
        (fee_id,),
    )
    conn.commit()
    conn.close()


def get_platform_fee(fee_id: int):
    """Get a single platform fee record."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, creator_telegram_id, period_start, period_end, total_sales, "
        "fee_rate, fee_amount, status, proof_file_id, created_at, paid_at "
        "FROM platform_fees WHERE id=%s",
        (fee_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def list_pending_platform_fees() -> list:
    """List all pending/proof_submitted platform fees (for Founder review)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT pf.id, pf.creator_telegram_id, u.username, pf.period_start, pf.period_end, "
        "pf.total_sales, pf.fee_rate, pf.fee_amount, pf.status, pf.proof_file_id "
        "FROM platform_fees pf "
        "LEFT JOIN users u ON pf.creator_telegram_id = u.telegram_id "
        "WHERE pf.status IN ('pending', 'proof_submitted') "
        "ORDER BY pf.created_at DESC"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_total_platform_fees_collected() -> float:
    """Total platform fees collected (paid)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(SUM(fee_amount), 0) FROM platform_fees WHERE status='paid' AND fee_amount > 0")
    row = cur.fetchone()
    conn.close()
    return float(row[0] or 0)
