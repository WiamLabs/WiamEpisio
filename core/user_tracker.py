from datetime import datetime, timezone
import os
from core.db import get_db_connection


def ensure_user_tracking_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'private'")
    conn.commit()
    conn.close()


def upsert_user(telegram_id: int, username: str | None, first_name: str | None = None, last_name: str | None = None, source: str = 'private'):
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (telegram_id, username, first_name, last_name, role, date_joined, last_active, source) "
        "VALUES (%s, %s, %s, %s, 'user', %s, %s, %s) "
        "ON CONFLICT (telegram_id) DO UPDATE SET "
        "username=EXCLUDED.username, first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name, "
        "last_active=EXCLUDED.last_active",
        (telegram_id, username, first_name, last_name, now, now, source),
    )

    founder_raw = os.getenv("FOUNDER_TELEGRAM_ID", "").strip()
    try:
        founder_id = int(founder_raw)
    except ValueError:
        founder_id = None
    if founder_id is not None and telegram_id == founder_id:
        cur.execute(
            "UPDATE users SET role='founder' WHERE telegram_id=%s AND role <> 'founder'",
            (telegram_id,),
        )
    conn.commit()
    conn.close()
    return now
