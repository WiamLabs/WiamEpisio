from core.db import get_db_connection

DEFAULT_COMMISSION_RATE = 0.30  # 30% default when enabled


def ensure_commission_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        creator_id BIGINT NOT NULL,
        buyer_id BIGINT NOT NULL,
        total_price REAL NOT NULL,
        platform_cut REAL NOT NULL,
        creator_cut REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Commission settings: enabled (bool), rate (float 0-1)
    cur.execute('''CREATE TABLE IF NOT EXISTS commission_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN DEFAULT FALSE,
        rate REAL DEFAULT 0.30,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    # Ensure default row exists (OFF by default)
    cur.execute("SELECT id FROM commission_settings WHERE id=1")
    if not cur.fetchone():
        cur.execute("INSERT INTO commission_settings (id, enabled, rate) VALUES (1, FALSE, 0.30)")
    conn.commit()
    conn.close()


def is_commission_enabled() -> bool:
    """Check if commission system is ON."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT enabled FROM commission_settings WHERE id=1")
    row = cur.fetchone()
    conn.close()
    return bool(row[0]) if row else False


def get_commission_rate() -> float:
    """Get current commission percentage (0.0 - 1.0)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT rate FROM commission_settings WHERE id=1")
    row = cur.fetchone()
    conn.close()
    return float(row[0]) if row else DEFAULT_COMMISSION_RATE


def get_commission_settings() -> dict:
    """Get full commission settings."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT enabled, rate FROM commission_settings WHERE id=1")
    row = cur.fetchone()
    conn.close()
    if row:
        return {'enabled': bool(row[0]), 'rate': float(row[1])}
    return {'enabled': False, 'rate': DEFAULT_COMMISSION_RATE}


def set_commission_enabled(enabled: bool):
    """Toggle commission ON/OFF."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE commission_settings SET enabled=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        (enabled,),
    )
    conn.commit()
    conn.close()


def set_commission_rate(rate: float):
    """Set commission percentage (0.0 - 1.0)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE commission_settings SET rate=%s, updated_at=CURRENT_TIMESTAMP WHERE id=1",
        (rate,),
    )
    conn.commit()
    conn.close()


def record_commission(order_id: int, content_id: int, creator_id: int,
                      buyer_id: int, total_price: float) -> tuple[float, float]:
    """Record commission split. Only records if commission is enabled.
    Returns (platform_cut, creator_cut)."""
    if not is_commission_enabled():
        # Commission OFF — creator gets 100%
        return 0.0, total_price
    rate = get_commission_rate()
    platform_cut = round(total_price * rate, 2)
    creator_cut = round(total_price - platform_cut, 2)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO commissions (order_id, content_id, creator_id, buyer_id, "
        "total_price, platform_cut, creator_cut) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (order_id, content_id, creator_id, buyer_id, total_price,
         platform_cut, creator_cut),
    )
    conn.commit()
    conn.close()
    return platform_cut, creator_cut


def get_creator_earnings(creator_id: int) -> dict:
    """Get total earnings for a creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_price), 0), "
        "COALESCE(SUM(creator_cut), 0), COALESCE(SUM(platform_cut), 0) "
        "FROM commissions WHERE creator_id=%s",
        (creator_id,),
    )
    row = cur.fetchone()
    conn.close()
    return {
        'total_sales': row[0] or 0,
        'total_revenue': float(row[1] or 0),
        'creator_earnings': float(row[2] or 0),
        'platform_fees': float(row[3] or 0),
    }


def get_platform_earnings() -> dict:
    """Get total platform earnings (Founder view)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*), COALESCE(SUM(total_price), 0), "
        "COALESCE(SUM(platform_cut), 0), COALESCE(SUM(creator_cut), 0) "
        "FROM commissions"
    )
    row = cur.fetchone()
    conn.close()
    return {
        'total_sales': row[0] or 0,
        'total_revenue': float(row[1] or 0),
        'platform_earnings': float(row[2] or 0),
        'paid_to_creators': float(row[3] or 0),
    }


def get_top_creators(limit: int = 10) -> list:
    """Get top creators by revenue."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.creator_id, u.username, u.first_name, "
        "COUNT(*) as sales, SUM(c.total_price) as revenue, "
        "SUM(c.creator_cut) as creator_earned, SUM(c.platform_cut) as platform_earned "
        "FROM commissions c "
        "LEFT JOIN users u ON c.creator_id = u.telegram_id "
        "GROUP BY c.creator_id, u.username, u.first_name "
        "ORDER BY revenue DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows
