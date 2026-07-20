from core.db import get_db_connection


def list_pending_creator_applications():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_id, username FROM users WHERE creator_application_status='pending' ORDER BY telegram_id"
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def approve_creator(telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET role='creator', creator_application_status='approved' WHERE telegram_id=%s",
        (telegram_id,),
    )
    conn.commit()
    conn.close()


def set_payment_required(telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET creator_application_status='payment_required' WHERE telegram_id=%s",
        (telegram_id,),
    )
    conn.commit()
    conn.close()


def reject_creator(telegram_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET role='user', creator_application_status='rejected' WHERE telegram_id=%s",
        (telegram_id,),
    )
    conn.commit()
    conn.close()
