from core.db import get_db_connection


def ensure_deletion_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
    conn.commit()
    conn.close()


def soft_delete_book(content_id: int, creator_id: int = None) -> bool:
    """Soft-delete a book (sets deleted_at). If creator_id given, verifies ownership."""
    conn = get_db_connection()
    cur = conn.cursor()
    if creator_id:
        cur.execute(
            "UPDATE content SET deleted_at=CURRENT_TIMESTAMP "
            "WHERE id=%s AND creator_telegram_id=%s AND deleted_at IS NULL",
            (content_id, creator_id),
        )
    else:
        cur.execute(
            "UPDATE content SET deleted_at=CURRENT_TIMESTAMP "
            "WHERE id=%s AND deleted_at IS NULL",
            (content_id,),
        )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def restore_book(content_id: int, creator_id: int = None) -> bool:
    """Restore a soft-deleted book."""
    conn = get_db_connection()
    cur = conn.cursor()
    if creator_id:
        cur.execute(
            "UPDATE content SET deleted_at=NULL "
            "WHERE id=%s AND creator_telegram_id=%s AND deleted_at IS NOT NULL",
            (content_id, creator_id),
        )
    else:
        cur.execute(
            "UPDATE content SET deleted_at=NULL "
            "WHERE id=%s AND deleted_at IS NOT NULL",
            (content_id,),
        )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def permanent_delete_book(content_id: int, creator_id: int = None) -> bool:
    """Permanently delete a book and all related data."""
    conn = get_db_connection()
    cur = conn.cursor()

    # Verify ownership if creator_id given
    if creator_id:
        cur.execute(
            "SELECT id FROM content WHERE id=%s AND creator_telegram_id=%s",
            (content_id, creator_id),
        )
        if not cur.fetchone():
            conn.close()
            return False

    # Delete related data in order
    cur.execute("DELETE FROM chapter_access WHERE content_id=%s", (content_id,))
    cur.execute("DELETE FROM chapters WHERE content_id=%s", (content_id,))
    cur.execute("DELETE FROM access WHERE content_id=%s", (content_id,))
    cur.execute("DELETE FROM favorites WHERE content_id=%s", (content_id,))
    cur.execute("DELETE FROM orders WHERE content_id=%s", (content_id,))
    cur.execute("DELETE FROM content WHERE id=%s", (content_id,))

    conn.commit()
    conn.close()
    return True


def list_deleted_books(creator_id: int, limit: int = 20):
    """List soft-deleted books for a creator."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, status, deleted_at "
        "FROM content WHERE creator_telegram_id=%s AND deleted_at IS NOT NULL "
        "ORDER BY deleted_at DESC LIMIT %s",
        (creator_id, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def list_all_deleted_books(limit: int = 50):
    """List all soft-deleted books (Founder view)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT c.id, c.title, c.creator_telegram_id, u.username, c.deleted_at "
        "FROM content c "
        "LEFT JOIN users u ON c.creator_telegram_id = u.telegram_id "
        "WHERE c.deleted_at IS NOT NULL "
        "ORDER BY c.deleted_at DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def remove_favorite(user_id: int, content_id: int) -> bool:
    """Remove a book from user's favorites."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM favorites WHERE user_id=%s AND content_id=%s",
        (user_id, content_id),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def cancel_order(order_id: int, user_id: int) -> bool:
    """Cancel a pending order (user can only cancel their own awaiting_payment orders)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM orders WHERE id=%s AND user_id=%s AND status='awaiting_payment'",
        (order_id, user_id),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def founder_delete_order(order_id: int) -> bool:
    """Founder can delete any order."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM orders WHERE id=%s", (order_id,))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0
