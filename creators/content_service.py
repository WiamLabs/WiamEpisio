from core.db import get_db_connection


def ensure_content_owner_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS creator_telegram_id BIGINT")
    conn.commit()
    conn.close()


def ensure_creator_payment_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS momo_number TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_details TEXT")
    conn.commit()
    conn.close()


def get_creator_payment_details(creator_telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT momo_number, bank_details FROM users WHERE telegram_id=%s",
        (creator_telegram_id,),
    )
    row = cur.fetchone()
    conn.close()
    if row:
        return {'momo_number': row[0], 'bank_details': row[1]}
    return {'momo_number': None, 'bank_details': None}


def set_creator_payment_details(creator_telegram_id: int, momo_number: str = None, bank_details: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET momo_number=%s, bank_details=%s WHERE telegram_id=%s",
        (momo_number, bank_details, creator_telegram_id),
    )
    conn.commit()
    conn.close()


def get_book_creator_id(content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT creator_telegram_id FROM content WHERE id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def ensure_book_product_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS author TEXT")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS description TEXT")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS genre TEXT")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS cover_file_id TEXT")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS pdf_file_id TEXT")

    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_buy_now REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_1_day REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_2_days REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_3_days REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_4_days REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_5_days REAL")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS price_30_days REAL")

    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS preview_start_page INTEGER")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS preview_end_page INTEGER")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS preview_file_id TEXT")

    conn.commit()
    conn.close()


def list_creator_content(creator_telegram_id: int, limit: int = 20):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, type, status, views, price "
        "FROM content WHERE creator_telegram_id=%s AND deleted_at IS NULL ORDER BY id DESC LIMIT %s",
        (creator_telegram_id, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_creator_stats(creator_telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*), COALESCE(SUM(views), 0) FROM content WHERE creator_telegram_id=%s AND deleted_at IS NULL",
        (creator_telegram_id,),
    )
    row = cur.fetchone()
    conn.close()
    total = row[0] if row else 0
    views = row[1] if row else 0
    return total, views


def get_creator_content_item(creator_telegram_id: int, content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, type, status, views, price, preview, content "
        "FROM content WHERE id=%s AND creator_telegram_id=%s",
        (content_id, creator_telegram_id),
    )
    row = cur.fetchone()
    conn.close()
    return row


def get_creator_book_detail(creator_telegram_id: int, content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, author, status, views, "
        "price_buy_now, price_1_day, price_2_days, price_3_days, "
        "price_4_days, price_5_days, price_30_days "
        "FROM content WHERE id=%s AND creator_telegram_id=%s",
        (content_id, creator_telegram_id),
    )
    row = cur.fetchone()
    conn.close()
    return row


def update_book_prices(content_id: int, creator_telegram_id: int, prices: dict):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE content SET price_buy_now=%s, price_1_day=%s, price_2_days=%s, "
        "price_3_days=%s, price_4_days=%s, price_5_days=%s, price_30_days=%s "
        "WHERE id=%s AND creator_telegram_id=%s",
        (
            prices.get('buy_now'), prices.get('1_day'), prices.get('2_days'),
            prices.get('3_days'), prices.get('4_days'), prices.get('5_days'),
            prices.get('30_days'), content_id, creator_telegram_id,
        ),
    )
    conn.commit()
    conn.close()
