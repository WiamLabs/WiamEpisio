import os
from core.db import get_db_connection

ROLE_FOUNDER = "founder"
ROLE_ADMIN = "admin"
ROLE_CREATOR = "creator"
ROLE_USER = "user"


def get_user_role(telegram_id: int) -> str:
    # Founder is always determined by env var — cannot be overridden via DB
    founder_raw = os.getenv("FOUNDER_TELEGRAM_ID", "").strip()
    try:
        if int(founder_raw) == telegram_id:
            return ROLE_FOUNDER
    except ValueError:
        pass
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE telegram_id=%s", (telegram_id,))
    row = cur.fetchone()
    conn.close()
    role = row[0] if row else ROLE_USER
    # Prevent DB from granting founder role to non-env-var users
    if role == ROLE_FOUNDER:
        try:
            if int(founder_raw) != telegram_id:
                return ROLE_ADMIN
        except ValueError:
            return ROLE_ADMIN
    return role


def get_founder_id() -> int | None:
    # Primary source: environment variable (cannot be changed at runtime)
    founder_raw = os.getenv("FOUNDER_TELEGRAM_ID", "").strip()
    try:
        return int(founder_raw)
    except ValueError:
        return None


def get_admin_and_founder_ids() -> list[int]:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT telegram_id FROM users WHERE role IN ('admin', 'founder')")
    rows = cur.fetchall()
    conn.close()
    return [r[0] for r in rows]
