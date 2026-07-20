from core.db import get_db_connection


def ensure_creator_profile_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS creator_profiles (
            telegram_id BIGINT PRIMARY KEY,
            pen_name TEXT NOT NULL,
            bio TEXT,
            country TEXT,
            profile_pic_file_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS country TEXT")
    conn.commit()
    conn.close()


def save_creator_profile(telegram_id: int, pen_name: str, bio: str, profile_pic_file_id: str = None, country: str = None):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """INSERT INTO creator_profiles (telegram_id, pen_name, bio, profile_pic_file_id, country)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (telegram_id)
           DO UPDATE SET pen_name=EXCLUDED.pen_name, bio=EXCLUDED.bio,
                         profile_pic_file_id=EXCLUDED.profile_pic_file_id,
                         country=EXCLUDED.country,
                         updated_at=CURRENT_TIMESTAMP""",
        (telegram_id, pen_name, bio, profile_pic_file_id, country),
    )
    conn.commit()
    conn.close()


def get_creator_profile(telegram_id: int) -> dict | None:
    """Returns dict with pen_name, bio, profile_pic_file_id, country or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT pen_name, bio, profile_pic_file_id, country FROM creator_profiles WHERE telegram_id=%s",
        (telegram_id,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        'pen_name': row[0],
        'bio': row[1],
        'profile_pic_file_id': row[2],
        'country': row[3],
    }


def update_creator_field(telegram_id: int, field: str, value):
    """Update a single field on the creator profile."""
    allowed = {'pen_name', 'bio', 'profile_pic_file_id', 'country'}
    if field not in allowed:
        return False
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE creator_profiles SET {field}=%s, updated_at=CURRENT_TIMESTAMP WHERE telegram_id=%s",
        (value, telegram_id),
    )
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def get_creator_pen_name(telegram_id: int) -> str | None:
    """Quick lookup for pen name only."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT pen_name FROM creator_profiles WHERE telegram_id=%s", (telegram_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def get_creator_stats(telegram_id: int) -> dict:
    """Get creator stats: book count, average rating, total ratings, followers."""
    conn = get_db_connection()
    cur = conn.cursor()
    # Book count (approved only)
    cur.execute(
        "SELECT COUNT(*) FROM content WHERE creator_telegram_id=%s AND status IN ('approved','ongoing','complete')",
        (telegram_id,),
    )
    book_count = cur.fetchone()[0] or 0
    # Average rating across all creator's books
    cur.execute(
        "SELECT COUNT(r.id), COALESCE(AVG(r.rating), 0) FROM ratings r "
        "JOIN content c ON r.content_id = c.id "
        "WHERE c.creator_telegram_id=%s",
        (telegram_id,),
    )
    row = cur.fetchone()
    total_ratings = row[0] or 0
    avg_rating = round(float(row[1] or 0), 1)
    # Follower count
    cur.execute("SELECT COUNT(*) FROM follows WHERE creator_id=%s", (telegram_id,))
    followers = cur.fetchone()[0] or 0
    conn.close()
    return {
        'book_count': book_count,
        'total_ratings': total_ratings,
        'avg_rating': avg_rating,
        'followers': followers,
    }
