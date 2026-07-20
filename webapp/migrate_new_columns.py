"""
Run this once to add new columns to the existing 'content' table
and create the new web-only tables.

Usage: python -m webapp.migrate_new_columns
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.db import get_db_connection


def migrate():
    conn = get_db_connection()
    c = conn.cursor()

    # --- Add new columns to 'content' table (idempotent) ---
    alter_statements = [
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'pdf'",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS allow_download BOOLEAN DEFAULT TRUE",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS generated_pdf_file_id TEXT",
        "ALTER TABLE content ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
    ]
    for stmt in alter_statements:
        try:
            c.execute(stmt)
            print(f"  OK: {stmt[:60]}...")
        except Exception as e:
            print(f"  SKIP: {stmt[:60]}... ({e})")
            conn.rollback()

    # --- Add 'status' column to 'users' if missing ---
    try:
        c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'")
        print("  OK: users.status column")
    except Exception as e:
        print(f"  SKIP: users.status ({e})")
        conn.rollback()

    # --- Create new web-only tables ---
    c.execute('''CREATE TABLE IF NOT EXISTS w_book_content (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL,
        chapter_number INTEGER DEFAULT 1,
        chapter_title TEXT NOT NULL DEFAULT 'Chapter 1',
        body TEXT NOT NULL DEFAULT '',
        word_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(content_id, chapter_number)
    )''')
    print("  OK: w_book_content table")

    c.execute('''CREATE TABLE IF NOT EXISTS w_reading_progress (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        current_chapter INTEGER DEFAULT 1,
        current_position INTEGER DEFAULT 0,
        total_chapters INTEGER DEFAULT 1,
        last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, content_id)
    )''')
    print("  OK: w_reading_progress table")

    c.execute('''CREATE TABLE IF NOT EXISTS w_reader_preferences (
        user_id BIGINT PRIMARY KEY,
        theme TEXT DEFAULT 'light',
        font_size TEXT DEFAULT 'medium',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    print("  OK: w_reader_preferences table")

    # --- Create index on w_book_content.content_id ---
    try:
        c.execute("CREATE INDEX IF NOT EXISTS idx_wbc_content_id ON w_book_content(content_id)")
        print("  OK: index on w_book_content.content_id")
    except Exception as e:
        print(f"  SKIP: index ({e})")
        conn.rollback()

    # --- Add current_paragraph column to w_reading_progress ---
    try:
        c.execute("ALTER TABLE w_reading_progress ADD COLUMN IF NOT EXISTS current_paragraph INTEGER DEFAULT 0")
        print("  OK: w_reading_progress.current_paragraph column")
    except Exception as e:
        print(f"  SKIP: w_reading_progress.current_paragraph ({e})")
        conn.rollback()

    conn.commit()
    conn.close()
    print("\nMigration complete!")


if __name__ == '__main__':
    migrate()
