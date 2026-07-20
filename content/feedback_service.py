"""Feedback system — lets all users send feedback/reports to the Founder."""

from datetime import datetime, timezone
from core.db import get_db_connection


def ensure_feedback_schema():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        username TEXT,
        role TEXT,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        screenshot_file_id TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    )''')
    conn.commit()
    conn.close()


def save_feedback(user_id: int, username: str, role: str, category: str,
                  message: str, screenshot_file_id: str = None) -> int:
    """Save a new feedback entry. Returns the feedback id."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO feedback (user_id, username, role, category, message, screenshot_file_id) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (user_id, username, role, category, message, screenshot_file_id),
    )
    fid = c.fetchone()[0]
    conn.commit()
    conn.close()
    return fid


def list_feedback(status: str = 'open', limit: int = 30) -> list:
    """Return list of feedback entries: (id, user_id, username, role, category, message, created_at, status)."""
    conn = get_db_connection()
    c = conn.cursor()
    if status == 'all':
        c.execute(
            "SELECT id, user_id, username, role, category, message, created_at, status "
            "FROM feedback ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )
    else:
        c.execute(
            "SELECT id, user_id, username, role, category, message, created_at, status "
            "FROM feedback WHERE status=%s ORDER BY created_at DESC LIMIT %s",
            (status, limit),
        )
    rows = c.fetchall()
    conn.close()
    return rows


def get_feedback(feedback_id: int) -> dict | None:
    """Get a single feedback entry by id."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "SELECT id, user_id, username, role, category, message, screenshot_file_id, "
        "created_at, status, resolved_at FROM feedback WHERE id=%s",
        (feedback_id,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        'id': row[0], 'user_id': row[1], 'username': row[2], 'role': row[3],
        'category': row[4], 'message': row[5], 'screenshot_file_id': row[6],
        'created_at': row[7], 'status': row[8], 'resolved_at': row[9],
    }


def resolve_feedback(feedback_id: int):
    """Mark a feedback entry as resolved."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "UPDATE feedback SET status='resolved', resolved_at=%s WHERE id=%s",
        (datetime.now(timezone.utc), feedback_id),
    )
    conn.commit()
    conn.close()


def count_open_feedback() -> int:
    """Count the number of open feedback entries."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM feedback WHERE status='open'")
    count = c.fetchone()[0]
    conn.close()
    return count
