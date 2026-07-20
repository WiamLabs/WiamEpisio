"""Audio service: TTS generation, translation, voice management, and caching."""

import io
import logging
import asyncio

import edge_tts
from deep_translator import GoogleTranslator

from core.db import get_db_connection

logger = logging.getLogger(__name__)

# ─── Supported Languages & Voices ───────────────────────────────────────────

LANGUAGES = {
    "en": {"name": "English", "flag": "🇬🇧"},
    "fr": {"name": "French",  "flag": "🇫🇷"},
    "es": {"name": "Spanish", "flag": "🇪🇸"},
    "pt": {"name": "Portuguese", "flag": "🇧🇷"},
    "ar": {"name": "Arabic",  "flag": "🇸🇦"},
    "de": {"name": "German",  "flag": "🇩🇪"},
    "zh": {"name": "Chinese", "flag": "🇨🇳"},
}

VOICES = {
    # English
    "en_aria":   {"name": "Aria",   "gender": "Female", "lang": "en", "tts_id": "en-US-AriaNeural"},
    "en_jenny":  {"name": "Jenny",  "gender": "Female", "lang": "en", "tts_id": "en-US-JennyNeural"},
    "en_guy":    {"name": "Guy",    "gender": "Male",   "lang": "en", "tts_id": "en-US-GuyNeural"},
    "en_andrew": {"name": "Andrew", "gender": "Male",   "lang": "en", "tts_id": "en-US-AndrewNeural"},
    # French
    "fr_denise": {"name": "Denise", "gender": "Female", "lang": "fr", "tts_id": "fr-FR-DeniseNeural"},
    "fr_henri":  {"name": "Henri",  "gender": "Male",   "lang": "fr", "tts_id": "fr-FR-HenriNeural"},
    # Spanish
    "es_elvira": {"name": "Elvira", "gender": "Female", "lang": "es", "tts_id": "es-ES-ElviraNeural"},
    "es_alvaro": {"name": "Alvaro", "gender": "Male",   "lang": "es", "tts_id": "es-ES-AlvaroNeural"},
    # Portuguese
    "pt_francisca": {"name": "Francisca", "gender": "Female", "lang": "pt", "tts_id": "pt-BR-FranciscaNeural"},
    "pt_antonio":   {"name": "Antonio",   "gender": "Male",   "lang": "pt", "tts_id": "pt-BR-AntonioNeural"},
    # Arabic
    "ar_zariyah": {"name": "Zariyah", "gender": "Female", "lang": "ar", "tts_id": "ar-SA-ZariyahNeural"},
    "ar_hamed":   {"name": "Hamed",   "gender": "Male",   "lang": "ar", "tts_id": "ar-SA-HamedNeural"},
    # German
    "de_katja":  {"name": "Katja",  "gender": "Female", "lang": "de", "tts_id": "de-DE-KatjaNeural"},
    "de_conrad": {"name": "Conrad", "gender": "Male",   "lang": "de", "tts_id": "de-DE-ConradNeural"},
    # Chinese
    "zh_xiaoxiao": {"name": "Xiaoxiao", "gender": "Female", "lang": "zh", "tts_id": "zh-CN-XiaoxiaoNeural"},
    "zh_yunyang":  {"name": "Yunyang",  "gender": "Male",   "lang": "zh", "tts_id": "zh-CN-YunyangNeural"},
}


def get_voices_for_language(lang_code: str) -> dict:
    """Return {voice_key: voice_info} for a specific language."""
    return {k: v for k, v in VOICES.items() if v["lang"] == lang_code}


# ─── DB Schema ───────────────────────────────────────────────────────────────

def ensure_audio_schema():
    """Create audio-related tables if they don't exist."""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""CREATE TABLE IF NOT EXISTS chapter_text (
        id SERIAL PRIMARY KEY,
        chapter_id INTEGER NOT NULL UNIQUE,
        original_text TEXT NOT NULL
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS audio_cache (
        id SERIAL PRIMARY KEY,
        chapter_id INTEGER NOT NULL,
        lang VARCHAR(5) NOT NULL,
        voice_key VARCHAR(30) NOT NULL,
        telegram_file_id TEXT NOT NULL,
        UNIQUE(chapter_id, lang, voice_key)
    )""")

    cur.execute("""CREATE TABLE IF NOT EXISTS user_audio_prefs (
        user_id BIGINT PRIMARY KEY,
        default_lang VARCHAR(5) NOT NULL DEFAULT 'en',
        default_voice VARCHAR(30) NOT NULL DEFAULT 'en_aria'
    )""")

    # Also store full-book text for books without chapters
    cur.execute("""CREATE TABLE IF NOT EXISTS book_text (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL UNIQUE,
        original_text TEXT NOT NULL
    )""")

    # Book language and translation permission columns
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en'")
    cur.execute("ALTER TABLE content ADD COLUMN IF NOT EXISTS allow_translation BOOLEAN DEFAULT FALSE")

    # Cache for translated PDFs
    cur.execute("""CREATE TABLE IF NOT EXISTS translated_pdf_cache (
        id SERIAL PRIMARY KEY,
        content_id INTEGER NOT NULL,
        lang VARCHAR(5) NOT NULL,
        telegram_file_id TEXT NOT NULL,
        UNIQUE(content_id, lang)
    )""")

    conn.commit()
    conn.close()
    logger.info("Audio schema ensured.")


# ─── Text Storage ────────────────────────────────────────────────────────────

def store_chapter_text(chapter_id: int, text: str):
    """Store extracted text for a chapter."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chapter_text (chapter_id, original_text) VALUES (%s, %s) "
        "ON CONFLICT (chapter_id) DO UPDATE SET original_text = EXCLUDED.original_text",
        (chapter_id, text),
    )
    conn.commit()
    conn.close()


def store_book_text(content_id: int, text: str):
    """Store extracted text for a full book (no chapters)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO book_text (content_id, original_text) VALUES (%s, %s) "
        "ON CONFLICT (content_id) DO UPDATE SET original_text = EXCLUDED.original_text",
        (content_id, text),
    )
    conn.commit()
    conn.close()


def get_chapter_text(chapter_id: int) -> str | None:
    """Retrieve stored text for a chapter."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT original_text FROM chapter_text WHERE chapter_id=%s", (chapter_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def get_book_text(content_id: int) -> str | None:
    """Retrieve stored text for a full book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT original_text FROM book_text WHERE content_id=%s", (content_id,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


# ─── Text Extraction from PDF ───────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF using PyMuPDF."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text.strip()


def extract_text_from_pages(pdf_bytes: bytes, start_page: int, end_page: int) -> str:
    """Extract text from specific pages (1-indexed, inclusive)."""
    import fitz
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for i in range(max(0, start_page - 1), min(len(doc), end_page)):
        text += doc[i].get_text() + "\n"
    doc.close()
    return text.strip()


# ─── Translation ─────────────────────────────────────────────────────────────

def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text to the target language using Google Translate (free).

    Handles long text by splitting into chunks of 4500 chars.
    """
    if not text or not text.strip():
        return ""

    # Map our lang codes to Google Translate codes
    lang_map = {
        "en": "en", "fr": "fr", "es": "es", "pt": "pt",
        "ar": "ar", "de": "de", "zh": "zh-CN",
    }
    target = lang_map.get(target_lang, target_lang)

    try:
        # Split long text into chunks (Google Translate limit ~5000 chars)
        chunks = _split_text(text, max_len=4500)
        translated_chunks = []
        translator = GoogleTranslator(source=source_lang, target=target)
        for chunk in chunks:
            result = translator.translate(chunk)
            if result:
                translated_chunks.append(result)
        return "\n".join(translated_chunks)
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return text  # Return original on failure


def _split_text(text: str, max_len: int = 4500) -> list[str]:
    """Split text into chunks, trying to break at sentence boundaries."""
    if len(text) <= max_len:
        return [text]
    chunks = []
    current = ""
    for sentence in text.replace("\n", "\n ").split(". "):
        if len(current) + len(sentence) + 2 > max_len:
            if current:
                chunks.append(current)
            current = sentence
        else:
            current = current + ". " + sentence if current else sentence
    if current:
        chunks.append(current)
    return chunks


# ─── TTS Generation ─────────────────────────────────────────────────────────

async def generate_audio(text: str, voice_key: str) -> bytes | None:
    """Generate MP3 audio from text using Edge TTS.

    Returns MP3 bytes or None on failure.
    """
    voice_info = VOICES.get(voice_key)
    if not voice_info:
        logger.error(f"Unknown voice key: {voice_key}")
        return None

    if not text or not text.strip():
        return None

    try:
        tts = edge_tts.Communicate(text, voice_info["tts_id"])
        buf = io.BytesIO()
        async for chunk in tts.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
        audio_bytes = buf.read()
        if len(audio_bytes) < 100:
            logger.warning("Generated audio too small, likely empty.")
            return None
        return audio_bytes
    except Exception as e:
        logger.error(f"TTS generation error: {e}")
        return None


# ─── Audio Cache ─────────────────────────────────────────────────────────────

def get_cached_audio(chapter_id: int, lang: str, voice_key: str) -> str | None:
    """Get cached Telegram file_id for a chapter+lang+voice combo."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_file_id FROM audio_cache "
        "WHERE chapter_id=%s AND lang=%s AND voice_key=%s",
        (chapter_id, lang, voice_key),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def cache_audio(chapter_id: int, lang: str, voice_key: str, file_id: str):
    """Cache the Telegram file_id for a chapter+lang+voice combo."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO audio_cache (chapter_id, lang, voice_key, telegram_file_id) "
        "VALUES (%s, %s, %s, %s) "
        "ON CONFLICT (chapter_id, lang, voice_key) DO UPDATE SET telegram_file_id = EXCLUDED.telegram_file_id",
        (chapter_id, lang, voice_key, file_id),
    )
    conn.commit()
    conn.close()


# ─── User Preferences ───────────────────────────────────────────────────────

def get_user_audio_prefs(user_id: int) -> tuple[str, str]:
    """Get user's default language and voice. Returns (lang, voice_key)."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT default_lang, default_voice FROM user_audio_prefs WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return row[0], row[1]
    return "en", "en_aria"  # defaults


def set_user_audio_prefs(user_id: int, lang: str, voice_key: str):
    """Save user's preferred language and voice."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO user_audio_prefs (user_id, default_lang, default_voice) "
        "VALUES (%s, %s, %s) "
        "ON CONFLICT (user_id) DO UPDATE SET default_lang = EXCLUDED.default_lang, "
        "default_voice = EXCLUDED.default_voice",
        (user_id, lang, voice_key),
    )
    conn.commit()
    conn.close()


# ─── Translated PDF Generation ─────────────────────────────────────────────

def generate_translated_pdf(pdf_bytes: bytes, target_lang: str, source_lang: str = "auto") -> bytes | None:
    """Generate a translated PDF preserving images.

    Strategy: extract text per page, translate, build a new PDF with
    translated text and original images placed in their original positions.
    """
    import fitz  # PyMuPDF

    try:
        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        new_doc = fitz.open()

        for page_num in range(len(src_doc)):
            src_page = src_doc[page_num]
            new_page = new_doc.new_page(
                width=src_page.rect.width,
                height=src_page.rect.height,
            )

            # 1. Copy images from original page
            for img in src_page.get_images(full=True):
                xref = img[0]
                try:
                    img_data = src_doc.extract_image(xref)
                    if img_data and img_data.get("image"):
                        img_rects = src_page.get_image_rects(xref)
                        for rect in img_rects:
                            new_page.insert_image(rect, stream=img_data["image"])
                except Exception:
                    pass

            # 2. Extract text blocks and translate
            blocks = src_page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in blocks:
                if block.get("type") != 0:  # skip non-text blocks
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        orig_text = span.get("text", "").strip()
                        if not orig_text:
                            continue
                        # Translate the span text
                        try:
                            translated = translate_text(orig_text, target_lang, source_lang)
                        except Exception:
                            translated = orig_text

                        # Insert translated text at original position
                        font_size = span.get("size", 11)
                        origin = fitz.Point(span["origin"][0], span["origin"][1])
                        try:
                            new_page.insert_text(
                                origin,
                                translated,
                                fontsize=min(font_size, 14),
                                fontname="helv",
                            )
                        except Exception:
                            pass

        result = new_doc.tobytes()
        new_doc.close()
        src_doc.close()
        return result
    except Exception as e:
        logger.error(f"Translated PDF generation error: {e}")
        return None


# ─── Translated PDF Cache ──────────────────────────────────────────────────

def get_cached_translated_pdf(content_id: int, lang: str) -> str | None:
    """Get cached Telegram file_id for a translated PDF."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT telegram_file_id FROM translated_pdf_cache "
        "WHERE content_id=%s AND lang=%s",
        (content_id, lang),
    )
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None


def cache_translated_pdf(content_id: int, lang: str, file_id: str):
    """Cache the Telegram file_id for a translated PDF."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO translated_pdf_cache (content_id, lang, telegram_file_id) "
        "VALUES (%s, %s, %s) "
        "ON CONFLICT (content_id, lang) DO UPDATE SET telegram_file_id = EXCLUDED.telegram_file_id",
        (content_id, lang, file_id),
    )
    conn.commit()
    conn.close()
