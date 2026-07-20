import os
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, InputMediaPhoto
from telegram.ext import ContextTypes

from core.db import get_db_connection

WEB_BASE = os.environ.get('APP_URL', 'https://wiamapp.fly.dev').rstrip('/')
from content.chapter_service import (
    get_chapters, get_chapter_by_id, has_chapters,
    has_chapter_access, has_full_book_access, grant_chapter_access,
    protect_pdf,
)

BOOKS_PER_PAGE = 20

TRENDING_ORDER = (
    "(COALESCE(c.views, 0) "
    "+ COALESCE((SELECT COUNT(*) FROM favorites f WHERE f.content_id = c.id), 0) * 3 "
    "+ COALESCE((SELECT COUNT(*) FROM ratings r WHERE r.content_id = c.id), 0) * 5 "
    "+ COALESCE((SELECT COUNT(*) FROM access a WHERE a.content_id = c.id AND a.access_type = 'temporary'), 0) * 4 "
    "+ COALESCE((SELECT COUNT(*) FROM access a WHERE a.content_id = c.id AND a.access_type = 'permanent'), 0) * 6"
    ") DESC"
)


def get_books(offset: int = 0, limit: int = BOOKS_PER_PAGE, genre: str | None = None,
              order_by: str = 'id DESC'):
    conn = get_db_connection()
    cur = conn.cursor()
    sql_order = TRENDING_ORDER if order_by == 'trending' else order_by
    if genre:
        cur.execute(
            f"SELECT c.id, c.title, c.author, c.description, c.genre, c.cover_file_id, "
            f"c.price_buy_now, c.price_1_day, c.views, c.created_at "
            f"FROM content c WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL AND c.genre=%s "
            f"ORDER BY {sql_order} LIMIT %s OFFSET %s",
            (genre, limit, offset),
        )
    else:
        cur.execute(
            f"SELECT c.id, c.title, c.author, c.description, c.genre, c.cover_file_id, "
            f"c.price_buy_now, c.price_1_day, c.views, c.created_at "
            f"FROM content c WHERE c.status IN ('approved','ongoing','complete') AND c.deleted_at IS NULL "
            f"ORDER BY {sql_order} LIMIT %s OFFSET %s",
            (limit, offset),
        )
    rows = cur.fetchall()
    conn.close()
    return rows


def count_books(genre: str | None = None) -> int:
    conn = get_db_connection()
    cur = conn.cursor()
    if genre:
        cur.execute("SELECT COUNT(*) FROM content WHERE status IN ('approved','ongoing','complete') AND deleted_at IS NULL AND genre=%s", (genre,))
    else:
        cur.execute("SELECT COUNT(*) FROM content WHERE status IN ('approved','ongoing','complete') AND deleted_at IS NULL")
    row = cur.fetchone()
    conn.close()
    return row[0] if row else 0


def search_books(query: str, limit: int = 10) -> list:
    """Search books by title or author (case-insensitive)."""
    conn = get_db_connection()
    cur = conn.cursor()
    q = f"%{query}%"
    cur.execute(
        "SELECT id, title, author, description, genre, cover_file_id, "
        "price_buy_now, price_1_day, views, created_at "
        "FROM content WHERE status IN ('approved','ongoing','complete') AND deleted_at IS NULL "
        "AND (LOWER(title) LIKE LOWER(%s) OR LOWER(author) LIKE LOWER(%s)) "
        "ORDER BY views DESC LIMIT %s",
        (q, q, limit),
    )
    rows = cur.fetchall()
    conn.close()
    return rows


def get_book_by_id(book_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, author, description, genre, cover_file_id, pdf_file_id, "
        "price_buy_now, price_1_day, price_2_days, price_3_days, "
        "price_4_days, price_5_days, price_30_days, views, status, "
        "preview_file_id, preview_start_page, preview_end_page, "
        "COALESCE(language, 'en') AS language, COALESCE(allow_translation, FALSE) AS allow_translation "
        "FROM content WHERE id=%s",
        (book_id,),
    )
    row = cur.fetchone()
    conn.close()
    return row


async def _safe_edit(query, text, reply_markup=None, parse_mode=None):
    """Edit message text, gracefully handling photo messages by deleting and resending."""
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode=parse_mode)
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(text, reply_markup=reply_markup, parse_mode=parse_mode)


def _format_price(val) -> str:
    try:
        v = float(val)
        return f"{v:,.0f}" if v == int(v) else f"{v:,.2f}"
    except (TypeError, ValueError):
        return "N/A"


def _book_card_text(title, author, description, genre, price_buy_now, price_1_day, views,
                    book_id=None, has_access=False, all_prices=None):
    """Build compact book card caption."""
    # ── Title ──
    lines = [f"\U0001f4d6 *{title}*"]
    # ── Author · Genre on one line ──
    meta = []
    if author:
        meta.append(f"\u270d\ufe0f {author}")
    if genre:
        meta.append(f"\U0001f3ad {genre}")
    if meta:
        lines.append(" \u00b7 ".join(meta))
    # ── Short description (max 80 chars) ──
    if description:
        desc = description.strip()
        if len(desc) > 80:
            desc = desc[:77].rstrip() + "..."
        lines.append(f"_{desc}_")
    # ── Pricing ──
    if has_access:
        lines.append("\u2705 *You own this book*")
    elif all_prices:
        if all_prices.get('buy') is not None:
            lines.append(f"\U0001f4b0 *Buy:* GH\u20b5 {_format_price(all_prices['buy'])}")
        day_keys = [('1d', '1d'), ('2d', '2d'), ('3d', '3d'),
                    ('4d', '4d'), ('5d', '5d'), ('30d', '30d')]
        rents = []
        for key, label in day_keys:
            if all_prices.get(key) is not None:
                rents.append(f"{label} GH\u20b5{_format_price(all_prices[key])}")
        if rents:
            lines.append(f"\U0001f4c5 *Rent:* {' \u00b7 '.join(rents)}")
    else:
        parts = []
        if price_buy_now is not None:
            parts.append(f"Buy GH\u20b5{_format_price(price_buy_now)}")
        if price_1_day is not None:
            parts.append(f"From GH\u20b5{_format_price(price_1_day)}/day")
        if parts:
            lines.append(f"\U0001f4b0 {' \u00b7 '.join(parts)}")
    # ── Views + Rating on one line ──
    stats = [f"\U0001f441 {views or 0}"]
    if book_id:
        try:
            from content.ratings import get_book_rating
            info = get_book_rating(book_id)
            if info['count'] > 0:
                stats.append(f"\u2b50 {info['average']}/5 ({info['count']})")
        except Exception:
            pass
    lines.append(" \u00b7 ".join(stats))
    return "\n".join(lines)


def _get_book_creator_tier_features(book_id: int) -> dict:
    """Look up the creator's tier features for a given book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT creator_telegram_id FROM content WHERE id=%s", (book_id,))
    row = cur.fetchone()
    conn.close()
    creator_id = row[0] if row and row[0] else None
    if not creator_id:
        return {'audio': False, 'chapters': False, 'translation': False}
    from creators.subscription_service import can_use_audio, can_use_chapters, can_use_translation
    return {
        'audio': can_use_audio(creator_id),
        'chapters': can_use_chapters(creator_id),
        'translation': can_use_translation(creator_id),
    }


def _book_buttons(book_id: int, user_id: int | None = None):
    from content.access_control import can_user_access_content
    has_access = can_user_access_content(user_id, book_id) if user_id else False
    tier = _get_book_creator_tier_features(book_id)
    read_url = f"{WEB_BASE}/book/{book_id}/read"

    if has_access:
        # User owns this book — link to web reader, no PDF
        row1 = [InlineKeyboardButton("\U0001f4d6 Read on Web", url=read_url)]
        if tier['audio']:
            row1.append(InlineKeyboardButton("\U0001f3a7 Listen", callback_data=f'lbook_{book_id}'))
        buttons = [row1]
        if tier['chapters'] and has_chapters(book_id):
            buttons.append([InlineKeyboardButton("\U0001f4d1 Chapters", callback_data=f'chapters_{book_id}')])
        buttons.append([
            InlineKeyboardButton("\u2b50 Rate", callback_data=f'rate_{book_id}'),
            InlineKeyboardButton("\U0001f4ac Comments", callback_data=f'comments_{book_id}'),
            InlineKeyboardButton("\u2764\ufe0f Favorite", callback_data=f'save_fav_{book_id}'),
        ])
    else:
        # User does NOT own this book — show purchase options only
        buttons = [
            [
                InlineKeyboardButton("\U0001f6d2 Buy Now", callback_data=f'buy_now_{book_id}'),
                InlineKeyboardButton("\U0001f4c5 Choose Days", callback_data=f'choose_days_{book_id}'),
            ],
            [InlineKeyboardButton("\U0001f440 Preview", callback_data=f'preview_{book_id}')],
            [
                InlineKeyboardButton("\u2b50 Rate", callback_data=f'rate_{book_id}'),
                InlineKeyboardButton("\U0001f4ac Comments", callback_data=f'comments_{book_id}'),
                InlineKeyboardButton("\u2764\ufe0f Favorite", callback_data=f'save_fav_{book_id}'),
            ],
        ]
    return buttons


def _carousel_nav(index: int, total: int, prefix: str = 'browse'):
    """Build ◀ [1/N] ▶ navigation row for carousel."""
    if total <= 1:
        return []
    prev_idx = (index - 1) % total
    next_idx = (index + 1) % total
    return [
        InlineKeyboardButton("◀️", callback_data=f'{prefix}_idx_{prev_idx}'),
        InlineKeyboardButton(f"📖 {index + 1}/{total}", callback_data='noop'),
        InlineKeyboardButton("▶️", callback_data=f'{prefix}_idx_{next_idx}'),
    ]


async def browse_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    index = 0
    if '_idx_' in query.data:
        try:
            index = int(query.data.split('_idx_')[1])
        except (IndexError, ValueError):
            index = 0
    await _show_book_carousel(query, index)


async def trending_books_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    index = 0
    if '_idx_' in query.data:
        try:
            index = int(query.data.split('_idx_')[1])
        except (IndexError, ValueError):
            index = 0
    await _show_book_carousel(query, index, order_by='trending', prefix='trending')


async def new_releases_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    index = 0
    if '_idx_' in query.data:
        try:
            index = int(query.data.split('_idx_')[1])
        except (IndexError, ValueError):
            index = 0
    await _show_book_carousel(query, index, order_by='created_at DESC', prefix='new_releases')


async def _show_book_carousel(query, index: int, genre: str | None = None,
                              order_by: str = 'id DESC', prefix: str = 'browse'):
    """Show ONE book at a time with ◀ [1/N] ▶ carousel navigation."""
    total = count_books(genre=genre)
    if total == 0:
        await _safe_edit(query, "No books available yet.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    if index < 0:
        index = 0
    if index >= total:
        index = total - 1

    books = get_books(offset=index, limit=1, genre=genre, order_by=order_by)
    if not books:
        await _safe_edit(query, "No books available yet.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    book = books[0]
    book_id, title, author, description, genre_val, cover_file_id, price_buy_now, price_1_day, views, created_at = book
    caption = _book_card_text(title, author, description, genre_val, price_buy_now, price_1_day, views, book_id=book_id)

    # Build carousel keyboard
    keyboard = []
    nav = _carousel_nav(index, total, prefix=prefix)
    if nav:
        keyboard.append(nav)
    keyboard.append([InlineKeyboardButton("\U0001f4d6 Get Book", callback_data=f'book_{book_id}')])
    list_prefix = f'genre_{genre}' if genre else prefix
    keyboard.append([InlineKeyboardButton("\U0001f4da See All Books", callback_data=f'{list_prefix}_list')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    reply_markup = InlineKeyboardMarkup(keyboard)

    if cover_file_id:
        try:
            await query.message.delete()
            await query.message.chat.send_photo(
                photo=cover_file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, caption, reply_markup=reply_markup, parse_mode='Markdown')


async def browse_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show text list of all books when user taps 'See All Books'."""
    query = update.callback_query
    await query.answer()
    genre = None
    prefix = 'browse'
    data = query.data  # e.g. browse_list, trending_list, genre_Fantasy_list
    if data.startswith('genre_') and data.endswith('_list'):
        genre = data[6:-5]  # strip 'genre_' and '_list'
        prefix = f'genre_{genre}'
    elif data.startswith('trending'):
        prefix = 'trending'
    elif data.startswith('new_releases'):
        prefix = 'new_releases'

    books = get_books(offset=0, limit=BOOKS_PER_PAGE, genre=genre,
                      order_by='trending' if prefix == 'trending' else
                               'created_at DESC' if prefix == 'new_releases' else 'id DESC')
    if not books:
        await _safe_edit(query, "No books available.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    keyboard = []
    for b in books:
        bid, btitle, bauthor, _, _, _, bpbn, _, bviews, _ = b
        label = f"📖 {btitle}"
        if bauthor:
            label += f" — {bauthor}"
        keyboard.append([InlineKeyboardButton(label, callback_data=f'book_{bid}')])
    keyboard.append([InlineKeyboardButton(f"◀️ Back to Carousel", callback_data=f'{prefix}_idx_0')])
    keyboard.append([InlineKeyboardButton("🏠 Back to Menu", callback_data='back_to_menu')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"📚 *All Books* ({len(books)})",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def book_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    await _show_book_detail(query, book_id)


async def _show_book_detail(query, book_id: int):
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    (bid, title, author, description, genre, cover_file_id, pdf_file_id,
     price_buy_now, price_1_day, price_2_days, price_3_days,
     price_4_days, price_5_days, price_30_days, views, status,
     preview_file_id, preview_start_page, preview_end_page) = book[:19]

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE content SET views = views + 1 WHERE id=%s", (book_id,))
    # Get creator info
    cur.execute("SELECT creator_telegram_id FROM content WHERE id=%s", (book_id,))
    cr_row = cur.fetchone()
    conn.commit()
    conn.close()

    # Look up creator profile for pen name and profile pic
    creator_line = ""
    creator_pic_fid = None
    if cr_row and cr_row[0]:
        from creators.profile_service import get_creator_profile
        profile = get_creator_profile(cr_row[0])
        if profile:
            creator_line = f"\n\u270d\ufe0f *{profile['pen_name']}*"
            creator_pic_fid = profile.get('profile_pic_file_id')

    viewer_id = query.from_user.id
    from content.access_control import can_user_access_content
    viewer_has_access = can_user_access_content(viewer_id, book_id)

    # Build all_prices dict for full pricing display
    all_prices = {
        'buy': price_buy_now, '1d': price_1_day, '2d': price_2_days,
        '3d': price_3_days, '4d': price_4_days, '5d': price_5_days, '30d': price_30_days,
    }
    caption = _book_card_text(title, author, description, genre, price_buy_now, price_1_day, views,
                              book_id=bid, has_access=viewer_has_access, all_prices=all_prices)
    if creator_line:
        # Pen name already shown via author field in card — skip duplicate
        pass

    keyboard = []
    # View Creator Profile button at the very top
    if cr_row and cr_row[0]:
        keyboard.append([InlineKeyboardButton("\U0001f464 View Creator Profile", callback_data=f'creator_pub_{cr_row[0]}')])
    keyboard.extend(_book_buttons(book_id, user_id=viewer_id))
    # Add Follow Creator button if book has a creator
    if cr_row and cr_row[0]:
        creator_id = cr_row[0]
        viewer_id = query.from_user.id
        if viewer_id != creator_id:
            try:
                from content.follows import is_following, get_follower_count
                following = is_following(viewer_id, creator_id)
                fc = get_follower_count(creator_id)
                if following:
                    keyboard.append([InlineKeyboardButton(f"\u2705 Following ({fc})", callback_data=f'follow_{creator_id}')])
                else:
                    keyboard.append([InlineKeyboardButton(f"\U0001f514 Follow Creator ({fc})", callback_data=f'follow_{creator_id}')])
            except Exception:
                pass
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    reply_markup = InlineKeyboardMarkup(keyboard)

    if cover_file_id:
        try:
            await query.message.delete()
        except Exception:
            pass
        try:
            await query.message.chat.send_photo(
                photo=cover_file_id,
                caption=caption,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, caption, reply_markup=reply_markup, parse_mode='Markdown')


async def buy_now_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    (bid, title, author, description, genre, cover_file_id, pdf_file_id,
     price_buy_now, *_rest) = book
    price_text = _format_price(price_buy_now) if price_buy_now else "N/A"
    keyboard = [
        [InlineKeyboardButton("MTN MoMo", callback_data=f'pay_momo_buy_{book_id}'),
         InlineKeyboardButton("Bank Transfer", callback_data=f'pay_bank_buy_{book_id}')],
        [InlineKeyboardButton("◀ Back to Book", callback_data=f'book_{book_id}')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"📖 *{title}*\n\n"
        f"💰 Buy Now: GH\u20b5 {price_text}\n"
        f"Access: Permanent + Download\n\n"
        f"Choose payment method:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def choose_days_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    (bid, title, author, description, genre, cover_file_id, pdf_file_id,
     price_buy_now, price_1_day, price_2_days, price_3_days,
     price_4_days, price_5_days, price_30_days, views, status,
     _pf, _ps, _pe, _lang, _allow_trans) = book

    day_options = [
        (1, price_1_day), (2, price_2_days), (3, price_3_days),
        (4, price_4_days), (5, price_5_days), (30, price_30_days),
    ]
    keyboard = []
    for days, price in day_options:
        if price is not None:
            label = f"{days} day{'s' if days > 1 else ''} — GH\u20b5 {_format_price(price)}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f'rent_{book_id}_{days}')])
    keyboard.append([InlineKeyboardButton("◀ Back to Book", callback_data=f'book_{book_id}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"📖 *{title}*\n\n"
        f"Choose rental duration (view-only, no download):",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def rent_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        book_id = int(parts[1])
        days = int(parts[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid selection.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    title = book[1]
    day_price_map = {1: book[8], 2: book[9], 3: book[10], 4: book[11], 5: book[12], 30: book[13]}
    price = day_price_map.get(days)
    price_text = _format_price(price) if price else "N/A"
    keyboard = [
        [InlineKeyboardButton("MTN MoMo", callback_data=f'pay_momo_rent_{book_id}_{days}'),
         InlineKeyboardButton("Bank Transfer", callback_data=f'pay_bank_rent_{book_id}_{days}')],
        [InlineKeyboardButton("◀ Back to Book", callback_data=f'book_{book_id}')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    await _safe_edit(query, 
        f"📖 *{title}*\n\n"
        f"💰 {days} day{'s' if days > 1 else ''}: GH\u20b5 {price_text}\n"
        f"Access: View-only (no download)\n\n"
        f"Choose payment method:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def preview_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send the 5-page preview PDF if available, otherwise show cover + metadata."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    title = book[1]
    author = book[2]
    description = book[3]
    genre = book[4]
    cover_file_id = book[5]
    preview_file_id = book[16]

    keyboard = [
        [InlineKeyboardButton("\U0001f6d2 Buy Now", callback_data=f'buy_now_{book_id}'),
         InlineKeyboardButton("\U0001f4c5 Choose Days", callback_data=f'choose_days_{book_id}')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    # If preview PDF exists, download and protect it before sending
    if preview_file_id:
        caption = f"\U0001f4d6 *{title}* \u2014 Free Preview\n"
        if author:
            caption += f"\u270d\ufe0f {author}\n"
        if genre:
            caption += f"\U0001f3ad {genre}\n"
        caption += f"\n{description or ''}\n"
        caption += "\n_This is a free 5-page preview. Purchase to read the full book._"
        try:
            await query.message.delete()
        except Exception:
            pass
        import io as _io
        send_doc = preview_file_id
        try:
            tg_file = await context.bot.get_file(preview_file_id)
            pdf_bytes = bytes(await tg_file.download_as_bytearray())
            protected = protect_pdf(pdf_bytes)
            if protected:
                buf = _io.BytesIO(protected)
                buf.name = f"{title} - Preview.pdf"
                send_doc = buf
        except Exception:
            pass
        await query.message.chat.send_document(
            document=send_doc,
            caption=caption,
            reply_markup=reply_markup,
            parse_mode='Markdown',
            protect_content=True,
        )
        return

    # Try on-demand generation for old books without preview
    pdf_file_id = book[6]
    if pdf_file_id:
        try:
            import io as _io
            from content.chapter_service import extract_preview_pages
            tg_file = await context.bot.get_file(pdf_file_id)
            pdf_bytes = bytes(await tg_file.download_as_bytearray())
            preview_bytes = extract_preview_pages(pdf_bytes, num_pages=5)
            if preview_bytes:
                chat_id = query.message.chat_id
                tmp_doc = await context.bot.send_document(
                    chat_id=chat_id,
                    document=_io.BytesIO(preview_bytes),
                    filename=f"{title} - Preview.pdf",
                    caption="\U0001f4d6 Generating preview...",
                    disable_notification=True,
                    protect_content=True,
                )
                if tmp_doc.document:
                    new_preview_fid = tmp_doc.document.file_id
                    conn = get_db_connection()
                    cur = conn.cursor()
                    cur.execute("UPDATE content SET preview_file_id=%s WHERE id=%s", (new_preview_fid, book_id))
                    conn.commit()
                    conn.close()
                    try:
                        await tmp_doc.delete()
                    except Exception:
                        pass
                    # Now send properly
                    caption = f"\U0001f4d6 *{title}* \u2014 Free Preview\n"
                    if author:
                        caption += f"\u270d\ufe0f {author}\n"
                    if genre:
                        caption += f"\U0001f3ad {genre}\n"
                    caption += f"\n{description or ''}\n"
                    caption += "\n_This is a free 5-page preview. Purchase to read the full book._"
                    try:
                        await query.message.delete()
                    except Exception:
                        pass
                    # Protect the on-demand preview too
                    send_doc2 = new_preview_fid
                    try:
                        tg_f2 = await context.bot.get_file(new_preview_fid)
                        raw2 = bytes(await tg_f2.download_as_bytearray())
                        prot2 = protect_pdf(raw2)
                        if prot2:
                            buf2 = _io.BytesIO(prot2)
                            buf2.name = f"{title} - Preview.pdf"
                            send_doc2 = buf2
                    except Exception:
                        pass
                    await query.message.chat.send_document(
                        document=send_doc2,
                        caption=caption,
                        reply_markup=reply_markup,
                        parse_mode='Markdown',
                        protect_content=True,
                    )
                    return
        except Exception:
            pass

    # Final fallback: no PDF at all, show text description
    preview_text = f"\U0001f4d6 *{title}* \u2014 Preview\n"
    if author:
        preview_text += f"\u270d\ufe0f {author}\n"
    if genre:
        preview_text += f"\U0001f3ad {genre}\n"
    desc_short = (description or 'No description available.').strip()
    if len(desc_short) > 150:
        desc_short = desc_short[:147].rstrip() + "..."
    preview_text += f"\n{desc_short}\n"
    preview_text += "\n_Preview not available for this book._"

    if cover_file_id:
        try:
            await query.message.delete()
            await query.message.chat.send_photo(
                photo=cover_file_id,
                caption=preview_text,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, preview_text, reply_markup=reply_markup, parse_mode='Markdown')


async def read_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Redirect user to the premium web reader instead of sending PDFs."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    user_id = query.from_user.id
    from content.access_control import can_user_access_content
    if not can_user_access_content(user_id, book_id):
        await _safe_edit(query, 
            "\u26d4 You don't have access to this book.\n\n"
            "Purchase or rent it first.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Buy Now", callback_data=f'buy_now_{book_id}'),
                 InlineKeyboardButton("Choose Days", callback_data=f'choose_days_{book_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    title = book[1]
    cover_file_id = book[5]
    read_url = f"{WEB_BASE}/book/{book_id}/read"

    tier = _get_book_creator_tier_features(book_id)
    buttons = [
        [InlineKeyboardButton("\U0001f4d6 Read on Web", url=read_url)],
    ]
    if tier['audio']:
        buttons.append([InlineKeyboardButton("\U0001f3a7 Listen (Audio)", callback_data=f'lbook_{book_id}')])
    if tier['chapters'] and has_chapters(book_id):
        buttons.append([InlineKeyboardButton("\U0001f4d1 Chapters", callback_data=f'chapters_{book_id}')])
    buttons.append([InlineKeyboardButton("\U0001f4da My Library", callback_data='my_library')])
    buttons.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    try:
        await query.message.delete()
    except Exception:
        pass

    caption = (
        f"\U0001f4d6 *{title}*\n\n"
        "Tap the button below to read this book in our premium web reader.\n"
        "\u2728 Night mode, adjustable fonts, progress tracking & more!"
    )

    if cover_file_id:
        try:
            await query.message.chat.send_photo(
                photo=cover_file_id,
                caption=caption,
                reply_markup=InlineKeyboardMarkup(buttons),
                parse_mode='Markdown',
            )
            return
        except Exception:
            pass
    await query.message.chat.send_message(
        caption,
        reply_markup=InlineKeyboardMarkup(buttons),
        parse_mode='Markdown',
    )


async def _send_book_pdf(query, context, book, access_type, lang=None):
    """Send the original or translated PDF, then show nav buttons."""
    import io as _io
    book_id = book[0]
    title = book[1]
    pdf_file_id = book[6]

    if lang and lang != (book[19] if len(book) > 19 else 'en'):
        # Send translated PDF
        from content.audio_service import (
            generate_translated_pdf, get_cached_translated_pdf,
            cache_translated_pdf, LANGUAGES,
        )
        lang_name = LANGUAGES.get(lang, {}).get('name', lang)
        cached_fid = get_cached_translated_pdf(book_id, lang)
        if cached_fid:
            is_perm = access_type == 'permanent'
            await query.message.chat.send_document(
                document=cached_fid,
                caption=f"\U0001f4d6 *{title}* ({lang_name})\n"
                        f"{'✅ Download enabled.' if is_perm else '⏳ View only.'}",
                parse_mode='Markdown',
                protect_content=not is_perm,
            )
        else:
            status_msg = await query.message.chat.send_message(
                f"⏳ *Generating {lang_name} PDF...*\n_This may take a moment._",
                parse_mode='Markdown',
            )
            try:
                tg_file = await context.bot.get_file(pdf_file_id)
                pdf_bytes = bytes(await tg_file.download_as_bytearray())
                trans_bytes = generate_translated_pdf(pdf_bytes, lang)
                if trans_bytes:
                    is_perm = access_type == 'permanent'
                    if not is_perm:
                        trans_bytes = protect_pdf(trans_bytes) or trans_bytes
                    doc_buf = _io.BytesIO(trans_bytes)
                    doc_buf.name = f"{title} ({lang_name}).pdf"
                    sent = await query.message.chat.send_document(
                        document=doc_buf,
                        caption=f"\U0001f4d6 *{title}* ({lang_name})\n"
                                f"{'✅ Download enabled.' if is_perm else '⏳ View only.'}",
                        parse_mode='Markdown',
                        protect_content=not is_perm,
                    )
                    if sent.document:
                        cache_translated_pdf(book_id, lang, sent.document.file_id)
                else:
                    await query.message.chat.send_message(
                        "⚠️ Translation failed. Sending original instead.")
                    await _send_original_pdf(query, context, book, access_type)
            except Exception:
                await query.message.chat.send_message(
                    "⚠️ Translation failed. Sending original instead.")
                await _send_original_pdf(query, context, book, access_type)
            try:
                await status_msg.delete()
            except Exception:
                pass
    else:
        await _send_original_pdf(query, context, book, access_type)

    # Navigation buttons — tier-aware
    tier = _get_book_creator_tier_features(book_id)
    nav_buttons = []
    nav_row = []
    if tier['chapters']:
        from content.chapter_service import get_chapters
        if get_chapters(book_id):
            nav_row.append(InlineKeyboardButton("\U0001f4d1 Chapters", callback_data=f'chapters_{book_id}'))
    if tier['audio']:
        nav_row.append(InlineKeyboardButton("\U0001f3a7 Listen", callback_data=f'lbook_{book_id}'))
    if nav_row:
        nav_buttons.append(nav_row)
    nav_buttons.append([InlineKeyboardButton("\U0001f4da My Library", callback_data='my_library')])
    nav_buttons.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    await query.message.chat.send_message(
        f"📖 *{title}* — Enjoy your reading!",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(nav_buttons),
    )


async def _send_original_pdf(query, context, book, access_type):
    """Send the original PDF with watermark and appropriate protection."""
    import io as _io
    title = book[1]
    pdf_file_id = book[6]
    user = query.from_user
    username = user.username or user.first_name or str(user.id)
    user_id = user.id

    # Download and watermark the PDF
    watermarked_doc = None
    try:
        tg_file = await context.bot.get_file(pdf_file_id)
        pdf_bytes = bytes(await tg_file.download_as_bytearray())
        from utils.watermark import watermark_pdf
        wm_bytes = watermark_pdf(pdf_bytes, username, user_id)
        if access_type != 'permanent':
            wm_bytes = protect_pdf(wm_bytes) or wm_bytes
        watermarked_doc = _io.BytesIO(wm_bytes)
        watermarked_doc.name = f"{title}.pdf"
    except Exception:
        pass

    if access_type == 'permanent':
        await query.message.chat.send_document(
            document=watermarked_doc if watermarked_doc else pdf_file_id,
            caption=f"\U0001f4d6 *{title}*\n\u2705 Permanent access — download enabled.\n\n_This book is yours._",
            parse_mode='Markdown',
            protect_content=True,
        )
    else:
        await query.message.chat.send_document(
            document=watermarked_doc if watermarked_doc else pdf_file_id,
            caption=f"\U0001f4d6 *{title}*\n\u23f3 Temporary access — view only.",
            parse_mode='Markdown',
            protect_content=True,
        )


async def read_orig_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Redirect to web reader instead of sending PDF."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    user_id = query.from_user.id
    from content.access_control import can_user_access_content
    if not can_user_access_content(user_id, book_id):
        return

    read_url = f"{WEB_BASE}/book/{book_id}/read"
    book = get_book_by_id(book_id)
    title = book[1] if book else "Book"

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"\U0001f4d6 *{title}*\n\nTap below to read on the web:",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f4d6 Read on Web", url=read_url)],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )


async def read_trans_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show language picker for translated PDF."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    user_id = query.from_user.id
    from content.access_control import can_user_access_content
    if not can_user_access_content(user_id, book_id):
        return

    book = get_book_by_id(book_id)
    if not book:
        return
    title = book[1]
    book_lang = book[19] if len(book) > 19 else 'en'

    from content.audio_service import LANGUAGES
    keyboard = []
    for code, info in LANGUAGES.items():
        if code == book_lang:
            continue  # skip the original language
        keyboard.append([InlineKeyboardButton(
            f"{info['flag']} {info['name']}",
            callback_data=f'rtlang_{book_id}_{code}',
        )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data=f'read_book_{book_id}')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"\U0001f30d *{title}*\n\n"
        "Choose a language for the translated PDF:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def read_translang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate and send a translated PDF in the chosen language."""
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        book_id = int(parts[1])
        lang = parts[2]
    except (IndexError, ValueError):
        return

    user_id = query.from_user.id
    from content.access_control import can_user_access_content, get_user_access
    if not can_user_access_content(user_id, book_id):
        return

    book = get_book_by_id(book_id)
    if not book:
        return
    access = get_user_access(user_id, book_id)
    access_type = access[1] if access else 'unknown'

    try:
        await query.message.delete()
    except Exception:
        pass
    await _send_book_pdf(query, context, book, access_type, lang=lang)


async def chapters_list_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show the list of chapters for a book with free/premium indicators."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid book.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    title = book[1]
    chapters = get_chapters(book_id)
    if not chapters:
        await _safe_edit(query, 
            f"\U0001f4d6 *{title}*\n\nNo chapters available.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
            parse_mode='Markdown',
        )
        return

    user_id = query.from_user.id
    user_has_full = has_full_book_access(user_id, book_id)
    tier = _get_book_creator_tier_features(book_id)

    lines = [f"\U0001f4d6 *{title}* — Chapters\n"]
    keyboard = []
    for ch in chapters:
        ch_id, ch_num, ch_title, start_p, end_p, is_free, price, pdf_fid = ch
        if user_has_full or is_free or has_chapter_access(user_id, ch_id):
            icon = "\U0001f513"  # unlocked
            row = [InlineKeyboardButton(f"{icon} Ch.{ch_num}: {ch_title}", callback_data=f'read_ch_{ch_id}')]
            if tier['audio']:
                row.append(InlineKeyboardButton("\U0001f3a7", callback_data=f'lch_{ch_id}'))
            keyboard.append(row)
        else:
            icon = "\U0001f512"  # locked
            price_label = f"GH\u20b5 {float(price):,.0f}" if price else "Premium"
            label = f"{icon} Ch.{ch_num}: {ch_title} — {price_label}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f'buy_ch_{ch_id}')])

    keyboard.append([InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def read_chapter_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Deliver a chapter PDF if the user has access (free, purchased, or full-book access)."""
    query = update.callback_query
    await query.answer()
    try:
        chapter_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid chapter.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        await _safe_edit(query, "Chapter not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    ch_id, content_id, ch_num, ch_title, start_p, end_p, is_free, price, pdf_fid = chapter
    user_id = query.from_user.id

    # Check access: free chapter, full book access, or purchased chapter
    if not (is_free or has_full_book_access(user_id, content_id) or has_chapter_access(user_id, ch_id)):
        price_label = f"GH\u20b5 {float(price):,.0f}" if price else "Premium"
        await _safe_edit(query, 
            f"\U0001f512 *Chapter {ch_num}: {ch_title}*\n\n"
            f"This is a premium chapter.\n"
            f"\U0001f4b0 Price: {price_label}\n\n"
            f"Purchase to unlock.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f4b0 Buy This Chapter", callback_data=f'buy_ch_{ch_id}')],
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
            parse_mode='Markdown',
        )
        return

    if not pdf_fid:
        await _safe_edit(query, 
            "Chapter PDF not available yet.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
        )
        return

    book = get_book_by_id(content_id)
    book_title = book[1] if book else "Book"

    try:
        await query.message.delete()
    except Exception:
        pass

    # Download and apply PDF-level protection (no copy, no print, no extract)
    import io as _io
    protected_doc = None
    try:
        tg_file = await context.bot.get_file(pdf_fid)
        pdf_bytes = bytes(await tg_file.download_as_bytearray())
        protected_bytes = protect_pdf(pdf_bytes)
        if protected_bytes:
            protected_doc = _io.BytesIO(protected_bytes)
            protected_doc.name = f"{book_title} - Ch{ch_num}.pdf"
    except Exception:
        pass

    await query.message.chat.send_document(
        document=protected_doc if protected_doc else pdf_fid,
        caption=(
            f"\U0001f4d6 *{book_title}*\n"
            f"\U0001f4d1 Chapter {ch_num}: {ch_title}\n\n"
            f"{'Free chapter' if is_free else 'Premium chapter — unlocked'}"
        ),
        parse_mode='Markdown',
        protect_content=True,
    )
    # Send navigation back
    await query.message.chat.send_message(
        "Continue reading?",
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f4d1 Back to Chapters", callback_data=f'chapters_{content_id}')],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )


async def buy_chapter_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show payment options for purchasing a premium chapter."""
    query = update.callback_query
    await query.answer()
    try:
        chapter_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid chapter.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        await _safe_edit(query, "Chapter not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    ch_id, content_id, ch_num, ch_title, start_p, end_p, is_free, price, pdf_fid = chapter
    user_id = query.from_user.id

    # Already has access?
    if is_free or has_full_book_access(user_id, content_id) or has_chapter_access(user_id, ch_id):
        await _safe_edit(query, 
            f"\u2705 You already have access to Chapter {ch_num}: {ch_title}!",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f4d6 Read Now", callback_data=f'read_ch_{ch_id}')],
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
        )
        return

    book = get_book_by_id(content_id)
    book_title = book[1] if book else "Book"
    price_label = f"{float(price):,.0f}" if price else "0"

    keyboard = [
        [
            InlineKeyboardButton("MTN MoMo", callback_data=f'pay_momo_chapter_{ch_id}'),
            InlineKeyboardButton("Bank Transfer", callback_data=f'pay_bank_chapter_{ch_id}'),
        ],
        [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
        [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
    ]

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"\U0001f4d6 *{book_title}*\n"
        f"\U0001f4d1 Chapter {ch_num}: *{ch_title}*\n\n"
        f"\U0001f4b0 Price: {price_label}\n"
        f"Access: Permanent (this chapter)\n\n"
        f"Choose payment method:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def back_to_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    from bot import _build_start_keyboard
    user = query.from_user
    keyboard = _build_start_keyboard(user.id)
    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        "📚 WiamApp — Choose what to explore:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def view_creator_profile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show a creator's public profile: pic, pen name, bio, country, followers, rating, book count."""
    query = update.callback_query
    await query.answer()
    try:
        creator_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        return

    from creators.profile_service import get_creator_profile, get_creator_stats
    profile = get_creator_profile(creator_id)
    if not profile:
        await _safe_edit(query, "Creator profile not found.",
                         reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    stats = get_creator_stats(creator_id)
    pen_name = profile.get('pen_name', 'Unknown')
    bio = profile.get('bio', '')
    country = profile.get('country', '')
    pic_fid = profile.get('profile_pic_file_id')

    # Build profile text
    lines = [
        f"\U0001f464 *{pen_name}*",
        "\u2500" * 28,
    ]
    if bio:
        lines.append(f"\U0001f4dd {bio}")
    if country:
        lines.append(f"\U0001f30d {country}")
    lines.append("")
    lines.append(f"\U0001f4da Books: *{stats['book_count']}*")
    lines.append(f"\U0001f465 Followers: *{stats['followers']}*")
    if stats['total_ratings'] > 0:
        lines.append(f"\u2b50 Rating: *{stats['avg_rating']}/5* ({stats['total_ratings']} ratings)")
    else:
        lines.append("\u2b50 Rating: _No ratings yet_")
    lines.append("")
    lines.append("\u2500" * 28)

    text = "\n".join(lines)

    # Buttons
    viewer_id = query.from_user.id
    keyboard = []
    if viewer_id != creator_id:
        try:
            from content.follows import is_following, get_follower_count
            following = is_following(viewer_id, creator_id)
            fc = get_follower_count(creator_id)
            if following:
                keyboard.append([InlineKeyboardButton(f"\u2705 Following ({fc})", callback_data=f'follow_{creator_id}')])
            else:
                keyboard.append([InlineKeyboardButton(f"\U0001f514 Follow ({fc})", callback_data=f'follow_{creator_id}')])
        except Exception:
            pass
    # Show creator's books
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title FROM content WHERE creator_telegram_id=%s AND status IN ('approved','ongoing','complete') ORDER BY id DESC LIMIT 5",
        (creator_id,),
    )
    books = cur.fetchall()
    conn.close()
    if books:
        for bid, btitle in books:
            keyboard.append([InlineKeyboardButton(f"\U0001f4d6 {btitle}", callback_data=f'book_{bid}')])
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])
    reply_markup = InlineKeyboardMarkup(keyboard)

    # Show with profile pic if available
    if pic_fid:
        try:
            await query.message.delete()
        except Exception:
            pass
        try:
            await query.message.chat.send_photo(
                photo=pic_fid,
                caption=text,
                reply_markup=reply_markup,
                parse_mode='Markdown',
                protect_content=True,
            )
            return
        except Exception:
            pass
    await _safe_edit(query, text, reply_markup=reply_markup, parse_mode='Markdown')


# ─── Audio / Listen Callbacks ────────────────────────────────────────────────

async def listen_book_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show language picker for listening to a full book."""
    query = update.callback_query
    await query.answer()
    try:
        book_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    # Tier check — creator must have audio feature
    tier = _get_book_creator_tier_features(book_id)
    if not tier['audio']:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\U0001f3a7 *Audio not available for this book.*\n\n"
            "This feature is not enabled by the creator.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
            parse_mode='Markdown',
        )
        return

    # Access check — must buy or rent first
    user_id = query.from_user.id
    from content.access_control import can_user_access_content
    if not can_user_access_content(user_id, book_id):
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\U0001f3a7 *Audio requires access.*\n\n"
            "Purchase or rent this book first to unlock listening.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\U0001f6d2 Buy Now", callback_data=f'buy_now_{book_id}'),
                 InlineKeyboardButton("\U0001f4c5 Choose Days", callback_data=f'choose_days_{book_id}')],
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
            ]),
            parse_mode='Markdown',
        )
        return

    from content.audio_service import LANGUAGES, get_user_audio_prefs
    default_lang, default_voice = get_user_audio_prefs(user_id)

    keyboard = []
    for code, info in LANGUAGES.items():
        star = " ⭐" if code == default_lang else ""
        keyboard.append([InlineKeyboardButton(
            f"{info['flag']} {info['name']}{star}",
            callback_data=f'lblang_{book_id}_{code}',
        )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        "\U0001f3a7 *Choose a language for listening:*\n\n"
        "The book text will be translated and read aloud in the selected language.\n"
        "⭐ = your default",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def listen_chapter_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show language picker for listening to a chapter."""
    query = update.callback_query
    await query.answer()
    try:
        chapter_id = int(query.data.split('_')[1])
    except (IndexError, ValueError):
        return

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        return
    content_id = chapter[1]
    is_free = chapter[6]

    # Tier check — creator must have audio feature
    tier = _get_book_creator_tier_features(content_id)
    if not tier['audio']:
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\U0001f3a7 *Audio not available for this book.*\n\n"
            "This feature is not enabled by the creator.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
            parse_mode='Markdown',
        )
        return

    # Access check — must have access (free chapter, bought chapter, or full book)
    user_id = query.from_user.id
    if not is_free and not has_full_book_access(user_id, content_id) and not has_chapter_access(user_id, chapter_id):
        try:
            await query.message.delete()
        except Exception:
            pass
        await query.message.chat.send_message(
            "\U0001f3a7 *Audio requires access.*\n\n"
            "Purchase this chapter first to unlock listening.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Buy Chapter", callback_data=f'buy_ch_{chapter_id}')],
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
            parse_mode='Markdown',
        )
        return

    from content.audio_service import LANGUAGES, get_user_audio_prefs
    default_lang, _ = get_user_audio_prefs(user_id)

    keyboard = []
    for code, info in LANGUAGES.items():
        star = " ⭐" if code == default_lang else ""
        keyboard.append([InlineKeyboardButton(
            f"{info['flag']} {info['name']}{star}",
            callback_data=f'llang_{chapter_id}_{code}',
        )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')])

    try:
        await query.message.delete()
    except Exception:
        pass
    await query.message.chat.send_message(
        f"\U0001f3a7 *Ch.{chapter[2]}: {chapter[3]}*\n\n"
        "Choose a language for listening:\n"
        "⭐ = your default",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def listen_book_lang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show voice picker after language selected for a full book."""
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        book_id = int(parts[1])
        lang = parts[2]
    except (IndexError, ValueError):
        return

    from content.audio_service import get_voices_for_language, LANGUAGES, get_user_audio_prefs
    user_id = query.from_user.id
    _, default_voice = get_user_audio_prefs(user_id)
    voices = get_voices_for_language(lang)
    lang_name = LANGUAGES.get(lang, {}).get('name', lang)

    keyboard = []
    for vkey, vinfo in voices.items():
        icon = "\U0001f469" if vinfo['gender'] == 'Female' else "\U0001f468"
        star = " ⭐" if vkey == default_voice else ""
        keyboard.append([InlineKeyboardButton(
            f"{icon} {vinfo['name']} ({vinfo['gender']}){star}",
            callback_data=f'lbvoice_{book_id}_{lang}_{vkey}',
        )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data=f'lbook_{book_id}')])

    await _safe_edit(query, 
        f"\U0001f3a7 *{lang_name}* — Choose a voice:\n"
        "⭐ = your default",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def listen_chapter_lang_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show voice picker after language selected for a chapter."""
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        chapter_id = int(parts[1])
        lang = parts[2]
    except (IndexError, ValueError):
        return

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        return

    from content.audio_service import get_voices_for_language, LANGUAGES, get_user_audio_prefs
    user_id = query.from_user.id
    _, default_voice = get_user_audio_prefs(user_id)
    voices = get_voices_for_language(lang)
    lang_name = LANGUAGES.get(lang, {}).get('name', lang)

    keyboard = []
    for vkey, vinfo in voices.items():
        icon = "\U0001f469" if vinfo['gender'] == 'Female' else "\U0001f468"
        star = " ⭐" if vkey == default_voice else ""
        keyboard.append([InlineKeyboardButton(
            f"{icon} {vinfo['name']} ({vinfo['gender']}){star}",
            callback_data=f'lvoice_{chapter_id}_{lang}_{vkey}',
        )])
    keyboard.append([InlineKeyboardButton("\u25c0 Back", callback_data=f'lch_{chapter_id}')])

    await _safe_edit(query, 
        f"\U0001f3a7 *Ch.{chapter[2]}: {chapter[3]}* — *{lang_name}*\n\n"
        "Choose a voice:\n"
        "⭐ = your default",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown',
    )


async def listen_chapter_voice_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate (or serve cached) audio + translated text for a chapter."""
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        # lvoice_{chapter_id}_{lang}_{voice_key}
        chapter_id = int(parts[1])
        lang = parts[2]
        voice_key = parts[3] + '_' + parts[4]  # e.g. "en" + "_" + "aria" = "en_aria"
    except (IndexError, ValueError):
        return

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        return
    content_id = chapter[1]
    ch_num = chapter[2]
    ch_title = chapter[3]

    user_id = query.from_user.id
    from content.audio_service import (
        get_cached_audio, cache_audio, get_chapter_text, get_book_text,
        extract_text_from_pages, translate_text, generate_audio,
        set_user_audio_prefs, LANGUAGES, VOICES,
    )

    # Save as user's default preference
    set_user_audio_prefs(user_id, lang, voice_key)

    # Check cache first
    cached_fid = get_cached_audio(chapter_id, lang, voice_key)

    await _safe_edit(query, 
        f"\u23f3 *Generating audio...*\n\n"
        f"\U0001f4d1 Ch.{ch_num}: {ch_title}\n"
        f"\U0001f30d {LANGUAGES.get(lang, {}).get('name', lang)} — "
        f"{VOICES.get(voice_key, {}).get('name', voice_key)}",
        parse_mode='Markdown',
    )

    # Get original text
    original_text = get_chapter_text(chapter_id)
    if not original_text:
        # Try on-demand extraction
        try:
            book = get_book_by_id(content_id)
            pdf_file_id = book[6] if book else None
            if pdf_file_id:
                tg_file = await context.bot.get_file(pdf_file_id)
                pdf_bytes = bytes(await tg_file.download_as_bytearray())
                from content.audio_service import extract_text_from_pages, store_chapter_text
                original_text = extract_text_from_pages(
                    pdf_bytes, chapter[4], chapter[5]  # start_page, end_page
                )
                if original_text:
                    store_chapter_text(chapter_id, original_text)
        except Exception:
            pass

    if not original_text:
        await _safe_edit(query, 
            "\u26a0\ufe0f Could not extract text from this chapter for audio.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
        )
        return

    # Translate if needed
    translated_text = translate_text(original_text, lang) if lang != 'en' else original_text

    # Generate or use cached audio
    import io as _io
    if cached_fid:
        audio_doc = cached_fid
    else:
        audio_bytes = await generate_audio(translated_text, voice_key)
        if not audio_bytes:
            await _safe_edit(query, 
                "\u26a0\ufe0f Audio generation failed. Please try again.",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
                ]),
            )
            return
        # Send audio to get file_id, then cache it
        audio_buf = _io.BytesIO(audio_bytes)
        audio_buf.name = f"ch{ch_num}_{lang}.mp3"
        tmp_msg = await context.bot.send_audio(
            chat_id=query.message.chat_id,
            audio=audio_buf,
            title=f"Ch.{ch_num}: {ch_title}",
            performer=f"WiamApp ({LANGUAGES.get(lang, {}).get('name', '')})",
            filename=f"ch{ch_num}_{lang}.mp3",
            disable_notification=True,
            protect_content=True,
            read_timeout=120,
            write_timeout=120,
        )
        if tmp_msg.audio:
            audio_doc = tmp_msg.audio.file_id
            cache_audio(chapter_id, lang, voice_key, audio_doc)
        else:
            audio_doc = None
        try:
            await tmp_msg.delete()
        except Exception:
            pass

    # Delete the "generating" message
    try:
        await query.message.delete()
    except Exception:
        pass

    book = get_book_by_id(content_id)
    book_title = book[1] if book else "Book"
    lang_name = LANGUAGES.get(lang, {}).get('name', lang)
    voice_name = VOICES.get(voice_key, {}).get('name', voice_key)

    # Send the audio
    if audio_doc:
        await query.message.chat.send_audio(
            audio=audio_doc,
            title=f"Ch.{ch_num}: {ch_title}",
            performer=f"WiamApp ({lang_name} - {voice_name})",
            caption=f"\U0001f3a7 *{book_title}* — Ch.{ch_num}: {ch_title}\n\U0001f30d {lang_name} | \U0001f3a4 {voice_name}",
            parse_mode='Markdown',
            protect_content=True,
            read_timeout=120,
            write_timeout=120,
        )

    await query.message.chat.send_message(
        f"\U0001f3a7 *{book_title}* — Ch.{ch_num}: {ch_title}\n"
        f"\U0001f30d {lang_name} | \U0001f3a4 {voice_name}\n\n"
        f"_Audio delivered above._",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f3a7 Listen Again", callback_data=f'lch_{chapter_id}')],
            [InlineKeyboardButton("\U0001f4d1 Back to Chapters", callback_data=f'chapters_{content_id}')],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )


async def listen_book_voice_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Generate (or serve cached) audio + translated text for a full book."""
    query = update.callback_query
    await query.answer()
    try:
        parts = query.data.split('_')
        # lbvoice_{book_id}_{lang}_{voice_key}
        book_id = int(parts[1])
        lang = parts[2]
        voice_key = parts[3] + '_' + parts[4]
    except (IndexError, ValueError):
        return

    book = get_book_by_id(book_id)
    if not book:
        return
    title = book[1]

    user_id = query.from_user.id
    from content.audio_service import (
        get_book_text, extract_text_from_pdf, store_book_text,
        translate_text, generate_audio, set_user_audio_prefs,
        get_cached_audio, cache_audio, LANGUAGES, VOICES,
    )

    set_user_audio_prefs(user_id, lang, voice_key)

    # Use chapter_id=0 with book_id offset for book-level cache
    cache_key = book_id * -1  # negative IDs for full-book cache
    cached_fid = get_cached_audio(cache_key, lang, voice_key)

    await _safe_edit(query, 
        f"\u23f3 *Generating audio for the full book...*\n\n"
        f"\U0001f4d6 {title}\n"
        f"\U0001f30d {LANGUAGES.get(lang, {}).get('name', lang)} — "
        f"{VOICES.get(voice_key, {}).get('name', voice_key)}\n\n"
        f"_This may take a moment..._",
        parse_mode='Markdown',
    )

    # Get book text
    original_text = get_book_text(book_id)
    if not original_text:
        try:
            pdf_file_id = book[6]
            if pdf_file_id:
                tg_file = await context.bot.get_file(pdf_file_id)
                pdf_bytes = bytes(await tg_file.download_as_bytearray())
                original_text = extract_text_from_pdf(pdf_bytes)
                if original_text:
                    store_book_text(book_id, original_text)
        except Exception:
            pass

    if not original_text:
        await _safe_edit(query, 
            "\u26a0\ufe0f Could not extract text from this book for audio.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
            ]),
        )
        return

    # Translate
    translated_text = translate_text(original_text, lang) if lang != 'en' else original_text

    # For full books, limit TTS to first ~10000 chars to avoid timeouts
    tts_text = translated_text[:10000]
    if len(translated_text) > 10000:
        tts_text += "... End of audio preview. Purchase the book for full chapter-by-chapter audio."

    import io as _io
    if cached_fid:
        audio_doc = cached_fid
    else:
        audio_bytes = await generate_audio(tts_text, voice_key)
        if not audio_bytes:
            await _safe_edit(query, 
                "\u26a0\ufe0f Audio generation failed.",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
                ]),
            )
            return
        audio_buf = _io.BytesIO(audio_bytes)
        audio_buf.name = f"book_{book_id}_{lang}.mp3"
        tmp_msg = await context.bot.send_audio(
            chat_id=query.message.chat_id,
            audio=audio_buf,
            title=title,
            performer=f"WiamApp ({LANGUAGES.get(lang, {}).get('name', '')})",
            filename=f"book_{book_id}_{lang}.mp3",
            disable_notification=True,
            protect_content=True,
            read_timeout=120,
            write_timeout=120,
        )
        if tmp_msg.audio:
            audio_doc = tmp_msg.audio.file_id
            cache_audio(cache_key, lang, voice_key, audio_doc)
        else:
            audio_doc = None
        try:
            await tmp_msg.delete()
        except Exception:
            pass

    try:
        await query.message.delete()
    except Exception:
        pass

    lang_name = LANGUAGES.get(lang, {}).get('name', lang)
    voice_name = VOICES.get(voice_key, {}).get('name', voice_key)

    if audio_doc:
        await query.message.chat.send_audio(
            audio=audio_doc,
            title=title,
            performer=f"WiamApp ({lang_name} - {voice_name})",
            caption=f"\U0001f3a7 *{title}*\n\U0001f30d {lang_name} | \U0001f3a4 {voice_name}",
            parse_mode='Markdown',
            protect_content=True,
            read_timeout=120,
            write_timeout=120,
        )

    await query.message.chat.send_message(
        f"\U0001f3a7 *{title}*\n"
        f"\U0001f30d {lang_name} | \U0001f3a4 {voice_name}\n\n"
        f"_Audio delivered above._",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("\U0001f3a7 Listen Again", callback_data=f'lbook_{book_id}')],
            [InlineKeyboardButton("\U0001f4da My Library", callback_data='my_library')],
            [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
        ]),
    )
