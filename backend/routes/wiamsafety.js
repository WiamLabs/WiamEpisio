// © 2026 WiamApp. Powered by WiamLabs
// WiamSafety Section 9 — product recovery webhook (WiamApp side only).
//
// POST /api/wiamsafety/recovery
// Headers: X-WiamSafety-Signature: <hex HMAC-SHA256 of raw body>
// Body: { referenceId, action: "password_reset", productUserId, handoffToken }
//
// Mounted with express.raw so HMAC matches Core's JSON.stringify(body).
// Does NOT touch WiamSafety Core DB or accept plaintext passwords.

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getUserEmailById, sendPasswordResetForEmail } from '../lib/passwordReset.js';
import {
  getWiamSafetyHmacSecret,
  sha256Hex,
  verifyWiamSafetySignature,
} from '../lib/wiamsafety.js';

const router = Router();

function rawBodyToString(body) {
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return '';
}

/**
 * Consume handoff token (single-use). Returns false if already used.
 */
async function consumeHandoff({ tokenHash, referenceId, productUserId, action }) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from('wiamsafety_handoffs').insert({
    token_hash: tokenHash,
    reference_id: referenceId,
    product_user_id: productUserId,
    action,
    consumed_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'replay' };
    // Table missing — fail closed with a clear ops signal
    if (/relation .* does not exist|schema cache/i.test(error.message || '')) {
      throw new Error('wiamsafety_handoffs table missing — run database/migrations/043_wiamsafety_handoffs.sql');
    }
    throw error;
  }
  return { ok: true };
}

// ─── POST /recovery ───────────────────────────────────────────
router.post('/recovery', async (req, res) => {
  try {
    const secret = getWiamSafetyHmacSecret();
    if (!secret || secret.length < 16) {
      console.error('[wiamsafety] WIAMSAFETY_HMAC_SECRET missing or too short');
      return res.status(503).json({ success: false, error: 'WiamSafety webhook not configured.' });
    }

    const raw = rawBodyToString(req.body);
    const signature = req.headers['x-wiamsafety-signature'];
    if (!verifyWiamSafetySignature(raw, signature, secret)) {
      return res.status(401).json({ success: false, error: 'Invalid signature.' });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
    }

    const referenceId = String(payload.referenceId || '').trim();
    const action = String(payload.action || '').trim();
    const productUserId = String(payload.productUserId || '').trim();
    const handoffToken = String(payload.handoffToken || '').trim();

    if (!referenceId || !action || !productUserId || !handoffToken) {
      return res.status(400).json({
        success: false,
        error: 'referenceId, action, productUserId, and handoffToken are required.',
      });
    }

    if (action !== 'password_reset') {
      return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    }

    // Never accept passwords from WiamSafety
    if (payload.password != null || payload.newPassword != null || payload.plaintextPassword != null) {
      return res.status(400).json({
        success: false,
        error: 'Passwords must not be sent to WiamApp via WiamSafety.',
      });
    }

    const email = await getUserEmailById(productUserId);
    if (!email) {
      console.warn('[wiamsafety] Unknown productUserId:', productUserId);
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const tokenHash = sha256Hex(handoffToken);
    const consumed = await consumeHandoff({
      tokenHash,
      referenceId,
      productUserId,
      action,
    });
    if (!consumed.ok) {
      return res.status(409).json({ success: false, error: 'Handoff token already used.' });
    }

    const result = await sendPasswordResetForEmail(email);
    if (!result.ok) {
      return res.status(500).json({ success: false, error: result.error || 'Reset failed.' });
    }

    // Core is notified via POST /v1/reset/complete only after the user
    // actually sets a new password (see /api/auth/reset-password).
    return res.json({ success: true });
  } catch (err) {
    console.error('[wiamsafety] recovery error:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Recovery handoff failed.' });
  }
});

export default router;
