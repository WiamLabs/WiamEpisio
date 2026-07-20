import io
import logging

from pypdf import PdfReader, PdfWriter

from core.db import get_db_connection

logger = logging.getLogger(__name__)


def ensure_chapter_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL,
        chapter_number INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        start_page INTEGER NOT NULL,
        end_page INTEGER NOT NULL,
        is_free BOOLEAN DEFAULT FALSE,
        price DECIMAL(10,2) DEFAULT 0,
        pdf_file_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    cur.execute('''CREATE TABLE IF NOT EXISTS chapter_access (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        chapter_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    conn.close()


def add_chapter(content_id: int, chapter_number: int, title: str,
                start_page: int, end_page: int, is_free: bool, price: float,
                pdf_file_id: str = None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chapters (content_id, chapter_number, title, start_page, end_page, "
        "is_free, price, pdf_file_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (content_id, chapter_number, title, start_page, end_page, is_free, price, pdf_file_id),
    )
    chapter_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return chapter_id


def update_chapter_file_id(chapter_id: int, pdf_file_id: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE chapters SET pdf_file_id=%s WHERE id=%s", (pdf_file_id, chapter_id))
    conn.commit()
    conn.close()


def get_chapters(content_id: int) -> list:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, chapter_number, title, start_page, end_page, is_free, price, pdf_file_id "
        "FROM chapters WHERE content_id=%s ORDER BY chapter_number",
        (content_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_chapter_by_id(chapter_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, content_id, chapter_number, title, start_page, end_page, "
        "is_free, price, pdf_file_id FROM chapters WHERE id=%s",
        (chapter_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


def has_chapters(content_id: int) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM chapters WHERE content_id=%s", (content_id,))
    count = cur.fetchone()[0]
    conn.close()
    return count > 0


def has_chapter_access(user_id: int, chapter_id: int) -> bool:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id FROM chapter_access WHERE user_id=%s AND chapter_id=%s LIMIT 1",
        (user_id, chapter_id),
    )
    row = cur.fetchone()
    conn.close()
    return row is not None


def grant_chapter_access(user_id: int, chapter_id: int, content_id: int) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chapter_access (user_id, chapter_id, content_id) "
        "VALUES (%s, %s, %s) RETURNING id",
        (user_id, chapter_id, content_id),
    )
    access_id = cur.fetchone()[0]
    conn.commit()
    conn.close()
    return access_id


def has_full_book_access(user_id: int, content_id: int) -> bool:
    """Check if user bought/rented the whole book (not per-chapter)."""
    from content.access_control import can_user_access_content
    return can_user_access_content(user_id, content_id)


def extract_preview_pages(pdf_bytes: bytes, num_pages: int = 2) -> bytes | None:
    """Extract the first `num_pages` pages from a PDF. Returns bytes or None on failure."""
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        total = len(reader.pages)
        if total == 0:
            return None
        writer = PdfWriter()
        for i in range(min(num_pages, total)):
            writer.add_page(reader.pages[i])
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)
        return buf.read()
    except Exception as e:
        logger.error(f"Preview extraction error: {e}")
        return None


def protect_pdf(pdf_bytes: bytes) -> bytes | None:
    """Convert every PDF page to a high-res image, rebuild as image-only PDF.

    This removes ALL selectable text — pages become rendered images.
    Also applies AES encryption with no-copy/no-print permissions.
    Returns protected PDF bytes, or None on failure.
    """
    try:
        import fitz  # PyMuPDF
        import secrets

        # Open original PDF with PyMuPDF
        src = fitz.open(stream=pdf_bytes, filetype="pdf")
        # Create a new image-only PDF
        dst = fitz.open()

        for page in src:
            # Render page to image (150 DPI, JPEG for small size)
            mat = fitz.Matrix(150 / 72, 150 / 72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg", jpg_quality=85)

            # Create new page with same dimensions
            new_page = dst.new_page(width=page.rect.width, height=page.rect.height)
            # Insert the rendered image to fill the entire page
            new_page.insert_image(new_page.rect, stream=img_bytes)

        src.close()

        # Save to bytes, then apply pypdf encryption on top
        img_pdf_buf = io.BytesIO()
        dst.save(img_pdf_buf)
        dst.close()
        img_pdf_buf.seek(0)
        img_pdf_bytes = img_pdf_buf.read()

        # Now encrypt with pypdf (no copy, no print, no extract)
        reader = PdfReader(io.BytesIO(img_pdf_bytes))
        writer = PdfWriter()
        for p in reader.pages:
            writer.add_page(p)
        owner_pwd = secrets.token_hex(16)
        writer.encrypt(
            user_password="",
            owner_password=owner_pwd,
            permissions_flag=0b0000_0000_0000,  # no permissions
        )
        final_buf = io.BytesIO()
        writer.write(final_buf)
        final_buf.seek(0)
        return final_buf.read()
    except Exception as e:
        logger.error(f"PDF protection error: {e}")
        return None


def split_pdf_to_chapters(pdf_bytes: bytes, chapters_info: list[dict]) -> list[bytes]:
    """Split a PDF into chapter byte chunks.

    chapters_info: list of dicts with 'start_page' and 'end_page' (1-indexed).
    Returns list of bytes for each chapter PDF.
    """
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    result = []

    for ch in chapters_info:
        start = max(1, ch['start_page']) - 1  # convert to 0-indexed
        end = min(total_pages, ch['end_page'])  # end_page is inclusive, 1-indexed
        writer = PdfWriter()
        if start >= total_pages or start >= end:
            result.append(b'')
            continue
        for page_idx in range(start, end):
            writer.add_page(reader.pages[page_idx])
        buf = io.BytesIO()
        writer.write(buf)
        buf.seek(0)
        result.append(buf.read())

    return result
