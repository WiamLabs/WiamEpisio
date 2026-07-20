from core.db import get_db_connection


def ensure_subscription_proofs_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS subscription_proofs (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            plan TEXT NOT NULL,
            proof_file_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    conn.close()


def create_sub_proof(user_id: int, plan: str, proof_file_id: str) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO subscription_proofs (user_id, plan, proof_file_id, status) "
        "VALUES (%s, %s, %s, 'pending') RETURNING id",
        (user_id, plan, proof_file_id),
    )
    proof_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return proof_id


def get_pending_sub_proof(user_id: int):
    """Return the pending subscription proof for a user, or None."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, plan, proof_file_id, status, created_at "
        "FROM subscription_proofs WHERE user_id=%s AND status='pending' "
        "ORDER BY id DESC LIMIT 1",
        (user_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def get_sub_proof(proof_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, user_id, plan, proof_file_id, status, created_at "
        "FROM subscription_proofs WHERE id=%s",
        (proof_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def list_pending_sub_proofs(limit: int = 20, offset: int = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT sp.id, sp.user_id, sp.plan, sp.proof_file_id, sp.status, sp.created_at, "
        "u.username "
        "FROM subscription_proofs sp "
        "LEFT JOIN users u ON sp.user_id = u.telegram_id "
        "WHERE sp.status='pending' ORDER BY sp.id DESC LIMIT %s OFFSET %s",
        (limit, offset),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def count_pending_sub_proofs() -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM subscription_proofs WHERE status='pending'")
    count = cur.fetchone()[0]
    conn.close()
    return count


def update_sub_proof_status(proof_id: int, status: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE subscription_proofs SET status=%s WHERE id=%s",
        (status, proof_id),
    )
    conn.commit()
    conn.close()
