"""Draft upload storage — lets creators/admins save incomplete uploads and resume later."""

import json
from datetime import datetime, timezone
from core.db import get_db_connection


def ensure_drafts_schema():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS upload_drafts (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        title TEXT,
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()


def save_draft(user_id: int, data: dict) -> int:
    """Save or update a draft. Returns draft id."""
    title = data.get('title', 'Untitled Draft')
    json_data = json.dumps(data, default=str)
    conn = get_db_connection()
    c = conn.cursor()
    # Check if a draft with same title already exists for this user
    c.execute(
        "SELECT id FROM upload_drafts WHERE user_id=%s AND title=%s ORDER BY updated_at DESC LIMIT 1",
        (user_id, title),
    )
    row = c.fetchone()
    if row:
        c.execute(
            "UPDATE upload_drafts SET data=%s, updated_at=%s WHERE id=%s",
            (json_data, datetime.now(timezone.utc), row[0]),
        )
        draft_id = row[0]
    else:
        c.execute(
            "INSERT INTO upload_drafts (user_id, title, data, updated_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (user_id, title, json_data, datetime.now(timezone.utc)),
        )
        draft_id = c.fetchone()[0]
    conn.commit()
    conn.close()
    return draft_id


def list_drafts(user_id: int, limit: int = 20) -> list:
    """Return list of (id, title, updated_at) for a user."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "SELECT id, title, updated_at FROM upload_drafts WHERE user_id=%s ORDER BY updated_at DESC LIMIT %s",
        (user_id, limit),
    )
    rows = c.fetchall()
    conn.close()
    return rows


def load_draft(draft_id: int) -> dict | None:
    """Load a draft's data by id."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT data FROM upload_drafts WHERE id=%s", (draft_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    if isinstance(row[0], str):
        return json.loads(row[0])
    return row[0]


def delete_draft(draft_id: int):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM upload_drafts WHERE id=%s", (draft_id,))
    conn.commit()
    conn.close()


def get_draft_owner(draft_id: int) -> int | None:
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT user_id FROM upload_drafts WHERE id=%s", (draft_id,))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None
