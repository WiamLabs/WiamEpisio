// © 2026 WiamApp. Powered by WiamLabs
// backend/routes/founderAuth.js
// Telegram → Studio passwordless Founder login (same pattern as WiamPass).
// Mint: bot only (X-Bot-Secret). Exchange: Studio server only.

import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

const LINK_TTL_MS = 30 * 60 * 1000;
const REUSE_GRACE_MS = 10 * 60 * 1000;

function requireBotSecret(req, res, next) {
  const expected = process.env.TELEGRAM_BOT_INTERNAL_SECRET;
  const got = req.headers['x-bot-secret'];
  if (!expected || !got || got !== expected) {
    return res.status(403).json({ success: false, error: 'Bot secret required.' });
  }
  next();
}

function isFounderTelegram(telegramId) {
  const founderId = process.env.FOUNDER_TELEGRAM_ID;
  return !!founderId && !!telegramId && String(telegramId) === String(founderId);
}

function founderUserPayload() {
  return {
    email: process.env.FOUNDER_EMAIL || 'founder@wiamapp.com',
    role: 'SUPER_ADMIN',
    firstName: 'Martin',
    lastName: 'Founder',
    product: 'wiamapp',
  };
}

/** Mint one-time code — WiamPass bot (or any bot with shared secret) only. */
router.post('/telegram/founder-web-link', requireBotSecret, async (req, res) => {
  try {
    const telegramId = String(req.body?.telegramId ?? '').trim();
    if (!isFounderTelegram(telegramId)) {
      return res.status(403).json({
        success: false,
        error: 'This Telegram account is not authorized as founder.',
      });
    }

    // Prefix so Studio can route exchange to WiamApp without relying only on ?source=
    const raw = `wa_${crypto.randomBytes(24).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

    await supabaseAdmin
      .from('founder_web_login_tokens')
      .delete()
      .eq('telegram_id', telegramId)
      .lt('expires_at', new Date().toISOString());

    const { error } = await supabaseAdmin.from('founder_web_login_tokens').insert({
      token: raw,
      telegram_id: telegramId,
      expires_at: expiresAt,
    });
    if (error) {
      if (/relation .*founder_web_login_tokens.* does not exist|schema cache/i.test(error.message || '')) {
        return res.status(503).json({
          success: false,
          error: 'Founder login table missing. Run database/migrations/042_founder_web_login_tokens.sql in WiamApp Supabase.',
        });
      }
      throw error;
    }

    res.json({ code: raw });
  } catch (err) {
    console.error('[founder-web-link]', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Could not create Founder login link.',
    });
  }
});

/** Exchange code for Studio session — called by Studio server, not browsers directly with bot secret. */
router.post('/telegram/founder-web-exchange', async (req, res) => {
  try {
    const raw = String(req.body?.code ?? '').trim();
    if (!raw) {
      return res.status(401).json({ success: false, error: 'Missing login code.' });
    }

    const { data: row, error } = await supabaseAdmin
      .from('founder_web_login_tokens')
      .select('*')
      .eq('token', raw)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return res.status(401).json({
        success: false,
        error: 'This login link is invalid. Open a fresh one from Telegram.',
      });
    }

    const now = Date.now();
    const reuseGrace =
      row.used_at && now - new Date(row.used_at).getTime() <= REUSE_GRACE_MS;

    if (row.used_at && !reuseGrace) {
      return res.status(401).json({
        success: false,
        error: 'This login link was already used. Open a fresh one from Telegram.',
      });
    }
    if (!reuseGrace && new Date(row.expires_at).getTime() < now) {
      return res.status(401).json({
        success: false,
        error: 'This login link has expired. Open a fresh one from Telegram.',
      });
    }

    if (!isFounderTelegram(row.telegram_id)) {
      return res.status(403).json({ success: false, error: 'Founder account not available.' });
    }

    if (!row.used_at) {
      await supabaseAdmin
        .from('founder_web_login_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', row.id);
    }

    // Studio only needs a bearer-like token in localStorage (same shape as WiamPass).
    const accessToken = `wiamapp_studio_${crypto.randomBytes(32).toString('base64url')}`;
    const refreshToken = crypto.randomBytes(24).toString('base64url');

    res.json({
      accessToken,
      refreshToken,
      user: founderUserPayload(),
      authMode: 'telegram-founder-wiamapp',
    });
  } catch (err) {
    console.error('[founder-web-exchange]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
