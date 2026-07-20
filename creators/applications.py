from core.db import get_db_connection


def ensure_creator_application_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_application_status TEXT DEFAULT 'none'"
    )
    cur.execute(
        "UPDATE users SET creator_application_status='pending', role='user' WHERE role='creator_pending'"
    )
    conn.commit()
    conn.close()


def apply_for_creator(telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET creator_application_status='pending' WHERE telegram_id=%s AND role <> 'creator'",
        (telegram_id,),
    )
    conn.commit()
    conn.close()


def get_creator_application_status(telegram_id: int) -> str:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT creator_application_status FROM users WHERE telegram_id=%s",
        (telegram_id,),
    )
    row = cur.fetchone()
    conn.close()
    return (row[0] if row and row[0] else "none")
