from core.db import get_db_connection


def ensure_payment_evidence_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_evidence (
            id SERIAL PRIMARY KEY,
            evidence_type TEXT NOT NULL,
            order_id INTEGER,
            buyer_id BIGINT NOT NULL,
            buyer_username TEXT,
            buyer_name TEXT,
            book_title TEXT,
            amount REAL,
            proof_file_id TEXT,
            proof_sent_at TIMESTAMP DEFAULT NOW(),
            action TEXT,
            acted_by BIGINT,
            acted_at TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def save_evidence(
    evidence_type: str,
    order_id: int,
    buyer_id: int,
    buyer_username: str | None,
    buyer_name: str | None,
    book_title: str | None,
    amount: float | None,
    proof_file_id: str | None,
    action: str,
    acted_by: int,
) -> int:
    """Save a payment evidence record after approve/reject."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO payment_evidence "
        "(evidence_type, order_id, buyer_id, buyer_username, buyer_name, "
        "book_title, amount, proof_file_id, action, acted_by, acted_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()) RETURNING id",
        (evidence_type, order_id, buyer_id, buyer_username, buyer_name,
         book_title, amount, proof_file_id, action, acted_by),
    )
    eid = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return eid


def get_evidence(evidence_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, evidence_type, order_id, buyer_id, buyer_username, buyer_name, "
        "book_title, amount, proof_file_id, proof_sent_at, action, acted_by, acted_at "
        "FROM payment_evidence WHERE id=%s",
        (evidence_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def list_evidence(evidence_type: str | None = None, limit: int = 20, offset: int = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    if evidence_type:
        cur.execute(
            "SELECT id, evidence_type, order_id, buyer_id, buyer_username, buyer_name, "
            "book_title, amount, proof_file_id, proof_sent_at, action, acted_by, acted_at "
            "FROM payment_evidence WHERE evidence_type=%s ORDER BY id DESC LIMIT %s OFFSET %s",
            (evidence_type, limit, offset),
        )
    else:
        cur.execute(
            "SELECT id, evidence_type, order_id, buyer_id, buyer_username, buyer_name, "
            "book_title, amount, proof_file_id, proof_sent_at, action, acted_by, acted_at "
            "FROM payment_evidence ORDER BY id DESC LIMIT %s OFFSET %s",
            (limit, offset),
        )
    rows = cur.fetchall()
    conn.close()
    return rows
