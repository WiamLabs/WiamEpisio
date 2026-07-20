async def safe_reply(query, text, reply_markup=None, parse_mode=None):
    """Edit current message or delete+send new if edit fails (e.g. photo→text)."""
    try:
        return await query.edit_message_text(
            text,
            reply_markup=reply_markup,
            parse_mode=parse_mode,
        )
    except Exception:
        try:
            await query.message.delete()
        except Exception:
            pass
        return await query.get_bot().send_message(
            chat_id=query.message.chat_id,
            text=text,
            reply_markup=reply_markup,
            parse_mode=parse_mode,
        )
