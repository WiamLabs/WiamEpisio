import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from core.role_manager import ROLE_FOUNDER, ROLE_CREATOR, get_user_role
from creators.content_service import get_book_creator_id, get_creator_payment_details
from payments.order_service import (
    attach_proof,
    count_orders,
    count_creator_orders,
    create_order,
    get_order,
    get_order_creator_id,
    get_user_pending_order,
    list_orders,
    list_creator_orders,
    update_order_status,
)

PLATFORM_MOMO = os.getenv("MOMO_NUMBER", "670 000 000")
PLATFORM_BANK = os.getenv("BANK_DETAILS", "Bank: XYZ\nAccount: 0000000000\nName: WiamApp")


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


async def pay_method_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles pay_momo_buy_{id}, pay_bank_buy_{id}, pay_momo_rent_{id}_{days}, pay_bank_rent_{id}_{days}"""
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id

    # Block banned/blocked users from purchasing
    from dashboards.users_dashboard import get_user_status
    ustatus = get_user_status(user_id)
    if ustatus in ('banned', 'blocked'):
        await _safe_edit(query, 
            "\U0001f6d1 Your account is restricted. You cannot make purchases.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
        )
        return

    data = query.data

    try:
        parts = data.split('_')
        method = parts[1]
        action = parts[2]

        if action == 'buy':
            book_id = int(parts[3])
            access_type = 'permanent'
            rent_days = None
        elif action == 'rent':
            book_id = int(parts[3])
            rent_days = int(parts[4])
            access_type = 'temporary'
        elif action == 'sub':
            plan_key = '_'.join(parts[3:])
            await _handle_sub_payment(query, user_id, method, plan_key, context)
            return
        elif action == 'chapter':
            chapter_id = int(parts[3])
            await _handle_chapter_payment(query, user_id, method, chapter_id, context)
            return
        else:
            await _safe_edit(query, "Invalid payment action.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
            return
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid payment data.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    from content.book_browser import get_book_by_id, _format_price
    book = get_book_by_id(book_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    title = book[1]
    if access_type == 'permanent':
        price = float(book[7] or 0)
    else:
        day_map = {1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 30: 13}
        idx = day_map.get(rent_days, 8)
        price = float(book[idx] or 0)

    # Look up the book's creator and their payment details
    creator_id = get_book_creator_id(book_id)
    creator_details = get_creator_payment_details(creator_id) if creator_id else {}
    creator_momo = creator_details.get('momo_number')
    creator_bank = creator_details.get('bank_details')

    # Block purchase if creator hasn't set payment details
    payment_method = 'momo' if method == 'momo' else 'bank'
    if payment_method == 'momo' and not creator_momo:
        await _safe_edit(query, 
            f"\u26a0\ufe0f Sorry, the creator of *{title}* has not set up their MoMo payment details yet.\n\n"
            f"Please try again later or choose a different payment method.",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return
    if payment_method == 'bank' and not creator_bank:
        await _safe_edit(query, 
            f"\u26a0\ufe0f Sorry, the creator of *{title}* has not set up their bank payment details yet.\n\n"
            f"Please try again later or choose a different payment method.",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Book", callback_data=f'book_{book_id}')],
                [InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')],
            ]),
        )
        return

    order_id, ref_code = create_order(
        user_id=user_id,
        content_id=book_id,
        chat_id=query.message.chat_id if query.message else None,
        payment_method=payment_method,
        access_type=access_type,
        rent_days=rent_days,
        price=price,
    )

    if payment_method == 'momo':
        instructions = (
            f"\U0001f4f1 *MTN MoMo*\n"
            f"Send *{_format_price(price)} GH\u20b5* to:\n"
            f"`{creator_momo}`\n\n"
            f"Reference: `{ref_code}`"
        )
    else:
        instructions = (
            f"\U0001f3e6 *Bank Transfer*\n"
            f"Send *{_format_price(price)} GH\u20b5*\n"
            f"{creator_bank}\n\n"
            f"Reference: `{ref_code}`"
        )

    access_label = "Permanent (download)" if access_type == 'permanent' else f"{rent_days} day{'s' if rent_days != 1 else ''} (view-only)"

    await _safe_edit(query, 
        f"\U0001f4d6 *{title}*\n"
        f"\U0001f4b0 {_format_price(price)} GH\u20b5 \u2014 {access_label}\n\n"
        f"{instructions}\n\n"
        f"\u2705 After payment, send a *screenshot* of your receipt here.\n"
        f"The creator will review and approve your access.",
        parse_mode='Markdown',
    )



async def _handle_chapter_payment(query, user_id, method, chapter_id, context):
    """Handle payment for a single premium chapter."""
    from content.chapter_service import get_chapter_by_id
    from content.book_browser import get_book_by_id, _format_price

    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        await _safe_edit(query, "Chapter not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    ch_id, content_id, ch_num, ch_title, start_p, end_p, is_free, price, pdf_fid = chapter

    book = get_book_by_id(content_id)
    if not book:
        await _safe_edit(query, "Book not found.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    title = book[1]
    price_val = float(price or 0)

    creator_id = get_book_creator_id(content_id)
    creator_details = get_creator_payment_details(creator_id) if creator_id else {}
    creator_momo = creator_details.get('momo_number')
    creator_bank = creator_details.get('bank_details')

    payment_method = 'momo' if method == 'momo' else 'bank'
    if payment_method == 'momo' and not creator_momo:
        await _safe_edit(query, 
            f"\u26a0\ufe0f Creator hasn't set up MoMo details yet. Try later.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
        )
        return
    if payment_method == 'bank' and not creator_bank:
        await _safe_edit(query, 
            f"\u26a0\ufe0f Creator hasn't set up bank details yet. Try later.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("\u25c0 Back to Chapters", callback_data=f'chapters_{content_id}')],
            ]),
        )
        return

    order_id, ref_code = create_order(
        user_id=user_id,
        content_id=content_id,
        chat_id=query.message.chat_id if query.message else None,
        payment_method=payment_method,
        access_type='chapter',
        rent_days=None,
        price=price_val,
    )

    # Store chapter_id in the order for later approval
    from core.db import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("UPDATE orders SET chapter_id=%s WHERE id=%s", (chapter_id, order_id))
    conn.commit()
    conn.close()

    if payment_method == 'momo':
        instructions = (
            f"\U0001f4f1 *MTN MoMo*\n"
            f"Send *{_format_price(price_val)} GH\u20b5* to:\n"
            f"`{creator_momo}`\n\n"
            f"Reference: `{ref_code}`"
        )
    else:
        instructions = (
            f"\U0001f3e6 *Bank Transfer*\n"
            f"Send *{_format_price(price_val)} GH\u20b5*\n"
            f"{creator_bank}\n\n"
            f"Reference: `{ref_code}`"
        )

    await _safe_edit(query, 
        f"\U0001f4d6 *{title}*\n"
        f"\U0001f4d1 Chapter {ch_num}: *{ch_title}*\n"
        f"\U0001f4b0 {_format_price(price_val)} GH\u20b5\n\n"
        f"{instructions}\n\n"
        f"\u2705 After payment, send a *screenshot* of your receipt here.\n"
        f"The creator will review and approve your access.",
        parse_mode='Markdown',
    )



async def _handle_sub_payment(query, user_id, method, plan, context):
    from creators.subscription_service import get_plan_price
    price = get_plan_price(plan)
    payment_method = 'momo' if method == 'momo' else 'bank'
    if payment_method == 'momo':
        instructions = (
            f"\U0001f4f1 *MTN MoMo*\n"
            f"Send *{price:,.0f} GH\u20b5* to:\n"
            f"`{PLATFORM_MOMO}`"
        )
    else:
        instructions = (
            f"\U0001f3e6 *Bank Transfer*\n"
            f"Amount: *{price:,.0f} GH\u20b5*\n"
            f"{PLATFORM_BANK}"
        )
    context.user_data['awaiting_sub_proof'] = {
        'plan': plan,
        'method': payment_method,
    }
    await _safe_edit(query, 
        f"\U0001f504 *{plan.replace('_', ' ').title()} Subscription*\n\n"
        f"\U0001f4b0 Amount: *{price:,.0f} GH\u20b5*\n\n"
        f"{instructions}\n\n"
        f"\u2705 After payment, send a *screenshot* of your receipt.\n"
        f"WiamApp Team will review and activate your subscription.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]),
    )


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User sends a payment proof photo. Attach it to their most recent pending order or subscription."""
    user_id = update.effective_user.id
    photo = update.message.photo[-1] if update.message.photo else None
    if not photo:
        return

    sub_info = context.user_data.get('awaiting_sub_proof')
    if sub_info:
        context.user_data.pop('awaiting_sub_proof', None)
        plan = sub_info.get('plan', 'monthly')

        # Block duplicate: check if they already have a pending proof
        from payments.subscription_proof_service import get_pending_sub_proof, create_sub_proof
        existing = get_pending_sub_proof(user_id)
        if existing:
            await update.message.reply_text(
                "\u23f3 You already have a subscription proof under review.\n\n"
                "Please wait for it to be approved or rejected before sending another one."
            )
            return

        from creators.subscription_service import get_plan_price as _get_sub_price
        sub_price = _get_sub_price(plan)
        plan_display = plan.replace('_', ' ').title()

        # Save proof to DB
        proof_id = create_sub_proof(user_id, plan, photo.file_id)

        from core.role_manager import get_founder_id
        founder_id = get_founder_id()
        if founder_id:
            username = update.effective_user.username or str(user_id)
            safe_username = str(username).replace('_', '\\_')
            try:
                await context.bot.send_message(
                    chat_id=founder_id,
                    text=(
                        f"\U0001f4f8 *Subscription Payment Proof*\n\n"
                        f"\U0001f464 Creator: @{safe_username} (`{user_id}`)\n"
                        f"\U0001f4cb Plan: {plan_display}\n"
                        f"\U0001f4b5 Amount: {sub_price:,.0f} GH\u20b5\n\n"
                        f"Tap below to view the proof and approve or reject."
                    ),
                    parse_mode='Markdown',
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("\U0001f4f8 Open To See The Proof", callback_data=f'view_subproof_{proof_id}')],
                    ]),
                )
            except Exception as e:
                print(f'[ERROR] Failed to notify founder about sub proof: {e}')
        await update.message.reply_text(
            f"\u2705 Subscription proof received!\n\n"
            f"Plan: {plan_display}\n\n"
            f"WiamApp Team will review and activate your subscription.\n"
            f"Please wait for approval before sending another proof."
        )
        return

    # Platform fee proof
    fee_id = context.user_data.get('awaiting_platform_fee_proof')
    if fee_id:
        context.user_data.pop('awaiting_platform_fee_proof', None)
        from payments.platform_fee_service import submit_fee_proof, get_platform_fee
        fee = get_platform_fee(fee_id)
        if not fee:
            await update.message.reply_text("Platform fee not found.")
            return
        submit_fee_proof(fee_id, photo.file_id)

        # fee columns: id, creator_id, period_start, period_end, total_sales, fee_rate, fee_amount, status, ...
        fee_amount = fee[6]
        total_sales = fee[4]
        fee_rate = fee[5]
        p_start = str(fee[2])[:10]
        p_end = str(fee[3])[:10]
        rate_pct = int(fee_rate * 100)

        from core.role_manager import get_founder_id
        founder_id = get_founder_id()
        if founder_id:
            username = update.effective_user.username or str(user_id)
            safe_username = str(username).replace('_', '\\_')
            try:
                await context.bot.send_message(
                    chat_id=founder_id,
                    text=(
                        f"\U0001f4f8 *Platform Fee Proof Received*\n"
                        f"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n"
                        f"\U0001f464 Creator: @{safe_username} (`{user_id}`)\n"
                        f"\U0001f4c5 Period: {p_start} to {p_end}\n"
                        f"\U0001f4b5 Sales in period: *GH\u20b5 {total_sales:,.2f}*\n"
                        f"\u2699\ufe0f Rate: *{rate_pct}%*\n"
                        f"\U0001f4b0 Amount bot asked to pay: *GH\u20b5 {fee_amount:,.2f}*\n\n"
                        f"Tap below to view the proof and approve or reject."
                    ),
                    parse_mode='Markdown',
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("\U0001f4f8 View Fee Proof", callback_data=f'view_fee_proof_{fee_id}')],
                    ]),
                )
            except Exception as e:
                print(f'[ERROR] Failed to notify founder about platform fee proof: {e}')
        await update.message.reply_text(
            f"\u2705 Platform fee proof received!\n\n"
            f"Amount: GH\u20b5 {fee_amount:,.2f}\n\n"
            f"WiamApp Team will review and confirm your payment.\n"
            f"You will be able to upload books once approved."
        )
        return

    # Block duplicate book proof: check if user already has a pending_review order
    from core.db import get_db_connection as _gdb_check
    _conn_check = _gdb_check()
    _cur_check = _conn_check.cursor()
    _cur_check.execute(
        "SELECT id FROM orders WHERE user_id=%s AND status='pending_review' LIMIT 1",
        (user_id,),
    )
    _existing_review = _cur_check.fetchone()
    _conn_check.close()
    if _existing_review:
        await update.message.reply_text(
            "\u23f3 You already have a payment proof under review.\n\n"
            "Please wait for it to be approved or rejected before sending another one."
        )
        return

    pending = get_user_pending_order(user_id)
    if not pending:
        await update.message.reply_text(
            "No pending order found.\n"
            "Please start a purchase first, then send your payment proof."
        )
        return

    order_id, content_id, ref_code = pending
    attach_proof(order_id, photo.file_id)

    await update.message.reply_text(
        f"\u2705 Payment proof received!\n\n"
        f"Order: #{order_id}\n"
        f"Reference: {ref_code}\n\n"
        f"Your proof has been sent to WiamApp Team for review.\n"
        f"You will get access once approved."
    )

    # --- Notify the CREATOR with text-only + "Open To See The Proof" button ---
    from content.book_browser import get_book_by_id, _format_price
    book = get_book_by_id(content_id)
    book_title = book[1] if book else f"Book #{content_id}"
    safe_title = str(book_title).replace('_', '\\_')
    username = update.effective_user.username or str(user_id)
    safe_username = str(username).replace('_', '\\_')

    # Look up order price
    order = get_order(order_id)
    order_price = order[9] if order and order[9] else 0

    creator_id = get_book_creator_id(content_id)
    if creator_id:
        try:
            await context.bot.send_message(
                chat_id=creator_id,
                text=(
                    f"\U0001f4f8 *New Payment Proof Received!*\n\n"
                    f"\U0001f4d6 Book: {safe_title}\n"
                    f"\U0001f464 Buyer: @{safe_username} (`{user_id}`)\n"
                    f"\U0001f4cc Order: #{order_id} | Ref: {ref_code}\n"
                    f"\U0001f4b0 Amount: {_format_price(order_price)} GH\u20b5\n\n"
                    f"Tap below to view the proof and approve or reject."
                ),
                parse_mode='Markdown',
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("\U0001f4f8 Open To See The Proof", callback_data=f'view_order_proof_{order_id}')],
                ]),
            )
        except Exception as e:
            print(f'[ERROR] Failed to notify creator about book proof: {e}')


ORDERS_PER_PAGE = 10


async def review_orders_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    actor_role = get_user_role(query.from_user.id)
    if actor_role != ROLE_FOUNDER:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    page = 0
    data = query.data
    if data.startswith('admin_review_orders_page_'):
        try:
            page = int(data.split('_')[-1])
        except ValueError:
            page = 0

    offset = page * ORDERS_PER_PAGE

    orders = list_orders(status='pending_review', limit=ORDERS_PER_PAGE, offset=offset)
    total = count_orders(status='pending_review')
    status_label = "pending review"
    back_cb = 'open_founder_dashboard' if actor_role == ROLE_FOUNDER else 'open_admin_panel'
    if not orders:
        await _safe_edit(query, "No pending orders.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back", callback_data=back_cb)]]))
        return

    total_pages = max(1, (total + ORDERS_PER_PAGE - 1) // ORDERS_PER_PAGE)

    keyboard = []
    for row in orders:
        (order_id, uid, cid, status, ref, method,
         access_type, rent_days, price, proof_fid, title, username) = row
        name = username or str(uid)
        book = title or f"Book #{cid}"
        label = f"#{order_id} {name} \u2014 {book}"
        if access_type == 'temporary' and rent_days:
            label += f" ({rent_days}d)"
        if price:
            label += f" {price:.0f}GH\u20b5"
        status_icon = "\U0001f4f8" if proof_fid else "\u23f3"
        keyboard.append([InlineKeyboardButton(f"{status_icon} {label}", callback_data=f'order_detail_{order_id}')])

    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton("\u25c0 Prev", callback_data=f'admin_review_orders_page_{page - 1}'))
    if page < total_pages - 1:
        nav.append(InlineKeyboardButton("Next \u25b6", callback_data=f'admin_review_orders_page_{page + 1}'))
    if nav:
        keyboard.append(nav)
    keyboard.append([InlineKeyboardButton("\U0001f3e0 Back", callback_data=back_cb)])
    await _safe_edit(query, 
        f"\U0001f4b0 Orders ({status_label}) \u2014 Page {page + 1}/{total_pages}:",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def order_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    actor_id = query.from_user.id
    actor_role = get_user_role(actor_id)

    try:
        order_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid order.")
        return

    order = get_order(order_id)
    if not order:
        await _safe_edit(query, "Order not found.")
        return

    # Access check: founder can see all, creator can see their book orders
    order_creator = get_order_creator_id(order_id)
    is_founder = actor_role == ROLE_FOUNDER
    is_order_creator = order_creator and order_creator == actor_id
    if not is_founder and not is_order_creator:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    back_cb = 'admin_review_orders' if is_founder else 'creator_my_orders'

    (oid, uid, cid, chat_id, status, ref, method,
     access_type, rent_days, price, proof_fid) = order

    from content.book_browser import get_book_by_id
    book = get_book_by_id(cid)
    book_title = book[1] if book else f"Book #{cid}"

    status_display = status.replace('_', ' ').title()
    access_display = access_type.replace('_', ' ').title() if access_type else ''
    method_display = (method or '').upper()

    text = (
        f"\U0001f4cb Order #{oid}\n\n"
        f"\U0001f4d6 Book: {book_title}\n"
    )
    # Show chapter info for chapter orders
    if access_type == 'chapter':
        from core.db import get_db_connection as _gdb
        _conn = _gdb()
        _cur = _conn.cursor()
        _cur.execute("SELECT chapter_id FROM orders WHERE id=%s", (oid,))
        _ch_row = _cur.fetchone()
        _conn.close()
        if _ch_row and _ch_row[0]:
            from content.chapter_service import get_chapter_by_id as _get_ch
            _ch = _get_ch(_ch_row[0])
            if _ch:
                text += f"\U0001f4d1 Chapter: Ch.{_ch[2]}: {_ch[3]}\n"
    text += f"\U0001f464 User: {uid}\n"
    if price:
        text += f"\U0001f4b0 Price: {price:.0f} GH\u20b5\n"
    text += (
        f"\U0001f4b3 Method: {method_display}\n"
        f"\U0001f511 Access: {access_display}"
    )
    if rent_days:
        text += f" ({rent_days} days)"
    text += f"\n\U0001f4cc Ref: {ref}\n"
    text += f"\U0001f4e6 Status: {status_display}\n"
    if proof_fid:
        text += "\U0001f4f8 Proof: attached"
    else:
        text += "\u274c Proof: not yet sent"

    keyboard = []
    if status in ['awaiting_payment', 'pending_review']:
        keyboard.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'order_approve_{order_id}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'order_reject_{order_id}'),
        ])
    if proof_fid:
        keyboard.append([InlineKeyboardButton("\U0001f4f8 View Proof", callback_data=f'order_proof_{order_id}')])
    if is_founder:
        keyboard.append([InlineKeyboardButton("\U0001f5d1 Delete Order", callback_data=f'fdel_order_{order_id}')])
    keyboard.append([InlineKeyboardButton("\u25c0 Back to Orders", callback_data=back_cb)])

    await _safe_edit(query, text, reply_markup=InlineKeyboardMarkup(keyboard))


async def order_proof_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    actor_id = query.from_user.id
    actor_role = get_user_role(actor_id)

    try:
        order_id = int(query.data.split('_')[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid order.")
        return

    # Access check: founder or book creator
    order_creator = get_order_creator_id(order_id)
    is_founder = actor_role == ROLE_FOUNDER
    is_order_creator = order_creator and order_creator == actor_id
    if not is_founder and not is_order_creator:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    back_cb = 'admin_review_orders' if is_founder else 'creator_my_orders'

    order = get_order(order_id)
    if not order or not order[10]:
        await _safe_edit(query, "No proof attached to this order.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\u25c0 Back to Orders", callback_data=back_cb)]]))
        return

    proof_fid = order[10]
    try:
        await query.message.delete()
    except Exception:
        pass
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("\u2705 Approve", callback_data=f'order_approve_{order_id}'),
         InlineKeyboardButton("\u274c Reject", callback_data=f'order_reject_{order_id}')],
        [InlineKeyboardButton("\u25c0 Back to Orders", callback_data=back_cb)],
    ])
    await query.message.chat.send_photo(
        photo=proof_fid,
        caption=f"\U0001f4f8 Payment proof for Order #{order_id}",
        reply_markup=keyboard,
        protect_content=True,
    )


async def view_order_proof_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Creator taps 'Open To See The Proof' from the chat notification."""
    query = update.callback_query
    await query.answer()
    actor_id = query.from_user.id
    actor_role = get_user_role(actor_id)

    try:
        order_id = int(query.data.split('_')[3])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid order.")
        return

    order_creator = get_order_creator_id(order_id)
    is_founder = actor_role == ROLE_FOUNDER
    is_order_creator = order_creator and order_creator == actor_id
    if not is_founder and not is_order_creator:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    order = get_order(order_id)
    if not order or not order[10]:
        await _safe_edit(query, "No proof attached to this order.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    proof_fid = order[10]
    status = order[4]

    try:
        await query.message.delete()
    except Exception:
        pass

    keyboard_rows = []
    if status in ['awaiting_payment', 'pending_review']:
        keyboard_rows.append([
            InlineKeyboardButton("\u2705 Approve", callback_data=f'order_approve_{order_id}'),
            InlineKeyboardButton("\u274c Reject", callback_data=f'order_reject_{order_id}'),
        ])
    else:
        keyboard_rows.append([InlineKeyboardButton(f"\U0001f4e6 Already {status.replace('_', ' ').title()}", callback_data='noop')])
    keyboard_rows.append([InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')])

    await query.message.chat.send_photo(
        photo=proof_fid,
        caption=f"\U0001f4f8 Payment proof for Order #{order_id}",
        reply_markup=InlineKeyboardMarkup(keyboard_rows),
        protect_content=True,
    )


async def order_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    actor_id = query.from_user.id
    actor_role = get_user_role(actor_id)

    try:
        parts = query.data.split('_')
        action = parts[1]
        order_id = int(parts[2])
    except (IndexError, ValueError):
        await _safe_edit(query, "Invalid action.")
        return

    order = get_order(order_id)
    if not order:
        await _safe_edit(query, "Order not found.")
        return

    # Access check: founder can act on all, creator can act on their book orders
    order_creator = get_order_creator_id(order_id)
    is_founder = actor_role == ROLE_FOUNDER
    is_order_creator = order_creator and order_creator == actor_id
    if not is_founder and not is_order_creator:
        await _safe_edit(query, "Access denied.", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]]))
        return

    back_cb = 'admin_review_orders' if is_founder else 'creator_my_orders'

    (oid, uid, cid, chat_id, status, ref, method,
     access_type, rent_days, price, proof_fid) = order

    # Look up buyer info for evidence
    from core.db import get_db_connection as _get_db_ev
    _conn_ev = _get_db_ev()
    _cur_ev = _conn_ev.cursor()
    _cur_ev.execute("SELECT username, first_name FROM users WHERE telegram_id=%s", (uid,))
    _urow = _cur_ev.fetchone()
    _conn_ev.close()
    buyer_username = _urow[0] if _urow and _urow[0] else str(uid)
    buyer_name = _urow[1] if _urow and len(_urow) > 1 and _urow[1] else None

    from content.book_browser import get_book_by_id as _get_bk
    _bk = _get_bk(cid)
    book_title = _bk[1] if _bk else f"Book #{cid}"

    if action == 'approve':
        update_order_status(order_id, 'approved')
        # Record commission split
        if price and float(price) > 0:
            from payments.commission_service import record_commission
            if order_creator:
                record_commission(order_id, cid, order_creator, uid, float(price))
        from content.access_control import grant_permanent_access, grant_temporary_access
        if access_type == 'chapter':
            from content.chapter_service import grant_chapter_access, get_chapter_by_id
            conn_ch = _get_db_ev()
            cur_ch = conn_ch.cursor()
            cur_ch.execute("SELECT chapter_id FROM orders WHERE id=%s", (order_id,))
            ch_row = cur_ch.fetchone()
            conn_ch.close()
            ch_id = ch_row[0] if ch_row else None
            if ch_id:
                grant_chapter_access(uid, ch_id, cid)
                ch_info = get_chapter_by_id(ch_id)
                ch_title = f"Ch.{ch_info[2]}: {ch_info[3]}" if ch_info else f"Chapter #{ch_id}"
                access_msg = f"Chapter access granted: {ch_title}"
            else:
                access_msg = "Chapter access granted."
        elif access_type == 'permanent':
            grant_permanent_access(uid, cid)
            access_msg = "Permanent access granted (download enabled)."
        else:
            _, end_date = grant_temporary_access(uid, cid, rent_days or 1)
            access_msg = f"Temporary access granted until {str(end_date)[:10]}."

        # Save evidence
        from payments.payment_evidence import save_evidence
        save_evidence(
            evidence_type='book_order', order_id=order_id,
            buyer_id=uid, buyer_username=buyer_username, buyer_name=buyer_name,
            book_title=book_title, amount=float(price) if price else 0,
            proof_file_id=proof_fid, action='approved', acted_by=actor_id,
        )

        result_text = f"\u2705 Order #{order_id} approved!\n\n{access_msg}"
        result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])
        try:
            await _safe_edit(query, result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
            except Exception:
                try:
                    await query.message.delete()
                except Exception:
                    pass
                await query.message.chat.send_message(result_text, reply_markup=result_kb)

        if chat_id:
            try:
                read_msg = "Go to the book \u2192 Read Chapters to access it." if access_type == 'chapter' else "Go to \u2764\ufe0f My Library to read your book."
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=(
                        f"\u2705 Your payment for Order #{order_id} has been approved!\n\n"
                        f"{access_msg}\n\n"
                        f"{read_msg}"
                    ),
                )
            except Exception:
                pass

    elif action == 'reject':
        update_order_status(order_id, 'rejected')

        # Save evidence
        from payments.payment_evidence import save_evidence
        save_evidence(
            evidence_type='book_order', order_id=order_id,
            buyer_id=uid, buyer_username=buyer_username, buyer_name=buyer_name,
            book_title=book_title, amount=float(price) if price else 0,
            proof_file_id=proof_fid, action='rejected', acted_by=actor_id,
        )

        result_text = f"\u274c Order #{order_id} rejected."
        result_kb = InlineKeyboardMarkup([[InlineKeyboardButton("\U0001f3e0 Back to Menu", callback_data='back_to_menu')]])
        try:
            await _safe_edit(query, result_text, reply_markup=result_kb)
        except Exception:
            try:
                await query.edit_message_caption(caption=result_text, reply_markup=result_kb)
            except Exception:
                try:
                    await query.message.delete()
                except Exception:
                    pass
                await query.message.chat.send_message(result_text, reply_markup=result_kb)

        if chat_id:
            try:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=(
                        f"\u274c Your payment for Order #{order_id} was not approved.\n\n"
                        f"Reference: {ref}\n"
                        f"Please contact support if you believe this is an error."
                    ),
                )
            except Exception:
                pass
