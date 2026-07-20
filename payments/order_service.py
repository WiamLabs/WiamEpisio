import uuid

from core.db import get_db_connection


def ensure_orders_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference_code TEXT")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'momo'")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS chat_id BIGINT")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'permanent'")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS rent_days INTEGER")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS price REAL")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS proof_file_id TEXT")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS chapter_id INTEGER")
    conn.commit()
    conn.close()


def create_order(user_id: int, content_id: int, chat_id: int | None,
                 payment_method: str = "momo", access_type: str = "permanent",
                 rent_days: int | None = None, price: float | None = None) -> tuple[int, str]:
    reference_code = uuid.uuid4().hex[:10].upper()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO orders (user_id, content_id, chat_id, status, reference_code, "
        "payment_method, access_type, rent_days, price) "
        "VALUES (%s, %s, %s, 'awaiting_payment', %s, %s, %s, %s, %s) RETURNING id",
        (user_id, content_id, chat_id, reference_code, payment_method,
         access_type, rent_days, price),
    )
    order_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return order_id, reference_code


def attach_proof(order_id: int, proof_file_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE orders SET proof_file_id=%s, status='pending_review' WHERE id=%s",
        (proof_file_id, order_id),
    )
    conn.commit()
    conn.close()


def list_orders(status: str | None = None, limit: int = 10, offset: int = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    if status:
        cur.execute(
            "SELECT o.id, o.user_id, o.content_id, o.status, o.reference_code, "
            "o.payment_method, o.access_type, o.rent_days, o.price, o.proof_file_id, "
            "c.title, u.username "
            "FROM orders o "
            "LEFT JOIN content c ON o.content_id = c.id "
            "LEFT JOIN users u ON o.user_id = u.telegram_id "
            "WHERE o.status=%s ORDER BY o.id DESC LIMIT %s OFFSET %s",
            (status, limit, offset),
        )
    else:
        cur.execute(
            "SELECT o.id, o.user_id, o.content_id, o.status, o.reference_code, "
            "o.payment_method, o.access_type, o.rent_days, o.price, o.proof_file_id, "
            "c.title, u.username "
            "FROM orders o "
            "LEFT JOIN content c ON o.content_id = c.id "
            "LEFT JOIN users u ON o.user_id = u.telegram_id "
            "ORDER BY o.id DESC LIMIT %s OFFSET %s",
            (limit, offset),
        )
    rows = cur.fetchall()
    conn.close()
    return rows


def count_orders(status: str | None = None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    if status:
        cur.execute("SELECT COUNT(*) FROM orders WHERE status=%s", (status,))
    else:
        cur.execute("SELECT COUNT(*) FROM orders")
    count = cur.fetchone()[0]
    conn.close()
    return count


def update_order_status(order_id: int, status: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE orders SET status=%s WHERE id=%s", (status, order_id))
    conn.commit()
    conn.close()


def get_order(order_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, content_id, chat_id, status, reference_code, "
        "payment_method, access_type, rent_days, price, proof_file_id "
        "FROM orders WHERE id=%s",
        (order_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def list_creator_orders(creator_id: int, status: str | None = None, limit: int = 10, offset: int = 0):
    """List orders for books owned by a specific creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    if status:
        cur.execute(
            "SELECT o.id, o.user_id, o.content_id, o.status, o.reference_code, "
            "o.payment_method, o.access_type, o.rent_days, o.price, o.proof_file_id, "
            "c.title, u.username "
            "FROM orders o "
            "JOIN content c ON o.content_id = c.id "
            "LEFT JOIN users u ON o.user_id = u.telegram_id "
            "WHERE c.creator_telegram_id=%s AND o.status=%s ORDER BY o.id DESC LIMIT %s OFFSET %s",
            (creator_id, status, limit, offset),
        )
    else:
        cur.execute(
            "SELECT o.id, o.user_id, o.content_id, o.status, o.reference_code, "
            "o.payment_method, o.access_type, o.rent_days, o.price, o.proof_file_id, "
            "c.title, u.username "
            "FROM orders o "
            "JOIN content c ON o.content_id = c.id "
            "LEFT JOIN users u ON o.user_id = u.telegram_id "
            "WHERE c.creator_telegram_id=%s ORDER BY o.id DESC LIMIT %s OFFSET %s",
            (creator_id, limit, offset),
        )
    rows = cur.fetchall()
    conn.close()
    return rows


def count_creator_orders(creator_id: int, status: str | None = None) -> int:
    """Count orders for books owned by a specific creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    if status:
        cur.execute(
            "SELECT COUNT(*) FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE c.creator_telegram_id=%s AND o.status=%s",
            (creator_id, status),
        )
    else:
        cur.execute(
            "SELECT COUNT(*) FROM orders o JOIN content c ON o.content_id = c.id "
            "WHERE c.creator_telegram_id=%s",
            (creator_id,),
        )
    count = cur.fetchone()[0]
    conn.close()
    return count


def get_order_creator_id(order_id: int) -> int | None:
    """Get the creator_telegram_id for the book in a given order."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.creator_telegram_id FROM orders o "
        "JOIN content c ON o.content_id = c.id WHERE o.id=%s",
        (order_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row and row[0] else None


def get_user_pending_order(user_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, content_id, reference_code FROM orders "
        "WHERE user_id=%s AND status='awaiting_payment' "
        "ORDER BY id DESC LIMIT 1",
        (user_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row
