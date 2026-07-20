from datetime import datetime, timezone, timedelta

from core.db import get_db_connection


def can_user_access_content(user_id: int, content_id: int) -> bool:
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, access_type, end_date, status FROM access "
        "WHERE user_id=%s AND content_id=%s AND status='active' "
        "ORDER BY id DESC LIMIT 1",
        (user_id, content_id),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return False
    _, access_type, end_date, status = row
    if access_type == 'permanent':
        return True
    if access_type == 'temporary' and end_date:
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        if end_date > now:
            return True
    return False


def get_user_access(user_id: int, content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, access_type, start_date, end_date, status FROM access "
        "WHERE user_id=%s AND content_id=%s AND status='active' "
        "ORDER BY id DESC LIMIT 1",
        (user_id, content_id),
    )
    row = cur.fetchone()
    conn.close()
    return row


def grant_permanent_access(user_id: int, content_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    now = datetime.now(timezone.utc)
    cur.execute(
        "INSERT INTO access (user_id, content_id, access_type, start_date, status) "
        "VALUES (%s, %s, 'permanent', %s, 'active') RETURNING id",
        (user_id, content_id, now),
    )
    access_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return access_id


def grant_temporary_access(user_id: int, content_id: int, days: int) -> tuple:
    conn = get_db_connection()
    cur = conn.cursor()
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=days)
    cur.execute(
        "INSERT INTO access (user_id, content_id, access_type, start_date, end_date, status) "
        "VALUES (%s, %s, 'temporary', %s, %s, 'active') RETURNING id",
        (user_id, content_id, now, end_date),
    )
    access_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return access_id, end_date


def expire_old_access():
    now = datetime.now(timezone.utc)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE access SET status='expired' "
        "WHERE access_type='temporary' AND status='active' AND end_date <= %s",
        (now,),
    )
    conn.commit()
    conn.close()


def ensure_access_notification_column():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE access ADD COLUMN IF NOT EXISTS expiry_notified BOOLEAN DEFAULT FALSE")
    conn.commit()
    conn.close()


def get_expiring_soon_access(hours_before: int = 24) -> list:
    """Returns list of (user_id, content_id, end_date, title) for temporary access expiring within hours_before."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=hours_before)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT a.user_id, a.content_id, a.end_date, c.title "
        "FROM access a JOIN content c ON a.content_id = c.id "
        "WHERE a.access_type='temporary' AND a.status='active' "
        "AND a.end_date > %s AND a.end_date <= %s "
        "AND (a.expiry_notified IS NULL OR a.expiry_notified = FALSE)",
        (now, cutoff),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def mark_access_expiry_notified(user_id: int, content_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE access SET expiry_notified = TRUE "
        "WHERE user_id=%s AND content_id=%s AND access_type='temporary' AND status='active'",
        (user_id, content_id),
    )
    conn.commit()
    conn.close()
