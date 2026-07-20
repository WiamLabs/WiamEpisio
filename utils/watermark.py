"""Dynamic PDF watermarking: username/user_id, date, 'WiamApp' on every page."""

import io
from datetime import datetime, timezone

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color


def watermark_pdf(pdf_bytes: bytes, username: str, user_id: int) -> bytes:
    """Add a diagonal watermark to every page of the PDF.
    Watermark text: 'WiamApp | @username (user_id) | date'
    Returns watermarked PDF bytes.
    """
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    wm_text = f"WiamApp | @{username} ({user_id}) | {date_str}"

    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()

    for page in reader.pages:
        # Get page dimensions
        box = page.mediabox
        pw = float(box.width)
        ph = float(box.height)

        # Create watermark overlay
        wm_buf = io.BytesIO()
        c = canvas.Canvas(wm_buf, pagesize=(pw, ph))
        c.setFont("Helvetica", 10)
        c.setFillColor(Color(0.6, 0.6, 0.6, alpha=0.3))

        # Bottom-right corner watermark
        c.saveState()
        c.translate(pw - 20, 15)
        c.rotate(0)
        c.drawRightString(0, 0, wm_text)
        c.restoreState()

        # Diagonal center watermark (subtle)
        c.saveState()
        c.translate(pw / 2, ph / 2)
        c.rotate(45)
        c.setFont("Helvetica", 28)
        c.setFillColor(Color(0.85, 0.85, 0.85, alpha=0.15))
        c.drawCentredString(0, 0, "WiamApp")
        c.restoreState()

        c.save()
        wm_buf.seek(0)

        # Merge watermark with original page
        wm_page = PdfReader(wm_buf).pages[0]
        page.merge_page(wm_page)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
