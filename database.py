from core.db import get_db_connection

def create_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        role TEXT DEFAULT 'user',
        creator_application_status TEXT DEFAULT 'none',
        date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source TEXT DEFAULT 'private'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS content (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'book',
        content TEXT,
        preview TEXT,
        author TEXT,
        description TEXT,
        genre TEXT,
        cover_file_id TEXT,
        pdf_file_id TEXT,
        status TEXT DEFAULT 'pending',
        price REAL DEFAULT 0.0,
        price_buy_now REAL,
        price_1_day REAL,
        price_2_days REAL,
        price_3_days REAL,
        price_4_days REAL,
        price_5_days REAL,
        price_30_days REAL,
        views INTEGER DEFAULT 0,
        creator_telegram_id BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(telegram_id),
        FOREIGN KEY (content_id) REFERENCES content(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS access (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        access_type TEXT NOT NULL DEFAULT 'permanent',
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users(telegram_id),
        FOREIGN KEY (content_id) REFERENCES content(id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        content_id INTEGER NOT NULL,
        chat_id BIGINT,
        status TEXT DEFAULT 'awaiting_payment',
        reference_code TEXT,
        payment_method TEXT DEFAULT 'momo',
        FOREIGN KEY (user_id) REFERENCES users(telegram_id),
        FOREIGN KEY (content_id) REFERENCES content(id)
    )''')
    conn.commit()
    conn.close()

if __name__ == "__main__":
    create_db()